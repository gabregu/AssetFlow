const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://snbuluotryqjuttbeqfr.supabase.co',
  'sb_publishable_M2Pz-9fUVXda2hoaQw5J0A_SmWkKsgN'
);

async function testUpdate() {
  console.log("Signing in with verifier account...");
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email: 'verifier_1780004069965@yawi.ar',
    password: 'VerificationPassword123!'
  });
  
  if (authError) {
    console.error("Auth error:", authError);
    return;
  }
  console.log("Logged in successfully.");

  // Fetch target task
  const taskId = 'f8f388e0-6742-406a-a97e-4b7ea8180558';
  console.log(`Fetching task details for ${taskId}...`);
  const { data: task, error: fetchError } = await supabase.from('logistics_tasks').select('*').eq('id', taskId).single();
  if (fetchError) {
    console.error("Error fetching task:", fetchError);
    return;
  }
  console.log("Task fetched:", task);

  // Fetch all assets (to mimic store.js)
  console.log("Fetching all assets...");
  const { data: assets, error: assetsError } = await supabase.from('assets').select('*');
  if (assetsError) {
    console.error("Error fetching assets:", assetsError);
    return;
  }
  console.log(`Assets fetched: ${assets.length}`);

  // Fetch tickets (to mimic store.js)
  console.log("Fetching all tickets...");
  const { data: tickets, error: ticketsError } = await supabase.from('tickets').select('*');
  if (ticketsError) {
    console.error("Error fetching tickets:", ticketsError);
    return;
  }
  console.log(`Tickets fetched: ${tickets.length}`);

  const updatedData = {
    status: 'Entregado',
    deliveryInfo: {
      receivedBy: 'Guillermo Abregu',
      dni: '27388800',
      notes: 'Test notes',
      deliveredAt: new Date().toISOString(),
      actualTime: '10:46 a.m.',
      sendWhatsapp: false,
      emailAddress: ''
    }
  };

  console.log("Starting update task flow...");
  // Replicating store.js updateLogisticsTask logic
  const dbUpdate = {
    status: updatedData.status,
    delivery_info: updatedData.deliveryInfo,
    updated_at: new Date().toISOString()
  };

  console.log("Step 1: DB update to logistics_tasks...");
  try {
    const { data: updateResult, error: dbError } = await supabase
      .from('logistics_tasks')
      .update(dbUpdate)
      .eq('id', taskId)
      .select();
    
    if (dbError) {
      console.error("DB Update Error:", dbError);
      return;
    }
    console.log("DB Update Success:", updateResult);
  } catch (err) {
    console.error("DB Update Exception:", err);
    return;
  }

  // Assets updates
  console.log("Step 2: Checking assets updates...");
  if (updatedData.assets !== undefined) {
    console.log("Assets provided in update, updating associations...");
  }

  if (updatedData.status === 'Entregado') {
    const finalAssets = updatedData.assets || task.assets || [];
    console.log(`Final assets to mark as delivered: ${finalAssets.length}`);
    if (finalAssets.length > 0) {
      for (const item of finalAssets) {
        console.log(`Processing asset serial: ${item.serial}`);
        // This is the line that could fail if a.serial is null
        try {
          const fullAsset = assets.find(a => a.serial && a.serial.toLowerCase() === item.serial?.toLowerCase());
          console.log(`Found asset:`, fullAsset ? fullAsset.id : 'not found');
          if (fullAsset) {
            // Update asset
            console.log(`Updating asset ${fullAsset.id} status...`);
            const { error: assetUpdateErr } = await supabase.from('assets').update({
              status: item.type === 'Recupero' ? 'Recuperado' : 'Asignado',
              assignee: 'Almacén', // or similar
              sfdc_case: task.ticket_id
            }).eq('id', fullAsset.id);
            if (assetUpdateErr) {
              console.error("Error updating asset:", assetUpdateErr);
            } else {
              console.log("Asset updated successfully");
            }
          }
        } catch (findErr) {
          console.error("Exception during assets.find:", findErr);
        }
      }
    }
  }

  // Parent ticket status update
  console.log("Step 3: Checking parent ticket status...");
  if (updatedData.status === 'Entregado' || updatedData.status === 'No requiere accion') {
    const ticketId = task.ticket_id;
    console.log(`Checking logistics tasks for ticket: ${ticketId}`);
    const { data: allTasks, error: tasksFetchErr } = await supabase.from('logistics_tasks').select('*').eq('ticket_id', ticketId);
    if (tasksFetchErr) {
      console.error("Error fetching tasks for ticket:", tasksFetchErr);
      return;
    }
    
    // Simulate current task status update in the list
    const currentTasksWithUpdates = allTasks.map(t => {
      if (t.id === taskId) return { ...t, status: updatedData.status };
      return t;
    });

    const atLeastOneDone = currentTasksWithUpdates.some(t => t.status === 'Entregado');
    const nothingPendingOrInProcess = currentTasksWithUpdates.every(t => 
      t.status === 'Entregado' || t.status === 'No requiere accion'
    );

    console.log(`atLeastOneDone: ${atLeastOneDone}, nothingPendingOrInProcess: ${nothingPendingOrInProcess}`);
    if (atLeastOneDone && nothingPendingOrInProcess) {
      console.log(`Attempting to update parent ticket ${ticketId} to Resuelto...`);
      const { error: ticketUpdateErr } = await supabase.from('tickets').update({ status: 'Resuelto' }).eq('id', ticketId);
      if (ticketUpdateErr) {
        console.error("Error updating ticket:", ticketUpdateErr);
      } else {
        console.log("Parent ticket updated successfully to Resuelto!");
      }
    }
  }

  console.log("Test Update Flow Completed!");
}

testUpdate();
