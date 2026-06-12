const fs = require('fs');
const path = require('path');

function searchFiles(dir) {
  if (!fs.existsSync(dir)) return;
  fs.readdirSync(dir).forEach(file => {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      searchFiles(fullPath);
    } else {
      console.log(fullPath);
    }
  });
}

searchFiles('supabase');
