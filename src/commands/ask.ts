/**
 * Ask AI command handler
 * T042: Implement Ask AI command handler
 */

import type { PluginSettings } from '../config/settings'
import { LLMClient } from '../llm/client'
import {
  createResponseHandler,
  updateWithChunk,
  markCompleted,
  markFailed,
} from '../llm/response-handler'
import { createLogger } from '../utils/logger'
import { sanitizeForLogseq } from '../utils/formatter'

const logger = createLogger('AskCommand')

/**
 * Execute Ask AI command
 * Prompts user for question and streams AI response
 */
export async function executeAskCommand(
  settings: PluginSettings
): Promise<void> {
  logger.info('Executing Ask AI command')

  try {
    // Prompt user for question
    const question = await promptForQuestion()

    if (!question || question.trim() === '') {
      logger.info('User cancelled or provided empty question')
      return
    }

    logger.debug('User question', { question })

    // Get current block for placement
    const currentBlock = await logseq.Editor.getCurrentBlock()
    const parentBlockUUID = currentBlock?.uuid

    // Create response handler (T070: with abort controller)
    const { handler, abortController } = await createResponseHandler(parentBlockUUID)

    // Create LLM client
    const client = new LLMClient(settings.llm)

    // Build request
    const request = {
      model: settings.llm.modelName,
      messages: [
        {
          role: 'system' as const,
          content:
            'You are a helpful AI assistant integrated into Logseq. Respond to user requests accurately and helpfully. Handle various types of requests including questions, instructions, summaries, translations, or any other tasks.\n\nIMPORTANT FORMATTING RULES:\n- Use simple, flat markdown lists (single "-" prefix only)\n- Avoid nested or indented lists (no "  - " or multiple levels)\n- Keep content concise and single-line where possible\n- Do NOT use code blocks (```) or tables for structured content\n- Each list item should be independent and flat',
        },
        {
          role: 'user' as const,
          content: question,
        },
      ],
      temperature: settings.llm.temperature,
      top_p: settings.llm.topP,
      max_tokens: settings.llm.maxTokens ?? undefined,
      stream: settings.llm.streamingEnabled,
    }

    // Stream response
    if (settings.llm.streamingEnabled) {
      logger.debug('Starting streaming request')

      try {
        // T070: Pass cancel signal to stream for cancellation support
        for await (const chunk of client.stream(request, abortController.signal)) {
          await updateWithChunk(handler, chunk)
        }

        // Apply formatting before final update
        if (settings.enableFormatting && handler.accumulatedContent) {
          handler.accumulatedContent = sanitizeForLogseq(handler.accumulatedContent, {
            enableFormatting: true,
            logModifications: settings.logFormattingModifications,
            commandType: 'ask',
          })
        }

        await markCompleted(handler)
      } catch (error) {
        await markFailed(handler, error as Error)
        throw error
      }
    } else {
      // Non-streaming request
      logger.debug('Starting non-streaming request')

      try {
        const response = await client.chat(request)
        const content = response.choices[0]?.message.content || ''

        // Apply formatting before updating block
        let finalContent = content
        if (settings.enableFormatting && content) {
          finalContent = sanitizeForLogseq(content, {
            enableFormatting: true,
            logModifications: settings.logFormattingModifications,
            commandType: 'ask',
          })
        }

        handler.accumulatedContent = finalContent
        await logseq.Editor.updateBlock(handler.placeholderUUID, finalContent)

        await markCompleted(handler)
      } catch (error) {
        await markFailed(handler, error as Error)
        throw error
      }
    }

    logger.info('Ask AI command completed successfully')
  } catch (error) {
    logger.error('Ask AI command failed', error as Error)

    await logseq.App.showMsg(
      `AI request failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      'error'
    )
  }
}

/**
 * Prompt user for question by getting current block content
 * Logseq doesn't have a built-in input dialog, so we use the block content
 */
async function promptForQuestion(): Promise<string | null> {
  // Get current block content as the question
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
