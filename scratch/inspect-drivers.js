const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://snbuluotryqjuttbeqfr.supabase.co',
  'sb_publishable_M2Pz-9fUVXda2hoaQw5J0A_SmWkKsgN'
);

async function test() {
  const { data: tasks, error: err1 } = await supabase.from('logistics_tasks').select('id, delivery_person, status').limit(20);
  console.log("Tasks:", tasks);
  if (err1) console.error("Tasks Error:", err1);
}

test();
