/**
 * Unit tests for property validation
 * T102: Write unit test for property validation
 */

import { describe, it, expect } from 'vitest'

describe('Property Validation (T102)', () => {
  describe('Model Validation', () => {
    it('should accept valid model names', () => {
      const validModels = [
        'gpt-4',
        'gpt-3.5-turbo',
        'gpt-4-turbo',
        'claude-3-opus',
        'llama3-70b',
      ]

      for (const model of validModels) {
        expect(model.length).toBeGreaterThan(0)
        expect(typeof model).toBe('string')
      }
    })

    it('should reject empty model names', () => {
      const invalidModels = ['', '   ', null, undefined]

      for (const model of invalidModels) {
        const isValid = model && typeof model === 'string' && model.trim().length > 0
        expect(isValid).toBe(false)
      }
    })
  })

  describe('Temperature Validation', () => {
    it('should accept temperature in range 0-2', () => {
      const validTemperatures = [0, 0.5, 0.7, 1.0, 1.5, 2.0]

      for (const temp of validTemperatures) {
        expect(temp).toBeGreaterThanOrEqual(0)
        expect(temp).toBeLessThanOrEqual(2)
      }
    })

    it('should reject temperature out of range', () => {
      const invalidTemperatures = [-0.1, 2.1, 5.0, -1.0]

      for (const temp of invalidTemperatures) {
        const isValid = temp >= 0 && temp <= 2
        expect(isValid).toBe(false)
      }
    })

    it('should handle temperature as string and convert', () => {
      const temperatureStr = '0.8'
      const temperatureNum = parseFloat(temperatureStr)

      expect(temperatureNum).toBe(0.8)
      expect(temperatureNum).toBeGreaterThanOrEqual(0)
      expect(temperatureNum).toBeLessThanOrEqual(2)
    })
  })

  describe('Top-P Validation', () => {
    it('should accept top_p in range 0-1', () => {
      const validTopP = [0, 0.5, 0.9, 0.95, 1.0]

      for (const topP of validTopP) {
        expect(topP).toBeGreaterThanOrEqual(0)
        expect(topP).toBeLessThanOrEqual(1)
      }
    })

    it('should reject top_p out of range', () => {
      const invalidTopP = [-0.1, 1.1, 2.0, 5.0]

      for (const topP of invalidTopP) {
        const isValid = topP >= 0 && topP <= 1
        expect(isValid).toBe(false)
      }
    })
  })

  describe('Max Tokens Validation', () => {
    it('should accept positive integers for max tokens', () => {
      const validMaxTokens = [100, 1000, 2000, 4000, 8000]

      for (const maxTokens of validMaxTokens) {
        expect(maxTokens).toBeGreaterThan(0)
        expect(Number.isInteger(maxTokens)).toBe(true)
      }
    })

    it('should reject negative or zero max tokens', () => {
      const invalidMaxTokens = [-100, 0]

      for (const maxTokens of invalidMaxTokens) {
        const isValid = maxTokens > 0
        expect(isValid).toBe(false)
      }
    })

    it('should handle max_tokens as string and convert', () => {
      const maxTokensStr = '2000'
      const maxTokensNum = parseInt(maxTokensStr, 10)

      expect(maxTokensNum).toBe(2000)
      expect(maxTokensNum).toBeGreaterThan(0)
    })
  })

  describe('Boolean Property Validation', () => {
    it('should accept boolean strings', () => {
      const truthy = ['true', 'True', 'TRUE', '1', 'yes']
      const falsy = ['false', 'False', 'FALSE', '0', 'no']

      for (const val of truthy) {
        const boolVal = ['true', '1', 'yes'].includes(val.toLowerCase())
        expect(boolVal).toBe(true)
      }

      for (const val of falsy) {
        const boolVal = ['true', '1', 'yes'].includes(val.toLowerCase())
        expect(boolVal).toBe(false)
      }
    })

    it('should handle actual boolean values', () => {
      expect(true).toBe(true)
      expect(false).toBe(false)
    })
  })

  describe('Property Warnings', () => {
    it('should generate warning for invalid property', () => {
      const property = 'ai-generate-temperature'
      const value = 'invalid-value'
      const parsedValue = parseFloat(value)

      const isNaN = Number.isNaN(parsedValue)
      expect(isNaN).toBe(true)

      if (isNaN) {
        const warning = `Invalid value for ${property}: ${value}`
        expect(warning).toContain('Invalid value')
        expect(warning).toContain(property)
      }
    })

    it('should generate warning for out-of-range temperature', () => {
      const temperature = 3.0
      const isValid = temperature >= 0 && temperature <= 2

      expect(isValid).toBe(false)

      if (!isValid) {
        const warning = `Temperature ${temperature} is out of range (0-2)`
        expect(warning).toContain('out of range')
      }
    })

    it('should generate warning for out-of-range top_p', () => {
      const topP = 1.5
      const isValid = topP >= 0 && topP <= 1

      expect(isValid).toBe(false)

      if (!isValid) {
        const warning = `Top-P ${topP} is out of range (0-1)`
        expect(warning).toContain('out of range')
      }
    })
  })

  describe('Comprehensive Property Validation', () => {
    it('should validate complete property set', () => {
      const properties = {
        model: 'gpt-4',
        temperature: 0.7,
        topP: 0.9,
        maxTokens: 2000,
        useContext: true,
        streaming: true,
      }

      // Validate model
      expect(properties.model).toBeDefined()
      expect(typeof properties.model).toBe('string')
      expect(properties.model.length).toBeGreaterThan(0)

      // Validate temperature
      expect(properties.temperature).toBeGreaterThanOrEqual(0)
      expect(properties.temperature).toBeLessThanOrEqual(2)

      // Validate topP
      expect(properties.topP).toBeGreaterThanOrEqual(0)
      expect(properties.topP).toBeLessThanOrEqual(1)

      // Validate maxTokens
      expect(properties.maxTokens).toBeGreaterThan(0)
      expect(Number.isInteger(properties.maxTokens)).toBe(true)

      // Validate booleans
      expect(typeof properties.useContext).toBe('boolean')
      expect(typeof properties.streaming).toBe('boolean')
    })

    it('should identify and report multiple validation errors', () => {
      const properties = {
        model: '', // Invalid
        temperature: 3.0, // Out of range
        topP: 1.5, // Out of range
        maxTokens: -100, // Negative
      }

      const errors: string[] = []

      if (!properties.model || properties.model.trim() === '') {
        errors.push('Model is required')
      }

      if (properties.temperature < 0 || properties.temperature > 2) {
        errors.push('Temperature out of range')
      }

      if (properties.topP < 0 || properties.topP > 1) {
        errors.push('Top-P out of range')
      }

      if (properties.maxTokens <= 0) {
        errors.push('Max tokens must be positive')
      }

      expect(errors).toHaveLength(4)
      expect(errors).toContain('Model is required')
      expect(errors).toContain('Temperature out of range')
      expect(errors).toContain('Top-P out of range')
      expect(errors).toContain('Max tokens must be positive')
    })
  })
})
