const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://snbuluotryqjuttbeqfr.supabase.co';
const supabaseAnonKey = 'sb_publishable_M2Pz-9fUVXda2hoaQw5J0A_SmWkKsgN';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testFK() {
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email: 'verifier_1780004069965@yawi.ar',
    password: 'VerificationPassword123!'
  });
  
  if (authError) {
    console.error("Auth error:", authError);
    return;
  }

  // Find asset AST-5079 (YDCXW03R6D)
  console.log("Trying to update asset with sfdc_case = 'CAS-1199'...");
  const { data: res1, error: err1 } = await supabase
    .from('assets')
    .update({ sfdc_case: 'CAS-1199' })
    .eq('id', 'AST-5079');
    
  if (err1) {
    console.error("Update with 'CAS-1199' FAILED:", err1.message, err1.code);
  } else {
    console.log("Update with 'CAS-1199' SUCCESSFUL!");
  }

  console.log("\nTrying to update asset with sfdc_case = '00517441'...");
  const { data: res2, error: err2 } = await supabase
    .from('assets')
    .update({ sfdc_case: '00517441' })
    .eq('id', 'AST-5079');
    
  if (err2) {
    console.error("Update with '00517441' FAILED:", err2.message, err2.code);
  } else {
    console.log("Update with '00517441' SUCCESSFUL!");
  }
}

testFK();
