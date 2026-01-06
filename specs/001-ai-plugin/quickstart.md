# Quickstart Guide: Logseq AI Plugin

**Feature**: 001-ai-plugin
**Date**: 2026-01-05
**Purpose**: Step-by-step guide for developers to set up, build, test, and run the plugin

## Prerequisites

Before starting development, ensure you have:

- **Node.js**: Version 18.x or later ([Download](https://nodejs.org/))
- **pnpm**: Version 8.x or later (`npm install -g pnpm`)
- **Logseq**: Version 0.9.0 or later ([Download](https://logseq.com/downloads))
- **Git**: For version control
- **Code Editor**: VS Code recommended with TypeScript/ESLint extensions

## Initial Setup

### 1. Clone Repository and Install Dependencies

```bash
# Navigate to project root
cd logseq-reflect

# Install dependencies
pnpm install

# Verify installation
pnpm list --depth=0
```

**Expected Dependencies**:
- `@logseq/libs`: Logseq Plugin SDK
- `react`: React library
- `react-dom`: React DOM renderer
- `vite`: Build tooling
- `vitest`: Testing framework
- `typescript`: TypeScript compiler
- `eslint`: Code linting
- `prettier`: Code formatting

### 2. Configure TypeScript

Verify `tsconfig.json` exists with strict mode:

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noImplicitReturns": true,
    "skipLibCheck": true,
    "moduleResolution": "node",
    "resolveJsonModule": true,
    "esModuleInterop": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

### 3. Configure Vite Build

Create `vite.config.ts`:

```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { visualizer } from 'rollup-plugin-visualizer'

export default defineConfig({
  plugins: [
    react(),
    visualizer({ filename: 'dist/stats.html' })
  ],
  build: {
    target: 'esnext',
    minify: 'terser',
    rollupOptions: {
      external: ['@logseq/libs'],
      output: {
        manualChunks: {
          'ui': ['./src/ui/CommandPalette.tsx', './src/ui/SettingsPanel.tsx'],
          'llm': ['./src/llm/client.ts', './src/llm/streaming.ts']
        }
      }
    }
  }
})
```

### 4. Set Up Linting and Formatting

Create `.eslintrc.js`:

```javascript
module.exports = {
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:react/recommended',
    'plugin:react-hooks/recommended'
  ],
  parser: '@typescript-eslint/parser',
  plugins: ['@typescript-eslint', 'react'],
  rules: {
    '@typescript-eslint/no-explicit-any': 'error',
    '@typescript-eslint/explicit-function-return-type': 'warn'
  },
  settings: {
    react: { version: 'detect' }
  }
}
```

Create `.prettierrc`:

```json
{
  "semi": false,
  "singleQuote": true,
  "tabWidth": 2,
  "trailingComma": "es5",
  "printWidth": 100
}
```

## Development Workflow

### 1. Start Development Mode

```bash
# Build plugin in watch mode
pnpm dev

# Output: Vite will build and watch for changes
# Plugin output: dist/index.js
```

### 2. Load Plugin in Logseq

**Manual Loading (Development)**:

1. Open Logseq
2. Navigate to Settings → Plugins
3. Click "Load unpacked plugin"
4. Select `logseq-reflect/dist` directory
5. Plugin appears in toolbar with icon

**Auto-Reload on Changes**:

- Vite watches `src/` for changes
- On save, rebuilds to `dist/`
- Logseq auto-reloads plugin if enabled in settings

### 3. Run Tests

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

**Test Organization**:
```
tests/
├── unit/          # Fast, isolated tests (<100ms each)
├── integration/   # Logseq API interaction tests (<1s each)
└── contract/      # LLM API contract validation
```

### 4. Type Checking

```bash
# Run TypeScript compiler (no emit, check only)
pnpm typecheck

# Expected: No errors, warnings should be addressed
```

### 5. Linting and Formatting

```bash
# Check linting
pnpm lint

# Auto-fix linting issues
pnpm lint:fix

# Check formatting
pnpm format:check

# Auto-format code
pnpm format
```

## Building for Production

### 1. Build Optimized Bundle

```bash
# Clean previous build
rm -rf dist

# Build production bundle
pnpm build

# Output:
# dist/index.js (minified, <500KB)
# dist/stats.html (bundle analysis)
```

### 2. Verify Bundle Size

```bash
# Check gzipped size
gzip -c dist/index.js | wc -c

# Expected: < 500KB (512,000 bytes)
# If exceeded, review dist/stats.html for large dependencies
```

### 3. Test Production Build

```bash
# Load dist/index.js in Logseq
# Verify all commands work
# Check browser console for errors
```

## Common Development Tasks

### Adding a New Command

1. **Create Command Handler** (`src/commands/<name>.ts`):

```typescript
import { AICommand } from '../types'
import { logseq } from '@logseq/libs'

export const newCommand: AICommand = {
  id: 'new-command',
  title: 'New Command',
  description: 'Description of what this command does',
  promptTemplate: '{question}',
  requiresInput: true,
  requiresSelection: false,
  contextStrategy: 'none',
  modelOverride: null,
  temperatureOverride: null,
  isCustom: false,
  menuContext: ['palette', 'slash']
}

export async function handleNewCommand(userInput: string): Promise<void> {
  // Implementation
}
```

2. **Register in Command Registry** (`src/commands/registry.ts`):

```typescript
import { newCommand, handleNewCommand } from './newCommand'

registry.register(newCommand, handleNewCommand)
```

3. **Write Tests** (`tests/unit/commands/newCommand.test.ts`):

```typescript
import { describe, it, expect, vi } from 'vitest'
import { handleNewCommand } from '../../../src/commands/newCommand'

describe('handleNewCommand', () => {
  it('should execute command successfully', async () => {
    // Test implementation
  })
})
```

4. **Run Tests and Verify**:

```bash
pnpm test tests/unit/commands/newCommand.test.ts
```

### Debugging

**Enable Debug Mode**:

1. Open Logseq plugin settings
2. Find "Logseq AI Plugin"
3. Enable "Debug Mode" toggle
4. Check browser console (Cmd+Option+I / Ctrl+Shift+I) for detailed logs

**Common Issues**:

| Issue | Cause | Solution |
|-------|-------|----------|
| Plugin won't load | Build failed | Check `pnpm build` output for errors |
| Commands not appearing | Registration failed | Check console for registration errors |
| Streaming not working | CORS or endpoint issue | Verify LLM endpoint in settings, check network tab |
| Tests failing | Missing mocks | Ensure `@logseq/libs` is mocked in test setup |
| Bundle size exceeded | Large dependency | Review `dist/stats.html`, consider alternatives |

## Testing LLM Integration

### Local Ollama Setup

```bash
# Install Ollama (macOS)
brew install ollama

# Start Ollama service
ollama serve

# Pull a model
ollama pull llama3

# Verify endpoint
curl http://localhost:11434/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "llama3",
    "messages": [{"role": "user", "content": "Hello"}],
    "stream": false
  }'

# Expected: JSON response with completion
```

### Configure Plugin Settings

1. Open Logseq → Settings → Plugins → Logseq AI Plugin
2. Set:
   - **Host**: `http://localhost:11434`
   - **API Path**: `/v1/chat/completions`
   - **Model**: `llama3`
   - **Streaming**: Enabled
3. Save settings

### Test Basic Command

1. Create new page in Logseq
2. Press `Cmd+Shift+P` (or configured shortcut) to open command palette
3. Type "Ask AI"
4. Enter question: "What is 2+2?"
5. Verify: Answer appears as new block below cursor

## CI/CD Setup

**GitHub Actions Workflow** (`.github/workflows/test.yml`):

```yaml
name: Test

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v2
        with:
          version: 8
      - uses: actions/setup-node@v4
        with:
          node-version: '18'
          cache: 'pnpm'

      - run: pnpm install
      - run: pnpm typecheck
      - run: pnpm lint
      - run: pnpm test:coverage
      - run: pnpm build

      - name: Check bundle size
        run: |
          size=$(gzip -c dist/index.js | wc -c)
          if [ $size -gt 512000 ]; then
            echo "Bundle size $size exceeds 500KB limit"
            exit 1
          fi
```

## Package Scripts Reference

```json
{
  "scripts": {
    "dev": "vite build --watch",
    "build": "vite build",
    "typecheck": "tsc --noEmit",
    "lint": "eslint src --ext .ts,.tsx",
    "lint:fix": "eslint src --ext .ts,.tsx --fix",
    "format": "prettier --write src",
    "format:check": "prettier --check src",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage",
    "clean": "rm -rf dist coverage"
  }
}
```

## Next Steps

After completing this quickstart:

1. Review **Constitution** (`.specify/memory/constitution.md`) for quality standards
2. Read **Data Model** (`specs/001-ai-plugin/data-model.md`) for entity relationships
3. Check **Contracts** (`specs/001-ai-plugin/contracts/`) for API specifications
4. Implement **User Stories** following priority order (P1 → P7)
5. Write **Tests First** for each story before implementation
6. Run `/speckit.tasks` to generate detailed task breakdown

## Support

- **Logseq Plugin SDK Docs**: https://github.com/logseq/logseq-plugin-sdk
- **Plugin Samples**: https://github.com/logseq/logseq-plugin-samples
- **TypeScript Handbook**: https://www.typescriptlang.org/docs/
- **Vite Docs**: https://vitejs.dev/guide/
- **Vitest Docs**: https://vitest.dev/guide/

Happy coding! 🚀
