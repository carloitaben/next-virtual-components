import VirtualModulesPlugin from "webpack-virtual-modules"
import type { NextConfig } from "next"
import { glob } from "fast-glob"
import path from "path"
import fs from "fs/promises"
import ts from "typescript"
import * as v from "valibot"

const CLIENT_ONLY = "client-only"
const SERVER_ONLY = "server-only"

function analyzeSpecifier(
  specifier: string,
  options: Pick<ConfigOutput, "clientOnlyModules" | "serverOnlyModules">
) {
  if (
    specifier === CLIENT_ONLY ||
    options.clientOnlyModules.includes(specifier)
  ) {
    return CLIENT_ONLY
  }

  if (
    specifier === SERVER_ONLY ||
    options.serverOnlyModules.includes(specifier)
  ) {
    return SERVER_ONLY
  }

  return null
}

type AnalysisResult = ReturnType<typeof analyzeSpecifier>

async function analyze(
  file: string,
  options: Pick<ConfigOutput, "clientOnlyModules" | "serverOnlyModules"> & {
    cache: Map<string, AnalysisResult>
  }
): Promise<AnalysisResult> {
  const cache = options.cache.get(file)

  if (typeof cache !== "undefined") {
    return cache
  }

  const fileContent = await fs.readFile(file, "utf-8")

  // console.log("creating source file for", file)

  const sourceFile = ts.createSourceFile(
    file,
    fileContent,
    ts.ScriptTarget.Latest,
    true
  )

  for (const statement of sourceFile.statements) {
    if (ts.isExportDeclaration(statement)) {
      if (statement.isTypeOnly) {
        continue
      }

      console.log("TODO: handle reexports", file)
      continue
    }

    if (ts.isImportDeclaration(statement)) {
      if (statement.importClause?.isTypeOnly) {
        continue
      }

      const specifier = statement.moduleSpecifier.getText()

      const result = analyzeSpecifier(specifier, options)
      options.cache.set(file, result)
      return result
    }
  }

  options.cache.set(file, null)
  return null
}

const Config = v.object({
  cwd: v.optional(v.string(), process.cwd()),
  moduleName: v.optional(v.string(), "components"),
  components: v.array(v.string()),
  export: v.optional(v.string(), "default"),
  transpile: v.optional(v.boolean(), false),
  clientOnlyModules: v.optional(v.array(v.string()), []),
  serverOnlyModules: v.optional(v.array(v.string()), []),
})

type Config = v.InferInput<typeof Config>

type ConfigOutput = v.InferOutput<typeof Config>

export async function withVirtualComponents(
  pluginConfig: Config,
  nextConfig: NextConfig
): Promise<NextConfig> {
  const config = v.parse(Config, pluginConfig)
  const server = new Map<string, string>()
  const client = new Map<string, string>()
  const cache = new Map<string, AnalysisResult>()

  const matches = await glob(config.components, {
    cwd: config.cwd,
    onlyFiles: true,
  })

  await Promise.all(
    matches.map(async (match) => {
      const parsed = path.parse(match)
      const source = path.join(config.cwd, match)
      const result = await analyze(match, {
        clientOnlyModules: config.clientOnlyModules,
        serverOnlyModules: config.serverOnlyModules,
        cache,
      })

      switch (result) {
        case CLIENT_ONLY:
          client.set(parsed.name, source)
          break
        case SERVER_ONLY:
          server.set(parsed.name, source)
          break
        default:
          client.set(parsed.name, source)
          server.set(parsed.name, source)
          break
      }
    })
  )

  const clientEntries = Array.from(client.entries())
  const serverEntries = Array.from(server.entries())

  const clientFileContent = clientEntries.reduce(
    (lines, [key, source]) => {
      lines.push(`export const ${key} = React.lazy(() => import("${source}"))`)
      return lines
    },
    ['"use client"', 'import * as React from "react"']
  )

  const serverFileContent = serverEntries.reduce(
    (lines, [key, source]) => {
      lines.push(`export { default as ${key} } from "${source}"`)
      return lines
    },
    ['import "server-only"', 'import * as React from "react"']
  )

  const typescript = true // TODO: detect this

  const extension = typescript ? "ts" : "js"
  const serverVirtualFile = `./server.${extension}`
  const clientVirtualFile = `./client.${extension}`

  const virtualModulesPlugin = new VirtualModulesPlugin({
    [`node_modules/${config.moduleName}/server.${extension}`]:
      serverFileContent.join("\n"),
    [`node_modules/${config.moduleName}/client.${extension}`]:
      clientFileContent.join("\n"),
    [`node_modules/${config.moduleName}/package.json`]: JSON.stringify({
      name: config.moduleName,
      type: "module",
      private: true,
      exports: {
        "react-server": serverVirtualFile,
        node: serverVirtualFile,
        "edge-light": serverVirtualFile,
        workerd: serverVirtualFile,
        browser: clientVirtualFile,
        default: clientVirtualFile,
      },
    }),
  })

  if (config.transpile || typescript) {
    if (nextConfig.transpilePackages) {
      nextConfig.transpilePackages.push(config.moduleName)
    } else {
      nextConfig.transpilePackages = [config.moduleName]
    }
  }

  return {
    ...nextConfig,
    webpack(config, context) {
      // config?.webpack?.(config, context)
      config.plugins.push(virtualModulesPlugin)

      return config
    },
  }
}
