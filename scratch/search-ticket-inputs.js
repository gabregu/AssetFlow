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
      if (file.endsWith('.js') || file.endsWith('.jsx')) {
        const content = fs.readFileSync(fullPath, 'utf8');
        if (content.includes('<input') || content.includes('<select')) {
          console.log(`Found input/select in ${fullPath}`);
          const lines = content.split('\n');
          lines.forEach((line, idx) => {
            if (line.includes('label') || line.includes('type=') || line.includes('placeholder')) {
              if (line.trim().length < 150) {
                console.log(`  ${idx+1}: ${line.trim()}`);
              }
            }
          });
        }
      }
    }
  });
}

searchFiles('app/dashboard/tickets/[id]');
