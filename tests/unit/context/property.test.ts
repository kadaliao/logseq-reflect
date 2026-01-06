/**
 * Unit tests for property parser
 * T033: Write unit tests for property parser
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import type { BlockPropertySet } from '../../../src/types'

// Get mock reference from global logseq (set up in tests/setup.ts)
const mockGetBlock = vi.mocked(logseq.Editor.getBlock)

describe('Property Parser', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    // Clear property cache before each test
    import('../../../src/context/property').then((module) => {
      module.clearPropertyCache()
    })
  })

  describe('parseBlockProperties', () => {
    it('should parse block with AI properties', async () => {
      // Arrange
      mockGetBlock.mockResolvedValueOnce({
        uuid: 'block-1',
        properties: {
          'ai-generate-model': 'gpt-4',
          'ai-generate-temperature': '0.8',
          'ai-generate-top_p': '0.9',
          'ai-generate-use_context': 'true',
        },
        parent: null,
      })

      // Act
      const { parseBlockProperties } = await import('../../../src/context/property')
      const properties = await parseBlockProperties('block-1')

      // Assert
      expect(properties.blockUUID).toBe('block-1')
      expect(properties.model).toBe('gpt-4')
      expect(properties.temperature).toBe(0.8)
      expect(properties.topP).toBe(0.9)
      expect(properties.useContext).toBe(true)
      expect(properties.isInherited).toBe(false)
    })

    it('should return empty properties for block with no AI properties', async () => {
      // Arrange
      mockGetBlock.mockResolvedValueOnce({
        uuid: 'block-1',
        properties: {
          'some-other-property': 'value',
        },
        parent: null,
      })

      // Act
      const { parseBlockProperties } = await import('../../../src/context/property')
      const properties = await parseBlockProperties('block-1')

      // Assert
      expect(properties.blockUUID).toBe('block-1')
      expect(properties.model).toBeNull()
      expect(properties.temperature).toBeNull()
      expect(properties.topP).toBeNull()
      expect(properties.useContext).toBeNull()
    })

    it('should inherit properties from parent block', async () => {
      // Arrange
      // Parent block with model property
      const parentBlock = {
        uuid: 'parent',
        properties: {
          'ai-generate-model': 'llama3',
        },
        parent: null,
      }

      // Child block with temperature property
      const childBlock = {
        uuid: 'child',
        properties: {
          'ai-generate-temperature': '0.7',
        },
        parent: { id: 'parent' },
      }

      mockGetBlock
        .mockResolvedValueOnce(childBlock) // First call for child
        .mockResolvedValueOnce(parentBlock) // Second call for parent

      // Act
      const { parseBlockProperties, clearPropertyCache } = await import(
        '../../../src/context/property'
      )
      clearPropertyCache()
      const properties = await parseBlockProperties('child')

      // Assert
      expect(properties.blockUUID).toBe('child')
      expect(properties.model).toBe('llama3') // Inherited from parent
      expect(properties.temperature).toBe(0.7) // From child
      expect(properties.isInherited).toBe(false) // Has own properties
    })

    it('should override parent properties with child properties', async () => {
      // Arrange
      const parentBlock = {
        uuid: 'parent',
        properties: {
          'ai-generate-model': 'llama3',
          'ai-generate-temperature': '0.5',
        },
        parent: null,
      }

      const childBlock = {
        uuid: 'child',
        properties: {
          'ai-generate-temperature': '0.9', // Override parent
        },
        parent: { id: 'parent' },
      }

      mockGetBlock
        .mockResolvedValueOnce(childBlock)
        .mockResolvedValueOnce(parentBlock)

      // Act
      const { parseBlockProperties, clearPropertyCache } = await import(
        '../../../src/context/property'
      )
      clearPropertyCache()
      const properties = await parseBlockProperties('child')

      // Assert
      expect(properties.model).toBe('llama3') // Inherited
      expect(properties.temperature).toBe(0.9) // Overridden by child
    })

    it('should mark fully inherited properties', async () => {
      // Arrange
      const parentBlock = {
        uuid: 'parent',
        properties: {
          'ai-generate-model': 'gpt-4',
        },
        parent: null,
      }

      const childBlock = {
        uuid: 'child',
        properties: {}, // No AI properties
        parent: { id: 'parent' },
      }

      mockGetBlock
        .mockResolvedValueOnce(childBlock)
        .mockResolvedValueOnce(parentBlock)

      // Act
      const { parseBlockProperties, clearPropertyCache } = await import(
        '../../../src/context/property'
      )
      clearPropertyCache()
      const properties = await parseBlockProperties('child')

      // Assert
      expect(properties.model).toBe('gpt-4')
      expect(properties.isInherited).toBe(true) // All properties inherited
    })

    it('should handle multi-level inheritance', async () => {
      // Arrange
      const grandparentBlock = {
        uuid: 'grandparent',
        properties: {
          'ai-generate-model': 'llama3',
        },
        parent: null,
      }

      const parentBlock = {
        uuid: 'parent',
        properties: {
          'ai-generate-temperature': '0.5',
        },
        parent: { id: 'grandparent' },
      }

      const childBlock = {
        uuid: 'child',
        properties: {
          'ai-generate-top_p': '0.9',
        },
        parent: { id: 'parent' },
      }

      mockGetBlock
        .mockResolvedValueOnce(childBlock) // child
        .mockResolvedValueOnce(parentBlock) // parent
        .mockResolvedValueOnce(grandparentBlock) // grandparent

      // Act
      const { parseBlockProperties, clearPropertyCache } = await import(
        '../../../src/context/property'
      )
      clearPropertyCache()
      const properties = await parseBlockProperties('child')

      // Assert
      expect(properties.model).toBe('llama3') // From grandparent
      expect(properties.temperature).toBe(0.5) // From parent
      expect(properties.topP).toBe(0.9) // From child
    })

    it('should cache parsed properties', async () => {
      // Arrange
      mockGetBlock.mockResolvedValueOnce({
        uuid: 'block-1',
        properties: {
          'ai-generate-model': 'gpt-4',
        },
        parent: null,
      })

      // Act
      const { parseBlockProperties, clearPropertyCache } = await import(
        '../../../src/context/property'
      )
      clearPropertyCache()

      const properties1 = await parseBlockProperties('block-1')
      const properties2 = await parseBlockProperties('block-1') // Should use cache

      // Assert
      expect(mockGetBlock).toHaveBeenCalledTimes(1) // Only called once
      expect(properties1).toEqual(properties2)
    })

    it('should handle non-existent block', async () => {
      // Arrange
      mockGetBlock.mockResolvedValueOnce(null)

      // Act
      const { parseBlockProperties, clearPropertyCache } = await import(
        '../../../src/context/property'
      )
      clearPropertyCache()
      const properties = await parseBlockProperties('non-existent')

      // Assert
      expect(properties.blockUUID).toBe('non-existent')
      expect(properties.model).toBeNull()
      expect(properties.isInherited).toBe(false)
    })

    it('should skip invalid property values', async () => {
      // Arrange
      mockGetBlock.mockResolvedValueOnce({
        uuid: 'block-1',
        properties: {
          'ai-generate-model': 'gpt-4',
          'ai-generate-temperature': 'invalid', // Invalid number
          'ai-generate-top_p': '5.0', // Out of range
        },
        parent: null,
      })

      // Act
      const { parseBlockProperties, clearPropertyCache } = await import(
        '../../../src/context/property'
      )
      clearPropertyCache()
      const properties = await parseBlockProperties('block-1')

      // Assert
      expect(properties.model).toBe('gpt-4') // Valid
      expect(properties.temperature).toBeNull() // Invalid, skipped (defaults to null)
      expect(properties.topP).toBeNull() // Out of range, skipped (defaults to null)
    })
  })

  describe('clearPropertyCache', () => {
    it('should clear the property cache', async () => {
      // Arrange
      mockGetBlock.mockResolvedValue({
        uuid: 'block-1',
        properties: {
          'ai-generate-model': 'gpt-4',
        },
        parent: null,
      })

      const { parseBlockProperties, clearPropertyCache } = await import(
        '../../../src/context/property'
      )

      clearPropertyCache()
      await parseBlockProperties('block-1') // Cache it

      // Act
      clearPropertyCache()

      mockGetBlock.mockClear()
      mockGetBlock.mockResolvedValue({
        uuid: 'block-1',
        properties: {
          'ai-generate-model': 'llama3', // Different value
        },
        parent: null,
      })

      const properties = await parseBlockProperties('block-1')

      // Assert
      expect(mockGetBlock).toHaveBeenCalledTimes(1) // Called again after cache clear
      expect(properties.model).toBe('llama3') // New value, not cached
    })
  })
})
