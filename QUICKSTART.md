# Quick Start Guide - Logseq AI Plugin

## ✅ Plugin is Built and Ready!

The plugin has been successfully built. Here's how to use it:

## 1. Load the Plugin in Logseq

### Option A: Load from Local Directory (Development)

1. Open Logseq
2. Go to **Settings** (top-right corner) → **Plugins** → **Load unpacked plugin**
3. Navigate to and select this directory: `/Users/liaoxingyi/workspace/logseq-reflect`
4. The plugin should appear in your plugins list as "Logseq AI Plugin 🤖"

### Option B: Enable Developer Mode

1. Open Logseq Settings → Plugins
2. Enable "Developer mode" 
3. Click "Load unpacked plugin"
4. Select the project directory

## 2. Configure API Settings

⚠️ **IMPORTANT**: Before using the plugin, you need to configure your LLM API settings:

1. In Logseq, go to **Settings** → **Plugins** → **Logseq AI Plugin** → **Settings**
2. Configure the following:
   - **API Endpoint**: `https://api.openai.com/v1` (or your preferred OpenAI-compatible endpoint)
   - **API Key**: Your OpenAI API key (get one from https://platform.openai.com/api-keys)
   - **Model Name**: `gpt-4` or `gpt-3.5-turbo` or any other model you prefer
   - **Temperature**: `0.7` (default, controls randomness)
   - **Max Tokens**: `2000` (maximum response length)
   - **Streaming**: Enable for real-time responses

## 3. Use the Plugin

There are **4 ways** to ask AI questions:

### Method 1: Keyboard Shortcut (Fastest)
- Press **`Cmd+Shift+A`** (Mac) or **`Ctrl+Shift+A`** (Windows/Linux)
- Type your question
- Press Enter or click "Ask AI"
- Watch the answer stream into a new block!

### Method 2: Command Palette
- Press **`Cmd+Shift+P`** (Mac) or **`Ctrl+Shift+P`** (Windows/Linux)
- Type "Ask AI"
- Select the command
- Enter your question

### Method 3: Slash Command
- In any block, type `/ai`
- Enter your question

### Method 4: Toolbar Button
- Click the **message icon** 🤖 in the toolbar
- Enter your question

## 4. Example Usage

1. Click in a block or create a new one
2. Press `Cmd+Shift+A`
3. Type: "What is the difference between async and await in JavaScript?"
4. Press Enter
5. Watch as the AI streams the answer into a new block below!

## Troubleshooting

### Plugin doesn't appear
- Make sure you selected the correct directory (`logseq-reflect`)
- Try restarting Logseq
- Check the Logseq console for errors (View → Developer → Toggle Developer Tools)

### "API request failed" error
- Check your API key is correct
- Verify your API endpoint is reachable
- Make sure you have credits/quota on your OpenAI account
- Check your internet connection

### No response appears
- Open Logseq Developer Tools (View → Developer → Toggle Developer Tools)
- Check the Console tab for errors
- Verify your settings are correct

### Slow responses
- This is normal for large models like GPT-4
- Try using `gpt-3.5-turbo` for faster responses
- Check your internet speed

## Features Available Now

✅ **Basic AI Q&A** - Ask any question, get AI answers
✅ **Streaming responses** - Watch answers appear in real-time  
✅ **Multiple invocation methods** - Keyboard, command palette, slash, toolbar
✅ **Error handling** - Graceful handling of network issues
✅ **Smart block placement** - Answers appear in the right place

## Coming Soon (Not Yet Implemented)

These features are planned but not yet available:
- ⏳ Context-aware questions (using page/block context)
- ⏳ Content summarization
- ⏳ Flashcard generation
- ⏳ Task breakdown
- ⏳ Custom commands
- ⏳ Block-level configuration

## Development

### Rebuild after changes:
```bash
pnpm build
```

### Watch mode (auto-rebuild):
```bash
pnpm dev
```

### Run tests:
```bash
pnpm test
```

## Need Help?

- Check Logseq console for errors: View → Developer → Toggle Developer Tools
- Review settings: Settings → Plugins → Logseq AI Plugin
- Make sure your API key is valid and has credits

Enjoy using AI in Logseq! 🎉
