const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const supabaseUrl = 'https://snbuluotryqjuttbeqfr.supabase.co';
const supabaseAnonKey = 'sb_publishable_M2Pz-9fUVXda2hoaQw5J0A_SmWkKsgN';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function verifySerials() {
    try {
        const serials = fs.readFileSync('scratch/serials_to_verify.txt', 'utf8')
            .split('\n')
            .map(s => s.trim())
            .filter(s => s !== '');

        console.log(`Checking ${serials.length} serials...`);

        // Split serials into chunks of 100 to avoid long URLs
        const chunkSize = 100;
        let foundAssets = [];
        
        for (let i = 0; i < serials.length; i += chunkSize) {
            const chunk = serials.slice(i, i + chunkSize);
            const { data, error } = await supabase
                .from('assets')
                .select('serial, assignee, status')
                .in('serial', chunk);

            if (error) throw error;
            foundAssets = foundAssets.concat(data);
        }

        console.log(`Found ${foundAssets.length} assets.`);

        const notEnAlmacen = foundAssets.filter(a => a.assignee !== 'Almacén' && a.assignee !== 'En Almacén');
        const notFound = serials.filter(s => !foundAssets.find(a => a.serial === s));

        console.log('\n--- ASSETS NOT IN WAREHOUSE ---');
        notEnAlmacen.forEach(a => console.log(`${a.serial}: ${a.assignee} (${a.status})`));

        console.log('\n--- SERIALS NOT FOUND ---');
        notFound.forEach(s => console.log(s));

        // Generate report
        const report = {
            totalChecked: serials.length,
            found: foundAssets.length,
            inWarehouse: foundAssets.length - notEnAlmacen.length,
            notInWarehouse: notEnAlmacen.length,
            notFound: notFound.length,
            details: notEnAlmacen,
            missing: notFound
        };

        fs.writeFileSync('scratch/verification_results.json', JSON.stringify(report, null, 2));
        console.log('\nReport saved to scratch/verification_results.json');

    } catch (err) {
        console.error('Error:', err.message);
    }
}

verifySerials();
