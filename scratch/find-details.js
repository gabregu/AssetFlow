const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://snbuluotryqjuttbeqfr.supabase.co',
  'sb_publishable_M2Pz-9fUVXda2hoaQw5J0A_SmWkKsgN'
);

async function run() {
  const { error: authError } = await supabase.auth.signInWithPassword({
    email: 'verifier_1780004069965@yawi.ar',
    password: 'VerificationPassword123!'
  });

  if (authError) {
    console.error('Auth error:', authError);
    return;
  }

  // Fetch all tasks and tickets
  const { data: tickets } = await supabase.from('tickets').select('*');
  const { data: tasks } = await supabase.from('logistics_tasks').select('*');

  console.log("=== CHECKING FACUNDO SANTINI TASKS DELIVERED ON 2026-06-02 ===");
  const facundoTasksToday = tasks.filter(t => 
    (t.delivery_person === 'Facundo Santini' || t.assigned_to === 'Facundo Santini') &&
    t.status === 'Entregado' &&
    t.updated_at?.startsWith('2026-06-02')
  );

  facundoTasksToday.forEach(task => {
    const parentTicket = tickets.find(t => String(t.id) === String(task.ticket_id || task.ticketId));
    console.log(`\nLogistics Task: ${task.id}`);
    console.log(`  Subject: ${task.subject}`);
    console.log(`  Case#: ${task.case_number}`);
    console.log(`  Status: ${task.status}`);
    console.log(`  Driver: ${task.delivery_person}`);
    console.log(`  UpdatedAt: ${task.updated_at}`);
    
    if (parentTicket) {
      console.log(`  Parent Ticket: ${parentTicket.id}`);
      console.log(`    Subject: ${parentTicket.subject}`);
      console.log(`    Status: ${parentTicket.status}`);
      console.log(`    Date: ${parentTicket.date}`);
      console.log(`    Completed Date: ${parentTicket.deliveryCompletedDate}`);
      console.log(`    Client: ${parentTicket.client}`);
    } else {
      console.log(`  Parent Ticket NOT FOUND!`);
    }
  });
}

run();
