'use client';

import React from 'react';
import { User, Calendar, Tag } from 'lucide-react';
import { Button } from '@/app/components/ui/Button';

export default function TicketInfoGrid({ 
    ticket, 
    editedData, 
    setEditedData, 
    editMode, 
    setEditMode 
}) {
    return (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <div style={{ color: 'var(--text-secondary)' }}><User size={18} /></div>
                <div>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', margin: 0 }}>Solicitante</p>
                    {editMode ? (
                        <input
                            className="form-input"
                            style={{ padding: '0.2rem', marginTop: '2px', fontSize: '1rem', fontWeight: 600, width: '100%' }}
                            value={editedData.requester}
                            onChange={e => setEditedData({ ...editedData, requester: e.target.value })}
                        />
                    ) : (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <p style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0, color: 'var(--text-main)' }}>{ticket.requester}</p>
                            <Button
                                variant="ghost"
                                size="sm"
                                style={{ padding: '0 4px', height: 'auto', opacity: 0.5 }}
                                onClick={() => setEditMode(true)}
                            >
                                <small style={{ fontSize: '0.7rem' }}>Editar</small>
                            </Button>
                        </div>
                    )}
                </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <div style={{ color: 'var(--text-secondary)' }}><Calendar size={18} /></div>
                <div>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', margin: 0 }}>Fecha de creación</p>
                    {editMode ? (
                        <input
                            type="date"
                            className="form-input"
                            style={{ padding: '0.2rem', marginTop: '2px', fontSize: '0.9rem', width: '100%' }}
                            value={editedData.date || ''}
                            onChange={e => setEditedData({ ...editedData, date: e.target.value })}
                        />
                    ) : (
                        <p style={{ fontWeight: 500, margin: 0 }}>{ticket.date}</p>
                    )}
                </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <div style={{ color: 'var(--text-secondary)' }}><Tag size={18} /></div>
                <div>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', margin: 0 }}>Prioridad</p>
                    {editMode ? (
                        <select
                            className="form-select"
                            style={{ padding: '0.2rem', marginTop: '2px' }}
                            value={editedData.priority}
                            onChange={e => setEditedData({ ...editedData, priority: e.target.value })}
                        >
                            <option value="Baja">Baja</option>
                            <option value="Media">Media</option>
                            <option value="Alta">Alta</option>
                            <option value="Crítica">Crítica</option>
                        </select>
                    ) : (
                        <p style={{ fontWeight: 500, margin: 0 }}>{ticket.priority}</p>
                    )}
                </div>
            </div>
        </div>
    );
}
