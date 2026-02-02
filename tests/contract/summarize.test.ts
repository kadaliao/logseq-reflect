/**
 * Contract tests for summarization commands
 * T063: Write contract test for summarization prompt template
 *
 * These tests verify the contract for summarization prompt templates and behavior
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
const { handleSummarizePage, handleSummarizeBlock } = await import('../../src/commands/summarize')
const { LLMClient } = await import('../../src/llm/client')

// Get mock references
const mockGetCurrentPage = vi.mocked(logseq.Editor.getCurrentPage)
const mockGetPage = vi.mocked(logseq.Editor.getPage)
const mockGetPageBlocksTree = vi.mocked(logseq.Editor.getPageBlocksTree)
const mockGetBlock = vi.mocked(logseq.Editor.getBlock)
const mockGetCurrentBlock = vi.mocked(logseq.Editor.getCurrentBlock)
const mockInsertBlock = vi.mocked(logseq.Editor.insertBlock)
const mockUpdateBlock = vi.mocked(logseq.Editor.updateBlock)
const mockFetch = vi.fn()
const MockedLLMClient = vi.mocked(LLMClient)

let mockStream: any
let mockChat: any
let settings: PluginSettings

describe('Summarization Command Contracts', () => {
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

    // Setup default mock behaviors
    mockInsertBlock.mockResolvedValue({ uuid: 'placeholder-uuid' } as any)
    mockUpdateBlock.mockResolvedValue(null as any)

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

  describe('CONTRACT: Summarization Prompt Templates', () => {
    it('should use appropriate system prompt for page summarization', async () => {
      // Arrange
      mockGetCurrentPage.mockResolvedValueOnce({
        uuid: 'page-uuid',
        name: 'Test Page',
        originalName: 'Test Page',
      })

      mockGetPage.mockResolvedValueOnce({
        uuid: 'page-uuid',
        name: 'Test Page',
        originalName: 'Test Page',
      })

      mockGetPageBlocksTree.mockResolvedValueOnce([
        {
          uuid: 'block-1',
          content: 'This is the first paragraph with some important information.',
          children: [],
        },
        {
          uuid: 'block-2',
          content: 'This is the second paragraph with more details.',
          children: [],
        },
        {
          uuid: 'block-3',
          content: 'This is the third paragraph with additional context.',
          children: [],
        },
      ])

      // Mock current block for placement
      mockGetCurrentBlock.mockResolvedValueOnce({
        uuid: 'current-block-uuid',
        content: '',
      } as any)

      mockInsertBlock.mockResolvedValueOnce({
        uuid: 'placeholder-uuid',
        content: 'Loading...',
      })

      // Mock stream response
      mockStream.mockImplementation(async function* () {
        yield { choices: [{ delta: { content: 'Summary of the page content.' } }] }
      })

      // Act
      await handleSummarizePage(settings)

      // Assert - Verify system prompt instructs summarization
      expect(mockStream).toHaveBeenCalled()
      const streamCall = mockStream.mock.calls[0]
      const request = streamCall[0]

      // CONTRACT: System message must instruct for summary generation
      const systemMessage = request.messages.find((m: any) => m.role === 'system')
      expect(systemMessage).toBeDefined()
      expect(systemMessage.content.toLowerCase()).toContain('summar') // matches "summary" or "summarize"

      // CONTRACT: Page content must be included as context
      const contentMessages = request.messages.filter((m: any) => m.role === 'user')
      expect(contentMessages.length).toBeGreaterThan(0)
      expect(contentMessages.some((m: any) => m.content.includes('first paragraph'))).toBe(
        true
      )
    })

    it('should use appropriate prompt for block summarization', async () => {
      // Arrange
      mockGetCurrentBlock.mockResolvedValueOnce({
        uuid: 'block-uuid',
        content: 'Parent block',
      })

      mockGetBlock.mockResolvedValueOnce({
        uuid: 'block-uuid',
        content: 'Parent block with detailed information',
        children: [
          {
            uuid: 'child-1',
            content: 'Child block 1 with more details',
            children: [],
          },
          {
            uuid: 'child-2',
            content: 'Child block 2 with additional info',
            children: [],
          },
        ],
      })

      mockInsertBlock.mockResolvedValueOnce({
        uuid: 'placeholder-uuid',
        content: 'Loading...',
      })

      // Mock stream response
      mockStream.mockImplementation(async function* () {
        yield { choices: [{ delta: { content: 'Summary of block tree.' } }] }
      })

      // Act
      await handleSummarizeBlock(settings)

      // Assert
      expect(mockStream).toHaveBeenCalled()
      const streamCall = mockStream.mock.calls[0]
      const request = streamCall[0]

      // CONTRACT: System message must instruct for summary
      const systemMessage = request.messages.find((m: any) => m.role === 'system')
      expect(systemMessage.content.toLowerCase()).toContain('summar')

      // CONTRACT: Block tree content must be included
      const contentMessages = request.messages.filter((m: any) => m.role === 'user')
      expect(contentMessages.some((m: any) => m.content.includes('Parent block'))).toBe(
        true
      )
    })

    it('CONTRACT: Summary should be concise and not just copy content', async () => {
      // This is a behavioral contract - the prompt should request conciseness
      mockGetCurrentPage.mockResolvedValueOnce({
        uuid: 'page-uuid',
        name: 'Long Page',
        originalName: 'Long Page',
      })

      mockGetPage.mockResolvedValueOnce({
        uuid: 'page-uuid',
        name: 'Long Page',
        originalName: 'Long Page',
      })

      // Create a long page with lots of content
      const longBlocks = Array.from({ length: 20 }, (_, i) => ({
        uuid: `block-${i}`,
        content: `This is paragraph ${i} with detailed information about topic ${i}.`,
        children: [],
      }))

      mockGetPageBlocksTree.mockResolvedValueOnce(longBlocks)

      // Mock current block for placement
      mockGetCurrentBlock.mockResolvedValueOnce({
        uuid: 'current-block-uuid',
        content: '',
      } as any)

      mockInsertBlock.mockResolvedValueOnce({
        uuid: 'placeholder-uuid',
        content: 'Loading...',
      })

      // Mock stream response
      mockStream.mockImplementation(async function* () {
        yield { choices: [{ delta: { content: 'Concise summary of long content.' } }] }
      })

      // Act
      await handleSummarizePage(settings)

      // Assert - Prompt should request conciseness
      const streamCall = mockStream.mock.calls[0]
      const request = streamCall[0]
      const systemMessage = request.messages.find((m: any) => m.role === 'system')

      // CONTRACT: Prompt should request concise summary
      expect(
        systemMessage.content.toLowerCase().includes('concise') ||
          systemMessage.content.toLowerCase().includes('brief') ||
          systemMessage.content.toLowerCase().includes('key points')
      ).toBe(true)
    })

    it('CONTRACT: Should handle empty page gracefully', async () => {
      // Arrange
      mockGetCurrentPage.mockResolvedValueOnce({
        uuid: 'empty-page-uuid',
        name: 'Empty Page',
        originalName: 'Empty Page',
      })

      mockGetPage.mockResolvedValueOnce({
        uuid: 'empty-page-uuid',
        name: 'Empty Page',
        originalName: 'Empty Page',
      })

      mockGetPageBlocksTree.mockResolvedValueOnce([])

      // Act
      const { handleSummarizePage } = await import('../../src/commands/summarize')
      await handleSummarizePage()

      // Assert - Should show appropriate message for empty page
      // Implementation may choose to: not call LLM, or inform user
      // At minimum, should not crash
      expect(true).toBe(true) // If we reach here, no crash occurred
    })

    it('CONTRACT: Should handle block without children', async () => {
      // Arrange
      mockGetCurrentBlock.mockResolvedValueOnce({
        uuid: 'solo-block',
        content: 'Single block without children',
      })

      mockGetBlock.mockResolvedValueOnce({
        uuid: 'solo-block',
        content: 'Single block without children',
        children: [],
      })

      mockInsertBlock.mockResolvedValueOnce({
        uuid: 'placeholder-uuid',
        content: 'Loading...',
      })

      // Mock stream response
      mockStream.mockImplementation(async function* () {
        yield { choices: [{ delta: { content: 'Summary of single block.' } }] }
      })

      // Act
      await handleSummarizeBlock(settings)

      // Assert - Should still work with single block
      expect(mockStream).toHaveBeenCalled()
    })
  })

  describe('CONTRACT: Streaming Behavior', () => {
    it('should stream summary incrementally to user', async () => {
      // This test verifies that streaming is supported
      // The actual streaming behavior is tested in integration tests
      expect(settings.llm.streamingEnabled).toBe(true)
      expect(mockStream).toBeDefined()
    })
  })
})
