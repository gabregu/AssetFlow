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

async function testPromotion() {
  await supabase.auth.signInWithPassword({
    email: 'verifier_1780004069965@yawi.ar',
    password: 'VerificationPassword123!'
  });

  // 1. Fetch ticket and currentTask (from associatedCases)
  const { data: tickets } = await supabase.from('tickets').select('*').eq('id', 'CAS-1199');
  const ticket = tickets[0];
  
  const currentTask = ticket.associated_assets[0]; // { caseNumber: '00517441', ... }
  
  // Simulation of pendingTaskUpdates / partialData (which has assets: [ { serial: 'YDCXW03R6D', type: '' } ])
  const partialData = {
    assets: [
      { serial: 'YDCXW03R6D', type: '' }
    ]
  };

  const caseNum = currentTask.caseNumber || currentTask.case_number;

  const taskSubject = partialData.subject !== undefined ? partialData.subject : (currentTask.subject || '');
  const taskStatus = partialData.status !== undefined ? partialData.status : (currentTask.status || currentTask.logistics?.status || 'Pendiente');
  const taskMethod = partialData.method !== undefined ? partialData.method : (currentTask.method || currentTask.logistics?.method || '');
  
  const taskDeliveryPerson = partialData.delivery_person !== undefined ? partialData.delivery_person : 
                             (partialData.deliveryPerson !== undefined ? partialData.deliveryPerson : 
                             (currentTask.delivery_person || currentTask.deliveryPerson || currentTask.logistics?.deliveryPerson || currentTask.logistics?.delivery_person || ''));
                             
  const taskAssignedTo = partialData.assigned_to !== undefined ? partialData.assigned_to : 
                          (partialData.assignedTo !== undefined ? partialData.assignedTo : 
                          (currentTask.assigned_to || currentTask.assignedTo || currentTask.logistics?.assignedTo || currentTask.logistics?.assigned_to || ''));
                          
  const taskDate = partialData.date !== undefined ? partialData.date : (currentTask.date || currentTask.logistics?.date || '');
  
  const taskTimeSlot = partialData.time_slot !== undefined ? partialData.time_slot : 
                        (partialData.timeSlot !== undefined ? partialData.timeSlot : 
                        (currentTask.time_slot || currentTask.timeSlot || currentTask.logistics?.timeSlot || currentTask.logistics?.time_slot || 'AM'));
                        
  const taskAddress = partialData.address !== undefined ? partialData.address : (currentTask.address || currentTask.logistics?.address || '');
  
  const taskTrackingNumber = partialData.tracking_number !== undefined ? partialData.tracking_number : 
                              (partialData.trackingNumber !== undefined ? partialData.trackingNumber : 
                              (currentTask.tracking_number || currentTask.trackingNumber || currentTask.logistics?.trackingNumber || currentTask.logistics?.tracking_number || ''));
                              
  const taskAssets = partialData.assets !== undefined ? partialData.assets : (currentTask.assets || []);
  const taskAccessories = partialData.accessories !== undefined ? partialData.accessories : (currentTask.accessories || { backpack: false, screenFilter: false, filterSize: '14"' });
  const taskYubikeys = partialData.yubikeys !== undefined ? partialData.yubikeys : (currentTask.yubikeys || []);
  
  const taskDeliveryInfo = partialData.deliveryInfo !== undefined ? partialData.deliveryInfo : 
                            (partialData.delivery_info !== undefined ? partialData.delivery_info : 
                            (currentTask.deliveryInfo || currentTask.delivery_info || currentTask.logistics?.deliveryInfo || {}));
                            
  const taskCoordinatedBy = partialData.coordinated_by !== undefined ? partialData.coordinated_by : 
                            (partialData.coordinatedBy !== undefined ? partialData.coordinatedBy : 
                            (currentTask.coordinated_by || currentTask.coordinatedBy || currentTask.logistics?.coordinatedBy || ''));

  const newTask = {
      ticketId: ticket.id,
      caseNumber: caseNum,
      subject: taskSubject,
      status: taskStatus,
      method: taskMethod,
      deliveryPerson: taskDeliveryPerson,
      assignedTo: taskAssignedTo,
      date: taskDate,
      timeSlot: taskTimeSlot,
      address: taskAddress,
      trackingNumber: taskTrackingNumber,
      assets: taskAssets,
      accessories: taskAccessories,
      yubikeys: taskYubikeys,
      deliveryInfo: taskDeliveryInfo,
      coordinatedBy: taskCoordinatedBy
  };

  console.log("newTask constructed:", JSON.stringify(newTask, null, 2));

  // Sanitize for DB insert
  const dbTask = {
      ticket_id: newTask.ticketId,
      case_number: sanitizeString(newTask.caseNumber),
      subject: sanitizeString(newTask.subject),
      status: sanitizeString(newTask.status) || 'Pendiente',
      method: sanitizeString(newTask.method),
      delivery_person: sanitizeString(newTask.deliveryPerson),
      assigned_to: sanitizeString(newTask.assignedTo),
      date: newTask.date === '' ? null : newTask.date,
      time_slot: sanitizeString(newTask.timeSlot) || 'AM',
      address: sanitizeString(newTask.address),
      tracking_number: sanitizeString(newTask.trackingNumber),
      assets: newTask.assets || [],
      accessories: newTask.accessories || {},
      yubikeys: newTask.yubikeys || [],
      delivery_info: newTask.deliveryInfo || {},
      instructions: '',
      case_type: 'independiente',
      depends_on: []
  };

  console.log("dbTask for insert:", JSON.stringify(dbTask, null, 2));

  const { data, error } = await supabase.from('logistics_tasks').insert([dbTask]).select();
  if (error) {
    console.error("Promotion failed:", error);
  } else {
    console.log("Promotion succeeded:", JSON.stringify(data, null, 2));
    // Clean up
    await supabase.from('logistics_tasks').delete().eq('id', data[0].id);
  }
}

testPromotion();
