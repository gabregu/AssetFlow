const { createClient } = require('@supabase/supabase-js');
const supabase = createClient('https://snbuluotryqjuttbeqfr.supabase.co', 'sb_publishable_M2Pz-9fUVXda2hoaQw5J0A_SmWkKsgN');

async function run() {
  const { data: tickets } = await supabase.from('tickets').select('id, requester, status, logistics, subject');
  const active = tickets.filter(t => t.status !== 'Resuelto' && t.status !== 'Cerrado' && t.status !== 'Servicio Facturado' && t.status !== 'Caso SFDC Cerrado');
  console.log('ACTIVE TICKETS:', JSON.stringify(active.map(t => ({id: t.id, req: t.requester, sub: t.subject})), null, 2));
}
run();
