const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Read env variables from .env.local
const envPath = path.join(__dirname, '..', '.env.local');
let supabaseUrl = '';
let supabaseKey = '';

if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    const lines = envContent.split('\n');
    lines.forEach(line => {
        const parts = line.split('=');
        if (parts[0] && parts[0].trim() === 'NEXT_PUBLIC_SUPABASE_URL') {
            supabaseUrl = parts[1].trim().replace(/['\"]/g, '');
        }
        if (parts[0] && parts[0].trim() === 'NEXT_PUBLIC_SUPABASE_ANON_KEY') {
            supabaseKey = parts[1].trim().replace(/['\"]/g, '');
        }
    });
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
    const { data, error } = await supabase.from('users').select('*');
    if (error) {
        console.error("Error fetching users:", error);
    } else {
        console.log("All users in DB:");
        data.forEach(u => {
            console.log(`- ID: ${u.id}, Name: ${u.name}, Email: ${u.email}, Role: ${u.role}, Username: ${u.username}`);
        });
    }
}
run();
