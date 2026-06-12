const { createClient } = require('@supabase/supabase-js');
const supabase = createClient('https://snbuluotryqjuttbeqfr.supabase.co', 'sb_publishable_M2Pz-9fUVXda2hoaQw5J0A_SmWkKsgN');

async function run() {
  const { data: tickets } = await supabase.from('tickets').select('id, requester, status');
  console.log('ALL TICKETS:', JSON.stringify(tickets, null, 2));
}
run();
