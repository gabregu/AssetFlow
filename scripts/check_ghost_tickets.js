
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://snbuluotryqjuttbeqfr.supabase.co';
const supabaseKey = 'sb_publishable_M2Pz-9fUVXda2hoaQw5J0A_SmWkKsgN';
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkSpecificTickets() {
    const ticketIds = ['CAS-1010', 'CAS-1018', 'CAS-1017', 'CAS-1011'];
    console.log(`Consultando estado de tickets: ${ticketIds.join(', ')}`);

    const { data, error } = await supabase
        .from('tickets')
        .select('*')
        .in('id', ticketIds);

    if (error) {
        console.error("Error consultando tickets:", error);
        return;
    }

    if (data.length === 0) {
        console.log("Ninguno de estos tickets existe en la base de datos.");
    } else {
        console.log(`Se encontraron ${data.length} tickets que DEBERÍAN estar borrados:`);
        data.forEach(t => {
            console.log(`ID: ${t.id} | Status: ${t.status} | DeliveryStatus: ${t.delivery_status} | Assigned: ${t.logistics?.deliveryPerson}`);
        });
    }
}

checkSpecificTickets();
