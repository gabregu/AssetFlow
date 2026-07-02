const fs = require('fs');
const path = require('path');

function searchFiles(dir) {
  if (dir.includes('node_modules') || dir.includes('.next') || dir.includes('.git')) return;
  
  fs.readdirSync(dir).forEach(file => {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      searchFiles(fullPath);
    } else {
      if (file.endsWith('.js') || file.endsWith('.sql') || file.endsWith('.txt') || file.endsWith('.md')) {
        const content = fs.readFileSync(fullPath, 'utf8');
        if (content.includes('admin@yawi.ar')) {
          console.log(`Found admin@yawi.ar in ${fullPath}`);
          // Print matching line
          const lines = content.split('\n');
          lines.forEach((line, idx) => {
            if (line.includes('admin@yawi.ar') || line.includes('password') || line.includes('Password') || line.includes('pass')) {
              console.log(`  ${idx+1}: ${line.trim()}`);
            }
          });
        }
      }
    }
  });
}

searchFiles('.');
