export const TICKET_STATUSES = [
    'En Progreso',
    'Pendiente',
    'Bloqueado / A la Espera',
    'Resuelto',
    'Caso SFDC Cerrado',
    'Servicio Facturado'
];

export const getStatusVariant = (status) => {
    switch (status) {
        case 'Bloqueado / A la Espera':
            return 'danger-soft';
        case 'Bloqueado':
            return 'secondary';
        case 'En Progreso':
            return 'info';
        case 'Resuelto':
        case 'Finalizado':
        case 'Entregado':
        case 'Recuperado':
            return 'success';
        case 'Pendiente':
            return 'warning';
        case 'Para Coordinar':
            return 'info';
        case 'En Transito':
            return 'primary';
        case 'No requiere accion':
            return 'default';
        case 'Cancelado':
            return 'danger';
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
