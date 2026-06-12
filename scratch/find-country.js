const fs = require('fs');
const path = require('path');

function search(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (file === 'node_modules' || file === '.next' || file === '.git') continue;
    
    let stats;
    try {
      stats = fs.statSync(fullPath);
    } catch (e) {
      continue;
    }
    
    if (stats.isDirectory()) {
      search(fullPath);
    } else if (stats.isFile() && (file.endsWith('.js') || file.endsWith('.jsx'))) {
      try {
        const content = fs.readFileSync(fullPath, 'utf8');
        if (content.includes('countryFilter') || content.includes('setCountryFilter')) {
          console.log(`Found in: ${fullPath}`);
          const lines = content.split('\n');
          lines.forEach((line, idx) => {
            if (line.includes('countryFilter') || line.includes('setCountryFilter')) {
              console.log(`  L${idx+1}: ${line.trim()}`);
            }
          });
        }
      } catch (e) {}
    }
  }
}

search('c:\\Users\\guill\\OneDrive\\Documents\\Antigravity-APP\\AssetFlow');
