/**
 * Flashcard generation command handler
 * T075: Implement "Generate flashcard" command handler
 * T076: Add flashcard prompt template
 * T077: Implement nested block creation with #card tag
 * T078: Add insufficient content detection and user feedback
 */

import type { PluginSettings } from '../config/settings'
import type { ChatCompletionRequest } from '../types'
import { LLMClient } from '../llm/client'
import {
  createResponseHandler,
  updateWithChunk,
  markCompleted,
  markFailed,
} from '../llm/response-handler'
import { createLogger } from '../utils/logger'

const logger = createLogger('FlashcardCommand')

/**
 * T076: Flashcard generation prompt template
 */
const FLASHCARD_GENERATION_SYSTEM_PROMPT = `You are a helpful AI assistant integrated into Logseq. Your task is to generate flashcards from the provided content for spaced repetition learning.

Create question-answer pairs in the following format:
- Start each question with "Q: "
- Start each answer with "A: "
- Add #card tag at the end of the answer
- Focus on key facts, concepts, and definitions
- Make questions clear and specific
- Keep answers concise but complete

Example format:
Q: What is the capital of France?
A: Paris #card

If the content has multiple facts, create multiple Q&A pairs separated by blank lines.`

/**
 * Minimum content length for flashcard generation (characters)
 */
const MIN_CONTENT_LENGTH = 20

/**
 * T075: Execute "Generate flashcard" command
 * Generates question-answer flashcard pairs from block content
 */
export async function handleGenerateFlashcard(
  settings?: PluginSettings
): Promise<void> {
  logger.info('Executing Generate Flashcard command')

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

    // Get block content
    const block = await logseq.Editor.getBlock(blockUUID, {
      includeChildren: true,
    })

    if (!block) {
      await logseq.App.showMsg(
        '⚠️ Could not retrieve block content.',
        'warning'
      )
      return
    }

    // Extract content from block and children
    const content = extractBlockContent(block)

    // T078: Check for empty content
    if (!content || content.trim() === '') {
      await logseq.App.showMsg(
        '💡 The current block appears to be empty. Add some content first.',
        'warning'
      )
      return
    }

    // T078: Check for insufficient content
    if (content.trim().length < MIN_CONTENT_LENGTH) {
      await logseq.App.showMsg(
        '💡 This block has insufficient content for flashcard generation. Please provide more detailed content (facts, definitions, or concepts).',
        'warning'
      )
      return
    }

    logger.debug('Generating flashcards for block', {
      blockUUID,
      contentLength: content.length,
    })

    // Create response handler (with placeholder block)
    const { handler, abortController } = await createResponseHandler(blockUUID)

    // Create LLM client
    const client = new LLMClient(effectiveSettings.llm)

    // Build request with flashcard generation prompt
    const request: ChatCompletionRequest = {
      model: effectiveSettings.llm.modelName,
      messages: [
        {
          role: 'system',
          content: FLASHCARD_GENERATION_SYSTEM_PROMPT,
        },
        {
          role: 'user',
          content: `Please generate flashcard(s) from the following content:\n\n${content}`,
        },
      ],
      temperature: effectiveSettings.llm.temperature,
      top_p: effectiveSettings.llm.topP,
      max_tokens: effectiveSettings.llm.maxTokens ?? undefined,
      stream: effectiveSettings.llm.streamingEnabled,
    }

    // Execute request with streaming or non-streaming
    if (effectiveSettings.llm.streamingEnabled) {
      logger.debug('Starting streaming flashcard generation request')

      try {
        for await (const chunk of client.stream(request, abortController.signal)) {
          await updateWithChunk(handler, chunk)
        }

        await markCompleted(handler)

        // T077: Parse and create nested blocks with #card tags
        await createFlashcardBlocks(blockUUID, handler.accumulatedContent)

        logger.info('Flashcard generation completed successfully')
      } catch (error) {
        await markFailed(handler, error as Error)
        throw error
      }
    } else {
      logger.debug('Starting non-streaming flashcard generation request')

      try {
        const response = await client.chat(request)
        const content = response.choices[0]?.message.content || ''

        handler.accumulatedContent = content
        await logseq.Editor.updateBlock(handler.placeholderUUID, content)

        await markCompleted(handler)

        // T077: Parse and create nested blocks with #card tags
        await createFlashcardBlocks(blockUUID, content)

        logger.info('Flashcard generation completed successfully')
      } catch (error) {
        await markFailed(handler, error as Error)
        throw error
      }
    }
  } catch (error) {
    logger.error('Generate Flashcard command failed', error as Error)

    await logseq.App.showMsg(
      `Failed to generate flashcard: ${error instanceof Error ? error.message : 'Unknown error'}`,
      'error'
    )
  }
}

/**
 * Extract content from block and its children
 */
function extractBlockContent(block: any): string {
  const lines: string[] = []

  // Add block content
  if (block.content) {
    lines.push(block.content)
  }

  // Recursively add children content
  if (block.children && block.children.length > 0) {
    for (const child of block.children) {
      const childContent = extractBlockContent(child)
      if (childContent) {
        lines.push(childContent)
      }
    }
  }

  return lines.join('\n')
}

/**
 * T077: Create nested flashcard blocks with #card tags
 * Parses the AI response and creates separate blocks for questions and answers
 */
async function createFlashcardBlocks(
  parentBlockUUID: string,
  aiResponse: string
): Promise<void> {
  logger.debug('Creating flashcard blocks from AI response')

  // Remove the placeholder block first
  const blocks = await logseq.Editor.getBlock(parentBlockUUID, {
    includeChildren: true,
  })

  if (blocks && blocks.children) {
    // Find and remove the placeholder (should be the last child)
    const lastChild = blocks.children[blocks.children.length - 1]
    if (lastChild && lastChild.content.includes('AI is thinking')) {
      await logseq.Editor.removeBlock(lastChild.uuid)
    }
  }

  // Parse Q&A pairs from the response
  // Expected format: "Q: question\nA: answer #card"
  const qaPattern = /Q:\s*(.+?)\s*\nA:\s*(.+?)(?=\n\nQ:|$)/gs
  const matches = [...aiResponse.matchAll(qaPattern)]

  if (matches.length === 0) {
    // Fallback: create a single block with the entire response
    logger.warn('Could not parse Q&A pairs, creating single flashcard block')
    await logseq.Editor.insertBlock(
      parentBlockUUID,
      `${aiResponse}${aiResponse.includes('#card') ? '' : ' #card'}`,
      { sibling: false }
    )
    return
  }

  // Create separate blocks for each Q&A pair
  for (const match of matches) {
    const question = match[1].trim()
    const answer = match[2].trim()

    // Create question block
    const questionBlock = await logseq.Editor.insertBlock(
      parentBlockUUID,
      `Q: ${question}`,
      { sibling: false }
    )

    if (questionBlock) {
      // Create answer block as child of question
      const answerContent = answer.includes('#card') ? answer : `${answer} #card`
      await logseq.Editor.insertBlock(
        questionBlock.uuid,
        `A: ${answerContent}`,
        { sibling: false }
      )
    }
  }

  logger.info(`Created ${matches.length} flashcard Q&A pair(s)`)
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
