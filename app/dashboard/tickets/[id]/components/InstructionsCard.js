'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Card } from '@/app/components/ui/Card';
import { Button } from '@/app/components/ui/Button';
import { Send, StickyNote, User, Info, Edit3, X, Save } from 'lucide-react';

export default function InstructionsCard({ ticket, editedData, setEditedData, updateTicket, currentUser }) {
    const [msgText, setMsgText] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [isEditingContext, setIsEditingContext] = useState(false);
    const [tempContext, setTempContext] = useState(editedData.instructions || '');
    const chatEndRef = useRef(null);

    const chatLog = editedData.chatLog || [];

    useEffect(() => {
        scrollToBottom();
    }, [chatLog]);

    useEffect(() => {
        setTempContext(editedData.instructions || '');
    }, [editedData.instructions]);

    const scrollToBottom = () => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    const handleSendMessage = async () => {
        if (!msgText.trim()) return;

        setIsSaving(true);
        console.log("Enviando mensaje de chat para ticket:", ticket.id);
        
        const newMessage = {
            id: Date.now(),
            user: currentUser?.name || 'Usuario',
            role: currentUser?.role || 'admin',
            text: msgText,
            timestamp: new Date().toISOString()
        };

        const updatedChat = [...chatLog, newMessage];
        
        try {
            const success = await updateTicket(ticket.id, { chatLog: updatedChat });

            if (success) {
                console.log("Chat guardado exitosamente en DB");
                setEditedData(prev => ({ ...prev, chatLog: updatedChat }));
                setMsgText('');
            } else {
                console.error("Fallo al guardar chat en DB (updateTicket devuelto false)");
                alert("Error: No se pudo guardar el mensaje. Verifique su conexión.");
            }
        } catch (err) {
            console.error("Error crítico enviando chat:", err);
            alert("Error al enviar mensaje: " + err.message);
        } finally {
            setIsSaving(false);
        }
    };

    const handleSaveContext = async () => {
        setIsSaving(true);
        const success = await updateTicket(ticket.id, { 
            instructions: tempContext,
            instructionsUpdatedBy: currentUser?.name || 'Sistema'
        });
        
        if (success !== false) {
            setEditedData(prev => ({ 
                ...prev, 
                instructions: tempContext, 
                instructionsUpdatedBy: currentUser?.name || 'Sistema' 
            }));
            setIsEditingContext(false);
        }
        setIsSaving(false);
    };

    const handleKeyPress = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSendMessage();
        }
    };
    return (
        <Card 
            title="Instrucciones y Notas Especiales" 
            action={<StickyNote size={20} style={{ color: 'var(--primary-color)', opacity: 0.8 }} />}
            style={{ 
                borderLeft: '4px solid var(--primary-color)',
                display: 'flex',
                flexDirection: 'column',
                height: '450px',
                overflow: 'hidden' // Importante para que el contenido no se escape
            }}
        >
            <div style={{ 
                display: 'flex', 
                flexDirection: 'column', 
                height: '100%', 
                overflow: 'hidden',
                padding: '0.25rem' 
            }}>
                {/* 1. FIXED CONTEXT (Permanent notes) - Tipografía más chica */}
                <div style={{ 
                    marginBottom: '0.75rem', 
                    backgroundColor: 'var(--background-secondary)',
                    border: '1px dashed var(--primary-color)',
                    borderRadius: '8px',
                    padding: '0.5rem',
                    flexShrink: 0 // No se achica
                }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2px' }}>
                        <div style={{ fontSize: '0.65rem', fontWeight: 800, color: 'var(--primary-color)', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <Info size={10} /> Instrucción General
                        </div>
                        {!isEditingContext ? (
                            <button 
                                onClick={() => setIsEditingContext(true)}
                                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', opacity: 0.6 }}
                            >
                                <Edit3 size={12} />
                            </button>
                        ) : (
                            <div style={{ display: 'flex', gap: '6px' }}>
                                <button onClick={() => setIsEditingContext(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444' }}><X size={12} /></button>
                                <button onClick={handleSaveContext} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#10b981' }}><Save size={12} /></button>
                            </div>
                        )}
                    </div>
                    
                    {isEditingContext ? (
                        <textarea 
                            style={{ width: '100%', border: 'none', background: 'white', borderRadius: '4px', padding: '4px', fontSize: '0.8rem', resize: 'none', minHeight: '50px' }}
                            value={tempContext}
                            onChange={e => setTempContext(e.target.value)}
                            autoFocus
                        />
                    ) : (
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-main)', lineHeight: '1.3', fontStyle: tempContext ? 'normal' : 'italic' }}>
                            {tempContext || 'Toca el ícono para agregar instrucción.'}
                        </div>
                    )}
                    
                    {editedData.instructionsUpdatedBy && !isEditingContext && (
                        <div style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', opacity: 0.6, marginTop: '4px', textAlign: 'right' }}>
                            Modificado por {editedData.instructionsUpdatedBy}
                        </div>
                    )}
                </div>

                {/* 2. CHAT LOG - Tipografía REDUCIDA para que entre más */}
                <div style={{ 
                    flex: 1, 
                    overflowY: 'auto', 
                    marginBottom: '0.5rem', 
                    padding: '0.5rem', 
                    backgroundColor: 'rgba(0,0,0,0.01)',
                    borderRadius: '8px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px'
                }}>
                    {chatLog.length === 0 ? (
                        <div style={{ textAlign: 'center', color: 'var(--text-secondary)', marginTop: '2rem', fontSize: '0.8rem', fontStyle: 'italic' }}>
                            Sin mensajes aún.
                        </div>
                    ) : (
                        chatLog.map((msg, idx) => {
                            const isMe = msg.user === currentUser?.name;
                            return (
                                <div 
                                    key={msg.id || idx} 
                                    style={{ 
                                        alignSelf: isMe ? 'flex-end' : 'flex-start',
                                        maxWidth: '92%',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        alignItems: isMe ? 'flex-end' : 'flex-start'
                                    }}
                                >
                                    <div style={{ 
                                        display: 'flex', 
                                        alignItems: 'center', 
                                        gap: '4px', 
                                        marginBottom: '1px',
                                        fontSize: '0.6rem',
                                        color: 'var(--text-secondary)',
                                        opacity: 0.8,
                                        fontWeight: 600
                                    }}>
                                        {msg.user} • {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </div>
                                    <div style={{ 
                                        padding: '0.4rem 0.6rem', 
                                        borderRadius: isMe ? '12px 12px 2px 12px' : '12px 12px 12px 2px',
                                        backgroundColor: isMe ? 'var(--primary-color)' : 'white',
                                        color: isMe ? 'white' : 'var(--text-main)',
                                        fontSize: '0.78rem', // REDUCIDA
                                        lineHeight: '1.3',
                                        boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
                                        border: isMe ? 'none' : '1px solid #e2e8f0'
                                    }}>
                                        {msg.text}
                                    </div>
                                </div>
                            );
                        })
                    )}
                    <div ref={chatEndRef} />
                </div>

                {/* 3. INPUT - Siempre visible al fondo */}
                <div style={{ 
                    display: 'flex', 
                    gap: '0.4rem', 
                    alignItems: 'center',
                    padding: '0.25rem 0',
                    borderTop: '1px solid #f1f5f9',
                    flexShrink: 0,
                    backgroundColor: 'white'
                }}>
                    <textarea
                        placeholder="Escribir..."
                        style={{ 
                            flex: 1,
                            height: '34px',
                            minHeight: '34px',
                            padding: '8px 12px',
                            borderRadius: '17px',
                            border: '1px solid var(--border)',
                            backgroundColor: '#f8fafc',
                            fontSize: '0.8rem',
                            lineHeight: '1',
                            resize: 'none',
                            outline: 'none'
                        }}
                        value={msgText}
                        onChange={e => setMsgText(e.target.value)}
                        onKeyPress={handleKeyPress}
                    />
                    <Button 
                        icon={Send} 
                        size="icon"
                        disabled={!msgText.trim() || isSaving}
                        onClick={handleSendMessage}
                        style={{ borderRadius: '50%', width: '34px', height: '34px', flexShrink: 0 }}
                    />
                </div>
            </div>
        </Card>
    );
}
