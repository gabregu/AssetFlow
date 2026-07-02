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
  
  const { data: assets, error } = await supabase
    .from('assets')
    .select('*')
    .in('sfdc_case', caseNumbers);

  if (error) {
    console.error("Query error:", error);
  } else {
    console.log("Assets linked to Ana Pérez cases:", JSON.stringify(assets, null, 2));
  }

  // Also query recently updated assets (last 30 minutes)
  const { data: recentAssets, error: recentError } = await supabase
    .from('assets')
    .select('id, serial, name, sfdc_case, date_last_update, notes')
    .order('date_last_update', { ascending: false })
    .limit(5);

  if (recentError) {
    console.error("Recent error:", recentError);
  } else {
    console.log("\nRecently updated assets:", JSON.stringify(recentAssets, null, 2));
  }
}
check();
