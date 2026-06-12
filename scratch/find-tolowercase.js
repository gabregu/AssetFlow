const fs = require('fs');
const content = fs.readFileSync('lib/store.js', 'utf8');
const lines = content.split('\n');
lines.forEach((line, idx) => {
  if (line.includes('toLowerCase') && (line.includes('serial') || line.includes('name') || line.includes('driver'))) {
    console.log(`${idx+1}: ${line.trim()}`);
  }
});
