const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://snbuluotryqjuttbeqfr.supabase.co';
const supabaseAnonKey = 'sb_publishable_M2Pz-9fUVXda2hoaQw5J0A_SmWkKsgN';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function checkValues() {
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email: 'verifier_1780004069965@yawi.ar',
    password: 'VerificationPassword123!'
  });
  
  if (authError) {
    console.error("Auth error:", authError);
    return;
  }

  const { data: assets, error: assetsError } = await supabase
    .from('assets')
    .select('id, name, serial, sfdc_case')
    .not('sfdc_case', 'is', null)
    .neq('sfdc_case', '');
    
  if (assetsError) {
    console.error("Assets fetch error:", assetsError);
    return;
  }

  console.log(`Found ${assets.length} assets with non-empty sfdc_case:`);
  assets.slice(0, 20).forEach(a => {
    console.log(`- Asset: ${a.id}, Serial: ${a.serial}, Name: ${a.name}, sfdc_case: "${a.sfdc_case}"`);
  });
}

checkValues();
