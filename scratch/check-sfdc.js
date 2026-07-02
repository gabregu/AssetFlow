const { createClient } = require('@supabase/supabase-js');
const supabase = createClient('https://snbuluotryqjuttbeqfr.supabase.co', 'sb_publishable_M2Pz-9fUVXda2hoaQw5J0A_SmWkKsgN');

async function run() {
  const { data: cases } = await supabase.from('sfdc_cases').select('*');
  const normalize = (str) => (str||'').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const found = cases.filter(c => normalize(c.requester).includes('agustin') || normalize(c.requester).includes('gaiza'));
  console.log('FOUND SFDC CASES:', JSON.stringify(found, null, 2));
}
run();
