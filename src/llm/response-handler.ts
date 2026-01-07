/**
 * Response handler for AI command execution
 * T043: Implement ResponseHandler for placeholder and streaming updates
 */

import type { ResponseHandler, ChatCompletionChunk } from '../types'
import { createLogger } from '../utils/logger'

const logger = createLogger('ResponseHandler')

/**
 * T069: Batching configuration for streaming updates
 * Update block at most once every 50ms to avoid excessive DOM updates
 */
const BATCH_UPDATE_INTERVAL_MS = 50

// Track pending updates for batching
const pendingUpdates = new Map<string, NodeJS.Timeout>()

// T125: Track active handlers for cancellation on navigation
const activeHandlers = new Map<string, AbortController>()

/**
 * T125: Register navigation handler to cancel in-flight requests
 * Should be called during plugin initialization
 */
export function registerNavigationHandler(): void {
  // Listen for route changes to cancel in-flight requests
  logseq.App.onRouteChanged(() => {
    logger.debug('Route changed, cancelling in-flight requests', {
      activeCount: activeHandlers.size,
    })

    // Cancel all active handlers
    for (const [requestID, abortController] of activeHandlers.entries()) {
      abortController.abort()
      activeHandlers.delete(requestID)
      logger.debug('Cancelled request due to navigation', { requestID })
    }

    // Clear all pending updates
    for (const [blockUUID, timeout] of pendingUpdates.entries()) {
      clearTimeout(timeout)
      pendingUpdates.delete(blockUUID)
    }
  })

  logger.info('Navigation handler registered for request cancellation')
}

/**
 * T125: Cleanup all active handlers (called on plugin unload)
 */
export function cleanupAllHandlers(): void {
  logger.debug('Cleaning up all handlers', {
    activeCount: activeHandlers.size,
    pendingCount: pendingUpdates.size,
  })

  // Cancel all active requests
  for (const [requestID, abortController] of activeHandlers.entries()) {
    abortController.abort()
    activeHandlers.delete(requestID)
  }

  // Clear all pending updates
  for (const [blockUUID, timeout] of pendingUpdates.entries()) {
    clearTimeout(timeout)
    pendingUpdates.delete(blockUUID)
  }

  logger.info('All handlers cleaned up')
}

/**
 * Create a response handler for streaming AI responses
 * Manages placeholder block creation and streaming updates
 * T070: Returns AbortController for request cancellation
 */
export async function createResponseHandler(
  parentBlockUUID?: string
): Promise<{ handler: ResponseHandler; abortController: AbortController }> {
  const requestID = generateRequestID()

  logger.debug('Creating response handler', {
    requestID,
    parentBlockUUID,
  })

  // Create placeholder block
  const placeholderUUID = await createPlaceholderBlock(parentBlockUUID)

  // T070: Create abort controller for cancellation support
  const abortController = new AbortController()

  // T125: Track active handler for navigation cancellation
  activeHandlers.set(requestID, abortController)

  const handler: ResponseHandler = {
    requestID,
    placeholderUUID,
    status: 'pending',
    accumulatedContent: '',
    errorMessage: null,
    startTime: Date.now(),
    cancelToken: abortController.signal,
  }

  return { handler, abortController }
}

/**
 * Update handler with streaming chunk
 * Accumulates content and updates the block with batching
 * T069: Batched updates (50ms intervals) for streaming efficiency
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

  // T069: Batch updates - schedule update instead of updating immediately
  scheduleBatchedUpdate(handler)

  logger.debug('Chunk received and batched', {
    requestID: handler.requestID,
    chunkLength: content.length,
    totalLength: handler.accumulatedContent.length,
  })
}

/**
 * T069: Schedule a batched update
 * Debounces updates to avoid excessive DOM manipulation
 */
function scheduleBatchedUpdate(handler: ResponseHandler): void {
  const blockUUID = handler.placeholderUUID

  // Clear any pending update for this block
  const existingTimeout = pendingUpdates.get(blockUUID)
  if (existingTimeout) {
    clearTimeout(existingTimeout)
  }

  // Schedule new update
  const timeout = setTimeout(async () => {
    await updateBlock(blockUUID, handler.accumulatedContent)
    pendingUpdates.delete(blockUUID)
  }, BATCH_UPDATE_INTERVAL_MS)

  pendingUpdates.set(blockUUID, timeout)
}

/**
 * Mark handler as completed
 * T069: Ensure final update is applied immediately (flush batched update)
 * T125: Remove from active handlers tracking
 */
export async function markCompleted(handler: ResponseHandler): Promise<void> {
  handler.status = 'completed'
  handler.completionTime = Date.now()

  // T125: Remove from active handlers
  activeHandlers.delete(handler.requestID)

  // T069: Flush any pending batched update
  flushBatchedUpdate(handler.placeholderUUID)

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
 * T069: Flush batched updates before showing error
 * T125: Remove from active handlers tracking
 */
export async function markFailed(
  handler: ResponseHandler,
  error: Error
): Promise<void> {
  handler.status = 'failed'
  handler.errorMessage = error.message
  handler.completionTime = Date.now()

  // T125: Remove from active handlers
  activeHandlers.delete(handler.requestID)

  // T069: Flush any pending batched update
  flushBatchedUpdate(handler.placeholderUUID)

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
 * T069: Flush batched updates before cancelling
 * T125: Remove from active handlers tracking
 */
export async function cancelHandler(handler: ResponseHandler): Promise<void> {
  handler.status = 'cancelled'
  handler.completionTime = Date.now()

  // T125: Remove from active handlers
  activeHandlers.delete(handler.requestID)

  // T069: Flush any pending batched update
  flushBatchedUpdate(handler.placeholderUUID)

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
 * T069: Flush any pending batched update immediately
 */
function flushBatchedUpdate(blockUUID: string): void {
  const existingTimeout = pendingUpdates.get(blockUUID)
  if (existingTimeout) {
    clearTimeout(existingTimeout)
    pendingUpdates.delete(blockUUID)
  }
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
