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

  console.log("Logged in successfully. Querying asset YDCXW03R6D...");
  
  // 1. Query the asset
  const { data: assets, error: assetError } = await supabase
    .from('assets')
    .select('*')
    .eq('serial', 'YDCXW03R6D');
    
  if (assetError) {
    console.error("Asset query error:", assetError);
  } else {
    console.log("Asset found:", JSON.stringify(assets, null, 2));
  }

  // 2. Query any log/task related to Catalina Sanchez
  console.log("\nQuerying tasks for Catalina Sanchez...");
  const { data: tasks, error: tasksError } = await supabase
    .from('logistics_tasks')
    .select('*')
    .ilike('subject', '%Catalina Sanchez%');
    
  if (tasksError) {
    console.error("Tasks query error:", tasksError);
  } else {
    console.log("Tasks found:", JSON.stringify(tasks, null, 2));
  }
  
  // 3. Query parent ticket if we can find it
  if (tasks && tasks.length > 0) {
    const ticketId = tasks[0].ticket_id;
    console.log(`\nQuerying parent ticket with ID: ${ticketId}`);
    const { data: ticket, error: ticketError } = await supabase
      .from('tickets')
      .select('*')
      .eq('id', ticketId);
      
    if (ticketError) {
      console.error("Ticket query error:", ticketError);
    } else {
      console.log("Ticket found:", JSON.stringify(ticket, null, 2));
    }
  }

  // 4. Check if there are any assets with null serial
  console.log("\nChecking for assets with null serials...");
  const { data: nullSerials, error: nullSerialsError } = await supabase
    .from('assets')
    .select('id, name')
    .is('serial', null);
  if (nullSerialsError) {
    console.error("Null serials query error:", nullSerialsError);
  } else {
    console.log(`Found ${nullSerials.length} assets with null serials:`, nullSerials);
  }
}

inspect();
