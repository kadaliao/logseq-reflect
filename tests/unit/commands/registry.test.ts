/**
 * Unit tests for CommandRegistry
 * T027: Write unit tests for command registry
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { CommandRegistry } from '../../../src/commands/registry'
import type { AICommand } from '../../../src/types'

describe('CommandRegistry', () => {
  let registry: CommandRegistry
  let mockCommand: AICommand
  let mockCustomCommand: AICommand

  beforeEach(() => {
    registry = new CommandRegistry()

    mockCommand = {
      id: 'ask-ai',
      title: 'Ask AI',
      description: 'Ask a question to AI',
      promptTemplate: 'Answer this question: {question}',
      requiresInput: true,
      requiresSelection: false,
      contextStrategy: 'none',
      isCustom: false,
      menuContext: ['palette', 'toolbar'],
    }

    mockCustomCommand = {
      id: 'custom-translate',
      title: 'Translate to English',
      description: 'Translate text to English',
      promptTemplate: 'Translate to English: {context}',
      requiresInput: false,
      requiresSelection: true,
      contextStrategy: 'selection',
      isCustom: true,
      menuContext: ['context-menu'],
    }
  })

  describe('register', () => {
    it('should register a new command', () => {
      // Act
      registry.register(mockCommand)

      // Assert
      expect(registry.has('ask-ai')).toBe(true)
      expect(registry.get('ask-ai')).toEqual(mockCommand)
      expect(registry.count).toBe(1)
    })

    it('should replace existing command with same ID', () => {
      // Arrange
      registry.register(mockCommand)

      const updatedCommand: AICommand = {
        ...mockCommand,
        title: 'Ask AI (Updated)',
      }

      // Act
      registry.register(updatedCommand)

      // Assert
      expect(registry.count).toBe(1)
      expect(registry.get('ask-ai')?.title).toBe('Ask AI (Updated)')
    })

    it('should register both built-in and custom commands', () => {
      // Act
      registry.register(mockCommand)
      registry.register(mockCustomCommand)

      // Assert
      expect(registry.count).toBe(2)
      expect(registry.has('ask-ai')).toBe(true)
      expect(registry.has('custom-translate')).toBe(true)
    })
  })

  describe('registerMany', () => {
    it('should register multiple commands at once', () => {
      // Arrange
      const commands = [mockCommand, mockCustomCommand]

      // Act
      registry.registerMany(commands)

      // Assert
      expect(registry.count).toBe(2)
      expect(registry.has('ask-ai')).toBe(true)
      expect(registry.has('custom-translate')).toBe(true)
    })

    it('should handle empty array', () => {
      // Act
      registry.registerMany([])

      // Assert
      expect(registry.count).toBe(0)
    })
  })

  describe('unregister', () => {
    it('should remove existing command', () => {
      // Arrange
      registry.register(mockCommand)

      // Act
      const result = registry.unregister('ask-ai')

      // Assert
      expect(result).toBe(true)
      expect(registry.has('ask-ai')).toBe(false)
      expect(registry.count).toBe(0)
    })

    it('should return false for non-existent command', () => {
      // Act
      const result = registry.unregister('non-existent')

      // Assert
      expect(result).toBe(false)
      expect(registry.count).toBe(0)
    })
  })

  describe('get', () => {
    it('should return command by ID', () => {
      // Arrange
      registry.register(mockCommand)

      // Act
      const command = registry.get('ask-ai')

      // Assert
      expect(command).toEqual(mockCommand)
    })

    it('should return undefined for non-existent command', () => {
      // Act
      const command = registry.get('non-existent')

      // Assert
      expect(command).toBeUndefined()
    })
  })

  describe('has', () => {
    it('should return true for existing command', () => {
      // Arrange
      registry.register(mockCommand)

      // Act & Assert
      expect(registry.has('ask-ai')).toBe(true)
    })

    it('should return false for non-existent command', () => {
      // Act & Assert
      expect(registry.has('non-existent')).toBe(false)
    })
  })

  describe('getAll', () => {
    it('should return all registered commands', () => {
      // Arrange
      registry.register(mockCommand)
      registry.register(mockCustomCommand)

      // Act
      const commands = registry.getAll()

      // Assert
      expect(commands).toHaveLength(2)
      expect(commands).toContainEqual(mockCommand)
      expect(commands).toContainEqual(mockCustomCommand)
    })

    it('should return empty array when no commands registered', () => {
      // Act
      const commands = registry.getAll()

      // Assert
      expect(commands).toEqual([])
    })
  })

  describe('getByMenuContext', () => {
    it('should return commands for specific menu context', () => {
      // Arrange
      registry.register(mockCommand) // palette, toolbar
      registry.register(mockCustomCommand) // context-menu

      // Act
      const paletteCommands = registry.getByMenuContext('palette')
      const contextMenuCommands = registry.getByMenuContext('context-menu')

      // Assert
      expect(paletteCommands).toHaveLength(1)
      expect(paletteCommands[0].id).toBe('ask-ai')

      expect(contextMenuCommands).toHaveLength(1)
      expect(contextMenuCommands[0].id).toBe('custom-translate')
    })

    it('should return empty array for context with no commands', () => {
      // Arrange
      registry.register(mockCommand)

      // Act
      const slashCommands = registry.getByMenuContext('slash')

      // Assert
      expect(slashCommands).toEqual([])
    })

    it('should return commands that appear in multiple contexts', () => {
      // Arrange
      registry.register(mockCommand) // palette, toolbar

      // Act
      const paletteCommands = registry.getByMenuContext('palette')
      const toolbarCommands = registry.getByMenuContext('toolbar')

      // Assert
      expect(paletteCommands).toHaveLength(1)
      expect(toolbarCommands).toHaveLength(1)
      expect(paletteCommands[0]).toEqual(toolbarCommands[0])
    })
  })

  describe('getBuiltIn', () => {
    it('should return only built-in commands', () => {
      // Arrange
      registry.register(mockCommand)
      registry.register(mockCustomCommand)

      // Act
      const builtIn = registry.getBuiltIn()

      // Assert
      expect(builtIn).toHaveLength(1)
      expect(builtIn[0].id).toBe('ask-ai')
      expect(builtIn[0].isCustom).toBe(false)
    })

    it('should return empty array when no built-in commands', () => {
      // Arrange
      registry.register(mockCustomCommand)

      // Act
      const builtIn = registry.getBuiltIn()

      // Assert
      expect(builtIn).toEqual([])
    })
  })

  describe('getCustom', () => {
    it('should return only custom commands', () => {
      // Arrange
      registry.register(mockCommand)
      registry.register(mockCustomCommand)

      // Act
      const custom = registry.getCustom()

      // Assert
      expect(custom).toHaveLength(1)
      expect(custom[0].id).toBe('custom-translate')
      expect(custom[0].isCustom).toBe(true)
    })

    it('should return empty array when no custom commands', () => {
      // Arrange
      registry.register(mockCommand)

      // Act
      const custom = registry.getCustom()

      // Assert
      expect(custom).toEqual([])
    })
  })

  describe('clear', () => {
    it('should remove all commands', () => {
      // Arrange
      registry.register(mockCommand)
      registry.register(mockCustomCommand)

      // Act
      registry.clear()

      // Assert
      expect(registry.count).toBe(0)
      expect(registry.getAll()).toEqual([])
    })

    it('should work when registry is already empty', () => {
      // Act
      registry.clear()

      // Assert
      expect(registry.count).toBe(0)
    })
  })

  describe('clearCustom', () => {
    it('should remove only custom commands', () => {
      // Arrange
      registry.register(mockCommand)
      registry.register(mockCustomCommand)

      // Act
      registry.clearCustom()

      // Assert
      expect(registry.count).toBe(1)
      expect(registry.has('ask-ai')).toBe(true)
      expect(registry.has('custom-translate')).toBe(false)
    })

    it('should preserve built-in commands when no custom commands exist', () => {
      // Arrange
      registry.register(mockCommand)

      // Act
      registry.clearCustom()

      // Assert
      expect(registry.count).toBe(1)
      expect(registry.has('ask-ai')).toBe(true)
    })
  })

  describe('count', () => {
    it('should return correct count', () => {
      // Arrange & Act
      expect(registry.count).toBe(0)

      registry.register(mockCommand)
      expect(registry.count).toBe(1)

      registry.register(mockCustomCommand)
      expect(registry.count).toBe(2)

      registry.unregister('ask-ai')
      expect(registry.count).toBe(1)

      registry.clear()
      expect(registry.count).toBe(0)
    })
  })
})
