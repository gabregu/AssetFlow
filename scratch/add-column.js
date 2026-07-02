const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const { data, error } = await supabase.rpc('add_second_visit_column');
  if (error) {
    // If RPC doesn't exist, we can just use supabase query to add column but supabase js doesn't support raw SQL easily unless we use postgres connection.
    console.error('Error:', error);
  }
  console.log('Done');
}
run();
