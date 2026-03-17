'use client';

import React from 'react';
import { Card } from '@/app/components/ui/Card';
import { Button } from '@/app/components/ui/Button';
import { Calendar, AlertCircle, Save } from 'lucide-react';
import TimeSlotSelector from './TimeSlotSelector';

export default function ScheduleCoordinationCard({
    editedData,
    setEditedData,
    editMode,
    editLogistics,
    editSchedule,
    setEditSchedule,
    handleUpdate,
    currentUser,
    updateTicket,
    ticket
}) {
    const isEditing = editMode || editLogistics || editSchedule;

    return (
        <Card title="Coordinación de Fecha y Hora" action={
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                {!editSchedule ? (
                    <Button variant="ghost" size="sm" onClick={() => setEditSchedule(true)}>Editar</Button>
                ) : (
                    <Button size="sm" icon={Save} onClick={() => {
                        handleUpdate();
                        setEditSchedule(false);
                    }}>Guardar</Button>
                )}
                <Calendar size={18} style={{ opacity: 0.6 }} />
            </div>
        }>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {editSchedule && (
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        padding: '0.6rem 0.8rem',
                        background: 'rgba(245, 158, 11, 0.08)',
                        borderRadius: '10px',
                        border: '1px solid rgba(245, 158, 11, 0.2)',
                        marginBottom: '0.25rem',
                        animation: 'slideDown 0.3s ease-out'
                    }}>
                        <AlertCircle size={14} style={{ color: '#d97706' }} />
                        <span style={{ fontSize: '0.75rem', color: '#92400e', fontWeight: 600 }}>
                            ⚠️ No te olvides de confirmar BIEN la dirección de entrega.
                        </span>
                    </div>
                )}
                <div className="form-group">
                    <label className="form-label">Fecha Acordada</label>
                    <div style={{ position: 'relative' }}>
                        <Calendar size={16} style={{ position: 'absolute', left: '12px', top: '12px', color: 'var(--text-secondary)' }} />
                        <input
                            type="date"
                            className="form-input"
                            style={{ paddingLeft: '2.5rem' }}
                            disabled={!isEditing}
                            value={editedData.logistics?.date || editedData.logistics?.datetime?.split('T')[0] || ''}
                            onChange={e => setEditedData({
                                ...editedData,
                                logistics: { ...(editedData.logistics || {}), date: e.target.value }
                            })}
                        />
                    </div>
                </div>

                <TimeSlotSelector 
                    editedData={editedData}
                    setEditedData={setEditedData}
                    disabled={!isEditing}
                />

                <div className="form-group" style={{ marginTop: '1rem', borderTop: '1px solid var(--border)', paddingTop: '1.25rem' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: isEditing ? 'pointer' : 'default' }}>
                        <input
                            type="checkbox"
                            disabled={!isEditing}
                            checked={!!editedData.logistics?.userContacted}
                            onChange={e => {
                                const isChecked = e.target.checked;
                                const newData = {
                                    ...editedData,
                                    logistics: {
                                        ...(editedData.logistics || {}),
                                        userContacted: isChecked,
                                        coordinatedBy: isChecked ? (currentUser?.name || 'Sistema') : '',
                                        enabled: isChecked
                                    },
                                    deliveryStatus: isChecked ? 'En Transito' : 'Para Coordinar'
                                };
                                setEditedData(newData);
                                if (isChecked) {
                                    updateTicket(ticket.id, newData);
                                }
                            }}
                            style={{ width: '18px', height: '18px', cursor: 'inherit' }}
                        />
                        <span style={{ fontSize: '0.85rem', fontWeight: 500, color: 'var(--text-main)' }}>Usuario contactado y visita coordinada</span>
                    </label>

                    {editedData.logistics?.userContacted && editedData.logistics?.coordinatedBy && (
                        <div style={{
                            marginTop: '0.75rem',
                            padding: '0.5rem 0.75rem',
                            background: 'rgba(37, 99, 235, 0.05)',
                            borderRadius: '8px',
                            fontSize: '0.8rem',
                            color: 'var(--text-secondary)',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem'
                        }}>
                            <div style={{ width: '8px', height: '8px', background: '#22c55e', borderRadius: '50%' }}></div>
                            <span>Coordinado por: <strong>{editedData.logistics.coordinatedBy}</strong></span>
                        </div>
                    )}
                </div>
            </div>
        </Card>
    );
}
