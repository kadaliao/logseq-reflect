/**
 * Integration tests for streaming summarization
 * T064: Write integration test for streaming summary updates
 *
 * These tests verify streaming behavior works end-to-end
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'

// Get mock references
const mockGetCurrentPage = vi.mocked(logseq.Editor.getCurrentPage)
const mockGetPage = vi.mocked(logseq.Editor.getPage)
const mockGetPageBlocksTree = vi.mocked(logseq.Editor.getPageBlocksTree)
const mockGetCurrentBlock = vi.mocked(logseq.Editor.getCurrentBlock)
const mockGetBlock = vi.mocked(logseq.Editor.getBlock)
const mockInsertBlock = vi.mocked(logseq.Editor.insertBlock)
const mockUpdateBlock = vi.mocked(logseq.Editor.updateBlock)

describe('Streaming Summarization Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Page Summarization Streaming', () => {
    it('INTEGRATION: should stream summary updates incrementally', async () => {
      // Arrange - Set up streaming scenario
      mockGetCurrentPage.mockResolvedValueOnce({
        uuid: 'page-uuid',
        name: 'Article Page',
        originalName: 'Article Page',
      })

      mockGetPage.mockResolvedValueOnce({
        uuid: 'page-uuid',
        name: 'Article Page',
        originalName: 'Article Page',
      })

      mockGetPageBlocksTree.mockResolvedValueOnce([
        {
          uuid: 'block-1',
          content: '# Introduction',
          children: [
            {
              uuid: 'block-1-1',
              content: 'This article discusses the importance of testing.',
              children: [],
            },
          ],
        },
        {
          uuid: 'block-2',
          content: '# Main Points',
          children: [
            {
              uuid: 'block-2-1',
              content: 'Point 1: Testing ensures quality.',
              children: [],
            },
            {
              uuid: 'block-2-2',
              content: 'Point 2: Testing catches bugs early.',
              children: [],
            },
          ],
        },
        {
          uuid: 'block-3',
          content: '# Conclusion',
          children: [
            {
              uuid: 'block-3-1',
              content: 'Testing is essential for software development.',
              children: [],
            },
          ],
        },
      ])

      mockInsertBlock.mockResolvedValueOnce({
        uuid: 'summary-block-uuid',
        content: 'Loading...',
      })

      // Mock streaming response with multiple chunks
      const chunks = [
        'This article ',
        'highlights ',
        'the critical ',
        'importance ',
        'of testing ',
        'in software development, ',
        'emphasizing ',
        'quality assurance ',
        'and early bug detection.',
      ]

      let chunkIndex = 0
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        body: {
          getReader: () => ({
            read: vi.fn().mockImplementation(async () => {
              if (chunkIndex < chunks.length) {
                const chunk = chunks[chunkIndex++]
                return {
                  done: false,
                  value: new TextEncoder().encode(
                    `data: {"choices":[{"delta":{"content":"${chunk}"}}]}\n\n`
                  ),
                }
              }
              return { done: true, value: undefined }
            }),
          }),
        },
      })

      // Act
      const { handleSummarizePage } = await import('../../src/commands/summarize')
      await handleSummarizePage()

      // Assert - Verify streaming behavior
      // 1. Placeholder was created
      expect(mockInsertBlock).toHaveBeenCalled()

      // 2. Block was updated multiple times (streaming)
      expect(mockUpdateBlock.mock.calls.length).toBeGreaterThanOrEqual(chunks.length)

      // 3. Final content contains accumulated chunks
      const lastUpdate = mockUpdateBlock.mock.calls[mockUpdateBlock.mock.calls.length - 1]
      expect(lastUpdate[1]).toContain('This article')
      expect(lastUpdate[1]).toContain('software development')
    })

    it('INTEGRATION: should update block content progressively', async () => {
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
          uuid: 'content-block',
          content: 'Some content to summarize',
          children: [],
        },
      ])

      mockInsertBlock.mockResolvedValueOnce({
        uuid: 'summary-uuid',
        content: 'Loading...',
      })

      // Track accumulated content
      const updates: string[] = []

      mockUpdateBlock.mockImplementation(async (uuid, content) => {
        updates.push(content)
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
                  'data: {"choices":[{"delta":{"content":"First "}}]}\n\n'
                ),
              })
              .mockResolvedValueOnce({
                done: false,
                value: new TextEncoder().encode(
                  'data: {"choices":[{"delta":{"content":"second "}}]}\n\n'
                ),
              })
              .mockResolvedValueOnce({
                done: false,
                value: new TextEncoder().encode(
                  'data: {"choices":[{"delta":{"content":"third."}}]}\n\n'
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

      // Assert - Content accumulates progressively
      expect(updates.length).toBeGreaterThan(0)

      // Each update should be longer than the previous (accumulating)
      for (let i = 1; i < Math.min(updates.length, 3); i++) {
        expect(updates[i].length).toBeGreaterThanOrEqual(updates[i - 1].length)
      }

      // Final content should have all chunks
      const finalContent = updates[updates.length - 1]
      expect(finalContent).toBe('First second third.')
    })
  })

  describe('Block Summarization Streaming', () => {
    it('INTEGRATION: should stream block summary updates', async () => {
      // Arrange
      mockGetCurrentBlock.mockResolvedValueOnce({
        uuid: 'block-uuid',
        content: 'Parent block',
      })

      mockGetBlock.mockResolvedValueOnce({
        uuid: 'block-uuid',
        content: '# Project Overview',
        children: [
          {
            uuid: 'child-1',
            content: 'This project aims to improve user experience.',
            children: [],
          },
          {
            uuid: 'child-2',
            content: 'We focus on performance and accessibility.',
            children: [],
          },
        ],
      })

      mockInsertBlock.mockResolvedValueOnce({
        uuid: 'summary-uuid',
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
                  'data: {"choices":[{"delta":{"content":"Project focuses on "}}]}\n\n'
                ),
              })
              .mockResolvedValueOnce({
                done: false,
                value: new TextEncoder().encode(
                  'data: {"choices":[{"delta":{"content":"UX improvement."}}]}\n\n'
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
      expect(mockUpdateBlock.mock.calls.length).toBeGreaterThan(1)
      const finalUpdate = mockUpdateBlock.mock.calls[mockUpdateBlock.mock.calls.length - 1]
      expect(finalUpdate[1]).toContain('Project focuses on')
      expect(finalUpdate[1]).toContain('UX improvement')
    })
  })

  describe('Error Handling During Streaming', () => {
    it('INTEGRATION: should handle streaming errors gracefully', async () => {
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
        uuid: 'summary-uuid',
        content: 'Loading...',
      })

      // Mock streaming that errors midway
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        body: {
          getReader: () => ({
            read: vi
              .fn()
              .mockResolvedValueOnce({
                done: false,
                value: new TextEncoder().encode(
                  'data: {"choices":[{"delta":{"content":"Start of summary"}}]}\n\n'
                ),
              })
              .mockRejectedValueOnce(new Error('Network interrupted')),
          }),
        },
      })

      // Act
      const { handleSummarizePage } = await import('../../src/commands/summarize')
      await handleSummarizePage()

      // Assert - Error should be displayed
      expect(mockUpdateBlock).toHaveBeenCalledWith(
        'summary-uuid',
        expect.stringContaining('Error')
      )
    })

    it('INTEGRATION: should handle LLM request failure', async () => {
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
        uuid: 'summary-uuid',
        content: 'Loading...',
      })

      // Mock LLM request failure
      global.fetch = vi.fn().mockRejectedValueOnce(new Error('Connection timeout'))

      // Act
      const { handleSummarizePage } = await import('../../src/commands/summarize')
      await handleSummarizePage()

      // Assert - Should show error message
      expect(mockUpdateBlock).toHaveBeenCalledWith(
        'summary-uuid',
        expect.stringContaining('Error')
      )
    })
  })
})
