const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = 'https://snbuluotryqjuttbeqfr.supabase.co';
const supabaseAnonKey = 'sb_publishable_M2Pz-9fUVXda2hoaQw5J0A_SmWkKsgN';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

const sanitizeString = (val) => {
    if (typeof val === 'string') {
        const cleaned = val.trim().replace(/[\0]+/g, '');
        return cleaned === '' ? null : cleaned;
    }
    return val;
};

async function testReal() {
  await supabase.auth.signInWithPassword({
    email: 'verifier_1780004069965@yawi.ar',
    password: 'VerificationPassword123!'
  });

  // Construct task similar to newTask in handleUpdateTask
  const task = {
    ticketId: 'CAS-1199',
    caseNumber: '00517441',
    subject: 'Collection - Catalina Sanchez',
    status: 'Pendiente',
    method: '',
    deliveryPerson: '',
    assignedTo: '', // This will be sanitized to null
    date: '',
    timeSlot: 'AM',
    address: 'Juana Manso 999, 5th and 6th Floor, SFDC-Argentina C1107CDA',
    trackingNumber: '',
    assets: [{ serial: 'YDCXW03R6D', type: 'Entrega' }],
    accessories: {},
    yubikeys: [],
    deliveryInfo: {},
    coordinatedBy: ''
  };

  const dbTask = {
      ticket_id: task.ticketId,
      case_number: sanitizeString(task.caseNumber),
      subject: sanitizeString(task.subject),
      status: sanitizeString(task.status) || 'Pendiente',
      method: sanitizeString(task.method),
      delivery_person: sanitizeString(task.deliveryPerson),
      assigned_to: sanitizeString(task.assignedTo),
      date: task.date === '' ? null : task.date,
      time_slot: sanitizeString(task.timeSlot) || 'AM',
      address: sanitizeString(task.address),
      tracking_number: sanitizeString(task.trackingNumber),
      assets: task.assets || [],
      accessories: task.accessories || {},
      yubikeys: task.yubikeys || [],
      delivery_info: task.deliveryInfo || {},
      instructions: sanitizeString(task.instructions) || '',
      case_type: task.caseType || task.case_type || 'independiente',
      depends_on: task.dependsOn || task.depends_on || []
  };

  console.log("dbTask payload:", JSON.stringify(dbTask, null, 2));

  const { data, error } = await supabase.from('logistics_tasks').insert([dbTask]).select();
  if (error) {
    console.error("Real insert failed:", error);
  } else {
    console.log("Real insert succeeded:", JSON.stringify(data, null, 2));
    // Clean up
    await supabase.from('logistics_tasks').delete().eq('id', data[0].id);
  }
}

testReal();
