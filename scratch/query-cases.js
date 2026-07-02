const { createClient } = require('@supabase/supabase-js');
const supabase = createClient('https://snbuluotryqjuttbeqfr.supabase.co', 'sb_publishable_M2Pz-9fUVXda2hoaQw5J0A_SmWkKsgN');

async function run() {
  const { data: tickets } = await supabase.from('tickets').select('*');
  
  // Buscar en todos los tickets
  const matchingTickets = tickets.filter(t => {
    const legacyCases = t.associated_assets || [];
    return legacyCases.some(c => String(c.caseNumber) === '00443152' || String(c.caseNumber) === '00344700');
  });

  console.log(`Found ${matchingTickets.length} matching tickets for 00443152/00344700`);
  matchingTickets.forEach(t => {
    console.log('TICKET:', {
      id: t.id,
      requester: t.requester,
      associated_assets: t.associated_assets,
      excluded_cases: t.excluded_cases
    });
  });

  const { data: tasks } = await supabase.from('logistics_tasks').select('*');
  const matchingTasks = tasks.filter(task => 
    String(task.case_number) === '00443152' || String(task.case_number) === '00344700'
  );
  console.log(`Found ${matchingTasks.length} matching logistics tasks`);
  matchingTasks.forEach(task => {
    console.log('LOGISTICS TASK:', {
      id: task.id,
      ticket_id: task.ticket_id,
      case_number: task.case_number,
      subject: task.subject,
      status: task.status
    });
  });
}
run();
