/**
 * Unit tests for context command handlers
 * T062: Write unit tests for context command handlers
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import type { PluginSettings } from '../../../src/config/settings'

// Get mock references
const mockGetCurrentPage = vi.mocked(logseq.Editor.getCurrentPage)
const mockGetCurrentBlock = vi.mocked(logseq.Editor.getCurrentBlock)
const mockGetPage = vi.mocked(logseq.Editor.getPage)
const mockGetPageBlocksTree = vi.mocked(logseq.Editor.getPageBlocksTree)
const mockGetBlock = vi.mocked(logseq.Editor.getBlock)
const mockInsertBlock = vi.mocked(logseq.Editor.insertBlock)
const mockUpdateBlock = vi.mocked(logseq.Editor.updateBlock)
const mockShowMsg = vi.mocked(logseq.App.showMsg)

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
}

describe('Context Command Handlers', () => {
  beforeEach(() => {
    vi.clearAllMocks()
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

      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        body: {
          getReader: () => ({
            read: vi
              .fn()
              .mockResolvedValueOnce({
                done: false,
                value: new TextEncoder().encode(
                  'data: {"choices":[{"delta":{"content":"Test response"}}]}\n\n'
                ),
              })
              .mockResolvedValueOnce({
                done: true,
                value: undefined,
              }),
          }),
        },
      })

      // Act
      const { handleAskWithPageContext } = await import(
        '../../../src/commands/context'
      )
      await handleAskWithPageContext('What is on this page?', mockSettings)

      // Assert
      expect(mockGetCurrentPage).toHaveBeenCalled()
      expect(mockGetPage).toHaveBeenCalledWith('Test Page')
      expect(mockGetPageBlocksTree).toHaveBeenCalledWith('Test Page')

      // Verify LLM was called with page context
      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('Page content line 1'),
        })
      )
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

      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        body: {
          getReader: () => ({
            read: vi
              .fn()
              .mockResolvedValueOnce({
                done: false,
                value: new TextEncoder().encode(
                  'data: {"choices":[{"delta":{"content":"Response"}}]}\n\n'
                ),
              })
              .mockResolvedValueOnce({
                done: true,
                value: undefined,
              }),
          }),
        },
      })

      // Act
      const { handleAskWithPageContext } = await import(
        '../../../src/commands/context'
      )
      await handleAskWithPageContext('Test question', mockSettings)

      // Assert - Should still work without context
      expect(global.fetch).toHaveBeenCalled()
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

      expect(global.fetch).not.toHaveBeenCalled()
    })

    it('should return early if question is empty', async () => {
      // Act
      const { handleAskWithPageContext } = await import(
        '../../../src/commands/context'
      )
      await handleAskWithPageContext('', mockSettings)

      // Assert
      expect(mockGetCurrentPage).not.toHaveBeenCalled()
      expect(global.fetch).not.toHaveBeenCalled()
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

      global.fetch = vi.fn().mockRejectedValueOnce(new Error('Network error'))

      // Act
      const { handleAskWithPageContext } = await import(
        '../../../src/commands/context'
      )
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

      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        body: {
          getReader: () => ({
            read: vi
              .fn()
              .mockResolvedValueOnce({
                done: false,
                value: new TextEncoder().encode(
                  'data: {"choices":[{"delta":{"content":"Response"}}]}\n\n'
                ),
              })
              .mockResolvedValueOnce({
                done: true,
                value: undefined,
              }),
          }),
        },
      })

      // Act
      const { handleAskWithBlockContext } = await import(
        '../../../src/commands/context'
      )
      await handleAskWithBlockContext('Explain this', mockSettings)

      // Assert
      expect(mockGetCurrentBlock).toHaveBeenCalled()
      expect(mockGetBlock).toHaveBeenCalledWith('parent-block-uuid', {
        includeChildren: true,
      })

      // Verify LLM was called with block context
      const fetchCall = (global.fetch as any).mock.calls[0]
      expect(fetchCall[1].body).toContain('Parent block')
      expect(fetchCall[1].body).toContain('Child 1')
      expect(fetchCall[1].body).toContain('Child 2')
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

      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        body: {
          getReader: () => ({
            read: vi
              .fn()
              .mockResolvedValueOnce({
                done: false,
                value: new TextEncoder().encode(
                  'data: {"choices":[{"delta":{"content":"Response"}}]}\n\n'
                ),
              })
              .mockResolvedValueOnce({
                done: true,
                value: undefined,
              }),
          }),
        },
      })

      // Act
      const { handleAskWithBlockContext } = await import(
        '../../../src/commands/context'
      )
      await handleAskWithBlockContext('What is this?', mockSettings)

      // Assert
      expect(mockGetBlock).toHaveBeenCalled()
      expect(global.fetch).toHaveBeenCalled()
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

      expect(global.fetch).not.toHaveBeenCalled()
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
      expect(global.fetch).not.toHaveBeenCalled()
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

      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content: 'Complete response',
              },
            },
          ],
        }),
      })

      // Act
      const { handleAskWithPageContext } = await import(
        '../../../src/commands/context'
      )
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

      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content: 'Complete response',
              },
            },
          ],
        }),
      })

      // Act
      const { handleAskWithBlockContext } = await import(
        '../../../src/commands/context'
      )
      await handleAskWithBlockContext('Test', nonStreamingSettings)

      // Assert
      expect(mockUpdateBlock).toHaveBeenCalledWith(
        'placeholder-uuid',
        'Complete response'
      )
    })
  })
})
