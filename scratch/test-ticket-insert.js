const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://snbuluotryqjuttbeqfr.supabase.co',
  'sb_publishable_M2Pz-9fUVXda2hoaQw5J0A_SmWkKsgN'
);

async function test() {
  console.log("Replicating manual ticket payload without Auth...");
  const ticketData = {
    id: `CAS-${Date.now()}`,
    subject: "ITAM New Hire Services Bundle (Test Insertion)",
    requester: "Sebastian Maffeo",
    priority: "Media",
    status: "Abierto",
    date: new Date().toISOString().split('T')[0],
    client: "SFDC-Argentina",
    delivery_status: 'Pendiente',
    logistics: {
        address: "Av. Siempreviva 742, Argentina",
        phone: "+54 9 11 1234 5678",
        email: "sebastian@example.com",
        type: "Entrega",
        method: '',
        deliveryPerson: ''
    },
    associated_assets: [],
    accessories: {},
    internal_notes: [],
    delivery_details: {}
  };

  console.log("Inserting ticket payload:", ticketData);
  const { data, error } = await supabase.from('tickets').insert([ticketData]).select();
  if (error) {
    console.error("Ticket Insert Error:", error);
  } else {
    console.log("Ticket Insert Success:", data);
  }
}

test();
