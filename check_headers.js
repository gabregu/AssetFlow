const fs = require('fs');
const files = [
    'c:\\Users\\guill\\OneDrive\\Documents\\Antigravity-APP\\AssetFlow\\report1770909540013.csv',
    'c:\\Users\\guill\\OneDrive\\Documents\\Antigravity-APP\\AssetFlow\\report1770909665695.csv'
];

files.forEach(file => {
    try {
        const content = fs.readFileSync(file, 'utf8');
        // Get first line, handle \r\n or \n
        const firstLine = content.split(/\r?\n/)[0];
        console.log(`\n--- HEADERS FOR ${file.split('\\').pop()} ---`);
        console.log(firstLine);

        // Parse headers to see them clearly
        // Simple split by comma, ignoring quotes for a quick check (not perfect but good enough for headers usually)
        // actually better to just regex match
        const headers = firstLine.match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g) || [];
        // console.log('Parsed Tokens:', headers);
    } catch (err) {
        console.error(`Error reading ${file}:`, err.message);
    }
});
