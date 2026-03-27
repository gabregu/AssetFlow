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
        const newMessage = {
            id: Date.now(),
            user: currentUser?.name || 'Usuario',
            role: currentUser?.role || 'admin',
            text: msgText,
            timestamp: new Date().toISOString()
        };

        const updatedChat = [...chatLog, newMessage];
        const success = await updateTicket(ticket.id, { chatLog: updatedChat });

        if (success !== false) {
            setEditedData(prev => ({ ...prev, chatLog: updatedChat }));
            setMsgText('');
        }
        setIsSaving(false);
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
                minHeight: '500px',
                height: typeof window !== 'undefined' && window.innerWidth < 768 ? '500px' : '600px',
                display: 'flex',
                flexDirection: 'column'
            }}
        >
            {/* FIXED CONTEXT (Permanent notes) */}
            <div style={{ 
                marginBottom: '1rem', 
                backgroundColor: 'var(--background-secondary)',
                border: '1px dashed var(--primary-color)',
                borderRadius: '8px',
                padding: '0.75rem',
                position: 'relative'
            }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                    <div style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--primary-color)', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Info size={12} /> Instrucción General (Contexto Permanente)
                    </div>
                    {!isEditingContext ? (
                        <button 
                            onClick={() => setIsEditingContext(true)}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', opacity: 0.6 }}
                        >
                            <Edit3 size={14} />
                        </button>
                    ) : (
                        <div style={{ display: 'flex', gap: '8px' }}>
                            <button onClick={() => setIsEditingContext(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444' }}><X size={14} /></button>
                            <button onClick={handleSaveContext} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#10b981' }}><Save size={14} /></button>
                        </div>
                    )}
                </div>
                
                {isEditingContext ? (
                    <textarea 
                        style={{ width: '100%', border: 'none', background: 'white', borderRadius: '4px', padding: '4px', fontSize: '0.85rem', resize: 'vertical', minHeight: '60px' }}
                        value={tempContext}
                        onChange={e => setTempContext(e.target.value)}
                        autoFocus
                    />
                ) : (
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-main)', lineHeight: '1.4', fontStyle: tempContext ? 'normal' : 'italic' }}>
                        {tempContext || 'Toca el ícono de edición para agregar una instrucción fija para el conductor.'}
                    </div>
                )}
                
                {editedData.instructionsUpdatedBy && !isEditingContext && (
                    <div style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', opacity: 0.6, marginTop: '4px', textAlign: 'right' }}>
                        Modificado por {editedData.instructionsUpdatedBy}
                    </div>
                )}
            </div>

            {/* CHAT LOG */}
            <div style={{ 
                flex: 1, 
                overflowY: 'auto', 
                marginBottom: '1rem', 
                padding: '0.75rem', 
                backgroundColor: 'rgba(0,0,0,0.02)',
                borderRadius: '8px',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px'
            }}>
                {chatLog.length === 0 ? (
                    <div style={{ textAlign: 'center', color: 'var(--text-secondary)', marginTop: '2rem', fontSize: '0.9rem', fontStyle: 'italic' }}>
                        No hay interacción por chat aún.
                    </div>
                ) : (
                    chatLog.map((msg, idx) => {
                        const isMe = msg.user === currentUser?.name;
                        return (
                            <div 
                                key={msg.id || idx} 
                                style={{ 
                                    alignSelf: isMe ? 'flex-end' : 'flex-start',
                                    maxWidth: '85%',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: isMe ? 'flex-end' : 'flex-start'
                                }}
                            >
                                <div style={{ 
                                    display: 'flex', 
                                    alignItems: 'center', 
                                    gap: '6px', 
                                    marginBottom: '4px',
                                    fontSize: '0.7rem',
                                    color: 'var(--text-secondary)',
                                    opacity: 0.7,
                                    fontWeight: 500
                                }}>
                                    {!isMe && <User size={10} />}
                                    {msg.user} 
                                    <span style={{ fontWeight: 400, opacity: 0.6 }}>
                                        • {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                </div>
                                <div style={{ 
                                    padding: '0.7rem 0.9rem', 
                                    borderRadius: isMe ? '18px 18px 2px 18px' : '18px 18px 18px 2px',
                                    backgroundColor: isMe ? 'var(--primary-color)' : 'white',
                                    color: isMe ? 'white' : 'var(--text-main)',
                                    fontSize: '0.88rem',
                                    lineHeight: '1.4',
                                    boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
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

            <div style={{ 
                display: 'flex', 
                gap: '0.6rem', 
                alignItems: 'flex-end',
                paddingTop: '0.5rem',
                borderTop: '1px solid var(--border)'
            }}>
                <textarea
                    placeholder="Escribir mensaje de chat..."
                    style={{ 
                        flex: 1,
                        minHeight: '40px',
                        maxHeight: '100px',
                        padding: '10px 14px',
                        borderRadius: '20px',
                        border: '1px solid var(--border)',
                        backgroundColor: 'white',
                        fontSize: '0.9rem',
                        lineHeight: '1.4',
                        resize: 'none'
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
                    style={{ borderRadius: '50%', width: '40px', height: '40px', flexShrink: 0 }}
                />
            </div>
        </Card>
    );
}
