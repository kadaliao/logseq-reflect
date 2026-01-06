/**
 * Logseq AI Plugin
 * Entry point
 */

async function main() {
  console.log('=== Logseq AI Plugin Starting ===');
  
  // 注册 Ask AI 命令 - 使用当前块内容作为问题
  logseq.Editor.registerSlashCommand('Ask AI', async () => {
    try {
      const block = await logseq.Editor.getCurrentBlock();
      
      if (!block || !block.content || block.content.trim() === '') {
        logseq.App.showMsg('❌ Please write your question in the block first', 'warning');
        return;
      }
      
      const question = block.content.trim();
      
      // 创建一个新的子块用于显示答案
      const newBlock = await logseq.Editor.insertBlock(
        block.uuid,
        '⏳ AI is thinking...',
        { sibling: false }
      );
      
      // 模拟 AI 响应（实际功能待实现）
      setTimeout(async () => {
        await logseq.Editor.updateBlock(
          newBlock.uuid,
          `🤖 AI Response to: "${question}"\n\n(AI functionality coming soon - this is just a demo)`
        );
        logseq.App.showMsg('✅ AI response added!', 'success');
      }, 1000);
      
    } catch (error) {
      console.error('Error in Ask AI command:', error);
      logseq.App.showMsg('❌ Error: ' + error.message, 'error');
    }
  });
  
  // 注册快捷键命令
  logseq.App.registerCommandPalette({
    key: 'ask-ai-quick',
    label: 'Ask AI (Quick)',
    keybinding: {
      binding: 'mod+shift+a'
    }
  }, async () => {
    logseq.App.showMsg('💡 Type your question in a block, then use the /Ask AI slash command', 'info');
  });
  
  console.log('=== Logseq AI Plugin Loaded ===');
  logseq.App.showMsg('✅ Logseq AI Plugin loaded! Use /Ask AI to get started', 'success');
}

// Initialize plugin
logseq.ready(main).catch(console.error);
