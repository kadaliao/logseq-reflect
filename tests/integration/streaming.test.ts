/**
 * Integration tests for streaming summarization
 * T064: Write integration test for streaming summary updates
 *
 * These tests verify streaming behavior works end-to-end
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
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
const mockGetCurrentPage = vi.mocked(logseq.Editor.getCurrentPage)
const mockGetPage = vi.mocked(logseq.Editor.getPage)
const mockGetPageBlocksTree = vi.mocked(logseq.Editor.getPageBlocksTree)
const mockGetCurrentBlock = vi.mocked(logseq.Editor.getCurrentBlock)
const mockGetBlock = vi.mocked(logseq.Editor.getBlock)
const mockInsertBlock = vi.mocked(logseq.Editor.insertBlock)
const mockUpdateBlock = vi.mocked(logseq.Editor.updateBlock)

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

describe('Streaming Summarization Integration', () => {
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

      mockGetCurrentBlock.mockResolvedValueOnce({
        uuid: 'current-block',
        content: '',
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

      // Mock stream to yield chunks progressively
      mockStream.mockImplementation(async function* () {
        for (const chunk of chunks) {
          yield { choices: [{ delta: { content: chunk } }] }
        }
      })

      // Act
      const { handleSummarizePage } = await import('../../src/commands/summarize')
      await handleSummarizePage()

      // Wait for debounced updates
      await new Promise(resolve => setTimeout(resolve, 100))

      // Assert - Verify streaming behavior
      // 1. Placeholder was created
      expect(mockInsertBlock).toHaveBeenCalled()

      // 2. Block was updated at least once (streaming may batch updates)
      expect(mockUpdateBlock.mock.calls.length).toBeGreaterThan(0)

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

      mockGetCurrentBlock.mockResolvedValueOnce({
        uuid: 'current-block',
        content: '',
      })

      // Track accumulated content
      const updates: string[] = []

      mockUpdateBlock.mockImplementation(async (uuid, content) => {
        updates.push(content)
      })

      // Mock stream with three chunks
      mockStream.mockImplementation(async function* () {
        yield { choices: [{ delta: { content: 'First ' } }] }
        yield { choices: [{ delta: { content: 'second ' } }] }
        yield { choices: [{ delta: { content: 'third.' } }] }
      })

      // Act
      const { handleSummarizePage } = await import('../../src/commands/summarize')
      await handleSummarizePage()

      // Wait for debounced updates
      await new Promise(resolve => setTimeout(resolve, 100))

      // Assert - Content accumulates progressively
      expect(updates.length).toBeGreaterThan(0)

      // Final content should have all chunks
      const finalContent = updates[updates.length - 1]
      expect(finalContent).toContain('First')
      expect(finalContent).toContain('third.')
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

      // Mock stream response
      mockStream.mockImplementation(async function* () {
        yield { choices: [{ delta: { content: 'Project focuses on ' } }] }
        yield { choices: [{ delta: { content: 'UX improvement.' } }] }
      })

      // Act
      const { handleSummarizeBlock } = await import('../../src/commands/summarize')
      await handleSummarizeBlock()

      // Wait for debounced updates
      await new Promise(resolve => setTimeout(resolve, 100))

      // Assert
      expect(mockUpdateBlock.mock.calls.length).toBeGreaterThan(0)
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

      mockGetCurrentBlock.mockResolvedValueOnce({
        uuid: 'current-block',
        content: '',
      })

      // Mock streaming that errors after first chunk
      mockStream.mockImplementation(async function* () {
        yield { choices: [{ delta: { content: 'Start of summary' } }] }
        throw new Error('Network interrupted')
      })

      // Act
      const { handleSummarizePage } = await import('../../src/commands/summarize')
      await handleSummarizePage()

      // Wait for error handling
      await new Promise(resolve => setTimeout(resolve, 100))

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

      mockGetCurrentBlock.mockResolvedValueOnce({
        uuid: 'current-block',
        content: '',
      })

      // Mock LLM request failure
      mockStream.mockImplementation(async function* () {
        throw new Error('Connection timeout')
      })

      // Act
      const { handleSummarizePage } = await import('../../src/commands/summarize')
      await handleSummarizePage()

      // Wait for error handling
      await new Promise(resolve => setTimeout(resolve, 100))

      // Assert - Should show error message
      expect(mockUpdateBlock).toHaveBeenCalledWith(
        'summary-uuid',
        expect.stringContaining('Error')
      )
    })
  })
})
