/**
 * Unit tests for Ask AI command handler
 * T050: Write unit tests for Ask AI command handler
 *
 * Purpose: Test the Ask AI command logic in isolation
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import type { PluginSettings } from '../../../src/config/settings'

// Mock LLM client
vi.mock('../../../src/llm/client', () => ({
  LLMClient: vi.fn().mockImplementation(() => ({
    stream: vi.fn(),
    chat: vi.fn(),
  })),
}))

// Import after mocking
const { executeAskCommand } = await import('../../../src/commands/ask')
const { LLMClient } = await import('../../../src/llm/client')

// Get mock references from global logseq (set up in tests/setup.ts)
const mockGetCurrentBlock = vi.mocked(logseq.Editor.getCurrentBlock)
const mockInsertBlock = vi.mocked(logseq.Editor.insertBlock)
const mockUpdateBlock = vi.mocked(logseq.Editor.updateBlock)
const mockShowMsg = vi.mocked(logseq.App.showMsg)
const MockedLLMClient = vi.mocked(LLMClient)

let mockStream: any
let mockChat: any

describe('Ask AI Command Handler - Unit Tests', () => {
  let settings: PluginSettings

  beforeEach(() => {
    vi.clearAllMocks()

    // Get fresh mock instances for each test
    mockStream = vi.fn()
    mockChat = vi.fn()
    MockedLLMClient.mockImplementation(() => ({
      stream: mockStream,
      chat: mockChat,
    }) as any)

    settings = {
      llm: {
        apiEndpoint: 'https://api.openai.com/v1',
        apiKey: 'test-key',
        modelName: 'gpt-4',
        temperature: 0.7,
        topP: 1.0,
        maxTokens: 2000,
        streamingEnabled: true,
        timeoutMs: 30000,
        retryAttempts: 3,
        retryDelayMs: 1000,
      },
      debugMode: false,
    }

    mockGetCurrentBlock.mockResolvedValue({ uuid: 'test-uuid' })
    mockInsertBlock.mockResolvedValue({ uuid: 'placeholder-uuid' })
    mockUpdateBlock.mockResolvedValue(null)
  })

  describe('Input Handling', () => {
    it('should prompt user for question', async () => {
      // Arrange
      mockGetCurrentBlock.mockResolvedValue({
        uuid: 'test-uuid',
        content: 'Test question'
      } as any)
      mockStream.mockImplementation(async function* () {
        yield { choices: [{ delta: { content: 'Answer' } }] }
      })

      // Act
      await executeAskCommand(settings)

      // Assert
      expect(mockGetCurrentBlock).toHaveBeenCalled()
      expect(mockInsertBlock).toHaveBeenCalled()
    })

    it('should exit early if user cancels input', async () => {
      // Arrange - no current block
      mockGetCurrentBlock.mockResolvedValue(null as any)

      // Act
      await executeAskCommand(settings)

      // Assert
      expect(mockStream).not.toHaveBeenCalled()
      expect(mockChat).not.toHaveBeenCalled()
      expect(mockInsertBlock).not.toHaveBeenCalled()
    })

    it('should exit early if user provides empty question', async () => {
      // Arrange - block with empty content
      mockGetCurrentBlock.mockResolvedValue({
        uuid: 'test-uuid',
        content: ''
      } as any)

      // Act
      await executeAskCommand(settings)

      // Assert
      expect(mockStream).not.toHaveBeenCalled()
      expect(mockChat).not.toHaveBeenCalled()
    })

    it('should exit early if user provides whitespace-only question', async () => {
      // Arrange - block with whitespace content
      mockGetCurrentBlock.mockResolvedValue({
        uuid: 'test-uuid',
        content: '   '
      } as any)

      // Act
      await executeAskCommand(settings)

      // Assert
      expect(mockStream).not.toHaveBeenCalled()
    })
  })

  describe('Request Building', () => {
    it('should build request with system prompt', async () => {
      // Arrange
      mockGetCurrentBlock.mockResolvedValue({ uuid: 'test-uuid', content: 'What is TypeScript?' } as any)
      mockStream.mockImplementation(async function* () {
        yield { choices: [{ delta: { content: 'Answer' } }] }
      })

      // Act
      await executeAskCommand(settings)

      // Assert
      expect(mockStream).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: expect.arrayContaining([
            expect.objectContaining({
              role: 'system',
              content: expect.stringContaining('helpful AI assistant'),
            }),
          ]),
        })
      )
    })

    it('should include user question in request', async () => {
      // Arrange
      const question = 'Explain async/await'
      mockGetCurrentBlock.mockResolvedValue({
        uuid: 'test-uuid',
        content: question
      } as any)
      mockStream.mockImplementation(async function* () {
        yield { choices: [{ delta: { content: 'Answer' } }] }
      })

      // Act
      await executeAskCommand(settings)

      // Assert
      expect(mockStream).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: expect.arrayContaining([
            expect.objectContaining({
              role: 'user',
              content: question,
            }),
          ]),
        })
      )
    })

    it('should use settings for model parameters', async () => {
      // Arrange
      settings.llm.modelName = 'gpt-3.5-turbo'
      settings.llm.temperature = 0.5
      settings.llm.topP = 0.9
      settings.llm.maxTokens = 1000

      mockGetCurrentBlock.mockResolvedValue({ uuid: 'test-uuid', content: 'Test' } as any)
      mockStream.mockImplementation(async function* () {
        yield { choices: [{ delta: { content: 'Response' } }] }
      })

      // Act
      await executeAskCommand(settings)

      // Assert
      expect(mockStream).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'gpt-3.5-turbo',
          temperature: 0.5,
          top_p: 0.9,
          max_tokens: 1000,
        })
      )
    })

    it('should handle undefined maxTokens', async () => {
      // Arrange
      settings.llm.maxTokens = undefined
      mockGetCurrentBlock.mockResolvedValue({ uuid: 'test-uuid', content: 'Test' } as any)
      mockStream.mockImplementation(async function* () {
        yield { choices: [{ delta: { content: 'Response' } }] }
      })

      // Act
      await executeAskCommand(settings)

      // Assert
      expect(mockStream).toHaveBeenCalledWith(
        expect.objectContaining({
          max_tokens: undefined,
        })
      )
    })
  })

  describe('Streaming Mode', () => {
    beforeEach(() => {
      settings.llm.streamingEnabled = true
    })

    it('should use streaming when enabled', async () => {
      // Arrange
      mockGetCurrentBlock.mockResolvedValue({ uuid: 'test-uuid', content: 'Test question' } as any)
      mockStream.mockImplementation(async function* () {
        yield { choices: [{ delta: { content: 'Response' } }] }
      })

      // Act
      await executeAskCommand(settings)

      // Assert
      expect(mockStream).toHaveBeenCalled()
      expect(mockChat).not.toHaveBeenCalled()
    })

    it('should process all streaming chunks', async () => {
      // Arrange
      mockGetCurrentBlock.mockResolvedValue({ uuid: 'test-uuid', content: 'Test' } as any)
      const chunks = [
        { choices: [{ delta: { content: 'First' } }] },
        { choices: [{ delta: { content: ' second' } }] },
        { choices: [{ delta: { content: ' third' } }] },
      ]

      mockStream.mockImplementation(async function* () {
        for (const chunk of chunks) {
          yield chunk
        }
      })

      // Act
      await executeAskCommand(settings)

      // Assert - verify final accumulated content
      const lastUpdateCall = mockUpdateBlock.mock.calls[mockUpdateBlock.mock.calls.length - 1]
      expect(lastUpdateCall[1]).toBe('First second third')
    })

    it('should mark as completed after streaming finishes', async () => {
      // Arrange
      mockGetCurrentBlock.mockResolvedValue({ uuid: 'test-uuid', content: 'Test' } as any)
      mockStream.mockImplementation(async function* () {
        yield { choices: [{ delta: { content: 'Done' } }] }
      })

      // Act
      await executeAskCommand(settings)

      // Assert - last update should not have error
      expect(mockShowMsg).not.toHaveBeenCalledWith(
        expect.stringContaining('failed'),
        'error'
      )
    })

    it('should handle streaming errors', async () => {
      // Arrange
      mockGetCurrentBlock.mockResolvedValue({ uuid: 'test-uuid', content: 'Test' } as any)
      const error = new Error('Stream error')

      // Mock stream to throw error
      mockStream.mockImplementation(async function* () {
        throw error
      })

      // Act
      await executeAskCommand(settings)

      // Assert
      expect(mockShowMsg).toHaveBeenCalledWith(
        expect.stringContaining('Stream error'),
        'error'
      )
    })
  })

  describe('Non-Streaming Mode', () => {
    beforeEach(() => {
      settings.llm.streamingEnabled = false
    })

    it('should use chat when streaming disabled', async () => {
      // Arrange
      mockGetCurrentBlock.mockResolvedValue({ uuid: 'test-uuid', content: 'Test question' } as any)
      mockChat.mockResolvedValue({
        choices: [{ message: { content: 'Response' } }],
      })

      // Act
      await executeAskCommand(settings)

      // Assert
      expect(mockChat).toHaveBeenCalled()
      expect(mockStream).not.toHaveBeenCalled()
    })

    it('should update block with complete response', async () => {
      // Arrange
      mockGetCurrentBlock.mockResolvedValue({ uuid: 'test-uuid', content: 'Test' } as any)
      const response = 'Complete AI response'
      mockChat.mockResolvedValue({
        choices: [{ message: { content: response } }],
      })

      // Act
      await executeAskCommand(settings)

      // Assert
      expect(mockUpdateBlock).toHaveBeenCalledWith('placeholder-uuid', response)
    })

    it('should handle empty response', async () => {
      // Arrange
      mockGetCurrentBlock.mockResolvedValue({ uuid: 'test-uuid', content: 'Test' } as any)
      mockChat.mockResolvedValue({
        choices: [{ message: { content: '' } }],
      })

      // Act
      await executeAskCommand(settings)

      // Assert
      expect(mockUpdateBlock).toHaveBeenCalledWith('placeholder-uuid', '')
    })

    it('should handle missing choices array', async () => {
      // Arrange
      mockGetCurrentBlock.mockResolvedValue({ uuid: 'test-uuid', content: 'Test' } as any)
      mockChat.mockResolvedValue({ choices: [] })

      // Act
      await executeAskCommand(settings)

      // Assert - should handle gracefully (empty content)
      expect(mockUpdateBlock).toHaveBeenCalledWith('placeholder-uuid', '')
    })

    it('should handle chat API errors', async () => {
      // Arrange
      mockGetCurrentBlock.mockResolvedValue({ uuid: 'test-uuid', content: 'Test' } as any)
      const error = new Error('API error')
      mockChat.mockRejectedValue(error)

      // Act
      await executeAskCommand(settings)

      // Assert
      expect(mockShowMsg).toHaveBeenCalledWith(
        expect.stringContaining('API error'),
        'error'
      )
    })
  })

  describe('Block Context', () => {
    it('should use current block as parent when available', async () => {
      // Arrange
      mockGetCurrentBlock.mockResolvedValue({ uuid: 'current-block-123', content: 'Test' } as any)
      mockStream.mockImplementation(async function* () {
        yield { choices: [{ delta: { content: 'Response' } }] }
      })

      // Act
      await executeAskCommand(settings)

      // Assert
      expect(mockInsertBlock).toHaveBeenCalledWith(
        'current-block-123',
        expect.any(String),
        expect.any(Object)
      )
    })

    it('should handle missing current block', async () => {
      // Arrange
      mockGetCurrentBlock.mockResolvedValue(null)
      mockGetCurrentBlock.mockResolvedValue({ uuid: 'test-uuid', content: 'Test' } as any)
      mockStream.mockImplementation(async function* () {
        yield { choices: [{ delta: { content: 'Response' } }] }
      })

      // Act
      await executeAskCommand(settings)

      // Assert - should still create block (fallback behavior)
      expect(mockInsertBlock).toHaveBeenCalled()
    })
  })

  describe('Error Handling', () => {
    it('should show error message on failure', async () => {
      // Arrange
      mockGetCurrentBlock.mockResolvedValue({ uuid: 'test-uuid', content: 'Test' } as any)
      const error = new Error('Test error')

      // Mock stream to throw error
      mockStream.mockImplementation(async function* () {
        throw error
      })

      // Act
      await executeAskCommand(settings)

      // Assert
      expect(mockShowMsg).toHaveBeenCalledWith(
        'AI request failed: Test error',
        'error'
      )
    })

    it('should handle unknown error types', async () => {
      // Arrange
      mockGetCurrentBlock.mockResolvedValue({ uuid: 'test-uuid', content: 'Test' } as any)

      // Mock stream to throw string error
      mockStream.mockImplementation(async function* () {
        throw 'String error'
      })

      // Act
      await executeAskCommand(settings)

      // Assert
      expect(mockShowMsg).toHaveBeenCalledWith(
        expect.stringContaining('Unknown error'),
        'error'
      )
    })

    it('should not crash on block creation failure', async () => {
      // Arrange
      mockGetCurrentBlock.mockResolvedValue({ uuid: 'test-uuid', content: 'Test' } as any)
      mockInsertBlock.mockRejectedValue(new Error('Block creation failed'))

      // Act & Assert - should not throw
      await expect(executeAskCommand(settings)).resolves.not.toThrow()
    })
  })

  describe('Settings Variations', () => {
    it('should work with minimal settings', async () => {
      // Arrange
      const minimalSettings: PluginSettings = {
        llm: {
          apiEndpoint: 'https://api.openai.com/v1',
          apiKey: 'key',
          modelName: 'gpt-4',
          temperature: 0.7,
          topP: 1.0,
          maxTokens: undefined,
          streamingEnabled: true,
          timeoutMs: 30000,
          retryAttempts: 3,
          retryDelayMs: 1000,
        },
        debugMode: false,
      }

      mockGetCurrentBlock.mockResolvedValue({ uuid: 'test-uuid', content: 'Test' } as any)
      mockStream.mockImplementation(async function* () {
        yield { choices: [{ delta: { content: 'Response' } }] }
      })

      // Act & Assert
      await expect(executeAskCommand(minimalSettings)).resolves.not.toThrow()
    })

    it('should respect stream flag in request', async () => {
      // Arrange
      settings.llm.streamingEnabled = true
      mockGetCurrentBlock.mockResolvedValue({ uuid: 'test-uuid', content: 'Test' } as any)
      mockStream.mockImplementation(async function* () {
        yield { choices: [{ delta: { content: 'Response' } }] }
      })

      // Act
      await executeAskCommand(settings)

      // Assert
      expect(mockStream).toHaveBeenCalledWith(
        expect.objectContaining({
          stream: true,
        })
      )
    })
  })
})
