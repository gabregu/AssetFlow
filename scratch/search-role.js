const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../app/dashboard/inventory/page.js');
const content = fs.readFileSync(filePath, 'utf8');

const lines = content.split('\n');
console.log("Searching for 'role' in app/dashboard/inventory/page.js...");
lines.forEach((line, idx) => {
    if (line.includes('role') || line.includes('currentUser') || line.includes('deleteAsset') || line.includes('clearInventory')) {
        console.log(`Line ${idx + 1}: ${line.trim()}`);
    }
});
