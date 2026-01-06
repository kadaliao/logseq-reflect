/**
 * Response handler for AI command execution
 * T043: Implement ResponseHandler for placeholder and streaming updates
 */

import type { ResponseHandler, ChatCompletionChunk } from '../types'
import { createLogger } from '../utils/logger'

const logger = createLogger('ResponseHandler')

/**
 * Create a response handler for streaming AI responses
 * Manages placeholder block creation and streaming updates
 */
export async function createResponseHandler(
  parentBlockUUID?: string
): Promise<ResponseHandler> {
  const requestID = generateRequestID()

  logger.debug('Creating response handler', {
    requestID,
    parentBlockUUID,
  })

  // Create placeholder block
  const placeholderUUID = await createPlaceholderBlock(parentBlockUUID)

  const handler: ResponseHandler = {
    requestID,
    placeholderUUID,
    status: 'pending',
    accumulatedContent: '',
    errorMessage: null,
    startTime: Date.now(),
  }

  return handler
}

/**
 * Update handler with streaming chunk
 * Accumulates content and updates the block
 */
export async function updateWithChunk(
  handler: ResponseHandler,
  chunk: ChatCompletionChunk
): Promise<void> {
  // Safely access choices array
  if (!chunk.choices || chunk.choices.length === 0) {
    return
  }

  const content = chunk.choices[0]?.delta?.content

  if (!content) {
    return
  }

  // Accumulate content
  handler.accumulatedContent += content
  handler.status = 'streaming'

  // Update block with accumulated content
  await updateBlock(handler.placeholderUUID, handler.accumulatedContent)

  logger.debug('Updated block with chunk', {
    requestID: handler.requestID,
    chunkLength: content.length,
    totalLength: handler.accumulatedContent.length,
  })
}

/**
 * Mark handler as completed
 */
export async function markCompleted(handler: ResponseHandler): Promise<void> {
  handler.status = 'completed'
  handler.completionTime = Date.now()

  // Update block with final content (add checkmark)
  if (handler.accumulatedContent) {
    await updateBlock(
      handler.placeholderUUID,
      handler.accumulatedContent
    )
  }

  const duration = handler.completionTime - handler.startTime

  logger.info('Response completed', {
    requestID: handler.requestID,
    contentLength: handler.accumulatedContent.length,
    durationMs: duration,
  })
}

/**
 * Mark handler as failed with error message
 */
export async function markFailed(
  handler: ResponseHandler,
  error: Error
): Promise<void> {
  handler.status = 'failed'
  handler.errorMessage = error.message
  handler.completionTime = Date.now()

  // Update block with error message
  await updateBlock(
    handler.placeholderUUID,
    `**Error**: ${error.message}\n\nPlease try again or check your settings.`
  )

  logger.error('Response failed', error, {
    requestID: handler.requestID,
  })
}

/**
 * Cancel handler (aborts streaming request)
 */
export async function cancelHandler(handler: ResponseHandler): Promise<void> {
  handler.status = 'cancelled'
  handler.completionTime = Date.now()

  // Update block with cancellation message
  await updateBlock(
    handler.placeholderUUID,
    `**Cancelled**\n\nRequest was cancelled.`
  )

  logger.info('Response cancelled', {
    requestID: handler.requestID,
  })
}

/**
 * Create placeholder block for AI response
 * Returns the UUID of the created block
 */
async function createPlaceholderBlock(parentBlockUUID?: string): Promise<string> {
  try {
    let block

    if (parentBlockUUID) {
      // Create as child of parent block
      block = await logseq.Editor.insertBlock(
        parentBlockUUID,
        '⏳ AI is thinking...',
        {
          sibling: false,
        }
      )
    } else {
      // Create at end of current page
      const currentPage = await logseq.Editor.getCurrentPage()

      if (!currentPage) {
        throw new Error('No current page found')
      }

      block = await logseq.Editor.appendBlockInPage(
        currentPage.name,
        '⏳ AI is thinking...'
      )
    }

    if (!block) {
      throw new Error('Failed to create placeholder block')
    }

    logger.debug('Created placeholder block', {
      uuid: block.uuid,
      parent: parentBlockUUID || 'page',
    })

    return block.uuid
  } catch (error) {
    logger.error('Failed to create placeholder block', error as Error)
    throw error
  }
}

/**
 * Update block content
 */
async function updateBlock(blockUUID: string, content: string): Promise<void> {
  try {
    await logseq.Editor.updateBlock(blockUUID, content)
  } catch (error) {
    logger.error('Failed to update block', error as Error, {
      blockUUID,
    })
    throw error
  }
}

/**
 * Generate unique request ID
 */
function generateRequestID(): string {
  return `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
}
