const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://snbuluotryqjuttbeqfr.supabase.co';
const supabaseAnonKey = 'sb_publishable_M2Pz-9fUVXda2hoaQw5J0A_SmWkKsgN';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function inspect() {
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email: 'verifier_1780004069965@yawi.ar',
    password: 'VerificationPassword123!'
  });
  
  if (authError) {
    console.error("Auth error:", authError);
    return;
  }

  // 1. Fetch ticket CAS-1201
  const { data: ticket, error: ticketError } = await supabase
    .from('tickets')
    .select('*')
    .eq('id', 'CAS-1201')
    .single();

  if (ticketError) {
    console.error("Ticket fetch error:", ticketError);
  } else {
    console.log("Ticket CAS-1201:", JSON.stringify(ticket, null, 2));
  }

  // 2. Fetch logistics tasks for CAS-1201
  const { data: tasks, error: tasksError } = await supabase
    .from('logistics_tasks')
    .select('*')
    .eq('ticket_id', 'CAS-1201');

  if (tasksError) {
    console.error("Tasks fetch error:", tasksError);
  } else {
    console.log(`\nLogistics Tasks for CAS-1201 (${tasks.length} found):`, JSON.stringify(tasks, null, 2));
  }

  // 3. Fetch SFDC Cases for Ana Perez
  const { data: sfdc, error: sfdcError } = await supabase
    .from('sfdc_cases')
    .select('*')
    .ilike('requested_for', '%Ana P%');

  if (sfdcError) {
    console.error("SFDC Cases fetch error:", sfdcError);
  } else {
    console.log("\nSFDC Cases for Ana Perez:", JSON.stringify(sfdc, null, 2));
  }
}

inspect();
