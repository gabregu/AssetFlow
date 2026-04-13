export const TICKET_STATUSES = [
    'Abierto',
    'En Progreso',
    'Pendiente',
    'Resuelto',
    'Caso SFDC Cerrado',
    'Servicio Facturado'
];

export const getStatusVariant = (status) => {
    switch (status) {
        case 'Abierto':
            return 'danger-soft';
        case 'En Progreso':
            return 'info';
        case 'Resuelto':
        case 'Finalizado':
        case 'Entregado':
            return 'success';
        case 'Pendiente':
            return 'warning';
        case 'Para Coordinar':
            return 'info';
        case 'En Transito':
            return 'primary';
        case 'No requiere accion':
            return 'default';
        case 'Caso SFDC Cerrado':
            return 'success';
        case 'Servicio Facturado':
            return 'info';
        default:
            return 'default';
    }
};

export const getTypeIconVariant = (type) => {
    switch (type) {
        case 'Laptop': return 'info';
        case 'Smartphone': return 'success';
        case 'Tablet': return 'warning';
        case 'Security keys': return 'secondary';
        default: return 'default';
    }
};
