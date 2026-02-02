/**
 * Unit tests for task breakdown handler
 * T089: Write unit tests for task breakdown handler
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import type { PluginSettings } from '../../../src/config/settings'

// Mock LLM client
vi.mock('../../../src/llm/client', () => ({
  LLMClient: vi.fn().mockImplementation(() => ({
    stream: vi.fn(),
    chat: vi.fn(),
  })),
}))

// Import after mocking
const { handleDivideIntoSubtasks, TASK_BREAKDOWN_SYSTEM_PROMPT } = await import(
  '../../../src/commands/tasks'
)
const { LLMClient } = await import('../../../src/llm/client')

// Get mock references
const mockGetCurrentBlock = vi.mocked(logseq.Editor.getCurrentBlock)
const mockGetBlock = vi.mocked(logseq.Editor.getBlock)
const mockInsertBlock = vi.mocked(logseq.Editor.insertBlock)
const mockUpdateBlock = vi.mocked(logseq.Editor.updateBlock)
const mockRemoveBlock = vi.mocked(logseq.Editor.removeBlock)
const mockShowMsg = vi.mocked(logseq.App.showMsg)
const MockedLLMClient = vi.mocked(LLMClient)

let mockStream: any
let mockChat: any

describe('Task Breakdown Handler - Unit Tests', () => {
  let settings: PluginSettings

  beforeEach(() => {
    vi.clearAllMocks()

    // Fresh mock instances for each test
    mockStream = vi.fn()
    mockChat = vi.fn()
    MockedLLMClient.mockImplementation(
      () =>
        ({
          stream: mockStream,
          chat: mockChat,
        }) as any
    )

    // Default settings
    settings = {
      llm: {
        baseURL: 'http://localhost:11434',
        apiPath: '/v1/chat/completions',
        modelName: 'gpt-4',
        apiKey: 'test-key',
        temperature: 0.7,
        topP: 1.0,
        maxTokens: 2000,
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

    // Default mock behaviors
    mockInsertBlock.mockResolvedValue({ uuid: 'new-subtask-uuid' } as any)
    mockUpdateBlock.mockResolvedValue(null)
    mockRemoveBlock.mockResolvedValue(null)
  })

  describe('Prompt Template', () => {
    it('should have system prompt for task breakdown', () => {
      expect(TASK_BREAKDOWN_SYSTEM_PROMPT).toBeDefined()
      expect(TASK_BREAKDOWN_SYSTEM_PROMPT).toContain('subtask')
      expect(TASK_BREAKDOWN_SYSTEM_PROMPT).toContain('TODO')
    })

    it('should instruct list format', () => {
      expect(TASK_BREAKDOWN_SYSTEM_PROMPT).toContain('- ')
      expect(TASK_BREAKDOWN_SYSTEM_PROMPT).toContain('marker')
    })
  })

  describe('TODO Detection', () => {
    it('should detect TODO marker', async () => {
      // Arrange
      mockGetCurrentBlock.mockResolvedValueOnce({
        uuid: 'todo-uuid',
        content: 'TODO Build authentication system',
        marker: 'TODO',
      } as any)

      mockGetBlock.mockResolvedValueOnce({
        uuid: 'todo-uuid',
        content: 'TODO Build authentication system',
        marker: 'TODO',
        children: [],
      } as any)

      mockStream.mockImplementation(async function* () {
        yield { choices: [{ delta: { content: '- TODO Subtask 1' } }] }
      })

      // Act
      await handleDivideIntoSubtasks(settings)

      // Assert - should call LLM
      expect(mockStream).toHaveBeenCalled()
    })

    it('should detect DOING marker', async () => {
      mockGetCurrentBlock.mockResolvedValueOnce({
        uuid: 'doing-uuid',
        content: 'DOING Implement feature',
        marker: 'DOING',
      } as any)

      mockGetBlock.mockResolvedValueOnce({
        uuid: 'doing-uuid',
        content: 'DOING Implement feature',
        marker: 'DOING',
        children: [],
      } as any)

      mockStream.mockImplementation(async function* () {
        yield { choices: [{ delta: { content: '- DOING Subtask' } }] }
      })

      await handleDivideIntoSubtasks(settings)

      expect(mockStream).toHaveBeenCalled()
    })

    it('should warn on non-TODO blocks', async () => {
      // Arrange
      mockGetCurrentBlock.mockResolvedValueOnce({
        uuid: 'regular-uuid',
        content: 'Regular note without marker',
        marker: null,
      } as any)

      mockGetBlock.mockResolvedValueOnce({
        uuid: 'regular-uuid',
        content: 'Regular note without marker',
        marker: null,
        children: [],
      } as any)

      // Act
      await handleDivideIntoSubtasks(settings)

      // Assert
      expect(mockShowMsg).toHaveBeenCalledWith(
        expect.stringMatching(/TODO marker/i),
        'warning'
      )
      expect(mockStream).not.toHaveBeenCalled()
    })
  })

  describe('Content Validation', () => {
    it('should warn if no active block', async () => {
      mockGetCurrentBlock.mockResolvedValueOnce(null)

      await handleDivideIntoSubtasks(settings)

      expect(mockShowMsg).toHaveBeenCalledWith(
        expect.stringContaining('No active block'),
        'warning'
      )
      expect(mockStream).not.toHaveBeenCalled()
    })

    it('should warn if task description is too short', async () => {
      mockGetCurrentBlock.mockResolvedValueOnce({
        uuid: 'short-uuid',
        content: 'TODO Fix',
        marker: 'TODO',
      } as any)

      mockGetBlock.mockResolvedValueOnce({
        uuid: 'short-uuid',
        content: 'TODO Fix',
        marker: 'TODO',
        children: [],
      } as any)

      await handleDivideIntoSubtasks(settings)

      expect(mockShowMsg).toHaveBeenCalledWith(
        expect.stringMatching(/too short/i),
        'warning'
      )
      expect(mockStream).not.toHaveBeenCalled()
    })

    it('should accept adequate task description', async () => {
      mockGetCurrentBlock.mockResolvedValueOnce({
        uuid: 'valid-uuid',
        content: 'TODO Implement user authentication with JWT tokens',
        marker: 'TODO',
      } as any)

      mockGetBlock.mockResolvedValueOnce({
        uuid: 'valid-uuid',
        content: 'TODO Implement user authentication with JWT tokens',
        marker: 'TODO',
        children: [],
      } as any)

      mockStream.mockImplementation(async function* () {
        yield { choices: [{ delta: { content: '- TODO Design schema' } }] }
      })

      await handleDivideIntoSubtasks(settings)

      expect(mockStream).toHaveBeenCalled()
    })
  })

  describe('Request Building', () => {
    it('should send task breakdown prompt to LLM', async () => {
      mockGetCurrentBlock.mockResolvedValueOnce({
        uuid: 'task-uuid',
        content: 'TODO Build REST API with authentication',
        marker: 'TODO',
      } as any)

      mockGetBlock.mockResolvedValueOnce({
        uuid: 'task-uuid',
        content: 'TODO Build REST API with authentication',
        marker: 'TODO',
        children: [],
      } as any)

      mockStream.mockImplementation(async function* () {
        yield { choices: [{ delta: { content: 'Subtasks' } }] }
      })

      await handleDivideIntoSubtasks(settings)

      expect(mockStream).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'gpt-4',
          messages: expect.arrayContaining([
            expect.objectContaining({
              role: 'system',
              content: expect.stringContaining('subtask'),
            }),
            expect.objectContaining({
              role: 'user',
              content: expect.stringContaining('Build REST API'),
            }),
          ]),
        }),
        expect.any(Object)
      )
    })
  })

  describe('Subtask Creation', () => {
    it('should create subtask blocks', async () => {
      mockGetCurrentBlock.mockResolvedValueOnce({
        uuid: 'parent-uuid',
        content: 'TODO Complete project documentation',
        marker: 'TODO',
      } as any)

      mockGetBlock.mockResolvedValueOnce({
        uuid: 'parent-uuid',
        content: 'TODO Complete project documentation',
        marker: 'TODO',
        children: [],
      } as any)

      mockStream.mockImplementation(async function* () {
        yield {
          choices: [
            {
              delta: {
                content:
                  '- TODO Write API documentation\n- TODO Create user guide\n- TODO Add code examples',
              },
            },
          ],
        }
      })

      await handleDivideIntoSubtasks(settings)

      // Wait for async block creation
      await new Promise(resolve => setTimeout(resolve, 100))

      expect(mockInsertBlock).toHaveBeenCalled()
    })

    it('should preserve TODO marker in subtasks', async () => {
      mockGetCurrentBlock.mockResolvedValueOnce({
        uuid: 'task-uuid',
        content: 'TODO Refactor codebase',
        marker: 'TODO',
      } as any)

      mockGetBlock.mockResolvedValueOnce({
        uuid: 'task-uuid',
        content: 'TODO Refactor codebase',
        marker: 'TODO',
        children: [],
      } as any)

      mockStream.mockImplementation(async function* () {
        yield {
          choices: [
            {
              delta: {
                content: '- TODO Extract common utilities\n- TODO Simplify components',
              },
            },
          ],
        }
      })

      await handleDivideIntoSubtasks(settings)

      await new Promise(resolve => setTimeout(resolve, 100))

      // Check that insertBlock was called with TODO markers
      const calls = mockInsertBlock.mock.calls
      expect(calls.length).toBeGreaterThan(0)
      // Verify subtasks contain TODO
      for (const call of calls) {
        const content = call[1]
        if (content && !content.includes('thinking')) {
          expect(content).toContain('TODO')
        }
      }
    })
  })

  describe('Streaming Mode', () => {
    it('should handle streaming responses', async () => {
      mockGetCurrentBlock.mockResolvedValueOnce({
        uuid: 'task-uuid',
        content: 'TODO Implement feature',
        marker: 'TODO',
      } as any)

      mockGetBlock.mockResolvedValueOnce({
        uuid: 'task-uuid',
        content: 'TODO Implement feature',
        marker: 'TODO',
        children: [],
      } as any)

      mockStream.mockImplementation(async function* () {
        yield { choices: [{ delta: { content: '- TODO Step 1\n' } }] }
        yield { choices: [{ delta: { content: '- TODO Step 2' } }] }
      })

      await handleDivideIntoSubtasks(settings)

      expect(mockStream).toHaveBeenCalled()
    })

    it('should handle streaming errors', async () => {
      mockGetCurrentBlock.mockResolvedValueOnce({
        uuid: 'task-uuid',
        content: 'TODO Test error handling',
        marker: 'TODO',
      } as any)

      mockGetBlock.mockResolvedValueOnce({
        uuid: 'task-uuid',
        content: 'TODO Test error handling',
        marker: 'TODO',
        children: [],
      } as any)

      mockStream.mockImplementation(async function* () {
        yield { choices: [{ delta: { content: 'Start' } }] }
        throw new Error('Stream error')
      })

      await handleDivideIntoSubtasks(settings)

      expect(mockShowMsg).toHaveBeenCalledWith(
        expect.stringContaining('Failed'),
        'error'
      )
    })
  })

  describe('Non-Streaming Mode', () => {
    beforeEach(() => {
      settings.llm.streamingEnabled = false
    })

    it('should handle non-streaming responses', async () => {
      mockGetCurrentBlock.mockResolvedValueOnce({
        uuid: 'task-uuid',
        content: 'TODO Complete implementation',
        marker: 'TODO',
      } as any)

      mockGetBlock.mockResolvedValueOnce({
        uuid: 'task-uuid',
        content: 'TODO Complete implementation',
        marker: 'TODO',
        children: [],
      } as any)

      mockChat.mockResolvedValueOnce({
        choices: [
          {
            message: {
              content: '- TODO Subtask 1\n- TODO Subtask 2',
            },
          },
        ],
      })

      await handleDivideIntoSubtasks(settings)

      expect(mockChat).toHaveBeenCalled()
    })
  })
})
