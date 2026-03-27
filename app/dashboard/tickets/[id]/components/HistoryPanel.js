'use client';

import { useState } from 'react';
import { Card } from '@/app/components/ui/Card';
import { Button } from '@/app/components/ui/Button';
import { MessageSquare } from 'lucide-react';

export default function HistoryPanel({ ticket, editedData, setEditedData, updateTicket, currentUser }) {
    const [isOpen, setIsOpen] = useState(false);

    return (
        <Card 
            title="Historial de Acciones" 
            style={{ height: 'auto' }}
            action={
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    <Button 
                        size="xs" 
                        variant="ghost" 
                        onClick={() => setIsOpen(!isOpen)}
                        style={{ fontSize: '0.7rem', textTransform: 'uppercase', fontWeight: 700 }}
                    >
                        {isOpen ? 'Ocultar Detalle' : 'Ver Historial Completo'}
                    </Button>
                    <MessageSquare size={20} style={{ opacity: 0.6 }} />
                </div>
            }
        >
            {/* Si está cerrado no mostramos contenido extra, la Card ya contiene el botón */}

            {isOpen && (
                <div style={{ borderLeft: '2px solid var(--border)', paddingLeft: '1.5rem', marginLeft: '0.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem', marginTop: '0.5rem', animation: 'fadeIn 0.3s ease-out' }}>
                    {/* Dynamic Notes - ORDER BY NEWEST FIRST */}
                    {[...(editedData.internalNotes || [])].reverse().map((note, idx) => (
                        <div key={`note-${idx}`} style={{ position: 'relative' }}>
                            <div style={{ position: 'absolute', left: '-1.85rem', top: '0', width: '10px', height: '10px', borderRadius: '50%', background: 'var(--primary-color)', boxShadow: '0 0 0 4px var(--card-bg)' }} />
                            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>
                                <span style={{ fontWeight: 700, color: 'var(--text-main)' }}>{note.user}</span> • {new Date(note.date).toLocaleString()}
                            </div>
                            <div style={{ padding: '0.75rem', background: 'var(--background)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', fontSize: '0.9rem', color: 'var(--text-main)', borderLeft: '3px solid var(--primary-color)' }}>
                                {note.content}
                            </div>
                        </div>
                    ))}

                    {/* Static initial action */}
                    <div style={{ position: 'relative' }}>
                        <div style={{ position: 'absolute', left: '-1.85rem', top: '0', width: '10px', height: '10px', borderRadius: '50%', background: 'var(--accent-color)', boxShadow: '0 0 0 4px var(--card-bg)' }} />
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>Sistema • {ticket.date}</div>
                        <div style={{ padding: '0.75rem', background: 'var(--background)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', fontSize: '0.9rem', opacity: 0.8 }}>
                            Ticket creado: {ticket.subject}
                        </div>
                    </div>
                </div>
            )}
        </Card>
    );
}
