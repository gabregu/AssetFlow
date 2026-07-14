const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
const env = fs.readFileSync(path.join(__dirname, '.env.local'), 'utf-8');
const matchUrl = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/);
const matchKey = env.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.*)/);
const supabaseUrl = matchUrl[1].trim();
const supabaseKey = matchKey[1].trim();
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
    const { data, error } = await supabase.from('assets').select('*').eq('serial', '123456');
    console.log(JSON.stringify(data, null, 2));
}
run();
