const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://snbuluotryqjuttbeqfr.supabase.co',
  'sb_publishable_M2Pz-9fUVXda2hoaQw5J0A_SmWkKsgN'
);

async function checkUser() {
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email: 'verifier_1780004069965@yawi.ar',
    password: 'VerificationPassword123!'
  });
  
  if (authError) {
    console.error("Auth error:", authError);
    return;
  }

  const { data, error } = await supabase.from('users').select('*').eq('email', 'gabregu@yawi.ar').maybeSingle();
  if (error) {
    console.error("Error fetching gabregu:", error);
  } else {
    console.log("Guillermo Abregu profile:", data);
  }
}

checkUser();
