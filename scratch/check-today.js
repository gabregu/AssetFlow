const { createClient } = require('@supabase/supabase-js');
const supabase = createClient('https://snbuluotryqjuttbeqfr.supabase.co', 'sb_publishable_M2Pz-9fUVXda2hoaQw5J0A_SmWkKsgN');

async function run() {
  const { error: authError } = await supabase.auth.signInWithPassword({
    email: 'verifier_1780004069965@yawi.ar',
    password: 'VerificationPassword123!'
  });

  if (authError) {
    console.error('Auth error:', authError);
    return;
  }

  const { data: tickets, error } = await supabase
    .from('tickets')
    .select('id, status, date, created_at, delivery_completed_date')
    .in('status', ['Resuelto', 'Cerrado', 'Caso SFDC Cerrado', 'Servicio Facturado']);
    
  if (error) {
    console.error('Error fetching tickets:', error);
    return;
  }
  
  const nullCompleted = tickets.filter(t => !t.delivery_completed_date);
  console.log(`Total de tickets resueltos/cerrados: ${tickets.length}`);
  console.log(`Total de tickets antiguos sin fecha de entrega: ${nullCompleted.length}`);
  if (nullCompleted.length > 0) {
    console.log('Muestra de tickets antiguos sin fecha de entrega:');
    console.log(JSON.stringify(nullCompleted.slice(0, 10), null, 2));
  }
}
run();
