'use client';

import { useState } from 'react';
import { Card } from '@/app/components/ui/Card';
import { Button } from '@/app/components/ui/Button';
import { MessageSquare } from 'lucide-react';

export default function HistoryPanel({ ticket, editedData, setEditedData, updateTicket, currentUser }) {
    const [newNote, setNewNote] = useState('');

    const handleAddNote = () => {
        if (newNote.trim()) {
            const noteObj = {
                content: newNote,
                user: currentUser?.name || 'Sistema',
                date: new Date().toISOString()
            };
            const updatedNotes = [...(editedData.internalNotes || []), noteObj];
            const updatedTicket = { ...editedData, internalNotes: updatedNotes };

            setEditedData(updatedTicket);
            updateTicket(ticket.id, updatedTicket);
            setNewNote('');
        }
    };

    return (
        <Card title="Historial y Notas" action={<MessageSquare size={20} style={{ opacity: 0.6 }} />}>
            {/* Input area now AT THE TOP */}
            <div style={{ marginBottom: '2rem', background: 'var(--surface)', padding: '1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
                <textarea
                    placeholder="Escribir una nota o actualización..."
                    className="form-textarea"
                    style={{ minHeight: '80px', resize: 'none', border: 'none', background: 'transparent', width: '100%', fontSize: '0.95rem' }}
                    value={newNote}
                    onChange={e => setNewNote(e.target.value)}
                />
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.75rem', borderTop: '1px solid var(--border)', paddingTop: '0.75rem' }}>
                    <Button size="sm" onClick={handleAddNote} disabled={!newNote.trim()}>Añadir Registro</Button>
                </div>
            </div>

            <div style={{ borderLeft: '2px solid var(--border)', paddingLeft: '1.5rem', marginLeft: '0.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
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

                {/* Static initial action - AT THE BOTTOM of history since it's the oldest */}
                <div style={{ position: 'relative' }}>
                    <div style={{ position: 'absolute', left: '-1.85rem', top: '0', width: '10px', height: '10px', borderRadius: '50%', background: 'var(--accent-color)', boxShadow: '0 0 0 4px var(--card-bg)' }} />
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>Sistema • {ticket.date}</div>
                    <div style={{ padding: '0.75rem', background: 'var(--background)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', fontSize: '0.9rem', opacity: 0.8 }}>
                        Ticket creado: {ticket.subject}
                    </div>
                </div>
            </div>
        </Card>
    );
}
