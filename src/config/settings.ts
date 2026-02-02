/**
 * Settings schema and default configuration
 * T018: Implement settings schema and defaults
 */

import type { ModelConfiguration } from '../types'

/**
 * Plugin settings interface
 * Maps to Logseq plugin settings UI
 */
export interface PluginSettings {
  /** LLM endpoint configuration */
  llm: ModelConfiguration

  /** Enable debug logging */
  debugMode: boolean

  /** Default context strategy for commands */
  defaultContextStrategy: 'none' | 'page' | 'block' | 'selection'

  /** Show streaming updates in real-time */
  enableStreaming: boolean

  /** Update interval for streaming (milliseconds) */
  streamingUpdateInterval: number

  /** Enable custom commands from ai-command-config page */
  enableCustomCommands: boolean

  /** Refresh interval for custom commands (milliseconds) */
  customCommandRefreshInterval: number

  /** Enable automatic formatting of LLM output */
  enableFormatting: boolean

  /** Log formatting modifications for debugging */
  logFormattingModifications: boolean
}

/**
 * Default plugin settings
 * Designed for local Ollama installation
 */
export const DEFAULT_SETTINGS: PluginSettings = {
  llm: {
    baseURL: 'http://localhost:11434',
    apiPath: '/v1/chat/completions',
    modelName: 'llama3',
    apiKey: null,
    temperature: 0.7,
    topP: 0.9,
    maxTokens: null, // Unlimited
    streamingEnabled: true,
    timeoutSeconds: 30,
    retryCount: 3,
    maxContextTokens: 8000,
  },
  debugMode: false,
  defaultContextStrategy: 'none',
  enableStreaming: true,
  streamingUpdateInterval: 50, // 50ms for smooth updates
  enableCustomCommands: true,
  customCommandRefreshInterval: 5000, // 5 seconds
  enableFormatting: true, // Enable by default to fix formatting issues
  logFormattingModifications: true, // Log by default for debugging
}

/**
 * Settings schema for Logseq plugin settings UI
 * Used by logseq.useSettingsSchema()
 */
export const SETTINGS_SCHEMA = [
  {
    key: 'llm.baseURL',
    type: 'string',
    title: 'LLM Endpoint URL',
    description: 'Base URL for the LLM API (e.g., http://localhost:11434)',
    default: DEFAULT_SETTINGS.llm.baseURL,
  },
  {
    key: 'llm.apiPath',
    type: 'string',
    title: 'API Path',
    description: 'API endpoint path (e.g., /v1/chat/completions)',
    default: DEFAULT_SETTINGS.llm.apiPath,
  },
  {
    key: 'llm.modelName',
    type: 'string',
    title: 'Model Name',
    description: 'Model identifier (e.g., llama3, gpt-4)',
    default: DEFAULT_SETTINGS.llm.modelName,
  },
  {
    key: 'llm.apiKey',
    type: 'string',
    title: 'API Key',
    description: 'Authentication key (optional, leave empty for local models)',
    default: '',
  },
  {
    key: 'llm.temperature',
    type: 'number',
    title: 'Temperature',
    description: 'Sampling temperature (0.0-2.0, higher = more creative)',
    default: DEFAULT_SETTINGS.llm.temperature,
  },
  {
    key: 'llm.topP',
    type: 'number',
    title: 'Top P',
    description: 'Nucleus sampling parameter (0.0-1.0)',
    default: DEFAULT_SETTINGS.llm.topP,
  },
  {
    key: 'llm.maxTokens',
    type: 'number',
    title: 'Max Tokens',
    description: 'Maximum tokens in response (leave empty for unlimited)',
    default: 0,
  },
  {
    key: 'llm.streamingEnabled',
    type: 'boolean',
    title: 'Enable Streaming',
    description: 'Stream responses in real-time',
    default: DEFAULT_SETTINGS.llm.streamingEnabled,
  },
  {
    key: 'llm.timeoutSeconds',
    type: 'number',
    title: 'Timeout (seconds)',
    description: 'Request timeout in seconds',
    default: DEFAULT_SETTINGS.llm.timeoutSeconds,
  },
  {
    key: 'llm.retryCount',
    type: 'number',
    title: 'Retry Count',
    description: 'Number of retries on failure',
    default: DEFAULT_SETTINGS.llm.retryCount,
  },
  {
    key: 'llm.maxContextTokens',
    type: 'number',
    title: 'Max Context Tokens',
    description: 'Maximum context length in tokens',
    default: DEFAULT_SETTINGS.llm.maxContextTokens,
  },
  {
    key: 'debugMode',
    type: 'boolean',
    title: 'Debug Mode',
    description: 'Enable detailed debug logging',
    default: DEFAULT_SETTINGS.debugMode,
  },
  {
    key: 'defaultContextStrategy',
    type: 'enum',
    title: 'Default Context Strategy',
    description: 'Default context extraction strategy for commands',
    default: DEFAULT_SETTINGS.defaultContextStrategy,
    enumChoices: ['none', 'page', 'block', 'selection'],
    enumPicker: 'select',
  },
  {
    key: 'enableStreaming',
    type: 'boolean',
    title: 'Enable Streaming UI',
    description: 'Show streaming updates in real-time',
    default: DEFAULT_SETTINGS.enableStreaming,
  },
  {
    key: 'streamingUpdateInterval',
    type: 'number',
    title: 'Streaming Update Interval (ms)',
    description: 'Milliseconds between streaming updates (lower = smoother)',
    default: DEFAULT_SETTINGS.streamingUpdateInterval,
  },
  {
    key: 'enableCustomCommands',
    type: 'boolean',
    title: 'Enable Custom Commands',
    description: 'Load custom commands from ai-command-config page',
    default: DEFAULT_SETTINGS.enableCustomCommands,
  },
  {
    key: 'customCommandRefreshInterval',
    type: 'number',
    title: 'Custom Command Refresh Interval (ms)',
    description: 'Milliseconds between custom command refreshes',
    default: DEFAULT_SETTINGS.customCommandRefreshInterval,
  },
  {
    key: 'enableFormatting',
    type: 'boolean',
    title: 'Enable Output Formatting',
    description:
      'Automatically format LLM output to prevent Logseq block structure issues (recommended)',
    default: DEFAULT_SETTINGS.enableFormatting,
  },
  {
    key: 'logFormattingModifications',
    type: 'boolean',
    title: 'Log Formatting Changes',
    description: 'Log when formatting modifications are applied (useful for debugging)',
    default: DEFAULT_SETTINGS.logFormattingModifications,
  },
]

/**
 * Convert flat Logseq settings to nested structure
 * Logseq stores settings as: { 'llm.baseURL': '...' }
 * We need: { llm: { baseURL: '...' } }
 */
function unflattenSettings(flatSettings: Record<string, any>): Partial<PluginSettings> {
  const result: any = {}

  for (const [key, value] of Object.entries(flatSettings)) {
    if (key.startsWith('llm.')) {
      // Extract llm property name
      const llmKey = key.substring(4) // Remove 'llm.' prefix
      if (!result.llm) {
        result.llm = {}
      }
      result.llm[llmKey] = value
    } else {
      // Top-level property
      result[key] = value
    }
  }

  return result
}

/**
 * Merge user settings with defaults
 * Ensures all required fields are present
 */
export function mergeSettings(userSettings: Partial<PluginSettings> | Record<string, any>): PluginSettings {
  // First unflatten if needed (Logseq stores settings flat)
  const unflattened = userSettings && typeof userSettings === 'object' && !('llm' in userSettings)
    ? unflattenSettings(userSettings)
    : userSettings as Partial<PluginSettings>

  return {
    ...DEFAULT_SETTINGS,
    ...unflattened,
    llm: {
      ...DEFAULT_SETTINGS.llm,
      ...unflattened.llm,
    },
  }
}

/**
 * Validate settings values
 * Returns array of validation errors (empty if valid)
 */
export function validateSettings(settings: PluginSettings): string[] {
  const errors: string[] = []

  // Validate LLM configuration
  if (!settings.llm.baseURL) {
    errors.push('LLM base URL is required')
  }

  if (!settings.llm.apiPath) {
    errors.push('API path is required')
  }

  if (!settings.llm.modelName) {
    errors.push('Model name is required')
  }

  if (settings.llm.temperature < 0 || settings.llm.temperature > 2) {
    errors.push('Temperature must be between 0.0 and 2.0')
  }

  if (settings.llm.topP < 0 || settings.llm.topP > 1) {
    errors.push('Top P must be between 0.0 and 1.0')
  }

  if (settings.llm.timeoutSeconds <= 0) {
    errors.push('Timeout must be positive')
  }

  if (settings.llm.retryCount < 0) {
    errors.push('Retry count must be non-negative')
  }

  if (settings.llm.maxContextTokens <= 0) {
    errors.push('Max context tokens must be positive')
  }

  // Validate streaming settings
  if (settings.streamingUpdateInterval < 10) {
    errors.push('Streaming update interval must be at least 10ms')
  }

  if (settings.customCommandRefreshInterval < 1000) {
    errors.push('Custom command refresh interval must be at least 1000ms')
  }

  return errors
}

/**
 * T112: Settings persistence helpers via Logseq storage API
 */

/**
 * Current settings version for migration tracking
 */
const SETTINGS_VERSION = 1

/**
 * Save settings to Logseq storage
 * Uses Logseq's built-in settings persistence
 */
export async function saveSettings(settings: PluginSettings): Promise<void> {
  try {
    // Validate before saving
    const errors = validateSettings(settings)
    if (errors.length > 0) {
      throw new Error(`Invalid settings: ${errors.join(', ')}`)
    }

    // Flatten settings for Logseq storage format
    const flattened = flattenSettings(settings)

    // Add version for migration tracking
    flattened['__version'] = SETTINGS_VERSION

    await logseq.updateSettings(flattened)
  } catch (error) {
    throw new Error(`Failed to save settings: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

/**
 * Load settings from Logseq storage
 * Returns merged settings with defaults
 */
export async function loadSettings(): Promise<PluginSettings> {
  try {
    const stored = logseq.settings as Record<string, any>

    if (!stored || Object.keys(stored).length === 0) {
      // No settings stored, return defaults
      return DEFAULT_SETTINGS
    }

    // Check if migration needed
    const storedVersion = stored['__version'] as number | undefined
    if (storedVersion !== SETTINGS_VERSION) {
      const migrated = migrateSettings(stored, storedVersion || 0)
      await saveSettings(migrated)
      return migrated
    }

    return mergeSettings(stored)
  } catch (error) {
    console.error('Failed to load settings, using defaults:', error)
    return DEFAULT_SETTINGS
  }
}

/**
 * Flatten nested settings for Logseq storage
 * Converts { llm: { baseURL: '...' } } to { 'llm.baseURL': '...' }
 */
function flattenSettings(settings: PluginSettings): Record<string, any> {
  const flat: Record<string, any> = {}

  // Flatten LLM settings
  for (const [key, value] of Object.entries(settings.llm)) {
    flat[`llm.${key}`] = value
  }

  // Top-level settings
  flat['debugMode'] = settings.debugMode
  flat['defaultContextStrategy'] = settings.defaultContextStrategy
  flat['enableStreaming'] = settings.enableStreaming
  flat['streamingUpdateInterval'] = settings.streamingUpdateInterval
  flat['enableCustomCommands'] = settings.enableCustomCommands
  flat['customCommandRefreshInterval'] = settings.customCommandRefreshInterval

  return flat
}

/**
 * T115: Settings migration support
 * Migrates settings from older versions to current version
 */
export function migrateSettings(
  oldSettings: Record<string, any>,
  fromVersion: number
): PluginSettings {
  let settings = mergeSettings(oldSettings)

  // Migration from version 0 to 1
  if (fromVersion < 1) {
    // Example: Rename old settings or add new defaults
    // For now, just ensure all defaults are present
    settings = mergeSettings(settings)
  }

  // Future migrations can be added here
  // if (fromVersion < 2) { ... }

  return settings
}

/**
 * Reset settings to defaults
 */
export async function resetSettings(): Promise<void> {
  await saveSettings(DEFAULT_SETTINGS)
}

/**
 * Export settings as JSON
 * Useful for backup or sharing configurations
 */
export function exportSettings(settings: PluginSettings): string {
  return JSON.stringify(settings, null, 2)
}

/**
 * Import settings from JSON
 * Validates before returning
 */
export function importSettings(json: string): PluginSettings {
  try {
    const parsed = JSON.parse(json)
    const settings = mergeSettings(parsed)

    // Validate
    const errors = validateSettings(settings)
    if (errors.length > 0) {
      throw new Error(`Invalid settings: ${errors.join(', ')}`)
    }

    return settings
  } catch (error) {
    throw new Error(`Failed to import settings: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

/**
 * T110: Documentation for block-level property inheritance
 *
 * ## Block Properties for AI Commands
 *
 * You can override AI settings at the block level using properties.
 * These properties cascade from parent blocks to child blocks.
 *
 * ### Supported Properties
 *
 * - `ai-generate-model`: Override the model to use (e.g., "gpt-4", "claude-3-opus")
 * - `ai-generate-temperature`: Override temperature (0.0-2.0, controls randomness)
 * - `ai-generate-top_p`: Override top-p (0.0-1.0, nucleus sampling)
 * - `ai-generate-max_tokens`: Override maximum tokens in response
 * - `ai-generate-use_context`: Override context inclusion (true/false)
 * - `ai-generate-streaming`: Override streaming mode (true/false)
 *
 * ### Property Inheritance
 *
 * Properties are inherited from parent blocks to child blocks:
 *
 * ```
 * - Parent Block
 *   ai-generate-model:: gpt-4
 *   ai-generate-temperature:: 0.8
 *   - Child Block 1
 *     (inherits: model=gpt-4, temperature=0.8)
 *   - Child Block 2
 *     ai-generate-temperature:: 0.3
 *     (inherits: model=gpt-4, overrides: temperature=0.3)
 * ```
 *
 * ### Precedence Rules
 *
 * 1. Block-level properties override parent properties
 * 2. Parent properties override grandparent properties
 * 3. Root-level properties override plugin defaults
 * 4. Plugin defaults are used when no properties are set
 *
 * ### Example Usage
 *
 * **Use GPT-4 for an entire page:**
 * ```
 * - Page Title
 *   ai-generate-model:: gpt-4
 *   - All child blocks will use GPT-4
 *   - Unless they override with their own model
 * ```
 *
 * **Use high temperature for creative writing:**
 * ```
 * - Creative Writing Section
 *   ai-generate-temperature:: 1.2
 *   - Story prompt here
 *     (uses temperature 1.2 for more creativity)
 * ```
 *
 * **Use specific model for code explanation:**
 * ```
 * - Code snippet
 *   ai-generate-model:: claude-3-opus
 *   function example() { ... }
 *   - Explain this code
 *     (will use Claude Opus for better code understanding)
 * ```
 *
 * ### Validation
 *
 * All property values are validated:
 * - Invalid values are logged as warnings but don't break commands
 * - Out-of-range values (e.g., temperature > 2.0) are rejected
 * - String values are coerced to appropriate types (e.g., "true" → boolean)
 * - Invalid property names are ignored
 */
