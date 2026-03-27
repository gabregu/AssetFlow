'use client';

import React from 'react';
import { CheckCircle2 } from 'lucide-react';
import { Card } from '@/app/components/ui/Card';

export default function ProcessChecklistCard({ editedData, ticket, setEditedData, updateTicket }) {
    const checklistItems = [
        { key: 'infoUsuario', label: 'Confirma informacion del Usuario' },
        { key: 'dispositivo', label: 'Confirma que dispositivo enviar o recolectar' },
        { key: 'metodoEnvio', label: 'Confirma método de envio' },
        { key: 'fechaHora', label: 'Coordina Fecha y Hora' },
        { key: 'entregado', label: 'Confirmacion que fue entregado' },
        { key: 'cierreSfdc', label: 'Revision y Cierrre en SFDC' },
        { key: 'facturado', label: 'Facturado' }
    ];

    const currentChecklist = editedData?.manualChecklist || ticket?.manualChecklist || {};

    const toggleItem = async (key) => {
        const newChecklist = {
            ...currentChecklist,
            [key]: !currentChecklist[key]
        };

        if (setEditedData) {
            setEditedData({ ...editedData, manualChecklist: newChecklist });
        }

        if (updateTicket && ticket?.id) {
            await updateTicket(ticket.id, { manualChecklist: newChecklist });
        }
    };

    return (
        <Card title="Checklist de Proceso" style={{ height: 'auto' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
                {checklistItems.map((item, idx) => {
                    const isDone = !!currentChecklist[item.key];
                    return (
                        <div key={idx} 
                            onClick={() => toggleItem(item.key)}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.75rem',
                                transition: 'all 0.3s ease',
                                opacity: isDone ? 1 : 0.6,
                                cursor: 'pointer'
                            }}>
                            {isDone ? (
                                <CheckCircle2 size={18} style={{ color: '#22c55e', flexShrink: 0 }} />
                            ) : (
                                <div style={{
                                    width: '18px',
                                    height: '18px',
                                    borderRadius: '50%',
                                    border: '2px solid var(--text-secondary)',
                                    background: 'transparent',
                                    opacity: 0.5,
                                    flexShrink: 0
                                }} />
                            )}
                            <span style={{
                                fontSize: '0.85rem',
                                fontWeight: isDone ? 600 : 400,
                                color: isDone ? 'var(--text-main)' : 'var(--text-secondary)',
                                userSelect: 'none',
                                lineHeight: '1.2'
                            }}>
                                {item.label}
                            </span>
                        </div>
                    );
                })}
            </div>
        </Card>
    );
}
