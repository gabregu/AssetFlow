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
    .ilike('subject', '%Ana Pérez%');

  console.log("Tickets for Ana Pérez:", tickets.map(t => ({ id: t.id, subject: t.subject })));

  const ticketIds = tickets.map(t => t.id);
  if (ticketIds.length > 0) {
    const { data: tasks, error: tasksError } = await supabase
      .from('logistics_tasks')
      .select('*')
      .in('ticket_id', ticketIds);

    console.log("\nLogistics tasks found:", JSON.stringify(tasks, null, 2));
  }
}
check();
