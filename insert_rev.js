const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
    console.log('Inserting REV-1 to REV-40...');
    const locations = [];
    for (let i = 1; i <= 40; i++) {
        locations.push({
            id: `REV-${i}`,
            aisle: 'REVISION',
            country: 'Argentina' // Defaulting to Argentina for now
        });
    }

    const { data, error } = await supabase
        .from('warehouse_locations')
        .upsert(locations, { onConflict: 'id' });

    if (error) {
        console.error('Error inserting locations:', error);
    } else {
        console.log('Successfully inserted REV locations!');
    }
}

main();
