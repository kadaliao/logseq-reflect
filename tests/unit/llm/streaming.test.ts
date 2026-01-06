/**
 * Unit tests for SSE streaming parser
 * T025: Write unit tests for streaming parser
 */

import { describe, it, expect } from 'vitest'
import {
  parseSSEStream,
  accumulateChunks,
  isStreamComplete,
} from '../../../src/llm/streaming'
import type { ChatCompletionChunk } from '../../../src/types'

describe('SSE Streaming Parser', () => {
  describe('parseSSEStream', () => {
    it('should parse valid SSE chunks', async () => {
      // Arrange
      const sseData = [
        'data: {"id":"1","object":"chat.completion.chunk","created":1234567890,"model":"llama3","choices":[{"index":0,"delta":{"role":"assistant","content":"Hello"},"finish_reason":null}]}\n\n',
        'data: {"id":"1","object":"chat.completion.chunk","created":1234567890,"model":"llama3","choices":[{"index":0,"delta":{"content":" world"},"finish_reason":"stop"}]}\n\n',
      ]

      const stream = new ReadableStream({
        start(controller) {
          sseData.forEach((chunk) => {
            controller.enqueue(new TextEncoder().encode(chunk))
          })
          controller.close()
        },
      })

      // Act
      const chunks: ChatCompletionChunk[] = []
      for await (const chunk of parseSSEStream(stream)) {
        chunks.push(chunk)
      }

      // Assert
      expect(chunks).toHaveLength(2)
      expect(chunks[0].choices[0].delta.content).toBe('Hello')
      expect(chunks[1].choices[0].delta.content).toBe(' world')
      expect(chunks[1].choices[0].finish_reason).toBe('stop')
    })

    it('should handle [DONE] marker', async () => {
      // Arrange
      const sseData = [
        'data: {"id":"1","object":"chat.completion.chunk","created":1234567890,"model":"llama3","choices":[{"index":0,"delta":{"content":"test"},"finish_reason":null}]}\n\n',
        'data: [DONE]\n\n',
      ]

      const stream = new ReadableStream({
        start(controller) {
          sseData.forEach((chunk) => {
            controller.enqueue(new TextEncoder().encode(chunk))
          })
          controller.close()
        },
      })

      // Act
      const chunks: ChatCompletionChunk[] = []
      for await (const chunk of parseSSEStream(stream)) {
        chunks.push(chunk)
      }

      // Assert
      expect(chunks).toHaveLength(1)
      expect(chunks[0].choices[0].delta.content).toBe('test')
    })

    it('should skip malformed JSON chunks', async () => {
      // Arrange
      const sseData = [
        'data: {"valid":"chunk1","id":"1","object":"chat.completion.chunk","created":1234567890,"model":"llama3","choices":[{"index":0,"delta":{"content":"a"},"finish_reason":null}]}\n\n',
        'data: invalid json\n\n',
        'data: {"valid":"chunk2","id":"1","object":"chat.completion.chunk","created":1234567890,"model":"llama3","choices":[{"index":0,"delta":{"content":"b"},"finish_reason":null}]}\n\n',
      ]

      const stream = new ReadableStream({
        start(controller) {
          sseData.forEach((chunk) => {
            controller.enqueue(new TextEncoder().encode(chunk))
          })
          controller.close()
        },
      })

      // Act
      const chunks: ChatCompletionChunk[] = []
      for await (const chunk of parseSSEStream(stream)) {
        chunks.push(chunk)
      }

      // Assert
      expect(chunks).toHaveLength(2)
      expect(chunks[0].choices[0].delta.content).toBe('a')
      expect(chunks[1].choices[0].delta.content).toBe('b')
    })

    it('should skip empty lines', async () => {
      // Arrange
      const sseData = [
        '\n',
        'data: {"id":"1","object":"chat.completion.chunk","created":1234567890,"model":"llama3","choices":[{"index":0,"delta":{"content":"test"},"finish_reason":null}]}\n\n',
        '\n',
        '\n',
      ]

      const stream = new ReadableStream({
        start(controller) {
          sseData.forEach((chunk) => {
            controller.enqueue(new TextEncoder().encode(chunk))
          })
          controller.close()
        },
      })

      // Act
      const chunks: ChatCompletionChunk[] = []
      for await (const chunk of parseSSEStream(stream)) {
        chunks.push(chunk)
      }

      // Assert
      expect(chunks).toHaveLength(1)
      expect(chunks[0].choices[0].delta.content).toBe('test')
    })

    it('should handle multi-byte UTF-8 characters', async () => {
      // Arrange
      const sseData = [
        'data: {"id":"1","object":"chat.completion.chunk","created":1234567890,"model":"llama3","choices":[{"index":0,"delta":{"content":"你好"},"finish_reason":null}]}\n\n',
        'data: {"id":"1","object":"chat.completion.chunk","created":1234567890,"model":"llama3","choices":[{"index":0,"delta":{"content":"世界"},"finish_reason":"stop"}]}\n\n',
      ]

      const stream = new ReadableStream({
        start(controller) {
          sseData.forEach((chunk) => {
            controller.enqueue(new TextEncoder().encode(chunk))
          })
          controller.close()
        },
      })

      // Act
      const chunks: ChatCompletionChunk[] = []
      for await (const chunk of parseSSEStream(stream)) {
        chunks.push(chunk)
      }

      // Assert
      expect(chunks).toHaveLength(2)
      expect(chunks[0].choices[0].delta.content).toBe('你好')
      expect(chunks[1].choices[0].delta.content).toBe('世界')
    })

    it('should handle chunked data across boundaries', async () => {
      // Arrange - Split a JSON object mid-stream
      const fullChunk =
        'data: {"id":"1","object":"chat.completion.chunk","created":1234567890,"model":"llama3","choices":[{"index":0,"delta":{"content":"test"},"finish_reason":null}]}\n\n'
      const part1 = fullChunk.slice(0, 50)
      const part2 = fullChunk.slice(50)

      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode(part1))
          controller.enqueue(new TextEncoder().encode(part2))
          controller.close()
        },
      })

      // Act
      const chunks: ChatCompletionChunk[] = []
      for await (const chunk of parseSSEStream(stream)) {
        chunks.push(chunk)
      }

      // Assert
      expect(chunks).toHaveLength(1)
      expect(chunks[0].choices[0].delta.content).toBe('test')
    })
  })

  describe('accumulateChunks', () => {
    it('should concatenate content from multiple chunks', () => {
      // Arrange
      const chunks: ChatCompletionChunk[] = [
        {
          id: '1',
          object: 'chat.completion.chunk',
          created: 1234567890,
          model: 'llama3',
          choices: [
            {
              index: 0,
              delta: { content: 'Hello' },
            },
          ],
        },
        {
          id: '1',
          object: 'chat.completion.chunk',
          created: 1234567890,
          model: 'llama3',
          choices: [
            {
              index: 0,
              delta: { content: ' ' },
            },
          ],
        },
        {
          id: '1',
          object: 'chat.completion.chunk',
          created: 1234567890,
          model: 'llama3',
          choices: [
            {
              index: 0,
              delta: { content: 'world!' },
            },
          ],
        },
      ]

      // Act
      const result = accumulateChunks(chunks)

      // Assert
      expect(result).toBe('Hello world!')
    })

    it('should handle chunks with no content', () => {
      // Arrange
      const chunks: ChatCompletionChunk[] = [
        {
          id: '1',
          object: 'chat.completion.chunk',
          created: 1234567890,
          model: 'llama3',
          choices: [
            {
              index: 0,
              delta: { content: 'Start' },
            },
          ],
        },
        {
          id: '1',
          object: 'chat.completion.chunk',
          created: 1234567890,
          model: 'llama3',
          choices: [
            {
              index: 0,
              delta: {},
            },
          ],
        },
        {
          id: '1',
          object: 'chat.completion.chunk',
          created: 1234567890,
          model: 'llama3',
          choices: [
            {
              index: 0,
              delta: { content: 'End' },
            },
          ],
        },
      ]

      // Act
      const result = accumulateChunks(chunks)

      // Assert
      expect(result).toBe('StartEnd')
    })

    it('should return empty string for empty chunk array', () => {
      // Arrange
      const chunks: ChatCompletionChunk[] = []

      // Act
      const result = accumulateChunks(chunks)

      // Assert
      expect(result).toBe('')
    })
  })

  describe('isStreamComplete', () => {
    it('should return true when finish_reason is "stop"', () => {
      // Arrange
      const chunk: ChatCompletionChunk = {
        id: '1',
        object: 'chat.completion.chunk',
        created: 1234567890,
        model: 'llama3',
        choices: [
          {
            index: 0,
            delta: { content: 'done' },
            finish_reason: 'stop',
          },
        ],
      }

      // Act
      const result = isStreamComplete(chunk)

      // Assert
      expect(result).toBe(true)
    })

    it('should return true when finish_reason is "length"', () => {
      // Arrange
      const chunk: ChatCompletionChunk = {
        id: '1',
        object: 'chat.completion.chunk',
        created: 1234567890,
        model: 'llama3',
        choices: [
          {
            index: 0,
            delta: { content: 'truncated' },
            finish_reason: 'length',
          },
        ],
      }

      // Act
      const result = isStreamComplete(chunk)

      // Assert
      expect(result).toBe(true)
    })

    it('should return false when finish_reason is null', () => {
      // Arrange
      const chunk: ChatCompletionChunk = {
        id: '1',
        object: 'chat.completion.chunk',
        created: 1234567890,
        model: 'llama3',
        choices: [
          {
            index: 0,
            delta: { content: 'ongoing' },
          },
        ],
      }

      // Act
      const result = isStreamComplete(chunk)

      // Assert
      expect(result).toBe(false)
    })
  })
})
