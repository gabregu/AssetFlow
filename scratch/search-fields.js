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
      if (file.endsWith('.js') || file.endsWith('.jsx') || file.endsWith('.tsx') || file.endsWith('.ts')) {
        const content = fs.readFileSync(fullPath, 'utf8');
        if (content.includes('deliveryCompletedDate') || content.includes('delivery_completed_date')) {
          console.log(`Found in ${fullPath}:`);
          const lines = content.split('\n');
          lines.forEach((line, idx) => {
            if (line.includes('deliveryCompletedDate') || line.includes('delivery_completed_date')) {
              console.log(`  ${idx+1}: ${line.trim()}`);
            }
          });
        }
      }
    }
  });
}

searchFiles('.');
