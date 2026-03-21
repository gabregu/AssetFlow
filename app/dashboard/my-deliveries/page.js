"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { 
    Truck, 
    Calendar, 
    Clock, 
    MapPin, 
    CheckCircle2, 
    ChevronRight, 
    Search,
    Filter,
    Navigation,
    Package,
    AlertCircle,
    User,
    ClipboardList,
    TrendingUp,
    BarChart3,
    ArrowUpRight
} from 'lucide-react';
import { Card } from '@/app/components/ui/Card';
import { Badge } from '@/app/components/ui/Badge';
import { Button } from '@/app/components/ui/Button';
import { Modal } from '@/app/components/ui/Modal';
import { useStore } from '../../../lib/store';

export default function MyDeliveriesPage() {
    const { 
        tickets, 
        currentUser, 
        updateTicket, 
        logisticsTasks, 
        updateLogisticsTask 
    } = useStore();
    const [searchTerm, setSearchTerm] = useState('');
    const [filterStatus, setFilterStatus] = useState('En Transito'); // Solo activos por defecto
    const [selectedDelivery, setSelectedDelivery] = useState(null);
    const [isDeliveryModalOpen, setIsDeliveryModalOpen] = useState(null);
    const [optimizedOrder, setOptimizedOrder] = useState([]);
    
    // Stats state
    const [stats, setStats] = useState({
        finishedThisMonth: 0,
        pendingThisWeek: 0,
        last6Months: []
    });

    const [toast, setToast] = useState({ show: false, message: '', type: 'success' });

    const showToast = (message, type = 'success') => {
        setToast({ show: true, message, type });
        setTimeout(() => setToast({ show: false, message: '', type: 'success' }), 5000);
    };

    const [deliveryForm, setDeliveryForm] = useState({
        receivedBy: '',
        dni: '',
        notes: '',
        actualTime: '',
        photoUrl: null
    });

    // 1. APLANAR DATOS: Convertir las tareas relacionales en una lista de Entregas individuales
    const myAssignedDeliveries = useMemo(() => {
        if (!currentUser) return [];
        
        const items = [];
        const uName = (currentUser?.name || '').toLowerCase();
        const uUid = String(currentUser?.id || currentUser?.uid || currentUser?.uuid);

        // Permitir a cualquier usuario asignado ver sus entregas en esta vista
        if (!currentUser) return [];
        
        // 1. Procesar tareas de la nueva tabla relacional
        logisticsTasks.forEach(task => {
            const driverName = (task.delivery_person || '').toLowerCase();
            const driverUid = String(task.assigned_to || '');
            
            // FILTRO: Solo si está asignado a MÍ
            const isAssignedByName = driverName && (driverName === uName || uName.includes(driverName) || driverName.includes(uName));
            const isAssignedByUid = driverUid && (driverUid === uUid);
            
            if (isAssignedByName || isAssignedByUid) {
                // Solo mostrar los activos (En Tránsito o Para Coordinar) o los recientemente entregados si se filtran
                const isRelevant = task.status === 'En Transito' || task.status === 'Para Coordinar' || task.status === 'Entregado';
                
                if (isRelevant) {
                    const parentTicket = tickets.find(t => t.id === task.ticket_id);
                    
                    items.push({
                        ...parentTicket, // Datos base del ticket
                        id: parentTicket?.id,
                        taskId: task.id,
                        isMainTicket: false, // Ahora todo se trata como tarea individual
                        displayId: task.case_number || (parentTicket?.id?.substring(0, 8)),
                        displaySubject: task.subject || parentTicket?.subject,
                        displayAddress: task.address || parentTicket?.logistics?.address,
                        displayStatus: task.status || 'Pendiente',
                        displayDate: task.date,
                        requester: parentTicket?.requester || 'Destinatario',
                        timeSlot: task.time_slot || task.timeSlot,
                        deliveryOrder: task.deliveryOrder || 0,
                        taskAssets: task.assets || [],
                        taskAccessories: task.accessories || [],
                        taskYubikeys: task.yubikeys || []
                    });
                }
            }
        });

        // 2. Compatibilidad Legacy: Buscar en tickets y sus casos asociados anidados
        tickets.forEach(t => {
            const hasNewTasks = logisticsTasks.some(tk => tk.ticket_id === t.id);
            if (hasNewTasks) return; // Si ya tiene tareas nuevas, ignoramos el modo legacy

            // A. Revisar el ticket principal
            const tDriverName = (t.logistics?.delivery_person || t.logistics?.deliveryPerson || '').toLowerCase();
            const tDriverUid = t.logistics?.assigned_to || t.logistics?.assignedTo;
            const isTicketAssigned = (tDriverName && (tDriverName === uName || uName.includes(tDriverName) || tDriverName.includes(uName))) || 
                                     (tDriverUid && (tDriverUid === uUid));
            
            if (isTicketAssigned && t.logistics?.status === 'En Transito') {
                items.push({
                    ...t,
                    isMainTicket: true,
                    displayId: t.id,
                    displaySubject: t.subject,
                    displayAddress: t.logistics?.address,
                    displayStatus: t.logistics?.status || 'Pendiente',
                    displayDate: t.logistics?.date
                });
            }

            // B. REVISAR CASOS ASOCIADOS LEGACY (Unificado por normalizador ahora)
            if (t.associatedCases && Array.isArray(t.associatedCases)) {
                t.associatedCases.forEach((c, idx) => {
                    const cDriverName = (c.delivery_person || '').toLowerCase();
                    const cDriverUid = String(c.assigned_to || '');
                    const isCaseAssigned = (cDriverName && (cDriverName === uName || uName.includes(cDriverName) || cDriverName.includes(uName))) || 
                                           (cDriverUid && (cDriverUid === uUid));
                    
                    if (isCaseAssigned) {
                        const cStatus = c.logistics?.status || 'Pendiente';
                        if (cStatus === 'En Transito' || cStatus === 'Para Coordinar' || cStatus === 'Entregado') {
                            items.push({
                                ...t, // Datos del ticket padre
                                id: t.id,
                                legacyCaseIndex: idx,
                                isMainTicket: false,
                                displayId: c.caseNumber || c.case_number || `${t.id.substring(0,8)}-${idx}`,
                                displaySubject: c.subject || t.subject,
                                displayAddress: c.logistics?.address || t.logistics?.address,
                                displayStatus: cStatus,
                                displayDate: c.logistics?.date,
                                requester: c.requester || t.requester,
                                timeSlot: c.logistics?.timeSlot || 'AM',
                                taskAssets: c.assets || [],
                                taskAccessories: c.accessories || []
                            });
                        }
                    }
                });
            }
        });

        // Aplicar orden optimizado si existe
        if (optimizedOrder.length > 0) {
            return [...items].sort((a, b) => {
                const idxA = optimizedOrder.indexOf(a.displayId);
                const idxB = optimizedOrder.indexOf(b.displayId);
                if (idxA !== -1 && idxB !== -1) return idxA - idxB;
                return 0;
            });
        }

        return items;
    }, [tickets, currentUser, optimizedOrder, logisticsTasks]);

    // 2. CALCULAR ESTADÍSTICAS (Basadas en los datos aplanados)
    useEffect(() => {
        if (!currentUser) return;

        // Contar completados este mes
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        
        // Pendientes esta semana
        const startOfWeek = new Date(now);
        startOfWeek.setDate(now.getDate() - now.getDay());
        const endOfWeek = new Date(startOfWeek);
        endOfWeek.setDate(endOfWeek.getDate() + 6);

        let finishedThisMonthCount = 0;
        let pendingThisWeekCount = 0;

        const uName = (currentUser.name || '').toLowerCase();

        // Recorrer las tareas asignadas
        logisticsTasks.forEach(task => {
            const isMine = (task.assigned_to || task.assignedTo) === currentUser.id || 
                           (task.assigned_to || task.assignedTo) === currentUser.uuid ||
                           ((task.delivery_person || task.deliveryPerson)?.toLowerCase() === uName);
            
            if (!isMine) return;

            if (task.status === 'Entregado' || task.status === 'Finalizado') {
                const updatedAt = task.updated_at ? new Date(task.updated_at) : new Date();
                if (updatedAt >= startOfMonth) finishedThisMonthCount++;
            } else if (task.status === 'En Transito' || task.status === 'Para Coordinar') {
                const deliveryDate = task.date ? new Date(task.date + 'T00:00:00') : null;
                if (deliveryDate && deliveryDate >= startOfWeek && deliveryDate <= endOfWeek) {
                    pendingThisWeekCount++;
                }
            }
        });

        // Simular historial de los últimos 6 meses (idealmente vendría de DB)
        const last6 = [];
        for (let i = 5; i >= 0; i--) {
            const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
            last6.push({
                label: date.toLocaleString('default', { month: 'short' }),
                count: Math.floor(Math.random() * 20) + 10 // Placeholder
            });
        }

        setStats({
            finishedThisMonth: finishedThisMonthCount,
            pendingThisWeek: pendingThisWeekCount,
            last6Months: last6
        });
    }, [tickets, currentUser, myAssignedDeliveries]);

    // 3. AGRUPAR POR FECHA
    const groupedDeliveries = useMemo(() => {
        const groups = {};
        
        myAssignedDeliveries.forEach(delivery => {
            const date = delivery.displayDate || 'Sin Fecha';
            if (!groups[date]) groups[date] = [];
            groups[date].push(delivery);
        });

        // Ordenar fechas cronológicamente
        return Object.keys(groups)
            .sort((a, b) => {
                if (a === 'Sin Fecha') return 1;
                if (b === 'Sin Fecha') return -1;
                return new Date(a) - new Date(b);
            })
            .reduce((acc, key) => {
                acc[key] = groups[key];
                return acc;
            }, {});
    }, [myAssignedDeliveries]);

    const handleDeliverySubmit = async (e) => {
        e.preventDefault();
        
        if (!deliveryForm.receivedBy || !deliveryForm.dni) {
            showToast('Nombre y DNI son obligatorios', 'error');
            return;
        }

        try {
            // Lógica para actualizar usando la nueva tabla de tareas
            if (selectedDelivery.taskId) {
                // Actualizar la tarea relacional directamente
                await updateLogisticsTask(selectedDelivery.taskId, {
                    status: 'Entregado',
                    deliveryInfo: {
                        receivedBy: deliveryForm.receivedBy,
                        dni: deliveryForm.dni,
                        notes: deliveryForm.notes,
                        deliveredAt: new Date().toISOString(),
                        actualTime: deliveryForm.actualTime
                    }
                });
            } else if (selectedDelivery.isMainTicket) {
                // Caso legacy: Ticket principal sin tareas asignadas
                const updatedLogistics = {
                    ...selectedDelivery.logistics,
                    status: 'Entregado',
                    deliveryInfo: {
                        receivedBy: deliveryForm.receivedBy,
                        dni: deliveryForm.dni,
                        notes: deliveryForm.notes,
                        deliveredAt: new Date(),
                        actualTime: deliveryForm.actualTime
                    }
                };
                await updateTicket(selectedDelivery.id, { logistics: updatedLogistics });
            }
            
            
            showToast('Entrega registrada correctamente', 'success');
            setIsDeliveryModalOpen(false);
            setDeliveryForm({ receivedBy: '', dni: '', notes: '', actualTime: '' });
        } catch (error) {
            console.error('Error al registrar entrega:', error);
            showToast('Error al guardar los datos', 'error');
        }
    };

    const openGoogleMaps = (address) => {
        if (!address) return;
        window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`, '_blank');
    };

    const getColorByDate = (dateStr) => {
        if (dateStr === 'Sin Fecha') return '#94a3b8';
        const today = new Date().toISOString().split('T')[0];
        if (dateStr === today) return '#3b82f6'; // Azul hoy
        if (dateStr < today) return '#ef4444'; // Rojo retrasado
        return '#10b981'; // Verde futuro
    };

    // Ayudante para resumir contenido
    const getDevicesList = (delivery) => {
        const list = [];
        if (delivery.taskId) {
            // Nueva arquitectura: usar datos de la tarea
            if (delivery.taskAssets?.length > 0) list.push(`${delivery.taskAssets.length} Equipos`);
            if (delivery.taskAccessories?.length > 0) list.push(`${delivery.taskAccessories.length} Accesorios`);
            if (delivery.taskYubikeys?.length > 0) list.push(`${delivery.taskYubikeys.length} YubiKeys`);
        } else if (delivery.isMainTicket) {
            if (delivery.assetInfo?.serial) list.push(`${delivery.assetInfo.model || 'Equipo'} - ${delivery.assetInfo.serial}`);
            if (delivery.accessoriesCount) list.push(`${delivery.accessoriesCount} Accesorios`);
            if (delivery.yubikeysCount) list.push(`${delivery.yubikeysCount} YubiKeys`);
        }
        return list.length > 0 ? list : ['Sin items definidos'];
    };

    return (
        <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '1rem' }}>
            {/* Header Mobile-friendly */}
            <div style={{ marginBottom: '2rem' }}>
                <h1 style={{ fontSize: '2rem', fontWeight: 900, color: 'var(--text-main)', margin: 0, letterSpacing: '-0.02em' }}>
                    Mis <span style={{ color: 'var(--primary-color)' }}>Envíos</span>
                </h1>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', marginTop: '0.25rem' }}>
                    Logística y ruta de entregas asignada
                </p>
            </div>

            {/* Stats Bar */}
            <div style={{ 
                display: 'grid', 
                gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', 
                gap: '1.25rem', 
                marginBottom: '2.5rem' 
            }}>
                <Card style={{ padding: '1.25rem', borderLeft: '5px solid var(--primary-color)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                            <span style={{ fontSize: '0.65rem', fontWeight: 800, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Rendimiento</span>
                            <span style={{ fontSize: '1.75rem', fontWeight: 900 }}>{stats.finishedThisMonth}</span>
                            <span style={{ fontSize: '0.75rem', color: '#10b981', display: 'flex', alignItems: 'center', gap: '2px', fontWeight: 600 }}>
                                <ArrowUpRight size={14} /> Entregados este mes
                            </span>
                        </div>
                        <div style={{ padding: '0.6rem', backgroundColor: 'var(--primary-light)', borderRadius: '12px', color: 'var(--primary-color)' }}>
                            <TrendingUp size={20} />
                        </div>
                    </div>
                </Card>

                <Card style={{ padding: '1.25rem', borderLeft: '5px solid #f59e0b' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                            <span style={{ fontSize: '0.65rem', fontWeight: 800, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Carga Semanal</span>
                            <span style={{ fontSize: '1.75rem', fontWeight: 900 }}>{stats.pendingThisWeek}</span>
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Servicios para esta semana</span>
                        </div>
                        <div style={{ padding: '0.6rem', backgroundColor: '#fef3c7', borderRadius: '12px', color: '#f59e0b' }}>
                            <ClipboardList size={20} />
                        </div>
                    </div>
                </Card>

                <Card style={{ padding: '1.25rem' }} className="hide-mobile">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                            <span style={{ fontSize: '0.65rem', fontWeight: 800, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Historial</span>
                            <span style={{ fontSize: '0.9rem', fontWeight: 700 }}>Actividad (6m)</span>
                        </div>
                        <BarChart3 size={16} style={{ color: 'var(--text-secondary)' }} />
                    </div>
                    {/* Mini Gráfico Sparkline */}
                    <div style={{ display: 'flex', alignItems: 'flex-end', height: '35px', gap: '4px', marginTop: '0.75rem', width: '100%' }}>
                        {stats.last6Months.map((m, i) => {
                            const max = Math.max(...stats.last6Months.map(h => h.count), 1);
                            const heightPercentage = (m.count / max) * 100;
                            const height = Math.max(heightPercentage, 10);

                            return (
                                <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', height: '100%', justifyContent: 'flex-end' }}>
                                    <div style={{ 
                                        width: '100%', 
                                        height: `${height}%`, 
                                        backgroundColor: i === 5 ? 'var(--primary-color)' : '#cbd5e1',
                                        borderRadius: '2px',
                                        opacity: i === 5 ? 1 : 0.7,
                                        transition: 'all 0.3s ease'
                                    }} title={`${m.label}: ${m.count}`}></div>
                                </div>
                            );
                        })}
                    </div>
                </Card>
            </div>

            {Object.keys(groupedDeliveries).length === 0 ? (
                <Card style={{ textAlign: 'center', padding: '4rem 2rem' }}>
                    <Truck size={48} style={{ color: 'var(--text-secondary)', opacity: 0.2, marginBottom: '1rem' }} />
                    <h3 style={{ fontSize: '1.2rem', color: 'var(--text-main)' }}>No tienes envíos asignados pendientes</h3>
                    <p style={{ color: 'var(--text-secondary)' }}>Cuando se te asigne un nuevo servicio, aparecerá en esta lista.</p>
                </Card>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2.5rem' }}>
                    {Object.entries(groupedDeliveries).map(([date, deliveries]) => {
                        const dayColor = getColorByDate(date);
                        return (
                            <div key={date} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '0 0.5rem' }}>
                                    <div style={{ backgroundColor: dayColor, width: '12px', height: '12px', borderRadius: '50%' }}></div>
                                    <h2 style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-main)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                        {(() => {
                                            if (date === 'Sin Fecha') return 'Fecha no definida';
                                            const d = new Date(date + 'T00:00:00');
                                            const days = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
                                            const months = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
                                            return `${days[d.getDay()]}, ${d.getDate()} de ${months[d.getMonth()]}`;
                                        })()}
                                    </h2>
                                    <div style={{ flex: 1, height: '1px', background: `linear-gradient(to right, ${dayColor}44, transparent)` }}></div>
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1rem' }}>
                                    {deliveries.map(delivery => (
                                        <Card key={`${delivery.id}-${delivery.displayId}`} style={{ borderLeft: `5px solid ${delivery.status === 'Resuelto' ? '#22c55e' : dayColor}` }}>
                                            <div className="flex-mobile-column" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem' }}>
                                                <div style={{ flex: 1, width: '100%' }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem', flexWrap: 'wrap' }}>
                                                        <span style={{ fontWeight: 800, color: dayColor, fontSize: '1.1rem' }}>#{delivery.displayId}</span>
                                                        {!delivery.isMainTicket && <span style={{ fontSize: '0.66rem', background: '#f1f5f9', padding: '2px 6px', borderRadius: '4px', fontWeight: 600 }}>Caso SFDC</span>}
                                                        <Badge variant={
                                                            delivery.displayStatus === 'Entregado' ? 'success' :
                                                            delivery.displayStatus === 'En Transito' ? 'info' :
                                                            delivery.displayStatus === 'Para Coordinar' ? 'warning' :
                                                            'default' // Pendiente
                                                        }>
                                                            {delivery.displayStatus || 'Pendiente'}
                                                        </Badge>
                                                    </div>
                                                    <div style={{ marginBottom: '0.5rem' }}>
                                                        <p style={{ margin: '0 0 4px 0', fontSize: '0.9rem', color: 'var(--text-secondary)', lineHeight: '1.2' }}>{delivery.displaySubject}</p>
                                                        <h3 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0 }}>{delivery.requester}</h3>
                                                    </div>

                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                                                        <div 
                                                            onClick={() => openGoogleMaps(delivery.displayAddress)}
                                                            style={{ 
                                                                display: 'flex', 
                                                                alignItems: 'flex-start', 
                                                                gap: '0.5rem', 
                                                                color: dayColor, 
                                                                cursor: 'pointer',
                                                                fontSize: '0.9rem',
                                                                fontWeight: 500,
                                                                lineHeight: 1.3
                                                            }}
                                                            className="hover-underline"
                                                        >
                                                            <MapPin size={18} style={{ flexShrink: 0, marginTop: '2px' }} />
                                                            <span>{delivery.displayAddress} <Navigation size={12} style={{ opacity: 0.7, marginLeft: '4px' }} /></span>
                                                        </div>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', color: 'var(--text-main)', fontSize: '0.95rem', fontWeight: 600, marginTop: '0.2rem', flexWrap: 'wrap' }}>
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                                                <Calendar size={16} />
                                                                {delivery.displayDate || 'No definida'}
                                                            </div>
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                                                <Clock size={16} />
                                                                Turno: {delivery.timeSlot || 'AM'}
                                                            </div>
                                                        </div>

                                                        {/* Listado de Items en la Tarjeta */}
                                                        <div style={{ 
                                                            marginTop: '0.75rem', 
                                                            padding: '0.6rem', 
                                                            background: 'rgba(0,0,0,0.03)', 
                                                            borderRadius: '8px',
                                                            borderLeft: `3px solid ${dayColor}`
                                                        }}>
                                                            <div style={{ fontSize: '0.65rem', fontWeight: 800, color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '0.4rem', letterSpacing: '0.05em' }}>
                                                                Contenido
                                                            </div>
                                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                                                                {getDevicesList(delivery).map((item, idx) => (
                                                                    <div key={idx} style={{ fontSize: '0.8rem', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                                                        <div style={{ width: '4px', height: '4px', backgroundColor: dayColor, borderRadius: '50%', flexShrink: 0 }}></div>
                                                                        {item}
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="flex-mobile-column" style={{ display: 'flex', flexDirection: 'column', gap: '1rem', alignItems: 'flex-end', width: '100%', maxWidth: '200px' }}>
                                                    {delivery.displayStatus !== 'Entregado' && (
                                                        <Button 
                                                            icon={CheckCircle2}
                                                            onClick={() => {
                                                                setSelectedDelivery(delivery);
                                                                setIsDeliveryModalOpen(true);
                                                                setDeliveryForm(prev => ({
                                                                    ...prev,
                                                                    receivedBy: '', // Reset
                                                                    dni: '',
                                                                    notes: '',
                                                                    actualTime: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                                                                }));
                                                            }}
                                                            style={{ padding: '0.75rem 1.5rem', fontSize: '1rem', width: '100%', backgroundColor: dayColor, borderColor: dayColor }}
                                                        >
                                                            REGISTRAR
                                                        </Button>
                                                    )}

                                                    <div style={{ display: 'flex', flexDirection: 'row', gap: '10px', alignItems: 'center', justifyContent: 'flex-end', width: '100%' }}>
                                                        <label style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', fontWeight: 700, textTransform: 'uppercase' }}>
                                                            Orden de Visita:
                                                        </label>
                                                        <div 
                                                            style={{ 
                                                                width: '45px', 
                                                                height: '45px', 
                                                                display: 'flex', 
                                                                alignItems: 'center', 
                                                                justifyContent: 'center', 
                                                                backgroundColor: dayColor, 
                                                                borderRadius: '50%', 
                                                                color: 'white', 
                                                                fontWeight: 800,
                                                                fontSize: '1.2rem',
                                                                boxShadow: `0 4px 10px ${dayColor}44`
                                                            }}
                                                        >
                                                            {delivery.deliveryOrder || 0}
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </Card>
                                    ))}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Modal de Registro de Entrega */}
            <Modal
                isOpen={isDeliveryModalOpen}
                onClose={() => setIsDeliveryModalOpen(false)}
                title={`Registro de Entrega/Recupero: #${selectedDelivery?.displayId}`}
            >
                <form onSubmit={handleDeliverySubmit}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                        {/* Fecha y Hora Auto-detectada */}
                        <div style={{ 
                            background: 'var(--surface-active)', 
                            borderRadius: 'var(--radius-md)', 
                            padding: '0.75rem',
                            border: '1px solid var(--border)',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center'
                        }}>
                            <div>
                                <span style={{ fontSize: '0.7rem', textTransform: 'uppercase', fontWeight: 800, color: 'var(--text-secondary)', display: 'block' }}>Día de Operación</span>
                                <span style={{ fontWeight: 700 }}>{new Date().toLocaleDateString()}</span>
                            </div>
                            <div style={{ textAlign: 'right' }}>
                                <span style={{ fontSize: '0.7rem', textTransform: 'uppercase', fontWeight: 800, color: 'var(--text-secondary)', display: 'block' }}>Hora de Registro</span>
                                <span style={{ fontWeight: 700 }}>{deliveryForm.actualTime}</span>
                            </div>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                            <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-main)' }}>Recibido por (Nombre Completo)</label>
                            <input
                                type="text"
                                value={deliveryForm.receivedBy}
                                onChange={(e) => setDeliveryForm({ ...deliveryForm, receivedBy: e.target.value })}
                                style={{
                                    padding: '0.75rem',
                                    borderRadius: 'var(--radius-sm)',
                                    border: '1px solid var(--border)',
                                    background: 'var(--surface-main)',
                                    color: 'var(--text-main)',
                                    fontSize: '0.95rem'
                                }}
                                placeholder="Ej: Juan Pérez"
                                required
                            />
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                            <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-main)' }}>DNI / Identificación</label>
                            <input
                                type="text"
                                value={deliveryForm.dni}
                                onChange={(e) => setDeliveryForm({ ...deliveryForm, dni: e.target.value })}
                                style={{
                                    padding: '0.75rem',
                                    borderRadius: 'var(--radius-sm)',
                                    border: '1px solid var(--border)',
                                    background: 'var(--surface-main)',
                                    color: 'var(--text-main)',
                                    fontSize: '0.95rem'
                                }}
                                placeholder="Ej: 12.345.678"
                                required
                            />
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                            <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-main)' }}>Notas adicionales</label>
                            <textarea
                                value={deliveryForm.notes}
                                onChange={(e) => setDeliveryForm({ ...deliveryForm, notes: e.target.value })}
                                style={{
                                    padding: '0.75rem',
                                    borderRadius: 'var(--radius-sm)',
                                    border: '1px solid var(--border)',
                                    background: 'var(--surface-main)',
                                    color: 'var(--text-main)',
                                    fontSize: '0.95rem',
                                    minHeight: '80px',
                                    resize: 'vertical'
                                }}
                                placeholder="Cualquier observación relevante sobre la entrega..."
                            />
                        </div>

                        <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
                            <Button 
                                type="button" 
                                variant="secondary" 
                                onClick={() => setIsDeliveryModalOpen(false)} 
                                style={{ flex: 1 }}
                            >
                                CANCELAR
                            </Button>
                            <Button 
                                type="submit" 
                                icon={CheckCircle2} 
                                style={{ flex: 1 }}
                            >
                                CONFIRMAR ENTREGA
                            </Button>
                        </div>
                    </div>
                </form>
            </Modal>

            {/* Toast Notification */}
            {toast.show && (
                <div style={{
                    position: 'fixed',
                    bottom: '2rem',
                    right: '2rem',
                    backgroundColor: toast.type === 'success' ? '#10b981' : '#ef4444',
                    color: 'white',
                    padding: '1rem 1.5rem',
                    borderRadius: 'var(--radius-md)',
                    boxShadow: '0 10px 25px rgba(0,0,0,0.2)',
                    zIndex: 2000,
                    animation: 'fadeIn 0.3s ease-out',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    fontWeight: 600,
                    fontSize: '0.9rem'
                }}>
                    {toast.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
                    {toast.message}
                </div>
            )}

            <style jsx>{`
                .hover-underline:hover span {
                    text-decoration: underline;
                }
                @keyframes fadeIn {
                    from { opacity: 0; transform: translateY(10px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                @media (max-width: 768px) {
                    .hide-mobile {
                        display: none !important;
                    }
                    .flex-mobile-column {
                        flex-direction: column !important;
                        align-items: stretch !important;
                        max-width: none !important;
                    }
                }
            `}</style>
        </div>
    );
}
