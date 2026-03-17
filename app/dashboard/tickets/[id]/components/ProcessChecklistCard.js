'use client';

import React from 'react';
import { CheckCircle2 } from 'lucide-react';
import { Card } from '@/app/components/ui/Card';

export default function ProcessChecklistCard({ editedData, ticket }) {
    const checklistItems = [
        {
            label: 'Confirma información del Usuario',
            done: !!(editedData.logistics?.address && editedData.logistics?.phone)
        },
        {
            label: 'Coordina Fecha y Hora',
            done: !!(editedData.logistics?.date || editedData.logistics?.datetime)
        },
        {
            label: 'Confirma que dispositivo enviar',
            done: (editedData.associatedAssets?.length > 0)
        },
        {
            label: 'Confirma método de envío',
            done: !!editedData.logistics?.method
        },
        {
            label: 'Paquete Coordinado en Transito',
            done: (editedData.deliveryStatus === 'En Transito' || !!editedData.logistics?.userContacted)
        },
        {
            label: 'Confirmación que fue entregado',
            done: ['Resuelto', 'Caso SFDC Cerrado', 'Servicio Facturado'].includes(editedData.status || ticket.status)
        },
        {
            label: 'Revision y cierre en SFDC',
            done: ['Caso SFDC Cerrado', 'Servicio Facturado'].includes(editedData.status || ticket.status)
        },
        {
            label: 'Facturado',
            done: (editedData.status || ticket.status) === 'Servicio Facturado'
        }
    ];

    return (
        <Card title="Checklist de Proceso">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
                {checklistItems.map((item, idx) => (
                    <div key={idx} style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.75rem',
                        transition: 'all 0.3s ease',
                        opacity: item.done ? 1 : 0.5
                    }}>
                        {item.done ? (
                            <CheckCircle2 size={18} style={{ color: '#22c55e' }} />
                        ) : (
                            <div style={{
                                width: '18px',
                                height: '18px',
                                borderRadius: '50%',
                                border: '2px solid var(--border)',
                                background: 'transparent'
                            }} />
                        )}
                        <span style={{
                            fontSize: '0.85rem',
                            fontWeight: item.done ? 600 : 400,
                            color: item.done ? 'var(--text-main)' : 'var(--text-secondary)'
                        }}>
                            {item.label}
                        </span>
                    </div>
                ))}
            </div>
        </Card>
    );
}
