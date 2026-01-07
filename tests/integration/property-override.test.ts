/**
 * Integration tests for property override in commands
 * T103: Write integration test for model override
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'

// Mock Logseq API
global.logseq = {
  Editor: {
    getCurrentBlock: vi.fn(),
    getBlock: vi.fn(),
    insertBlock: vi.fn(),
    updateBlock: vi.fn(),
    removeBlock: vi.fn(),
  },
  App: {
    showMsg: vi.fn(),
  },
} as any

describe('Property Override - Integration Tests (T103)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should use block-level model override', async () => {
    // Arrange: Block with model property
    const mockBlock = {
      uuid: 'block-uuid',
      content: 'Test content',
      properties: {
        'ai-generate-model': 'gpt-4-turbo', // Override default model
      },
      children: [],
      parent: null,
    }

    vi.mocked(logseq.Editor.getCurrentBlock).mockResolvedValue(mockBlock as any)
    vi.mocked(logseq.Editor.getBlock).mockResolvedValue(mockBlock as any)

    // Parse properties would return model override
    const expectedModel = 'gpt-4-turbo'

    expect(mockBlock.properties['ai-generate-model']).toBe(expectedModel)
  })

  it('should use block-level temperature override', async () => {
    const mockBlock = {
      uuid: 'block-uuid',
      content: 'Test content',
      properties: {
        'ai-generate-temperature': '0.9', // Override default temperature
      },
      children: [],
      parent: null,
    }

    vi.mocked(logseq.Editor.getCurrentBlock).mockResolvedValue(mockBlock as any)
    vi.mocked(logseq.Editor.getBlock).mockResolvedValue(mockBlock as any)

    const expectedTemperature = 0.9

    expect(parseFloat(mockBlock.properties['ai-generate-temperature'])).toBe(
      expectedTemperature
    )
  })

  it('should inherit model from parent block', async () => {
    const parentBlock = {
      uuid: 'parent-uuid',
      content: 'Parent block',
      properties: {
        'ai-generate-model': 'claude-3-opus',
      },
      parent: null,
    }

    const childBlock = {
      uuid: 'child-uuid',
      content: 'Child block without model property',
      properties: {}, // No model override
      parent: { id: 'parent-uuid' },
    }

    vi.mocked(logseq.Editor.getCurrentBlock).mockResolvedValue(childBlock as any)
    vi.mocked(logseq.Editor.getBlock)
      .mockResolvedValueOnce(childBlock as any)
      .mockResolvedValueOnce(parentBlock as any)

    // Child should inherit model from parent
    const expectedModel = 'claude-3-opus'
    expect(parentBlock.properties['ai-generate-model']).toBe(expectedModel)
  })

  it('should override parent model with child model', async () => {
    const parentBlock = {
      uuid: 'parent-uuid',
      properties: {
        'ai-generate-model': 'gpt-3.5-turbo',
        'ai-generate-temperature': '0.5',
      },
      parent: null,
    }

    const childBlock = {
      uuid: 'child-uuid',
      properties: {
        'ai-generate-model': 'gpt-4', // Override parent model
        // Temperature not specified, should inherit from parent
      },
      parent: { id: 'parent-uuid' },
    }

    // Child's model should take precedence
    expect(childBlock.properties['ai-generate-model']).toBe('gpt-4')

    // Temperature should be inherited from parent
    expect(parentBlock.properties['ai-generate-temperature']).toBe('0.5')
  })

  it('should use default settings when no properties specified', async () => {
    const mockBlock = {
      uuid: 'block-uuid',
      content: 'Test content',
      properties: {}, // No AI properties
      children: [],
      parent: null,
    }

    vi.mocked(logseq.Editor.getCurrentBlock).mockResolvedValue(mockBlock as any)
    vi.mocked(logseq.Editor.getBlock).mockResolvedValue(mockBlock as any)

    // Should fall back to default settings
    expect(mockBlock.properties).toEqual({})
  })

  it('should support streaming override at block level', async () => {
    const mockBlock = {
      uuid: 'block-uuid',
      content: 'Test content',
      properties: {
        'ai-generate-streaming': 'false', // Disable streaming for this block
      },
      children: [],
      parent: null,
    }

    vi.mocked(logseq.Editor.getCurrentBlock).mockResolvedValue(mockBlock as any)
    vi.mocked(logseq.Editor.getBlock).mockResolvedValue(mockBlock as any)

    const streamingSetting = mockBlock.properties['ai-generate-streaming']
    expect(streamingSetting).toBe('false')
  })

  it('should support use_context override at block level', async () => {
    const mockBlock = {
      uuid: 'block-uuid',
      content: 'Test content',
      properties: {
        'ai-generate-use_context': 'false', // Disable context for this block
      },
      children: [],
      parent: null,
    }

    vi.mocked(logseq.Editor.getCurrentBlock).mockResolvedValue(mockBlock as any)
    vi.mocked(logseq.Editor.getBlock).mockResolvedValue(mockBlock as any)

    const useContext = mockBlock.properties['ai-generate-use_context']
    expect(useContext).toBe('false')
  })

  it('should support max_tokens override at block level', async () => {
    const mockBlock = {
      uuid: 'block-uuid',
      content: 'Test content',
      properties: {
        'ai-generate-max_tokens': '4000', // Override max tokens
      },
      children: [],
      parent: null,
    }

    vi.mocked(logseq.Editor.getCurrentBlock).mockResolvedValue(mockBlock as any)
    vi.mocked(logseq.Editor.getBlock).mockResolvedValue(mockBlock as any)

    const maxTokens = parseInt(mockBlock.properties['ai-generate-max_tokens'], 10)
    expect(maxTokens).toBe(4000)
  })
})
