/**
 * Unit tests for settings management
 * T116: Write unit tests for settings panel
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import type { PluginSettings } from '../../../src/config/settings'

describe('Settings Management - Unit Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('validateSettings', () => {
    it('should validate correct settings', async () => {
      const { validateSettings, DEFAULT_SETTINGS } = await import(
        '../../../src/config/settings'
      )

      const errors = validateSettings(DEFAULT_SETTINGS)
      expect(errors).toEqual([])
    })

    it('should detect missing required fields', async () => {
      const { validateSettings, DEFAULT_SETTINGS } = await import(
        '../../../src/config/settings'
      )

      const invalidSettings = {
        ...DEFAULT_SETTINGS,
        llm: {
          ...DEFAULT_SETTINGS.llm,
          baseURL: '',
        },
      }

      const errors = validateSettings(invalidSettings)
      expect(errors.length).toBeGreaterThan(0)
      expect(errors.some(e => e.includes('base URL'))).toBe(true)
    })

    it('should detect out-of-range temperature', async () => {
      const { validateSettings, DEFAULT_SETTINGS } = await import(
        '../../../src/config/settings'
      )

      const invalidSettings = {
        ...DEFAULT_SETTINGS,
        llm: {
          ...DEFAULT_SETTINGS.llm,
          temperature: 3.0, // Out of range (0-2)
        },
      }

      const errors = validateSettings(invalidSettings)
      expect(errors.some(e => e.includes('Temperature'))).toBe(true)
    })

    it('should detect out-of-range top_p', async () => {
      const { validateSettings, DEFAULT_SETTINGS } = await import(
        '../../../src/config/settings'
      )

      const invalidSettings = {
        ...DEFAULT_SETTINGS,
        llm: {
          ...DEFAULT_SETTINGS.llm,
          topP: 1.5, // Out of range (0-1)
        },
      }

      const errors = validateSettings(invalidSettings)
      expect(errors.some(e => e.includes('Top P'))).toBe(true)
    })

    it('should detect invalid timeout', async () => {
      const { validateSettings, DEFAULT_SETTINGS } = await import(
        '../../../src/config/settings'
      )

      const invalidSettings = {
        ...DEFAULT_SETTINGS,
        llm: {
          ...DEFAULT_SETTINGS.llm,
          timeoutSeconds: -1,
        },
      }

      const errors = validateSettings(invalidSettings)
      expect(errors.some(e => e.includes('Timeout'))).toBe(true)
    })

    it('should detect invalid streaming interval', async () => {
      const { validateSettings, DEFAULT_SETTINGS } = await import(
        '../../../src/config/settings'
      )

      const invalidSettings = {
        ...DEFAULT_SETTINGS,
        streamingUpdateInterval: 5, // Too small (< 10ms)
      }

      const errors = validateSettings(invalidSettings)
      expect(errors.some(e => e.includes('interval'))).toBe(true)
    })
  })

  describe('mergeSettings', () => {
    it('should merge user settings with defaults', async () => {
      const { mergeSettings, DEFAULT_SETTINGS } = await import(
        '../../../src/config/settings'
      )

      const userSettings = {
        llm: {
          modelName: 'gpt-4',
        },
      }

      const merged = mergeSettings(userSettings)

      expect(merged.llm.modelName).toBe('gpt-4')
      expect(merged.llm.baseURL).toBe(DEFAULT_SETTINGS.llm.baseURL)
      expect(merged.llm.temperature).toBe(DEFAULT_SETTINGS.llm.temperature)
    })

    it('should handle flattened settings from Logseq', async () => {
      const { mergeSettings } = await import('../../../src/config/settings')

      const flatSettings = {
        'llm.modelName': 'gpt-4',
        'llm.temperature': 0.8,
        debugMode: true,
      }

      const merged = mergeSettings(flatSettings)

      expect(merged.llm.modelName).toBe('gpt-4')
      expect(merged.llm.temperature).toBe(0.8)
      expect(merged.debugMode).toBe(true)
    })

    it('should preserve all default values', async () => {
      const { mergeSettings, DEFAULT_SETTINGS } = await import(
        '../../../src/config/settings'
      )

      const merged = mergeSettings({})

      expect(merged).toEqual(DEFAULT_SETTINGS)
    })
  })

  describe('Settings Migration', () => {
    it('should migrate from version 0 to current', async () => {
      const { migrateSettings, DEFAULT_SETTINGS } = await import(
        '../../../src/config/settings'
      )

      const oldSettings = {
        'llm.modelName': 'old-model',
      }

      const migrated = migrateSettings(oldSettings, 0)

      // Should have all defaults
      expect(migrated.llm.modelName).toBe('old-model')
      expect(migrated.llm.baseURL).toBe(DEFAULT_SETTINGS.llm.baseURL)
    })

    it('should handle missing version', async () => {
      const { migrateSettings } = await import('../../../src/config/settings')

      const oldSettings = {
        'llm.modelName': 'test-model',
      }

      const migrated = migrateSettings(oldSettings, 0)

      expect(migrated.llm.modelName).toBe('test-model')
    })
  })

  describe('Export/Import Settings', () => {
    it('should export settings as JSON', async () => {
      const { exportSettings, DEFAULT_SETTINGS } = await import(
        '../../../src/config/settings'
      )

      const json = exportSettings(DEFAULT_SETTINGS)

      expect(typeof json).toBe('string')
      expect(() => JSON.parse(json)).not.toThrow()

      const parsed = JSON.parse(json)
      expect(parsed.llm.modelName).toBe(DEFAULT_SETTINGS.llm.modelName)
    })

    it('should import settings from JSON', async () => {
      const { importSettings, exportSettings, DEFAULT_SETTINGS } = await import(
        '../../../src/config/settings'
      )

      const customSettings: PluginSettings = {
        ...DEFAULT_SETTINGS,
        llm: {
          ...DEFAULT_SETTINGS.llm,
          modelName: 'imported-model',
        },
      }

      const json = exportSettings(customSettings)
      const imported = importSettings(json)

      expect(imported.llm.modelName).toBe('imported-model')
    })

    it('should reject invalid JSON', async () => {
      const { importSettings } = await import('../../../src/config/settings')

      expect(() => {
        importSettings('invalid json')
      }).toThrow()
    })

    it('should reject invalid settings', async () => {
      const { importSettings } = await import('../../../src/config/settings')

      const invalidJson = JSON.stringify({
        llm: {
          baseURL: '',
          temperature: 5.0, // Invalid
        },
      })

      expect(() => {
        importSettings(invalidJson)
      }).toThrow()
    })
  })

  describe('Settings Persistence', () => {
    it('should save settings to Logseq storage', async () => {
      const mockUpdateSettings = vi.fn().mockResolvedValue(undefined)
      global.logseq = {
        ...global.logseq,
        updateSettings: mockUpdateSettings,
      } as any

      const { saveSettings, DEFAULT_SETTINGS } = await import(
        '../../../src/config/settings'
      )

      await saveSettings(DEFAULT_SETTINGS)

      expect(mockUpdateSettings).toHaveBeenCalled()
      const savedSettings = mockUpdateSettings.mock.calls[0][0]
      expect(savedSettings['llm.modelName']).toBe(DEFAULT_SETTINGS.llm.modelName)
      expect(savedSettings['__version']).toBeDefined()
    })

    it('should reject invalid settings on save', async () => {
      const { saveSettings, DEFAULT_SETTINGS } = await import(
        '../../../src/config/settings'
      )

      const invalidSettings = {
        ...DEFAULT_SETTINGS,
        llm: {
          ...DEFAULT_SETTINGS.llm,
          baseURL: '', // Invalid
        },
      }

      await expect(saveSettings(invalidSettings)).rejects.toThrow()
    })

    it('should load settings from Logseq storage', async () => {
      global.logseq = {
        ...global.logseq,
        settings: {
          'llm.modelName': 'stored-model',
          'llm.baseURL': 'http://localhost:11434',
          'llm.apiPath': '/v1/chat/completions',
          'llm.temperature': 0.7,
          'llm.topP': 0.9,
          'llm.timeoutSeconds': 30,
          'llm.retryCount': 3,
          'llm.maxContextTokens': 8000,
          'llm.streamingEnabled': true,
          debugMode: false,
          '__version': 1,
        },
      } as any

      const { loadSettings } = await import('../../../src/config/settings')

      const loaded = await loadSettings()

      expect(loaded.llm.modelName).toBe('stored-model')
    })

    it('should return defaults when no settings stored', async () => {
      global.logseq = {
        ...global.logseq,
        settings: null,
      } as any

      const { loadSettings, DEFAULT_SETTINGS } = await import(
        '../../../src/config/settings'
      )

      const loaded = await loadSettings()

      expect(loaded).toEqual(DEFAULT_SETTINGS)
    })

    it('should handle migration on load', async () => {
      const mockUpdateSettings = vi.fn().mockResolvedValue(undefined)
      global.logseq = {
        ...global.logseq,
        settings: {
          'llm.modelName': 'old-model',
          // No __version field, triggers migration
        },
        updateSettings: mockUpdateSettings,
      } as any

      const { loadSettings } = await import('../../../src/config/settings')

      const loaded = await loadSettings()

      expect(loaded.llm.modelName).toBe('old-model')
      // Should have triggered save with version
      expect(mockUpdateSettings).toHaveBeenCalled()
    })
  })

  describe('Reset Settings', () => {
    it('should reset settings to defaults', async () => {
      const mockUpdateSettings = vi.fn().mockResolvedValue(undefined)
      global.logseq = {
        ...global.logseq,
        updateSettings: mockUpdateSettings,
      } as any

      const { resetSettings, DEFAULT_SETTINGS } = await import(
        '../../../src/config/settings'
      )

      await resetSettings()

      expect(mockUpdateSettings).toHaveBeenCalled()
      const savedSettings = mockUpdateSettings.mock.calls[0][0]
      expect(savedSettings['llm.modelName']).toBe(DEFAULT_SETTINGS.llm.modelName)
    })
  })

  describe('SETTINGS_SCHEMA', () => {
    it('should define all required settings fields', async () => {
      const { SETTINGS_SCHEMA } = await import('../../../src/config/settings')

      const keys = SETTINGS_SCHEMA.map((s: any) => s.key)

      expect(keys).toContain('llm.baseURL')
      expect(keys).toContain('llm.modelName')
      expect(keys).toContain('llm.temperature')
      expect(keys).toContain('llm.topP')
      expect(keys).toContain('debugMode')
    })

    it('should have proper types for all fields', async () => {
      const { SETTINGS_SCHEMA } = await import('../../../src/config/settings')

      const schema = SETTINGS_SCHEMA.find((s: any) => s.key === 'llm.temperature')
      expect(schema.type).toBe('number')

      const modelSchema = SETTINGS_SCHEMA.find((s: any) => s.key === 'llm.modelName')
      expect(modelSchema.type).toBe('string')

      const debugSchema = SETTINGS_SCHEMA.find((s: any) => s.key === 'debugMode')
      expect(debugSchema.type).toBe('boolean')
    })
  })
})
