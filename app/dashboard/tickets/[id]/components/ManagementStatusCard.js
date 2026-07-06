'use client';

import React, { useState } from 'react';
import { Badge } from '@/app/components/ui/Badge';
import { Card } from '@/app/components/ui/Card';
import { Button } from '@/app/components/ui/Button';
import { Modal } from '@/app/components/ui/Modal';
import { AlertCircle, Clock, CheckCircle2, Check, DollarSign, XCircle } from 'lucide-react';
import { TICKET_STATUSES, getStatusVariant } from '@/app/dashboard/tickets/constants';

export default function ManagementStatusCard({ 
    editedData, 
    ticket, 
    editMode, 
    setEditedData, 
    updateTicket
}) {
    const statuses = TICKET_STATUSES;
    const [showDatePicker, setShowDatePicker] = useState(false);
    const [selectedDate, setSelectedDate] = useState('');

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
                                if (s === 'Resuelto') {
                                    setSelectedDate(new Date().toISOString().split('T')[0]);
                                    setShowDatePicker(true);
                                } else {
                                    if (editMode) {
                                        setEditedData({ ...editedData, status: s });
                                    } else {
                                        updateTicket(ticket.id, { status: s });
                                        setEditedData(prev => ({ ...prev, status: s }));
                                    }
                                }
                            }}
                        >
                            {s === 'Pendiente' && <AlertCircle size={16} style={{ marginRight: '8px' }} />}
                            {s === 'En Progreso' && <Clock size={16} style={{ marginRight: '8px' }} />}
                            {s === 'Resuelto' && <CheckCircle2 size={16} style={{ marginRight: '8px' }} />}
                            {s === 'Caso SFDC Cerrado' && <Check size={16} style={{ marginRight: '8px' }} />}
                            {s === 'Servicio Facturado' && <DollarSign size={16} style={{ marginRight: '8px' }} />}
                            {s === 'Bloqueado / A la Espera' && <XCircle size={16} style={{ marginRight: '8px' }} />}
                            {s}
                        </Button>
                    ))}
                </div>
            </div>

            <Modal 
                isOpen={showDatePicker} 
                onClose={() => setShowDatePicker(false)} 
                title="Confirmar Resolución"
            >
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                    <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                        Indica la fecha en la que se resolvió este servicio. Por defecto se sugiere el día de hoy:
                    </p>
                    <div className="form-group">
                        <label className="form-label" style={{ fontSize: '0.85rem', fontWeight: 600 }}>Fecha de Cierre</label>
                        <input
                            type="date"
                            className="form-input"
                            style={{ width: '100%', marginTop: '0.25rem', padding: '0.5rem' }}
                            value={selectedDate}
                            onChange={e => setSelectedDate(e.target.value)}
                        />
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
                        <Button variant="outline" onClick={() => setShowDatePicker(false)}>
                            Cancelar
                        </Button>
                        <Button 
                            style={{ backgroundColor: '#22c55e', borderColor: '#22c55e', color: 'white' }}
                            onClick={() => {
                                if (editMode) {
                                    setEditedData({ 
                                        ...editedData, 
                                        status: 'Resuelto',
                                        deliveryCompletedDate: selectedDate
                                    });
                                } else {
                                    updateTicket(ticket.id, { 
                                        status: 'Resuelto',
                                        deliveryCompletedDate: selectedDate
                                    });
                                    setEditedData(prev => ({ 
                                        ...prev, 
                                        status: 'Resuelto',
                                        deliveryCompletedDate: selectedDate
                                    }));
                                }
                                setShowDatePicker(false);
                            }}
                        >
                            Confirmar Resolución
                        </Button>
                    </div>
                </div>
            </Modal>
        </Card>
    );
}
