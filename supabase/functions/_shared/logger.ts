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
  error?: Error
): string {
  const entry: Record<string, unknown> = {
    timestamp: new Date().toISOString(),
    level,
    service,
    message
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
        console.log(formatLog("debug", service, message, context))
      }
    },

    info(message: string, context?: LogContext): void {
      if (shouldLog("info")) {
        console.log(formatLog("info", service, message, context))
      }
    },

    warn(message: string, context?: LogContext, error?: Error): void {
      if (shouldLog("warn")) {
        console.warn(formatLog("warn", service, message, context, error))
      }
    },

    error(message: string, context?: LogContext, error?: Error): void {
      if (shouldLog("error")) {
        console.error(formatLog("error", service, message, context, error))
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
