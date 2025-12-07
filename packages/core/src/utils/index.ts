import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

// Logger exports
export {
  logger,
  createLogger,
  configureLogger,
  getLoggerConfig,
  startTimer,
  logGroup,
  type LogLevel,
  type LogEntry,
  type LoggerConfig,
  type Logger,
  type Timer,
  type LogGroup,
} from "./logger"

/**
 * Utility function to merge Tailwind CSS classes with clsx
 * Handles conditional classes and prevents class conflicts
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Format large numbers with commas (e.g., 1234 -> 1,234)
 */
export function formatNumber(num: number): string {
  return num.toLocaleString()
}

/**
 * Get greeting based on current time
 */
export function getGreeting(): string {
  const hour = new Date().getHours()
  if (hour < 12) return "morning"
  if (hour < 18) return "afternoon"
  return "evening"
}

