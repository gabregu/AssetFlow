const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://snbuluotryqjuttbeqfr.supabase.co';
const supabaseKey = 'sb_publishable_M2Pz-9fUVXda2hoaQw5J0A_SmWkKsgN';
const supabase = createClient(supabaseUrl, supabaseKey);

async function findSerial() {
  const { data: assets, error } = await supabase.from('assets').select('serial');
  if (error) {
    console.error('Error:', error);
    return;
  }
  
  const target = '353414750102747';
  const found = assets.filter(a => a.serial && a.serial.toLowerCase() === target.toLowerCase());
  console.log('Found exactly (case-insensitive):', found);
  
  const similar = assets.filter(a => a.serial && a.serial.replace(/\s+/g, '').includes('35341475'));
  console.log('Similar:', similar);
}

findSerial();
