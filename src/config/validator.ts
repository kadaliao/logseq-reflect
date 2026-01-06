/**
 * Property validation utilities
 * T019: Implement property validation logic
 */

import type { ContextStrategy } from '../types'
import { createLogger } from '../utils/logger'

const logger = createLogger('PropertyValidator')

/**
 * Validation result interface
 */
export interface ValidationResult {
  /** Whether validation passed */
  isValid: boolean

  /** Validated and coerced value (if valid) */
  value: unknown

  /** Error message (if invalid) */
  error?: string
}

/**
 * Validate model name property
 * Must be non-empty string
 */
export function validateModel(value: unknown): ValidationResult {
  if (typeof value !== 'string') {
    return {
      isValid: false,
      value: null,
      error: 'Model name must be a string',
    }
  }

  const trimmed = value.trim()
  if (trimmed.length === 0) {
    return {
      isValid: false,
      value: null,
      error: 'Model name cannot be empty',
    }
  }

  return {
    isValid: true,
    value: trimmed,
  }
}

/**
 * Validate temperature property
 * Must be number between 0.0 and 2.0
 */
export function validateTemperature(value: unknown): ValidationResult {
  const num = Number(value)

  if (isNaN(num)) {
    return {
      isValid: false,
      value: null,
      error: 'Temperature must be a number',
    }
  }

  if (num < 0 || num > 2) {
    return {
      isValid: false,
      value: null,
      error: 'Temperature must be between 0.0 and 2.0',
    }
  }

  return {
    isValid: true,
    value: num,
  }
}

/**
 * Validate top_p property
 * Must be number between 0.0 and 1.0
 */
export function validateTopP(value: unknown): ValidationResult {
  const num = Number(value)

  if (isNaN(num)) {
    return {
      isValid: false,
      value: null,
      error: 'Top P must be a number',
    }
  }

  if (num < 0 || num > 1) {
    return {
      isValid: false,
      value: null,
      error: 'Top P must be between 0.0 and 1.0',
    }
  }

  return {
    isValid: true,
    value: num,
  }
}

/**
 * Validate use_context property
 * Must be boolean or boolean-like string
 */
export function validateUseContext(value: unknown): ValidationResult {
  if (typeof value === 'boolean') {
    return {
      isValid: true,
      value,
    }
  }

  if (typeof value === 'string') {
    const lower = value.toLowerCase().trim()
    if (lower === 'true' || lower === 'yes' || lower === '1') {
      return {
        isValid: true,
        value: true,
      }
    }
    if (lower === 'false' || lower === 'no' || lower === '0') {
      return {
        isValid: true,
        value: false,
      }
    }
  }

  return {
    isValid: false,
    value: null,
    error: 'Use context must be a boolean (true/false)',
  }
}

/**
 * Validate context strategy property
 * Must be one of: none, page, block, selection
 */
export function validateContextStrategy(value: unknown): ValidationResult {
  if (typeof value !== 'string') {
    return {
      isValid: false,
      value: null,
      error: 'Context strategy must be a string',
    }
  }

  const trimmed = value.trim().toLowerCase()
  const validStrategies: ContextStrategy[] = ['none', 'page', 'block', 'selection']

  if (!validStrategies.includes(trimmed as ContextStrategy)) {
    return {
      isValid: false,
      value: null,
      error: `Context strategy must be one of: ${validStrategies.join(', ')}`,
    }
  }

  return {
    isValid: true,
    value: trimmed as ContextStrategy,
  }
}

/**
 * Validate block property value by property name
 * Routes to appropriate validator based on property name
 */
export function validateBlockProperty(
  propertyName: string,
  value: unknown
): ValidationResult {
  switch (propertyName) {
    case 'ai-generate-model':
    case 'ai-model':
      return validateModel(value)

    case 'ai-generate-temperature':
      return validateTemperature(value)

    case 'ai-generate-top_p':
      return validateTopP(value)

    case 'ai-generate-use_context':
      return validateUseContext(value)

    case 'ai-context':
      return validateContextStrategy(value)

    default:
      return {
        isValid: false,
        value: null,
        error: `Unknown property: ${propertyName}`,
      }
  }
}

/**
 * Validate and normalize all properties in a property object
 * Logs warnings for invalid properties but doesn't throw
 *
 * @param properties - Raw property object from block
 * @param blockUUID - Block UUID for logging context
 * @returns Validated and normalized properties
 */
export function validateBlockProperties(
  properties: Record<string, unknown>,
  blockUUID: string
): Record<string, unknown> {
  const validated: Record<string, unknown> = {}

  for (const [key, value] of Object.entries(properties)) {
    // Skip non-AI properties
    if (!key.startsWith('ai-')) {
      continue
    }

    const result = validateBlockProperty(key, value)

    if (result.isValid) {
      validated[key] = result.value
    } else {
      logger.warn(`Invalid property in block ${blockUUID}`, {
        property: key,
        value,
        error: result.error,
      })
    }
  }

  return validated
}

/**
 * Check if property name is recognized AI property
 */
export function isAIProperty(propertyName: string): boolean {
  const knownProperties = [
    'ai-generate-model',
    'ai-generate-temperature',
    'ai-generate-top_p',
    'ai-generate-use_context',
    'ai-model',
    'ai-context',
    'ai-context-menu-title',
    'ai-prompt-prefix',
    'ai-prompt-suffix',
  ]

  return knownProperties.includes(propertyName)
}
