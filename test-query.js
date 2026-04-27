const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://snbuluotryqjuttbeqfr.supabase.co',
  'sb_publishable_M2Pz-9fUVXda2hoaQw5J0A_SmWkKsgN'
);

async function test() {
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email: 'admin@assetflow.com',
    password: 'admin' // Guessed
  });
  
  if (authError) {
    console.log("Auth error:", authError);
    return;
  }

  // Unfortunately information_schema is usually blocked by PostgREST.
  // But we can try querying a row to see its keys.
  const { data, error } = await supabase.from('consumables').select('*').limit(1);
  if (error) {
    console.log("Select Error:", error);
  } else {
    console.log("Row keys:", Object.keys(data[0] || {}));
    console.log("Row data:", data[0]);
  }
}

test();
