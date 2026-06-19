const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://snbuluotryqjuttbeqfr.supabase.co',
  'sb_publishable_M2Pz-9fUVXda2hoaQw5J0A_SmWkKsgN'
);

async function listUsers() {
  const { data, error } = await supabase.from('users').select('id, name, email, role');
  if (error) {
    console.log("Error fetching users:", error);
  } else {
    console.log("Users:", JSON.stringify(data, null, 2));
  }
}

listUsers();
