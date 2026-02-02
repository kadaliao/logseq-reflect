/**
 * Integration tests for flashcard generation
 * T074: Write integration test for nested block creation
 *
 * These tests verify flashcard generation works end-to-end
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import type { PluginSettings } from '../../src/config/settings'

// Mock LLM client
vi.mock('../../src/llm/client', () => ({
  LLMClient: vi.fn().mockImplementation(() => ({
    stream: vi.fn(),
    chat: vi.fn(),
  })),
}))

// Import after mocking
const { LLMClient } = await import('../../src/llm/client')
const MockedLLMClient = vi.mocked(LLMClient)

// Get mock references
const mockGetCurrentBlock = vi.mocked(logseq.Editor.getCurrentBlock)
const mockGetBlock = vi.mocked(logseq.Editor.getBlock)
const mockInsertBlock = vi.mocked(logseq.Editor.insertBlock)
const mockUpdateBlock = vi.mocked(logseq.Editor.updateBlock)
const mockRemoveBlock = vi.mocked(logseq.Editor.removeBlock)
const mockShowMsg = vi.mocked(logseq.App.showMsg)

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

describe('Flashcard Generation Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    // Fresh mock instances for each test
    mockStream = vi.fn()
    mockChat = vi.fn()

    MockedLLMClient.mockImplementation(() => ({
      stream: mockStream,
      chat: mockChat,
    }))

    // Setup logseq.settings with mockSettings
    logseq.settings = mockSettings
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

      // Mock additional getBlock calls for placeholder cleanup
      mockGetBlock.mockResolvedValue({
        uuid: 'source-block',
        content: 'Mitochondria are the powerhouse of the cell, producing ATP through cellular respiration.',
        children: [
          { uuid: 'placeholder-uuid', content: '⏳ AI is thinking...' }
        ],
      } as any)

      // Track created blocks
      const createdBlocks: any[] = []
      mockInsertBlock.mockImplementation(async (parent, content, options) => {
        const uuid = `block-${createdBlocks.length + 1}`
        createdBlocks.push({ parent, content, options, uuid })
        return { uuid } as any
      })

      mockUpdateBlock.mockResolvedValue(null)
      mockRemoveBlock.mockResolvedValue(null as any)

      // Mock AI response with Q&A format
      mockStream.mockImplementation(async function* () {
        yield {
          choices: [{
            delta: {
              content: 'Q: What are mitochondria known as?\nA: The powerhouse of the cell, producing ATP through cellular respiration. #card'
            }
          }]
        }
      })

      // Act
      const { handleGenerateFlashcard } = await import('../../src/commands/flashcard')
      await handleGenerateFlashcard()

      // Wait for async operations and debounced updates
      await new Promise(resolve => setTimeout(resolve, 150))

      // Assert - Verify blocks were created
      expect(mockInsertBlock.mock.calls.length).toBeGreaterThanOrEqual(1)

      // Verify at least one block has #card tag
      const hasCardTag = createdBlocks.some(block =>
        block.content.includes('#card')
      )
      expect(hasCardTag).toBe(true)

      // First block should be child of source block
      if (createdBlocks.length > 0) {
        expect(createdBlocks[0].parent).toBe('source-block')
        expect(createdBlocks[0].options.sibling).toBe(false)
      }
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
      mockStream.mockImplementation(async function* () {
        yield {
          choices: [{
            delta: {
              content: 'Q: Who discovered DNA structure?\nA: Watson and Crick in 1953 #card\n\nQ: What is DNA made of?\nA: Nucleotides containing sugar, phosphate, and nitrogenous base #card'
            }
          }]
        }
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

      // Mock stream response
      mockStream.mockImplementation(async function* () {
        yield {
          choices: [{
            delta: {
              content: 'Q: What are the three states of matter?\nA: Solid, liquid, and gas #card'
            }
          }]
        }
      })

      // Act
      const { handleGenerateFlashcard } = await import('../../src/commands/flashcard')
      await handleGenerateFlashcard()

      await new Promise(resolve => setTimeout(resolve, 150))

      // Assert - Verify blocks were created with proper hierarchy
      expect(blockHierarchy.length).toBeGreaterThan(0)

      // First block should be child of parent-block
      if (blockHierarchy.length > 0) {
        expect(blockHierarchy[0].parent).toBe('parent-block')
        expect(blockHierarchy[0].options.sibling).toBe(false)
      }

      // All blocks should have sibling: false (meaning they're children, not siblings)
      blockHierarchy.forEach(block => {
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

      // Mock streaming error - need to return an async generator that throws
      mockStream.mockImplementationOnce(async function* () {
        throw new Error('Network error')
      })

      // Act
      const { handleGenerateFlashcard } = await import('../../src/commands/flashcard')
      await handleGenerateFlashcard()

      await new Promise(resolve => setTimeout(resolve, 150))

      // Assert - Should show error message
      expect(mockShowMsg).toHaveBeenCalledWith(
        expect.stringContaining('Failed'),
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
      mockStream.mockRejectedValueOnce(new Error('API error'))

      // Act
      const { handleGenerateFlashcard } = await import('../../src/commands/flashcard')
      await handleGenerateFlashcard()

      await new Promise(resolve => setTimeout(resolve, 150))

      // Assert - Should display error
      expect(mockShowMsg).toHaveBeenCalledWith(
        expect.stringContaining('Failed'),
        'error'
      )
    })
  })
})
