/**
 * Core type definitions for Logseq AI Plugin
 * Based on data-model.md specifications
 */

/**
 * Context strategy for extracting content for AI requests
 */
export type ContextStrategy = 'none' | 'page' | 'block' | 'selection'

/**
 * Menu context where commands can appear
 */
export type MenuContext = 'palette' | 'toolbar' | 'context-menu' | 'slash'

/**
 * Command execution status
 */
export type CommandStatus = 'pending' | 'streaming' | 'completed' | 'failed' | 'cancelled'

/**
 * AICommand interface - Represents an executable AI command
 * T010: Define AICommand interface
 */
export interface AICommand {
  /** Unique identifier (e.g., "ask-ai", "summarize-page", "custom-{uuid}") */
  id: string

  /** Display name shown in command palette and context menu */
  title: string

  /** Tooltip or help text explaining command purpose */
  description?: string

  /** Template for LLM prompt (may contain variables like {context}, {question}) */
  promptTemplate: string

  /** Whether command prompts user for question/input before execution */
  requiresInput: boolean

  /** Whether command requires selected block(s) to operate */
  requiresSelection: boolean

  /** How to extract context for LLM request */
  contextStrategy: ContextStrategy

  /** Specific model to use (overrides settings default) */
  modelOverride?: string | null

  /** Temperature parameter override (0.0-2.0) */
  temperatureOverride?: number | null

  /** Whether command is user-defined via ai-command-config */
  isCustom: boolean

  /** Where command appears in UI */
  menuContext: MenuContext[]
}

/**
 * ModelConfiguration interface - AI model endpoint settings
 * T011: Define ModelConfiguration interface
 */
export interface ModelConfiguration {
  /** LLM endpoint base URL (e.g., "http://localhost:11434") */
  baseURL: string

  /** Path appended to baseURL (e.g., "/v1/chat/completions") */
  apiPath: string

  /** Model identifier (e.g., "llama3", "gpt-4") */
  modelName: string

  /** Authentication key (if required by endpoint) */
  apiKey?: string | null

  /** Sampling temperature (0.0-2.0, default 0.7) */
  temperature: number

  /** Nucleus sampling parameter (0.0-1.0, default 0.9) */
  topP: number

  /** Maximum tokens in response (null = unlimited) */
  maxTokens?: number | null

  /** Whether to use streaming mode (default true) */
  streamingEnabled: boolean

  /** Request timeout in seconds (default 30) */
  timeoutSeconds: number

  /** Number of retries on failure (default 3) */
  retryCount: number

  /** Maximum context size in tokens (default 8000) */
  maxContextTokens: number
}

/**
 * RequestContext interface - Content scope for AI request
 * T012: Define RequestContext interface
 */
export interface RequestContext {
  /** Type of context extraction */
  type: ContextStrategy

  /** Extracted text content (may be truncated) */
  content: string

  /** UUIDs of source blocks/pages */
  sourceUUIDs: string[]

  /** Token count estimate (chars / 4) */
  estimatedTokens: number

  /** Whether content exceeded max context length */
  wasTruncated: boolean

  /** Additional context info (page title, block hierarchy, etc.) */
  metadata?: Record<string, unknown>
}

/**
 * ResponseHandler interface - Manages AI response lifecycle
 * T013: Define ResponseHandler interface
 */
export interface ResponseHandler {
  /** Unique identifier for this request */
  requestID: string

  /** UUID of placeholder block created */
  placeholderUUID: string

  /** Current execution status */
  status: CommandStatus

  /** Content accumulated during streaming */
  accumulatedContent: string

  /** User-facing error description if failed */
  errorMessage?: string | null

  /** Request start time for timeout tracking */
  startTime: number

  /** Token for cancelling in-flight request */
  cancelToken?: AbortSignal
}

/**
 * BlockPropertySet interface - Block-level property overrides
 * T014: Define BlockPropertySet interface
 */
export interface BlockPropertySet {
  /** UUID of the block these properties belong to */
  blockUUID: string

  /** Override model name (from ai-generate-model property) */
  model?: string | null

  /** Override temperature (from ai-generate-temperature) */
  temperature?: number | null

  /** Override top_p (from ai-generate-top_p) */
  topP?: number | null

  /** Whether to include context (from ai-generate-use_context) */
  useContext?: boolean | null

  /** Whether properties are inherited from ancestor blocks */
  isInherited: boolean
}

/**
 * CustomCommandDefinition interface - User-defined command spec
 * T015: Define CustomCommandDefinition interface
 */
export interface CustomCommandDefinition {
  /** UUID of config block */
  blockUUID: string

  /** Display title (from ai-context-menu-title property) */
  menuTitle: string

  /** Text prepended to user input (from ai-prompt-prefix) */
  promptPrefix?: string | null

  /** Text appended to user input (from ai-prompt-suffix) */
  promptSuffix?: string | null

  /** Specific model to use (from ai-model property) */
  modelOverride?: string | null

  /** Override context strategy (from ai-context property) */
  contextStrategy?: ContextStrategy | null
}

/**
 * ChatMessage - LLM chat message format
 */
export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

/**
 * ChatCompletionRequest - LLM request parameters
 */
export interface ChatCompletionRequest {
  model: string
  messages: ChatMessage[]
  temperature?: number
  top_p?: number
  max_tokens?: number | null
  stream?: boolean
  stop?: string | string[] | null
}

/**
 * ChatCompletionResponse - LLM non-streaming response
 */
export interface ChatCompletionResponse {
  id: string
  object: 'chat.completion'
  created: number
  model: string
  choices: Array<{
    index: number
    message: ChatMessage
    finish_reason: 'stop' | 'length' | 'content_filter' | null
  }>
  usage?: {
    prompt_tokens: number
    completion_tokens: number
    total_tokens: number
  }
}

/**
 * ChatCompletionChunk - LLM streaming response chunk
 */
export interface ChatCompletionChunk {
  id: string
  object: 'chat.completion.chunk'
  created: number
  model: string
  choices: Array<{
    index: number
    delta: {
      role?: 'assistant'
      content?: string
    }
    finish_reason?: 'stop' | 'length' | 'content_filter' | null
  }>
}
