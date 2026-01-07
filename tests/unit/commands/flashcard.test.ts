/**
 * Unit tests for flashcard generation handler
 * T080: Write unit tests for flashcard handler
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
const { handleGenerateFlashcard } = await import('../../../src/commands/flashcard')
const { LLMClient } = await import('../../../src/llm/client')

// Get mock references
const mockGetCurrentBlock = vi.mocked(logseq.Editor.getCurrentBlock)
const mockGetBlock = vi.mocked(logseq.Editor.getBlock)
const mockInsertBlock = vi.mocked(logseq.Editor.insertBlock)
const mockUpdateBlock = vi.mocked(logseq.Editor.updateBlock)
const mockRemoveBlock = vi.mocked(logseq.Editor.removeBlock)
const mockShowMsg = vi.mocked(logseq.App.showMsg)
const MockedLLMClient = vi.mocked(LLMClient)

let mockStream: any
let mockChat: any

describe('Flashcard Handler - Unit Tests', () => {
  let settings: PluginSettings

  beforeEach(() => {
    vi.clearAllMocks()

    // Fresh mock instances for each test
    mockStream = vi.fn()
    mockChat = vi.fn()
    MockedLLMClient.mockImplementation(
      () =>
        ({
          stream: mockStream,
          chat: mockChat,
        }) as any
    )

    // Default settings
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
        maxContextTokens: 8000,
      },
      debugMode: false,
    }

    // Default mock behaviors
    mockInsertBlock.mockResolvedValue({ uuid: 'new-block-uuid' } as any)
    mockUpdateBlock.mockResolvedValue(null)
    mockRemoveBlock.mockResolvedValue(null)
  })

  describe('Content Validation', () => {
    it('should show warning if no active block', async () => {
      // Arrange
      mockGetCurrentBlock.mockResolvedValueOnce(null)

      // Act
      await handleGenerateFlashcard(settings)

      // Assert
      expect(mockShowMsg).toHaveBeenCalledWith(
        expect.stringContaining('No active block'),
        'warning'
      )
      expect(mockStream).not.toHaveBeenCalled()
    })

    it('should show warning if block is empty', async () => {
      // Arrange
      mockGetCurrentBlock.mockResolvedValueOnce({
        uuid: 'block-uuid',
        content: '',
      } as any)

      mockGetBlock.mockResolvedValueOnce({
        uuid: 'block-uuid',
        content: '',
        children: [],
      } as any)

      // Act
      await handleGenerateFlashcard(settings)

      // Assert
      expect(mockShowMsg).toHaveBeenCalledWith(
        expect.stringContaining('empty'),
        'warning'
      )
      expect(mockStream).not.toHaveBeenCalled()
    })

    it('should show warning if content is insufficient', async () => {
      // Arrange
      mockGetCurrentBlock.mockResolvedValueOnce({
        uuid: 'block-uuid',
        content: 'Hi',
      } as any)

      mockGetBlock.mockResolvedValueOnce({
        uuid: 'block-uuid',
        content: 'Hi',
        children: [],
      } as any)

      // Act
      await handleGenerateFlashcard(settings)

      // Assert
      expect(mockShowMsg).toHaveBeenCalledWith(
        expect.stringMatching(/insufficient.*content/i),
        'warning'
      )
      expect(mockStream).not.toHaveBeenCalled()
    })

    it('should accept content with sufficient length', async () => {
      // Arrange
      mockGetCurrentBlock.mockResolvedValueOnce({
        uuid: 'block-uuid',
        content: 'The mitochondria is the powerhouse of the cell.',
      } as any)

      mockGetBlock.mockResolvedValueOnce({
        uuid: 'block-uuid',
        content: 'The mitochondria is the powerhouse of the cell.',
        children: [],
      } as any)

      mockStream.mockImplementation(async function* () {
        yield { choices: [{ delta: { content: 'Q: What is mitochondria?' } }] }
      })

      // Act
      await handleGenerateFlashcard(settings)

      // Assert
      expect(mockStream).toHaveBeenCalled()
    })
  })

  describe('Request Building', () => {
    it('should send flashcard generation prompt to LLM', async () => {
      // Arrange
      mockGetCurrentBlock.mockResolvedValueOnce({
        uuid: 'block-uuid',
        content: 'Photosynthesis is the process by which plants convert sunlight into energy.',
      } as any)

      mockGetBlock.mockResolvedValueOnce({
        uuid: 'block-uuid',
        content: 'Photosynthesis is the process by which plants convert sunlight into energy.',
        children: [],
      } as any)

      mockStream.mockImplementation(async function* () {
        yield { choices: [{ delta: { content: 'Q: What is photosynthesis?' } }] }
      })

      // Act
      await handleGenerateFlashcard(settings)

      // Assert
      expect(mockStream).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'gpt-4',
          messages: expect.arrayContaining([
            expect.objectContaining({
              role: 'system',
              content: expect.stringContaining('flashcard'),
            }),
            expect.objectContaining({
              role: 'user',
              content: expect.stringContaining('Photosynthesis'),
            }),
          ]),
        }),
        expect.any(Object) // AbortSignal
      )
    })

    it('should include block children content', async () => {
      // Arrange
      mockGetCurrentBlock.mockResolvedValueOnce({
        uuid: 'parent-uuid',
        content: 'Water cycle overview:',
      } as any)

      mockGetBlock.mockResolvedValueOnce({
        uuid: 'parent-uuid',
        content: 'Water cycle overview:',
        children: [
          {
            uuid: 'child-1',
            content: 'Evaporation: water turns into vapor',
            children: [],
          },
          {
            uuid: 'child-2',
            content: 'Condensation: vapor forms clouds',
            children: [],
          },
        ],
      } as any)

      mockStream.mockImplementation(async function* () {
        yield { choices: [{ delta: { content: 'Flashcard content' } }] }
      })

      // Act
      await handleGenerateFlashcard(settings)

      // Assert
      const streamCall = mockStream.mock.calls[0]
      const userMessage = streamCall[0].messages.find((m: any) => m.role === 'user')
      expect(userMessage.content).toContain('Evaporation')
      expect(userMessage.content).toContain('Condensation')
    })
  })

  describe('Streaming Mode', () => {
    it('should handle streaming responses', async () => {
      // Arrange
      mockGetCurrentBlock.mockResolvedValueOnce({
        uuid: 'block-uuid',
        content: 'The Earth orbits the Sun once per year.',
      } as any)

      mockGetBlock.mockResolvedValueOnce({
        uuid: 'block-uuid',
        content: 'The Earth orbits the Sun once per year.',
        children: [],
      } as any)

      mockStream.mockImplementation(async function* () {
        yield { choices: [{ delta: { content: 'Q: How long does ' } }] }
        yield { choices: [{ delta: { content: 'Earth take to orbit the Sun?\n' } }] }
        yield { choices: [{ delta: { content: 'A: One year #card' } }] }
      })

      // Act
      await handleGenerateFlashcard(settings)

      // Assert
      expect(mockStream).toHaveBeenCalled()
    })

    it('should handle streaming errors', async () => {
      // Arrange
      mockGetCurrentBlock.mockResolvedValueOnce({
        uuid: 'block-uuid',
        content: 'Test content for flashcard generation.',
      } as any)

      mockGetBlock.mockResolvedValueOnce({
        uuid: 'block-uuid',
        content: 'Test content for flashcard generation.',
        children: [],
      } as any)

      mockStream.mockImplementation(async function* () {
        yield { choices: [{ delta: { content: 'Start' } }] }
        throw new Error('Stream error')
      })

      // Act
      await handleGenerateFlashcard(settings)

      // Assert
      expect(mockShowMsg).toHaveBeenCalledWith(
        expect.stringContaining('Failed'),
        'error'
      )
    })
  })

  describe('Non-Streaming Mode', () => {
    beforeEach(() => {
      settings.llm.streamingEnabled = false
    })

    it('should handle non-streaming responses', async () => {
      // Arrange
      mockGetCurrentBlock.mockResolvedValueOnce({
        uuid: 'block-uuid',
        content: 'The capital of France is Paris.',
      } as any)

      mockGetBlock.mockResolvedValueOnce({
        uuid: 'block-uuid',
        content: 'The capital of France is Paris.',
        children: [],
      } as any)

      mockChat.mockResolvedValueOnce({
        choices: [
          {
            message: {
              content: 'Q: What is the capital of France?\nA: Paris #card',
            },
          },
        ],
      })

      // Act
      await handleGenerateFlashcard(settings)

      // Assert
      expect(mockChat).toHaveBeenCalled()
    })
  })

  describe('Block Creation', () => {
    it('should create flashcard blocks after generation', async () => {
      // Arrange
      mockGetCurrentBlock.mockResolvedValueOnce({
        uuid: 'parent-uuid',
        content: 'The speed of light is 299,792,458 m/s.',
      } as any)

      mockGetBlock.mockResolvedValueOnce({
        uuid: 'parent-uuid',
        content: 'The speed of light is 299,792,458 m/s.',
        children: [],
      } as any)

      mockStream.mockImplementation(async function* () {
        yield {
          choices: [
            {
              delta: {
                content: 'Q: What is the speed of light?\nA: 299,792,458 m/s #card',
              },
            },
          ],
        }
      })

      // Act
      await handleGenerateFlashcard(settings)

      // Wait for async block creation
      await new Promise(resolve => setTimeout(resolve, 100))

      // Assert
      expect(mockInsertBlock).toHaveBeenCalled()
    })

    it('should handle Q&A parsing and create nested blocks', async () => {
      // Arrange
      mockGetCurrentBlock.mockResolvedValueOnce({
        uuid: 'parent-uuid',
        content: 'DNA stands for Deoxyribonucleic acid.',
      } as any)

      mockGetBlock.mockResolvedValueOnce({
        uuid: 'parent-uuid',
        content: 'DNA stands for Deoxyribonucleic acid.',
        children: [],
      } as any)

      mockStream.mockImplementation(async function* () {
        yield {
          choices: [
            {
              delta: {
                content: 'Q: What does DNA stand for?\nA: Deoxyribonucleic acid #card',
              },
            },
          ],
        }
      })

      // Act
      await handleGenerateFlashcard(settings)

      await new Promise(resolve => setTimeout(resolve, 100))

      // Assert - Should create blocks
      expect(mockInsertBlock.mock.calls.length).toBeGreaterThanOrEqual(1)
    })
  })
})
