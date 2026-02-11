const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase credentials in .env.local');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function importYubikeys() {
    const csvFilePath = path.join(__dirname, '..', 'Yubikey_Inventory_FINAL.csv');

    if (!fs.existsSync(csvFilePath)) {
        console.error(`File not found: ${csvFilePath}`);
        process.exit(1);
    }

    console.log(`Reading CSV file from: ${csvFilePath}`);
    const fileContent = fs.readFileSync(csvFilePath, 'utf-8');

    // Parse CSV (Semicolon delimited)
    const lines = fileContent.split('\n');
    const headers = lines[0].trim().split(';');

    console.log(`Found headers: ${headers.join(', ')}`);

    const records = [];
    let skipped = 0;

    for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        const values = line.split(';');

        // Map CSV columns to Table columns
        // CSV: Type;Serial_SSO;User;Status
        if (values.length >= 4) {
            const record = {
                type: values[0].trim(),
                serial: values[1].trim(),
                assignee: values[2].trim(),
                status: values[3].trim(),
                created_at: new Date().toISOString()
            };

            // Basic validation
            if (record.serial) {
                records.push(record);
            } else {
                skipped++;
            }
        } else {
            skipped++;
        }
    }

    console.log(`Parsed ${records.length} valid records. Skipped ${skipped} empty/invalid lines.`);

    if (records.length === 0) {
        console.log('No records to import.');
        return;
    }

    // Insert in batches
    const BATCH_SIZE = 100;
    let insertedCount = 0;
    let errorCount = 0;

    for (let i = 0; i < records.length; i += BATCH_SIZE) {
        const batch = records.slice(i, i + BATCH_SIZE);
        console.log(`Importing batch ${i / BATCH_SIZE + 1}... (${batch.length} items)`);

        const { error } = await supabase.from('yubikeys').upsert(batch, { onConflict: 'serial' });

        if (error) {
            console.error('Error importing batch:', error);
            errorCount += batch.length;
        } else {
            insertedCount += batch.length;
        }
    }

    console.log('-----------------------------------');
    console.log(`Import Complete.`);
    console.log(`Successfully inserted/updated: ${insertedCount}`);
    console.log(`Errors: ${errorCount}`);
}

importYubikeys();
