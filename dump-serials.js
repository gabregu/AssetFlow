const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const supabaseUrl = 'https://snbuluotryqjuttbeqfr.supabase.co';
const supabaseKey = 'sb_publishable_M2Pz-9fUVXda2hoaQw5J0A_SmWkKsgN';
const supabase = createClient(supabaseUrl, supabaseKey);

async function dumpAssets() {
  let allData = [];
  let start = 0;
  const step = 1000;
  while (true) {
      const { data, error } = await supabase.from('assets').select('serial').range(start, start + step - 1);
      if (error) {
        console.error(error);
        return;
      }
      if (data) allData = [...allData, ...data];
      if (!data || data.length < step) break;
      start += step;
  }
  fs.writeFileSync('all_serials.json', JSON.stringify(allData, null, 2));
  console.log('Dumped', allData.length, 'serials');
}

dumpAssets();
