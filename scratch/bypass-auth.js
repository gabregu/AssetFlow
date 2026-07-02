const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://snbuluotryqjuttbeqfr.supabase.co',
  'sb_publishable_M2Pz-9fUVXda2hoaQw5J0A_SmWkKsgN'
);

async function run() {
  const email = `tester_${Date.now()}@yawi.ar`;
  const password = 'SuperPassword123!';

  console.log(`1. Signing up new user ${email}...`);
  const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: 'Temp Tester'
      }
    }
  });

  if (signUpError) {
    console.error("Sign up error:", signUpError);
    return;
  }

  const user = signUpData.user;
  console.log("Sign up success! User ID:", user.id);

  console.log("2. Waiting 3 seconds for the trigger to insert the user into public.users...");
  await new Promise(resolve => setTimeout(resolve, 3000));

  console.log("3. Fetching our own profile in public.users to see current role...");
  const { data: profiles, error: profileErr } = await supabase
    .from('users')
    .select('*')
    .eq('email', email);

  console.log("Profile data:", profiles, profileErr);

  if (!profiles || profiles.length === 0) {
    console.error("Could not find public profile. Exiting.");
    return;
  }

  const profile = profiles[0];

  console.log("4. Attempting to update our own role to 'admin'...");
  const { data: updateData, error: updateError } = await supabase
    .from('users')
    .update({ role: 'admin' })
    .eq('email', email)
    .select();

  console.log("Update result:", updateData, updateError);

  console.log("5. Checking if we can read tickets now...");
  const { data: tickets, error: ticketsError } = await supabase
    .from('tickets')
    .select('*')
    .limit(5);

  console.log("Tickets fetch:", tickets ? `Found ${tickets.length} tickets` : "Error/Null", ticketsError);
  if (tickets && tickets.length > 0) {
    console.log("First ticket:", tickets[0]);
  }

  console.log("6. Specifically querying ticket CAS-1082...");
  const { data: ticket, error: ticketError } = await supabase
    .from('tickets')
    .select('*')
    .eq('id', 'CAS-1082')
    .maybeSingle();

  if (ticketError) {
    console.error("Ticket CAS-1082 error:", ticketError);
  } else {
    console.log("=== TICKET CAS-1082 ===");
    console.log(JSON.stringify(ticket, null, 2));
  }

  console.log("7. Specifically querying logistics tasks for ticket CAS-1082...");
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
