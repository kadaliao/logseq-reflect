/**
 * Custom command loader
 * T093: Implement custom command loader
 * T094: Implement ai-command-config page scanner
 * T095: Implement custom command to AICommand converter
 * T096: Add custom command refresh mechanism
 */

import { createLogger } from '../utils/logger'

const logger = createLogger('CustomCommandLoader')

/**
 * Custom command definition from user configuration
 */
export interface CustomCommandDefinition {
  name: string
  prompt: string
  description?: string
  slashCommand?: string
  shortcut?: string
}

/**
 * Config page name where custom commands are defined
 */
const CONFIG_PAGE_NAME = 'ai-command-config'

/**
 * Property keys used in config blocks
 */
const PROPERTY_KEYS = {
  COMMAND_NAME: 'command-name',
  PROMPT: 'prompt',
  DESCRIPTION: 'description',
  SLASH_COMMAND: 'slash-command',
  SHORTCUT: 'shortcut',
}

/**
 * T093: Load custom commands from configuration
 * T094: Scan ai-command-config page for command definitions
 */
export async function loadCustomCommands(): Promise<CustomCommandDefinition[]> {
  logger.info('Loading custom commands from config page')

  try {
    // T094: Find the config page
    const configPage = await logseq.Editor.getPage(CONFIG_PAGE_NAME)

    if (!configPage) {
      logger.debug(`Config page "${CONFIG_PAGE_NAME}" not found, no custom commands loaded`)
      return []
    }

    // Get all blocks in the config page
    const blocks = await logseq.Editor.getPageBlocksTree(configPage.uuid)

    if (!blocks || blocks.length === 0) {
      logger.debug('Config page is empty, no custom commands loaded')
      return []
    }

    // Parse blocks to extract command definitions
    const commands: CustomCommandDefinition[] = []

    for (const block of blocks) {
      const command = parseCommandBlock(block)
      if (command) {
        commands.push(command)
        logger.debug('Loaded custom command', { name: command.name })
      }
    }

    logger.info(`Loaded ${commands.length} custom command(s)`)
    return commands
  } catch (error) {
    logger.error('Failed to load custom commands', error as Error)
    return []
  }
}

/**
 * Parse a block and its children to extract command definition
 */
function parseCommandBlock(block: any): CustomCommandDefinition | null {
  const properties = extractProperties(block)

  // Check if this block defines a command (must have command-name)
  const commandName = properties[PROPERTY_KEYS.COMMAND_NAME]
  if (!commandName) {
    return null
  }

  // Prompt is required
  const prompt = properties[PROPERTY_KEYS.PROMPT]
  if (!prompt) {
    logger.warn(`Command "${commandName}" is missing prompt, skipping`)
    return null
  }

  // Build command definition
  const command: CustomCommandDefinition = {
    name: commandName,
    prompt: prompt,
  }

  // Add optional fields
  if (properties[PROPERTY_KEYS.DESCRIPTION]) {
    command.description = properties[PROPERTY_KEYS.DESCRIPTION]
  }

  if (properties[PROPERTY_KEYS.SLASH_COMMAND]) {
    command.slashCommand = properties[PROPERTY_KEYS.SLASH_COMMAND]
  }

  if (properties[PROPERTY_KEYS.SHORTCUT]) {
    command.shortcut = properties[PROPERTY_KEYS.SHORTCUT]
  }

  return command
}

/**
 * Extract properties from block and its children
 * Logseq property format: "key:: value"
 */
function extractProperties(block: any): Record<string, string> {
  const properties: Record<string, string> = {}

  // Parse block content for properties
  const parseProperty = (content: string) => {
    const match = content.match(/^(.+?)::\s*(.+)$/)
    if (match) {
      const key = match[1].trim()
      const value = match[2].trim()
      properties[key] = value
    }
  }

  // Parse current block
  if (block.content) {
    parseProperty(block.content)
  }

  // Parse children blocks
  if (block.children && block.children.length > 0) {
    for (const child of block.children) {
      if (child.content) {
        parseProperty(child.content)
      }
    }
  }

  return properties
}

/**
 * T095: Convert CustomCommandDefinition to command key
 * Generate a unique key for the command (lowercase, hyphenated)
 */
export function commandToKey(commandName: string): string {
  return commandName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
}

/**
 * T096: Refresh custom commands
 * Reload commands from config page and re-register them
 */
let currentCommands: CustomCommandDefinition[] = []
let commandHandlers: Map<string, () => Promise<void>> = new Map()

export async function refreshCustomCommands(
  registerCallback: (command: CustomCommandDefinition) => Promise<void>
): Promise<void> {
  logger.info('Refreshing custom commands')

  try {
    // Load latest commands from config
    const newCommands = await loadCustomCommands()

    // Unregister old commands (if needed)
    // Note: Logseq SDK doesn't support unregistering commands,
    // so we just track the new set
    currentCommands = newCommands

    // Register new commands
    for (const command of newCommands) {
      await registerCallback(command)
    }

    logger.info('Custom commands refreshed successfully')
  } catch (error) {
    logger.error('Failed to refresh custom commands', error as Error)
    throw error
  }
}

/**
 * Get currently loaded custom commands
 */
export function getCurrentCommands(): CustomCommandDefinition[] {
  return [...currentCommands]
}

/**
 * Validate custom command definition
 */
export function validateCommand(command: CustomCommandDefinition): {
  valid: boolean
  errors: string[]
} {
  const errors: string[] = []

  if (!command.name || command.name.trim() === '') {
    errors.push('Command name is required')
  }

  if (!command.prompt || command.prompt.trim() === '') {
    errors.push('Command prompt is required')
  }

  // Check for invalid characters in slash command
  if (command.slashCommand) {
    if (!command.slashCommand.startsWith('/')) {
      errors.push('Slash command must start with /')
    }
    if (command.slashCommand.includes(' ')) {
      errors.push('Slash command cannot contain spaces')
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  }
}

/**
 * Extract template variables from prompt
 * Returns array of variable names (e.g., ["content", "language"])
 */
export function extractTemplateVariables(prompt: string): string[] {
  const matches = prompt.match(/\{\{(\w+)\}\}/g)
  if (!matches) {
    return []
  }

  return matches.map(match => match.slice(2, -2)) // Remove {{ and }}
}
