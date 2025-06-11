import { defineConfig } from "tsdown"
import { generateDocumentation } from "tsdoc-markdown"

export default defineConfig({
  hooks: {
    "build:done": () => {
      generateDocumentation({
        inputFiles: ["./src/plugin.ts", "./src/lib.ts"],
        outputFile: "./README.md",
        buildOptions: {
          explore: false,
          types: true,
        },
        markdownOptions: {
          emoji: null,
          headingLevel: "###",
        },
      })
    },
  },
})
