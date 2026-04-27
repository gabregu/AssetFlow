const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://snbuluotryqjuttbeqfr.supabase.co';
const supabaseAnonKey = 'sb_publishable_M2Pz-9fUVXda2hoaQw5J0A_SmWkKsgN';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testFetch() {
    const { data: users, error: err1 } = await supabase.from('users').select('name').limit(5);
    console.log('Users:', users || err1);

    const { data: assets, error: err2 } = await supabase.from('assets').select('serial').limit(5);
    console.log('Assets:', assets || err2);
    
    // Check if table exists by trying a non-existent column
    const { error: err3 } = await supabase.from('assets').select('non_existent_column');
    console.log('Error on non-existent column (to verify table existence):', err3 ? err3.message : 'No error?');
}

testFetch();
