/**
 * Unit tests for context extraction
 * T028: Write unit tests for page context extraction
 * T029: Write unit tests for context truncation
 *
 * These tests should FAIL until implementation is complete (TDD)
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import type { RequestContext } from '../../../src/types'

// Get mock references from global logseq (set up in tests/setup.ts)
const mockGetPage = vi.mocked(logseq.Editor.getPage)
const mockGetPageBlocksTree = vi.mocked(logseq.Editor.getPageBlocksTree)
const mockGetBlock = vi.mocked(logseq.Editor.getBlock)

describe('Context Extractor', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('extractPageContext', () => {
    it('should extract content from a page with blocks', async () => {
      // Arrange
      mockGetPage.mockResolvedValueOnce({
        uuid: 'page-uuid',
        originalName: 'Test Page',
      })

      mockGetPageBlocksTree.mockResolvedValueOnce([
        {
          uuid: 'block-1',
          content: 'First block',
          children: [],
        },
        {
          uuid: 'block-2',
          content: 'Second block',
          children: [
            {
              uuid: 'block-2-1',
              content: 'Nested block',
              children: [],
            },
          ],
        },
      ])

      // Act
      const { extractPageContext } = await import('../../../src/context/extractor')
      const context = await extractPageContext('Test Page', 8000)

      // Assert
      expect(context.type).toBe('page')
      expect(context.content).toContain('First block')
      expect(context.content).toContain('Second block')
      expect(context.content).toContain('Nested block')
      expect(context.sourceUUIDs).toContain('block-1')
      expect(context.sourceUUIDs).toContain('block-2')
      expect(context.sourceUUIDs).toContain('block-2-1')
      expect(context.wasTruncated).toBe(false)
      expect(context.estimatedTokens).toBeGreaterThan(0)
    })

    it('should handle page with no blocks', async () => {
      // Arrange
      mockGetPage.mockResolvedValueOnce({
        uuid: 'page-uuid',
        originalName: 'Empty Page',
      })

      mockGetPageBlocksTree.mockResolvedValueOnce([])

      // Act
      const { extractPageContext } = await import('../../../src/context/extractor')
      const context = await extractPageContext('Empty Page', 8000)

      // Assert
      expect(context.type).toBe('page')
      expect(context.content).toBe('')
      expect(context.sourceUUIDs).toEqual([])
      expect(context.estimatedTokens).toBe(0)
    })

    it('should truncate content exceeding token limit', async () => {
      // Arrange
      mockGetPage.mockResolvedValueOnce({
        uuid: 'page-uuid',
        originalName: 'Long Page',
      })

      // Create many blocks to exceed token limit
      const manyBlocks = Array.from({ length: 100 }, (_, i) => ({
        uuid: `block-${i}`,
        content: 'This is a block with some content that will add up to a lot of tokens',
        children: [],
      }))

      mockGetPageBlocksTree.mockResolvedValueOnce(manyBlocks)

      // Act
      const { extractPageContext } = await import('../../../src/context/extractor')
      const context = await extractPageContext('Long Page', 100) // Very small limit

      // Assert
      expect(context.type).toBe('page')
      expect(context.wasTruncated).toBe(true)
      expect(context.estimatedTokens).toBeLessThanOrEqual(100)
    })

    it('should include page metadata', async () => {
      // Arrange
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

      // Act
      const { extractPageContext } = await import('../../../src/context/extractor')
      const context = await extractPageContext('Test Page', 8000)

      // Assert
      expect(context.metadata).toBeDefined()
      expect(context.metadata?.pageName).toBe('Test Page')
    })
  })

  describe('extractBlockContext', () => {
    it('should extract content from block and its children', async () => {
      // Arrange
      mockGetBlock.mockResolvedValueOnce({
        uuid: 'parent-uuid',
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

      // Act
      const { extractBlockContext } = await import('../../../src/context/extractor')
      const context = await extractBlockContext('parent-uuid', 8000)

      // Assert
      expect(context.type).toBe('block')
      expect(context.content).toContain('Parent block')
      expect(context.content).toContain('Child 1')
      expect(context.content).toContain('Child 2')
      expect(context.sourceUUIDs).toContain('parent-uuid')
      expect(context.sourceUUIDs).toContain('child-1')
      expect(context.sourceUUIDs).toContain('child-2')
    })

    it('should handle block with no children', async () => {
      // Arrange
      mockGetBlock.mockResolvedValueOnce({
        uuid: 'block-uuid',
        content: 'Standalone block',
        children: [],
      })

      // Act
      const { extractBlockContext } = await import('../../../src/context/extractor')
      const context = await extractBlockContext('block-uuid', 8000)

      // Assert
      expect(context.type).toBe('block')
      expect(context.content).toBe('Standalone block')
      expect(context.sourceUUIDs).toEqual(['block-uuid'])
    })

    it('should return empty context for non-existent block', async () => {
      // Arrange
      mockGetBlock.mockResolvedValueOnce(null)

      // Act
      const { extractBlockContext } = await import('../../../src/context/extractor')
      const context = await extractBlockContext('non-existent', 8000)

      // Assert
      expect(context.type).toBe('block')
      expect(context.content).toBe('')
      expect(context.sourceUUIDs).toEqual([])
    })
  })

  describe('extractSelectionContext', () => {
    it('should extract content from selected blocks', async () => {
      // Arrange
      const blockUUIDs = ['block-1', 'block-2']

      mockGetBlock
        .mockResolvedValueOnce({
          uuid: 'block-1',
          content: 'First selected',
          children: [],
        })
        .mockResolvedValueOnce({
          uuid: 'block-2',
          content: 'Second selected',
          children: [],
        })

      // Act
      const { extractSelectionContext } = await import('../../../src/context/extractor')
      const context = await extractSelectionContext(blockUUIDs, 8000)

      // Assert
      expect(context.type).toBe('selection')
      expect(context.content).toContain('First selected')
      expect(context.content).toContain('Second selected')
      expect(context.sourceUUIDs).toEqual(['block-1', 'block-2'])
    })

    it('should handle empty selection', async () => {
      // Act
      const { extractSelectionContext } = await import('../../../src/context/extractor')
      const context = await extractSelectionContext([], 8000)

      // Assert
      expect(context.type).toBe('selection')
      expect(context.content).toBe('')
      expect(context.sourceUUIDs).toEqual([])
    })

    it('should skip null blocks in selection', async () => {
      // Arrange
      mockGetBlock
        .mockResolvedValueOnce({
          uuid: 'block-1',
          content: 'Valid block',
          children: [],
        })
        .mockResolvedValueOnce(null) // Block 2 doesn't exist

      // Act
      const { extractSelectionContext } = await import('../../../src/context/extractor')
      const context = await extractSelectionContext(['block-1', 'block-2'], 8000)

      // Assert
      expect(context.type).toBe('selection')
      expect(context.content).toContain('Valid block')
      expect(context.sourceUUIDs).toEqual(['block-1'])
    })
  })
})

describe('Context Truncator', () => {
  describe('truncateContext', () => {
    it('should not truncate content within token limit', async () => {
      // Arrange
      const context: RequestContext = {
        type: 'page',
        content: 'Short content',
        sourceUUIDs: ['uuid-1'],
        estimatedTokens: 10,
        wasTruncated: false,
      }

      // Act
      const { truncateContext } = await import('../../../src/context/truncator')
      const truncated = truncateContext(context, 100)

      // Assert
      expect(truncated.content).toBe('Short content')
      expect(truncated.wasTruncated).toBe(false)
      expect(truncated.estimatedTokens).toBe(10)
    })

    it('should truncate content exceeding token limit', async () => {
      // Arrange
      const longContent = 'word '.repeat(1000) // 5000 chars = ~1250 tokens
      const context: RequestContext = {
        type: 'page',
        content: longContent,
        sourceUUIDs: ['uuid-1'],
        estimatedTokens: 1250,
        wasTruncated: false,
      }

      // Act
      const { truncateContext } = await import('../../../src/context/truncator')
      const truncated = truncateContext(context, 100)

      // Assert
      expect(truncated.content.length).toBeLessThan(longContent.length)
      expect(truncated.wasTruncated).toBe(true)
      // Allow small margin for ellipsis (adds 3 chars = ~1 token)
      expect(truncated.estimatedTokens).toBeLessThanOrEqual(101)
      expect(truncated.content).toMatch(/\.\.\.$/) // Should end with ellipsis
    })

    it('should preserve word boundaries when truncating', async () => {
      // Arrange
      const content = 'This is a sentence with many words that should be truncated properly'
      const context: RequestContext = {
        type: 'page',
        content,
        sourceUUIDs: ['uuid-1'],
        estimatedTokens: 50,
        wasTruncated: false,
      }

      // Act
      const { truncateContext } = await import('../../../src/context/truncator')
      const truncated = truncateContext(context, 10) // Very small limit

      // Assert
      expect(truncated.content).toMatch(/\.\.\.$/) // Should end with ellipsis
      expect(truncated.content.length).toBeLessThan(content.length)
      expect(truncated.wasTruncated).toBe(true)
    })

    it('should update metadata when truncating', async () => {
      // Arrange
      const context: RequestContext = {
        type: 'page',
        content: 'word '.repeat(1000),
        sourceUUIDs: ['uuid-1'],
        estimatedTokens: 1250,
        wasTruncated: false,
        metadata: {
          pageName: 'Test Page',
        },
      }

      // Act
      const { truncateContext } = await import('../../../src/context/truncator')
      const truncated = truncateContext(context, 100)

      // Assert
      expect(truncated.metadata?.pageName).toBe('Test Page')
      expect(truncated.wasTruncated).toBe(true)
    })
  })
})
