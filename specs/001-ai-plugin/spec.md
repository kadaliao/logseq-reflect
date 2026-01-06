# Feature Specification: Logseq AI Plugin

**Feature Branch**: `001-ai-plugin`
**Created**: 2026-01-05
**Status**: Draft
**Input**: User description: "读取 @docs/logseq-ai-plugin-prd.md 创建产品开发计划"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Basic AI Question & Answer (Priority: P1)

Users can ask AI questions directly within their Logseq workspace and receive answers inserted as new blocks, enabling quick information retrieval without leaving their note-taking flow.

**Why this priority**: This is the fundamental capability that all other features build upon. Without basic AI interaction, the plugin provides no value. This establishes the core command execution and response handling patterns.

**Independent Test**: Can be fully tested by installing the plugin, opening the command palette, selecting "Ask AI", typing a question, and verifying the answer appears as a new block in the expected location.

**Acceptance Scenarios**:

1. **Given** user has plugin installed and configured with model endpoint, **When** user opens command palette and selects "Ask AI" command and enters question "What is Logseq?", **Then** plugin creates new block below current position with AI-generated answer
2. **Given** user is editing a page, **When** user invokes "Ask AI" via toolbar button, **Then** command palette opens with focus on input field ready for question entry
3. **Given** AI request is in progress, **When** user waits for response, **Then** placeholder block appears with loading indicator showing request is active
4. **Given** AI request fails due to network error, **When** error occurs, **Then** plugin displays clear error message with suggestion to check settings and network connection
5. **Given** user has not selected any block, **When** user invokes "Ask AI", **Then** plugin creates new block at end of current page for answer output

---

### User Story 2 - Context-Aware Questions (Priority: P2)

Users can ask AI questions with automatic inclusion of page or block context, enabling AI to provide answers grounded in their existing notes without manual copying of context.

**Why this priority**: This differentiates the plugin from generic AI chat tools by integrating with Logseq's knowledge graph. Provides significantly more value for research and knowledge work scenarios.

**Independent Test**: Can be tested by creating a page with content, selecting "Ask with page context" command, asking a question about the page content, and verifying the AI answer demonstrates understanding of the page context.

**Acceptance Scenarios**:

1. **Given** user is on page "Project Alpha" with existing content, **When** user selects "Ask with page context" and asks "What are the main goals?", **Then** AI answer references and synthesizes information from the page content
2. **Given** user selects a specific block with nested children, **When** user selects "Ask with block context" and asks a question, **Then** AI receives selected block and its children as context
3. **Given** page content exceeds 10,000 tokens, **When** user invokes context command, **Then** plugin intelligently truncates or summarizes context without user-visible delay
4. **Given** user asks context question on empty page, **When** command executes, **Then** plugin displays message indicating no context available and asks if user wants to proceed with basic question

---

### User Story 3 - Content Summarization (Priority: P3)

Users can automatically generate summaries of pages or block trees, helping them quickly extract key points from long notes or meeting transcripts.

**Why this priority**: High-value feature for knowledge workers and researchers, but depends on context handling from P2. Can be delivered independently after core functionality is stable.

**Independent Test**: Can be tested by creating a page with multiple paragraphs of content, selecting "Summarize page" command, and verifying a concise summary appears as a new block.

**Acceptance Scenarios**:

1. **Given** user is on page with multiple blocks of content, **When** user selects "Summarize page" command, **Then** plugin inserts placeholder block and progressively streams summary content until complete
2. **Given** user selects a specific block tree, **When** user right-clicks and selects "Summarize block" from context menu, **Then** summary appears as new sibling block below selected block
3. **Given** streaming is enabled in settings, **When** summary is being generated, **Then** block content updates incrementally as tokens arrive from AI model
4. **Given** user closes Logseq during summary generation, **When** plugin detects window close event, **Then** request is cancelled gracefully without leaving incomplete content

---

### User Story 4 - Flashcard Generation (Priority: P4)

Users can convert note content into question-answer flashcard pairs tagged for spaced repetition, streamlining study material creation from learning notes.

**Why this priority**: Valuable for learners and students, but narrower use case than general summarization. Can be added incrementally.

**Independent Test**: Can be tested by selecting a block with factual content, invoking "Generate flashcard" command, and verifying two new blocks are created (question and answer) with #card tag applied.

**Acceptance Scenarios**:

1. **Given** user selects block with educational content, **When** user invokes "Generate flashcard" command, **Then** plugin creates two child blocks: one with question and one with answer, both tagged with #card
2. **Given** user selects multiple blocks, **When** user generates flashcards, **Then** plugin creates multiple question-answer pairs preserving logical relationships
3. **Given** block content is insufficient for flashcard, **When** command executes, **Then** plugin displays message suggesting more detailed content is needed

---

### User Story 5 - Task Breakdown (Priority: P5)

Users can automatically decompose TODO items into nested subtasks with proper indentation, accelerating project planning and task organization.

**Why this priority**: Useful productivity feature but serves narrower audience than Q&A and summarization. Benefits from core command infrastructure being mature.

**Independent Test**: Can be tested by creating a TODO block with high-level task description, selecting "Divide into subtasks" command, and verifying structured subtask hierarchy is generated with proper indentation.

**Acceptance Scenarios**:

1. **Given** user has TODO block "Prepare conference presentation", **When** user invokes "Divide into subtasks" command, **Then** plugin generates nested child blocks with logical subtasks maintaining TODO status and indentation
2. **Given** user selects non-TODO block, **When** user attempts task division, **Then** plugin displays message suggesting command is intended for TODO blocks
3. **Given** subtasks are generated, **When** user reviews output, **Then** each subtask is actionable and properly indented under parent task

---

### User Story 6 - Custom Commands (Priority: P6)

Advanced users can define reusable custom AI commands with predefined prompts and parameters, enabling personalized workflows without modifying code.

**Why this priority**: Power user feature that requires stable core infrastructure. Provides extensibility but not essential for basic functionality.

**Independent Test**: Can be tested by creating a configuration block with custom prompt definition, reloading plugin, and verifying new command appears in command palette and context menu.

**Acceptance Scenarios**:

1. **Given** user creates page "ai-command-config" with block containing `ai-context-menu-title:: Translate to English` and `ai-prompt-prefix:: Translate the following to English:`, **When** plugin loads, **Then** new "Translate to English" command appears in context menu
2. **Given** user defines custom command, **When** user invokes custom command on selected block, **Then** plugin applies predefined prompt template with block content and executes request
3. **Given** user updates custom command definition, **When** user reloads plugin or triggers refresh, **Then** command behavior updates to match new configuration
4. **Given** user defines multiple custom commands, **When** user opens command palette, **Then** all custom commands appear alongside built-in commands with clear naming

---

### User Story 7 - Block-Level Configuration (Priority: P7)

Users can override AI model settings per block using block properties, enabling fine-grained control over model selection and parameters for specific contexts.

**Why this priority**: Advanced feature for users with multiple models or specific parameter requirements. Adds flexibility but not required for core workflows.

**Independent Test**: Can be tested by adding `ai-generate-model:: qwen2` property to a block, invoking AI command within that block's tree, and verifying the specified model is used instead of default.

**Acceptance Scenarios**:

1. **Given** user adds property `ai-generate-model:: qwen2` to block, **When** user executes AI command within that block's scope, **Then** plugin uses qwen2 model instead of default model from settings
2. **Given** block has `ai-generate-temperature:: 0.8` property, **When** AI request is made, **Then** temperature parameter is set to 0.8 for that request
3. **Given** parent block has model override and child blocks do not, **When** command executes on child block, **Then** parent's model setting is inherited automatically
4. **Given** user sets conflicting properties at different levels, **When** command executes, **Then** most specific (closest ancestor) property value takes precedence

---

### Edge Cases

- What happens when AI model endpoint is unreachable or returns non-2xx status codes?
- How does plugin handle extremely long AI responses that exceed Logseq block size limits?
- What occurs if user invokes multiple AI commands simultaneously on different blocks?
- How does plugin behave when user edits or deletes placeholder block before AI response completes?
- What happens when user switches pages during streaming response?
- How does plugin handle malformed responses from AI models (invalid JSON, unexpected formats)?
- What occurs if block properties contain invalid values (non-numeric temperature, non-existent model names)?
- How does plugin behave when Logseq API is temporarily unavailable?

## Requirements *(mandatory)*

### Functional Requirements

#### Command Interface

- **FR-001**: Plugin MUST register toolbar button that opens command palette when clicked
- **FR-002**: Plugin MUST register keyboard shortcut (user-configurable in settings) to open command palette
- **FR-003**: Plugin MUST register slash command `/ai` that opens command palette in editor context
- **FR-004**: Command palette MUST support keyboard navigation with arrow keys, Enter to confirm, and Escape to cancel
- **FR-005**: Command palette MUST filter commands in real-time as user types
- **FR-006**: Plugin MUST register context menu items for applicable commands (summarize, flashcard, divide task, custom commands)

#### Core AI Commands

- **FR-007**: Plugin MUST provide "Ask AI" command that accepts free-form user question and inserts answer as new block
- **FR-008**: Plugin MUST provide "Ask with page context" command that includes current page content with user question
- **FR-009**: Plugin MUST provide "Ask with block context" command that includes selected block and children with user question
- **FR-010**: Plugin MUST provide "Summarize page" command that generates summary of current page content
- **FR-011**: Plugin MUST provide "Summarize block" command that generates summary of selected block tree
- **FR-012**: Plugin MUST provide "Generate flashcard" command that creates question-answer block pairs tagged with #card
- **FR-013**: Plugin MUST provide "Divide into subtasks" command that breaks down TODO items into nested subtasks
- **FR-014**: Plugin MUST support user-defined custom commands via configuration page mechanism

#### Settings & Configuration

- **FR-015**: Plugin MUST provide settings panel for configuring AI model endpoint (host URL and API path)
- **FR-016**: Plugin MUST allow users to specify default AI model name in settings
- **FR-017**: Plugin MUST allow users to configure default temperature, top_p, and other model parameters
- **FR-018**: Plugin MUST allow users to set maximum context length limit (in tokens or characters)
- **FR-019**: Plugin MUST allow users to toggle streaming mode on/off globally
- **FR-020**: Plugin MUST allow users to configure keyboard shortcut for opening command palette
- **FR-021**: Plugin MUST allow users to define list of custom prompts with names and templates in settings
- **FR-022**: Plugin MUST persist all settings across Logseq restarts

#### Block Properties

- **FR-023**: Plugin MUST recognize and parse `ai-generate-model` block property to override default model
- **FR-024**: Plugin MUST recognize and parse `ai-generate-temperature` block property to override default temperature
- **FR-025**: Plugin MUST recognize and parse `ai-generate-top_p` block property to override default top_p
- **FR-026**: Plugin MUST recognize and parse `ai-generate-use_context` block property to control context inclusion
- **FR-027**: Plugin MUST automatically inherit block properties from parent blocks when not specified on current block
- **FR-028**: Plugin MUST validate block property values and display warnings for invalid formats

#### Custom Commands Configuration

- **FR-029**: Plugin MUST recognize page named "ai-command-config" as custom command definition location
- **FR-030**: Plugin MUST parse blocks with `ai-context-menu-title` property as custom command definitions
- **FR-031**: Plugin MUST support `ai-prompt-prefix` property to define text prepended to user input
- **FR-032**: Plugin MUST support `ai-prompt-suffix` property to define text appended to user input
- **FR-033**: Plugin MUST support `ai-model` property on custom command blocks to specify model override
- **FR-034**: Custom commands MUST appear in both command palette and context menu after plugin loads configuration

#### UX & Feedback

- **FR-035**: Plugin MUST insert placeholder block with loading indicator immediately when AI command is invoked
- **FR-036**: Placeholder MUST display spinner or progress animation during request processing
- **FR-037**: Plugin MUST update placeholder block with AI response when request completes successfully
- **FR-038**: Plugin MUST display clear error message in placeholder block when request fails, including specific error reason
- **FR-039**: Error messages MUST include actionable suggestions (check settings, verify network, confirm model endpoint)
- **FR-040**: When streaming is enabled, plugin MUST update block content incrementally as response tokens arrive
- **FR-041**: Plugin MUST handle user cancellation gracefully (closing palette, switching pages, deleting placeholder)
- **FR-042**: When no block is selected, plugin MUST create new block at end of current page for output

#### Reliability & Error Handling

- **FR-043**: Plugin MUST implement request timeout (user-configurable, default 30 seconds)
- **FR-044**: Plugin MUST support retry mechanism for failed requests (configurable retry count)
- **FR-045**: Plugin MUST handle network errors and display appropriate user-facing messages
- **FR-046**: Plugin MUST handle malformed AI responses without crashing plugin
- **FR-047**: Plugin MUST log errors to browser console with sufficient detail for debugging
- **FR-048**: Plugin MUST cancel in-flight requests when user closes Logseq or unloads plugin
- **FR-049**: Plugin MUST filter or escape AI response content that could break Logseq markdown parsing (e.g., `<think>` tags, invalid markdown)

#### Context Management

- **FR-050**: Plugin MUST extract page content preserving hierarchical block indentation
- **FR-051**: Plugin MUST filter out block properties from context content (lines starting with property syntax)
- **FR-052**: Plugin MUST truncate context when it exceeds maximum token limit configured in settings
- **FR-053**: When truncating context, plugin MUST preserve most relevant content (beginning and end, or intelligent summarization)
- **FR-054**: Plugin MUST provide token estimation mechanism to avoid sending oversized requests

### Key Entities

- **AI Command**: Represents executable action (built-in or custom) with name, prompt template, model override, and UI display properties
- **Model Configuration**: Represents AI model endpoint settings including host URL, API path, model name, temperature, top_p, and streaming preferences
- **Block Property Set**: Collection of `ai-generate-*` properties attached to block, determining model behavior for that block's scope
- **Custom Command Definition**: User-defined command specification stored as block properties including menu title, prompt prefix/suffix, and parameter overrides
- **Request Context**: Content scope for AI request, either page-level (all blocks on page) or block-level (selected block tree)
- **Response Handler**: Manages AI response lifecycle including placeholder creation, streaming updates, error handling, and final content insertion

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: New users can complete their first successful AI command within 5 minutes of plugin installation (measured via user testing with 10+ participants)
- **SC-002**: Core AI commands (Ask, Summarize, Divide task) succeed with ≥95% success rate under normal network conditions (measured via error logging and telemetry)
- **SC-003**: Plugin provides clear, actionable error feedback in ≥95% of failure cases (measured by analyzing error message content quality)
- **SC-004**: AI command responses appear within 100 milliseconds of user action (placeholder/loading indicator), with full response time dependent on model speed
- **SC-005**: Plugin loads and initializes within 2 seconds on modern hardware (measured from plugin enable to UI ready state)
- **SC-006**: At least 30% of active users (defined as ≥10 AI commands/week) use custom commands or block properties at least once per month (measured via opt-in usage analytics)
- **SC-007**: GitHub issues categorized as "command not found" or "no feedback" represent <5% of total issues (measured via issue labels and categorization)
- **SC-008**: Streaming responses render incrementally without blocking Logseq UI thread (verified via performance profiling showing <16ms frame times)
- **SC-009**: Plugin memory footprint remains below 100MB during normal operation (measured via browser DevTools memory snapshots)
- **SC-010**: Context handling for large pages (>10,000 tokens) completes without user-perceivable delay (<500ms, measured via performance.now() instrumentation)

## Assumptions

- Users have access to local AI model endpoint (Ollama or compatible HTTP service) or are willing to configure third-party API endpoint
- Users are familiar with basic Logseq concepts (blocks, pages, properties, slash commands)
- AI model endpoints return responses in compatible format (OpenAI API-compatible preferred)
- Users have stable internet connection for cloud model endpoints or local network access for self-hosted models
- Logseq plugin API remains stable for core features (block creation, property reading, UI registration) across minor version updates
- Users running Logseq version 0.9.0 or later (plugin targets recent stable versions)
- Block content size limits in Logseq are sufficient for typical AI responses (<100,000 characters)
- Users accept that AI responses may occasionally be inaccurate, incomplete, or require fact-checking

## Out of Scope

The following are explicitly NOT included in this feature scope:

- **Full chat conversation panel**: Plugin focuses on single-command interactions, not persistent chat sessions with history
- **Built-in cloud AI model integration**: Plugin does not bundle API keys or direct integrations with commercial AI services (OpenAI, Anthropic, etc.)
- **Model download and management**: Plugin does not handle downloading, updating, or managing AI model files
- **Multi-modal capabilities**: No support for image, audio, or video processing (text-only)
- **Collaborative features**: No real-time collaboration or shared AI command sessions across multiple users
- **Note synchronization**: Plugin does not manage or influence Logseq's note sync functionality
- **Version compatibility beyond Logseq 0.9+**: No guaranteed support for legacy Logseq versions
- **Offline AI capabilities**: Plugin requires network access to AI endpoint; no embedded local models
