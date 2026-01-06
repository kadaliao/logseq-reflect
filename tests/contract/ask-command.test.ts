/**
 * Contract test for Ask AI command execution
 * T036: Write contract test for Ask AI command execution
 *
 * Purpose: Verify the Ask AI command correctly interacts with the LLM API
 * and handles responses according to the contract
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import type { PluginSettings } from '../../src/config/settings'

// Mock LLM client
vi.mock('../../src/llm/client', () => ({
  LLMClient: vi.fn().mockImplementation(() => ({
    stream: vi.fn(),
    chat: vi.fn(),
  })),
}))

// Import after mocking
const { executeAskCommand } = await import('../../src/commands/ask')
const { LLMClient } = await import('../../src/llm/client')

// Get mock references from global logseq (set up in tests/setup.ts)
const mockGetCurrentBlock = vi.mocked(logseq.Editor.getCurrentBlock)
const mockInsertBlock = vi.mocked(logseq.Editor.insertBlock)
const mockUpdateBlock = vi.mocked(logseq.Editor.updateBlock)
const mockShowMsg = vi.mocked(logseq.App.showMsg)
const mockGetCurrentPage = vi.mocked(logseq.Editor.getCurrentPage)
const mockAppendBlockInPage = vi.mocked(logseq.Editor.appendBlockInPage)
const MockedLLMClient = vi.mocked(LLMClient)

let mockStream: any
let mockChat: any

describe('Ask AI Command - Contract Tests', () => {
  let settings: PluginSettings

  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks()

    // Get fresh mock instances for each test
    mockStream = vi.fn()
    mockChat = vi.fn()
    MockedLLMClient.mockImplementation(() => ({
      stream: mockStream,
      chat: mockChat,
    }) as any)

    // Default settings
    settings = {
      llm: {
        apiEndpoint: 'https://api.openai.com/v1',
        apiKey: 'test-api-key',
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

    // Default mock behaviors
    mockGetCurrentBlock.mockResolvedValue({ uuid: 'test-parent-uuid' })
    mockInsertBlock.mockResolvedValue({ uuid: 'test-placeholder-uuid' })
    mockUpdateBlock.mockResolvedValue(null)
    mockGetCurrentPage.mockResolvedValue({ uuid: 'page-uuid', name: 'Test Page' } as any)
    mockAppendBlockInPage.mockResolvedValue({ uuid: 'test-block-uuid' } as any)
  })

  describe('Contract: Streaming Response', () => {
    it('should send correct request format to LLM API', async () => {
      // Arrange
      mockGetCurrentBlock.mockResolvedValue({ uuid: 'test-uuid', content: 'What is TypeScript?' } as any)
      mockStream.mockImplementation(async function* () {
        yield { choices: [{ delta: { content: 'TypeScript is' } }] }
        yield { choices: [{ delta: { content: ' a typed' } }] }
        yield { choices: [{ delta: { content: ' superset of JavaScript.' } }] }
      })

      // Act
      await executeAskCommand(settings)

      // Assert
      expect(mockStream).toHaveBeenCalledWith({
        model: 'gpt-4',
        messages: [
          {
            role: 'system',
            content: expect.stringContaining('helpful AI assistant'),
          },
          {
            role: 'user',
            content: 'What is TypeScript?',
          },
        ],
        temperature: 0.7,
        top_p: 1.0,
        max_tokens: 2000,
        stream: true,
      })
    })

    it('should accumulate streaming chunks correctly', async () => {
      // Arrange
      mockGetCurrentBlock.mockResolvedValue({ uuid: 'test-uuid', content: 'Test question' } as any)
      const chunks = [
        { choices: [{ delta: { content: 'First ' } }] },
        { choices: [{ delta: { content: 'second ' } }] },
        { choices: [{ delta: { content: 'third.' } }] },
      ]

      mockStream.mockImplementation(async function* () {
        for (const chunk of chunks) {
          yield chunk
        }
      })

      // Act
      await executeAskCommand(settings)

      // Assert - verify final accumulated content
      expect(mockUpdateBlock).toHaveBeenCalledWith(
        'test-placeholder-uuid',
        expect.stringContaining('First second third.')
      )
    })

    it('should handle empty chunks gracefully', async () => {
      // Arrange
      mockGetCurrentBlock.mockResolvedValue({ uuid: 'test-uuid', content: 'Test question' } as any)
      mockStream.mockImplementation(async function* () {
        yield { choices: [{ delta: { content: 'Content' } }] }
        yield { choices: [{ delta: {} }] } // Empty delta
        yield { choices: [{ delta: { content: '' } }] } // Empty content
        yield { choices: [{ delta: { content: ' more' } }] }
      })

      // Act
      await executeAskCommand(settings)

      // Assert - should only accumulate non-empty content
      expect(mockUpdateBlock).toHaveBeenCalledWith(
        'test-placeholder-uuid',
        expect.stringContaining('Content more')
      )
    })
  })

  describe('Contract: Non-Streaming Response', () => {
    beforeEach(() => {
      settings.llm.streamingEnabled = false
    })

    it('should send correct request format for non-streaming', async () => {
      // Arrange
      mockGetCurrentBlock.mockResolvedValue({ uuid: 'test-uuid', content: 'What is React?' } as any)
      mockChat.mockResolvedValue({
        choices: [{ message: { content: 'React is a JavaScript library.' } }],
      })

      // Act
      await executeAskCommand(settings)

      // Assert
      expect(mockChat).toHaveBeenCalledWith({
        model: 'gpt-4',
        messages: [
          {
            role: 'system',
            content: expect.stringContaining('helpful AI assistant'),
          },
          {
            role: 'user',
            content: 'What is React?',
          },
        ],
        temperature: 0.7,
        top_p: 1.0,
        max_tokens: 2000,
        stream: false,
      })
    })

    it('should update block with complete response', async () => {
      // Arrange
      mockGetCurrentBlock.mockResolvedValue({ uuid: 'test-uuid', content: 'Test question' } as any)
      const fullResponse = 'This is a complete response from the AI.'

      mockChat.mockResolvedValue({
        choices: [{ message: { content: fullResponse } }],
      })

      // Act
      await executeAskCommand(settings)

      // Assert
      expect(mockUpdateBlock).toHaveBeenCalledWith('test-placeholder-uuid', fullResponse)
    })

    it('should handle empty response content', async () => {
      // Arrange
      mockGetCurrentBlock.mockResolvedValue({ uuid: 'test-uuid', content: 'Test question' } as any)
      mockChat.mockResolvedValue({
        choices: [{ message: { content: '' } }],
      })

      // Act
      await executeAskCommand(settings)

      // Assert - should update with empty string
      expect(mockUpdateBlock).toHaveBeenCalledWith('test-placeholder-uuid', '')
    })
  })

  describe('Contract: Error Handling', () => {
    it('should handle LLM API errors gracefully', async () => {
      // Arrange
      mockGetCurrentBlock.mockResolvedValue({ uuid: 'test-uuid', content: 'Test question' } as any)
      const apiError = new Error('API request failed: 500 Internal Server Error')
      mockStream.mockRejectedValue(apiError)

      // Act
      await executeAskCommand(settings)

      // Assert
      expect(mockShowMsg).toHaveBeenCalledWith(
        expect.stringContaining('AI request failed'),
        'error'
      )
    })

    it('should handle network timeout errors', async () => {
      // Arrange
      mockGetCurrentBlock.mockResolvedValue({ uuid: 'test-uuid', content: 'Test question' } as any)
      const timeoutError = new Error('Request timeout after 30000ms')

      // Mock stream to throw timeout error
      mockStream.mockImplementation(async function* () {
        throw timeoutError
      })

      // Act
      await executeAskCommand(settings)

      // Assert
      expect(mockShowMsg).toHaveBeenCalledWith(
        expect.stringContaining('Request timeout'),
        'error'
      )
    })

    it('should handle streaming errors mid-stream', async () => {
      // Arrange
      mockGetCurrentBlock.mockResolvedValue({ uuid: 'test-uuid', content: 'Test question' } as any)
      mockStream.mockImplementation(async function* () {
        yield { choices: [{ delta: { content: 'Start' } }] }
        throw new Error('Stream interrupted')
      })

      // Act
      await executeAskCommand(settings)

      // Assert
      expect(mockShowMsg).toHaveBeenCalledWith(
        expect.stringContaining('Stream interrupted'),
        'error'
      )
    })
  })

  describe('Contract: User Interaction', () => {
    it('should cancel if user provides empty question', async () => {
      // Arrange
      mockGetCurrentBlock.mockResolvedValue({ uuid: 'test-uuid', content: '' } as any)

      // Act
      await executeAskCommand(settings)

      // Assert - should not call LLM or create blocks
      expect(mockStream).not.toHaveBeenCalled()
      expect(mockChat).not.toHaveBeenCalled()
      expect(mockInsertBlock).not.toHaveBeenCalled()
    })

    it('should cancel if user dismisses dialog', async () => {
      // Arrange - no current block (equivalent to dismissing)
      mockGetCurrentBlock.mockResolvedValue(null as any)

      // Act
      await executeAskCommand(settings)

      // Assert
      expect(mockStream).not.toHaveBeenCalled()
      expect(mockChat).not.toHaveBeenCalled()
      expect(mockInsertBlock).not.toHaveBeenCalled()
    })

    it('should trim whitespace from question', async () => {
      // Arrange
      mockGetCurrentBlock.mockResolvedValue({ uuid: 'test-uuid', content: '  What is AI?  ' } as any)
      mockStream.mockImplementation(async function* () {
        yield { choices: [{ delta: { content: 'AI is...' } }] }
      })

      // Act
      await executeAskCommand(settings)

      // Assert
      expect(mockStream).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: expect.arrayContaining([
            expect.objectContaining({
              role: 'user',
              content: '  What is AI?  ', // Should preserve original spacing in message
            }),
          ]),
        })
      )
    })
  })

  describe('Contract: Block Placement', () => {
    it('should create placeholder after current block if available', async () => {
      // Arrange
      mockGetCurrentBlock.mockResolvedValue({ uuid: 'current-block-123', content: 'Test question' } as any)
      mockStream.mockImplementation(async function* () {
        yield { choices: [{ delta: { content: 'Response' } }] }
      })

      // Act
      await executeAskCommand(settings)

      // Assert
      expect(mockInsertBlock).toHaveBeenCalledWith(
        'current-block-123',
        expect.any(String),
        expect.objectContaining({ sibling: false })
      )
    })

    it('should show warning if no current block', async () => {
      // Arrange
      mockGetCurrentBlock.mockResolvedValue(null)

      // Act
      await executeAskCommand(settings)

      // Assert - should show warning and not create any blocks
      expect(mockShowMsg).toHaveBeenCalledWith(
        expect.stringContaining('write your question'),
        'warning'
      )
      expect(mockInsertBlock).not.toHaveBeenCalled()
      expect(mockAppendBlockInPage).not.toHaveBeenCalled()
    })
  })
})
