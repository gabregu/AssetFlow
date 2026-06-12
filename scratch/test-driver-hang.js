const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://snbuluotryqjuttbeqfr.supabase.co',
  'sb_publishable_M2Pz-9fUVXda2hoaQw5J0A_SmWkKsgN'
);

async function run() {
  const email = `testdriver_${Date.now()}@yawi.ar`;
  const password = 'TestDriverPassword123!';

  console.log(`1. Creating test driver user: ${email}...`);
  const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { full_name: 'Test Driver' } }
  });

  if (signUpError) {
    console.error("Sign up error:", signUpError);
    return;
  }
  
  const uid = signUpData.user.id;
  console.log("Sign up success. User UID:", uid);

  console.log("Waiting 3 seconds for database trigger...");
  await new Promise(resolve => setTimeout(resolve, 3000));

  // Connect using verifier/admin to promote our role
  console.log("2. Signing in as verifier to promote user role...");
  const adminClient = createClient(
    'https://snbuluotryqjuttbeqfr.supabase.co',
    'sb_publishable_M2Pz-9fUVXda2hoaQw5J0A_SmWkKsgN'
  );
  const { error: adminAuthErr } = await adminClient.auth.signInWithPassword({
    email: 'verifier_1780004069965@yawi.ar',
    password: 'VerificationPassword123!'
  });
  if (adminAuthErr) {
    console.error("Admin sign in error:", adminAuthErr);
    return;
  }

  // Update role to 'admin' (same as Guillermo Abregu)
  console.log("Promoting user to 'admin' role...");
  const { error: promoteErr } = await adminClient
    .from('users')
    .update({ role: 'admin' })
    .eq('email', email);
  if (promoteErr) {
    console.error("Promotion error:", promoteErr);
    return;
  }
  console.log("User promoted to admin successfully.");

  // Sign out admin client
  await adminClient.auth.signOut();

  // Sign in as our newly created admin driver
  console.log(`3. Signing in as new admin driver: ${email}...`);
  const driverClient = createClient(
    'https://snbuluotryqjuttbeqfr.supabase.co',
    'sb_publishable_M2Pz-9fUVXda2hoaQw5J0A_SmWkKsgN'
  );
  const { error: driverAuthErr } = await driverClient.auth.signInWithPassword({
    email,
    password
  });
  if (driverAuthErr) {
    console.error("Driver sign in error:", driverAuthErr);
    return;
  }
  console.log("Signed in successfully as driver.");

  // Now, let's try to update the task CAS-1122-8529
  // (We'll change the status back to 'En Transito' first using admin client, then update to 'Entregado' using driver client)
  console.log("4. Restoring task status to 'En Transito' using admin client...");
  await adminClient.auth.signInWithPassword({
    email: 'verifier_1780004069965@yawi.ar',
    password: 'VerificationPassword123!'
  });
  await adminClient.from('logistics_tasks').update({ status: 'En Transito' }).eq('case_number', 'CAS-1122-8529');
  await adminClient.from('tickets').update({ status: 'En Transito' }).eq('id', 'CAS-1122');
  console.log("Task and ticket restored.");

  // Now perform the update as driver
  const taskId = 'f8f388e0-6742-406a-a97e-4b7ea8180558';
  console.log(`5. Attempting to update task ${taskId} as driver...`);
  const dbUpdate = {
    status: 'Entregado',
    delivery_info: {
      receivedBy: 'Test Recipient',
      dni: '12345678',
      notes: 'Driver test',
      deliveredAt: new Date().toISOString()
    },
    updated_at: new Date().toISOString()
  };

  try {
    console.log("Updating logistics_tasks table...");
    const { data: updateRes, error: updateErr } = await driverClient
      .from('logistics_tasks')
      .update(dbUpdate)
      .eq('id', taskId)
      .select();
    
    if (updateErr) {
      console.error("Task update error:", updateErr);
    } else {
      console.log("Task update success:", updateRes);
    }
  } catch (err) {
    console.error("Task update exception:", err);
  }

  // Now try to update ticket status
  console.log("6. Attempting to update parent ticket CAS-1122 to 'Resuelto' as driver...");
  try {
    const { data: ticketRes, error: ticketErr } = await driverClient
      .from('tickets')
      .update({ status: 'Resuelto' })
      .eq('id', 'CAS-1122')
      .select();
      
    if (ticketErr) {
      console.error("Ticket update error:", ticketErr);
    } else {
      console.log("Ticket update success:", ticketRes);
    }
  } catch (err) {
    console.error("Ticket update exception:", err);
  }

  console.log("All done!");
}

run();
