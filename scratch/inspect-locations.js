const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://snbuluotryqjuttbeqfr.supabase.co',
  'sb_publishable_M2Pz-9fUVXda2hoaQw5J0A_SmWkKsgN'
);

async function inspect() {
  console.log("Signing in with verifier account...");
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email: 'verifier_1780004069965@yawi.ar',
    password: 'VerificationPassword123!'
  });
  
  if (authError) {
    console.error("Auth error:", authError);
    return;
  }
  
  console.log("Fetching all warehouse locations...");
  const { data: locations, error: locError } = await supabase.from('warehouse_locations').select('*');
  if (locError) {
    console.error("Error fetching locations:", locError);
    return;
  }
  
  console.log(`Total locations found: ${locations.length}`);
  const locationCountryCounts = {};
  locations.forEach(l => {
    locationCountryCounts[l.country] = (locationCountryCounts[l.country] || 0) + 1;
  });
  console.log("Locations country counts:", locationCountryCounts);

  console.log("Fetching assets with location_id...");
  const { data: assets, error: assetError } = await supabase.from('assets').select('*').not('location_id', 'is', null);
  if (assetError) {
    console.error("Error fetching assets:", assetError);
    return;
  }

  console.log(`Total assets mapped to locations: ${assets.length}`);
  const arAssets = assets.filter(a => a.country === 'SFDC-Argentina');
  console.log(`SFDC-Argentina mapped assets: ${arAssets.length}`);
  
  const statusCounts = {};
  arAssets.forEach(a => {
    statusCounts[a.status] = (statusCounts[a.status] || 0) + 1;
  });
  console.log("SFDC-Argentina mapped assets status counts:", statusCounts);
}

inspect();
