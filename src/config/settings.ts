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
