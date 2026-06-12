const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://snbuluotryqjuttbeqfr.supabase.co',
  'sb_publishable_M2Pz-9fUVXda2hoaQw5J0A_SmWkKsgN'
);

async function run() {
  console.log("Signing in as admin@assetflow.com...");
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email: 'admin@assetflow.com',
    password: 'admin'
  });

  if (authError) {
    console.error("Auth error:", authError);
    return;
  }

  console.log("Auth success! Querying CAS-1099, CAS-1101, CAS-1095...");
  const { data: tickets, error: ticketsError } = await supabase
    .from('tickets')
    .select('*')
    .in('id', ['CAS-1099', 'CAS-1101', 'CAS-1095']);

  if (ticketsError) {
    console.error("Error fetching tickets:", ticketsError);
    return;
  }

  console.log(`Found ${tickets.length} tickets:`);
  tickets.forEach(t => {
    console.log('------------------------------');
    console.log('ID:', t.id);
    console.log('Subject:', t.subject);
    console.log('Status:', t.status);
    console.log('Date (Fecha Inicio/Creación):', t.date);
    console.log('delivery_completed_date (Fecha Fin / Entrega):', t.delivery_completed_date);
    console.log('closed_date (Fecha Cierre):', t.closed_date);
    console.log('created_at (Creación Registro):', t.created_at);
    console.log('metadata:', JSON.stringify(t.metadata, null, 2));
    console.log('logistics:', JSON.stringify(t.logistics, null, 2));
  });

  // Also query logistics tasks for these tickets
  console.log("\n5. Querying logistics tasks for these tickets...");
  const { data: tasks, error: tasksError } = await supabase
    .from('logistics_tasks')
    .select('*')
    .in('ticket_id', ['CAS-1099', 'CAS-1101', 'CAS-1095']);

  if (tasksError) {
    console.error("Error fetching logistics tasks:", tasksError);
  } else {
    console.log(`Found ${tasks.length} logistics tasks:`);
    tasks.forEach(task => {
      console.log('--- TASK:', task.id);
      console.log('Ticket ID:', task.ticket_id);
      console.log('Case Number:', task.case_number);
      console.log('Subject:', task.subject);
      console.log('Status:', task.status);
      console.log('created_at:', task.created_at);
      console.log('updated_at:', task.updated_at);
    });
  }
}

run();
