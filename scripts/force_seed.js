const { createClient } = require('@supabase/supabase-js');

// Configuración directa para el script (usando las mismas credenciales que la app)
const supabaseUrl = 'https://snbuluotryqjuttbeqfr.supabase.co';
const supabaseKey = 'sb_publishable_qFRfGLQajQ28F_Z0HzF8Kw_1OfqdLN5';
const supabase = createClient(supabaseUrl, supabaseKey);

const initialUsers = [
    { id: 'USR-001', username: 'admin', password: '123456*', role: 'admin', name: 'Administrador' },
    { id: 'USR-002', username: 'staff1', password: '123456*', role: 'staff', name: 'Administrativo' },
    { id: 'USR-003', username: 'user1', password: '123456*', role: 'user', name: 'Usuario Final' },
    { id: 'USR-004', username: 'driver1', password: '123456*', role: 'Conductor', name: 'Juan Conductor' },
    { id: 'USR-005', username: 'lmiguel', password: '123456*', role: 'Conductor', name: 'Luis Miguel' },
];

const initialConsumables = [
    { id: 'CON-001', name: 'Filtro de Pantalla 13"', category: 'Accesorio', stock: 25 },
    { id: 'CON-002', name: 'Filtro de Pantalla 14"', category: 'Accesorio', stock: 15 },
    { id: 'CON-003', name: 'Filtro de Pantalla 15"', category: 'Accesorio', stock: 10 },
    { id: 'CON-004', name: 'Filtro de Pantalla 16"', category: 'Accesorio', stock: 5 },
    { id: 'CON-005', name: 'Mochila Corporativa', category: 'Accesorio', stock: 40 },
    { id: 'CON-006', name: 'Fuentes', category: 'Accesorio', stock: 15 },
    { id: 'CON-007', name: 'Cables USB-C', category: 'Accesorio', stock: 30 },
];

const initialRates = {
    laptopService: 15,
    smartphoneService: 10,
    securityKeyService: 5,
    driverCommission: 5, // Cost paid to driver
    internalDeliveryRevenue: 15, // Price charged to client
    warrantyService: 25,
    postalServiceMarkup: 3, // Extra revenue for postal
    postalBaseCost: 10, // Average base cost
    driverExtra_Lucas_Delivery: 2,
    driverExtra_Lucas_Recovery: 2,
    driverExtra_Facundo_Delivery: 2,
    driverExtra_Facundo_Recovery: 2,
    driverExtra_Guillermo_Delivery: 2,
    driverExtra_Guillermo_Recovery: 2
};

async function seed() {
    console.log('Iniciando carga forzada de datos a Supabase...');

    // 1. Users
    console.log('Subiendo Usuarios...');
    const { error: usersError } = await supabase.from('users').upsert(initialUsers, { onConflict: 'id' });
    if (usersError) console.error('Error subiendo usuarios:', usersError);
    else console.log('✅ Usuarios sincronizados correctamente.');

    // 2. Consumables
    console.log('Subiendo Consumibles...');
    const { error: consError } = await supabase.from('consumables').upsert(initialConsumables, { onConflict: 'id' });
    if (consError) console.error('Error subiendo consumibles:', consError);
    else console.log('✅ Consumibles sincronizados correctamente.');

    // 3. Rates (Config)
    console.log('Subiendo Tarifas y Configuración...');
    const { error: ratesError } = await supabase.from('app_config').upsert({ key: 'rates', value: initialRates }, { onConflict: 'key' });
    if (ratesError) console.error('Error subiendo tarifas:', ratesError);
    else console.log('✅ Tarifas sincronizadas correctamente.');

    console.log('-------------------------------------------');
    console.log('PROCESO TERMINADO. La base de datos ha sido actualizada.');
}

seed();
