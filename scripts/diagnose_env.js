const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '..', '.env.local');

try {
    const envContent = fs.readFileSync(envPath, 'utf8');
    const lines = envContent.split('\n');

    console.log("--- DIAGNOSTIC RESULT ---");
    lines.forEach(line => {
        const [key, ...rest] = line.split('=');
        if (key && rest) {
            const value = rest.join('=').trim();
            let masked = value;
            if (value.length > 10) {
                masked = value.substring(0, 15) + '...' + value.substring(value.length - 5);
            }
            console.log(`${key.trim()}: ${masked}`);

            if (value.startsWith('sb_publishable')) {
                console.log(`[WARNING] ${key.trim()} looks like a Publishable Key (sb_publishable), not a standard Anon Key (JWT).`);
            }
            if (value.includes('google')) {
                console.log(`[WARNING] ${key.trim()} contains 'google'. This looks wrong for a Supabase config.`);
            }
            if (!value.startsWith('http') && key.includes('URL')) {
                console.log(`[WARNING] ${key.trim()} does not start with http/https.`);
            }
        }
    });
    console.log("--- END DIAGNOSTIC ---");
} catch (e) {
    console.error("Error reading .env.local:", e.message);
}
