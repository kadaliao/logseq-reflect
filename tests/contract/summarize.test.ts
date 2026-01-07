/**
 * Contract tests for summarization commands
 * T063: Write contract test for summarization prompt template
 *
 * These tests verify the contract for summarization prompt templates and behavior
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'

// Get mock references
const mockGetCurrentPage = vi.mocked(logseq.Editor.getCurrentPage)
const mockGetPage = vi.mocked(logseq.Editor.getPage)
const mockGetPageBlocksTree = vi.mocked(logseq.Editor.getPageBlocksTree)
const mockGetBlock = vi.mocked(logseq.Editor.getBlock)
const mockGetCurrentBlock = vi.mocked(logseq.Editor.getCurrentBlock)
const mockInsertBlock = vi.mocked(logseq.Editor.insertBlock)
const mockUpdateBlock = vi.mocked(logseq.Editor.updateBlock)

describe('Summarization Command Contracts', () => {
  beforeEach(() => {
    vi.clearAllMocks()
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
                  'data: {"choices":[{"delta":{"content":"Summary of the page content."}}]}\n\n'
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
      const { handleSummarizePage } = await import('../../src/commands/summarize')
      await handleSummarizePage()

      // Assert - Verify system prompt instructs summarization
      expect(global.fetch).toHaveBeenCalled()
      const fetchCall = (global.fetch as any).mock.calls[0]
      const requestBody = JSON.parse(fetchCall[1].body)

      // CONTRACT: System message must instruct for summary generation
      const systemMessage = requestBody.messages.find((m: any) => m.role === 'system')
      expect(systemMessage).toBeDefined()
      expect(systemMessage.content.toLowerCase()).toContain('summarize')

      // CONTRACT: Page content must be included as context
      const contentMessages = requestBody.messages.filter((m: any) => m.role === 'user')
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

      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        body: {
          getReader: () => ({
            read: vi
              .fn()
              .mockResolvedValueOnce({
                done: false,
                value: new TextEncoder().encode(
                  'data: {"choices":[{"delta":{"content":"Summary of block tree."}}]}\n\n'
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
      const { handleSummarizeBlock } = await import('../../src/commands/summarize')
      await handleSummarizeBlock()

      // Assert
      expect(global.fetch).toHaveBeenCalled()
      const fetchCall = (global.fetch as any).mock.calls[0]
      const requestBody = JSON.parse(fetchCall[1].body)

      // CONTRACT: System message must instruct for summary
      const systemMessage = requestBody.messages.find((m: any) => m.role === 'system')
      expect(systemMessage.content.toLowerCase()).toContain('summar')

      // CONTRACT: Block tree content must be included
      const contentMessages = requestBody.messages.filter((m: any) => m.role === 'user')
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
                  'data: {"choices":[{"delta":{"content":"Concise summary."}}]}\n\n'
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
      const { handleSummarizePage } = await import('../../src/commands/summarize')
      await handleSummarizePage()

      // Assert - Prompt should request conciseness
      const fetchCall = (global.fetch as any).mock.calls[0]
      const requestBody = JSON.parse(fetchCall[1].body)
      const systemMessage = requestBody.messages.find((m: any) => m.role === 'system')

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

      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        body: {
          getReader: () => ({
            read: vi
              .fn()
              .mockResolvedValueOnce({
                done: false,
                value: new TextEncoder().encode(
                  'data: {"choices":[{"delta":{"content":"Summary of single block."}}]}\n\n'
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
      const { handleSummarizeBlock } = await import('../../src/commands/summarize')
      await handleSummarizeBlock()

      // Assert - Should still work with single block
      expect(global.fetch).toHaveBeenCalled()
    })
  })

  describe('CONTRACT: Streaming Behavior', () => {
    it('should stream summary incrementally to user', async () => {
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
          content: 'Content',
          children: [],
        },
      ])

      mockInsertBlock.mockResolvedValueOnce({
        uuid: 'placeholder-uuid',
        content: 'Loading...',
      })

      // Mock streaming response with multiple chunks
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        body: {
          getReader: () => ({
            read: vi
              .fn()
              .mockResolvedValueOnce({
                done: false,
                value: new TextEncoder().encode(
                  'data: {"choices":[{"delta":{"content":"The page discusses "}}]}\n\n'
                ),
              })
              .mockResolvedValueOnce({
                done: false,
                value: new TextEncoder().encode(
                  'data: {"choices":[{"delta":{"content":"several key points "}}]}\n\n'
                ),
              })
              .mockResolvedValueOnce({
                done: false,
                value: new TextEncoder().encode(
                  'data: {"choices":[{"delta":{"content":"about the topic."}}]}\n\n'
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
      const { handleSummarizePage } = await import('../../src/commands/summarize')
      await handleSummarizePage()

      // Assert - Block should be updated multiple times (streaming)
      expect(mockUpdateBlock).toHaveBeenCalled()
      // At least one update should occur per chunk
      expect(mockUpdateBlock.mock.calls.length).toBeGreaterThan(1)
    })
  })
})
