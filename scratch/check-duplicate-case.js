const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = 'https://snbuluotryqjuttbeqfr.supabase.co';
const supabaseAnonKey = 'sb_publishable_M2Pz-9fUVXda2hoaQw5J0A_SmWkKsgN';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function check() {
  await supabase.auth.signInWithPassword({
    email: 'verifier_1780004069965@yawi.ar',
    password: 'VerificationPassword123!'
  });

  const { data, error } = await supabase
    .from('logistics_tasks')
    .select('*')
    .eq('case_number', '00517441');

  if (error) {
    console.error("Query error:", error);
  } else {
    console.log("Tasks with case_number 00517441:", JSON.stringify(data, null, 2));
  }
}
check();
