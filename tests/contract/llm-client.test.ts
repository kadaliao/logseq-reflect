/**
 * Contract tests for LLM client
 * T020-T021: Write contract tests for LLM client chat() and stream() methods
 *
 * These tests verify the LLM client conforms to OpenAI-compatible API contract
 * IMPORTANT: These tests should FAIL until implementation is complete
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import type {
  ChatCompletionRequest,
  ChatCompletionResponse,
  ChatCompletionChunk,
  ModelConfiguration,
} from '../../src/types'

// Mock fetch for contract testing
global.fetch = vi.fn()

describe('LLM Client Contract Tests', () => {
  let mockConfig: ModelConfiguration

  beforeEach(() => {
    mockConfig = {
      baseURL: 'http://localhost:11434',
      apiPath: '/v1/chat/completions',
      modelName: 'llama3',
      apiKey: null,
      temperature: 0.7,
      topP: 0.9,
      maxTokens: null,
      streamingEnabled: true,
      timeoutSeconds: 30,
      retryCount: 3,
      maxContextTokens: 8000,
    }
    vi.clearAllMocks()
  })

  describe('T020: chat() method - Non-streaming requests', () => {
    it('should send correct request format to LLM endpoint', async () => {
      // Arrange
      const request: ChatCompletionRequest = {
        model: 'llama3',
        messages: [
          { role: 'system', content: 'You are a helpful assistant.' },
          { role: 'user', content: 'What is TypeScript?' },
        ],
        temperature: 0.7,
        top_p: 0.9,
        stream: false,
      }

      const mockResponse: ChatCompletionResponse = {
        id: 'chatcmpl-123',
        object: 'chat.completion',
        created: Date.now(),
        model: 'llama3',
        choices: [
          {
            index: 0,
            message: {
              role: 'assistant',
              content: 'TypeScript is a typed superset of JavaScript.',
            },
            finish_reason: 'stop',
          },
        ],
      }

      ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      })

      // Act
      const { LLMClient } = await import('../../src/llm/client')
      const client = new LLMClient(mockConfig)
      const response = await client.chat(request)

      // Assert
      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:11434/v1/chat/completions',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
          }),
          body: JSON.stringify(request),
        })
      )
      expect(response).toEqual(mockResponse)
    })

    it('should include API key in headers when provided', async () => {
      // Arrange
      const configWithKey: ModelConfiguration = {
        ...mockConfig,
        apiKey: 'sk-test-key-123',
      }

      const request: ChatCompletionRequest = {
        model: 'gpt-4',
        messages: [{ role: 'user', content: 'Hello' }],
        stream: false,
      }

      ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 'chatcmpl-123',
          object: 'chat.completion',
          created: Date.now(),
          model: 'gpt-4',
          choices: [
            {
              index: 0,
              message: { role: 'assistant', content: 'Hi!' },
              finish_reason: 'stop',
            },
          ],
        }),
      })

      // Act
      const { LLMClient } = await import('../../src/llm/client')
      const client = new LLMClient(configWithKey)
      await client.chat(request)

      // Assert
      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer sk-test-key-123',
          }),
        })
      )
    })

    it('should handle HTTP error responses', async () => {
      // Arrange
      const request: ChatCompletionRequest = {
        model: 'llama3',
        messages: [{ role: 'user', content: 'Hello' }],
        stream: false,
      }

      ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      })

      // Act & Assert
      const { LLMClient } = await import('../../src/llm/client')
      const client = new LLMClient(mockConfig)

      await expect(client.chat(request)).rejects.toThrow('HTTP 500: Internal Server Error')
    })

    it('should respect timeout configuration', async () => {
      // Arrange
      const shortTimeoutConfig: ModelConfiguration = {
        ...mockConfig,
        timeoutSeconds: 1,
      }

      const request: ChatCompletionRequest = {
        model: 'llama3',
        messages: [{ role: 'user', content: 'Hello' }],
        stream: false,
      }

      // Simulate slow response that respects AbortSignal
      ;(global.fetch as ReturnType<typeof vi.fn>).mockImplementationOnce(
        (_url: string, options: { signal?: AbortSignal }) =>
          new Promise((resolve, reject) => {
            const timeoutId = setTimeout(
              () =>
                resolve({
                  ok: true,
                  json: async () => ({}),
                }),
              2000
            )

            // Respect abort signal
            if (options.signal) {
              options.signal.addEventListener('abort', () => {
                clearTimeout(timeoutId)
                const abortError = new Error('The operation was aborted.')
                abortError.name = 'AbortError'
                reject(abortError)
              })
            }
          })
      )

      // Act & Assert
      const { LLMClient } = await import('../../src/llm/client')
      const client = new LLMClient(shortTimeoutConfig)

      await expect(client.chat(request)).rejects.toThrow(/timeout/i)
    })

    it('should retry on network failures', async () => {
      // Arrange
      const retryConfig: ModelConfiguration = {
        ...mockConfig,
        retryCount: 3,
      }

      const request: ChatCompletionRequest = {
        model: 'llama3',
        messages: [{ role: 'user', content: 'Hello' }],
        stream: false,
      }

      const mockResponse: ChatCompletionResponse = {
        id: 'chatcmpl-123',
        object: 'chat.completion',
        created: Date.now(),
        model: 'llama3',
        choices: [
          {
            index: 0,
            message: { role: 'assistant', content: 'Success after retry' },
            finish_reason: 'stop',
          },
        ],
      }

      // Fail twice, succeed on third attempt
      ;(global.fetch as ReturnType<typeof vi.fn>)
        .mockRejectedValueOnce(new Error('Network error'))
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockResponse,
        })

      // Act
      const { LLMClient } = await import('../../src/llm/client')
      const client = new LLMClient(retryConfig)
      const response = await client.chat(request)

      // Assert
      expect(global.fetch).toHaveBeenCalledTimes(3)
      expect(response).toEqual(mockResponse)
    })
  })

  describe('T021: stream() method - Streaming requests', () => {
    it('should handle Server-Sent Events streaming', async () => {
      // Arrange
      const request: ChatCompletionRequest = {
        model: 'llama3',
        messages: [{ role: 'user', content: 'Count to 3' }],
        stream: true,
      }

      // Mock SSE response chunks
      const chunks = [
        'data: {"id":"chatcmpl-123","object":"chat.completion.chunk","created":1234567890,"model":"llama3","choices":[{"index":0,"delta":{"role":"assistant","content":"1"},"finish_reason":null}]}\n\n',
        'data: {"id":"chatcmpl-123","object":"chat.completion.chunk","created":1234567890,"model":"llama3","choices":[{"index":0,"delta":{"content":" 2"},"finish_reason":null}]}\n\n',
        'data: {"id":"chatcmpl-123","object":"chat.completion.chunk","created":1234567890,"model":"llama3","choices":[{"index":0,"delta":{"content":" 3"},"finish_reason":"stop"}]}\n\n',
        'data: [DONE]\n\n',
      ]

      const mockReadableStream = new ReadableStream({
        start(controller) {
          chunks.forEach((chunk) => {
            controller.enqueue(new TextEncoder().encode(chunk))
          })
          controller.close()
        },
      })

      ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        body: mockReadableStream,
      })

      // Act
      const { LLMClient } = await import('../../src/llm/client')
      const client = new LLMClient(mockConfig)
      const stream = client.stream(request)

      const receivedChunks: ChatCompletionChunk[] = []
      for await (const chunk of stream) {
        receivedChunks.push(chunk)
      }

      // Assert
      expect(receivedChunks).toHaveLength(3)
      expect(receivedChunks[0].choices[0].delta.content).toBe('1')
      expect(receivedChunks[1].choices[0].delta.content).toBe(' 2')
      expect(receivedChunks[2].choices[0].delta.content).toBe(' 3')
      expect(receivedChunks[2].choices[0].finish_reason).toBe('stop')
    })

    it('should support cancellation via AbortSignal', async () => {
      // Arrange
      const request: ChatCompletionRequest = {
        model: 'llama3',
        messages: [{ role: 'user', content: 'Long response' }],
        stream: true,
      }

      const abortController = new AbortController()

      const mockReadableStream = new ReadableStream({
        start(controller) {
          // Simulate long stream
          const interval = setInterval(() => {
            controller.enqueue(
              new TextEncoder().encode(
                'data: {"id":"chatcmpl-123","object":"chat.completion.chunk","created":1234567890,"model":"llama3","choices":[{"index":0,"delta":{"content":"word "},"finish_reason":null}]}\n\n'
              )
            )
          }, 100)

          // Cleanup on abort
          abortController.signal.addEventListener('abort', () => {
            clearInterval(interval)
            controller.close()
          })
        },
      })

      ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        body: mockReadableStream,
      })

      // Act
      const { LLMClient } = await import('../../src/llm/client')
      const client = new LLMClient(mockConfig)
      const stream = client.stream(request, abortController.signal)

      const receivedChunks: ChatCompletionChunk[] = []
      let chunkCount = 0

      try {
        for await (const chunk of stream) {
          receivedChunks.push(chunk)
          chunkCount++

          // Cancel after 2 chunks
          if (chunkCount === 2) {
            abortController.abort()
          }
        }
      } catch (error) {
        // Abortion is expected
        expect(error).toBeDefined()
      }

      // Assert
      expect(receivedChunks.length).toBeLessThanOrEqual(2)
    })

    it('should handle malformed SSE data gracefully', async () => {
      // Arrange
      const request: ChatCompletionRequest = {
        model: 'llama3',
        messages: [{ role: 'user', content: 'Test' }],
        stream: true,
      }

      const chunks = [
        'data: {"valid":"chunk"}\n\n',
        'data: invalid json\n\n', // Malformed
        'data: {"id":"chatcmpl-123","object":"chat.completion.chunk","created":1234567890,"model":"llama3","choices":[{"index":0,"delta":{"content":"ok"},"finish_reason":"stop"}]}\n\n',
        'data: [DONE]\n\n',
      ]

      const mockReadableStream = new ReadableStream({
        start(controller) {
          chunks.forEach((chunk) => {
            controller.enqueue(new TextEncoder().encode(chunk))
          })
          controller.close()
        },
      })

      ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        body: mockReadableStream,
      })

      // Act
      const { LLMClient } = await import('../../src/llm/client')
      const client = new LLMClient(mockConfig)
      const stream = client.stream(request)

      const receivedChunks: ChatCompletionChunk[] = []
      for await (const chunk of stream) {
        receivedChunks.push(chunk)
      }

      // Assert
      // Should skip malformed chunk and continue
      expect(receivedChunks.length).toBeGreaterThan(0)
      expect(receivedChunks[receivedChunks.length - 1].choices[0].delta.content).toBe('ok')
    })
  })
})
