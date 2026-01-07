/**
 * Contract tests for context extraction
 * T052: Write contract test for page context extraction
 *
 * These tests verify the contract between the context extractor and Logseq API
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import type { RequestContext } from '../../src/types'

// Get mock references from global logseq (set up in tests/setup.ts)
const mockGetPage = vi.mocked(logseq.Editor.getPage)
const mockGetPageBlocksTree = vi.mocked(logseq.Editor.getPageBlocksTree)
const mockGetBlock = vi.mocked(logseq.Editor.getBlock)

describe('Context Extraction Contract', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Page Context Extraction Contract', () => {
    it('CONTRACT: should extract hierarchical page structure', async () => {
      // Arrange - Define the contract structure
      mockGetPage.mockResolvedValueOnce({
        uuid: 'page-uuid-123',
        originalName: 'Project Planning',
      })

      mockGetPageBlocksTree.mockResolvedValueOnce([
        {
          uuid: 'block-1',
          content: '# Project Goals',
          children: [
            {
              uuid: 'block-1-1',
              content: 'Goal 1: Complete feature implementation',
              children: [],
            },
            {
              uuid: 'block-1-2',
              content: 'Goal 2: Write comprehensive tests',
              children: [],
            },
          ],
        },
        {
          uuid: 'block-2',
          content: '# Timeline',
          children: [
            {
              uuid: 'block-2-1',
              content: 'Week 1: Setup',
              children: [
                {
                  uuid: 'block-2-1-1',
                  content: 'Install dependencies',
                  children: [],
                },
              ],
            },
          ],
        },
      ])

      // Act
      const { extractPageContext } = await import('../../src/context/extractor')
      const context = await extractPageContext('Project Planning', 8000)

      // Assert - Verify contract guarantees
      expect(context).toBeDefined()
      expect(context.type).toBe('page')

      // Contract: content must preserve hierarchy with indentation
      expect(context.content).toContain('# Project Goals')
      expect(context.content).toContain('  Goal 1: Complete feature implementation')
      expect(context.content).toContain('  Goal 2: Write comprehensive tests')
      expect(context.content).toContain('# Timeline')
      expect(context.content).toContain('  Week 1: Setup')
      expect(context.content).toContain('    Install dependencies')

      // Contract: sourceUUIDs must include all blocks
      expect(context.sourceUUIDs).toHaveLength(6)
      expect(context.sourceUUIDs).toContain('block-1')
      expect(context.sourceUUIDs).toContain('block-1-1')
      expect(context.sourceUUIDs).toContain('block-1-2')
      expect(context.sourceUUIDs).toContain('block-2')
      expect(context.sourceUUIDs).toContain('block-2-1')
      expect(context.sourceUUIDs).toContain('block-2-1-1')

      // Contract: estimatedTokens must be positive and reasonable
      expect(context.estimatedTokens).toBeGreaterThan(0)
      expect(context.estimatedTokens).toBeLessThan(8000)

      // Contract: wasTruncated must be false when content fits
      expect(context.wasTruncated).toBe(false)

      // Contract: metadata must include page information
      expect(context.metadata).toBeDefined()
      expect(context.metadata?.pageName).toBe('Project Planning')
    })

    it('CONTRACT: should handle empty pages gracefully', async () => {
      // Arrange
      mockGetPage.mockResolvedValueOnce({
        uuid: 'empty-page-uuid',
        originalName: 'Empty Page',
      })

      mockGetPageBlocksTree.mockResolvedValueOnce([])

      // Act
      const { extractPageContext } = await import('../../src/context/extractor')
      const context = await extractPageContext('Empty Page', 8000)

      // Assert - Verify contract for empty pages
      expect(context.type).toBe('page')
      expect(context.content).toBe('')
      expect(context.sourceUUIDs).toEqual([])
      expect(context.estimatedTokens).toBe(0)
      expect(context.wasTruncated).toBe(false)
      expect(context.metadata?.pageName).toBe('Empty Page')
    })

    it('CONTRACT: should handle non-existent pages gracefully', async () => {
      // Arrange
      mockGetPage.mockResolvedValueOnce(null)

      // Act
      const { extractPageContext } = await import('../../src/context/extractor')
      const context = await extractPageContext('Non-Existent Page', 8000)

      // Assert - Verify contract for missing pages
      expect(context.type).toBe('page')
      expect(context.content).toBe('')
      expect(context.sourceUUIDs).toEqual([])
      expect(context.estimatedTokens).toBe(0)
    })

    it('CONTRACT: should truncate when exceeding max tokens', async () => {
      // Arrange
      mockGetPage.mockResolvedValueOnce({
        uuid: 'large-page-uuid',
        originalName: 'Large Document',
      })

      // Create 200 blocks to definitely exceed the limit
      const largeBlockTree = Array.from({ length: 200 }, (_, i) => ({
        uuid: `block-${i}`,
        content: `This is block ${i} with some content that will accumulate to many tokens`,
        children: [],
      }))

      mockGetPageBlocksTree.mockResolvedValueOnce(largeBlockTree)

      // Act
      const { extractPageContext } = await import('../../src/context/extractor')
      const context = await extractPageContext('Large Document', 100) // Small limit

      // Assert - Verify contract for truncation
      expect(context.type).toBe('page')
      expect(context.wasTruncated).toBe(true)
      expect(context.estimatedTokens).toBeLessThanOrEqual(100)
      expect(context.content.length).toBeLessThan(
        largeBlockTree.map((b) => b.content).join('\n').length
      )
    })
  })

  describe('Block Context Extraction Contract', () => {
    it('CONTRACT: should extract block with nested children', async () => {
      // Arrange
      mockGetBlock.mockResolvedValueOnce({
        uuid: 'parent-block',
        content: 'Parent: Project Tasks',
        children: [
          {
            uuid: 'child-1',
            content: 'Task 1: Design',
            children: [
              {
                uuid: 'child-1-1',
                content: 'Subtask: Create mockups',
                children: [],
              },
            ],
          },
          {
            uuid: 'child-2',
            content: 'Task 2: Implementation',
            children: [],
          },
        ],
      })

      // Act
      const { extractBlockContext } = await import('../../src/context/extractor')
      const context = await extractBlockContext('parent-block', 8000)

      // Assert - Verify contract
      expect(context.type).toBe('block')

      // Contract: content must preserve hierarchy
      expect(context.content).toContain('Parent: Project Tasks')
      expect(context.content).toContain('  Task 1: Design')
      expect(context.content).toContain('    Subtask: Create mockups')
      expect(context.content).toContain('  Task 2: Implementation')

      // Contract: all nested blocks must be included
      expect(context.sourceUUIDs).toEqual([
        'parent-block',
        'child-1',
        'child-1-1',
        'child-2',
      ])

      expect(context.estimatedTokens).toBeGreaterThan(0)
      expect(context.wasTruncated).toBe(false)
    })

    it('CONTRACT: should handle standalone block without children', async () => {
      // Arrange
      mockGetBlock.mockResolvedValueOnce({
        uuid: 'solo-block',
        content: 'A standalone block with no children',
        children: [],
      })

      // Act
      const { extractBlockContext } = await import('../../src/context/extractor')
      const context = await extractBlockContext('solo-block', 8000)

      // Assert
      expect(context.type).toBe('block')
      expect(context.content).toBe('A standalone block with no children')
      expect(context.sourceUUIDs).toEqual(['solo-block'])
    })

    it('CONTRACT: should return empty context for non-existent block', async () => {
      // Arrange
      mockGetBlock.mockResolvedValueOnce(null)

      // Act
      const { extractBlockContext } = await import('../../src/context/extractor')
      const context = await extractBlockContext('non-existent-block', 8000)

      // Assert
      expect(context.type).toBe('block')
      expect(context.content).toBe('')
      expect(context.sourceUUIDs).toEqual([])
      expect(context.estimatedTokens).toBe(0)
    })
  })

  describe('Selection Context Extraction Contract', () => {
    it('CONTRACT: should extract multiple selected blocks', async () => {
      // Arrange
      const selectedUUIDs = ['block-a', 'block-b', 'block-c']

      mockGetBlock
        .mockResolvedValueOnce({
          uuid: 'block-a',
          content: 'First selected block',
          children: [],
        })
        .mockResolvedValueOnce({
          uuid: 'block-b',
          content: 'Second selected block',
          children: [],
        })
        .mockResolvedValueOnce({
          uuid: 'block-c',
          content: 'Third selected block',
          children: [],
        })

      // Act
      const { extractSelectionContext } = await import('../../src/context/extractor')
      const context = await extractSelectionContext(selectedUUIDs, 8000)

      // Assert - Verify contract
      expect(context.type).toBe('selection')
      expect(context.content).toContain('First selected block')
      expect(context.content).toContain('Second selected block')
      expect(context.content).toContain('Third selected block')
      expect(context.sourceUUIDs).toEqual(['block-a', 'block-b', 'block-c'])
    })

    it('CONTRACT: should handle empty selection', async () => {
      // Act
      const { extractSelectionContext } = await import('../../src/context/extractor')
      const context = await extractSelectionContext([], 8000)

      // Assert
      expect(context.type).toBe('selection')
      expect(context.content).toBe('')
      expect(context.sourceUUIDs).toEqual([])
      expect(context.estimatedTokens).toBe(0)
    })

    it('CONTRACT: should skip null blocks in selection', async () => {
      // Arrange
      mockGetBlock
        .mockResolvedValueOnce({
          uuid: 'valid-1',
          content: 'Valid block 1',
          children: [],
        })
        .mockResolvedValueOnce(null) // This block doesn't exist
        .mockResolvedValueOnce({
          uuid: 'valid-2',
          content: 'Valid block 2',
          children: [],
        })

      // Act
      const { extractSelectionContext } = await import('../../src/context/extractor')
      const context = await extractSelectionContext(
        ['valid-1', 'invalid', 'valid-2'],
        8000
      )

      // Assert - Contract: invalid blocks should be skipped
      expect(context.type).toBe('selection')
      expect(context.content).toContain('Valid block 1')
      expect(context.content).toContain('Valid block 2')
      expect(context.sourceUUIDs).toEqual(['valid-1', 'valid-2'])
    })
  })

  describe('Context Truncation Contract', () => {
    it('CONTRACT: truncation must preserve structure and add indicators', async () => {
      // Arrange
      const longContent = 'This is a sentence. '.repeat(500) // ~2500 chars
      const context: RequestContext = {
        type: 'page',
        content: longContent,
        sourceUUIDs: ['uuid-1'],
        estimatedTokens: 625, // ~2500 chars / 4
        wasTruncated: false,
      }

      // Act
      const { truncateContext } = await import('../../src/context/truncator')
      const truncated = truncateContext(context, 100) // Limit to 100 tokens

      // Assert - Verify truncation contract
      expect(truncated.wasTruncated).toBe(true)
      // Allow small margin for ellipsis (adds a few chars = ~1-2 tokens)
      expect(truncated.estimatedTokens).toBeLessThanOrEqual(102)
      expect(truncated.content.length).toBeLessThan(longContent.length)

      // Contract: truncated content should indicate omission
      expect(truncated.content).toMatch(/\.\.\./)
    })

    it('CONTRACT: no truncation when within limits', async () => {
      // Arrange
      const shortContent = 'Short text'
      const context: RequestContext = {
        type: 'page',
        content: shortContent,
        sourceUUIDs: ['uuid-1'],
        estimatedTokens: 3,
        wasTruncated: false,
      }

      // Act
      const { truncateContext } = await import('../../src/context/truncator')
      const truncated = truncateContext(context, 100)

      // Assert
      expect(truncated.wasTruncated).toBe(false)
      expect(truncated.content).toBe(shortContent)
      expect(truncated.estimatedTokens).toBe(3)
    })
  })
})
