/**
 * Summarization command handlers
 * T065: Implement "Summarize page" command handler
 * T066: Implement "Summarize block" command handler
 * T067: Add summarization prompt templates
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

const logger = createLogger('SummarizeCommands')

/**
 * T067: Summarization prompt templates
 */
const SUMMARIZE_PAGE_SYSTEM_PROMPT = `You are a helpful AI assistant integrated into Logseq. Your task is to create a concise, well-structured summary of the provided page content.

Focus on:
- Key points and main ideas
- Important insights and conclusions
- Actionable takeaways
- Logical structure and flow

Keep the summary brief and to the point. Use bullet points or paragraphs as appropriate.`

const SUMMARIZE_BLOCK_SYSTEM_PROMPT = `You are a helpful AI assistant integrated into Logseq. Your task is to create a concise summary of the provided block and its children.

Focus on:
- Main topic and key points
- Important details and insights
- Overall purpose or conclusion

Keep the summary brief and focused.`

/**
 * T065: Execute "Summarize page" command
 * Generates a concise summary of the current page
 */
export async function handleSummarizePage(
  settings?: PluginSettings
): Promise<void> {
  logger.info('Executing Summarize Page command')

  try {
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
    logger.debug('Extracting page context for summarization', { pageName })
    const context = await extractPageContext(
      pageName,
      effectiveSettings.llm.maxContextTokens
    )

    // Check if page has content
    if (!context.content || context.content.trim() === '') {
      await logseq.App.showMsg(
        '💡 The current page appears to be empty. Add some content first.',
        'warning'
      )
      return
    }

    if (context.wasTruncated) {
      logger.warn('Page context was truncated for summarization', {
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

    // Build request with summarization prompt
    const request: ChatCompletionRequest = {
      model: effectiveSettings.llm.modelName,
      messages: [
        {
          role: 'system',
          content: SUMMARIZE_PAGE_SYSTEM_PROMPT,
        },
        {
          role: 'user',
          content: `Please summarize the following page "${pageName}":\n\n${context.content}`,
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

    logger.info('Summarize Page command completed successfully')
  } catch (error) {
    logger.error('Summarize Page command failed', error as Error)

    await logseq.App.showMsg(
      `Failed to summarize page: ${error instanceof Error ? error.message : 'Unknown error'}`,
      'error'
    )
  }
}

/**
 * T066: Execute "Summarize block" command
 * Generates a concise summary of the current block and its children
 */
export async function handleSummarizeBlock(
  settings?: PluginSettings
): Promise<void> {
  logger.info('Executing Summarize Block command')

  try {
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
    logger.debug('Extracting block context for summarization', { blockUUID })
    const context = await extractBlockContext(
      blockUUID,
      effectiveSettings.llm.maxContextTokens
    )

    // Check if block has content
    if (!context.content || context.content.trim() === '') {
      await logseq.App.showMsg(
        '💡 The current block appears to be empty. Add some content first.',
        'warning'
      )
      return
    }

    if (context.wasTruncated) {
      logger.warn('Block context was truncated for summarization', {
        estimatedTokens: context.estimatedTokens,
      })
    }

    // Create response handler (T070: with abort controller)
    const { handler, abortController } = await createResponseHandler(blockUUID)

    // Create LLM client
    const client = new LLMClient(effectiveSettings.llm)

    // Build request with summarization prompt
    const request: ChatCompletionRequest = {
      model: effectiveSettings.llm.modelName,
      messages: [
        {
          role: 'system',
          content: SUMMARIZE_BLOCK_SYSTEM_PROMPT,
        },
        {
          role: 'user',
          content: `Please summarize the following block:\n\n${context.content}`,
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

    logger.info('Summarize Block command completed successfully')
  } catch (error) {
    logger.error('Summarize Block command failed', error as Error)

    await logseq.App.showMsg(
      `Failed to summarize block: ${error instanceof Error ? error.message : 'Unknown error'}`,
      'error'
    )
  }
}

/**
 * Execute LLM request with streaming or non-streaming mode
 * Shared logic for both summarization commands
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
    logger.debug('Starting streaming summarization request')

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
    logger.debug('Starting non-streaming summarization request')

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
