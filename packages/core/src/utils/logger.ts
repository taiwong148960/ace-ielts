/**
 * Centralized Logging Utility
 *
 * Provides structured, consistent logging across the application with:
 * - Log levels (debug, info, warn, error)
 * - Context-aware logging (module/service name)
 * - Structured metadata support
 * - Environment-aware output (suppresses debug in production)
 * - Performance timing helpers
 */

/// <reference types="vite/client" />

/**
 * Log levels in order of severity
 */
export type LogLevel = "debug" | "info" | "warn" | "error"

/**
 * Structured log entry interface
 */
export interface LogEntry {
  level: LogLevel
  message: string
  context?: string
  timestamp: string
  data?: Record<string, unknown>
  error?: Error
}

/**
 * Logger configuration options
 */
export interface LoggerConfig {
  /** Minimum log level to output (default: 'debug' in dev, 'info' in prod) */
  minLevel: LogLevel
  /** Enable console output (default: true) */
  enableConsole: boolean
  /** Enable structured JSON output for log aggregation (default: false) */
  enableStructured: boolean
  /** Custom log handler for external logging services */
  customHandler?: (entry: LogEntry) => void
}

// Log level priority for filtering
const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
}

// Check if running in development mode
const isDev = typeof import.meta !== "undefined" && import.meta.env?.DEV

// Default configuration
const defaultConfig: LoggerConfig = {
  minLevel: isDev ? "debug" : "info",
  enableConsole: true,
  enableStructured: false,
}

// Global configuration (can be modified at runtime)
let globalConfig: LoggerConfig = { ...defaultConfig }

/**
 * Configure the global logger settings
 */
export function configureLogger(config: Partial<LoggerConfig>): void {
  globalConfig = { ...globalConfig, ...config }
}

/**
 * Get current timestamp in ISO format
 */
function getTimestamp(): string {
  return new Date().toISOString()
}

/**
 * Format log message with context
 */
function formatMessage(context: string | undefined, message: string): string {
  return context ? `[${context}] ${message}` : message
}

/**
 * Check if a log level should be output based on current config
 */
function shouldLog(level: LogLevel): boolean {
  return LOG_LEVEL_PRIORITY[level] >= LOG_LEVEL_PRIORITY[globalConfig.minLevel]
}

/**
 * Output log entry to console with appropriate styling
 */
function consoleOutput(entry: LogEntry): void {
  const formattedMessage = formatMessage(entry.context, entry.message)
  const timestamp = entry.timestamp.split("T")[1].split(".")[0] // HH:mm:ss

  // Style definitions for each level
  const styles: Record<LogLevel, { method: "log" | "info" | "warn" | "error"; color: string }> = {
    debug: { method: "log", color: "#9CA3AF" }, // Gray
    info: { method: "info", color: "#3B82F6" }, // Blue
    warn: { method: "warn", color: "#F59E0B" }, // Amber
    error: { method: "error", color: "#EF4444" }, // Red
  }

  const style = styles[entry.level]
  const prefix = `%c${timestamp} [${entry.level.toUpperCase()}]`

  // Build console arguments
  const consoleArgs: unknown[] = [
    `${prefix} ${formattedMessage}`,
    `color: ${style.color}; font-weight: ${entry.level === "error" ? "bold" : "normal"}`,
  ]

  // Add data if present
  if (entry.data && Object.keys(entry.data).length > 0) {
    consoleArgs.push(entry.data)
  }

  // Add error if present
  if (entry.error) {
    consoleArgs.push(entry.error)
  }

  // Output using appropriate console method
  // eslint-disable-next-line no-console
  console[style.method](...consoleArgs)
}

/**
 * Output log entry as structured JSON
 */
function structuredOutput(entry: LogEntry): void {
  const output = {
    ...entry,
    error: entry.error
      ? {
          name: entry.error.name,
          message: entry.error.message,
          stack: entry.error.stack,
        }
      : undefined,
  }
  // eslint-disable-next-line no-console
  console.log(JSON.stringify(output))
}

/**
 * Core logging function
 */
function log(
  level: LogLevel,
  context: string | undefined,
  message: string,
  data?: Record<string, unknown>,
  error?: Error
): void {
  if (!shouldLog(level)) return

  const entry: LogEntry = {
    level,
    message,
    context,
    timestamp: getTimestamp(),
    data,
    error,
  }

  // Custom handler takes priority
  if (globalConfig.customHandler) {
    globalConfig.customHandler(entry)
  }

  // Console output
  if (globalConfig.enableConsole) {
    if (globalConfig.enableStructured) {
      structuredOutput(entry)
    } else {
      consoleOutput(entry)
    }
  }
}

/**
 * Create a logger instance with a specific context (module/service name)
 *
 * @example
 * const logger = createLogger('VocabularyService')
 * logger.info('Book created', { bookId: '123', userId: 'abc' })
 * logger.error('Failed to create book', { bookId: '123' }, error)
 */
export function createLogger(context: string) {
  return {
    /**
     * Debug level - Detailed information for debugging
     * Only shown in development mode by default
     */
    debug(message: string, data?: Record<string, unknown>): void {
      log("debug", context, message, data)
    },

    /**
     * Info level - General operational information
     * Normal application behavior, state changes, successful operations
     */
    info(message: string, data?: Record<string, unknown>): void {
      log("info", context, message, data)
    },

    /**
     * Warn level - Warning conditions
     * Something unexpected but recoverable, degraded functionality
     */
    warn(message: string, data?: Record<string, unknown>, error?: Error): void {
      log("warn", context, message, data, error)
    },

    /**
     * Error level - Error conditions
     * Something failed, requires attention
     */
    error(message: string, data?: Record<string, unknown>, error?: Error): void {
      log("error", context, message, data, error)
    },

    /**
     * Log with explicit level
     */
    log(level: LogLevel, message: string, data?: Record<string, unknown>, error?: Error): void {
      log(level, context, message, data, error)
    },
  }
}

/**
 * Default logger instance (no context)
 * Use createLogger() for context-aware logging
 */
export const logger = {
  debug(message: string, data?: Record<string, unknown>): void {
    log("debug", undefined, message, data)
  },
  info(message: string, data?: Record<string, unknown>): void {
    log("info", undefined, message, data)
  },
  warn(message: string, data?: Record<string, unknown>, error?: Error): void {
    log("warn", undefined, message, data, error)
  },
  error(message: string, data?: Record<string, unknown>, error?: Error): void {
    log("error", undefined, message, data, error)
  },
}

/**
 * Performance timing utility
 *
 * @example
 * const timer = startTimer('VocabularyService', 'fetchBooks')
 * const books = await fetchBooks()
 * timer.end({ bookCount: books.length })
 */
export function startTimer(context: string, operation: string) {
  const startTime = performance.now()
  const contextLogger = createLogger(context)

  return {
    /**
     * End the timer and log the duration
     */
    end(data?: Record<string, unknown>): number {
      const duration = Math.round(performance.now() - startTime)
      contextLogger.debug(`${operation} completed`, {
        ...data,
        durationMs: duration,
      })
      return duration
    },

    /**
     * End the timer with error logging
     */
    endWithError(error: Error, data?: Record<string, unknown>): number {
      const duration = Math.round(performance.now() - startTime)
      contextLogger.error(`${operation} failed`, { ...data, durationMs: duration }, error)
      return duration
    },
  }
}

/**
 * Log group utility for related operations
 *
 * @example
 * const group = logGroup('ImportService', 'Batch import')
 * group.info('Starting import', { wordCount: 100 })
 * // ... operations ...
 * group.end()
 */
export function logGroup(context: string, groupName: string) {
  const contextLogger = createLogger(context)

  if (globalConfig.enableConsole && !globalConfig.enableStructured) {
    // eslint-disable-next-line no-console
    console.group(`[${context}] ${groupName}`)
  }

  return {
    debug: contextLogger.debug,
    info: contextLogger.info,
    warn: contextLogger.warn,
    error: contextLogger.error,
    end(): void {
      if (globalConfig.enableConsole && !globalConfig.enableStructured) {
        // eslint-disable-next-line no-console
        console.groupEnd()
      }
    },
  }
}

// Export types for external use
export type Logger = ReturnType<typeof createLogger>
export type Timer = ReturnType<typeof startTimer>
export type LogGroup = ReturnType<typeof logGroup>
