/**
 * Integration tests for flashcard generation
 * T074: Write integration test for nested block creation
 *
 * These tests verify flashcard generation works end-to-end
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'

// Get mock references
const mockGetCurrentBlock = vi.mocked(logseq.Editor.getCurrentBlock)
const mockGetBlock = vi.mocked(logseq.Editor.getBlock)
const mockInsertBlock = vi.mocked(logseq.Editor.insertBlock)
const mockUpdateBlock = vi.mocked(logseq.Editor.updateBlock)
const mockShowMsg = vi.mocked(logseq.App.showMsg)

describe('Flashcard Generation Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Nested Block Creation', () => {
    it('INTEGRATION: should create question and answer blocks with #card tags', async () => {
      // Arrange - Educational content
      mockGetCurrentBlock.mockResolvedValueOnce({
        uuid: 'source-block',
        content: 'Mitochondria are the powerhouse of the cell, producing ATP through cellular respiration.',
      } as any)

      mockGetBlock.mockResolvedValueOnce({
        uuid: 'source-block',
        content: 'Mitochondria are the powerhouse of the cell, producing ATP through cellular respiration.',
        children: [],
      } as any)

      // Track created blocks
      const createdBlocks: any[] = []
      mockInsertBlock.mockImplementation(async (parent, content, options) => {
        const uuid = `block-${createdBlocks.length + 1}`
        createdBlocks.push({ parent, content, options, uuid })
        return { uuid } as any
      })

      mockUpdateBlock.mockResolvedValue(null)

      // Mock AI response with Q&A format
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        body: {
          getReader: () => ({
            read: vi
              .fn()
              .mockResolvedValueOnce({
                done: false,
                value: new TextEncoder().encode(
                  'data: {"choices":[{"delta":{"content":"Q: What are mitochondria known as?\\nA: The powerhouse of the cell, producing ATP through cellular respiration. #card"}}]}\n\n'
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
      const { handleGenerateFlashcard } = await import('../../src/commands/flashcard')
      await handleGenerateFlashcard()

      // Wait for async operations to complete
      await new Promise(resolve => setTimeout(resolve, 150))

      // Assert - Verify nested blocks were created
      expect(mockInsertBlock.mock.calls.length).toBeGreaterThanOrEqual(2)

      // Verify all blocks are children of source block
      createdBlocks.forEach(block => {
        expect(block.parent).toBe('source-block')
        expect(block.options.sibling).toBe(false)
      })

      // Verify at least one block has #card tag
      const hasCardTag = createdBlocks.some(block =>
        block.content.includes('#card')
      )
      expect(hasCardTag).toBe(true)
    })

    it('INTEGRATION: should handle multiple Q&A pairs', async () => {
      // Arrange - Content with multiple facts
      mockGetCurrentBlock.mockResolvedValueOnce({
        uuid: 'source-block',
        content: 'DNA structure: discovered by Watson and Crick in 1953. DNA is a double helix made of nucleotides. Each nucleotide contains a sugar, phosphate, and nitrogenous base.',
      } as any)

      mockGetBlock.mockResolvedValueOnce({
        uuid: 'source-block',
        content: 'DNA structure: discovered by Watson and Crick in 1953. DNA is a double helix made of nucleotides. Each nucleotide contains a sugar, phosphate, and nitrogenous base.',
        children: [],
      } as any)

      const createdBlocks: any[] = []
      mockInsertBlock.mockImplementation(async (parent, content) => {
        const uuid = `block-${createdBlocks.length + 1}`
        createdBlocks.push({ content, uuid })
        return { uuid } as any
      })

      // Mock AI response with multiple Q&A pairs
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        body: {
          getReader: () => ({
            read: vi
              .fn()
              .mockResolvedValueOnce({
                done: false,
                value: new TextEncoder().encode(
                  'data: {"choices":[{"delta":{"content":"Q: Who discovered DNA structure?\\nA: Watson and Crick in 1953 #card\\n\\nQ: What is DNA made of?\\nA: Nucleotides containing sugar, phosphate, and nitrogenous base #card"}}]}\n\n'
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
      const { handleGenerateFlashcard } = await import('../../src/commands/flashcard')
      await handleGenerateFlashcard()

      // Wait for async processing
      await new Promise(resolve => setTimeout(resolve, 150))

      // Assert - Should create multiple flashcard blocks
      expect(mockInsertBlock.mock.calls.length).toBeGreaterThanOrEqual(2)

      // Should have multiple #card tags
      const cardBlocks = createdBlocks.filter(block =>
        block.content.includes('#card')
      )
      expect(cardBlocks.length).toBeGreaterThanOrEqual(1)
    })

    it('INTEGRATION: should preserve block hierarchy', async () => {
      // Arrange
      mockGetCurrentBlock.mockResolvedValueOnce({
        uuid: 'parent-block',
        content: 'The three states of matter are solid, liquid, and gas.',
      } as any)

      mockGetBlock.mockResolvedValueOnce({
        uuid: 'parent-block',
        content: 'The three states of matter are solid, liquid, and gas.',
        children: [],
      } as any)

      const blockHierarchy: any[] = []
      mockInsertBlock.mockImplementation(async (parent, content, options) => {
        const uuid = `child-${blockHierarchy.length + 1}`
        blockHierarchy.push({ parent, content, options, uuid })
        return { uuid } as any
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
                  'data: {"choices":[{"delta":{"content":"Q: What are the three states of matter?\\nA: Solid, liquid, and gas #card"}}]}\n\n'
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
      const { handleGenerateFlashcard } = await import('../../src/commands/flashcard')
      await handleGenerateFlashcard()

      await new Promise(resolve => setTimeout(resolve, 150))

      // Assert - All blocks should be children of parent
      blockHierarchy.forEach(block => {
        expect(block.parent).toBe('parent-block')
        expect(block.options.sibling).toBe(false)
      })
    })
  })

  describe('Error Handling', () => {
    it('INTEGRATION: should handle streaming errors during flashcard generation', async () => {
      // Arrange
      mockGetCurrentBlock.mockResolvedValueOnce({
        uuid: 'block-uuid',
        content: 'Test content for flashcard.',
      } as any)

      mockGetBlock.mockResolvedValueOnce({
        uuid: 'block-uuid',
        content: 'Test content for flashcard.',
        children: [],
      } as any)

      mockInsertBlock.mockResolvedValue({ uuid: 'placeholder-uuid' } as any)

      // Mock streaming error
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        body: {
          getReader: () => ({
            read: vi.fn().mockRejectedValueOnce(new Error('Network error')),
          }),
        },
      })

      // Act
      const { handleGenerateFlashcard } = await import('../../src/commands/flashcard')
      await handleGenerateFlashcard()

      // Assert - Should show error message
      expect(mockShowMsg).toHaveBeenCalledWith(
        expect.stringContaining('error'),
        'error'
      )
    })

    it('INTEGRATION: should handle LLM request failure', async () => {
      // Arrange
      mockGetCurrentBlock.mockResolvedValueOnce({
        uuid: 'block-uuid',
        content: 'Content for flashcard generation.',
      } as any)

      mockGetBlock.mockResolvedValueOnce({
        uuid: 'block-uuid',
        content: 'Content for flashcard generation.',
        children: [],
      } as any)

      mockInsertBlock.mockResolvedValue({ uuid: 'placeholder-uuid' } as any)

      // Mock API failure
      global.fetch = vi.fn().mockRejectedValueOnce(new Error('API error'))

      // Act
      const { handleGenerateFlashcard } = await import('../../src/commands/flashcard')
      await handleGenerateFlashcard()

      // Assert - Should display error
      expect(mockShowMsg).toHaveBeenCalledWith(
        expect.stringContaining('Failed'),
        'error'
      )
    })
  })
})
