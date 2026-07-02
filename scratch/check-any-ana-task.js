const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = 'https://snbuluotryqjuttbeqfr.supabase.co';
const supabaseAnonKey = 'sb_publishable_M2Pz-9fUVXda2hoaQw5J0A_SmWkKsgN';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function check() {
  await supabase.auth.signInWithPassword({
    email: 'verifier_1780004069965@yawi.ar',
    password: 'VerificationPassword123!'
  });

  const caseNumbers = ['00520418', '00520419', '00520420'];
  const { data: tasks, error } = await supabase
    .from('logistics_tasks')
    .select('*')
    .in('case_number', caseNumbers);

  if (error) {
    console.error("Query error:", error);
  } else {
    console.log("Tasks found globally for Ana Pérez cases:", JSON.stringify(tasks, null, 2));
  }
}
check();
