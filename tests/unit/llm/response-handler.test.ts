/**
 * Unit tests for ResponseHandler
 * T051: Write unit tests for ResponseHandler
 *
 * Purpose: Test response handler logic in isolation
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import type { ResponseHandler } from '../../../src/types'

// Import after mocking
const {
  createResponseHandler,
  updateWithChunk,
  markCompleted,
  markFailed,
  cancelHandler,
} = await import('../../../src/llm/response-handler')

// Get mock references from global logseq (set up in tests/setup.ts)
const mockInsertBlock = vi.mocked(logseq.Editor.insertBlock)
const mockUpdateBlock = vi.mocked(logseq.Editor.updateBlock)
const mockGetCurrentPage = vi.mocked(logseq.Editor.getCurrentPage)
const mockGetPageBlocksTree = vi.mocked(logseq.Editor.getPageBlocksTree)
const mockAppendBlockInPage = vi.mocked(logseq.Editor.appendBlockInPage)

describe('ResponseHandler - Unit Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    mockInsertBlock.mockResolvedValue({ uuid: 'test-block-uuid' })
    mockUpdateBlock.mockResolvedValue(null)
    mockGetCurrentPage.mockResolvedValue({ uuid: 'page-uuid' })
    mockGetPageBlocksTree.mockResolvedValue([])
    mockAppendBlockInPage.mockResolvedValue({ uuid: 'test-block-uuid' })
  })

  describe('createResponseHandler', () => {
    it('should create handler with pending status', async () => {
      // Act
      const { handler } = await createResponseHandler('parent-uuid')

      // Assert
      expect(handler.status).toBe('pending')
      expect(handler.errorMessage).toBeNull()
      expect(handler.accumulatedContent).toBe('')
    })

    it('should generate unique request ID', async () => {
      // Act
      const { handler: handler1 } = await createResponseHandler()
      const { handler: handler2 } = await createResponseHandler()

      // Assert
      expect(handler1.requestID).not.toBe(handler2.requestID)
      expect(handler1.requestID).toMatch(/^req-/)
    })

    it('should set start time', async () => {
      // Arrange
      const before = Date.now()

      // Act
      const { handler } = await createResponseHandler()


      // Assert
      const after = Date.now()
      expect(handler.startTime).toBeGreaterThanOrEqual(before)
      expect(handler.startTime).toBeLessThanOrEqual(after)
    })

    it('should create placeholder block', async () => {
      // Act
      await createResponseHandler('parent-123')

      // Assert
      expect(mockInsertBlock).toHaveBeenCalledWith(
        'parent-123',
        expect.stringContaining('⏳'),
        expect.any(Object)
      )
    })

    it('should store placeholder UUID', async () => {
      // Arrange
      mockAppendBlockInPage.mockResolvedValue({ uuid: 'placeholder-abc' } as any)

      // Act
      const { handler } = await createResponseHandler()


      // Assert
      expect(handler.placeholderUUID).toBe('placeholder-abc')
    })

    it('should create block as child when parent provided', async () => {
      // Act
      await createResponseHandler('parent-uuid')

      // Assert
      expect(mockInsertBlock).toHaveBeenCalledWith(
        'parent-uuid',
        expect.any(String),
        expect.objectContaining({ sibling: false })
      )
    })

    it('should handle undefined parent (fallback to page end)', async () => {
      // Arrange
      mockGetCurrentPage.mockResolvedValue({ uuid: 'page-uuid', name: 'Test Page' } as any)

      // Act
      await createResponseHandler()

      // Assert
      expect(mockGetCurrentPage).toHaveBeenCalled()
      expect(mockAppendBlockInPage).toHaveBeenCalled()
    })

    it('should not have completion time initially', async () => {
      // Act
      const { handler } = await createResponseHandler()


      // Assert
      expect(handler.completionTime).toBeUndefined()
    })

    it('should return AbortController for cancellation', async () => {
      // Act
      const { abortController } = await createResponseHandler()

      // Assert
      expect(abortController).toBeInstanceOf(AbortController)
      expect(abortController.signal).toBeInstanceOf(AbortSignal)
    })
  })

  describe('updateWithChunk', () => {
    let handler: ResponseHandler

    beforeEach(async () => {
      const result = await createResponseHandler('parent-uuid')
      handler = result.handler
    })

    it('should accumulate content from chunk', async () => {
      // Arrange
      const chunk = {
        choices: [{ delta: { content: 'Hello world' } }],
      }

      // Act
      await updateWithChunk(handler, chunk)

      // Assert
      expect(handler.accumulatedContent).toBe('Hello world')
    })

    it('should accumulate multiple chunks', async () => {
      // Act
      await updateWithChunk(handler, {
        choices: [{ delta: { content: 'First ' } }],
      })
      await updateWithChunk(handler, {
        choices: [{ delta: { content: 'second ' } }],
      })
      await updateWithChunk(handler, {
        choices: [{ delta: { content: 'third' } }],
      })

      // Assert
      expect(handler.accumulatedContent).toBe('First second third')
    })

    it('should update block with accumulated content', async () => {
      // Arrange
      const chunk = { choices: [{ delta: { content: 'Test content' } }] }

      // Act
      await updateWithChunk(handler, chunk)

      // Wait for debounced update (50ms + buffer)
      await new Promise(resolve => setTimeout(resolve, 100))

      // Assert
      expect(mockUpdateBlock).toHaveBeenCalledWith('test-block-uuid', 'Test content')
    })

    it('should handle empty delta', async () => {
      // Arrange
      const chunk = { choices: [{ delta: {} }] }

      // Act
      await updateWithChunk(handler, chunk)

      // Assert
      expect(handler.accumulatedContent).toBe('')
    })

    it('should handle empty content string', async () => {
      // Arrange
      const chunk = { choices: [{ delta: { content: '' } }] }

      // Act
      await updateWithChunk(handler, chunk)

      // Assert
      expect(handler.accumulatedContent).toBe('')
      expect(mockUpdateBlock).not.toHaveBeenCalled()
    })

    it('should handle missing choices array', async () => {
      // Arrange
      const chunk = {} as any

      // Act
      await updateWithChunk(handler, chunk)

      // Assert
      expect(handler.accumulatedContent).toBe('')
    })

    it('should handle missing delta in choice', async () => {
      // Arrange
      const chunk = { choices: [{}] } as any

      // Act
      await updateWithChunk(handler, chunk)

      // Assert
      expect(handler.accumulatedContent).toBe('')
    })

    it('should change status to streaming during update', async () => {
      // Arrange
      const chunk = { choices: [{ delta: { content: 'Content' } }] }

      // Act
      await updateWithChunk(handler, chunk)

      // Assert
      expect(handler.status).toBe('streaming')
    })

    it('should preserve existing content when adding new chunk', async () => {
      // Arrange
      handler.accumulatedContent = 'Existing '

      // Act
      await updateWithChunk(handler, {
        choices: [{ delta: { content: 'new' } }],
      })

      // Assert
      expect(handler.accumulatedContent).toBe('Existing new')
    })

    it('should handle special characters in content', async () => {
      // Arrange
      const specialContent = '# Title\n[[Link]] `code` **bold**'
      const chunk = { choices: [{ delta: { content: specialContent } }] }

      // Act
      await updateWithChunk(handler, chunk)

      // Assert
      expect(handler.accumulatedContent).toBe(specialContent)
    })

    it('should handle unicode and emoji', async () => {
      // Arrange
      const unicodeContent = '你好 🎉 Привет'
      const chunk = { choices: [{ delta: { content: unicodeContent } }] }

      // Act
      await updateWithChunk(handler, chunk)

      // Assert
      expect(handler.accumulatedContent).toBe(unicodeContent)
    })
  })

  describe('markCompleted', () => {
    let handler: ResponseHandler

    beforeEach(async () => {
      const result = await createResponseHandler('parent-uuid')
      handler = result.handler
      handler.accumulatedContent = 'Final response'
    })

    it('should set status to completed', async () => {
      // Act
      await markCompleted(handler)

      // Assert
      expect(handler.status).toBe('completed')
    })

    it('should set completion time', async () => {
      // Arrange
      const before = Date.now()

      // Act
      await markCompleted(handler)

      // Assert
      const after = Date.now()
      expect(handler.completionTime).toBeDefined()
      expect(handler.completionTime!).toBeGreaterThanOrEqual(before)
      expect(handler.completionTime!).toBeLessThanOrEqual(after)
    })

    it('should update block with final content', async () => {
      // Act
      await markCompleted(handler)

      // Assert
      expect(mockUpdateBlock).toHaveBeenCalledWith(
        'test-block-uuid',
        expect.stringContaining('Final response')
      )
    })

    it('should preserve accumulated content', async () => {
      // Arrange
      const originalContent = handler.accumulatedContent

      // Act
      await markCompleted(handler)

      // Assert
      expect(handler.accumulatedContent).toBe(originalContent)
    })

    it('should work with empty content', async () => {
      // Arrange
      handler.accumulatedContent = ''

      // Act
      await markCompleted(handler)

      // Assert
      expect(handler.status).toBe('completed')
      expect(handler.completionTime).toBeDefined()
    })

    it('should not set error message', async () => {
      // Act
      await markCompleted(handler)

      // Assert
      expect(handler.errorMessage).toBeNull()
    })
  })

  describe('markFailed', () => {
    let handler: ResponseHandler

    beforeEach(async () => {
      const result = await createResponseHandler('parent-uuid')
      handler = result.handler
      handler.accumulatedContent = 'Partial content'
    })

    it('should set status to failed', async () => {
      // Arrange
      const error = new Error('Test error')

      // Act
      await markFailed(handler, error)

      // Assert
      expect(handler.status).toBe('failed')
    })

    it('should set error message', async () => {
      // Arrange
      const error = new Error('API failed')

      // Act
      await markFailed(handler, error)

      // Assert
      expect(handler.errorMessage).toBe('API failed')
    })

    it('should set completion time', async () => {
      // Arrange
      const error = new Error('Test error')
      const before = Date.now()

      // Act
      await markFailed(handler, error)

      // Assert
      const after = Date.now()
      expect(handler.completionTime).toBeDefined()
      expect(handler.completionTime!).toBeGreaterThanOrEqual(before)
      expect(handler.completionTime!).toBeLessThanOrEqual(after)
    })

    it('should update block with error message', async () => {
      // Arrange
      const error = new Error('Network timeout')

      // Act
      await markFailed(handler, error)

      // Assert
      expect(mockUpdateBlock).toHaveBeenCalledWith(
        'test-block-uuid',
        expect.stringContaining('**Error**')
      )
      expect(mockUpdateBlock).toHaveBeenCalledWith(
        'test-block-uuid',
        expect.stringContaining('Network timeout')
      )
    })

    it('should preserve partial content', async () => {
      // Arrange
      const originalContent = handler.accumulatedContent
      const error = new Error('Test error')

      // Act
      await markFailed(handler, error)

      // Assert
      expect(handler.accumulatedContent).toBe(originalContent)
    })

    it('should handle error with no message', async () => {
      // Arrange
      const error = new Error()

      // Act
      await markFailed(handler, error)

      // Assert
      expect(handler.status).toBe('failed')
      expect(handler.errorMessage).toBe('')
    })
  })

  describe('cancelHandler', () => {
    let handler: ResponseHandler

    beforeEach(async () => {
      const result = await createResponseHandler('parent-uuid')
      handler = result.handler
      handler.accumulatedContent = 'Some content'
    })

    it('should set status to cancelled', async () => {
      // Act
      await cancelHandler(handler)

      // Assert
      expect(handler.status).toBe('cancelled')
    })

    it('should set completion time', async () => {
      // Arrange
      const before = Date.now()

      // Act
      await cancelHandler(handler)

      // Assert
      const after = Date.now()
      expect(handler.completionTime).toBeDefined()
      expect(handler.completionTime!).toBeGreaterThanOrEqual(before)
      expect(handler.completionTime!).toBeLessThanOrEqual(after)
    })

    it('should update block with cancellation message', async () => {
      // Act
      await cancelHandler(handler)

      // Assert
      expect(mockUpdateBlock).toHaveBeenCalledWith(
        'test-block-uuid',
        expect.stringContaining('Cancelled')
      )
    })

    it('should preserve accumulated content', async () => {
      // Arrange
      const originalContent = handler.accumulatedContent

      // Act
      await cancelHandler(handler)

      // Assert
      expect(handler.accumulatedContent).toBe(originalContent)
    })

    it('should work with empty content', async () => {
      // Arrange
      handler.accumulatedContent = ''

      // Act
      await cancelHandler(handler)

      // Assert
      expect(handler.status).toBe('cancelled')
    })
  })

  describe('Handler State Transitions', () => {
    it('should transition from pending to streaming to completed', async () => {
      // Arrange
      const { handler } = await createResponseHandler()


      // Act & Assert
      expect(handler.status).toBe('pending')

      await updateWithChunk(handler, {
        choices: [{ delta: { content: 'Content' } }],
      })
      expect(handler.status).toBe('streaming')

      await markCompleted(handler)
      expect(handler.status).toBe('completed')
    })

    it('should transition from pending to streaming to failed', async () => {
      // Arrange
      const { handler } = await createResponseHandler()


      // Act & Assert
      expect(handler.status).toBe('pending')

      await updateWithChunk(handler, {
        choices: [{ delta: { content: 'Content' } }],
      })
      expect(handler.status).toBe('streaming')

      await markFailed(handler, new Error('Test'))
      expect(handler.status).toBe('failed')
    })

    it('should transition from pending to cancelled', async () => {
      // Arrange
      const { handler } = await createResponseHandler()


      // Act & Assert
      expect(handler.status).toBe('pending')

      await cancelHandler(handler)
      expect(handler.status).toBe('cancelled')
    })
  })

  describe('Handler Timing', () => {
    it('should track elapsed time correctly', async () => {
      // Arrange
      const { handler } = await createResponseHandler()

      const startTime = handler.startTime

      // Wait a bit
      await new Promise((resolve) => setTimeout(resolve, 10))

      // Act
      await markCompleted(handler)

      // Assert
      expect(handler.completionTime).toBeDefined()
      expect(handler.completionTime! - startTime).toBeGreaterThan(0)
    })

    it('should measure time to failure', async () => {
      // Arrange
      const { handler } = await createResponseHandler()

      const startTime = handler.startTime

      // Wait a bit
      await new Promise((resolve) => setTimeout(resolve, 10))

      // Act
      await markFailed(handler, new Error('Test'))

      // Assert
      expect(handler.completionTime).toBeDefined()
      expect(handler.completionTime! - startTime).toBeGreaterThan(0)
    })
  })

  describe('Edge Cases', () => {
    it('should handle rapid successive updates', async () => {
      // Arrange
      const { handler } = await createResponseHandler()

      const updates = Array.from({ length: 50 }, (_, i) => `${i} `)

      // Act
      for (const content of updates) {
        await updateWithChunk(handler, {
          choices: [{ delta: { content } }],
        })
      }

      // Assert
      expect(handler.accumulatedContent).toContain('0 ')
      expect(handler.accumulatedContent).toContain('49 ')
    })

    it('should handle very long content', async () => {
      // Arrange
      const { handler } = await createResponseHandler()

      const longContent = 'A'.repeat(20000)

      // Act
      await updateWithChunk(handler, {
        choices: [{ delta: { content: longContent } }],
      })

      // Assert
      expect(handler.accumulatedContent.length).toBe(20000)
    })

    it('should handle completion without any updates', async () => {
      // Arrange
      const { handler } = await createResponseHandler()


      // Act
      await markCompleted(handler)

      // Assert
      expect(handler.status).toBe('completed')
      expect(handler.accumulatedContent).toBe('')
    })

    it('should handle failure without any updates', async () => {
      // Arrange
      const { handler } = await createResponseHandler()


      // Act
      await markFailed(handler, new Error('Immediate failure'))

      // Assert
      expect(handler.status).toBe('failed')
      expect(handler.accumulatedContent).toBe('')
    })
  })
})
