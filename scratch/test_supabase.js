const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://snbuluotryqjuttbeqfr.supabase.co';
const supabaseAnonKey = 'sb_publishable_M2Pz-9fUVXda2hoaQw5J0A_SmWkKsgN';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testFetch() {
    const { data, error } = await supabase
        .from('assets')
        .select('serial, assignee, status')
        .limit(5);

    if (error) {
        console.error('Error:', error.message);
        return;
    }

    console.log('Sample Assets:', data);

    const { data: specific, error: err2 } = await supabase
        .from('assets')
        .select('serial, assignee, status')
        .eq('serial', 'C34G6N9GQ3');

    if (err2) console.error('Error 2:', err2.message);
    console.log('Specific Asset C34G6N9GQ3:', specific);
}

testFetch();
