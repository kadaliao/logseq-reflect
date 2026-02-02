/**
 * Contract tests for flashcard generation
 * T073: Write contract test for flashcard generation prompt
 *
 * These tests verify the contract for flashcard generation behavior
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
const { handleGenerateFlashcard } = await import('../../src/commands/flashcard')
const { LLMClient } = await import('../../src/llm/client')

// Get mock references
const mockGetCurrentBlock = vi.mocked(logseq.Editor.getCurrentBlock)
const mockGetBlock = vi.mocked(logseq.Editor.getBlock)
const mockInsertBlock = vi.mocked(logseq.Editor.insertBlock)
const mockUpdateBlock = vi.mocked(logseq.Editor.updateBlock)
const mockShowMsg = vi.mocked(logseq.App.showMsg)
const mockFetch = vi.fn()
const MockedLLMClient = vi.mocked(LLMClient)

let mockStream: any
let mockChat: any
let settings: PluginSettings

describe('Flashcard Generation - Contract Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    global.fetch = mockFetch

    // Fresh mock instances for each test
    mockStream = vi.fn()
    mockChat = vi.fn()

    MockedLLMClient.mockImplementation(() => ({
      stream: mockStream,
      chat: mockChat,
    }))

    // Default test settings with streaming enabled
    settings = {
      llm: {
        baseURL: 'http://localhost:11434',
        apiPath: '/v1/chat/completions',
        modelName: 'gpt-4',
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
      defaultContextStrategy: 'none',
      enableStreaming: true,
      streamingUpdateInterval: 50,
      enableCustomCommands: false,
      customCommandRefreshInterval: 5000,
      enableFormatting: true,
      logFormattingModifications: false,
    }
  })

  describe('CONTRACT: Flashcard Generation Prompt', () => {
    it('should use appropriate system prompt for flashcard generation', async () => {
      // Arrange
      mockGetCurrentBlock.mockResolvedValueOnce({
        uuid: 'block-uuid',
        content: 'The Pythagorean theorem states that in a right triangle, the square of the hypotenuse equals the sum of squares of the other two sides.',
      } as any)

      mockGetBlock.mockResolvedValueOnce({
        uuid: 'block-uuid',
        content: 'The Pythagorean theorem states that in a right triangle, the square of the hypotenuse equals the sum of squares of the other two sides.',
        children: [],
      } as any)

      mockInsertBlock.mockResolvedValue({ uuid: 'placeholder-uuid' } as any)

      // Mock stream to return a simple response
      mockStream.mockImplementation(async function* () {
        yield { choices: [{ delta: { content: 'Q: What does the Pythagorean theorem state?\nA: The square of the hypotenuse equals the sum of squares of the other two sides. #card' } }] }
      })

      // Act
      await handleGenerateFlashcard(settings)

      // Assert - Verify system prompt instructs flashcard generation
      expect(mockStream).toHaveBeenCalled()
      const streamCall = mockStream.mock.calls[0]
      const request = streamCall[0]

      // CONTRACT: System message must instruct for flashcard generation
      const systemMessage = request.messages.find((m: any) => m.role === 'system')
      expect(systemMessage).toBeDefined()
      expect(systemMessage.content.toLowerCase()).toContain('flashcard')
      expect(systemMessage.content.toLowerCase()).toMatch(/question.*answer/i)

      // CONTRACT: Source content must be included
      const contentMessages = request.messages.filter((m: any) => m.role === 'user')
      expect(contentMessages.length).toBeGreaterThan(0)
      expect(
        contentMessages.some((m: any) => m.content.includes('Pythagorean theorem'))
      ).toBe(true)
    })

    it('should request Q&A format in the prompt', async () => {
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

      mockInsertBlock.mockResolvedValue({ uuid: 'placeholder-uuid' } as any)

      // Mock stream response
      mockStream.mockImplementation(async function* () {
        yield { choices: [{ delta: { content: 'Q: What is photosynthesis?' } }] }
      })

      // Act
      await handleGenerateFlashcard(settings)

      // Assert
      expect(mockStream).toHaveBeenCalled()
      const streamCall = mockStream.mock.calls[0]
      const request = streamCall[0]
      const systemMessage = request.messages.find((m: any) => m.role === 'system')

      // CONTRACT: Prompt should request Q&A format
      expect(
        systemMessage.content.toLowerCase().includes('q:') ||
          systemMessage.content.toLowerCase().includes('question')
      ).toBe(true)
    })

    it('CONTRACT: Should handle empty content gracefully', async () => {
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
      const { handleGenerateFlashcard } = await import('../../src/commands/flashcard')
      await handleGenerateFlashcard()

      // Assert - Should show appropriate message for empty content
      expect(mockShowMsg).toHaveBeenCalledWith(
        expect.stringContaining('empty'),
        'warning'
      )
      // Should not call LLM
      expect(global.fetch).not.toHaveBeenCalled()
    })

    it('CONTRACT: Should handle insufficient content', async () => {
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
      const { handleGenerateFlashcard } = await import('../../src/commands/flashcard')
      await handleGenerateFlashcard()

      // Assert - Should show message about insufficient content
      expect(mockShowMsg).toHaveBeenCalledWith(
        expect.stringMatching(/insufficient|more.*content|detailed/i),
        'warning'
      )
    })

    it('CONTRACT: Should handle no current block', async () => {
      // Arrange
      mockGetCurrentBlock.mockResolvedValueOnce(null)

      // Act
      const { handleGenerateFlashcard } = await import('../../src/commands/flashcard')
      await handleGenerateFlashcard()

      // Assert - Should show appropriate warning
      expect(mockShowMsg).toHaveBeenCalledWith(
        expect.stringContaining('No active block'),
        'warning'
      )
      expect(global.fetch).not.toHaveBeenCalled()
    })
  })

  describe('CONTRACT: Nested Block Creation', () => {
    it('should create nested blocks with #card tag', async () => {
      // Arrange
      mockGetCurrentBlock.mockResolvedValueOnce({
        uuid: 'parent-uuid',
        content: 'The speed of light is approximately 299,792,458 meters per second.',
      } as any)

      mockGetBlock.mockResolvedValueOnce({
        uuid: 'parent-uuid',
        content: 'The speed of light is approximately 299,792,458 meters per second.',
        children: [],
      } as any)

      // Mock additional getBlock call for placeholder cleanup
      mockGetBlock.mockResolvedValue({
        uuid: 'parent-uuid',
        content: 'The speed of light is approximately 299,792,458 meters per second.',
        children: [{ uuid: 'placeholder-uuid', content: '⏳ AI is thinking...' }],
      } as any)

      let blockCount = 0
      mockInsertBlock.mockImplementation(async () => {
        blockCount++
        return { uuid: `child-${blockCount}` } as any
      })

      // Mock stream response
      mockStream.mockImplementation(async function* () {
        yield { choices: [{ delta: { content: 'Q: What is the speed of light?\nA: Approximately 299,792,458 meters per second. #card' } }] }
      })

      // Mock removeBlock for placeholder cleanup
      const mockRemoveBlock = vi.mocked(logseq.Editor.removeBlock)
      mockRemoveBlock.mockResolvedValue(null as any)

      // Act
      await handleGenerateFlashcard(settings)

      // Wait for async operations
      await new Promise(resolve => setTimeout(resolve, 100))

      // Assert - Should create at least 2 child blocks (question and answer)
      expect(mockInsertBlock.mock.calls.length).toBeGreaterThanOrEqual(2)

      // CONTRACT: First block (question) should be child of parent
      const insertCalls = mockInsertBlock.mock.calls
      expect(insertCalls[0][0]).toBe('parent-uuid') // Question block parent is parent-uuid
      expect(insertCalls[0][2]).toMatchObject({ sibling: false })

      // CONTRACT: At least one block should have #card tag
      const blockContents = insertCalls.map(call => call[1])
      expect(
        blockContents.some(content => content.includes('#card'))
      ).toBe(true)
    })
  })
})
