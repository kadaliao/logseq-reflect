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

1. Read the [constitution](.specify/memory/constitution.md) for quality standards
2. Check [tasks](specs/001-ai-plugin/tasks.md) for implementation roadmap
3. Follow [test-driven development](specs/001-ai-plugin/plan.md) approach
4. Ensure all tests pass and coverage ≥80%

## License

MIT

## Support

- **Logseq Plugin SDK**: https://github.com/logseq/logseq-plugin-sdk
- **Plugin Samples**: https://github.com/logseq/logseq-plugin-samples
- **Documentation**: See `specs/001-ai-plugin/` for detailed specs and plans
