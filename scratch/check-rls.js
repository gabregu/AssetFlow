const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = 'https://snbuluotryqjuttbeqfr.supabase.co';
const supabaseAnonKey = 'sb_publishable_M2Pz-9fUVXda2hoaQw5J0A_SmWkKsgN';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function checkRLS() {
  await supabase.auth.signInWithPassword({
    email: 'verifier_1780004069965@yawi.ar',
    password: 'VerificationPassword123!'
  });

  const { data, error } = await supabase.rpc('execute_sql', {
    sql_query: "SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check FROM pg_policies WHERE tablename = 'logistics_tasks'"
  });

  if (error) {
    // If execute_sql RPC doesn't exist, try querying a view or direct SQL if possible
    console.error("RPC error:", error);
    
    // Fallback: Let's try executing arbitrary SQL using a simple query if we can
    const { data: rawData, error: rawError } = await supabase
      .from('logistics_tasks')
      .select('count');
    console.log("Fallback count check:", rawData, rawError);
  } else {
    console.log("RLS Policies for logistics_tasks:", JSON.stringify(data, null, 2));
  }
}
checkRLS();
