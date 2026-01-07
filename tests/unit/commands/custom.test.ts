/**
 * Unit tests for custom command handler
 * T100: Write unit tests for custom command handler
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import type { PluginSettings } from '../../../src/config/settings'
import type { CustomCommandDefinition } from '../../../src/config/loader'

// Mock LLM client
vi.mock('../../../src/llm/client', () => ({
  LLMClient: vi.fn().mockImplementation(() => ({
    stream: vi.fn(),
    chat: vi.fn(),
  })),
}))

// Import after mocking
const { executeCustomCommand } = await import('../../../src/commands/custom')
const { extractTemplateVariables } = await import('../../../src/config/loader')
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

describe('Custom Command Handler - Unit Tests', () => {
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
        apiEndpoint: 'https://api.openai.com/v1',
        apiKey: 'test-key',
        modelName: 'gpt-4',
        temperature: 0.7,
        topP: 1.0,
        maxTokens: 2000,
        streamingEnabled: true,
        timeoutMs: 30000,
        retryAttempts: 3,
        retryDelayMs: 1000,
        maxContextTokens: 8000,
      },
      debugMode: false,
    }

    // Default mock behaviors
    mockInsertBlock.mockResolvedValue({ uuid: 'new-block-uuid' } as any)
    mockUpdateBlock.mockResolvedValue(null)
    mockRemoveBlock.mockResolvedValue(null)
  })

  describe('Template Variable Substitution', () => {
    it('should substitute {{content}} variable', async () => {
      const command: CustomCommandDefinition = {
        name: 'Explain Code',
        prompt: 'Explain the following code:\n\n{{content}}',
      }

      mockGetCurrentBlock.mockResolvedValueOnce({
        uuid: 'block-uuid',
        content: 'function add(a, b) { return a + b; }',
      } as any)

      mockGetBlock.mockResolvedValueOnce({
        uuid: 'block-uuid',
        content: 'function add(a, b) { return a + b; }',
        children: [],
      } as any)

      mockStream.mockImplementation(async function* () {
        yield { choices: [{ delta: { content: 'Explanation' } }] }
      })

      await executeCustomCommand(command, settings)

      // Verify the prompt was sent with content substituted
      expect(mockStream).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: expect.arrayContaining([
            expect.objectContaining({
              role: 'user',
              content: expect.stringContaining('function add'),
            }),
          ]),
        }),
        expect.any(Object)
      )
    })

    it('should extract template variables from prompt', () => {
      const prompt = 'Translate {{content}} to {{language}} in {{format}} format'
      const variables = extractTemplateVariables(prompt)

      expect(variables).toEqual(['content', 'language', 'format'])
    })

    it('should handle prompts without variables', () => {
      const prompt = 'This is a simple prompt with no variables'
      const variables = extractTemplateVariables(prompt)

      expect(variables).toEqual([])
    })
  })

  describe('Command Execution', () => {
    it('should execute custom command with streaming', async () => {
      const command: CustomCommandDefinition = {
        name: 'Summarize',
        prompt: 'Summarize: {{content}}',
      }

      mockGetCurrentBlock.mockResolvedValueOnce({
        uuid: 'block-uuid',
        content: 'Long text to summarize...',
      } as any)

      mockGetBlock.mockResolvedValueOnce({
        uuid: 'block-uuid',
        content: 'Long text to summarize...',
        children: [],
      } as any)

      mockStream.mockImplementation(async function* () {
        yield { choices: [{ delta: { content: 'Summary text' } }] }
      })

      await executeCustomCommand(command, settings)

      expect(mockStream).toHaveBeenCalled()
    })

    it('should execute custom command without streaming', async () => {
      settings.llm.streamingEnabled = false

      const command: CustomCommandDefinition = {
        name: 'Analyze',
        prompt: 'Analyze: {{content}}',
      }

      mockGetCurrentBlock.mockResolvedValueOnce({
        uuid: 'block-uuid',
        content: 'Content to analyze',
      } as any)

      mockGetBlock.mockResolvedValueOnce({
        uuid: 'block-uuid',
        content: 'Content to analyze',
        children: [],
      } as any)

      mockChat.mockResolvedValueOnce({
        choices: [
          {
            message: {
              content: 'Analysis result',
            },
          },
        ],
      })

      await executeCustomCommand(command, settings)

      expect(mockChat).toHaveBeenCalled()
    })

    it('should handle missing active block', async () => {
      const command: CustomCommandDefinition = {
        name: 'Test',
        prompt: 'Test: {{content}}',
      }

      mockGetCurrentBlock.mockResolvedValueOnce(null)

      await executeCustomCommand(command, settings)

      expect(mockShowMsg).toHaveBeenCalledWith(
        expect.stringContaining('No active block'),
        'warning'
      )
      expect(mockStream).not.toHaveBeenCalled()
    })

    it('should handle command execution errors', async () => {
      const command: CustomCommandDefinition = {
        name: 'Error Test',
        prompt: 'Test: {{content}}',
      }

      mockGetCurrentBlock.mockResolvedValueOnce({
        uuid: 'block-uuid',
        content: 'Test content',
      } as any)

      mockGetBlock.mockResolvedValueOnce({
        uuid: 'block-uuid',
        content: 'Test content',
        children: [],
      } as any)

      mockStream.mockImplementation(async function* () {
        throw new Error('LLM error')
      })

      await executeCustomCommand(command, settings)

      expect(mockShowMsg).toHaveBeenCalledWith(
        expect.stringContaining('Failed'),
        'error'
      )
    })
  })

  describe('Content Extraction', () => {
    it('should extract content from block with children', async () => {
      const command: CustomCommandDefinition = {
        name: 'Process',
        prompt: 'Process: {{content}}',
      }

      mockGetCurrentBlock.mockResolvedValueOnce({
        uuid: 'parent-uuid',
        content: 'Parent content',
      } as any)

      mockGetBlock.mockResolvedValueOnce({
        uuid: 'parent-uuid',
        content: 'Parent content',
        children: [
          {
            uuid: 'child-1',
            content: 'Child 1 content',
            children: [],
          },
          {
            uuid: 'child-2',
            content: 'Child 2 content',
            children: [],
          },
        ],
      } as any)

      mockStream.mockImplementation(async function* () {
        yield { choices: [{ delta: { content: 'Result' } }] }
      })

      await executeCustomCommand(command, settings)

      const streamCall = mockStream.mock.calls[0]
      const userMessage = streamCall[0].messages.find((m: any) => m.role === 'user')

      expect(userMessage.content).toContain('Parent content')
      expect(userMessage.content).toContain('Child 1 content')
      expect(userMessage.content).toContain('Child 2 content')
    })
  })

  describe('Custom Command Properties', () => {
    it('should handle command with description', () => {
      const command: CustomCommandDefinition = {
        name: 'Test Command',
        prompt: 'Test: {{content}}',
        description: 'This is a test command',
      }

      expect(command.description).toBe('This is a test command')
    })

    it('should handle command with slash command', () => {
      const command: CustomCommandDefinition = {
        name: 'Quick Test',
        prompt: 'Test: {{content}}',
        slashCommand: '/quick',
      }

      expect(command.slashCommand).toBe('/quick')
    })

    it('should handle command with keyboard shortcut', () => {
      const command: CustomCommandDefinition = {
        name: 'Shortcut Test',
        prompt: 'Test: {{content}}',
        shortcut: 'mod+shift+t',
      }

      expect(command.shortcut).toBe('mod+shift+t')
    })
  })
})
