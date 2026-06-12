const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://snbuluotryqjuttbeqfr.supabase.co',
  'sb_publishable_M2Pz-9fUVXda2hoaQw5J0A_SmWkKsgN'
);

async function run() {
  const { data: tickets, error } = await supabase
    .from('tickets')
    .select('id, subject, requester, status, client, delivery_status, logistics, associated_assets')
    .limit(50);

  if (error) {
    console.error("Error fetching tickets:", error);
  } else {
    console.log("=== LIST OF TICKETS ===");
    console.log(`Found ${tickets ? tickets.length : 0} tickets.`);
    tickets?.forEach(t => {
      console.log(`ID: ${t.id} | Subject: ${t.subject} | Client: ${t.client} | Status: ${t.status}`);
      console.log(`  Logistics:`, t.logistics);
      console.log(`  Associated Assets:`, t.associated_assets);
    });
  }
}

run();
