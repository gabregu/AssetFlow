const fs = require('fs');
const path = require('path');

const filesToSearch = [
    '../app/dashboard/page.js',
    '../app/dashboard/layout.js',
    '../app/dashboard/inventory/page.js'
];

filesToSearch.forEach(fileRelPath => {
    const filePath = path.join(__dirname, fileRelPath);
    if (!fs.existsSync(filePath)) {
        console.log(`File not found: ${fileRelPath}`);
        return;
    }
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n');
    console.log(`\nSearching for role checks in ${fileRelPath}...`);
    lines.forEach((line, idx) => {
        if (line.includes('role') || line.includes('redirect') || line.includes('push(') || line.includes('Administrativo')) {
            console.log(`Line ${idx + 1}: ${line.trim()}`);
        }
    });
});
