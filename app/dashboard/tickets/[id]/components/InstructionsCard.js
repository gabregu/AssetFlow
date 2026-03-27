'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Card } from '@/app/components/ui/Card';
import { Button } from '@/app/components/ui/Button';
import { Send, StickyNote, User } from 'lucide-react';

export default function InstructionsCard({ ticket, editedData, setEditedData, updateTicket, currentUser }) {
    const [msgText, setMsgText] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const chatEndRef = useRef(null);

    const chatLog = editedData.chatLog || [];

    useEffect(() => {
        scrollToBottom();
    }, [chatLog]);

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

    const handleKeyPress = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSendMessage();
        }
    };

    return (
        <Card 
            title="Chat y Coordinación" 
            action={<StickyNote size={20} style={{ color: 'var(--primary-color)', opacity: 0.8 }} />}
            style={{ 
                borderLeft: '4px solid var(--primary-color)',
                height: '500px',
                display: 'flex',
                flexDirection: 'column'
            }}
        >
            <div style={{ 
                flex: 1, 
                overflowY: 'auto', 
                marginBottom: '1rem', 
                padding: '1rem', 
                backgroundColor: 'var(--background-secondary)',
                borderRadius: '8px',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px'
            }}>
                {chatLog.length === 0 ? (
                    <div style={{ textAlign: 'center', color: 'var(--text-secondary)', marginTop: '2rem', fontSize: '0.9rem', fontStyle: 'italic' }}>
                        No hay mensajes aún. Envía una instrucción o consulta para el conductor.
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
                                    padding: '0.75rem 1rem', 
                                    borderRadius: isMe ? '18px 18px 2px 18px' : '18px 18px 18px 2px',
                                    backgroundColor: isMe ? 'var(--primary-color)' : 'white',
                                    color: isMe ? 'white' : 'var(--text-main)',
                                    fontSize: '0.9rem',
                                    lineHeight: '1.4',
                                    boxShadow: 'var(--shadow-sm)',
                                    border: isMe ? 'none' : '1px solid var(--border)'
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
                gap: '0.75rem', 
                alignItems: 'flex-end',
                paddingTop: '0.5rem',
                borderTop: '1px solid var(--border)'
            }}>
                <textarea
                    placeholder="Escribir mensaje..."
                    style={{ 
                        flex: 1,
                        minHeight: '44px',
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
                    style={{ borderRadius: '50%', width: '44px', height: '44px', flexShrink: 0 }}
                />
            </div>
        </Card>
    );
}
