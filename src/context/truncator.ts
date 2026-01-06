/**
 * Context truncation utilities
 * T031: Implement context truncation logic
 */

import type { RequestContext } from '../types'
import { truncateToTokenLimit } from '../utils/tokens'
import { createLogger } from '../utils/logger'

const logger = createLogger('ContextTruncator')

/**
 * Truncate context to fit within token limit
 * Preserves metadata and type information
 */
export function truncateContext(
  context: RequestContext,
  maxTokens: number
): RequestContext {
  // No truncation needed
  if (context.estimatedTokens <= maxTokens) {
    return context
  }

  logger.debug('Truncating context', {
    originalTokens: context.estimatedTokens,
    maxTokens,
  })

  // Truncate content
  const truncated = truncateToTokenLimit(context.content, maxTokens)

  const newContext: RequestContext = {
    ...context,
    content: truncated.text,
    estimatedTokens: truncated.estimatedTokens,
    wasTruncated: true,
  }

  logger.info('Context truncated', {
    originalTokens: context.estimatedTokens,
    newTokens: newContext.estimatedTokens,
    truncatedBy: context.estimatedTokens - newContext.estimatedTokens,
  })

  return newContext
}
