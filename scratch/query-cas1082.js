const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://snbuluotryqjuttbeqfr.supabase.co',
  'sb_publishable_M2Pz-9fUVXda2hoaQw5J0A_SmWkKsgN'
);

async function run() {
  // Query ticket CAS-1082 directly without auth
  const { data: ticket, error: ticketError } = await supabase
    .from('tickets')
    .select('*')
    .eq('id', 'CAS-1082')
    .maybeSingle();

  if (ticketError) {
    console.error("Ticket error:", ticketError);
  } else {
    console.log("=== TICKET CAS-1082 ===");
    console.log(JSON.stringify(ticket, null, 2));
  }

  // Query logistics tasks for ticket CAS-1082
  const { data: tasks, error: tasksError } = await supabase
    .from('logistics_tasks')
    .select('*')
    .eq('ticket_id', 'CAS-1082');

  if (tasksError) {
    console.error("Tasks error:", tasksError);
  } else {
    console.log("=== LOGISTICS TASKS FOR CAS-1082 ===");
    console.log(JSON.stringify(tasks, null, 2));
  }
}

run();
