// 修复生成的代码，添加 logseq 对象检测
const fs = require('fs');
const path = require('path');

const indexPath = path.join(__dirname, 'dist', 'index.js');
let content = fs.readFileSync(indexPath, 'utf-8');

// 替换 })(parent.logseq); 为动态检测（注意可能有换行）
content = content.replace(
  /\}\)\(parent\.logseq\);/,
  `})(typeof logseq !== 'undefined' ? logseq : (typeof parent !== 'undefined' && parent.logseq) || (typeof window !== 'undefined' && window.logseq) || {});`
);

fs.writeFileSync(indexPath, content);
console.log('✅ Fixed logseq global reference');
