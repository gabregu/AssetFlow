const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://snbuluotryqjuttbeqfr.supabase.co',
  'sb_publishable_M2Pz-9fUVXda2hoaQw5J0A_SmWkKsgN'
);

async function inspect() {
  console.log("Signing in with verifier account...");
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email: 'verifier_1780004069965@yawi.ar',
    password: 'VerificationPassword123!'
  });
  
  if (authError) {
    console.error("Auth error:", authError);
    return;
  }
  console.log("Logged in successfully as verifier");

  console.log("Fetching all assets...");
  const { data: assets, error: assetsError } = await supabase.from('assets').select('id, serial, name, type, assignee, status');
  if (assetsError) {
    console.error("Error fetching assets:", assetsError);
    return;
  }
  
  console.log(`Total assets found: ${assets.length}`);
  
  const nullOrEmptySerials = assets.filter(a => !a.serial || a.serial.trim() === '');
  console.log(`Assets with null or empty serials: ${nullOrEmptySerials.length}`);
  if (nullOrEmptySerials.length > 0) {
    console.log("Examples of assets with null/empty serials (first 10):");
    console.log(nullOrEmptySerials.slice(0, 10));
  }

  console.log("\nFetching active logistics tasks (En Transito)...");
  const { data: tasks, error: tasksError } = await supabase.from('logistics_tasks').select('id, case_number, status, assets, ticket_id').eq('status', 'En Transito');
  if (tasksError) {
    console.error("Error fetching logistics tasks:", tasksError);
    return;
  }
  console.log(`Active logistics tasks: ${tasks.length}`);
  tasks.forEach(t => {
    console.log(`Task ID: ${t.id}, Case: ${t.case_number}, Ticket: ${t.ticket_id}, Assets:`, JSON.stringify(t.assets));
  });
}

inspect();
