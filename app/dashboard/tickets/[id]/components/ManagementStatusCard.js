'use client';

import React from 'react';
import { Badge } from '@/app/components/ui/Badge';
import { Card } from '@/app/components/ui/Card';
import { Button } from '@/app/components/ui/Button';
import { AlertCircle, Clock, CheckCircle2, Check, DollarSign } from 'lucide-react';
import { TICKET_STATUSES, getStatusVariant } from '@/app/dashboard/tickets/constants';

export default function ManagementStatusCard({ 
    editedData, 
    ticket, 
    editMode, 
    setEditedData, 
    updateTicket
}) {
    const statuses = TICKET_STATUSES;

    return (
        <Card title="Estado de Gestión" style={{ height: 'auto' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Cambiar el estado actual:</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {statuses.map(s => (
                        <Button
                            key={s}
                            variant={(editedData.status || ticket.status) === s ? getStatusVariant(s) : 'outline'}
                            size="sm"
                            style={{ justifyContent: 'flex-start', fontWeight: (editedData.status || ticket.status) === s ? 700 : 400 }}
                            onClick={() => {
                                if (editMode) {
                                    setEditedData({ ...editedData, status: s });
                                } else {
                                    updateTicket(ticket.id, { status: s });
                                }
                            }}
                        >
                            {s === 'Abierto' && <AlertCircle size={16} style={{ marginRight: '8px' }} />}
                            {s === 'En Progreso' && <Clock size={16} style={{ marginRight: '8px' }} />}
                            {s === 'Resuelto' && <CheckCircle2 size={16} style={{ marginRight: '8px' }} />}
                            {s === 'Caso SFDC Cerrado' && <Check size={16} style={{ marginRight: '8px' }} />}
                            {s === 'Servicio Facturado' && <DollarSign size={16} style={{ marginRight: '8px' }} />}
                            {s}
                        </Button>
                    ))}
                </div>
            </div>
        </Card>
    );
}
