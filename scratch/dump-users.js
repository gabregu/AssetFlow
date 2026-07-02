const { createClient } = require('@supabase/supabase-js');
const supabase = createClient('https://snbuluotryqjuttbeqfr.supabase.co', 'sb_publishable_M2Pz-9fUVXda2hoaQw5J0A_SmWkKsgN');

async function run() {
  const { data: users, error } = await supabase.from('users').select('*').limit(20);
  if (error) {
    console.error('Error fetching users:', error);
    return;
  }
  console.log(`Fetched ${users.length} users:`);
  users.forEach(u => {
    console.log(u.email, u.role, u.name);
  });
}
run();
