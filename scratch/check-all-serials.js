const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://snbuluotryqjuttbeqfr.supabase.co';
const supabaseAnonKey = 'sb_publishable_M2Pz-9fUVXda2hoaQw5J0A_SmWkKsgN';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function checkAll() {
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
    .select('id, name, serial');
    
  if (assetsError) {
    console.error("Assets fetch error:", assetsError);
    return;
  }

  console.log(`Checking ${assets.length} assets...`);
  let problemCount = 0;
  assets.forEach(a => {
    if (a.serial === null || a.serial === undefined) {
      console.log(`Asset ${a.id} (${a.name}) has null/undefined serial!`);
      problemCount++;
    } else if (typeof a.serial !== 'string') {
      console.log(`Asset ${a.id} (${a.name}) has non-string serial:`, typeof a.serial);
      problemCount++;
    } else if (a.serial.trim() === '') {
      console.log(`Asset ${a.id} (${a.name}) has empty serial!`);
      problemCount++;
    }
  });

  console.log(`Finished check. Problems found: ${problemCount}`);
}

checkAll();
