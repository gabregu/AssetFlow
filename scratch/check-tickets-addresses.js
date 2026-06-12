const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables from .env.local
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
    console.error("Missing environment variables");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function run() {
    const { data: tickets, error } = await supabase.from('tickets').select('id, subject, status, client, logistics');
    if (error) {
        console.error("Error fetching tickets:", error);
        return;
    }

    console.log(`Total tickets: ${tickets.length}`);
    tickets.forEach(t => {
        console.log(`- [${t.id}] Status: ${t.status}, Client: ${t.client}`);
        console.log(`  Subject: ${t.subject}`);
        console.log(`  Address: ${t.logistics?.address}`);
        console.log(`  Address length: ${t.logistics?.address?.length || 0}`);
    });
}

run();
