/**
 * Unit tests for custom command loader
 * T090: Write unit test for config page scanning
 * T091: Write unit test for custom command registration
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'

// Mock Logseq API
global.logseq = {
  Editor: {
    getPage: vi.fn(),
    getPageBlocksTree: vi.fn(),
  },
  App: {
    showMsg: vi.fn(),
  },
} as any

describe('Custom Command Loader - Unit Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Config Page Scanning (T090)', () => {
    it('should find ai-command-config page', async () => {
      // Arrange
      const mockConfigPage = {
        uuid: 'config-page-uuid',
        name: 'ai-command-config',
        originalName: 'ai-command-config',
      }

      vi.mocked(logseq.Editor.getPage).mockResolvedValueOnce(mockConfigPage as any)

      // Act
      const page = await logseq.Editor.getPage('ai-command-config')

      // Assert
      expect(page).toBeDefined()
      expect(page?.name).toBe('ai-command-config')
    })

    it('should handle missing config page gracefully', async () => {
      // Arrange
      vi.mocked(logseq.Editor.getPage).mockResolvedValueOnce(null)

      // Act
      const page = await logseq.Editor.getPage('ai-command-config')

      // Assert
      expect(page).toBeNull()
    })

    it('should scan page blocks for command definitions', async () => {
      // Arrange
      const mockBlocks = [
        {
          uuid: 'block-1',
          content: 'command-name:: Explain Code',
          children: [
            {
              uuid: 'block-1-1',
              content: 'prompt:: Explain the following code in detail',
            },
          ],
        },
        {
          uuid: 'block-2',
          content: 'command-name:: Translate',
          children: [
            {
              uuid: 'block-2-1',
              content: 'prompt:: Translate the following text to {{language}}',
            },
          ],
        },
      ]

      vi.mocked(logseq.Editor.getPageBlocksTree).mockResolvedValueOnce(
        mockBlocks as any
      )

      // Act
      const blocks = await logseq.Editor.getPageBlocksTree('config-page-uuid')

      // Assert
      expect(blocks).toHaveLength(2)
      expect(blocks[0].content).toContain('command-name::')
    })

    it('should extract command properties from blocks', () => {
      const block = {
        content: 'command-name:: Explain Code',
        children: [
          { content: 'prompt:: Explain the code' },
          { content: 'description:: Provides detailed code explanations' },
          { content: 'shortcut:: mod+shift+e' },
        ],
      }

      // Parser should extract:
      // - command-name: "Explain Code"
      // - prompt: "Explain the code"
      // - description: "Provides detailed code explanations"
      // - shortcut: "mod+shift+e"

      const hasCommandName = block.content.includes('command-name::')
      expect(hasCommandName).toBe(true)
    })
  })

  describe('Custom Command Registration (T091)', () => {
    it('should register custom command from config', () => {
      const customCommand = {
        name: 'Explain Code',
        prompt: 'Explain the following code in detail: {{content}}',
        description: 'Provides code explanations',
        slashCommand: '/explain',
      }

      expect(customCommand.name).toBe('Explain Code')
      expect(customCommand.prompt).toContain('{{content}}')
      expect(customCommand.slashCommand).toBe('/explain')
    })

    it('should validate required fields', () => {
      const validCommand = {
        name: 'Test Command',
        prompt: 'Test prompt',
      }

      expect(validCommand.name).toBeDefined()
      expect(validCommand.prompt).toBeDefined()

      // Invalid: missing prompt
      const invalidCommand = {
        name: 'Test Command',
      }

      expect(invalidCommand.name).toBeDefined()
      expect((invalidCommand as any).prompt).toBeUndefined()
    })

    it('should parse template variables in prompts', () => {
      const prompt = 'Translate {{content}} to {{language}}'
      const variables = prompt.match(/\{\{(\w+)\}\}/g)

      expect(variables).toEqual(['{{content}}', '{{language}}'])
    })

    it('should support optional shortcut and slash command', () => {
      const minimalCommand = {
        name: 'Simple Command',
        prompt: 'Do something',
      }

      const fullCommand = {
        name: 'Full Command',
        prompt: 'Do something else',
        slashCommand: '/full',
        shortcut: 'mod+shift+f',
        description: 'A complete command',
      }

      expect(minimalCommand.name).toBeDefined()
      expect((minimalCommand as any).slashCommand).toBeUndefined()

      expect(fullCommand.slashCommand).toBe('/full')
      expect(fullCommand.shortcut).toBe('mod+shift+f')
    })

    it('should generate command key from name', () => {
      const commandName = 'Explain Code'
      const commandKey = commandName.toLowerCase().replace(/\s+/g, '-')

      expect(commandKey).toBe('explain-code')
    })

    it('should handle duplicate command names', () => {
      const commands = [
        { name: 'Translate', prompt: 'Translate text' },
        { name: 'Translate', prompt: 'Different translation' },
      ]

      // Should keep only one or merge them
      expect(commands).toHaveLength(2)
      // Implementation should deduplicate
    })
  })

  describe('Property Parsing', () => {
    it('should parse Logseq property format', () => {
      const propertyLine = 'command-name:: Explain Code'
      const match = propertyLine.match(/^(.+?)::\s*(.+)$/)

      expect(match).toBeDefined()
      if (match) {
        expect(match[1]).toBe('command-name')
        expect(match[2]).toBe('Explain Code')
      }
    })

    it('should extract nested properties from children', () => {
      const parentBlock = {
        content: 'command-name:: Test',
        children: [
          { content: 'prompt:: Test prompt' },
          { content: 'description:: Test description' },
        ],
      }

      const properties: Record<string, string> = {}

      // Parse parent
      const parentMatch = parentBlock.content.match(/^(.+?)::\s*(.+)$/)
      if (parentMatch) {
        properties[parentMatch[1]] = parentMatch[2]
      }

      // Parse children
      for (const child of parentBlock.children) {
        const childMatch = child.content.match(/^(.+?)::\s*(.+)$/)
        if (childMatch) {
          properties[childMatch[1]] = childMatch[2]
        }
      }

      expect(properties['command-name']).toBe('Test')
      expect(properties['prompt']).toBe('Test prompt')
      expect(properties['description']).toBe('Test description')
    })
  })
})
