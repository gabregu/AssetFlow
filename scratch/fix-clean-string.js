const fs = require('fs');
const path = require('path');

function walk(dir, callback) {
    fs.readdirSync(dir).forEach(f => {
        let dirPath = path.join(dir, f);
        if (fs.statSync(dirPath).isDirectory()) {
            if (!dirPath.includes('node_modules') && !dirPath.includes('.next')) {
                walk(dirPath, callback);
            }
        } else {
            if (f.endsWith('.js') || f.endsWith('.jsx')) {
                callback(dirPath);
            }
        }
    });
}

let count = 0;
walk('./app', processFile);
walk('./lib', processFile);

function processFile(filePath) {
    let content = fs.readFileSync(filePath, 'utf8');
    const target = /(const (cleanString|clean) = \(str\) => typeof str === 'string'\s*\?\s*str\.trim\(\)\.replace\(\/\[\\r\\n\\t\\0\]\+\/g,\s*' '\)\s*:\s*)str;/g;
    
    if (target.test(content)) {
        let newContent = content.replace(target, "$1String(str || '');");
        if (content !== newContent) {
            fs.writeFileSync(filePath, newContent, 'utf8');
            count++;
            console.log('Fixed in: ' + filePath);
        }
    }
}
console.log('Total files fixed: ' + count);
