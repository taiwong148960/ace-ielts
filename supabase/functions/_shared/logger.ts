/**
 * Structured Logger for Edge Functions
 * Provides consistent, structured logging with context
 */

// Declare Deno global for TypeScript
declare const Deno: {
  env: {
    get: (key: string) => string | undefined
  }
}

type LogLevel = "debug" | "info" | "warn" | "error"

interface LogContext {
  [key: string]: unknown
}

interface Logger {
  debug(message: string, context?: LogContext): void
  info(message: string, context?: LogContext): void
  warn(message: string, context?: LogContext, error?: Error): void
  error(message: string, context?: LogContext, error?: Error): void
}

/**
 * Check if we're in production mode
 */
function isProduction(): boolean {
  return Deno.env.get("ENVIRONMENT") === "production"
}

/**
 * Format log entry as structured JSON
 */
function formatLog(
  level: LogLevel,
  service: string,
  message: string,
  context?: LogContext,
  error?: Error,
  location?: CallerInfo
): string {
  const entry: Record<string, unknown> = {
    timestamp: new Date().toISOString(),
    level,
    service,
    message,
    location
  }

  if (context && Object.keys(context).length > 0) {
    entry.context = context
  }

  if (error) {
    entry.error = {
      name: error.name,
      message: error.message,
      stack: isProduction() ? undefined : error.stack
    }
  }

  return JSON.stringify(entry)
}

interface CallerInfo {
  file?: string
  function?: string
  line?: number
  column?: number
}

/**
 * Attempt to extract caller location from the stack trace.
 * The stack format is V8-like in Deno: "at func (file:line:column)".
 * We skip the first few frames to reach the user callsite.
 */
function getCallerInfo(stack?: string): CallerInfo | undefined {
  if (!stack) return undefined
  const lines = stack.split("\n").map((line) => line.trim())
  // Frame 0 is "Error", frame 1 is getCallerInfo, frame 2 is logger method, frame 3 is the caller
  const target = lines[3] || lines[2]
  if (!target) return undefined

  const withFunction = target.match(/^at (.+) \((.+):(\d+):(\d+)\)$/)
  if (withFunction) {
    const [, fn, file, line, column] = withFunction
    return {
      function: fn,
      file,
      line: Number(line),
      column: Number(column)
    }
  }

  const withoutFunction = target.match(/^at (.+):(\d+):(\d+)$/)
  if (withoutFunction) {
    const [, file, line, column] = withoutFunction
    return {
      file,
      line: Number(line),
      column: Number(column)
    }
  }

  return undefined
}

/**
 * Create a logger instance for a specific service/function
 */
export function createLogger(service: string): Logger {
  const shouldLog = (level: LogLevel): boolean => {
    // In production, only log info, warn, error
    if (isProduction() && level === "debug") {
      return false
    }
    return true
  }

  return {
    debug(message: string, context?: LogContext): void {
      if (shouldLog("debug")) {
        const location = getCallerInfo(new Error().stack)
        console.log(formatLog("debug", service, message, context, undefined, location))
      }
    },

    info(message: string, context?: LogContext): void {
      if (shouldLog("info")) {
        const location = getCallerInfo(new Error().stack)
        console.log(formatLog("info", service, message, context, undefined, location))
      }
    },

    warn(message: string, context?: LogContext, error?: Error): void {
      if (shouldLog("warn")) {
        const location = getCallerInfo(new Error().stack)
        console.warn(formatLog("warn", service, message, context, error, location))
      }
    },

    error(message: string, context?: LogContext, error?: Error): void {
      if (shouldLog("error")) {
        const location = getCallerInfo(new Error().stack)
        console.error(formatLog("error", service, message, context, error, location))
      }
    }
  }
}

/**
 * Timer utility for measuring operation duration
 */
export interface Timer {
  end(context?: LogContext): void
  endWithError(error: Error, context?: LogContext): void
}

export function startTimer(service: string, operation: string): Timer {
  const logger = createLogger(service)
  const startTime = Date.now()

  return {
    end(context?: LogContext): void {
      const durationMs = Date.now() - startTime
      logger.info(`${operation} completed`, { ...context, durationMs })
    },

    endWithError(error: Error, context?: LogContext): void {
      const durationMs = Date.now() - startTime
      logger.error(`${operation} failed`, { ...context, durationMs }, error)
    }
  }
}
