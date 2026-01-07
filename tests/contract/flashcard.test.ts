/**
 * Contract tests for flashcard generation
 * T073: Write contract test for flashcard generation prompt
 *
 * These tests verify the contract for flashcard generation behavior
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'

// Get mock references
const mockGetCurrentBlock = vi.mocked(logseq.Editor.getCurrentBlock)
const mockGetBlock = vi.mocked(logseq.Editor.getBlock)
const mockInsertBlock = vi.mocked(logseq.Editor.insertBlock)
const mockUpdateBlock = vi.mocked(logseq.Editor.updateBlock)
const mockShowMsg = vi.mocked(logseq.App.showMsg)

describe('Flashcard Generation - Contract Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('CONTRACT: Flashcard Generation Prompt', () => {
    it('should use appropriate system prompt for flashcard generation', async () => {
      // Arrange
      mockGetCurrentBlock.mockResolvedValueOnce({
        uuid: 'block-uuid',
        content: 'The Pythagorean theorem states that in a right triangle, the square of the hypotenuse equals the sum of squares of the other two sides.',
      } as any)

      mockGetBlock.mockResolvedValueOnce({
        uuid: 'block-uuid',
        content: 'The Pythagorean theorem states that in a right triangle, the square of the hypotenuse equals the sum of squares of the other two sides.',
        children: [],
      } as any)

      mockInsertBlock.mockResolvedValue({ uuid: 'placeholder-uuid' } as any)

      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        body: {
          getReader: () => ({
            read: vi
              .fn()
              .mockResolvedValueOnce({
                done: false,
                value: new TextEncoder().encode(
                  'data: {"choices":[{"delta":{"content":"Q: What does the Pythagorean theorem state?\\nA: The square of the hypotenuse equals the sum of squares of the other two sides."}}]}\n\n'
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

      // Assert - Verify system prompt instructs flashcard generation
      expect(global.fetch).toHaveBeenCalled()
      const fetchCall = (global.fetch as any).mock.calls[0]
      const requestBody = JSON.parse(fetchCall[1].body)

      // CONTRACT: System message must instruct for flashcard generation
      const systemMessage = requestBody.messages.find((m: any) => m.role === 'system')
      expect(systemMessage).toBeDefined()
      expect(systemMessage.content.toLowerCase()).toContain('flashcard')
      expect(systemMessage.content.toLowerCase()).toMatch(/question.*answer/i)

      // CONTRACT: Source content must be included
      const contentMessages = requestBody.messages.filter((m: any) => m.role === 'user')
      expect(contentMessages.length).toBeGreaterThan(0)
      expect(
        contentMessages.some((m: any) => m.content.includes('Pythagorean theorem'))
      ).toBe(true)
    })

    it('should request Q&A format in the prompt', async () => {
      // Arrange
      mockGetCurrentBlock.mockResolvedValueOnce({
        uuid: 'block-uuid',
        content: 'Photosynthesis is the process by which plants convert sunlight into energy.',
      } as any)

      mockGetBlock.mockResolvedValueOnce({
        uuid: 'block-uuid',
        content: 'Photosynthesis is the process by which plants convert sunlight into energy.',
        children: [],
      } as any)

      mockInsertBlock.mockResolvedValue({ uuid: 'placeholder-uuid' } as any)

      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        body: {
          getReader: () => ({
            read: vi
              .fn()
              .mockResolvedValueOnce({
                done: false,
                value: new TextEncoder().encode(
                  'data: {"choices":[{"delta":{"content":"Q: What is photosynthesis?"}}]}\n\n'
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

      // Assert
      const fetchCall = (global.fetch as any).mock.calls[0]
      const requestBody = JSON.parse(fetchCall[1].body)
      const systemMessage = requestBody.messages.find((m: any) => m.role === 'system')

      // CONTRACT: Prompt should request Q&A format
      expect(
        systemMessage.content.toLowerCase().includes('q:') ||
          systemMessage.content.toLowerCase().includes('question')
      ).toBe(true)
    })

    it('CONTRACT: Should handle empty content gracefully', async () => {
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
      const { handleGenerateFlashcard } = await import('../../src/commands/flashcard')
      await handleGenerateFlashcard()

      // Assert - Should show appropriate message for empty content
      expect(mockShowMsg).toHaveBeenCalledWith(
        expect.stringContaining('empty'),
        'warning'
      )
      // Should not call LLM
      expect(global.fetch).not.toHaveBeenCalled()
    })

    it('CONTRACT: Should handle insufficient content', async () => {
      // Arrange
      mockGetCurrentBlock.mockResolvedValueOnce({
        uuid: 'block-uuid',
        content: 'Hi',
      } as any)

      mockGetBlock.mockResolvedValueOnce({
        uuid: 'block-uuid',
        content: 'Hi',
        children: [],
      } as any)

      // Act
      const { handleGenerateFlashcard } = await import('../../src/commands/flashcard')
      await handleGenerateFlashcard()

      // Assert - Should show message about insufficient content
      expect(mockShowMsg).toHaveBeenCalledWith(
        expect.stringMatching(/insufficient|more.*content|detailed/i),
        'warning'
      )
    })

    it('CONTRACT: Should handle no current block', async () => {
      // Arrange
      mockGetCurrentBlock.mockResolvedValueOnce(null)

      // Act
      const { handleGenerateFlashcard } = await import('../../src/commands/flashcard')
      await handleGenerateFlashcard()

      // Assert - Should show appropriate warning
      expect(mockShowMsg).toHaveBeenCalledWith(
        expect.stringContaining('No active block'),
        'warning'
      )
      expect(global.fetch).not.toHaveBeenCalled()
    })
  })

  describe('CONTRACT: Nested Block Creation', () => {
    it('should create nested blocks with #card tag', async () => {
      // Arrange
      mockGetCurrentBlock.mockResolvedValueOnce({
        uuid: 'parent-uuid',
        content: 'The speed of light is approximately 299,792,458 meters per second.',
      } as any)

      mockGetBlock.mockResolvedValueOnce({
        uuid: 'parent-uuid',
        content: 'The speed of light is approximately 299,792,458 meters per second.',
        children: [],
      } as any)

      let blockCount = 0
      mockInsertBlock.mockImplementation(async () => {
        blockCount++
        return { uuid: `child-${blockCount}` } as any
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
                  'data: {"choices":[{"delta":{"content":"Q: What is the speed of light?\\nA: Approximately 299,792,458 meters per second."}}]}\n\n'
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

      // Wait for async operations
      await new Promise(resolve => setTimeout(resolve, 100))

      // Assert - Should create at least 2 child blocks (question and answer)
      expect(mockInsertBlock.mock.calls.length).toBeGreaterThanOrEqual(2)

      // CONTRACT: Blocks should be created as children of parent
      const insertCalls = mockInsertBlock.mock.calls
      insertCalls.forEach(call => {
        expect(call[0]).toBe('parent-uuid')
        // Should specify as child, not sibling
        expect(call[2]).toMatchObject({ sibling: false })
      })

      // CONTRACT: At least one block should have #card tag
      const blockContents = insertCalls.map(call => call[1])
      expect(
        blockContents.some(content => content.includes('#card'))
      ).toBe(true)
    })
  })
})
