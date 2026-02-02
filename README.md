# Logseq Reflect - AI Plugin

AI-powered Logseq plugin for question answering, summarization, flashcard generation, and task breakdown.

## Features

- **Ask AI**: Get answers to questions directly within your Logseq workspace
- **Context-Aware Questions**: Ask questions with automatic page or block context inclusion
- **Content Summarization**: Generate summaries of pages or block trees with streaming updates
- **Flashcard Generation**: Convert notes into question-answer flashcard pairs
- **Task Breakdown**: Decompose TODO items into nested subtasks
- **Custom Commands**: Define reusable custom AI commands via configuration
- **Block-Level Configuration**: Override AI model settings per block using properties

## Installation

### Prerequisites

- Node.js ≥18.0.0
- pnpm ≥8.0.0
- Logseq ≥0.9.0

### Setup

```bash
# Install dependencies
pnpm install

# Run in development mode
pnpm dev

# Build for production
pnpm build

# Run tests
pnpm test

# Type check
pnpm typecheck

# Lint code
pnpm lint

# Format code
pnpm format
```

### Loading in Logseq

1. Build the plugin: `pnpm build`
2. Open Logseq → Settings → Plugins
3. Click "Load unpacked plugin"
4. Select the project root directory
5. Plugin will appear in toolbar

## Configuration

### LLM Endpoint Setup

1. Open Logseq Settings → Plugins → Logseq AI Plugin
2. Configure:
   - **Host**: LLM endpoint URL (e.g., `http://localhost:11434`)
   - **API Path**: API endpoint path (e.g., `/v1/chat/completions`)
   - **Model**: Model name (e.g., `llama3`, `gpt-4`)
   - **Streaming**: Enable/disable streaming responses
   - **Temperature**: Sampling temperature (0.0-2.0)
   - **Max Context**: Maximum context length in tokens
   - **Enable Output Formatting**: Automatically format LLM output to prevent Logseq block structure issues (default: enabled)
   - **Log Formatting Modifications**: Log when formatting is applied (default: enabled)

### Local LLM with Ollama

```bash
# Install Ollama
brew install ollama

# Start Ollama service
ollama serve

# Pull a model
ollama pull llama3

# Configure plugin to use Ollama
# Host: http://localhost:11434
# API Path: /v1/chat/completions
# Model: llama3
```

## Usage

### Basic Commands

- **Cmd+Shift+P** (or configured shortcut): Open command palette
- Type `/ai` in editor: Quick access to AI commands
- Right-click on blocks: Context menu with applicable AI commands
- Toolbar button: Click AI icon for quick access

### Available Commands

#### Ask AI
- **Command**: `/ai` or "Ask AI" from command palette
- **Description**: Ask a question and get an answer as a new block
- **Example**: Type "What is quantum computing?" and run `/ai`

#### Ask with Page Context
- **Command**: `/ai-page` or "Ask AI with Page Context"
- **Description**: Ask a question with entire page content as context
- **Example**: Type "Summarize the main points" on a page and run `/ai-page`

#### Ask with Block Context
- **Command**: `/ai-block` or "Ask AI with Block Context"
- **Description**: Ask a question with current block tree as context
- **Example**: Select a block with content and run `/ai-block`

#### Summarize Page
- **Command**: `/summarize-page` or "Summarize Page"
- **Description**: Generate a concise summary of the current page with structured bullet points
- **Streaming**: Yes (incremental updates)
- **Behavior**:
  - If run on an empty block, fills that block with "Summary" and creates child blocks for each point
  - If run on a block with content, creates a new "Summary" child block with nested points
  - Automatically flattens nested lists and normalizes formatting for Logseq compatibility

#### Summarize Block
- **Command**: `/summarize-block` or "Summarize Block"
- **Description**: Summarize the selected block tree with structured output
- **Streaming**: Yes (incremental updates)
- **Behavior**: Creates a "Summary" child block under current block with bullet points as children

#### Generate Flashcard
- **Command**: `/flashcard` or "Generate Flashcard"
- **Description**: Convert block content into Q&A flashcard with #card tag
- **Example**: Select factual content and run `/flashcard`

#### Divide into Subtasks
- **Command**: `/divide` or `/subtasks`
- **Description**: Break down TODO items into actionable subtasks
- **Requirements**: Block must have a TODO marker (TODO, DOING, LATER, etc.)
- **Example**: Run on "TODO Build landing page" to get structured subtasks
- **Behavior**: Creates individual child blocks for each subtask with the same TODO marker as parent

### Custom Commands

Create custom commands by adding blocks to an `ai-command-config` page:

```markdown
- Custom Translation Command
  ai-context-menu-title:: Translate to English
  ai-prompt-prefix:: Translate the following to English:
  ai-model:: gpt-4
```

### Block Properties

Override AI settings per block:

```markdown
- My research notes
  ai-generate-model:: qwen2
  ai-generate-temperature:: 0.8
  - Child blocks inherit these settings automatically
```

**Supported Properties:**
- `ai-generate-model`: Override model name
- `ai-generate-temperature`: Set temperature (0.0-2.0)
- `ai-generate-top_p`: Set top_p for nucleus sampling (0.0-1.0)
- `ai-generate-use_context`: Enable/disable context inclusion (true/false)

Properties inherit from parent blocks to children.

## Output Formatting

The plugin automatically formats LLM output to ensure compatibility with Logseq's block structure. This feature can be configured in plugin settings.

### What Gets Formatted

- **List Normalization**: Converts various list formats (*, +, 1., 2.) to Logseq's standard `- ` format
- **Nested List Flattening**: Removes indentation from nested lists to create flat, single-level structures
- **Tag Spacing**: Ensures proper spacing around Logseq tags (e.g., `#tag` and `[[tag]]`)
- **Block Structure**: Splits concatenated list items into separate child blocks
- **Code Block Handling**: Extracts structured content from code fences when appropriate

### Formatting Behavior by Command

#### Summarize Commands
- Parses AI output to separate list items from regular text
- Creates individual child blocks for each bullet point
- Sets header block to "Summary" if no title is provided by AI
- Preserves non-list content (titles, conclusions) in parent block

#### Task Commands
- Flattens nested subtask lists into single-level children
- Applies TODO markers consistently to all subtasks
- Ensures proper spacing around tags in task descriptions

#### Flashcard Commands
- Handles multi-line answers by creating parent-child block structures
- Ensures #card tag is properly placed on answer blocks

### Disabling Formatting

If you prefer raw LLM output without formatting:

1. Open Settings → Plugins → Logseq AI Plugin
2. Disable "Enable Output Formatting"
3. Formatting will be bypassed for all commands

## Troubleshooting

### Connection Errors

**Error**: "Could not connect to AI model"

**Solutions:**
- Verify your LLM endpoint is running: `curl http://localhost:11434`
- Check the Base URL in plugin settings
- Ensure firewall isn't blocking the connection
- For Ollama: Run `ollama serve` to start the service

### Timeout Errors

**Error**: "Request timeout after Xs"

**Solutions:**
- Increase timeout in plugin settings (default: 30s)
- Use a faster model or smaller context
- Check network connection to AI endpoint
- Reduce max context tokens in settings

### Empty or Malformed Responses

**Issue**: AI returns blank or unexpected responses

**Solutions:**
- Verify model supports OpenAI-compatible format
- Check API key is correct (if required)
- Enable debug mode in settings to see detailed logs
- Test endpoint with curl:
  ```bash
  curl -X POST http://localhost:11434/v1/chat/completions \
    -H "Content-Type: application/json" \
    -d '{"model":"llama3","messages":[{"role":"user","content":"Hello"}]}'
  ```

### Plugin Not Loading

**Issue**: Plugin fails to initialize

**Solutions:**
- Check Logseq version (requires ≥0.9.0)
- Review browser console for error messages (Cmd+Option+I)
- Try reinstalling: Remove plugin → Restart Logseq → Reinstall
- Check plugin directory permissions

### Streaming Not Working

**Issue**: Responses appear all at once instead of incrementally

**Solutions:**
- Verify "Streaming Enabled" is true in settings
- Check that your LLM endpoint supports SSE streaming
- Some models may not stream properly - try a different model

## Development

### Project Structure

```
logseq-reflect/
├── src/
│   ├── commands/       # Command handlers
│   ├── llm/            # LLM client and streaming
│   ├── context/        # Context extraction and management
│   ├── ui/             # React components
│   ├── config/         # Settings and configuration
│   └── utils/          # Utility functions
├── tests/
│   ├── unit/           # Unit tests
│   ├── integration/    # Integration tests
│   └── contract/       # Contract tests
└── specs/              # Feature specifications and plans
```

### Testing

```bash
# Run all tests
pnpm test

# Run tests in watch mode
pnpm test:watch

# Run tests with coverage
pnpm test:coverage

# View coverage report
open coverage/index.html
```

### Code Quality

```bash
# Type checking
pnpm typecheck

# Linting
pnpm lint
pnpm lint:fix

# Formatting
pnpm format
pnpm format:check
```

## Architecture

- **TypeScript 5.x**: Strict mode enabled for type safety
- **React 18**: UI components with hooks
- **Vite 5**: Build tooling with HMR
- **Vitest**: Fast unit testing
- **@logseq/libs**: Official Logseq Plugin SDK

## Contributing

1. Follow test-driven development approach
2. Ensure all tests pass (current: 433/433 passing, 100% pass rate)
3. Run `pnpm test` before committing
4. Follow TypeScript strict mode conventions

## License

MIT

## Support

- **Issues & Bug Reports**: [GitHub Issues](https://github.com/kadaliao/logseq-reflect/issues)
- **Logseq Plugin SDK**: https://github.com/logseq/logseq-plugin-sdk
- **Plugin Samples**: https://github.com/logseq/logseq-plugin-samples
