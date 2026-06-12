const fs = require('fs');
const path = require('path');
const dir = 'scratch';
fs.readdirSync(dir).forEach(file => {
  const filePath = path.join(dir, file);
  if (fs.statSync(filePath).isFile() && file.endsWith('.js')) {
    const content = fs.readFileSync(filePath, 'utf8');
    if (content.includes('signIn') || content.includes('auth')) {
      console.log(`File ${file} has auth/signIn:`);
      const lines = content.split('\n');
      lines.forEach((line, idx) => {
        if (line.includes('email') || line.includes('password') || line.includes('signIn')) {
          console.log(`  ${idx+1}: ${line.trim()}`);
        }
      });
    }
  }
});
