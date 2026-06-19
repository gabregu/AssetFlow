require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function main() {
  const { data, error } = await supabase.rpc('execute_sql', {
    query: "SELECT pg_get_functiondef('public.validate_ticket_update'::regproc);"
  });
  console.log(data || error);
}

main();
