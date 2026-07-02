const { createClient } = require('@supabase/supabase-js');
const supabase = createClient('https://snbuluotryqjuttbeqfr.supabase.co', 'sb_publishable_M2Pz-9fUVXda2hoaQw5J0A_SmWkKsgN');

async function run() {
  // Find tickets created or updated today
  const today = new Date();
  today.setHours(0,0,0,0);
  const { data: tickets, error: e1 } = await supabase.from('tickets').select('id, requester, status, delivery_status').gt('updated_at', today.toISOString());
  if (e1) console.error(e1);
  console.log('RECENT TICKETS:', tickets);

  const { data: tasks, error: e2 } = await supabase.from('logistics_tasks').select('*').gt('updated_at', today.toISOString());
  if (e2) console.error(e2);
  console.log('RECENT TASKS:', tasks);

  const { data: deliveries, error: e3 } = await supabase.from('deliveries').select('*').gt('created_at', today.toISOString());
  if (e3) console.error(e3);
  console.log('RECENT DELIVERIES:', deliveries);
}
run();
