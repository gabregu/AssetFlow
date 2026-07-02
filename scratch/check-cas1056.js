const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseAnonKey);

const originalRatesConfig = {
  "exchangeRate": 1386,
  "laptopService": 15,
  "service_Other": 50, // Set to 50
  "postalBaseCost": 10,
  "warrantyService": 25,
  "cost_Postal_Base": "",
  "driverCommission": 5,
  "smartphoneService": 10,
  "securityKeyService": 5,
  "exchangeRateHistory": {
    "2026-02": 1460,
    "2026-03": 1441,
    "2026-04": 1385
  },
  "postalServiceMarkup": 3,
  "service_Key_Recovery": 0,
  "cost_Driver_Commission": 15,
  "internalDeliveryRevenue": 15,
  "logistics_Postal_Markup": 0,
  "service_Laptop_Delivery": 25,
  "service_Laptop_Recovery": 25,
  "driverExtra_Lucas_Delivery": 2,
  "driverExtra_Lucas_Recovery": 2,
  "logistics_Internal_Revenue": 22,
  "service_Smartphone_Delivery": 50,
  "service_Smartphone_Recovery": 5,
  "driverExtra_Facundo_Delivery": 2,
  "driverExtra_Facundo_Recovery": 2,
  "driverExtra_Guillermo_Delivery": 2,
  "driverExtra_Guillermo_Recovery": 2,
  "driverExtra_Lucas_Delivery_Key": -5,
  "driverExtra_Lucas_Recovery_Key": 0,
  "driverExtra_Facundo_Delivery_Key": -2,
  "driverExtra_Facundo_Recovery_Key": -2,
  "driverExtra_Lucas_Delivery_Laptop": -5,
  "driverExtra_Lucas_Recovery_Laptop": 0,
  "driverExtra_Facundo_Delivery_Laptop": -2,
  "driverExtra_Facundo_Recovery_Laptop": -2,
  "driverExtra_Lucas_Delivery_Smartphone": -5,
  "driverExtra_Lucas_Recovery_Smartphone": 0,
  "driverExtra_Facundo_Delivery_Smartphone": -2,
  "driverExtra_Facundo_Recovery_Smartphone": -2,
  "driverExtra_Lucas Miguel_Delivery_Laptop": 0,
  "driverExtra_Lucas Miguel_Recovery_Laptop": 5,
  "driverExtra_Administrador_Recovery_Laptop": 5
};

async function run() {
  const email = `tester_${Date.now()}@yawi.ar`;
  const password = 'SuperPassword123!';

  await supabase.auth.signUp({ email, password });
  await new Promise(resolve => setTimeout(resolve, 3000));
  await supabase.from('users').update({ role: 'admin' }).eq('email', email);

  console.log("Restoring config in app_config table...");
  const { data, error } = await supabase
    .from('app_config')
    .upsert({ key: 'rates', value: originalRatesConfig })
    .select();

  if (error) {
    console.error("Upsert Error:", error);
  } else {
    console.log("Upsert Success: restored rates!");
  }
}

run();
