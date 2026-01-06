/**
 * Command registry for AI commands
 * T026: Implement command registry core
 */

import type { AICommand } from '../types'
import { createLogger } from '../utils/logger'

const logger = createLogger('CommandRegistry')

/**
 * Central registry for all AI commands
 * Manages both built-in and custom commands
 */
export class CommandRegistry {
  private commands: Map<string, AICommand> = new Map()

  /**
   * Register a new AI command
   * Replaces existing command with same ID
   */
  register(command: AICommand): void {
    logger.debug('Registering command', {
      id: command.id,
      title: command.title,
      isCustom: command.isCustom,
    })

    this.commands.set(command.id, command)
  }

  /**
   * Register multiple commands at once
   */
  registerMany(commands: AICommand[]): void {
    for (const command of commands) {
      this.register(command)
    }
  }

  /**
   * Unregister a command by ID
   * Returns true if command was found and removed
   */
  unregister(commandId: string): boolean {
    const existed = this.commands.has(commandId)

    if (existed) {
      logger.debug('Unregistering command', { id: commandId })
      this.commands.delete(commandId)
    } else {
      logger.warn('Attempted to unregister non-existent command', { id: commandId })
    }

    return existed
  }

  /**
   * Get command by ID
   * Returns undefined if not found
   */
  get(commandId: string): AICommand | undefined {
    return this.commands.get(commandId)
  }

  /**
   * Check if command exists
   */
  has(commandId: string): boolean {
    return this.commands.has(commandId)
  }

  /**
   * Get all registered commands
   */
  getAll(): AICommand[] {
    return Array.from(this.commands.values())
  }

  /**
   * Get commands by menu context
   * Returns commands that should appear in the specified context
   */
  getByMenuContext(context: AICommand['menuContext'][number]): AICommand[] {
    return this.getAll().filter((cmd) => cmd.menuContext.includes(context))
  }

  /**
   * Get all built-in commands
   */
  getBuiltIn(): AICommand[] {
    return this.getAll().filter((cmd) => !cmd.isCustom)
  }

  /**
   * Get all custom commands
   */
  getCustom(): AICommand[] {
    return this.getAll().filter((cmd) => cmd.isCustom)
  }

  /**
   * Clear all commands
   * Useful for testing or plugin reload
   */
  clear(): void {
    logger.debug('Clearing all commands', {
      count: this.commands.size,
    })
    this.commands.clear()
  }

  /**
   * Remove all custom commands
   * Preserves built-in commands
   */
  clearCustom(): void {
    const customIds = this.getCustom().map((cmd) => cmd.id)

    logger.debug('Clearing custom commands', {
      count: customIds.length,
    })

    for (const id of customIds) {
      this.commands.delete(id)
    }
  }

  /**
   * Get total number of registered commands
   */
  get count(): number {
    return this.commands.size
  }
}

/**
 * Global command registry instance
 * Singleton pattern for easy access across the plugin
 */
export const globalRegistry = new CommandRegistry()
