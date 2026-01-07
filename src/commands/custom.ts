/**
 * Custom command handler
 * T097: Register custom command handler
 * T099: Add prompt template variable substitution
 */

import type { PluginSettings } from '../config/settings'
import type { ChatCompletionRequest } from '../types'
import type { CustomCommandDefinition } from '../config/loader'
import { LLMClient } from '../llm/client'
import {
  createResponseHandler,
  updateWithChunk,
  markCompleted,
  markFailed,
} from '../llm/response-handler'
import { createLogger } from '../utils/logger'
import { extractTemplateVariables } from '../config/loader'

const logger = createLogger('CustomCommand')

/**
 * T097: Execute a custom command
 * Handles template variable substitution and LLM invocation
 */
export async function executeCustomCommand(
  command: CustomCommandDefinition,
  settings?: PluginSettings
): Promise<void> {
  logger.info('Executing custom command', { name: command.name })

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

    // Get settings
    const effectiveSettings = settings || (await getSettings())

    // Get block content
    const block = await logseq.Editor.getBlock(blockUUID, {
      includeChildren: true,
    })

    if (!block) {
      await logseq.App.showMsg('⚠️ Could not retrieve block content.', 'warning')
      return
    }

    // Extract block content for template substitution
    const content = extractBlockContent(block)

    // T099: Substitute template variables in prompt
    const filledPrompt = substituteTemplateVariables(command.prompt, {
      content,
      // Add more built-in variables as needed
    })

    // Check if any variables remain unfilled
    const remainingVars = extractTemplateVariables(filledPrompt)
    if (remainingVars.length > 0 && !remainingVars.includes('content')) {
      logger.warn('Prompt has unfilled template variables', {
        variables: remainingVars,
      })
      await logseq.App.showMsg(
        `⚠️ Prompt has unfilled variables: ${remainingVars.join(', ')}`,
        'warning'
      )
      // Continue anyway - user might have intended this
    }

    logger.debug('Executing custom command with filled prompt', {
      commandName: command.name,
      promptLength: filledPrompt.length,
    })

    // Create response handler
    const { handler, abortController } = await createResponseHandler(blockUUID)

    // Create LLM client
    const client = new LLMClient(effectiveSettings.llm)

    // Build request
    const request: ChatCompletionRequest = {
      model: effectiveSettings.llm.modelName,
      messages: [
        {
          role: 'user',
          content: filledPrompt,
        },
      ],
      temperature: effectiveSettings.llm.temperature,
      top_p: effectiveSettings.llm.topP,
      max_tokens: effectiveSettings.llm.maxTokens ?? undefined,
      stream: effectiveSettings.llm.streamingEnabled,
    }

    // Execute request
    if (effectiveSettings.llm.streamingEnabled) {
      logger.debug('Starting streaming custom command request')

      try {
        for await (const chunk of client.stream(request, abortController.signal)) {
          await updateWithChunk(handler, chunk)
        }

        await markCompleted(handler)
        logger.info('Custom command completed successfully')
      } catch (error) {
        await markFailed(handler, error as Error)
        throw error
      }
    } else {
      logger.debug('Starting non-streaming custom command request')

      try {
        const response = await client.chat(request)
        const responseContent = response.choices[0]?.message.content || ''

        handler.accumulatedContent = responseContent
        await logseq.Editor.updateBlock(handler.placeholderUUID, responseContent)

        await markCompleted(handler)
        logger.info('Custom command completed successfully')
      } catch (error) {
        await markFailed(handler, error as Error)
        throw error
      }
    }
  } catch (error) {
    logger.error('Custom command execution failed', error as Error)

    await logseq.App.showMsg(
      `Failed to execute "${command.name}": ${error instanceof Error ? error.message : 'Unknown error'}`,
      'error'
    )
  }
}

/**
 * T099: Substitute template variables in prompt
 * Supported variables:
 * - {{content}}: Current block content (including children)
 * - {{block}}: Current block content only (no children)
 * - Custom variables can be added by users
 */
function substituteTemplateVariables(
  prompt: string,
  variables: Record<string, string>
): string {
  let result = prompt

  // Replace all {{variable}} patterns
  for (const [key, value] of Object.entries(variables)) {
    const pattern = new RegExp(`\\{\\{${key}\\}\\}`, 'g')
    result = result.replace(pattern, value)
  }

  return result
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
 * Get plugin settings
 */
async function getSettings(): Promise<PluginSettings> {
  const settings = logseq.settings as PluginSettings

  if (!settings || !settings.llm) {
    const { defaultSettings } = await import('../config/settings')
    return defaultSettings
  }

  return settings
}
