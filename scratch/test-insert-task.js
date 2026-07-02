const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = 'https://snbuluotryqjuttbeqfr.supabase.co';
const supabaseAnonKey = 'sb_publishable_M2Pz-9fUVXda2hoaQw5J0A_SmWkKsgN';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testInsert() {
  await supabase.auth.signInWithPassword({
    email: 'verifier_1780004069965@yawi.ar',
    password: 'VerificationPassword123!'
  });

  const dbTask = {
    ticket_id: 'CAS-1199',
    case_number: '00517441',
    subject: 'Collection - Catalina Sanchez',
    status: 'Pendiente',
    method: 'Sin método',
    delivery_person: '',
    assigned_to: '',
    date: null,
    time_slot: 'AM',
    address: 'Juana Manso 999, 5th and 6th Floor, SFDC-Argentina C1107CDA',
    tracking_number: '',
    assets: [
      {
        "type": "Entrega",
        "serial": "YDCXW03R6D"
      }
    ],
    accessories: {},
    yubikeys: [],
    delivery_info: {},
    instructions: '',
    case_type: 'independiente',
    depends_on: []
  };

  console.log("Attempting to insert test logistics task...");
  const { data, error } = await supabase.from('logistics_tasks').insert([dbTask]).select();
  if (error) {
    console.error("Insert failed:", error);
  } else {
    console.log("Insert succeeded:", JSON.stringify(data, null, 2));
    
    // Clean up the test insert immediately
    console.log("Cleaning up test task...");
    const { error: deleteError } = await supabase.from('logistics_tasks').delete().eq('id', data[0].id);
    if (deleteError) {
      console.error("Cleanup failed:", deleteError);
    } else {
      console.log("Cleanup succeeded.");
    }
  }
}

testInsert();
