const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = 'https://snbuluotryqjuttbeqfr.supabase.co';
const supabaseAnonKey = 'sb_publishable_M2Pz-9fUVXda2hoaQw5J0A_SmWkKsgN';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testUpdate() {
  await supabase.auth.signInWithPassword({
    email: 'verifier_1780004069965@yawi.ar',
    password: 'VerificationPassword123!'
  });

  // Fetch ticket CAS-1211 first
  const { data: tickets } = await supabase.from('tickets').select('*').eq('id', 'CAS-1211');
  const ticket = tickets[0];

  const currentCases = ticket.associated_assets || [];
  console.log("Current associated_assets:", currentCases);

  // Filter out one case as done during promotion (e.g. 00520420)
  const caseNum = '00520420';
  const updatedCases = currentCases.filter(c => 
      String(c.caseNumber || c.case_number || '').trim() !== String(caseNum).trim()
  );

  console.log("Attempting to update ticket with associatedCases:", updatedCases);

  const dbUpdate = {
    associated_assets: updatedCases
  };

  const { data, error } = await supabase
    .from('tickets')
    .update(dbUpdate)
    .eq('id', 'CAS-1211')
    .select();

  if (error) {
    console.error("Ticket update failed:", error);
  } else {
    console.log("Ticket update succeeded:", JSON.stringify(data, null, 2));
    
    // Restore original associated_assets
    console.log("Restoring original associated_assets...");
    await supabase.from('tickets').update({ associated_assets: currentCases }).eq('id', 'CAS-1211');
  }
}

testUpdate();
