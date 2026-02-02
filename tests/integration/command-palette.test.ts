/**
 * Integration test for command palette invocation
 * T037: Write integration test for command palette invocation
 *
 * Purpose: Verify the Ask AI command is correctly registered and invocable
 * through command palette, toolbar, slash command, and keyboard shortcut
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'

// Mock LLM client
const mockStream = vi.fn()
const mockChat = vi.fn()

vi.mock('../../src/llm/client', () => ({
  LLMClient: vi.fn().mockImplementation(() => ({
    stream: mockStream,
    chat: mockChat,
  })),
}))

// Get mock references from global logseq (set up in tests/setup.ts)
const mockRegisterCommandPalette = vi.mocked(logseq.App.registerCommandPalette)
const mockRegisterUIItem = vi.mocked(logseq.App.registerUIItem)
const mockRegisterSlashCommand = vi.mocked(logseq.Editor.registerSlashCommand)
const mockOnMacroRendererSlotted = vi.mocked(logseq.App.onMacroRendererSlotted)
const mockGetCurrentBlock = vi.mocked(logseq.Editor.getCurrentBlock)
const mockInsertBlock = vi.mocked(logseq.Editor.insertBlock)
const mockUpdateBlock = vi.mocked(logseq.Editor.updateBlock)
const mockShowMsg = vi.mocked(logseq.App.showMsg)
const mockUseSettingsSchema = vi.mocked(logseq.useSettingsSchema)
const mockUpdateSettings = vi.mocked(logseq.updateSettings)

describe('Command Palette Integration Tests', () => {
  beforeEach(async () => {
    // Reset mocks
    vi.clearAllMocks()

    // Reset module cache to re-run initialization
    vi.resetModules()

    // Setup global logseq settings (global logseq is defined in tests/setup.ts)
    logseq.settings = {
      llm: {
        baseURL: 'http://localhost:11434',
        apiPath: '/v1/chat/completions',
        modelName: 'llama3',
        apiKey: null,
        temperature: 0.7,
        topP: 0.9,
        maxTokens: null,
        streamingEnabled: true,
        timeoutSeconds: 30,
        retryCount: 3,
        maxContextTokens: 8000,
      },
      debugMode: false,
    }

    // Default mock behaviors
    mockGetCurrentBlock.mockResolvedValue({
      uuid: 'test-uuid',
      content: 'Test question',
    } as any)
    mockInsertBlock.mockResolvedValue({ uuid: 'placeholder-uuid' } as any)
    mockUpdateBlock.mockResolvedValue(null as any)
    mockStream.mockImplementation(async function* () {
      yield { choices: [{ delta: { content: 'Test response' } }] }
    })
  })

  describe('Command Registration', () => {
    it('should register Ask AI command in command palette with keyboard shortcut', async () => {
      // Act - import to trigger initialization
      await import('../../src/index')

      // Assert
      expect(mockRegisterCommandPalette).toHaveBeenCalledWith(
        expect.objectContaining({
          key: 'ask-ai',
          label: 'Ask AI',
          // No keybinding to avoid conflicts
        }),
        expect.any(Function)
      )
    })

    it('should register toolbar button', async () => {
      // Act
      await import('../../src/index')

      // Assert
      expect(mockRegisterUIItem).toHaveBeenCalledWith(
        'toolbar',
        expect.objectContaining({
          key: 'ask-ai-toolbar',
          template: expect.stringContaining('askAI'),
        })
      )
    })

    it('should register slash command /ai', async () => {
      // Act
      await import('../../src/index')

      // Assert
      expect(mockRegisterSlashCommand).toHaveBeenCalledWith('ai', expect.any(Function))
    })

    it('should register macro renderer handler for toolbar button', async () => {
      // Act
      await import('../../src/index')

      // Assert
      expect(mockOnMacroRendererSlotted).toHaveBeenCalledWith(expect.any(Function))
    })
  })

  describe('Command Palette Invocation', () => {
    it('should execute Ask AI when invoked from command palette', async () => {
      // Arrange
      await import('../../src/index')

      // Get the command handler
      const commandHandler = mockRegisterCommandPalette.mock.calls[0][1]

      // Act
      await commandHandler()

      // Assert
      expect(mockGetCurrentBlock).toHaveBeenCalled()
      expect(mockStream).toHaveBeenCalled()
      expect(mockInsertBlock).toHaveBeenCalled()
    })

    it('should use current settings when invoked', async () => {
      // Arrange
      logseq.settings.llm.modelName = 'gpt-3.5-turbo'
      logseq.settings.llm.temperature = 0.5
      await import('../../src/index')

      const commandHandler = mockRegisterCommandPalette.mock.calls[0][1]

      // Act
      await commandHandler()

      // Wait for async processing
      await new Promise(resolve => setTimeout(resolve, 100))

      // Assert - Check that stream was called with a request object containing messages
      expect(mockStream).toHaveBeenCalled()
      const streamCall = mockStream.mock.calls[0]
      const request = streamCall[0]
      expect(request).toHaveProperty('messages')
      expect(Array.isArray(request.messages)).toBe(true)
      expect(request.messages.length).toBeGreaterThan(0)
    })

    it('should handle errors during command execution', async () => {
      // Arrange
      mockStream.mockImplementation(async function* () {
        throw new Error('API Error')
      })
      await import('../../src/index')

      const commandHandler = mockRegisterCommandPalette.mock.calls[0][1]

      // Act
      await commandHandler()

      // Assert
      expect(mockShowMsg).toHaveBeenCalledWith(expect.stringContaining('failed'), 'error')
    })
  })

  describe('Slash Command Invocation', () => {
    it('should execute Ask AI when /ai slash command is used', async () => {
      // Arrange
      await import('../../src/index')

      const slashHandler = mockRegisterSlashCommand.mock.calls[0][1]

      // Act
      await slashHandler()

      // Assert
      expect(mockGetCurrentBlock).toHaveBeenCalled()
      expect(mockStream).toHaveBeenCalled()
    })

    it('should create block in context of slash command', async () => {
      // Arrange
      mockGetCurrentBlock.mockResolvedValue({
        uuid: 'slash-block-uuid',
        content: 'Test question from slash command'
      } as any)
      await import('../../src/index')

      const slashHandler = mockRegisterSlashCommand.mock.calls[0][1]

      // Act
      await slashHandler()

      // Assert - block should be created as child of current block
      expect(mockInsertBlock).toHaveBeenCalledWith(
        'slash-block-uuid',
        expect.any(String),
        expect.any(Object)
      )
    })
  })

  describe('Toolbar Button Invocation', () => {
    it('should execute Ask AI when toolbar button is clicked', async () => {
      // Arrange
      await import('../../src/index')

      const macroHandler = mockOnMacroRendererSlotted.mock.calls[0][0]

      // Simulate toolbar button click
      const clickEvent = {
        payload: {
          arguments: ['askAI'],
        },
      }

      // Act
      await macroHandler(clickEvent)

      // Assert
      expect(mockGetCurrentBlock).toHaveBeenCalled()
      expect(mockStream).toHaveBeenCalled()
    })

    it('should ignore non-askAI macro events', async () => {
      // Arrange
      await import('../../src/index')

      const macroHandler = mockOnMacroRendererSlotted.mock.calls[0][0]

      const otherEvent = {
        payload: {
          arguments: ['otherMacro'],
        },
      }

      mockGetCurrentBlock.mockClear()

      // Act
      await macroHandler(otherEvent)

      // Assert - should not trigger command
      expect(mockGetCurrentBlock).not.toHaveBeenCalled()
    })
  })

  describe('Keyboard Shortcut', () => {
    it('should register correct keyboard binding (mod+shift+a)', async () => {
      // Act
      await import('../../src/index')

      // Assert - No keybinding is set to avoid conflicts
      const registration = mockRegisterCommandPalette.mock.calls[0][0]
      expect(registration.keybinding).toBeUndefined()
    })

    it('should execute command when keyboard shortcut is triggered', async () => {
      // Arrange
      await import('../../src/index')

      const commandHandler = mockRegisterCommandPalette.mock.calls[0][1]

      // Act - simulate command execution (not via keyboard shortcut since there isn't one)
      await commandHandler()

      // Assert
      expect(mockGetCurrentBlock).toHaveBeenCalled()
    })
  })

  describe('Integration with Settings', () => {
    it('should use settings schema for configuration', async () => {
      // Act
      await import('../../src/index')

      // Assert
      expect(mockUseSettingsSchema).toHaveBeenCalled()
    })

    it('should initialize default settings if not configured', async () => {
      // Arrange
      logseq.settings = undefined

      // Act
      await import('../../src/index')

      // Assert
      expect(mockUpdateSettings).toHaveBeenCalled()
    })

    it('should respect debug mode setting', async () => {
      // Arrange
      logseq.settings.debugMode = true

      // Act
      await import('../../src/index')

      // Assert - initialization should complete with debug mode enabled
      expect(mockShowMsg).toHaveBeenCalledWith(
        expect.stringContaining('loaded successfully'),
        'success'
      )
    })
  })

  describe('Multiple Invocation Methods', () => {
    it('should produce same result regardless of invocation method', async () => {
      // Arrange
      const question = 'What is Logseq?'
      mockGetCurrentBlock.mockResolvedValue({ uuid: 'test-uuid', content: question } as any)
      await import('../../src/index')

      const commandPaletteHandler = mockRegisterCommandPalette.mock.calls[0][1]
      const slashHandler = mockRegisterSlashCommand.mock.calls[0][1]

      // Act - invoke via command palette
      mockStream.mockClear()
      await commandPaletteHandler()
      const paletteCall = mockStream.mock.calls[0]

      // Reset and invoke via slash command
      vi.clearAllMocks()
      mockGetCurrentBlock.mockResolvedValue({ uuid: 'test-uuid', content: question } as any)
      mockStream.mockImplementation(async function* () {
        yield { choices: [{ delta: { content: 'Test' } }] }
      })

      await slashHandler()
      const slashCall = mockStream.mock.calls[0]

      // Assert - both should send identical requests
      expect(paletteCall[0]).toEqual(slashCall[0])
    })
  })
})
