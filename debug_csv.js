const fs = require('fs');

const filePath = 'c:\\Users\\guill\\OneDrive\\Documents\\Antigravity-APP\\AssetFlow\\report1770909540013.csv';

try {
    let text = fs.readFileSync(filePath, 'utf8');

    console.log('--- RAW START ---');
    console.log(text.substring(0, 500));
    console.log('--- RAW END ---');

    if (text.includes('"Mailing Country"wner Alias"')) {
        console.log('APPLYING FIX...');
        text = text.replace('"Mailing Country"wner Alias"', '"Mailing Country","Case Owner Alias"');
    }

    // Manual parser similar to page.js to verify behavior
    const parseCSV = (str) => {
        const arr = [];
        let quote = false;
        let col = 0;
        let row = 0;
        let c = 0;
        let val = '';

        for (; c < str.length; c++) {
            const cc = str[c];
            const nc = str[c + 1];

            if (cc === '"') {
                if (quote && nc === '"') {
                    val += '"';
                    c++;
                } else {
                    quote = !quote;
                }
            } else if (cc === ',' && !quote) {
                if (!arr[row]) arr[row] = [];
                arr[row][col] = val;
                val = '';
                col++;
            } else if ((cc === '\r' || cc === '\n') && !quote) {
                if (cc === '\r' && nc === '\n') c++;
                if (!arr[row]) arr[row] = [];
                arr[row][col] = val;
                val = '';
                row++;
                col = 0;
            } else {
                val += cc;
            }
        }
        if (val || (arr[row] && arr[row].length > 0)) {
            if (!arr[row]) arr[row] = [];
            arr[row][col] = val;
        }
        return arr;
    };

    const data = parseCSV(text);
    console.log(`Parsed ${data.length} rows`);

    if (data.length > 0) {
        const headers = data[0].map(h => h.trim().replace(/^"|"$/g, ''));
        console.log('HEADERS:', headers);
        const countryIndex = headers.indexOf('Mailing Country');
        console.log('Mailing Country Index:', countryIndex);

        if (countryIndex === -1) {
            console.log('CRITICAL: Mailing Country header NOT FOUND');
        } else {
            let missingCount = 0;
            data.slice(1).forEach((row, idx) => {
                const val = row[countryIndex];
                if (!val || val.trim() === '') {
                    console.log(`Row ${idx + 2} MISSING COUNTRY. Raw row length: ${row.length}`);
                    missingCount++;
                }
            });
            if (missingCount === 0) console.log('ALL ROWS HAVE COUNTRY!');
            else console.log(`TOTAL MISSING: ${missingCount}`);
        }
    }

} catch (err) {
    console.error(err);
}
