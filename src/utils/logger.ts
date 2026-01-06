/**
 * Logger utility with debug mode support
 * T016: Create Logger utility with debug mode support
 */

export type LogLevel = 'ERROR' | 'WARN' | 'INFO' | 'DEBUG'

export interface LogMetadata {
  [key: string]: unknown
}

/**
 * Structured logger for Logseq AI Plugin
 * Supports debug mode toggle and structured logging
 */
export class Logger {
  private context: string
  private debugMode: boolean

  constructor(context: string, debugMode = false) {
    this.context = context
    this.debugMode = debugMode
  }

  /**
   * Enable or disable debug mode
   */
  setDebugMode(enabled: boolean): void {
    this.debugMode = enabled
  }

  /**
   * Log error with optional error object and metadata
   */
  error(message: string, error?: Error, metadata?: LogMetadata): void {
    const logEntry = this.formatLog('ERROR', message, { error, ...metadata })
    console.error(logEntry)
  }

  /**
   * Log warning with optional metadata
   */
  warn(message: string, metadata?: LogMetadata): void {
    const logEntry = this.formatLog('WARN', message, metadata)
    console.warn(logEntry)
  }

  /**
   * Log info with optional metadata
   */
  info(message: string, metadata?: LogMetadata): void {
    const logEntry = this.formatLog('INFO', message, metadata)
    console.log(logEntry)
  }

  /**
   * Log debug information (only if debug mode enabled)
   */
  debug(message: string, metadata?: LogMetadata): void {
    if (this.debugMode) {
      const logEntry = this.formatLog('DEBUG', message, metadata)
      console.debug(logEntry)
    }
  }

  /**
   * Format log entry with timestamp, level, context, and metadata
   */
  private formatLog(level: LogLevel, message: string, metadata?: LogMetadata): string {
    const timestamp = new Date().toISOString()
    const baseLog = `[${timestamp}] [${level}] [${this.context}] ${message}`

    if (metadata && Object.keys(metadata).length > 0) {
      return `${baseLog} ${JSON.stringify(metadata)}`
    }

    return baseLog
  }
}

/**
 * Create a logger instance for a specific context
 */
export function createLogger(context: string, debugMode = false): Logger {
  return new Logger(context, debugMode)
}
