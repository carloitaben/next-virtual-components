// Adapted from https://github.com/vercel/next.js/blob/canary/packages/next/src/build/output/log.ts

import * as pc from "next/dist/lib/picocolors"

const prefixes = {
  wait: pc.white(pc.bold("○")),
  error: pc.red(pc.bold("⨯")),
  warn: pc.yellow(pc.bold("⚠")),
  info: pc.white(pc.bold(" ")),
  event: pc.green(pc.bold("✓")),
  trace: pc.magenta(pc.bold("»")),
} as const

const LOGGING_METHOD = {
  log: "log",
  warn: "warn",
  error: "error",
} as const

function prefixedLog(prefixType: keyof typeof prefixes, ...message: unknown[]) {
  if ((message[0] === "" || message[0] === undefined) && message.length === 1) {
    message.shift()
  }

  const consoleMethod: keyof typeof LOGGING_METHOD =
    prefixType in LOGGING_METHOD
      ? LOGGING_METHOD[prefixType as keyof typeof LOGGING_METHOD]
      : "log"

  const prefix = prefixes[prefixType]

  if (message.length === 0) {
    console[consoleMethod]("")
  } else {
    console[consoleMethod](" " + prefix, ...message)
  }
}

export function bootstrap(...message: unknown[]) {
  console.log(" ", ...message)
}

export function wait(...message: unknown[]) {
  prefixedLog("wait", ...message)
}

export function error(...message: unknown[]) {
  prefixedLog("error", ...message)
}

export function fail(err: any, message?: string) {
  const isError = err instanceof Error
  error(isError ? err.message : err)

  if (message || isError) {
    info("")
    console.error(
      pc.dim(
        String([message || err.cause, err.stack].filter(Boolean).join("\n"))
      )
    )
  }
}

export function warn(...message: unknown[]) {
  prefixedLog("warn", ...message)
}

export function info(...message: unknown[]) {
  prefixedLog("info", ...message)
}

export function event(...message: unknown[]) {
  prefixedLog("event", ...message)
}

export function trace(...message: unknown[]) {
  prefixedLog("trace", ...message)
}
