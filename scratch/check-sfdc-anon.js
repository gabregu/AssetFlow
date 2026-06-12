const { createClient } = require('@supabase/supabase-js');
const supabase = createClient('https://snbuluotryqjuttbeqfr.supabase.co', 'sb_publishable_M2Pz-9fUVXda2hoaQw5J0A_SmWkKsgN');

async function run() {
  const { data: tasks, error: e1 } = await supabase.from('logistics_tasks').select('*').limit(20);
  if (e1) {
    console.error('Error logistics_tasks:', e1);
  } else {
    console.log(`Fetched ${tasks.length} tasks:`);
    tasks.forEach(t => {
      console.log('Task:', t.id, t.ticket_id, t.status, t.created_at, t.updated_at);
    });
  }

  const { data: deliveries, error: e2 } = await supabase.from('deliveries').select('*').limit(20);
  if (e2) {
    console.error('Error deliveries:', e2);
  } else {
    console.log(`Fetched ${deliveries.length} deliveries:`);
  }
}
run();
