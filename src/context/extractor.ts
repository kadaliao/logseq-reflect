/**
 * Context extraction utilities
 * T030: Implement page/block content extractor
 */

import type { RequestContext, ContextStrategy } from '../types'
import { createLogger } from '../utils/logger'
import { estimateTokens } from '../utils/tokens'
import { truncateContext } from './truncator'

const logger = createLogger('ContextExtractor')

/**
 * Extract context from a page
 * Includes all blocks in the page
 */
export async function extractPageContext(
  pageName: string,
  maxTokens: number
): Promise<RequestContext> {
  logger.debug('Extracting page context', { pageName, maxTokens })

  try {
    const page = await logseq.Editor.getPage(pageName)

    if (!page) {
      logger.warn('Page not found', { pageName })
      return createEmptyContext('page')
    }

    const blocksTree = await logseq.Editor.getPageBlocksTree(pageName)

    if (!blocksTree || blocksTree.length === 0) {
      logger.info('Page has no blocks', { pageName })
      return createEmptyContext('page', {
        pageName,
      })
    }

    // Extract content from all blocks
    const { content, uuids } = extractFromBlockTree(blocksTree)

    const context: RequestContext = {
      type: 'page',
      content,
      sourceUUIDs: uuids,
      estimatedTokens: estimateTokens(content),
      wasTruncated: false,
      metadata: {
        pageName,
      },
    }

    // Truncate if needed
    return truncateContext(context, maxTokens)
  } catch (error) {
    logger.error('Failed to extract page context', error as Error, { pageName })
    return createEmptyContext('page')
  }
}

/**
 * Extract context from a block and its children
 */
export async function extractBlockContext(
  blockUUID: string,
  maxTokens: number
): Promise<RequestContext> {
  logger.debug('Extracting block context', { blockUUID, maxTokens })

  try {
    const block = await logseq.Editor.getBlock(blockUUID, {
      includeChildren: true,
    })

    if (!block) {
      logger.warn('Block not found', { blockUUID })
      return createEmptyContext('block')
    }

    const { content, uuids } = extractFromBlockTree([block])

    const context: RequestContext = {
      type: 'block',
      content,
      sourceUUIDs: uuids,
      estimatedTokens: estimateTokens(content),
      wasTruncated: false,
    }

    // Truncate if needed
    return truncateContext(context, maxTokens)
  } catch (error) {
    logger.error('Failed to extract block context', error as Error, { blockUUID })
    return createEmptyContext('block')
  }
}

/**
 * Extract context from selected blocks
 */
export async function extractSelectionContext(
  blockUUIDs: string[],
  maxTokens: number
): Promise<RequestContext> {
  logger.debug('Extracting selection context', {
    blockCount: blockUUIDs.length,
    maxTokens,
  })

  if (blockUUIDs.length === 0) {
    return createEmptyContext('selection')
  }

  try {
    const blocks = await Promise.all(
      blockUUIDs.map((uuid) =>
        logseq.Editor.getBlock(uuid, {
          includeChildren: false, // Don't include children for selection
        })
      )
    )

    // Filter out null blocks
    const validBlocks = blocks.filter((block: unknown) => block !== null)

    if (validBlocks.length === 0) {
      logger.warn('No valid blocks in selection')
      return createEmptyContext('selection')
    }

    const { content, uuids } = extractFromBlockTree(validBlocks)

    const context: RequestContext = {
      type: 'selection',
      content,
      sourceUUIDs: uuids,
      estimatedTokens: estimateTokens(content),
      wasTruncated: false,
    }

    // Truncate if needed
    return truncateContext(context, maxTokens)
  } catch (error) {
    logger.error('Failed to extract selection context', error as Error, {
      blockUUIDs,
    })
    return createEmptyContext('selection')
  }
}

/**
 * Extract content from block tree recursively
 * Returns concatenated content and list of UUIDs
 */
function extractFromBlockTree(
  blocks: unknown[]
): { content: string; uuids: string[] } {
  const contentParts: string[] = []
  const uuids: string[] = []

  function traverse(block: unknown, depth = 0): void {
    // Type guard for block structure
    if (!isBlockEntity(block)) {
      return
    }

    // Add block content with indentation
    const indent = '  '.repeat(depth)
    if (block.content && block.content.trim()) {
      contentParts.push(`${indent}${block.content}`)
      uuids.push(block.uuid)
    }

    // Recursively process children
    if (block.children && Array.isArray(block.children)) {
      for (const child of block.children) {
        traverse(child, depth + 1)
      }
    }
  }

  for (const block of blocks) {
    traverse(block)
  }

  return {
    content: contentParts.join('\n'),
    uuids,
  }
}

/**
 * Type guard for block entity
 */
function isBlockEntity(
  block: unknown
): block is { uuid: string; content: string; children?: unknown[] } {
  return (
    typeof block === 'object' &&
    block !== null &&
    'uuid' in block &&
    'content' in block &&
    typeof (block as { uuid: unknown }).uuid === 'string' &&
    typeof (block as { content: unknown }).content === 'string'
  )
}

/**
 * Create empty context for given strategy
 */
function createEmptyContext(
  type: ContextStrategy,
  metadata?: Record<string, unknown>
): RequestContext {
  return {
    type,
    content: '',
    sourceUUIDs: [],
    estimatedTokens: 0,
    wasTruncated: false,
    metadata,
  }
}
