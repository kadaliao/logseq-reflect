/**
 * OpenAI-compatible LLM client
 * T022: Implement OpenAI-compatible LLM client base
 */

import type {
  ChatCompletionRequest,
  ChatCompletionResponse,
  ChatCompletionChunk,
  ModelConfiguration,
} from '../types'
import { createLogger } from '../utils/logger'
import { parseSSEStream } from './streaming'

const logger = createLogger('LLMClient')

/**
 * LLM client for OpenAI-compatible endpoints
 * Supports both streaming and non-streaming requests
 */
export class LLMClient {
  constructor(private config: ModelConfiguration) {}

  /**
   * Send non-streaming chat completion request
   * Includes retry logic and timeout handling
   */
  async chat(request: ChatCompletionRequest): Promise<ChatCompletionResponse> {
    const url = `${this.config.baseURL}${this.config.apiPath}`
    const headers = this.buildHeaders()

    let lastError: Error | null = null
    const maxAttempts = this.config.retryCount + 1

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        logger.debug(`Sending chat request (attempt ${attempt}/${maxAttempts})`, {
          url,
          model: request.model,
        })

        const controller = new AbortController()
        const timeoutId = setTimeout(() => {
          controller.abort()
        }, this.config.timeoutSeconds * 1000)

        let response: Response
        try {
          response = await fetch(url, {
            method: 'POST',
            headers,
            body: JSON.stringify(request),
            signal: controller.signal,
          })

          clearTimeout(timeoutId)
        } catch (fetchError) {
          clearTimeout(timeoutId)
          throw fetchError
        }

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`)
        }

        const data = (await response.json()) as ChatCompletionResponse

        logger.debug('Chat request successful', {
          id: data.id,
          model: data.model,
          finish_reason: data.choices[0]?.finish_reason,
        })

        return data
      } catch (error) {
        lastError = error as Error

        // Don't retry on abort/timeout
        if (error instanceof Error && error.name === 'AbortError') {
          logger.error('Request timeout', error)
          throw new Error(`Request timeout after ${this.config.timeoutSeconds}s`)
        }

        // Don't retry on HTTP errors (server-side issues)
        if (error instanceof Error && error.message.startsWith('HTTP')) {
          logger.error('HTTP error', error)
          throw error
        }

        // Log retry attempt
        if (attempt < maxAttempts) {
          logger.warn(`Request failed, retrying (${attempt}/${this.config.retryCount})`, {
            error: error instanceof Error ? error.message : String(error),
          })

          // Exponential backoff: 100ms, 200ms, 400ms, etc.
          await this.delay(100 * Math.pow(2, attempt - 1))
        }
      }
    }

    // All retries exhausted
    const finalError = lastError ?? new Error('Unknown error')
    logger.error('All retry attempts failed', finalError)
    throw finalError
  }

  /**
   * Send streaming chat completion request
   * Returns async iterator of response chunks
   */
  async *stream(
    request: ChatCompletionRequest,
    cancelSignal?: AbortSignal
  ): AsyncIterable<ChatCompletionChunk> {
    const url = `${this.config.baseURL}${this.config.apiPath}`
    const headers = this.buildHeaders()

    logger.debug('Starting streaming request', {
      url,
      model: request.model,
    })

    const controller = new AbortController()
    const timeoutId = setTimeout(() => {
      controller.abort()
    }, this.config.timeoutSeconds * 1000)

    // Combine timeout and user cancellation
    if (cancelSignal) {
      cancelSignal.addEventListener('abort', () => {
        controller.abort()
      })
    }

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(request),
        signal: controller.signal,
      })

      clearTimeout(timeoutId)

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      if (!response.body) {
        throw new Error('Response body is null')
      }

      // Parse SSE stream and yield chunks
      for await (const chunk of parseSSEStream(response.body)) {
        // Validate chunk structure before yielding
        if (!chunk.choices || chunk.choices.length === 0) {
          logger.warn('Received malformed chunk, skipping', { chunk })
          continue
        }

        logger.debug('Received chunk', {
          delta: chunk.choices[0]?.delta.content,
          finish_reason: chunk.choices[0]?.finish_reason,
        })
        yield chunk
      }

      logger.debug('Streaming request completed')
    } catch (error) {
      clearTimeout(timeoutId)

      if (error instanceof Error && error.name === 'AbortError') {
        logger.info('Streaming request cancelled')
        throw new Error('Request cancelled')
      }

      logger.error('Streaming request failed', error as Error)
      throw error
    }
  }

  /**
   * Build HTTP headers for request
   * Includes Content-Type and optional Authorization
   */
  private buildHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    }

    if (this.config.apiKey) {
      headers['Authorization'] = `Bearer ${this.config.apiKey}`
    }

    return headers
  }

  /**
   * Delay helper for retry backoff
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }
}
