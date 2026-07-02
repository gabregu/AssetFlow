const { createClient } = require('@supabase/supabase-js');
const supabase = createClient('https://snbuluotryqjuttbeqfr.supabase.co', 'sb_publishable_M2Pz-9fUVXda2hoaQw5J0A_SmWkKsgN');

async function run() {
  const { data: deliveries, error: e3 } = await supabase.from('deliveries').select('*');
  if (e3) console.error(e3);
  console.log('ALL DELIVERIES:', deliveries);
}
run();
