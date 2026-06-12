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
      if (file.endsWith('.js') || file.endsWith('.jsx') || file.endsWith('.json') || file.endsWith('.ts') || file.endsWith('.tsx') || file.endsWith('.html')) {
        const content = fs.readFileSync(fullPath, 'utf8');
        if (content.toLowerCase().includes('service_role') || content.toLowerCase().includes('service-role') || content.toLowerCase().includes('servicekey') || content.toLowerCase().includes('service_key')) {
          console.log(`Found in ${fullPath}`);
          const lines = content.split('\n');
          lines.forEach((line, idx) => {
            if (line.toLowerCase().includes('key') || line.toLowerCase().includes('secret') || line.toLowerCase().includes('role')) {
              console.log(`  ${idx+1}: ${line.trim()}`);
            }
          });
        }
      }
    }
  });
}

searchFiles('.');
