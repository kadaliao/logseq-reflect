/**
 * Plugin entry point with lifecycle hooks
 * T034: Create plugin entry point with lifecycle hooks
 */

import { createLogger } from './utils/logger'
import { SETTINGS_SCHEMA, DEFAULT_SETTINGS, mergeSettings } from './config/settings'
import { executeAskCommand } from './commands/ask'
import {
  handleAskWithPageContext,
  handleAskWithBlockContext,
} from './commands/context'
import { handleSummarizePage, handleSummarizeBlock } from './commands/summarize'
import { handleGenerateFlashcard } from './commands/flashcard'
import { handleDivideIntoSubtasks } from './commands/tasks'
import { executeCustomCommand } from './commands/custom'
import { loadCustomCommands, commandToKey } from './config/loader'
import { registerNavigationHandler, cleanupAllHandlers } from './llm/response-handler'
import type { PluginSettings } from './config/settings'
import type { CustomCommandDefinition } from './config/loader'

const logger = createLogger('PluginMain')

/**
 * Main plugin initialization
 * Called when Logseq loads the plugin
 */
async function main(): Promise<void> {
  logger.info('Plugin initializing', {
    version: '0.1.0',
  })

  try {
    // Register settings schema
    logseq.useSettingsSchema(SETTINGS_SCHEMA)

    // Initialize settings with defaults if not set
    if (!logseq.settings) {
      await logseq.updateSettings(DEFAULT_SETTINGS)
      logger.info('Settings initialized with defaults')
    }

    // Enable debug mode if configured
    const debugMode = logseq.settings?.debugMode ?? false
    logger.setDebugMode(debugMode)

    // T125: Register navigation handler for request cancellation
    registerNavigationHandler()

    // Register commands (T044-T046)
    await registerCommands()

    logger.info('Plugin initialized successfully', {
      debugMode,
    })

    // Show ready message
    await logseq.App.showMsg('Logseq AI Plugin loaded successfully', 'success')
  } catch (error) {
    logger.error('Plugin initialization failed', error as Error)
    await logseq.App.showMsg('Failed to initialize AI Plugin', 'error')
  }
}

/**
 * Register AI commands
 * T044: Register Ask AI command in registry with toolbar button
 * T045: Register keyboard shortcut for command palette
 * T046: Register slash command /ai
 * T061: Register context-aware commands in registry
 */
async function registerCommands(): Promise<void> {
  logger.info('Registering commands')

  // Helper to get current settings (reads fresh each time)
  const getCurrentSettings = () => {
    const settings = mergeSettings(logseq.settings as Partial<PluginSettings>)

    // Debug: Log current settings
    logger.debug('Current settings', {
      baseURL: settings.llm.baseURL,
      modelName: settings.llm.modelName,
      streaming: settings.llm.streamingEnabled,
    })

    return settings
  }

  // T044: Register Ask AI command in command palette (no keybinding to avoid conflicts)
  logseq.App.registerCommandPalette(
    {
      key: 'ask-ai',
      label: 'Ask AI',
    },
    async () => {
      await executeAskCommand(getCurrentSettings())
    }
  )

  // T061: Register "Ask with Page Context" command (no keybinding to avoid conflicts)
  logseq.App.registerCommandPalette(
    {
      key: 'ask-ai-page-context',
      label: 'Ask AI with Page Context',
    },
    async () => {
      // Get input from current block
      const currentBlock = await logseq.Editor.getCurrentBlock()
      const input = currentBlock?.content || ''

      if (!input.trim()) {
        await logseq.App.showMsg(
          '💡 Please write your instruction or question in a block first',
          'warning'
        )
        return
      }

      await handleAskWithPageContext(input, getCurrentSettings())
    }
  )

  // T061: Register "Ask with Block Context" command (no keybinding to avoid conflicts)
  logseq.App.registerCommandPalette(
    {
      key: 'ask-ai-block-context',
      label: 'Ask AI with Block Context',
    },
    async () => {
      // Get input from current block
      const currentBlock = await logseq.Editor.getCurrentBlock()
      const input = currentBlock?.content || ''

      if (!input.trim()) {
        await logseq.App.showMsg(
          '💡 Please write your instruction or question in a block first',
          'warning'
        )
        return
      }

      await handleAskWithBlockContext(input, getCurrentSettings())
    }
  )

  // T044: Register toolbar button
  logseq.App.registerUIItem('toolbar', {
    key: 'ask-ai-toolbar',
    template: `
      <a class="button" data-on-click="askAI" title="Ask AI">
        <i class="ti ti-message-circle"></i>
      </a>
    `,
  })

  // Handle toolbar button click
  logseq.App.onMacroRendererSlotted(async ({ payload }: { slot: unknown; payload: { arguments: string[] } }) => {
    const [type] = payload.arguments
    if (type === 'askAI') {
      await executeAskCommand(getCurrentSettings())
    }
  })

  // T046: Register slash command /ai
  logseq.Editor.registerSlashCommand('ai', async () => {
    await executeAskCommand(getCurrentSettings())
  })

  // T061: Register slash command /ai-page for page context
  logseq.Editor.registerSlashCommand('ai-page', async () => {
    const currentBlock = await logseq.Editor.getCurrentBlock()
    const input = currentBlock?.content || ''

    if (!input.trim()) {
      await logseq.App.showMsg(
        '💡 Please write your instruction or question in a block first',
        'warning'
      )
      return
    }

    await handleAskWithPageContext(input, getCurrentSettings())
  })

  // T061: Register slash command /ai-block for block context
  logseq.Editor.registerSlashCommand('ai-block', async () => {
    const currentBlock = await logseq.Editor.getCurrentBlock()
    const input = currentBlock?.content || ''

    if (!input.trim()) {
      await logseq.App.showMsg(
        '💡 Please write your instruction or question in a block first',
        'warning'
      )
      return
    }

    await handleAskWithBlockContext(input, getCurrentSettings())
  })

  // T071: Register "Summarize Page" command (no keybinding to avoid conflicts)
  logseq.App.registerCommandPalette(
    {
      key: 'summarize-page',
      label: 'Summarize Page',
    },
    async () => {
      await handleSummarizePage(getCurrentSettings())
    }
  )

  // T071: Register slash command /summarize-page
  logseq.Editor.registerSlashCommand('summarize-page', async () => {
    await handleSummarizePage(getCurrentSettings())
  })

  // T071: Register "Summarize Block" command (no keybinding to avoid conflicts)
  logseq.App.registerCommandPalette(
    {
      key: 'summarize-block',
      label: 'Summarize Block',
    },
    async () => {
      await handleSummarizeBlock(getCurrentSettings())
    }
  )

  // T071: Register slash command /summarize-block
  logseq.Editor.registerSlashCommand('summarize-block', async () => {
    await handleSummarizeBlock(getCurrentSettings())
  })

  // T079: Register "Generate Flashcard" command (no keybinding to avoid conflicts)
  logseq.App.registerCommandPalette(
    {
      key: 'generate-flashcard',
      label: 'Generate Flashcard',
    },
    async () => {
      await handleGenerateFlashcard(getCurrentSettings())
    }
  )

  // T079: Register slash command /flashcard
  logseq.Editor.registerSlashCommand('flashcard', async () => {
    await handleGenerateFlashcard(getCurrentSettings())
  })

  // T088: Register "Divide into Subtasks" command (no keybinding to avoid conflicts)
  logseq.App.registerCommandPalette(
    {
      key: 'divide-into-subtasks',
      label: 'Divide into Subtasks',
    },
    async () => {
      await handleDivideIntoSubtasks(getCurrentSettings())
    }
  )

  // T088: Register slash command /divide or /subtasks
  logseq.Editor.registerSlashCommand('divide', async () => {
    await handleDivideIntoSubtasks(getCurrentSettings())
  })

  logseq.Editor.registerSlashCommand('subtasks', async () => {
    await handleDivideIntoSubtasks(getCurrentSettings())
  })

  // T098: Load and register custom commands from ai-command-config page
  await registerCustomCommands(getCurrentSettings)

  logger.info('Commands registered successfully')
}

/**
 * T098: Register custom commands from configuration
 * Loads commands from ai-command-config page and registers them
 */
async function registerCustomCommands(
  getSettings: () => PluginSettings
): Promise<void> {
  try {
    const customCommands = await loadCustomCommands()

    if (customCommands.length === 0) {
      logger.debug('No custom commands found')
      return
    }

    logger.info(`Registering ${customCommands.length} custom command(s)`)

    for (const command of customCommands) {
      const commandKey = commandToKey(command.name)

      // Register in command palette
      logseq.App.registerCommandPalette(
        {
          key: `custom-${commandKey}`,
          label: command.name,
        },
        async () => {
          await executeCustomCommand(command, getSettings())
        }
      )

      // Register slash command if specified
      if (command.slashCommand) {
        const slashCmd = command.slashCommand.startsWith('/')
          ? command.slashCommand.substring(1)
          : command.slashCommand

        logseq.Editor.registerSlashCommand(slashCmd, async () => {
          await executeCustomCommand(command, getSettings())
        })

        logger.debug('Registered custom slash command', {
          name: command.name,
          slashCommand: command.slashCommand,
        })
      }

      logger.debug('Registered custom command', { name: command.name })
    }

    logger.info('Custom commands registered successfully')
  } catch (error) {
    logger.error('Failed to register custom commands', error as Error)
    // Don't fail plugin initialization if custom commands fail
  }
}

/**
 * Plugin cleanup on unload
 * T124: Add memory cleanup on plugin unload
 * Called when Logseq unloads the plugin
 */
function cleanup(): void {
  logger.info('Plugin unloading')

  try {
    // T124: Clear any pending batched updates from response handler
    // T125: Cancel all in-flight requests
    cleanupAllHandlers()

    // Clear any cached data
    // Note: Property cache clearing would go here if we had a global cache

    // Remove any event listeners
    // Note: Logseq automatically cleans up registered commands

    logger.info('Plugin cleanup completed successfully')
  } catch (error) {
    logger.error('Error during plugin cleanup', error as Error)
  }

  logger.info('Plugin unloaded successfully')
}

// Bootstrap plugin
logseq.ready(main).catch((error: Error) => {
  console.error('Fatal error during plugin initialization:', error)
})

// Register cleanup handler
logseq.beforeunload(cleanup)

// Export for testing
export { main, cleanup }
