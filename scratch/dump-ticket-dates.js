const { createClient } = require('@supabase/supabase-js');
const supabase = createClient('https://snbuluotryqjuttbeqfr.supabase.co', 'sb_publishable_M2Pz-9fUVXda2hoaQw5J0A_SmWkKsgN');

async function run() {
  const { data: tickets, error } = await supabase
    .from('tickets')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(10);
  
  if (error) {
    console.error('Error fetching tickets:', error);
    return;
  }

  console.log(`Fetched ${tickets.length} recent tickets:`);
  tickets.forEach(t => {
    console.log('--- TICKET:', t.id, typeof t.id);
    console.log('Subject:', t.subject);
    console.log('Status:', t.status);
    console.log('Date:', t.date);
    console.log('delivery_completed_date:', t.delivery_completed_date);
    console.log('closed_date:', t.closed_date);
    console.log('created_at:', t.created_at);
  });
}
run();
