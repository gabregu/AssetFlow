"use client";
import React, { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { useStore } from '../../../lib/store';
import { CheckCircle2, X } from 'lucide-react';

export function DeliveryNotificationListener() {
    const { currentUser } = useStore();
    const [notification, setNotification] = useState(null);

    useEffect(() => {
        // Permitir a Admins, Administrativos y Conductores
        const allowRole = currentUser?.role === 'admin' || currentUser?.role === 'Administrativo' || currentUser?.role === 'Conductor';
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

                    // 1. NOTIFICACIÓN PARA ADMINS: Entrega realizada
                    if ((currentUser.role === 'admin' || currentUser.role === 'Administrativo') && 
                        newData.deliveryStatus === 'Entregado' && oldData.deliveryStatus !== 'Entregado') {
                        
                        const clientName = newData.logistics?.receivedBy || 'Un Cliente';
                        
                        setNotification({
                            type: 'delivery',
                            title: '¡Entrega Realizada!',
                            message: `Se ha completado la entrega del ticket #${newData.id} a:`,
                            subMessage: clientName,
                            timestamp: new Date().toLocaleTimeString()
                        });

                        setTimeout(() => setNotification(null), 10000);
                        return;
                    }

                    // 2. NOTIFICACIÓN PARA CONDUCTORES: Nueva Asignación
                    if (currentUser.role === 'Conductor') {
                        const uName = (currentUser.name || '').toLowerCase();
                        const uId = currentUser.id || currentUser.uid;

                        // Verificar si EL TICKET PRINCIPAL fue asignado a mí
                        const isMainAssignedToMe = (newData.assigned_to === uId) || (newData.delivery_person?.toLowerCase().includes(uName));
                        const wasMainAssignedToMe = (oldData.assigned_to === uId) || (oldData.delivery_person?.toLowerCase().includes(uName));

                        // Verificar si ALGÚN CASO ASOCIADO fue asignado a mí (Estructura Legacy)
                        const newCases = newData.associatedCases || [];
                        const oldCases = oldData.associatedCases || [];
                        
                        const myNewCase = newCases.find((c, idx) => {
                            const isAssigned = c.assigned_to === uId || c.delivery_person?.toLowerCase().includes(uName);
                            if (!isAssigned) return false;
                            
                            // Verificar si YA estaba asignado en el estado anterior
                            const wasAssigned = oldCases[idx] && (oldCases[idx].assigned_to === uId || oldCases[idx].delivery_person?.toLowerCase().includes(uName));
                            return !wasAssigned;
                        });

                        if ((isMainAssignedToMe && !wasMainAssignedToMe) || myNewCase) {
                            setNotification({
                                type: 'assignment',
                                title: '¡Nueva Asignación!',
                                message: `Se te ha asignado un nuevo servicio:`,
                                subMessage: myNewCase ? (myNewCase.subject || myNewCase.caseNumber) : newData.subject,
                                timestamp: new Date().toLocaleTimeString(),
                                forceReload: true
                            });
                            // No auto-ocultar para que el conductor vea el aviso sí o sí
                        }
                    }
                }
            )
            .subscribe();

        const taskChannel = supabase
            .channel('task-notifications')
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'logistics_tasks',
                },
                (payload) => {
                    const newTask = payload.new;
                    const oldTask = payload.old;

                    if (currentUser.role === 'Conductor') {
                        const uName = (currentUser.name || '').toLowerCase();
                        const uId = currentUser.id || currentUser.uid;

                        const isAssignedToMe = (newTask.assigned_to === uId) || (newTask.delivery_person?.toLowerCase().includes(uName));
                        const wasAssignedToMe = (oldTask.assigned_to === uId) || (oldTask.delivery_person?.toLowerCase().includes(uName));

                        if (isAssignedToMe && !wasAssignedToMe) {
                            setNotification({
                                type: 'assignment',
                                title: '¡Nueva Tarea Asignada!',
                                message: `Se te ha asignado un nuevo caso individual (#${newTask.case_number || newTask.id.substring(0,8)}):`,
                                subMessage: newTask.subject || 'Entrega/Recupero de Equipo',
                                timestamp: new Date().toLocaleTimeString(),
                                forceReload: true
                            });
                        }
                    }
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
            supabase.removeChannel(taskChannel);
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
                    backgroundColor: notification.type === 'assignment' ? '#eff6ff' : '#dcfce7',
                    padding: '8px',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                }}>
                    <CheckCircle2 size={24} color={notification.type === 'assignment' ? '#3b82f6' : '#15803d'} />
                </div>
                <div style={{ flex: 1 }}>
                    <h4 style={{ margin: '0 0 4px 0', fontSize: '1rem', fontWeight: 700, color: '#111' }}>
                        {notification.title}
                    </h4>
                    <p style={{ margin: '0 0 8px 0', fontSize: '0.9rem', color: '#4b5563', lineHeight: '1.4' }}>
                        {notification.message}
                    </p>
                    <p style={{ margin: '0', fontSize: '1rem', fontWeight: 600, color: notification.type === 'assignment' ? '#3b82f6' : '#15803d' }}>
                        {notification.subMessage}
                    </p>
                    <span style={{ fontSize: '0.75rem', color: '#9ca3af', marginTop: '8px', display: 'block' }}>
                        {notification.timestamp}
                    </span>
                    
                    {notification.forceReload && (
                        <button
                            onClick={() => window.location.reload()}
                            style={{
                                marginTop: '12px',
                                width: '100%',
                                padding: '8px',
                                backgroundColor: '#3b82f6',
                                color: 'white',
                                border: 'none',
                                borderRadius: '6px',
                                fontWeight: 700,
                                fontSize: '0.85rem',
                                cursor: 'pointer',
                                boxShadow: '0 4px 6px -1px rgba(59, 130, 246, 0.5)'
                            }}
                        >
                            Refrescar Lista
                        </button>
                    )}
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
