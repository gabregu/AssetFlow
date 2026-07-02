const newTicket = { caseNumber: '18471734', subject: 'Need a Matlock Yubikey for access to TMP Systems for Rodrigo Merino', requester: 'Rodrigo Merino', priority: 'Media', status: 'Abierto', country: 'SFDC-Argentina', address: '', zipCode: '', phone: '', email: '', type: 'Entrega' };
const clean = (str) => typeof str === 'string' ? str.trim().replace(/[\r\n\t\0]+/g, ' ') : str;
const ticketData = {
    ...newTicket,
    subject: clean(newTicket.subject),
    requester: clean(newTicket.requester),
    associatedCases: newTicket.caseNumber && newTicket.caseNumber.trim() !== '' ? [{
        caseNumber: clean(newTicket.caseNumber).replace(/\s/g, ''),
        subject: clean(newTicket.subject),
        logistics: {
            address: newTicket.address || newTicket.country ? `${clean(newTicket.address)}, ${clean(newTicket.country)} ${clean(newTicket.zipCode)}`.trim() : '',
            phone: clean(newTicket.phone),
            email: clean(newTicket.email),
            method: '',
            status: 'Pendiente'
        }
    }] : [],
    logistics: {
        address: newTicket.address || newTicket.country ? `${clean(newTicket.address)}, ${clean(newTicket.country)} ${clean(newTicket.zipCode)}`.trim() : '',
        phone: clean(newTicket.phone),
        email: clean(newTicket.email),
        type: newTicket.type,
        method: '',
        deliveryPerson: ''
    }
};
console.log(ticketData);
