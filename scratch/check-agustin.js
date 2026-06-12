const { createClient } = require('@supabase/supabase-js');
const supabase = createClient('https://snbuluotryqjuttbeqfr.supabase.co', 'sb_publishable_M2Pz-9fUVXda2hoaQw5J0A_SmWkKsgN');

async function run() {
  const { data: tickets, error: e1 } = await supabase.from('tickets').select('id, requester, status, delivery_status, date, client').ilike('requester', '%agustin%');
  if (e1) console.error(e1);
  console.log('TICKETS:', tickets);

  const { data: tasks, error: e2 } = await supabase.from('logistics_tasks').select('*').ilike('subject', '%agustin%');
  if (e2) console.error(e2);
  console.log('TASKS (by subject):', tasks);

  const { data: deliveries, error: e3 } = await supabase.from('deliveries').select('*').ilike('recipient', '%agustin%');
  if (e3) console.error(e3);
  console.log('DELIVERIES:', deliveries);
}
run();
