'use client';

import React, { useState, useEffect } from 'react';
import { Card } from '@/app/components/ui/Card';
import { Button } from '@/app/components/ui/Button';
import { StickyNote, Save, CheckCircle } from 'lucide-react';

export default function InstructionsCard({ ticket, editedData, setEditedData, updateTicket }) {
    const [localNotes, setLocalNotes] = useState(editedData.instructions || '');
    const [isSaving, setIsSaving] = useState(false);
    const [showSuccess, setShowSuccess] = useState(false);

    useEffect(() => {
        setLocalNotes(editedData.instructions || '');
    }, [editedData.instructions]);

    const handleSave = async () => {
        setIsSaving(true);
        const success = await updateTicket(ticket.id, { instructions: localNotes });
        setIsSaving(false);
        
        if (success !== false) {
            setShowSuccess(true);
            setTimeout(() => setShowSuccess(false), 3000);
            setEditedData(prev => ({ ...prev, instructions: localNotes }));
        }
    };

    const hasChanged = localNotes !== (editedData.instructions || '');

    return (
        <Card 
            title="Instrucciones y Notas Especiales" 
            action={<StickyNote size={20} style={{ color: 'var(--primary-color)', opacity: 0.8 }} />}
            style={{ borderLeft: '4px solid var(--primary-color)' }}
        >
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
                    Estas notas son visibles para los conductores en sus vistas de despacho. Ideales para instrucciones de entrega o detalles críticos.
                </p>
                
                <div style={{ position: 'relative' }}>
                    <textarea
                        placeholder="Escribir instrucciones claras para logística..."
                        className="form-textarea"
                        style={{ 
                            minHeight: '120px', 
                            width: '100%', 
                            padding: '1rem', 
                            fontSize: '0.95rem',
                            lineHeight: '1.5',
                            backgroundColor: 'var(--background-secondary)',
                            border: hasChanged ? '1px solid var(--primary-color)' : '1px solid var(--border)',
                            borderRadius: 'var(--radius-md)',
                            transition: 'all 0.2s ease'
                        }}
                        value={localNotes}
                        onChange={e => setLocalNotes(e.target.value)}
                    />
                    
                    {showSuccess && (
                        <div style={{ 
                            position: 'absolute', 
                            bottom: '10px', 
                            right: '10px', 
                            display: 'flex', 
                            alignItems: 'center', 
                            gap: '4px', 
                            color: '#10b981', 
                            fontSize: '0.8rem', 
                            fontWeight: 600,
                            backgroundColor: 'white',
                            padding: '4px 8px',
                            borderRadius: '20px',
                            boxShadow: 'var(--shadow-sm)'
                        }}>
                            <CheckCircle size={14} /> Guardado
                        </div>
                    )}
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <Button 
                        size="sm" 
                        icon={Save} 
                        disabled={!hasChanged || isSaving}
                        onClick={handleSave}
                    >
                        {isSaving ? 'Guardando...' : 'Actualizar Notas'}
                    </Button>
                </div>
            </div>
        </Card>
    );
}
