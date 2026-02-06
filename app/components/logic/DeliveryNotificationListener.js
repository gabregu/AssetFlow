"use client";
import React, { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { useStore } from '../../../lib/store';
import { CheckCircle2, X } from 'lucide-react';

export function DeliveryNotificationListener() {
    const { currentUser } = useStore();
    const [notification, setNotification] = useState(null);

    useEffect(() => {
        // Solo para usuarios Administrativos o Admins
        const allowRole = currentUser?.role === 'admin' || currentUser?.role === 'Administrativo';
        if (!currentUser || !allowRole) return;

        console.log("Iniciando escucha de entregas para:", currentUser.role);

        const channel = supabase
            .channel('delivery-notifications')
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'tickets',
                },
                (payload) => {
                    const newData = payload.new;
                    const oldData = payload.old;

                    // Verificar si el estado de entrega cambió a 'Entregado'
                    if (newData.deliveryStatus === 'Entregado' && oldData.deliveryStatus !== 'Entregado') {
                        console.log("¡Nueva entrega detectada!", newData);

                        // Extraer el nombre del cliente de logistics
                        // Nota: logistics es un JSONB, Supabase lo entrega como objeto JS
                        const clientName = newData.logistics?.receivedBy || 'Un Cliente';
                        const ticketId = newData.id;

                        setNotification({
                            clientName,
                            ticketId,
                            timestamp: new Date().toLocaleTimeString()
                        });

                        // Auto-ocultar después de 10 segundos
                        setTimeout(() => {
                            setNotification(null);
                        }, 10000);
                    }
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [currentUser]);

    if (!notification) return null;

    return (
        <div style={{
            position: 'fixed',
            top: '20px',
            right: '20px',
            zIndex: 9999,
            backgroundColor: 'white',
            borderLeft: '5px solid #22c55e',
            borderRadius: '8px',
            boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
            padding: '16px',
            maxWidth: '350px',
            animation: 'slideIn 0.5s ease-out'
        }}>
            <style jsx>{`
                @keyframes slideIn {
                    from { transform: translateX(100%); opacity: 0; }
                    to { transform: translateX(0); opacity: 1; }
                }
            `}</style>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                <div style={{
                    backgroundColor: '#dcfce7',
                    padding: '8px',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                }}>
                    <CheckCircle2 size={24} color="#15803d" />
                </div>
                <div style={{ flex: 1 }}>
                    <h4 style={{ margin: '0 0 4px 0', fontSize: '1rem', fontWeight: 700, color: '#111' }}>
                        ¡Entrega Realizada!
                    </h4>
                    <p style={{ margin: '0 0 8px 0', fontSize: '0.9rem', color: '#4b5563', lineHeight: '1.4' }}>
                        Se ha completado la entrega del ticket <strong>#{notification.ticketId}</strong> a:
                    </p>
                    <p style={{ margin: '0', fontSize: '1rem', fontWeight: 600, color: '#15803d' }}>
                        {notification.clientName}
                    </p>
                    <span style={{ fontSize: '0.75rem', color: '#9ca3af', marginTop: '8px', display: 'block' }}>
                        {notification.timestamp}
                    </span>
                </div>
                <button
                    onClick={() => setNotification(null)}
                    style={{
                        background: 'transparent',
                        border: 'none',
                        cursor: 'pointer',
                        padding: '4px',
                        color: '#9ca3af'
                    }}
                >
                    <X size={16} />
                </button>
            </div>
        </div>
    );
}
