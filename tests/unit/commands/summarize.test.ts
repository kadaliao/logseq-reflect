/**
 * Unit tests for summarization command handlers
 * T072: Write unit tests for summarize handlers
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import type { PluginSettings } from '../../../src/config/settings'

// Mock dependencies
vi.mock('../../../src/llm/client', () => ({
  LLMClient: vi.fn().mockImplementation(() => ({
    stream: vi.fn(),
    chat: vi.fn(),
  })),
}))

// Import after mocking
const { handleSummarizePage, handleSummarizeBlock } = await import(
  '../../../src/commands/summarize'
)
const { LLMClient } = await import('../../../src/llm/client')

// Get mock references
const mockGetCurrentPage = vi.mocked(logseq.Editor.getCurrentPage)
const mockGetPage = vi.mocked(logseq.Editor.getPage)
const mockGetPageBlocksTree = vi.mocked(logseq.Editor.getPageBlocksTree)
const mockGetCurrentBlock = vi.mocked(logseq.Editor.getCurrentBlock)
const mockGetBlock = vi.mocked(logseq.Editor.getBlock)
const mockInsertBlock = vi.mocked(logseq.Editor.insertBlock)
const mockUpdateBlock = vi.mocked(logseq.Editor.updateBlock)
const mockAppendBlockInPage = vi.mocked(logseq.Editor.appendBlockInPage)
const mockShowMsg = vi.mocked(logseq.App.showMsg)
const MockedLLMClient = vi.mocked(LLMClient)

let mockStream: any
let mockChat: any

describe('Summarization Handlers - Unit Tests', () => {
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
    mockInsertBlock.mockResolvedValue({ uuid: 'placeholder-uuid' } as any)
    mockUpdateBlock.mockResolvedValue(null)
    mockAppendBlockInPage.mockResolvedValue({ uuid: 'new-block-uuid' } as any)
  })

  describe('handleSummarizePage', () => {
    it('should extract page content and send summarization request', async () => {
      // Arrange
      mockGetCurrentPage.mockResolvedValueOnce({
        uuid: 'page-uuid',
        name: 'Test Page',
        originalName: 'Test Page',
      } as any)

      mockGetPage.mockResolvedValueOnce({
        uuid: 'page-uuid',
        name: 'Test Page',
        originalName: 'Test Page',
      } as any)

      mockGetPageBlocksTree.mockResolvedValueOnce([
        {
          uuid: 'block-1',
          content: 'First paragraph with important information.',
          children: [],
        },
        {
          uuid: 'block-2',
          content: 'Second paragraph with more details.',
          children: [],
        },
      ])

      mockStream.mockImplementation(async function* () {
        yield { choices: [{ delta: { content: 'Summary: ' } }] }
        yield { choices: [{ delta: { content: 'Key points from the page.' } }] }
      })

      // Act
      await handleSummarizePage(settings)

      // Assert - Should call LLM with summarization prompt
      expect(mockStream).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'gpt-4',
          messages: expect.arrayContaining([
            expect.objectContaining({
              role: 'system',
              content: expect.stringContaining('summarize'),
            }),
            expect.objectContaining({
              role: 'user',
              content: expect.stringContaining('First paragraph'),
            }),
          ]),
        }),
        expect.any(Object) // AbortSignal
      )
    })

    it('should show warning if no active page', async () => {
      // Arrange
      mockGetCurrentPage.mockResolvedValueOnce(null)

      // Act
      await handleSummarizePage(settings)

      // Assert
      expect(mockShowMsg).toHaveBeenCalledWith(
        expect.stringContaining('No active page'),
        'warning'
      )
      expect(mockStream).not.toHaveBeenCalled()
    })

    it('should show warning if page is empty', async () => {
      // Arrange
      mockGetCurrentPage.mockResolvedValueOnce({
        uuid: 'page-uuid',
        name: 'Empty Page',
        originalName: 'Empty Page',
      } as any)

      mockGetPage.mockResolvedValueOnce({
        uuid: 'page-uuid',
        name: 'Empty Page',
        originalName: 'Empty Page',
      } as any)

      mockGetPageBlocksTree.mockResolvedValueOnce([])

      // Act
      await handleSummarizePage(settings)

      // Assert
      expect(mockShowMsg).toHaveBeenCalledWith(
        expect.stringContaining('empty'),
        'warning'
      )
      expect(mockStream).not.toHaveBeenCalled()
    })

    it('should work with non-streaming mode', async () => {
      // Arrange
      settings.llm.streamingEnabled = false

      mockGetCurrentPage.mockResolvedValueOnce({
        uuid: 'page-uuid',
        name: 'Test Page',
        originalName: 'Test Page',
      } as any)

      mockGetPage.mockResolvedValueOnce({
        uuid: 'page-uuid',
        name: 'Test Page',
        originalName: 'Test Page',
      } as any)

      mockGetPageBlocksTree.mockResolvedValueOnce([
        {
          uuid: 'block-1',
          content: 'Content to summarize',
          children: [],
        },
      ])

      mockChat.mockResolvedValueOnce({
        choices: [{ message: { content: 'Complete summary of the page.' } }],
      })

      // Act
      await handleSummarizePage(settings)

      // Assert
      expect(mockChat).toHaveBeenCalled()
      expect(mockUpdateBlock).toHaveBeenCalledWith(
        'placeholder-uuid',
        'Complete summary of the page.'
      )
    })
  })

  describe('handleSummarizeBlock', () => {
    it('should extract block content and send summarization request', async () => {
      // Arrange
      mockGetCurrentBlock.mockResolvedValueOnce({
        uuid: 'block-uuid',
        content: 'Parent block',
      } as any)

      mockGetBlock.mockResolvedValueOnce({
        uuid: 'block-uuid',
        content: 'Parent block with details',
        children: [
          {
            uuid: 'child-1',
            content: 'Child block 1',
            children: [],
          },
          {
            uuid: 'child-2',
            content: 'Child block 2',
            children: [],
          },
        ],
      } as any)

      mockStream.mockImplementation(async function* () {
        yield { choices: [{ delta: { content: 'Block summary: ' } }] }
        yield { choices: [{ delta: { content: 'Main points.' } }] }
      })

      // Act
      await handleSummarizeBlock(settings)

      // Assert
      expect(mockStream).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'gpt-4',
          messages: expect.arrayContaining([
            expect.objectContaining({
              role: 'system',
              content: expect.stringContaining('summarize'),
            }),
            expect.objectContaining({
              role: 'user',
              content: expect.stringContaining('Parent block'),
            }),
          ]),
        }),
        expect.any(Object) // AbortSignal
      )
    })

    it('should show warning if no active block', async () => {
      // Arrange
      mockGetCurrentBlock.mockResolvedValueOnce(null)

      // Act
      await handleSummarizeBlock(settings)

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
      await handleSummarizeBlock(settings)

      // Assert
      expect(mockShowMsg).toHaveBeenCalledWith(
        expect.stringContaining('empty'),
        'warning'
      )
      expect(mockStream).not.toHaveBeenCalled()
    })

    it('should work with non-streaming mode', async () => {
      // Arrange
      settings.llm.streamingEnabled = false

      mockGetCurrentBlock.mockResolvedValueOnce({
        uuid: 'block-uuid',
        content: 'Block content',
      } as any)

      mockGetBlock.mockResolvedValueOnce({
        uuid: 'block-uuid',
        content: 'Block content to summarize',
        children: [],
      } as any)

      mockChat.mockResolvedValueOnce({
        choices: [{ message: { content: 'Complete block summary.' } }],
      })

      // Act
      await handleSummarizeBlock(settings)

      // Assert
      expect(mockChat).toHaveBeenCalled()
      expect(mockUpdateBlock).toHaveBeenCalledWith(
        'placeholder-uuid',
        'Complete block summary.'
      )
    })

    it('should handle blocks with nested children', async () => {
      // Arrange
      mockGetCurrentBlock.mockResolvedValueOnce({
        uuid: 'block-uuid',
        content: 'Parent',
      } as any)

      mockGetBlock.mockResolvedValueOnce({
        uuid: 'block-uuid',
        content: 'Parent block',
        children: [
          {
            uuid: 'child-1',
            content: 'Child 1',
            children: [
              {
                uuid: 'grandchild-1',
                content: 'Grandchild 1',
                children: [],
              },
            ],
          },
        ],
      } as any)

      mockStream.mockImplementation(async function* () {
        yield { choices: [{ delta: { content: 'Summary' } }] }
      })

      // Act
      await handleSummarizeBlock(settings)

      // Assert - Should include nested content
      const streamCall = mockStream.mock.calls[0]
      const userMessage = streamCall[0].messages.find((m: any) => m.role === 'user')
      expect(userMessage.content).toContain('Parent block')
      expect(userMessage.content).toContain('Child 1')
      expect(userMessage.content).toContain('Grandchild 1')
    })
  })

  describe('Error Handling', () => {
    it('should handle streaming errors in page summarization', async () => {
      // Arrange
      mockGetCurrentPage.mockResolvedValueOnce({
        uuid: 'page-uuid',
        name: 'Test Page',
        originalName: 'Test Page',
      } as any)

      mockGetPage.mockResolvedValueOnce({
        uuid: 'page-uuid',
        name: 'Test Page',
        originalName: 'Test Page',
      } as any)

      mockGetPageBlocksTree.mockResolvedValueOnce([
        {
          uuid: 'block-1',
          content: 'Content',
          children: [],
        },
      ])

      mockStream.mockImplementation(async function* () {
        yield { choices: [{ delta: { content: 'Start' } }] }
        throw new Error('Stream error')
      })

      // Act
      await handleSummarizePage(settings)

      // Assert - Should show error message
      expect(mockShowMsg).toHaveBeenCalledWith(
        expect.stringContaining('Stream error'),
        'error'
      )
    })

    it('should handle streaming errors in block summarization', async () => {
      // Arrange
      mockGetCurrentBlock.mockResolvedValueOnce({
        uuid: 'block-uuid',
        content: 'Block',
      } as any)

      mockGetBlock.mockResolvedValueOnce({
        uuid: 'block-uuid',
        content: 'Block content',
        children: [],
      } as any)

      mockStream.mockImplementation(async function* () {
        throw new Error('Network error')
      })

      // Act
      await handleSummarizeBlock(settings)

      // Assert
      expect(mockShowMsg).toHaveBeenCalledWith(
        expect.stringContaining('Network error'),
        'error'
      )
    })
  })
})
