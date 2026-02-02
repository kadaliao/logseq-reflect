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
import { sanitizeForLogseq, formatSummaryList } from '../utils/formatter'

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

IMPORTANT FORMATTING RULES:
- Use ONLY flat, single-level bullet lists (start with "- ")
- Do NOT create nested or indented sub-bullets
- Keep each bullet point on a single line
- Avoid code blocks, tables, or complex markdown structures
- Use simple paragraphs or flat lists only

Keep the summary brief and to the point.`

const SUMMARIZE_BLOCK_SYSTEM_PROMPT = `You are a helpful AI assistant integrated into Logseq. Your task is to create a concise summary of the provided block and its children.

Focus on:
- Main topic and key points
- Important details and insights
- Overall purpose or conclusion

IMPORTANT FORMATTING RULES:
- Use ONLY flat, single-level bullet lists (start with "- ")
- Do NOT create nested or indented sub-bullets
- Keep each bullet point on a single line
- Avoid code blocks, tables, or complex markdown structures

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

    // Always create a handler (with placeholder child block)
    // We'll decide later whether to use current block or placeholder
    const { handler, abortController } = await createResponseHandler(parentBlockUUID)

    // Check if current block is empty (after stripping whitespace)
    const isCurrentBlockEmpty = !currentBlock?.content || currentBlock.content.trim() === ''

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
      effectiveSettings,
      parentBlockUUID,
      isCurrentBlockEmpty,
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

    // Use the current block as parent for summary
    const parentBlockUUID = blockUUID

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
      effectiveSettings,
      parentBlockUUID,
      false, // summarize-block always uses placeholder
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
 * Applies formatting to fix list concatenation issues
 */
async function executeRequest(
  client: LLMClient,
  request: ChatCompletionRequest,
  handler: ResponseHandler,
  streaming: boolean,
  settings: PluginSettings,
  parentBlockUUID: string | undefined,
  useParentBlock: boolean,
  cancelSignal?: AbortSignal
): Promise<void> {
  if (streaming) {
    logger.debug('Starting streaming summarization request')

    try {
      // T070: Pass cancel signal for cancellation support
      for await (const chunk of client.stream(request, cancelSignal)) {
        await updateWithChunk(handler, chunk)
      }

      // Apply formatting and create blocks
      await createSummaryBlocks(
        handler.accumulatedContent,
        settings,
        parentBlockUUID,
        useParentBlock,
        handler.placeholderUUID
      )
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

      // Apply formatting and create blocks
      await createSummaryBlocks(
        content,
        settings,
        parentBlockUUID,
        useParentBlock,
        handler.placeholderUUID
      )
    } catch (error) {
      await markFailed(handler, error as Error)
      throw error
    }
  }
}

/**
 * Create summary blocks from AI response
 * Parses the response and creates child blocks for list items
 *
 * @param aiResponse - The AI-generated summary content
 * @param settings - Plugin settings for formatting options
 * @param parentBlockUUID - The parent block UUID (user's current block)
 * @param useParentBlock - If true, use parent block for header; if false, use placeholder
 * @param placeholderUUID - The placeholder block UUID (created for streaming)
 */
async function createSummaryBlocks(
  aiResponse: string,
  settings: PluginSettings,
  parentBlockUUID: string | undefined,
  useParentBlock: boolean,
  placeholderUUID: string
): Promise<void> {
  logger.debug('Creating summary blocks from AI response', {
    parentBlockUUID,
    useParentBlock,
    placeholderUUID,
  })

  // Apply formatting if enabled
  let formattedResponse = aiResponse

  if (settings.enableFormatting) {
    // First apply general sanitization (flatten nested lists, normalize tags, etc.)
    formattedResponse = sanitizeForLogseq(formattedResponse, {
      enableFormatting: true,
      logModifications: settings.logFormattingModifications,
      commandType: 'summarize',
    })

    // Then apply summary-specific formatting (fix concatenated list items)
    formattedResponse = formatSummaryList(formattedResponse)

    logger.debug('Applied formatting to summary', {
      originalLength: aiResponse.length,
      formattedLength: formattedResponse.length,
    })
  }

  // Parse the response to separate list items from other content
  const lines = formattedResponse.split('\n')
  const listItems: string[] = []
  const nonListContent: string[] = []

  for (const line of lines) {
    const trimmed = line.trim()
    if (trimmed.startsWith('- ')) {
      // This is a list item
      listItems.push(trimmed.substring(2).trim())
    } else if (trimmed.length > 0) {
      // This is regular content (paragraph, heading, etc.)
      nonListContent.push(trimmed)
    }
  }

  logger.debug('Parsed summary content:', {
    listItems: listItems.length,
    nonListLines: nonListContent.length,
  })

  // Determine which block to use as the header
  let headerBlockUUID: string

  if (useParentBlock && parentBlockUUID) {
    // Use parent block as header, remove the placeholder
    headerBlockUUID = parentBlockUUID
    await logseq.Editor.removeBlock(placeholderUUID)
  } else {
    // Use placeholder block as header
    headerBlockUUID = placeholderUUID
  }

  // Update the header block with content
  if (nonListContent.length > 0) {
    // Use the AI-generated non-list content as header
    const headerContent = nonListContent.join('\n')
    await logseq.Editor.updateBlock(headerBlockUUID, headerContent)
  } else {
    // If there's no non-list content, set it to "Summary"
    await logseq.Editor.updateBlock(headerBlockUUID, 'Summary')
  }

  // Create child blocks for list items under the header block
  if (listItems.length > 0) {
    logger.info(`Creating ${listItems.length} summary blocks as children of ${headerBlockUUID}`)

    for (let i = 0; i < listItems.length; i++) {
      const item = listItems[i]
      logger.debug(`Creating summary block ${i + 1}/${listItems.length}: "${item}"`)

      try {
        const createdBlock = await logseq.Editor.insertBlock(
          headerBlockUUID,
          item,
          { sibling: false } // Insert as child, not sibling
        )

        if (createdBlock) {
          logger.debug(`Successfully created block with UUID: ${createdBlock.uuid}`)
        } else {
          logger.error(`Failed to create block for item: "${item}"`)
        }
      } catch (error) {
        logger.error(`Error creating summary block: ${error}`, error as Error)
      }
    }

    await logseq.App.showMsg(`✅ Created summary with ${listItems.length} point(s)`, 'success')
  } else {
    // No list items, just show completion message
    await logseq.App.showMsg('✅ Summary completed', 'success')
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
