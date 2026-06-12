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

  const { data: ticket, error } = await supabase
    .from('tickets')
    .select('*')
    .eq('id', 'CAS-1083')
    .single();

  if (error) {
    console.error("Error:", error);
  } else {
    console.log("Raw CAS-1083:", ticket);
  }
}

run();
