const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = 'https://snbuluotryqjuttbeqfr.supabase.co';
const supabaseAnonKey = 'sb_publishable_M2Pz-9fUVXda2hoaQw5J0A_SmWkKsgN';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function check() {
  await supabase.auth.signInWithPassword({
    email: 'verifier_1780004069965@yawi.ar',
    password: 'VerificationPassword123!'
  });

  const { data: tickets, error: ticketError } = await supabase
    .from('tickets')
    .select('*')
    .ilike('subject', '%Catalina%');

  if (ticketError) {
    console.error("Ticket error:", ticketError);
    return;
  }
  console.log("Tickets found:", JSON.stringify(tickets, null, 2));

  for (const ticket of tickets) {
    const { data: tasks, error: tasksError } = await supabase
      .from('logistics_tasks')
      .select('*')
      .eq('ticket_id', ticket.id);

    console.log(`\nTasks for ticket ${ticket.id} (${ticket.subject}):`, JSON.stringify(tasks, null, 2));
  }
}
check();
