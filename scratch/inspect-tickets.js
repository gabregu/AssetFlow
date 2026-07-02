const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://snbuluotryqjuttbeqfr.supabase.co';
const supabaseAnonKey = 'sb_publishable_M2Pz-9fUVXda2hoaQw5J0A_SmWkKsgN';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function inspect() {
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email: 'verifier_1780004069965@yawi.ar',
    password: 'VerificationPassword123!'
  });
  
  if (authError) {
    console.error("Auth error:", authError);
    return;
  }

  console.log("Querying tickets related to Catalina...");
  const { data: tickets, error: ticketsError } = await supabase
    .from('tickets')
    .select('*')
    .ilike('subject', '%Catalina%');
    
  if (ticketsError) {
    console.error("Tickets query error:", ticketsError);
  } else {
    console.log("Tickets found:", JSON.stringify(tickets, null, 2));
  }
}

inspect();
