/**
 * Block property parser with inheritance
 * T032: Implement block property parser with inheritance
 */

import type { BlockPropertySet } from '../types'
import { createLogger } from '../utils/logger'
import { validateBlockProperties } from '../config/validator'

const logger = createLogger('PropertyParser')

// Cache for block properties to avoid repeated parsing
const propertyCache = new Map<string, BlockPropertySet>()

/**
 * Parse block properties with inheritance from parent blocks
 * Returns merged properties from block and all ancestors
 */
export async function parseBlockProperties(blockUUID: string): Promise<BlockPropertySet> {
  // Check cache first
  if (propertyCache.has(blockUUID)) {
    logger.debug('Using cached properties', { blockUUID })
    return propertyCache.get(blockUUID)!
  }

  logger.debug('Parsing block properties', { blockUUID })

  try {
    const block = await logseq.Editor.getBlock(blockUUID)

    if (!block) {
      logger.warn('Block not found', { blockUUID })
      return createEmptyPropertySet(blockUUID)
    }

    // Extract properties from current block
    const blockProperties = extractBlockProperties(block)

    // Get inherited properties from parent
    const inheritedProperties = await getInheritedProperties(block)

    // Check if block has any AI properties (excluding blockUUID)
    const hasOwnProperties = Object.keys(blockProperties).length > 0

    // Merge with precedence: block properties override inherited
    // Start with empty property set to ensure all fields have null defaults
    const merged: BlockPropertySet = {
      ...createEmptyPropertySet(blockUUID),
      ...inheritedProperties,
      ...blockProperties,
      blockUUID, // Ensure blockUUID is always set
      isInherited: !hasOwnProperties, // True if no AI properties on this block
    }

    // Cache result
    propertyCache.set(blockUUID, merged)

    logger.debug('Parsed properties', {
      blockUUID,
      properties: merged,
    })

    return merged
  } catch (error) {
    logger.error('Failed to parse block properties', error as Error, { blockUUID })
    return createEmptyPropertySet(blockUUID)
  }
}

/**
 * Extract AI properties from block object
 * T104: Enhanced to support all ai-generate-* properties
 */
function extractBlockProperties(block: unknown): Partial<BlockPropertySet> {
  if (!isBlockEntity(block) || !block.properties) {
    return {}
  }

  // Validate properties
  const validated = validateBlockProperties(block.properties, block.uuid)

  const properties: Partial<BlockPropertySet> = {}

  // Extract known AI properties
  if (validated['ai-generate-model']) {
    properties.model = validated['ai-generate-model'] as string
  }

  if (validated['ai-generate-temperature'] !== undefined) {
    properties.temperature = validated['ai-generate-temperature'] as number
  }

  if (validated['ai-generate-top_p'] !== undefined) {
    properties.topP = validated['ai-generate-top_p'] as number
  }

  if (validated['ai-generate-max_tokens'] !== undefined) {
    properties.maxTokens = validated['ai-generate-max_tokens'] as number
  }

  if (validated['ai-generate-use_context'] !== undefined) {
    properties.useContext = validated['ai-generate-use_context'] as boolean
  }

  if (validated['ai-generate-streaming'] !== undefined) {
    properties.streaming = validated['ai-generate-streaming'] as boolean
  }

  return properties
}

/**
 * Get inherited properties from parent blocks
 * Traverses up the tree until root
 */
async function getInheritedProperties(
  block: unknown
): Promise<Partial<BlockPropertySet>> {
  if (!isBlockEntity(block)) {
    return {}
  }

  // Extract parent UUID from block
  const parentUUID = extractParentUUID(block)

  if (!parentUUID) {
    // Reached root, no more inheritance
    return {}
  }

  try {
    const parentBlock = await logseq.Editor.getBlock(parentUUID)

    if (!parentBlock) {
      return {}
    }

    // Get parent's properties
    const parentProperties = extractBlockProperties(parentBlock)

    // Get grandparent's properties recursively
    const ancestorProperties = await getInheritedProperties(parentBlock)

    // Merge with precedence: parent overrides grandparent
    return {
      ...ancestorProperties,
      ...parentProperties,
    }
  } catch (error) {
    logger.warn('Failed to get parent properties', {
      parentUUID,
      error: error instanceof Error ? error.message : String(error),
    })
    return {}
  }
}

/**
 * Extract parent UUID from block entity
 * Handles both parent object and parent.id patterns
 */
function extractParentUUID(block: unknown): string | null {
  if (!isBlockEntity(block)) {
    return null
  }

  const blockAny = block as { parent?: { id?: unknown } | unknown }

  // Check for parent object
  if (blockAny.parent) {
    // parent.id pattern
    if (
      typeof blockAny.parent === 'object' &&
      blockAny.parent !== null &&
      'id' in blockAny.parent
    ) {
      const parent = blockAny.parent as { id?: unknown }
      if (typeof parent.id === 'number') {
        return String(parent.id)
      }
      if (typeof parent.id === 'string') {
        return parent.id
      }
    }

    // Direct parent ID
    if (typeof blockAny.parent === 'number') {
      return String(blockAny.parent)
    }
    if (typeof blockAny.parent === 'string') {
      return blockAny.parent
    }
  }

  return null
}

/**
 * Type guard for block entity with properties
 */
function isBlockEntity(
  block: unknown
): block is { uuid: string; properties?: Record<string, unknown> } {
  return (
    typeof block === 'object' &&
    block !== null &&
    'uuid' in block &&
    typeof (block as { uuid: unknown }).uuid === 'string'
  )
}

/**
 * Create empty property set
 * T104: Updated to include all ai-generate-* properties
 */
function createEmptyPropertySet(blockUUID: string): BlockPropertySet {
  return {
    blockUUID,
    model: null,
    temperature: null,
    topP: null,
    maxTokens: null,
    useContext: null,
    streaming: null,
    isInherited: false,
  }
}

/**
 * Clear property cache
 * Useful for testing or when properties are updated
 */
export function clearPropertyCache(): void {
  logger.debug('Clearing property cache', {
    size: propertyCache.size,
  })
  propertyCache.clear()
}
