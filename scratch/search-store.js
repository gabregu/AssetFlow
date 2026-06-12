const fs = require('fs');
const content = fs.readFileSync('lib/store.js', 'utf8');
const lines = content.split('\n');
lines.forEach((line, idx) => {
  if (line.includes("from('") || line.includes('from("')) {
    console.log(`${idx + 1}: ${line.trim()}`);
  }
});
