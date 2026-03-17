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
            <div style={{ borderLeft: '2px solid var(--border)', paddingLeft: '1.5rem', marginLeft: '0.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                {/* Static initial action */}
                <div style={{ position: 'relative' }}>
                    <div style={{ position: 'absolute', left: '-1.85rem', top: '0', width: '10px', height: '10px', borderRadius: '50%', background: 'var(--accent-color)' }} />
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>Sistema • {ticket.date}</div>
                    <div style={{ padding: '0.75rem', background: 'var(--background)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', fontSize: '0.9rem' }}>
                        Ticket creado: {ticket.subject}
                    </div>
                </div>

                {/* Dynamic Notes */}
                {(editedData.internalNotes || []).map((note, idx) => (
                    <div key={idx} style={{ position: 'relative' }}>
                        <div style={{ position: 'absolute', left: '-1.85rem', top: '0', width: '10px', height: '10px', borderRadius: '50%', background: 'var(--primary-color)' }} />
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>
                            {note.user} • {new Date(note.date).toLocaleString()}
                        </div>
                        <div style={{ padding: '0.75rem', background: 'var(--background)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', fontSize: '0.9rem', color: 'var(--text-main)' }}>
                            {note.content}
                        </div>
                    </div>
                ))}
            </div>

            <div style={{ marginTop: '2rem' }}>
                <textarea
                    placeholder="Escribe una nota interna..."
                    className="form-textarea"
                    style={{ minHeight: '100px', resize: 'none' }}
                    value={newNote}
                    onChange={e => setNewNote(e.target.value)}
                />
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1rem' }}>
                    <Button size="sm" onClick={handleAddNote}>Añadir Nota</Button>
                </div>
            </div>
        </Card>
    );
}
