const fs = require('fs');
const path = require('path');
const dir = 'migrations';

fs.readdirSync(dir).forEach(file => {
  const filePath = path.join(dir, file);
  if (fs.statSync(filePath).isFile() && file.endsWith('.sql')) {
    const content = fs.readFileSync(filePath, 'utf8');
    if (content.toLowerCase().includes('create function') || content.toLowerCase().includes('create or replace function')) {
      console.log(`Function in ${file}:`);
      const lines = content.split('\n');
      lines.forEach((line, idx) => {
        if (line.toLowerCase().includes('function') || line.toLowerCase().includes('returns') || line.toLowerCase().includes('security definer')) {
          console.log(`  ${idx+1}: ${line.trim()}`);
        }
      });
    }
  }
});
