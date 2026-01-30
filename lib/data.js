export const initialTickets = [];

export const initialAssets = [];

export const initialDeliveries = [];

export const initialUsers = [
    { id: 'USR-001', username: 'admin', role: 'admin', name: 'Administrador' },
    { id: 'USR-002', username: 'staff1', role: 'staff', name: 'Administrativo' },
    { id: 'USR-003', username: 'user1', role: 'user', name: 'Usuario Final' },
    { id: 'USR-004', username: 'driver1', role: 'Conductor', name: 'Juan Conductor' },
    { id: 'USR-005', username: 'lmiguel', role: 'Conductor', name: 'Luis Miguel' },
];

export const initialSalesforceCases = [];

export const initialConsumables = [
    { id: 'CON-001', name: 'Filtro de Pantalla 13"', category: 'Accesorio', stock: 25 },
    { id: 'CON-002', name: 'Filtro de Pantalla 14"', category: 'Accesorio', stock: 15 },
    { id: 'CON-003', name: 'Filtro de Pantalla 15"', category: 'Accesorio', stock: 10 },
    { id: 'CON-004', name: 'Filtro de Pantalla 16"', category: 'Accesorio', stock: 5 },
    { id: 'CON-005', name: 'Mochila Corporativa', category: 'Accesorio', stock: 40 },
    { id: 'CON-006', name: 'Fuentes', category: 'Accesorio', stock: 15 },
    { id: 'CON-007', name: 'Cables USB-C', category: 'Accesorio', stock: 30 },
];

export const initialRates = {
    laptopService: 15,
    smartphoneService: 10,
    securityKeyService: 5,
    driverCommission: 5, // Cost paid to driver
    internalDeliveryRevenue: 15, // Price charged to client
    warrantyService: 25,
    postalServiceMarkup: 3, // Extra revenue for postal
    postalBaseCost: 10 // Average base cost
};
