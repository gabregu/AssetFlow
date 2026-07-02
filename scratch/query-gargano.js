const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://snbuluotryqjuttbeqfr.supabase.co',
  'sb_publishable_M2Pz-9fUVXda2hoaQw5J0A_SmWkKsgN'
);

async function run() {
  console.log("Fetching counts...");
  const { data: sfdcCases, error: sfdcErr } = await supabase.from('sfdc_cases').select('*');
  const { data: tickets, error: ticketErr } = await supabase.from('tickets').select('*');
  const { data: tasks, error: tasksErr } = await supabase.from('logistics_tasks').select('*');

  console.log("Total in DB:");
  console.log("SFDC Cases:", sfdcCases ? sfdcCases.length : "error", sfdcErr);
  console.log("Tickets:", tickets ? tickets.length : "error", ticketErr);
  console.log("Logistics Tasks:", tasks ? tasks.length : "error", tasksErr);

  console.log("\nSearching for 'Gargano' (case-insensitive) in SFDC cases...");
  const sfdcMatches = (sfdcCases || []).filter(c => {
    const rawStr = JSON.stringify(c).toLowerCase();
    return rawStr.includes('gargano') || rawStr.includes('gar') || rawStr.includes('1060');
  });
  console.log("SFDC matches count:", sfdcMatches.length);
  sfdcMatches.forEach(c => {
    console.log("SFDC match:", { id: c.id, case_number: c.case_number, country: c.country, raw: c.raw_data });
  });

  console.log("\nSearching for 'Gargano' in tickets...");
  const ticketMatches = (tickets || []).filter(t => {
    const rawStr = JSON.stringify(t).toLowerCase();
    return rawStr.includes('gargano') || rawStr.includes('gar') || rawStr.includes('1060');
  });
  console.log("Ticket matches count:", ticketMatches.length);
  ticketMatches.forEach(t => {
    console.log("Ticket match:", { id: t.id, requester: t.requester, subject: t.subject, client: t.client });
  });

  console.log("\nSearching for 'Gargano' in logistics_tasks...");
  const taskMatches = (tasks || []).filter(tk => {
    const rawStr = JSON.stringify(tk).toLowerCase();
    return rawStr.includes('gargano') || rawStr.includes('gar') || rawStr.includes('1060');
  });
  console.log("Task matches count:", taskMatches.length);
  taskMatches.forEach(tk => {
    console.log("Task match:", { id: tk.id, ticket_id: tk.ticket_id, case_number: tk.case_number, subject: tk.subject });
  });
}

run();
