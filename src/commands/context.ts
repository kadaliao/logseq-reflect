/**
 * Context-aware command handlers
 * T054: Implement "Ask with page context" command handler
 * T055: Implement "Ask with block context" command handler
 */

import type { PluginSettings } from '../config/settings'
import type { ChatCompletionRequest, ResponseHandler } from '../types'
import { LLMClient } from '../llm/client'
import {
  createResponseHandler,
  updateWithChunk,
  markCompleted,
  markFailed,
} from '../llm/response-handler'
import { extractPageContext, extractBlockContext } from '../context/extractor'
import { createLogger } from '../utils/logger'

const logger = createLogger('ContextCommands')

/**
 * Execute "Ask with page context" command
 * Includes current page content as context for the AI
 */
export async function handleAskWithPageContext(
  prompt: string,
  settings?: PluginSettings
): Promise<void> {
  logger.info('Executing Ask with Page Context command')

  try {
    // Get user input if not provided
    const userInput = prompt || (await promptForInput())

    if (!userInput || userInput.trim() === '') {
      logger.info('User cancelled or provided empty input')
      return
    }

    logger.debug('User input with page context', { prompt: userInput })

    // Get current page
    const currentPage = await logseq.Editor.getCurrentPage()

    if (!currentPage) {
      await logseq.App.showMsg(
        '⚠️ No active page found. Please ensure you are on a page.',
        'warning'
      )
      return
    }

    const pageName: string =
      (typeof currentPage.originalName === 'string' && currentPage.originalName) ||
      (typeof currentPage.name === 'string' && currentPage.name) ||
      'Unknown Page'

    // Get settings (fallback to default if not provided)
    const effectiveSettings = settings || (await getSettings())

    // Extract page context
    logger.debug('Extracting page context', { pageName })
    const context = await extractPageContext(
      pageName,
      effectiveSettings.llm.maxContextTokens
    )

    if (context.wasTruncated) {
      logger.warn('Page context was truncated', {
        estimatedTokens: context.estimatedTokens,
      })
    }

    // Get current block for placement
    const currentBlock = await logseq.Editor.getCurrentBlock()
    const parentBlockUUID = currentBlock?.uuid

    // Create response handler (T070: with abort controller)
    const { handler, abortController } = await createResponseHandler(parentBlockUUID)

    // Create LLM client
    const client = new LLMClient(effectiveSettings.llm)

    // Build request with context
    const request = {
      model: effectiveSettings.llm.modelName,
      messages: [
        {
          role: 'system' as const,
          content:
            'You are a helpful AI assistant integrated into Logseq. Use the provided page context to respond to user requests accurately and relevantly. Handle various types of requests including questions, instructions, summaries, translations, or any other tasks.',
        },
        ...(context.content
          ? [
              {
                role: 'user' as const,
                content: `Here is the context from the current page "${pageName}":\n\n${context.content}`,
              },
            ]
          : []),
        {
          role: 'user' as const,
          content: userInput,
        },
      ],
      temperature: effectiveSettings.llm.temperature,
      top_p: effectiveSettings.llm.topP,
      max_tokens: effectiveSettings.llm.maxTokens ?? undefined,
      stream: effectiveSettings.llm.streamingEnabled,
    }

    // Stream response
    await executeRequest(
      client,
      request,
      handler,
      effectiveSettings.llm.streamingEnabled,
      abortController.signal
    )

    logger.info('Ask with Page Context command completed successfully')
  } catch (error) {
    logger.error('Ask with Page Context command failed', error as Error)

    await logseq.App.showMsg(
      `AI request failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      'error'
    )
  }
}

/**
 * Execute "Ask with block context" command
 * Includes current block and its children as context for the AI
 */
export async function handleAskWithBlockContext(
  prompt: string,
  settings?: PluginSettings
): Promise<void> {
  logger.info('Executing Ask with Block Context command')

  try {
    // Get user input if not provided
    const userInput = prompt || (await promptForInput())

    if (!userInput || userInput.trim() === '') {
      logger.info('User cancelled or provided empty input')
      return
    }

    logger.debug('User input with block context', { prompt: userInput })

    // Get current block
    const currentBlock = await logseq.Editor.getCurrentBlock()

    if (!currentBlock) {
      await logseq.App.showMsg(
        '⚠️ No active block found. Please ensure your cursor is in a block.',
        'warning'
      )
      return
    }

    const blockUUID = currentBlock.uuid

    // Get settings (fallback to default if not provided)
    const effectiveSettings = settings || (await getSettings())

    // Extract block context
    logger.debug('Extracting block context', { blockUUID })
    const context = await extractBlockContext(
      blockUUID,
      effectiveSettings.llm.maxContextTokens
    )

    if (context.wasTruncated) {
      logger.warn('Block context was truncated', {
        estimatedTokens: context.estimatedTokens,
      })
    }

    // Create response handler (T070: with abort controller)
    const { handler, abortController } = await createResponseHandler(blockUUID)

    // Create LLM client
    const client = new LLMClient(effectiveSettings.llm)

    // Build request with context
    const request = {
      model: effectiveSettings.llm.modelName,
      messages: [
        {
          role: 'system' as const,
          content:
            'You are a helpful AI assistant integrated into Logseq. Use the provided block context to respond to user requests accurately and relevantly. Handle various types of requests including questions, instructions, summaries, translations, or any other tasks.',
        },
        ...(context.content
          ? [
              {
                role: 'user' as const,
                content: `Here is the context from the current block:\n\n${context.content}`,
              },
            ]
          : []),
        {
          role: 'user' as const,
          content: userInput,
        },
      ],
      temperature: effectiveSettings.llm.temperature,
      top_p: effectiveSettings.llm.topP,
      max_tokens: effectiveSettings.llm.maxTokens ?? undefined,
      stream: effectiveSettings.llm.streamingEnabled,
    }

    // Stream response
    await executeRequest(
      client,
      request,
      handler,
      effectiveSettings.llm.streamingEnabled,
      abortController.signal
    )

    logger.info('Ask with Block Context command completed successfully')
  } catch (error) {
    logger.error('Ask with Block Context command failed', error as Error)

    await logseq.App.showMsg(
      `AI request failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      'error'
    )
  }
}

/**
 * Execute LLM request with streaming or non-streaming mode
 * Shared logic for both context-aware commands
 * T070: Supports cancellation via AbortSignal
 */
async function executeRequest(
  client: LLMClient,
  request: ChatCompletionRequest,
  handler: ResponseHandler,
  streaming: boolean,
  cancelSignal?: AbortSignal
): Promise<void> {
  if (streaming) {
    logger.debug('Starting streaming request')

    try {
      // T070: Pass cancel signal for cancellation support
      for await (const chunk of client.stream(request, cancelSignal)) {
        await updateWithChunk(handler, chunk)
      }

      await markCompleted(handler)
    } catch (error) {
      await markFailed(handler, error as Error)
      throw error
    }
  } else {
    logger.debug('Starting non-streaming request')

    try {
      const response = await client.chat(request)
      const content = response.choices[0]?.message.content || ''

      handler.accumulatedContent = content
      await logseq.Editor.updateBlock(handler.placeholderUUID, content)

      await markCompleted(handler)
    } catch (error) {
      await markFailed(handler, error as Error)
      throw error
    }
  }
}

/**
 * Prompt user for input by getting current block content
 * Logseq doesn't have a built-in input dialog, so we use the block content
 */
async function promptForInput(): Promise<string | null> {
  // Get current block content as the user input
  const currentBlock = await logseq.Editor.getCurrentBlock()

  if (!currentBlock || !currentBlock.content) {
    logseq.App.showMsg(
      '💡 Please write your instruction or question in a block first, then use the command',
      'warning'
    )
    return null
  }

  return currentBlock.content
}

/**
 * Get plugin settings from Logseq
 */
async function getSettings(): Promise<PluginSettings> {
  // Get settings from Logseq plugin settings
  const settings = logseq.settings as PluginSettings

  if (!settings || !settings.llm) {
    // Fallback to defaults if settings not available
    const { defaultSettings } = await import('../config/settings')
    return defaultSettings
  }

  return settings
}
