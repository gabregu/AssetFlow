const fs = require('fs');
const file = 'app/dashboard/inventory/page.js';
const content = fs.readFileSync(file, 'utf8');
const lines = content.split('\n');
lines.forEach((line, idx) => {
  if (line.includes('addAsset')) {
    console.log(`Line ${idx+1}: ${line.trim()}`);
  }
});
