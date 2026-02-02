/**
 * Integration test for block creation and update
 * T038: Write integration test for block creation and update
 *
 * Purpose: Verify that blocks are created and updated correctly during
 * AI response streaming, including placeholder creation, incremental updates,
 * and completion markers
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import type { ResponseHandler } from '../../src/types'

// Import after mocking
const {
  createResponseHandler,
  updateWithChunk,
  markCompleted,
  markFailed,
} = await import('../../src/llm/response-handler')

// Get mock references from global logseq (set up in tests/setup.ts)
const mockInsertBlock = vi.mocked(logseq.Editor.insertBlock)
const mockUpdateBlock = vi.mocked(logseq.Editor.updateBlock)
const mockGetCurrentPage = vi.mocked(logseq.Editor.getCurrentPage)
const mockGetPageBlocksTree = vi.mocked(logseq.Editor.getPageBlocksTree)
const mockAppendBlockInPage = vi.mocked(logseq.Editor.appendBlockInPage)

describe('Block Creation and Update Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    // Default mock behaviors
    mockInsertBlock.mockResolvedValue({ uuid: 'new-block-uuid' })
    mockUpdateBlock.mockResolvedValue(null)
    mockGetCurrentPage.mockResolvedValue({ uuid: 'current-page-uuid' })
    mockGetPageBlocksTree.mockResolvedValue([])
    mockAppendBlockInPage.mockResolvedValue({ uuid: 'new-block-uuid' })
  })

  describe('Block Creation', () => {
    it('should create placeholder block with loading indicator', async () => {
      // Arrange
      const parentUUID = 'parent-block-123'

      // Act
      const { handler } = await createResponseHandler(parentUUID)

      // Assert
      expect(mockInsertBlock).toHaveBeenCalledWith(
        parentUUID,
        expect.stringContaining('⏳'),
        expect.objectContaining({ sibling: false })
      )
      expect(handler.placeholderUUID).toBe('new-block-uuid')
      expect(handler.status).toBe('pending')
    })

    it('should create block as child of parent block', async () => {
      // Arrange
      const parentUUID = 'parent-123'

      // Act
      await createResponseHandler(parentUUID)

      // Assert
      expect(mockInsertBlock).toHaveBeenCalledWith(
        parentUUID,
        expect.any(String),
        expect.objectContaining({ sibling: false })
      )
    })

    it('should create block at page end when no parent provided', async () => {
      // Arrange
      mockGetCurrentPage.mockResolvedValue({ uuid: 'page-uuid', name: 'Test Page' } as any)

      // Act
      await createResponseHandler()

      // Assert - should append to current page
      expect(mockGetCurrentPage).toHaveBeenCalled()
      expect(mockAppendBlockInPage).toHaveBeenCalledWith(
        'Test Page',
        expect.stringContaining('⏳')
      )
    })

    it('should create block at page start when page is empty', async () => {
      // Arrange
      mockGetCurrentPage.mockResolvedValue({ uuid: 'page-uuid', name: 'Empty Page' } as any)

      // Act
      await createResponseHandler()

      // Assert - should append to current page even when empty
      expect(mockGetCurrentPage).toHaveBeenCalled()
      expect(mockAppendBlockInPage).toHaveBeenCalledWith(
        'Empty Page',
        expect.stringContaining('⏳')
      )
    })

    it('should generate unique request ID for each handler', async () => {
      // Act
      const { handler: handler1 } = await createResponseHandler()
      const { handler: handler2 } = await createResponseHandler()

      // Assert
      expect(handler1.requestID).not.toBe(handler2.requestID)
      expect(handler1.requestID).toMatch(/^req-\d+-[a-z0-9]+$/)
    })
  })

  describe('Streaming Updates', () => {
    let handler: ResponseHandler

    beforeEach(async () => {
      const result = await createResponseHandler('parent-uuid')
      handler = result.handler
    })

    it('should accumulate content from streaming chunks', async () => {
      // Arrange
      const chunks = [
        { choices: [{ delta: { content: 'Hello' } }] },
        { choices: [{ delta: { content: ' world' } }] },
        { choices: [{ delta: { content: '!' } }] },
      ]

      // Act
      for (const chunk of chunks) {
        await updateWithChunk(handler, chunk)
      }

      // Assert
      expect(handler.accumulatedContent).toBe('Hello world!')
    })

    it('should update block with accumulated content after each chunk', async () => {
      // Arrange
      const chunks = [
        { choices: [{ delta: { content: 'First ' } }] },
        { choices: [{ delta: { content: 'second ' } }] },
        { choices: [{ delta: { content: 'third' } }] },
      ]

      // Act
      for (const chunk of chunks) {
        await updateWithChunk(handler, chunk)
      }

      // Assert - verify progressive updates
      expect(mockUpdateBlock).toHaveBeenNthCalledWith(
        1,
        'new-block-uuid',
        'First '
      )
      expect(mockUpdateBlock).toHaveBeenNthCalledWith(
        2,
        'new-block-uuid',
        'First second '
      )
      expect(mockUpdateBlock).toHaveBeenNthCalledWith(
        3,
        'new-block-uuid',
        'First second third'
      )
    })

    it('should handle empty deltas gracefully', async () => {
      // Arrange
      const chunks = [
        { choices: [{ delta: { content: 'Start' } }] },
        { choices: [{ delta: {} }] }, // No content
        { choices: [{ delta: { content: '' } }] }, // Empty content
        { choices: [{ delta: { content: ' end' } }] },
      ]

      // Act
      for (const chunk of chunks) {
        await updateWithChunk(handler, chunk)
      }

      // Assert
      expect(handler.accumulatedContent).toBe('Start end')
    })

    it('should handle chunks without choices array', async () => {
      // Arrange
      const malformedChunk = {} as any

      // Act
      await updateWithChunk(handler, malformedChunk)

      // Assert - should not throw, content should remain unchanged
      expect(handler.accumulatedContent).toBe('')
    })

    it('should change status to streaming during updates', async () => {
      // Arrange
      const chunk = { choices: [{ delta: { content: 'Test' } }] }

      // Act
      await updateWithChunk(handler, chunk)

      // Assert
      expect(handler.status).toBe('streaming')
    })
  })

  describe('Block Completion', () => {
    let handler: ResponseHandler

    beforeEach(async () => {
      const result = await createResponseHandler('parent-uuid')
      handler = result.handler
      handler.accumulatedContent = 'Final response content'
    })

    it('should mark block as completed with checkmark', async () => {
      // Act
      await markCompleted(handler)

      // Assert
      expect(handler.status).toBe('completed')
      expect(mockUpdateBlock).toHaveBeenCalledWith(
        'new-block-uuid',
        expect.stringContaining('Final response content')
      )
    })

    it('should update handler completion time', async () => {
      // Arrange
      const startTime = handler.startTime

      // Act
      await markCompleted(handler)

      // Assert
      expect(handler.completionTime).toBeDefined()
      expect(handler.completionTime! >= startTime).toBe(true)
    })

    it('should preserve content when marking complete', async () => {
      // Arrange
      const originalContent = handler.accumulatedContent

      // Act
      await markCompleted(handler)

      // Assert
      expect(handler.accumulatedContent).toBe(originalContent)
    })
  })

  describe('Block Failure', () => {
    let handler: ResponseHandler

    beforeEach(async () => {
      const result = await createResponseHandler('parent-uuid')
      handler = result.handler
    })

    it('should mark block as failed with error message', async () => {
      // Arrange
      const error = new Error('API request failed')

      // Act
      await markFailed(handler, error)

      // Assert
      expect(handler.status).toBe('failed')
      expect(handler.errorMessage).toBe('API request failed')
      expect(mockUpdateBlock).toHaveBeenCalledWith(
        'new-block-uuid',
        expect.stringContaining('Error')
      )
    })

    it('should update block with error indicator', async () => {
      // Arrange
      const error = new Error('Network timeout')

      // Act
      await markFailed(handler, error)

      // Assert
      expect(mockUpdateBlock).toHaveBeenCalledWith(
        'new-block-uuid',
        expect.stringContaining('**Error**')
      )
      expect(mockUpdateBlock).toHaveBeenCalledWith(
        'new-block-uuid',
        expect.stringContaining('Network timeout')
      )
    })

    it('should preserve partial content on failure', async () => {
      // Arrange
      handler.accumulatedContent = 'Partial response before error'
      const error = new Error('Stream interrupted')

      // Act
      await markFailed(handler, error)

      // Assert
      expect(handler.accumulatedContent).toBe('Partial response before error')
    })

    it('should set completion time on failure', async () => {
      // Arrange
      const error = new Error('Test error')

      // Act
      await markFailed(handler, error)

      // Assert
      expect(handler.completionTime).toBeDefined()
    })
  })

  describe('Concurrent Block Updates', () => {
    it('should handle multiple concurrent handlers', async () => {
      // Arrange
      const { handler: handler1 } = await createResponseHandler('parent-1')
      const { handler: handler2 } = await createResponseHandler('parent-2')

      mockInsertBlock
        .mockResolvedValueOnce({ uuid: 'block-1' })
        .mockResolvedValueOnce({ uuid: 'block-2' })

      // Act - update both handlers
      await updateWithChunk(handler1, {
        choices: [{ delta: { content: 'Handler 1' } }],
      })
      await updateWithChunk(handler2, {
        choices: [{ delta: { content: 'Handler 2' } }],
      })

      // Assert - each handler should maintain separate state
      expect(handler1.accumulatedContent).toBe('Handler 1')
      expect(handler2.accumulatedContent).toBe('Handler 2')
    })

    it('should support parallel streaming to different blocks', async () => {
      // Arrange
      mockInsertBlock
        .mockResolvedValueOnce({ uuid: 'block-a' })
        .mockResolvedValueOnce({ uuid: 'block-b' })

      const { handler: handler1 } = await createResponseHandler('parent-a')
      const { handler: handler2 } = await createResponseHandler('parent-b')

      // Act - simulate concurrent streaming
      await Promise.all([
        updateWithChunk(handler1, { choices: [{ delta: { content: 'A1' } }] }),
        updateWithChunk(handler2, { choices: [{ delta: { content: 'B1' } }] }),
      ])

      await Promise.all([
        updateWithChunk(handler1, { choices: [{ delta: { content: ' A2' } }] }),
        updateWithChunk(handler2, { choices: [{ delta: { content: ' B2' } }] }),
      ])

      // Assert
      expect(handler1.accumulatedContent).toBe('A1 A2')
      expect(handler2.accumulatedContent).toBe('B1 B2')
    })
  })

  describe('Block Update Edge Cases', () => {
    it('should handle very long content (>10KB)', async () => {
      // Arrange
      mockInsertBlock.mockReset()
      mockInsertBlock.mockResolvedValue({ uuid: 'new-block-uuid' })
      const { handler } = await createResponseHandler('parent-uuid')
      const longContent = 'A'.repeat(15000)
      const chunk = { choices: [{ delta: { content: longContent } }] }

      // Act
      await updateWithChunk(handler, chunk)

      // Assert
      expect(handler.accumulatedContent.length).toBe(15000)
      expect(mockUpdateBlock).toHaveBeenCalledWith('new-block-uuid', longContent)
    })

    it('should handle special markdown characters', async () => {
      // Arrange
      mockInsertBlock.mockReset()
      mockInsertBlock.mockResolvedValue({ uuid: 'new-block-uuid' })
      const { handler } = await createResponseHandler('parent-uuid')
      const specialContent = '# Title\n- List item\n[[Link]] `code`'
      const chunk = { choices: [{ delta: { content: specialContent } }] }

      // Act
      await updateWithChunk(handler, chunk)

      // Assert
      expect(handler.accumulatedContent).toBe(specialContent)
      expect(mockUpdateBlock).toHaveBeenCalledWith('new-block-uuid', specialContent)
    })

    it('should handle unicode and emoji content', async () => {
      // Arrange
      const { handler } = await createResponseHandler('parent-uuid')
      const unicodeContent = '你好 🎉 مرحبا Привет'
      const chunk = { choices: [{ delta: { content: unicodeContent } }] }

      // Act
      await updateWithChunk(handler, chunk)

      // Assert
      expect(handler.accumulatedContent).toBe(unicodeContent)
    })

    it('should handle rapid successive updates', async () => {
      // Arrange
      const { handler } = await createResponseHandler('parent-uuid')
      const updates = Array.from({ length: 100 }, (_, i) => ({
        choices: [{ delta: { content: `${i} ` } }],
      }))

      // Act
      for (const chunk of updates) {
        await updateWithChunk(handler, chunk)
      }

      // Assert
      expect(mockUpdateBlock).toHaveBeenCalledTimes(100)
      expect(handler.accumulatedContent).toContain('0 ')
      expect(handler.accumulatedContent).toContain('99 ')
    })
  })

  describe('Block Lifecycle', () => {
    it('should transition through complete lifecycle: create -> update -> complete', async () => {
      // Arrange
      const { handler } = await createResponseHandler('parent-uuid')

      // Act - complete lifecycle
      expect(handler.status).toBe('pending')

      await updateWithChunk(handler, {
        choices: [{ delta: { content: 'Response' } }],
      })
      expect(handler.status).toBe('streaming')

      await markCompleted(handler)

      // Assert
      expect(handler.status).toBe('completed')
      expect(handler.completionTime).toBeDefined()
      expect(handler.accumulatedContent).toBe('Response')
    })

    it('should transition to failed state on error', async () => {
      // Arrange
      const { handler } = await createResponseHandler('parent-uuid')

      // Act
      await updateWithChunk(handler, {
        choices: [{ delta: { content: 'Partial' } }],
      })

      await markFailed(handler, new Error('Test error'))

      // Assert
      expect(handler.status).toBe('failed')
      expect(handler.errorMessage).toBe('Test error')
      expect(handler.accumulatedContent).toBe('Partial')
    })
  })
})
