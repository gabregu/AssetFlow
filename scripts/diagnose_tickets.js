
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://snbuluotryqjuttbeqfr.supabase.co';
const supabaseKey = 'sb_publishable_M2Pz-9fUVXda2hoaQw5J0A_SmWkKsgN';
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkTickets() {
    console.log("Consultando users...");

    const { data, error } = await supabase
        .from('users')
        .select('id, name, email');

    if (error) {
        console.error("Error:", error);
        return;
    }

    console.log(`Total users en DB: ${data.length}`);
    data.forEach(u => console.log(`- ${u.name} (${u.email})`));
}

checkTickets();
