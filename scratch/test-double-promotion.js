const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = 'https://snbuluotryqjuttbeqfr.supabase.co';
const supabaseAnonKey = 'sb_publishable_M2Pz-9fUVXda2hoaQw5J0A_SmWkKsgN';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testDouble() {
  await supabase.auth.signInWithPassword({
    email: 'verifier_1780004069965@yawi.ar',
    password: 'VerificationPassword123!'
  });

  const dbTask1 = {
    ticket_id: 'CAS-1199',
    case_number: '00517441',
    subject: 'Collection - Catalina Sanchez (Test 1)',
    status: 'Pendiente',
    case_type: 'independiente'
  };

  const dbTask2 = {
    ticket_id: 'CAS-1199',
    case_number: '00517441',
    subject: 'Collection - Catalina Sanchez (Test 2)',
    status: 'Pendiente',
    case_type: 'independiente'
  };

  console.log("Inserting first task...");
  const { data: data1, error: error1 } = await supabase.from('logistics_tasks').insert([dbTask1]).select();
  if (error1) {
    console.error("First insert failed:", error1);
    return;
  }
  console.log("First insert succeeded:", data1[0].id);

  console.log("Inserting second task with same case number...");
  const { data: data2, error: error2 } = await supabase.from('logistics_tasks').insert([dbTask2]).select();
  if (error2) {
    console.error("Second insert failed:", error2);
  } else {
    console.log("Second insert succeeded:", data2[0].id);
    await supabase.from('logistics_tasks').delete().eq('id', data2[0].id);
  }

  // Clean up first task
  await supabase.from('logistics_tasks').delete().eq('id', data1[0].id);
  console.log("Cleanup done.");
}

testDouble();
