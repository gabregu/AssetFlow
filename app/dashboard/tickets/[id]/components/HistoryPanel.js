'use client';

import { useState } from 'react';
import { Card } from '@/app/components/ui/Card';
import { Button } from '@/app/components/ui/Button';
import { User } from 'lucide-react';

const STATUS_COLORS = {
    'Pendiente':            { dot: '#f59e0b', text: '#f59e0b' },
    'En Progreso':          { dot: '#3b82f6', text: '#3b82f6' },
    'Agendado':             { dot: '#06b6d4', text: '#06b6d4' },
    'Bloqueado / A la Espera': { dot: '#ef4444', text: '#ef4444' },
    'Resuelto':             { dot: '#22c55e', text: '#22c55e' },
    'Entregado':            { dot: '#22c55e', text: '#22c55e' },
    'Recolectado':          { dot: '#8b5cf6', text: '#8b5cf6' },
    'Retenido':             { dot: '#f59e0b', text: '#f59e0b' },
    'Cerrado':              { dot: '#6b7280', text: '#6b7280' },
    'default':              { dot: '#6b7280', text: '#6b7280' },
};

function getStatusColor(status) {
    return STATUS_COLORS[status] || STATUS_COLORS['default'];
}

function formatDate(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    if (isNaN(d)) return dateStr;
    return d.toLocaleDateString('es-AR') + ' · ' + d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
}

export default function HistoryPanel({ ticket, editedData, setEditedData, updateTicket, currentUser }) {
    const [isOpen, setIsOpen] = useState(false);

    // Build a unified list of status-change events from internalNotes
    const notes = [...(editedData.internalNotes || [])];

    // Try to extract status-change entries from notes (they often contain "Estado:" or similar)
    const statusHistory = notes
        .filter(n => n && (n.statusChange || n.content?.includes('Estado') || n.content?.includes('estado') || n.type === 'status'))
        .map(n => ({
            status: n.statusChange || n.newStatus || n.status || extractStatus(n.content) || 'Actualización',
            user: n.user || n.author || 'Sistema',
            date: n.date || n.createdAt || '',
            content: n.content || '',
        }));

    // If no explicit status events, build from all notes
    const allEntries = notes.map(n => ({
        status: n.statusChange || n.newStatus || n.status || extractStatus(n.content),
        user: n.user || n.author || 'Sistema',
        date: n.date || n.createdAt || '',
        content: n.content || '',
        isNote: !n.statusChange && !n.newStatus && !n.status,
    }));

    // The most recent entry
    const latestNote = notes.length > 0 ? notes[notes.length - 1] : null;
    const currentStatus = ticket?.status || '';
    const currentColor = getStatusColor(currentStatus);

    return (
        <Card
            title={null}
            style={{ height: 'auto', padding: 0, overflow: 'hidden' }}
        >
            {/* Header */}
            <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '1rem 1.25rem 0.75rem',
                borderBottom: '1px solid var(--border)',
            }}>
                <span style={{
                    fontSize: '0.7rem',
                    fontWeight: 800,
                    letterSpacing: '0.12em',
                    textTransform: 'uppercase',
                    color: 'var(--text-secondary)',
                }}>
                    Historial de Estados
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    {currentStatus && (
                        <span style={{
                            fontSize: '0.8rem',
                            fontWeight: 700,
                            color: currentColor.text,
                        }}>
                            {currentStatus}
                            {latestNote?.date && (
                                <span style={{ color: 'var(--text-secondary)', fontWeight: 400, marginLeft: '0.4rem' }}>
                                    · {new Date(latestNote.date).toLocaleDateString('es-AR')}
                                </span>
                            )}
                        </span>
                    )}
                    <Button
                        size="xs"
                        variant="ghost"
                        onClick={() => setIsOpen(!isOpen)}
                        style={{ fontSize: '0.7rem', textTransform: 'uppercase', fontWeight: 700, padding: '2px 8px' }}
                    >
                        {isOpen ? 'Ocultar' : 'Ver todo'}
                    </Button>
                </div>
            </div>

            {/* Timeline */}
            {isOpen && (
                <div style={{ padding: '1rem 1.25rem', display: 'flex', flexDirection: 'column', gap: '0' }}>
                    {/* Ticket created entry */}
                    {[
                        {
                            status: 'Pendiente',
                            user: 'Sistema',
                            date: ticket.date || ticket.createdAt || '',
                            content: `Servicio creado: ${ticket.subject || ''}`,
                            isCreated: true,
                        },
                        ...[...notes].reverse().map(n => ({
                            status: n.statusChange || n.newStatus || n.status || extractStatus(n.content) || null,
                            user: n.user || n.author || 'Sistema',
                            date: n.date || n.createdAt || '',
                            content: n.content || '',
                            isNote: true,
                        }))
                    ].map((entry, idx, arr) => {
                        const color = getStatusColor(entry.status || currentStatus);
                        const isLast = idx === arr.length - 1;
                        return (
                            <div key={idx} style={{ display: 'flex', gap: '0.9rem', position: 'relative' }}>
                                {/* Left: dot + line */}
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0, width: '20px' }}>
                                    <div style={{
                                        width: '14px',
                                        height: '14px',
                                        borderRadius: '50%',
                                        backgroundColor: color.dot,
                                        flexShrink: 0,
                                        marginTop: '3px',
                                        boxShadow: `0 0 0 3px var(--card-bg)`,
                                        zIndex: 1,
                                    }} />
                                    {!isLast && (
                                        <div style={{
                                            width: '2px',
                                            flex: 1,
                                            minHeight: '28px',
                                            background: 'var(--border)',
                                            margin: '2px 0',
                                        }} />
                                    )}
                                </div>

                                {/* Right: content */}
                                <div style={{ flex: 1, paddingBottom: isLast ? 0 : '1rem' }}>
                                    {entry.status ? (
                                        <div style={{ fontWeight: 700, fontSize: '1rem', color: color.text, lineHeight: 1.2 }}>
                                            {entry.status}
                                        </div>
                                    ) : (
                                        <div style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--text-main)', lineHeight: 1.2 }}>
                                            {entry.content.length > 60 ? entry.content.substring(0, 60) + '…' : entry.content}
                                        </div>
                                    )}
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '3px', color: 'var(--text-secondary)', fontSize: '0.78rem' }}>
                                        <User size={11} />
                                        <span>{entry.user}</span>
                                    </div>
                                </div>

                                {/* Date on right */}
                                <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap', paddingTop: '3px', flexShrink: 0 }}>
                                    {formatDate(entry.date)}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {!isOpen && notes.length === 0 && (
                <div style={{ padding: '1rem 1.25rem', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                    Sin historial registrado.
                </div>
            )}
        </Card>
    );
}

function extractStatus(content) {
    if (!content) return null;
    const match = content.match(/Estado[:\s]+([^\n•·\-]+)/i);
    return match ? match[1].trim() : null;
}
