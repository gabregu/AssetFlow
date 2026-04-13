"use client";
import React, { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { useStore } from '../../../lib/store';
import { CheckCircle2, X } from 'lucide-react';

export function DeliveryNotificationListener() {
    const { currentUser } = useStore();
    const [notification, setNotification] = useState(null);
    const [notifiedIds, setNotifiedIds] = useState(() => {
        if (typeof window !== 'undefined') {
            const saved = localStorage.getItem('notified_task_ids');
            return saved ? new Set(JSON.parse(saved)) : new Set();
        }
        return new Set();
    });

    // Sincronizar con localStorage cada vez que cambie
    useEffect(() => {
        if (typeof window !== 'undefined') {
            localStorage.setItem('notified_task_ids', JSON.stringify([...notifiedIds]));
        }
    }, [notifiedIds]);

    useEffect(() => {
        // Permitir a Admins, Administrativos y Conductores (incluye alias)
        const role = (currentUser?.role || '').toLowerCase();
        const allowRole = ['admin', 'administrativo', 'conductor', 'driver', 'employee', 'staff', 'gerencial'].includes(role);
        
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
                    console.log("RECV Notification Payload (tickets):", payload);
                    const newData = payload.new;
                    const oldData = payload.old;
                    const role = (currentUser?.role || '').toLowerCase();

                    // 1. NOTIFICACIÓN PARA ADMINS/STAFF: Entrega realizada
                    if ((role === 'admin' || role === 'administrativo' || role === 'staff' || role === 'gerencial') && 
                        newData.delivery_status === 'Entregado' && oldData.delivery_status !== 'Entregado') {
                        
                        const clientName = newData.logistics?.receivedBy || newData.logistics?.received_by || 'Un Cliente';
                        
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
                    if (currentUser && (role === 'conductor' || role === 'driver' || role === 'employee')) {
                        const uName = (currentUser.name || '').trim().toLowerCase();
                        const uId = String(currentUser.id || currentUser.uid || currentUser.uuid || '');

                        // Verificar si EL TICKET PRINCIPAL fue asignado a mí
                        const newAssignedTo = newData.assigned_to || newData.logistics?.assigned_to || newData.logistics?.assignedTo;
                        const newDeliveryPerson = (newData.delivery_person || newData.logistics?.delivery_person || newData.logistics?.deliveryPerson || '').toLowerCase();
                        
                        const oldAssignedTo = oldData?.assigned_to || oldData?.logistics?.assigned_to || oldData?.logistics?.assignedTo;
                        const oldDeliveryPerson = (oldData?.delivery_person || oldData?.logistics?.delivery_person || oldData?.logistics?.deliveryPerson || '').toLowerCase();

                        const isMainAssignedToMe = String(newAssignedTo || '') === uId || newDeliveryPerson.includes(uName);
                        const wasMainAssignedToMe = String(oldAssignedTo || '') === uId || oldDeliveryPerson.includes(uName);

                        const newCases = newData.associated_assets || [];
                        
                        const myNewCase = newCases.find((c, idx) => {
                            const cAssignedTo = c.assigned_to || c.assignedTo;
                            const cDeliveryPerson = (c.delivery_person || c.deliveryPerson || '').toLowerCase();
                            
                            const isAssigned = (String(cAssignedTo) === uId) || (cDeliveryPerson.includes(uName));
                            if (!isAssigned) return false;
                            
                            if (!oldData || !oldData.associated_assets || !oldData.associated_assets[idx]) return true;
                            
                            const oldCase = oldData.associated_assets[idx];
                            const oldAssignedTo = oldCase.assigned_to || oldCase.assignedTo;
                            const oldDeliveryPerson = (oldCase.delivery_person || oldCase.deliveryPerson || '').toLowerCase();
                            
                            const wasAssigned = (String(oldAssignedTo) === uId) || (oldDeliveryPerson.includes(uName));
                            return !wasAssigned;
                        });

                        if ((isMainAssignedToMe && !wasMainAssignedToMe) || myNewCase) {
                            const eventIdx = myNewCase ? (myNewCase.caseNumber || String(newData.id)) : newData.id;
                            
                            if (!notifiedIds.has(eventIdx)) {
                                setNotification({
                                    type: 'assignment',
                                    title: '¡Nueva Asignación!',
                                    message: `Se te ha asignado un nuevo servicio:`,
                                    subMessage: myNewCase ? (myNewCase.subject || myNewCase.caseNumber) : newData.subject,
                                    timestamp: new Date().toLocaleTimeString(),
                                    forceReload: true
                                });
                                
                                setNotifiedIds(prev => {
                                    const next = new Set(prev);
                                    next.add(eventIdx);
                                    return next;
                                });
                                // Auto-ocultar después de 15 segundos
                                setTimeout(() => setNotification(null), 15000);
                            }
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
                    event: '*', // Escuchar INSERT y UPDATE
                    schema: 'public',
                    table: 'logistics_tasks',
                },
                (payload) => {
                    console.log("RECV Notification Payload (logistics_tasks):", payload);
                    const newTask = payload.new;
                    const oldTask = payload.old;

                    const role = (currentUser?.role || '').toLowerCase();
                    if (currentUser && (role === 'conductor' || role === 'driver' || role === 'employee')) {
                        const uName = (currentUser.name || '').trim().toLowerCase();
                        const uId = String(currentUser.id || currentUser.uid || currentUser.uuid || '');

                        const taskAssignedTo = String(newTask.assigned_to || '');
                        const taskDriverName = (newTask.delivery_person || '').toLowerCase();

                        const isAssignedToMe = (taskAssignedTo === uId && taskAssignedTo !== '') || (taskDriverName && (taskDriverName === uName || taskDriverName.includes(uName) || uName.includes(taskDriverName)));
                        
                        let shouldNotify = false;

                        if (payload.eventType === 'INSERT' && isAssignedToMe) {
                            shouldNotify = true;
                        } else if (payload.eventType === 'UPDATE') {
                            const oldAssignedTo = String(oldTask?.assigned_to || oldTask?.assignedTo || '');
                            const oldDriverName = (oldTask?.delivery_person || oldTask?.deliveryPerson || '').toLowerCase();
                            
                            const wasAssignedToMe = oldTask && (
                                (oldAssignedTo === uId && oldAssignedTo !== '') || 
                                (oldDriverName && (oldDriverName === uName || oldDriverName.includes(uName) || uName.includes(oldDriverName)))
                            );
                            
                            if (isAssignedToMe && !wasAssignedToMe) {
                                shouldNotify = true;
                            }
                        }

                        if (shouldNotify && !notifiedIds.has(newTask.id)) {
                            setNotification({
                                type: 'assignment',
                                title: '¡Nueva Tarea Asignada!',
                                message: `Se te ha asignado un nuevo caso individual (#${newTask.case_number || String(newTask.id).substring(0,8)}):`,
                                subMessage: newTask.subject || 'Entrega/Recupero de Equipo',
                                timestamp: new Date().toLocaleTimeString(),
                                forceReload: true
                            });
                            
                            setNotifiedIds(prev => {
                                const next = new Set(prev);
                                next.add(newTask.id);
                                return next;
                            });
                            // Auto-ocultar después de 15 segundos
                            setTimeout(() => setNotification(null), 15000);
                        }
                    }
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
            supabase.removeChannel(taskChannel);
        };
    }, [currentUser, notifiedIds]); // Add notifiedIds here too

    if (!notification) return null;

    return (
        <div style={{
            position: 'fixed',
            top: '20px',
            right: '20px',
            zIndex: 9999,
            backgroundColor: 'var(--surface)',
            borderLeft: `5px solid ${notification.type === 'assignment' ? '#3b82f6' : '#22c55e'}`,
            borderRadius: 'var(--radius-lg)',
            boxShadow: 'var(--shadow-md)',
            padding: '16px',
            maxWidth: '350px',
            border: '1px solid var(--border)',
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
                    <h4 style={{ margin: '0 0 4px 0', fontSize: '1rem', fontWeight: 700, color: 'var(--text-main)' }}>
                        {notification.title}
                    </h4>
                    <p style={{ margin: '0 0 8px 0', fontSize: '0.9rem', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
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
                        color: 'var(--text-secondary)'
                    }}
                >
                    <X size={16} />
                </button>
            </div>
        </div>
    );
}
