const { createClient } = require('@supabase/supabase-js');
const supabase = createClient('https://snbuluotryqjuttbeqfr.supabase.co', 'sb_publishable_M2Pz-9fUVXda2hoaQw5J0A_SmWkKsgN');

async function run() {
  console.log("Attempting to update CAS-1099, CAS-1101, CAS-1095 anonymously...");
  const { data, error } = await supabase
    .from('tickets')
    .update({ delivery_completed_date: '2026-05-28' })
    .in('id', ['CAS-1099', 'CAS-1101', 'CAS-1095'])
    .select();

  if (error) {
    console.error('Error:', error);
  } else {
    console.log('Success! Updated rows:', data);
  }
}
run();
