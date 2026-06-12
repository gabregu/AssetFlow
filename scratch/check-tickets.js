const { createClient } = require('@supabase/supabase-js');
const supabase = createClient('https://snbuluotryqjuttbeqfr.supabase.co', 'sb_publishable_M2Pz-9fUVXda2hoaQw5J0A_SmWkKsgN');

async function run() {
  const { data, error } = await supabase.from('tickets').select('*').in('status', ['Abierto', 'En Progreso']);
  if (error) console.error(error);
  else {
    console.log(`Found ${data.length} open tickets.`);
    if (data.length > 0) {
        console.log(JSON.stringify(data.slice(0, 5), null, 2));
    }
  }
}
run();
