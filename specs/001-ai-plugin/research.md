# Research: Logseq AI Plugin

**Feature**: 001-ai-plugin
**Date**: 2026-01-05
**Purpose**: Document technology choices, best practices, and implementation patterns for Logseq plugin development

## Overview

This document consolidates research findings for building a production-grade Logseq plugin with AI integration capabilities. Research covers Logseq plugin SDK patterns, TypeScript/React best practices, LLM client design, streaming response handling, and testing strategies.

## 1. Logseq Plugin Development Best Practices

### Decision: Use @logseq/libs SDK with TypeScript

**Rationale**:
- Official Logseq plugin SDK provides type-safe APIs for all plugin capabilities
- TypeScript enables strict type checking, essential for constitution compliance
- Strong community support and extensive documentation
- Hot module reloading support via Vite for rapid development

**Alternatives Considered**:
- JavaScript without types: Rejected due to constitution requirement for type safety
- Custom plugin loader: Rejected due to unnecessary complexity and lack of official support

**Key Patterns**:
- Plugin lifecycle: `logseq.ready()` for initialization, `logseq.beforeunload()` for cleanup
- Command registration: `logseq.App.registerUIItem()` for toolbar, `logseq.Editor.registerSlashCommand()` for slash commands
- Settings persistence: `logseq.updateSettings()` and `logseq.settings` for configuration
- Block operations: `logseq.Editor.insertBlock()`, `logseq.Editor.updateBlock()` for content manipulation

**References**:
- Official Logseq Plugin SDK: https://github.com/logseq/logseq-plugin-sdk
- Plugin samples: https://github.com/logseq/logseq-plugin-samples

## 2. React UI Component Architecture

### Decision: React 18 with Functional Components and Hooks

**Rationale**:
- Logseq environment supports React rendering via `provideUI()` API
- Hooks enable clean state management without class boilerplate
- Concurrent features (Suspense, Transitions) support streaming UI updates
- Ecosystem compatibility with testing tools (Vitest, Testing Library)

**Alternatives Considered**:
- Vue.js: Rejected due to Logseq's React-first ecosystem
- Vanilla JavaScript: Rejected due to increased complexity for stateful UI
- Preact: Rejected to avoid compatibility issues with Logseq's React integration

**Key Patterns**:
- Command Palette: Modal dialog with keyboard event handlers and filtered command list
- Error Boundaries: Catch component errors without crashing entire plugin
- Portal rendering: Use `logseq.provideUI()` to mount React components in Logseq DOM
- Theme integration: Access Logseq CSS variables via `getComputedStyle(document.documentElement)`

**Component Structure**:
```
ui/
├── CommandPalette.tsx     # Main modal, keyboard nav, command filtering
├── PromptInput.tsx        # Controlled input with debouncing
├── ErrorDisplay.tsx       # Error boundary + message display
└── SettingsPanel.tsx      # Form with validation, settings persistence
```

**References**:
- React 18 docs: https://react.dev
- Logseq UI integration examples: https://github.com/logseq/logseq-plugin-samples/tree/master/logseq-samples

## 3. LLM Client Design Pattern

### Decision: Adapter Pattern with OpenAI-Compatible Interface

**Rationale**:
- Most self-hosted models (Ollama, llama.cpp, vLLM) implement OpenAI-compatible APIs
- Adapter pattern allows future extension to Anthropic, Google, etc. without breaking changes
- Streaming API (Server-Sent Events) is standardized across OpenAI-compatible endpoints
- Configuration via base URL enables easy switching between providers

**Alternatives Considered**:
- Provider-specific clients: Rejected due to tight coupling and extensibility limitations
- LangChain integration: Rejected due to bundle size overhead (violates 500KB limit)
- Direct fetch calls in command handlers: Rejected due to code duplication and testability issues

**Client Architecture**:
```typescript
// Core abstraction
interface LLMClient {
  chat(params: ChatParams): Promise<ChatResponse>
  stream(params: ChatParams): AsyncIterable<ChatChunk>
}

// OpenAI-compatible implementation
class OpenAIClient implements LLMClient {
  constructor(config: { baseURL: string, model: string, apiKey?: string })

  async chat(params: ChatParams): Promise<ChatResponse> {
    // POST to {baseURL}/v1/chat/completions
  }

  async *stream(params: ChatParams): AsyncIterable<ChatChunk> {
    // SSE stream from {baseURL}/v1/chat/completions with stream=true
  }
}
```

**Error Handling Strategy**:
- Network errors: Retry with exponential backoff (max 3 attempts)
- Timeout errors: User-configurable timeout (default 30s)
- Malformed responses: Graceful degradation with partial content display
- Rate limits: Display clear message with retry suggestion

**References**:
- OpenAI API spec: https://platform.openai.com/docs/api-reference
- Ollama compatibility: https://github.com/ollama/ollama/blob/main/docs/api.md

## 4. Streaming Response Handling

### Decision: Server-Sent Events (SSE) with Incremental Block Updates

**Rationale**:
- SSE is standard for LLM streaming (OpenAI, Ollama, Claude all support it)
- Browser EventSource API or fetch with ReadableStream provides native support
- Incremental `updateBlock()` calls enable real-time user feedback
- Constitution requirement: streaming must not block main thread

**Alternatives Considered**:
- WebSockets: Rejected due to unnecessary complexity for unidirectional streaming
- Polling: Rejected due to latency and inefficiency
- Buffer full response: Rejected due to poor UX for slow models

**Implementation Pattern**:
```typescript
async function* parseSSEStream(response: Response): AsyncIterable<ChatChunk> {
  const reader = response.body.getReader()
  const decoder = new TextDecoder()

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    const chunk = decoder.decode(value)
    for (const line of chunk.split('\n\n')) {
      if (line.startsWith('data: ')) {
        const data = JSON.parse(line.slice(6))
        yield data.choices[0].delta.content
      }
    }
  }
}
```

**Block Update Strategy**:
- Batch updates every 50ms to avoid excessive DOM manipulation
- Use `requestIdleCallback()` to defer updates during user interaction
- Cancel stream on user navigation (detect via `logseq.App.onRouteChanged()`)

**References**:
- MDN ReadableStream: https://developer.mozilla.org/en-US/docs/Web/API/ReadableStream
- OpenAI streaming docs: https://platform.openai.com/docs/api-reference/streaming

## 5. Context Extraction and Token Management

### Decision: Hierarchical Extraction with Heuristic Token Estimation

**Rationale**:
- Logseq blocks form natural hierarchy that preserves semantic structure
- Token estimation (chars / 4) is fast and accurate enough for truncation decisions
- Truncation strategy: preserve beginning (context) and end (recent info), drop middle
- Constitution requirement: <500ms processing for 10k+ token pages

**Alternatives Considered**:
- Full tokenization with tiktoken: Rejected due to bundle size and WASM complexity
- Character-based truncation: Rejected due to inaccuracy (1 char ≠ 1 token)
- Summarization pre-processing: Rejected due to latency and recursive LLM calls

**Extraction Algorithm**:
```typescript
function extractPageContext(pageUUID: string, maxTokens: number): string {
  const blocks = logseq.Editor.getPageBlocksTree(pageUUID)
  const content = flattenBlocks(blocks, { preserveIndent: true, filterProperties: true })

  const estimatedTokens = content.length / 4
  if (estimatedTokens <= maxTokens) return content

  // Smart truncation: keep first 40%, last 40%, indicate omission
  const keepChars = maxTokens * 4
  const firstPart = content.slice(0, keepChars * 0.4)
  const lastPart = content.slice(-keepChars * 0.4)
  return `${firstPart}\n\n[... ${estimatedTokens - maxTokens} tokens omitted ...]\n\n${lastPart}`
}
```

**Property Filtering**:
- Remove lines matching pattern `^[a-z-]+::` (block properties)
- Preserve user content and hierarchy
- Inherited properties resolved at runtime, not included in context

**References**:
- OpenAI tokenization guide: https://platform.openai.com/docs/guides/tokens
- Logseq block structure: https://docs.logseq.com/#/page/block

## 6. Block Property Inheritance

### Decision: Ancestor Traversal with Memoization

**Rationale**:
- Logseq blocks form tree structure, properties naturally inherit down hierarchy
- Traverse from current block to page root, first non-null value wins
- Memoization prevents redundant traversals for sibling blocks
- Supports constitution requirement for per-context model overrides

**Alternatives Considered**:
- Flat property storage: Rejected due to update complexity and inconsistency risk
- Cache all properties on load: Rejected due to memory overhead for large graphs
- No inheritance: Rejected due to poor UX (user must repeat properties)

**Implementation Pattern**:
```typescript
const propertyCache = new Map<string, Record<string, any>>()

function getInheritedProperty(blockUUID: string, propName: string): any {
  const cacheKey = `${blockUUID}:${propName}`
  if (propertyCache.has(cacheKey)) return propertyCache.get(cacheKey)

  let current = logseq.Editor.getBlock(blockUUID)
  while (current) {
    const value = current.properties?.[propName]
    if (value !== undefined) {
      propertyCache.set(cacheKey, value)
      return value
    }
    current = current.parent ? logseq.Editor.getBlock(current.parent.id) : null
  }

  return null // No inherited value found
}
```

**Property Validation**:
- `ai-generate-model`: String, no validation (trust user input)
- `ai-generate-temperature`: Float, range [0.0, 2.0]
- `ai-generate-top_p`: Float, range [0.0, 1.0]
- Invalid values: Log warning, fall back to settings default

## 7. Custom Command Configuration

### Decision: Convention-Based Page Scanning

**Rationale**:
- Logseq users familiar with special pages (TODO, NOW, queries)
- Page name `ai-command-config` is self-documenting
- Block properties provide structured configuration
- Plugin reload or manual refresh trigger rescanning

**Alternatives Considered**:
- JSON config file: Rejected due to poor Logseq integration
- Settings panel form: Rejected due to complexity and limited flexibility
- Graph-wide search: Rejected due to performance concerns

**Scanning Algorithm**:
```typescript
async function loadCustomCommands(): Promise<CustomCommand[]> {
  const configPage = await logseq.Editor.getPage('ai-command-config')
  if (!configPage) return []

  const blocks = await logseq.Editor.getPageBlocksTree(configPage.uuid)
  const commands: CustomCommand[] = []

  for (const block of blocks) {
    const title = block.properties?.['ai-context-menu-title']
    if (!title) continue

    commands.push({
      id: `custom-${block.uuid}`,
      title,
      promptPrefix: block.properties?.['ai-prompt-prefix'] || '',
      promptSuffix: block.properties?.['ai-prompt-suffix'] || '',
      model: block.properties?.['ai-model']
    })
  }

  return commands
}
```

**Registration Flow**:
1. Plugin loads → scan `ai-command-config` page
2. Register custom commands in command palette and context menu
3. User creates/updates config blocks → manual refresh or plugin reload
4. Commands dynamically update without code changes

## 8. Testing Strategy

### Decision: Vitest + Playwright with Contract Testing

**Rationale**:
- Vitest: Fast, TypeScript-native, Vite-integrated (aligns with build tool)
- Playwright: Headless Electron testing for Logseq integration
- Contract testing: Validate LLM API assumptions without live calls
- Constitution requirement: 80% coverage, fast tests (<100ms unit, <1s integration)

**Alternatives Considered**:
- Jest: Rejected due to slower TypeScript support and configuration complexity
- Cypress: Rejected due to Electron compatibility issues
- Manual testing only: Rejected due to constitution TDD requirement

**Test Organization**:
```
tests/
├── unit/
│   ├── commands/*.test.ts      # Command handler logic (mocked LLM client)
│   ├── llm/*.test.ts            # LLM client (mocked fetch)
│   ├── context/*.test.ts        # Context extraction (mocked Logseq API)
│   └── config/*.test.ts         # Property parsing and validation
├── integration/
│   ├── logseq-api.test.ts      # Real Logseq API in test environment
│   └── e2e.test.ts             # Full workflow from command to block update
└── contract/
    └── llm-client.test.ts      # Validate request/response schemas
```

**Mocking Strategy**:
- Mock `@logseq/libs` for unit tests using Vitest mocks
- Mock LLM endpoints for contract tests using MSW (Mock Service Worker)
- Use real Logseq instance for Playwright integration tests

**References**:
- Vitest docs: https://vitest.dev
- Playwright docs: https://playwright.dev

## 9. Build and Bundle Optimization

### Decision: Vite with Code Splitting and Tree Shaking

**Rationale**:
- Vite native TypeScript support, fast HMR for development
- Rollup-based production builds enable tree shaking
- Code splitting: Separate UI components from core logic
- Constitution requirement: <500KB bundle size

**Alternatives Considered**:
- Webpack: Rejected due to slower build times and complex configuration
- esbuild alone: Rejected due to limited plugin ecosystem for Logseq integration
- Parcel: Rejected due to less mature TypeScript support

**Optimization Techniques**:
- Dynamic imports for UI components (`const CommandPalette = lazy(() => import('./ui/CommandPalette'))`)
- Externalize React if Logseq provides it (check plugin SDK docs)
- Minification: Terser with compression
- Source maps: External for production debugging

**Bundle Size Monitoring**:
```json
// vite.config.ts
{
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'ui': ['./src/ui/CommandPalette.tsx', './src/ui/SettingsPanel.tsx'],
          'llm': ['./src/llm/client.ts', './src/llm/streaming.ts']
        }
      }
    }
  },
  plugins: [
    visualizer({ filename: 'dist/stats.html' }) // Bundle analysis
  ]
}
```

**References**:
- Vite docs: https://vitejs.dev
- Rollup tree-shaking: https://rollupjs.org/guide/en/#tree-shaking

## 10. Error Handling and Logging

### Decision: Structured Logging with Debug Mode

**Rationale**:
- Constitution requirement: actionable error messages for users
- Debug mode enables detailed logging without performance penalty
- Structured logs (JSON) support future telemetry integration
- Console logging sufficient for plugin context (no server-side aggregation)

**Log Levels**:
- `ERROR`: User-facing errors (network failures, LLM errors)
- `WARN`: Non-critical issues (property validation failures, deprecated API usage)
- `INFO`: Significant events (command execution, settings updates)
- `DEBUG`: Detailed trace (context extraction, token counts, API requests)

**Implementation Pattern**:
```typescript
class Logger {
  constructor(private context: string, private debugMode: boolean) {}

  error(message: string, error?: Error, metadata?: Record<string, any>) {
    console.error(`[${this.context}] ${message}`, { error, ...metadata })
    logseq.App.showMsg(message, 'error') // User notification
  }

  debug(message: string, metadata?: Record<string, any>) {
    if (this.debugMode) {
      console.debug(`[${this.context}] ${message}`, metadata)
    }
  }
}
```

**User-Facing Error Messages**:
- Network failure: "Could not connect to AI model. Check your network connection and model endpoint in settings."
- Timeout: "AI request timed out. Try a shorter prompt or increase timeout in settings."
- Invalid response: "Received unexpected response from AI model. This may indicate a configuration issue."

## Summary

All technical decisions documented. Key takeaways:

- **Stack**: TypeScript 5.x + React 18 + Vite 5.x + Vitest + Logseq SDK
- **Architecture**: Modular separation (commands, LLM, context, UI, config)
- **LLM Integration**: OpenAI-compatible adapter with SSE streaming
- **Performance**: Code splitting, lazy loading, batched updates, token estimation
- **Testing**: Unit (Vitest) + Integration (Playwright) + Contract (MSW)
- **Quality**: ESLint + Prettier + strict TypeScript + 80% coverage target

All constitution principles satisfied. Ready for Phase 1 design.
