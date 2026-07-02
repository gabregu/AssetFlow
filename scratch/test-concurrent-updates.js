const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://snbuluotryqjuttbeqfr.supabase.co',
  'sb_publishable_M2Pz-9fUVXda2hoaQw5J0A_SmWkKsgN'
);

async function run() {
  console.log("Signing in with verifier account...");
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email: 'verifier_1780004069965@yawi.ar',
    password: 'VerificationPassword123!'
  });
  
  if (authError) {
    console.error("Auth error:", authError);
    return;
  }
  console.log("Signed in successfully.");

  const ticketId = 'CAS-1122';
  
  // Restore ticket to a clean state first
  console.log("Restoring ticket state...");
  await supabase.from('tickets').update({ status: 'En Transito', internal_notes: [] }).eq('id', ticketId);

  console.log("Firing two updates to CAS-1122 concurrently...");
  
  const update1 = supabase.from('tickets').update({
    internal_notes: [{ content: 'Conectando...', user: 'Test', date: new Date().toISOString() }]
  }).eq('id', ticketId);
  
  const update2 = supabase.from('tickets').update({
    status: 'Resuelto'
  }).eq('id', ticketId);

  console.log("Awaiting both updates via Promise.all...");
  try {
    const results = await Promise.all([update1, update2]);
    console.log("Update 1 result error:", results[0].error);
    console.log("Update 2 result error:", results[1].error);
    console.log("Both updates completed!");
  } catch (err) {
    console.error("Exception during concurrent updates:", err);
  }
}

run();
