/**
 * Task breakdown command handler
 * T083: Implement "Divide into subtasks" command handler
 * T084: Add task breakdown prompt template
 * T085: Implement TODO block detection
 * T086: Implement nested subtask generation with indentation
 * T087: Add non-TODO block handling with user feedback
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

const logger = createLogger('TasksCommand')

/**
 * T084: Task breakdown prompt template
 */
export const TASK_BREAKDOWN_SYSTEM_PROMPT = `You are a helpful AI assistant integrated into Logseq. Your task is to break down a TODO item into actionable subtasks.

Create a list of subtasks in the following format:
- Start each subtask with the same marker (TODO, DOING, or DONE) as the parent task
- Use "- " prefix for each subtask (markdown list format)
- Make subtasks specific, actionable, and ordered logically
- Keep subtasks focused and atomic (completable in one session)
- Aim for 3-7 subtasks unless the task is very complex

Example format for a TODO item:
TODO Design user authentication system

Should become:
- TODO Research authentication libraries and frameworks
- TODO Design database schema for user credentials
- TODO Implement password hashing and salting
- TODO Create login/logout endpoints
- TODO Add session management
- TODO Write authentication tests

Only output the subtasks, nothing else.`

/**
 * Valid TODO markers that Logseq recognizes
 */
const TODO_MARKERS = ['TODO', 'DOING', 'DONE', 'LATER', 'NOW', 'WAITING', 'CANCELLED']

/**
 * T083: Execute "Divide into subtasks" command
 * Breaks down a TODO item into nested subtasks
 */
export async function handleDivideIntoSubtasks(
  settings?: PluginSettings
): Promise<void> {
  logger.info('Executing Divide into Subtasks command')

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

    // Get block with full details
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

    // T085: Detect TODO marker
    const marker = detectTodoMarker(block)

    if (!marker) {
      // T087: Handle non-TODO blocks with user feedback
      await logseq.App.showMsg(
        '💡 This block does not have a TODO marker. Please add a marker (TODO, DOING, etc.) to use task breakdown.',
        'warning'
      )
      return
    }

    // Extract task description (remove marker)
    const taskDescription = block.content.replace(new RegExp(`^${marker}\\s*`), '').trim()

    if (!taskDescription || taskDescription.length < 10) {
      await logseq.App.showMsg(
        '💡 The task description is too short. Please provide more details about what needs to be done.',
        'warning'
      )
      return
    }

    logger.debug('Breaking down TODO task', {
      blockUUID,
      marker,
      taskLength: taskDescription.length,
    })

    // Create response handler (with placeholder block)
    const { handler, abortController } = await createResponseHandler(blockUUID)

    // Create LLM client
    const client = new LLMClient(effectiveSettings.llm)

    // Build request with task breakdown prompt
    const request: ChatCompletionRequest = {
      model: effectiveSettings.llm.modelName,
      messages: [
        {
          role: 'system',
          content: TASK_BREAKDOWN_SYSTEM_PROMPT,
        },
        {
          role: 'user',
          content: `Please break down this ${marker} task into subtasks:\n\n${marker} ${taskDescription}`,
        },
      ],
      temperature: effectiveSettings.llm.temperature,
      top_p: effectiveSettings.llm.topP,
      max_tokens: effectiveSettings.llm.maxTokens ?? undefined,
      stream: effectiveSettings.llm.streamingEnabled,
    }

    // Execute request with streaming or non-streaming
    if (effectiveSettings.llm.streamingEnabled) {
      logger.debug('Starting streaming task breakdown request')

      try {
        for await (const chunk of client.stream(request, abortController.signal)) {
          await updateWithChunk(handler, chunk)
        }

        await markCompleted(handler)

        // T086: Parse and create nested subtask blocks
        await createSubtaskBlocks(blockUUID, handler.accumulatedContent, marker)

        logger.info('Task breakdown completed successfully')
      } catch (error) {
        await markFailed(handler, error as Error)
        throw error
      }
    } else {
      logger.debug('Starting non-streaming task breakdown request')

      try {
        const response = await client.chat(request)
        const content = response.choices[0]?.message.content || ''

        handler.accumulatedContent = content
        await logseq.Editor.updateBlock(handler.placeholderUUID, content)

        await markCompleted(handler)

        // T086: Parse and create nested subtask blocks
        await createSubtaskBlocks(blockUUID, content, marker)

        logger.info('Task breakdown completed successfully')
      } catch (error) {
        await markFailed(handler, error as Error)
        throw error
      }
    }
  } catch (error) {
    logger.error('Divide into Subtasks command failed', error as Error)

    await logseq.App.showMsg(
      `Failed to divide into subtasks: ${error instanceof Error ? error.message : 'Unknown error'}`,
      'error'
    )
  }
}

/**
 * T085: Detect TODO marker in block content
 */
function detectTodoMarker(block: any): string | null {
  // Check if block has explicit marker property
  if (block.marker && TODO_MARKERS.includes(block.marker)) {
    return block.marker
  }

  // Fallback: check content for marker at start
  const content = block.content || ''
  for (const marker of TODO_MARKERS) {
    if (content.trim().startsWith(`${marker} `)) {
      return marker
    }
  }

  return null
}

/**
 * T086: Create nested subtask blocks with proper indentation
 * Parses the AI response and creates child blocks under the parent TODO
 */
async function createSubtaskBlocks(
  parentBlockUUID: string,
  aiResponse: string,
  marker: string
): Promise<void> {
  logger.debug('Creating subtask blocks from AI response')

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

  // Parse subtasks from response
  // Expected format: "- TODO Subtask description"
  const lines = aiResponse.split('\n').map(line => line.trim()).filter(line => line.length > 0)

  const subtasks: string[] = []
  for (const line of lines) {
    // Match lines starting with "- " (markdown list)
    if (line.startsWith('- ')) {
      const subtask = line.substring(2).trim()

      // Ensure subtask has the correct marker
      // If it already has a marker, keep it; otherwise add parent's marker
      let formattedSubtask = subtask
      const hasMarker = TODO_MARKERS.some(m => subtask.startsWith(`${m} `))

      if (!hasMarker) {
        formattedSubtask = `${marker} ${subtask}`
      }

      subtasks.push(formattedSubtask)
    }
  }

  if (subtasks.length === 0) {
    // Fallback: if no proper list format, try to parse any TODO markers
    logger.warn('Could not parse subtask list, falling back to marker detection')

    for (const line of lines) {
      for (const m of TODO_MARKERS) {
        if (line.startsWith(`${m} `)) {
          subtasks.push(line)
          break
        }
      }
    }
  }

  if (subtasks.length === 0) {
    logger.warn('No subtasks found in AI response')
    await logseq.App.showMsg(
      '⚠️ Could not parse subtasks from AI response. Please try again.',
      'warning'
    )
    return
  }

  // Create subtask blocks as children of parent
  for (const subtask of subtasks) {
    await logseq.Editor.insertBlock(
      parentBlockUUID,
      subtask,
      { sibling: false } // Insert as child, not sibling
    )
  }

  logger.info(`Created ${subtasks.length} subtask(s)`)
  await logseq.App.showMsg(
    `✅ Created ${subtasks.length} subtask(s)`,
    'success'
  )
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
