/**
 * Token estimation utilities for context management
 * T017: Create token estimation utility
 */

/**
 * Estimate token count from text using simple heuristic
 * Based on OpenAI's ~4 chars per token average
 *
 * @param text - Input text to estimate tokens for
 * @returns Estimated token count
 */
export function estimateTokens(text: string): number {
  if (!text || text.length === 0) {
    return 0
  }

  // Use 4 characters per token as rough estimate
  // This is conservative and works for most languages
  return Math.ceil(text.length / 4)
}

/**
 * Truncate text to fit within token limit
 * Preserves complete words where possible
 *
 * @param text - Input text to truncate
 * @param maxTokens - Maximum allowed tokens
 * @returns Object with truncated text and metadata
 */
export function truncateToTokenLimit(
  text: string,
  maxTokens: number
): {
  text: string
  wasTruncated: boolean
  estimatedTokens: number
} {
  const estimatedTokens = estimateTokens(text)

  // No truncation needed
  if (estimatedTokens <= maxTokens) {
    return {
      text,
      wasTruncated: false,
      estimatedTokens,
    }
  }

  // Calculate max characters (conservative)
  const maxChars = maxTokens * 4

  // Find last complete word boundary before limit
  let truncatedText = text.substring(0, maxChars)
  const lastSpaceIndex = truncatedText.lastIndexOf(' ')

  // Prefer word boundary, but ensure we don't truncate too much
  if (lastSpaceIndex > maxChars * 0.9) {
    truncatedText = truncatedText.substring(0, lastSpaceIndex)
  }

  // Add ellipsis to indicate truncation
  truncatedText = truncatedText.trim() + '...'

  return {
    text: truncatedText,
    wasTruncated: true,
    estimatedTokens: estimateTokens(truncatedText),
  }
}

/**
 * Calculate remaining tokens available for response
 *
 * @param contextTokens - Tokens used by context
 * @param maxContextTokens - Maximum context window size
 * @param reservedTokens - Tokens to reserve for system prompts (default 100)
 * @returns Available tokens for response generation
 */
export function calculateAvailableTokens(
  contextTokens: number,
  maxContextTokens: number,
  reservedTokens = 100
): number {
  const available = maxContextTokens - contextTokens - reservedTokens

  // Ensure we never return negative values
  return Math.max(0, available)
}

/**
 * Batch messages to fit within token limits
 * Useful for multi-turn conversations
 *
 * @param messages - Array of message strings
 * @param maxTokens - Maximum tokens per batch
 * @returns Array of batched message arrays
 */
export function batchMessages(
  messages: string[],
  maxTokens: number
): string[][] {
  const batches: string[][] = []
  let currentBatch: string[] = []
  let currentTokens = 0

  for (const message of messages) {
    const messageTokens = estimateTokens(message)

    // Message too large for any batch
    if (messageTokens > maxTokens) {
      // Flush current batch if not empty
      if (currentBatch.length > 0) {
        batches.push(currentBatch)
        currentBatch = []
        currentTokens = 0
      }

      // Truncate and add as single-message batch
      const truncated = truncateToTokenLimit(message, maxTokens)
      batches.push([truncated.text])
      continue
    }

    // Would exceed limit, start new batch
    if (currentTokens + messageTokens > maxTokens) {
      batches.push(currentBatch)
      currentBatch = [message]
      currentTokens = messageTokens
    } else {
      currentBatch.push(message)
      currentTokens += messageTokens
    }
  }

  // Add final batch if not empty
  if (currentBatch.length > 0) {
    batches.push(currentBatch)
  }

  return batches
}
