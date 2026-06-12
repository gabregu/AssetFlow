const fs = require('fs');
const path = require('path');

function searchFiles(dir) {
  if (dir.includes('node_modules') || dir.includes('.next') || dir.includes('.git')) return;
  try {
    fs.readdirSync(dir).forEach(file => {
      const fullPath = path.join(dir, file);
      const stat = fs.statSync(fullPath);
      if (stat.isDirectory()) {
        searchFiles(fullPath);
      } else {
        if (file.endsWith('.json') && !file.includes('package') && !file.includes('tsconfig')) {
          console.log(fullPath);
        }
      }
    });
  } catch (e) {}
}

searchFiles('..');
