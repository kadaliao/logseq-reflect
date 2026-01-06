/**
 * Server-Sent Events (SSE) streaming parser
 * T023: Implement SSE streaming response parser
 */

import type { ChatCompletionChunk } from '../types'
import { createLogger } from '../utils/logger'

const logger = createLogger('SSEParser')

/**
 * Parse Server-Sent Events stream from ReadableStream
 * Yields parsed ChatCompletionChunk objects
 *
 * @param stream - ReadableStream from fetch response
 * @returns AsyncIterable of parsed chunks
 */
export async function* parseSSEStream(
  stream: ReadableStream<Uint8Array>
): AsyncIterable<ChatCompletionChunk> {
  const reader = stream.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  try {
    while (true) {
      const { done, value } = await reader.read()

      if (done) {
        logger.debug('Stream ended')
        break
      }

      // Decode chunk and add to buffer
      buffer += decoder.decode(value, { stream: true })

      // Process complete SSE messages in buffer
      const lines = buffer.split('\n')
      buffer = lines.pop() || '' // Keep incomplete line in buffer

      for (const line of lines) {
        const chunk = parseSSELine(line)
        if (chunk) {
          yield chunk
        }
      }
    }
  } finally {
    reader.releaseLock()
  }
}

/**
 * Parse single SSE line
 * Returns null for non-data lines or [DONE] marker
 */
function parseSSELine(line: string): ChatCompletionChunk | null {
  // Skip empty lines
  if (!line.trim()) {
    return null
  }

  // SSE data lines start with "data: "
  if (!line.startsWith('data: ')) {
    logger.debug('Skipping non-data line', { line })
    return null
  }

  const data = line.slice(6) // Remove "data: " prefix

  // Check for [DONE] marker
  if (data.trim() === '[DONE]') {
    logger.debug('Received [DONE] marker')
    return null
  }

  // Parse JSON chunk
  try {
    const chunk = JSON.parse(data) as ChatCompletionChunk
    return chunk
  } catch (error) {
    logger.warn('Failed to parse SSE chunk', {
      data,
      error: error instanceof Error ? error.message : String(error),
    })
    return null
  }
}

/**
 * Accumulate content from streaming chunks
 * Useful for building complete response text
 */
export function accumulateChunks(chunks: ChatCompletionChunk[]): string {
  return chunks
    .map((chunk) => chunk.choices[0]?.delta.content || '')
    .filter(Boolean)
    .join('')
}

/**
 * Check if chunk indicates stream completion
 */
export function isStreamComplete(chunk: ChatCompletionChunk): boolean {
  return chunk.choices[0]?.finish_reason !== null &&
    chunk.choices[0]?.finish_reason !== undefined
}
