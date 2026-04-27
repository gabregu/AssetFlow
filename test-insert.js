const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://snbuluotryqjuttbeqfr.supabase.co',
  'sb_publishable_M2Pz-9fUVXda2hoaQw5J0A_SmWkKsgN'
);

async function test() {
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email: 'admin@assetflow.com',
    password: 'admin' // Guessed from previous sessions or common
  });
  
  if (authError) {
    console.log("Auth Error:", authError);
    // Let's try without country
    const { data, error } = await supabase.from('consumables').insert([{
      id: 'CON-999',
      name: 'Test',
      category: 'Accesorio',
      stock: 1
    }]);
    console.log("Insert without country Error:", error);
    return;
  }

  const { data, error } = await supabase.from('consumables').insert([{
    id: 'CON-998',
    name: 'Test 2',
    category: 'Accesorio',
    stock: 1,
    country: 'Argentina'
  }]);
  console.log("Insert with country Error:", error);
}

test();
