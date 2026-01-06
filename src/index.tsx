/**
 * Plugin entry point with lifecycle hooks
 * T034: Create plugin entry point with lifecycle hooks
 */

import { createLogger } from './utils/logger'
import { SETTINGS_SCHEMA, DEFAULT_SETTINGS, mergeSettings } from './config/settings'
import { executeAskCommand } from './commands/ask'
import type { PluginSettings } from './config/settings'

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

  // T044: Register Ask AI command in command palette
  logseq.App.registerCommandPalette(
    {
      key: 'ask-ai',
      label: 'Ask AI',
      keybinding: {
        binding: 'mod+shift+a', // T045: Cmd/Ctrl+Shift+A
      },
    },
    async () => {
      await executeAskCommand(getCurrentSettings())
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

  logger.info('Commands registered successfully')
}

/**
 * Plugin cleanup on unload
 * Called when Logseq unloads the plugin
 */
function cleanup(): void {
  logger.info('Plugin unloading')

  // Clear any caches or resources
  // This will be expanded in future phases

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
