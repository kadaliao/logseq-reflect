/**
 * Unit tests for context command handlers
 * T062: Write unit tests for context command handlers
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
const { handleAskWithPageContext, handleAskWithBlockContext } = await import(
  '../../../src/commands/context'
)
const { LLMClient } = await import('../../../src/llm/client')

// Get mock references
const mockGetCurrentPage = vi.mocked(logseq.Editor.getCurrentPage)
const mockGetCurrentBlock = vi.mocked(logseq.Editor.getCurrentBlock)
const mockGetPage = vi.mocked(logseq.Editor.getPage)
const mockGetPageBlocksTree = vi.mocked(logseq.Editor.getPageBlocksTree)
const mockGetBlock = vi.mocked(logseq.Editor.getBlock)
const mockInsertBlock = vi.mocked(logseq.Editor.insertBlock)
const mockUpdateBlock = vi.mocked(logseq.Editor.updateBlock)
const mockShowMsg = vi.mocked(logseq.App.showMsg)
const MockedLLMClient = vi.mocked(LLMClient)

let mockStream: any
let mockChat: any

// Mock settings
const mockSettings: PluginSettings = {
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
  defaultContextStrategy: 'none',
  enableStreaming: true,
  streamingUpdateInterval: 50,
  enableCustomCommands: false,
  customCommandRefreshInterval: 5000,
  enableFormatting: true,
  logFormattingModifications: false,
}

describe('Context Command Handlers', () => {
  beforeEach(() => {
    vi.clearAllMocks()

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
  })

  describe('handleAskWithPageContext', () => {
    it('should extract page context and send request with context', async () => {
      // Arrange
      mockGetCurrentPage.mockResolvedValueOnce({
        uuid: 'page-uuid',
        originalName: 'Test Page',
      })

      mockGetCurrentBlock.mockResolvedValueOnce({
        uuid: 'block-uuid',
        content: '',
      })

      mockGetPage.mockResolvedValueOnce({
        uuid: 'page-uuid',
        originalName: 'Test Page',
      })

      mockGetPageBlocksTree.mockResolvedValueOnce([
        {
          uuid: 'block-1',
          content: 'Page content line 1',
          children: [],
        },
        {
          uuid: 'block-2',
          content: 'Page content line 2',
          children: [],
        },
      ])

      mockInsertBlock.mockResolvedValueOnce({
        uuid: 'placeholder-uuid',
        content: 'Loading...',
      })

      // Mock stream response
      mockStream.mockImplementation(async function* () {
        yield { choices: [{ delta: { content: 'Test response' } }] }
      })

      // Act
      await handleAskWithPageContext('What is on this page?', mockSettings)

      // Assert
      expect(mockGetCurrentPage).toHaveBeenCalled()
      expect(mockGetPage).toHaveBeenCalledWith('Test Page')
      expect(mockGetPageBlocksTree).toHaveBeenCalledWith('Test Page')

      // Verify LLM was called with page context
      expect(mockStream).toHaveBeenCalled()
      const streamCall = mockStream.mock.calls[0]
      const request = streamCall[0]
      expect(request.messages.some((m: any) =>
        m.content && m.content.includes('Page content line 1')
      )).toBe(true)
    })

    it('should handle empty page gracefully', async () => {
      // Arrange
      mockGetCurrentPage.mockResolvedValueOnce({
        uuid: 'empty-page-uuid',
        originalName: 'Empty Page',
      })

      mockGetCurrentBlock.mockResolvedValueOnce({
        uuid: 'block-uuid',
        content: '',
      })

      mockGetPage.mockResolvedValueOnce({
        uuid: 'empty-page-uuid',
        originalName: 'Empty Page',
      })

      mockGetPageBlocksTree.mockResolvedValueOnce([])

      mockInsertBlock.mockResolvedValueOnce({
        uuid: 'placeholder-uuid',
        content: 'Loading...',
      })

      // Mock stream response
      mockStream.mockImplementation(async function* () {
        yield { choices: [{ delta: { content: 'Response' } }] }
      })

      // Act
      await handleAskWithPageContext('Test question', mockSettings)

      // Assert - Should still work without context
      expect(mockStream).toHaveBeenCalled()
    })

    it('should show warning when no active page', async () => {
      // Arrange
      mockGetCurrentPage.mockResolvedValueOnce(null)

      // Act
      const { handleAskWithPageContext } = await import(
        '../../../src/commands/context'
      )
      await handleAskWithPageContext('Test question', mockSettings)

      // Assert
      expect(mockShowMsg).toHaveBeenCalledWith(
        expect.stringContaining('No active page'),
        'warning'
      )

      expect(mockStream).not.toHaveBeenCalled()
    })

    it('should return early if question is empty', async () => {
      // Act
      const { handleAskWithPageContext } = await import(
        '../../../src/commands/context'
      )
      await handleAskWithPageContext('', mockSettings)

      // Assert
      expect(mockGetCurrentPage).not.toHaveBeenCalled()
      expect(mockStream).not.toHaveBeenCalled()
    })

    it('should handle LLM errors gracefully', async () => {
      // Arrange
      mockGetCurrentPage.mockResolvedValueOnce({
        uuid: 'page-uuid',
        originalName: 'Test Page',
      })

      mockGetCurrentBlock.mockResolvedValueOnce({
        uuid: 'block-uuid',
        content: '',
      })

      mockGetPage.mockResolvedValueOnce({
        uuid: 'page-uuid',
        originalName: 'Test Page',
      })

      mockGetPageBlocksTree.mockResolvedValueOnce([
        {
          uuid: 'block-1',
          content: 'Content',
          children: [],
        },
      ])

      mockInsertBlock.mockResolvedValueOnce({
        uuid: 'placeholder-uuid',
        content: 'Loading...',
      })

      // Mock stream to throw error
      mockStream.mockRejectedValueOnce(new Error('Network error'))

      // Act
      await handleAskWithPageContext('Test question', mockSettings)

      // Assert
      expect(mockUpdateBlock).toHaveBeenCalledWith(
        'placeholder-uuid',
        expect.stringContaining('Error')
      )

      expect(mockShowMsg).toHaveBeenCalledWith(
        expect.stringContaining('AI request failed'),
        'error'
      )
    })
  })

  describe('handleAskWithBlockContext', () => {
    it('should extract block context and send request', async () => {
      // Arrange
      mockGetCurrentBlock.mockResolvedValueOnce({
        uuid: 'parent-block-uuid',
        content: 'Parent block',
      })

      mockGetBlock.mockResolvedValueOnce({
        uuid: 'parent-block-uuid',
        content: 'Parent block',
        children: [
          {
            uuid: 'child-1',
            content: 'Child 1',
            children: [],
          },
          {
            uuid: 'child-2',
            content: 'Child 2',
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
        yield { choices: [{ delta: { content: 'Response' } }] }
      })

      // Act
      await handleAskWithBlockContext('Explain this', mockSettings)

      // Assert
      expect(mockGetCurrentBlock).toHaveBeenCalled()
      expect(mockGetBlock).toHaveBeenCalledWith('parent-block-uuid', {
        includeChildren: true,
      })

      // Verify LLM was called with block context
      expect(mockStream).toHaveBeenCalled()
      const streamCall = mockStream.mock.calls[0]
      const request = streamCall[0]
      expect(request.messages.some((m: any) =>
        m.content && m.content.includes('Parent block')
      )).toBe(true)
      expect(request.messages.some((m: any) =>
        m.content && m.content.includes('Child 1')
      )).toBe(true)
      expect(request.messages.some((m: any) =>
        m.content && m.content.includes('Child 2')
      )).toBe(true)
    })

    it('should handle standalone block without children', async () => {
      // Arrange
      mockGetCurrentBlock.mockResolvedValueOnce({
        uuid: 'solo-block-uuid',
        content: 'Solo block',
      })

      mockGetBlock.mockResolvedValueOnce({
        uuid: 'solo-block-uuid',
        content: 'Solo block',
        children: [],
      })

      mockInsertBlock.mockResolvedValueOnce({
        uuid: 'placeholder-uuid',
        content: 'Loading...',
      })

      // Mock stream response
      mockStream.mockImplementation(async function* () {
        yield { choices: [{ delta: { content: 'Response' } }] }
      })

      // Act
      await handleAskWithBlockContext('What is this?', mockSettings)

      // Assert
      expect(mockGetBlock).toHaveBeenCalled()
      expect(mockStream).toHaveBeenCalled()
    })

    it('should show warning when no active block', async () => {
      // Arrange
      mockGetCurrentBlock.mockResolvedValueOnce(null)

      // Act
      const { handleAskWithBlockContext } = await import(
        '../../../src/commands/context'
      )
      await handleAskWithBlockContext('Test question', mockSettings)

      // Assert
      expect(mockShowMsg).toHaveBeenCalledWith(
        expect.stringContaining('No active block'),
        'warning'
      )

      expect(mockStream).not.toHaveBeenCalled()
    })

    it('should return early if question is empty', async () => {
      // Arrange
      mockGetCurrentBlock.mockResolvedValueOnce({
        uuid: 'block-uuid',
        content: '',
      })

      // Act
      const { handleAskWithBlockContext } = await import(
        '../../../src/commands/context'
      )
      await handleAskWithBlockContext('', mockSettings)

      // Assert
      // Note: getCurrentBlock might be called for the empty check, but no further processing should happen
      expect(mockStream).not.toHaveBeenCalled()
    })

    it('should handle errors gracefully', async () => {
      // Arrange
      mockGetCurrentBlock.mockResolvedValueOnce({
        uuid: 'block-uuid',
        content: '',
      })

      mockGetBlock.mockRejectedValueOnce(new Error('Block fetch failed'))

      mockInsertBlock.mockResolvedValueOnce({
        uuid: 'placeholder-uuid',
        content: 'Loading...',
      })

      // Act
      const { handleAskWithBlockContext } = await import(
        '../../../src/commands/context'
      )
      await handleAskWithBlockContext('Test question', mockSettings)

      // Assert
      expect(mockShowMsg).toHaveBeenCalledWith(
        expect.stringContaining('AI request failed'),
        'error'
      )
    })
  })

  describe('Non-streaming mode', () => {
    it('should work in non-streaming mode for page context', async () => {
      // Arrange
      const nonStreamingSettings: PluginSettings = {
        ...mockSettings,
        llm: {
          ...mockSettings.llm,
          streamingEnabled: false,
        },
      }

      mockGetCurrentPage.mockResolvedValueOnce({
        uuid: 'page-uuid',
        originalName: 'Test Page',
      })

      mockGetCurrentBlock.mockResolvedValueOnce({
        uuid: 'block-uuid',
        content: '',
      })

      mockGetPage.mockResolvedValueOnce({
        uuid: 'page-uuid',
        originalName: 'Test Page',
      })

      mockGetPageBlocksTree.mockResolvedValueOnce([
        {
          uuid: 'block-1',
          content: 'Content',
          children: [],
        },
      ])

      mockInsertBlock.mockResolvedValueOnce({
        uuid: 'placeholder-uuid',
        content: 'Loading...',
      })

      // Mock chat response for non-streaming
      mockChat.mockResolvedValueOnce({
        choices: [
          {
            message: {
              content: 'Complete response',
            },
          },
        ],
      })

      // Act
      await handleAskWithPageContext('Test', nonStreamingSettings)

      // Assert
      expect(mockUpdateBlock).toHaveBeenCalledWith(
        'placeholder-uuid',
        'Complete response'
      )
    })

    it('should work in non-streaming mode for block context', async () => {
      // Arrange
      const nonStreamingSettings: PluginSettings = {
        ...mockSettings,
        llm: {
          ...mockSettings.llm,
          streamingEnabled: false,
        },
      }

      mockGetCurrentBlock.mockResolvedValueOnce({
        uuid: 'block-uuid',
        content: '',
      })

      mockGetBlock.mockResolvedValueOnce({
        uuid: 'block-uuid',
        content: 'Block content',
        children: [],
      })

      mockInsertBlock.mockResolvedValueOnce({
        uuid: 'placeholder-uuid',
        content: 'Loading...',
      })

      // Need to mock getBlock for parent block lookup
      mockGetBlock.mockResolvedValueOnce({
        uuid: 'parent-uuid',
        content: 'Parent content',
        children: [],
      })

      // Mock chat response for non-streaming
      mockChat.mockResolvedValueOnce({
        choices: [
          {
            message: {
              content: 'Complete response',
            },
          },
        ],
      })

      // Act
      await handleAskWithBlockContext('Test', nonStreamingSettings)

      // Assert
      expect(mockUpdateBlock).toHaveBeenCalledWith(
        'placeholder-uuid',
        'Complete response'
      )
    })
  })
})
