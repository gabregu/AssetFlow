const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://snbuluotryqjuttbeqfr.supabase.co',
  'sb_publishable_M2Pz-9fUVXda2hoaQw5J0A_SmWkKsgN'
);

async function test() {
  const { data, error } = await supabase.from('tickets').select('id, subject, requester, status').limit(50);
  if (error) {
    console.error("Error:", error);
    return;
  }
  console.log("Tickets:");
  data.forEach(t => {
    console.log(`ID: ${t.id} | Subject: ${t.subject} | Requester: ${t.requester} | Status: ${t.status}`);
  });
}

test();
