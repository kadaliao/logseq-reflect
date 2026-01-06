# Data Model: Logseq AI Plugin

**Feature**: 001-ai-plugin
**Date**: 2026-01-05
**Purpose**: Define core entities, their attributes, relationships, and state transitions

## Overview

This document describes the data structures that power the Logseq AI Plugin. All entities are designed for client-side operation within the Logseq environment with no external database dependencies.

## Core Entities

### 1. AICommand

Represents an executable AI command (built-in or custom) with associated configuration and UI metadata.

**Attributes**:
- `id` (string, required): Unique identifier (e.g., "ask-ai", "summarize-page", "custom-{uuid}")
- `title` (string, required): Display name shown in command palette and context menu
- `description` (string, optional): Tooltip or help text explaining command purpose
- `promptTemplate` (string, required): Template for LLM prompt (may contain variables like `{context}`, `{question}`)
- `requiresInput` (boolean, required): Whether command prompts user for question/input before execution
- `requiresSelection` (boolean, required): Whether command requires selected block(s) to operate
- `contextStrategy` (enum, required): `"none" | "page" | "block" | "selection"` - how to extract context
- `modelOverride` (string, optional): Specific model to use (overrides settings default)
- `temperatureOverride` (number, optional): Temperature parameter override (0.0-2.0)
- `isCustom` (boolean, required): Whether command is user-defined via `ai-command-config`
- `menuContext` (array of enum, required): Where command appears: `["palette", "toolbar", "context-menu", "slash"]`

**Relationships**:
- Created by: `CustomCommandLoader` (for custom commands) or `CommandRegistry` (for built-in)
- Executed by: `CommandHandler` which coordinates LLM client, context extraction, and response insertion

**Validation Rules**:
- `id` must be unique across all registered commands
- `promptTemplate` must not be empty
- `temperatureOverride` if present must be in range [0.0, 2.0]
- Custom commands must have `id` starting with "custom-"

**State Transitions**:
```
UNREGISTERED → REGISTERED (via CommandRegistry.register())
REGISTERED → EXECUTING (user invokes command)
EXECUTING → COMPLETED (successful response inserted)
EXECUTING → FAILED (error occurred, user notified)
REGISTERED → UNREGISTERED (plugin unload or command removed)
```

**Example**:
```typescript
{
  id: "ask-with-page-context",
  title: "Ask with Page Context",
  description: "Ask AI a question with current page content as context",
  promptTemplate: "Context:\n{context}\n\nQuestion: {question}",
  requiresInput: true,
  requiresSelection: false,
  contextStrategy: "page",
  modelOverride: null,
  temperatureOverride: null,
  isCustom: false,
  menuContext: ["palette", "slash"]
}
```

---

### 2. ModelConfiguration

Represents AI model endpoint settings and request parameters.

**Attributes**:
- `baseURL` (string, required): LLM endpoint base URL (e.g., "http://localhost:11434")
- `apiPath` (string, required): Path appended to baseURL (e.g., "/v1/chat/completions")
- `modelName` (string, required): Model identifier (e.g., "llama3", "gpt-4")
- `apiKey` (string, optional): Authentication key (if required by endpoint)
- `temperature` (number, required): Sampling temperature (0.0-2.0, default 0.7)
- `topP` (number, required): Nucleus sampling parameter (0.0-1.0, default 0.9)
- `maxTokens` (number, optional): Maximum tokens in response (null = unlimited)
- `streamingEnabled` (boolean, required): Whether to use streaming mode (default true)
- `timeoutSeconds` (number, required): Request timeout (default 30)
- `retryCount` (number, required): Number of retries on failure (default 3)
- `maxContextTokens` (number, required): Maximum context size (default 8000)

**Relationships**:
- Persisted by: `SettingsManager` using Logseq storage API
- Loaded by: `LLMClient` during initialization
- Overridden by: `BlockPropertySet` or `AICommand.modelOverride` at request time

**Validation Rules**:
- `baseURL` must be valid HTTP(S) URL
- `temperature` must be in range [0.0, 2.0]
- `topP` must be in range [0.0, 1.0]
- `timeoutSeconds` must be positive integer
- `retryCount` must be non-negative integer
- `maxContextTokens` must be positive integer

**Default Values**:
```typescript
{
  baseURL: "http://localhost:11434",
  apiPath: "/v1/chat/completions",
  modelName: "llama3",
  apiKey: null,
  temperature: 0.7,
  topP: 0.9,
  maxTokens: null,
  streamingEnabled: true,
  timeoutSeconds: 30,
  retryCount: 3,
  maxContextTokens: 8000
}
```

---

### 3. BlockPropertySet

Collection of `ai-generate-*` properties attached to a Logseq block, determining model behavior for that block's scope.

**Attributes**:
- `blockUUID` (string, required): UUID of the block these properties belong to
- `model` (string, optional): Override model name (from `ai-generate-model` property)
- `temperature` (number, optional): Override temperature (from `ai-generate-temperature`)
- `topP` (number, optional): Override top_p (from `ai-generate-top_p`)
- `useContext` (boolean, optional): Whether to include context (from `ai-generate-use_context`)
- `isInherited` (boolean, required): Whether properties are inherited from ancestor blocks

**Relationships**:
- Extracted by: `PropertyParser` from block properties
- Inherited from: Parent `BlockPropertySet` if current block has no explicit properties
- Used by: `LLMClient` to build request parameters

**Validation Rules**:
- `temperature` if present must be in range [0.0, 2.0], else log warning
- `topP` if present must be in range [0.0, 1.0], else log warning
- Invalid values fall back to `ModelConfiguration` defaults

**Inheritance Resolution**:
```typescript
function resolveProperties(blockUUID: string): BlockPropertySet {
  // Traverse from block to page root
  // First non-null value for each property wins
  // Return merged set with isInherited flags
}
```

**Example**:
```typescript
// Block has: ai-generate-model:: qwen2
// Parent has: ai-generate-temperature:: 0.8
// Result:
{
  blockUUID: "block-123",
  model: "qwen2",        // from block
  temperature: 0.8,      // inherited from parent
  topP: null,            // uses ModelConfiguration default
  useContext: null,      // uses command default
  isInherited: true
}
```

---

### 4. CustomCommandDefinition

User-defined command specification stored as block properties on the `ai-command-config` page.

**Attributes**:
- `blockUUID` (string, required): UUID of config block
- `menuTitle` (string, required): Display title (from `ai-context-menu-title` property)
- `promptPrefix` (string, optional): Text prepended to user input (from `ai-prompt-prefix`)
- `promptSuffix` (string, optional): Text appended to user input (from `ai-prompt-suffix`)
- `modelOverride` (string, optional): Specific model to use (from `ai-model` property)
- `contextStrategy` (enum, optional): Override context strategy (from `ai-context` property)

**Relationships**:
- Scanned by: `CustomCommandLoader` on plugin initialization
- Converted to: `AICommand` instances for registration
- Updated: On page edit + manual plugin refresh or reload

**Validation Rules**:
- `menuTitle` must not be empty
- `menuTitle` must not collide with built-in command titles
- `modelOverride` is trusted (no validation, user responsibility)

**Mapping to AICommand**:
```typescript
function toAICommand(def: CustomCommandDefinition): AICommand {
  return {
    id: `custom-${def.blockUUID}`,
    title: def.menuTitle,
    description: "Custom command",
    promptTemplate: `${def.promptPrefix}\n{content}\n${def.promptSuffix}`,
    requiresInput: !def.promptPrefix,  // If no prefix, prompt user
    requiresSelection: true,
    contextStrategy: def.contextStrategy || "selection",
    modelOverride: def.modelOverride,
    temperatureOverride: null,
    isCustom: true,
    menuContext: ["context-menu", "palette"]
  }
}
```

**Example Config Block**:
```markdown
- Custom Translation Command
  ai-context-menu-title:: Translate to English
  ai-prompt-prefix:: Translate the following text to English:
  ai-model:: gpt-4
```

---

### 5. RequestContext

Content scope for an AI request, either page-level or block-level.

**Attributes**:
- `type` (enum, required): `"page" | "block" | "selection" | "none"`
- `content` (string, required): Extracted text content (may be truncated)
- `sourceUUIDs` (array of string, required): UUIDs of source blocks/pages
- `estimatedTokens` (number, required): Token count estimate (chars / 4)
- `wasTruncated` (boolean, required): Whether content exceeded max context length
- `metadata` (object, optional): Additional context info (page title, block hierarchy, etc.)

**Relationships**:
- Extracted by: `ContextExtractor` using `contextStrategy` from `AICommand`
- Truncated by: `ContextTruncator` if `estimatedTokens > ModelConfiguration.maxContextTokens`
- Passed to: `LLMClient` as part of request parameters

**Extraction Strategies**:
- **page**: All blocks on current page, hierarchical, properties filtered
- **block**: Selected block + all descendants, preserving indentation
- **selection**: Only explicitly selected blocks (multi-select support)
- **none**: Empty context (for standalone questions)

**Truncation Algorithm**:
```
IF estimatedTokens <= maxContextTokens:
  RETURN content unchanged

ELSE:
  keepTokens = maxContextTokens
  firstPart = content[0 : keepTokens * 0.4]
  lastPart = content[-keepTokens * 0.4 : end]
  RETURN firstPart + "\n\n[... omitted ...]\n\n" + lastPart
```

**Example**:
```typescript
{
  type: "page",
  content: "# Project Alpha\n- Goal 1\n  - Subtask A\n- Goal 2\n...",
  sourceUUIDs: ["page-uuid-123"],
  estimatedTokens: 2500,
  wasTruncated: false,
  metadata: {
    pageTitle: "Project Alpha",
    blockCount: 42
  }
}
```

---

### 6. ResponseHandler

Manages AI response lifecycle including placeholder creation, streaming updates, error handling, and final content insertion.

**Attributes**:
- `requestID` (string, required): Unique identifier for this request (UUID)
- `placeholderUUID` (string, required): UUID of placeholder block created
- `status` (enum, required): `"pending" | "streaming" | "completed" | "failed" | "cancelled"`
- `accumulatedContent` (string, required): Content accumulated during streaming
- `errorMessage` (string, optional): User-facing error description if failed
- `startTime` (timestamp, required): Request start time for timeout tracking
- `cancelToken` (AbortSignal, optional): Token for cancelling in-flight request

**Relationships**:
- Created by: `CommandHandler` when executing command
- Updated by: `StreamingHandler` as tokens arrive
- Cleaned up: On completion, failure, or cancellation

**State Transitions**:
```
PENDING → STREAMING (first token arrives)
STREAMING → COMPLETED (stream ends successfully)
STREAMING → FAILED (error occurs)
STREAMING → CANCELLED (user cancels or navigates away)
PENDING → FAILED (error before streaming starts)
```

**Lifecycle Methods**:
```typescript
class ResponseHandler {
  async createPlaceholder(targetBlockUUID: string): Promise<string> {
    // Insert block with loading indicator below target
    // Return placeholder UUID
  }

  async updateStreaming(chunk: string): Promise<void> {
    // Append chunk to accumulatedContent
    // Batch update placeholder block (max 50ms intervals)
  }

  async complete(): Promise<void> {
    // Final update to placeholder with complete content
    // Remove loading indicator
    // Mark status = "completed"
  }

  async fail(error: Error): Promise<void> {
    // Update placeholder with error message
    // Log to console
    // Show user notification
    // Mark status = "failed"
  }

  async cancel(): Promise<void> {
    // Abort fetch request via cancelToken
    // Remove placeholder block
    // Mark status = "cancelled"
  }
}
```

**Example**:
```typescript
{
  requestID: "req-uuid-456",
  placeholderUUID: "block-uuid-789",
  status: "streaming",
  accumulatedContent: "Based on the context provided, the main goals are...",
  errorMessage: null,
  startTime: 1704470400000,
  cancelToken: abortController.signal
}
```

---

## Entity Relationships Diagram

```
┌─────────────────┐
│ AICommand       │
│ - id            │
│ - title         │◄─────┐
│ - promptTemplate│      │
└────────┬────────┘      │
         │               │
         │ executes      │ defines
         │               │
         ▼               │
┌─────────────────┐      │
│ CommandHandler  │      │
│ - executeCmd()  │      │
└────────┬────────┘      │
         │               │
         │ uses          │
         ▼               │
┌─────────────────┐      │
│ LLMClient       │      │
│ - chat()        │──────┤ configured by
│ - stream()      │      │
└────────┬────────┘      │
         │               │
         │ sends request │
         ▼               │
┌─────────────────┐      │
│ ResponseHandler │      │
│ - createPlaceh..│      │
│ - updateStream..│      │
└─────────────────┘      │
                         │
┌─────────────────┐      │
│ ModelConfig     │──────┘
│ - baseURL       │
│ - modelName     │
└────────┬────────┘
         │
         │ overridden by
         │
         ▼
┌─────────────────┐
│ BlockPropertySet│
│ - model         │
│ - temperature   │
└─────────────────┘

┌─────────────────┐      ┌─────────────────┐
│ CustomCmdDef    │──────►│ AICommand       │
│ (from config    │ maps  │ (registered)    │
│  page)          │ to    │                 │
└─────────────────┘       └─────────────────┘

┌─────────────────┐      ┌─────────────────┐
│ RequestContext  │──────►│ LLMClient       │
│ - content       │ input │ - chat()        │
│ - sourceUUIDs   │       │                 │
└─────────────────┘       └─────────────────┘
```

## Data Flow for Typical Command Execution

1. **User invokes command** → `CommandHandler.execute(commandId)`
2. **Extract context** → `ContextExtractor.extract(contextStrategy, blockUUID)` → `RequestContext`
3. **Resolve properties** → `PropertyParser.resolve(blockUUID)` → `BlockPropertySet`
4. **Merge config** → Combine `ModelConfiguration + BlockPropertySet + AICommand.overrides`
5. **Create placeholder** → `ResponseHandler.createPlaceholder(targetBlockUUID)`
6. **Send request** → `LLMClient.stream(mergedConfig, prompt)`
7. **Stream response** → `ResponseHandler.updateStreaming(chunk)` for each token
8. **Complete** → `ResponseHandler.complete()` updates final content
9. **Cleanup** → Remove listeners, clear cache entries

## Persistence Strategy

- **ModelConfiguration**: Stored in Logseq plugin settings (`logseq.updateSettings()`)
- **CustomCommandDefinitions**: Read from `ai-command-config` page on demand, no persistence
- **AICommand registry**: In-memory only, rebuilt on plugin load
- **BlockPropertySet**: Extracted on-demand from Logseq block properties, cached with TTL
- **RequestContext**: Ephemeral, discarded after request completes
- **ResponseHandler**: Ephemeral, cleaned up on completion/failure/cancellation

## Summary

6 core entities defined with clear responsibilities:
- **AICommand**: Command metadata and execution parameters
- **ModelConfiguration**: LLM endpoint settings
- **BlockPropertySet**: Per-block model overrides
- **CustomCommandDefinition**: User-defined commands
- **RequestContext**: Extracted content for AI requests
- **ResponseHandler**: Streaming response lifecycle manager

All entities support constitution requirements for modularity, extensibility, and maintainability. Ready for contract generation.
