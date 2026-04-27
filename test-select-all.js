const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://snbuluotryqjuttbeqfr.supabase.co',
  'sb_publishable_M2Pz-9fUVXda2hoaQw5J0A_SmWkKsgN'
);

async function test() {
  const { data, error } = await supabase.from('consumables').select('*').limit(1);
  console.log("Data:", data);
  console.log("Error:", error);
}

test();
