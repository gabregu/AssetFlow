const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '..', '.env.local');
const newKey = 'sb_publishable_M2Pz-9fUVXda2hoaQw5J0A_SmWkKsgN';

try {
    let content = fs.readFileSync(envPath, 'utf8');
    const lines = content.split('\n');
    let updated = false;

    const newLines = lines.map(line => {
        if (line.trim().startsWith('NEXT_PUBLIC_SUPABASE_ANON_KEY=')) {
            updated = true;
            return `NEXT_PUBLIC_SUPABASE_ANON_KEY=${newKey}`;
        }
        return line;
    });

    if (!updated) {
        newLines.push(`NEXT_PUBLIC_SUPABASE_ANON_KEY=${newKey}`);
    }

    fs.writeFileSync(envPath, newLines.join('\n'));
    console.log('SUCCESS: .env.local updated with new key.');
} catch (e) {
    console.error('ERROR updating .env.local:', e.message);
    process.exit(1);
}
