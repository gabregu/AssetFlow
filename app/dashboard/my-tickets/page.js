"use client";
import React, { useState, useMemo } from 'react';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Modal } from '../../components/ui/Modal';
import { ServiceMap } from '../../components/ui/ServiceMap';
import { useStore } from '../../../lib/store';
import { Plus, Filter, Search, Eye, Trash2, Archive, AlertCircle, Clock, CheckCircle2, Loader2, User, Truck, CreditCard, TrendingUp, Map as MapIcon, Route, StickyNote, MessageSquare } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useJsApiLoader } from '@react-google-maps/api';

const GOOGLE_MAPS_LIBRARIES = ['geometry'];

export default function MyTicketsPage() {
    const router = useRouter();
    const { tickets, assets: globalAssets, addTicket, deleteTickets, currentUser, rates, users, logisticsTasks } = useStore();

    // Load Google Maps Script Globaly for this page
    const { isLoaded: isMapsLoaded } = useJsApiLoader({
        id: 'google-map-script',
        googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY,
        libraries: GOOGLE_MAPS_LIBRARIES
    });

    // UI State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isMapOpen, setIsMapOpen] = useState(false);

    // Data State
    const [newTicket, setNewTicket] = useState({ subject: '', requester: '', priority: 'Media', status: 'Abierto' });
    const [filter, setFilter] = useState('');
    const [sortConfig, setSortConfig] = useState({ key: 'date', direction: 'asc' });
    const [columnFilters, setColumnFilters] = useState({ status: 'All', requester: '' });
    const [selectedTickets, setSelectedTickets] = useState([]);

    // Route Optimization State
    const [isOptimizationModalOpen, setIsOptimizationModalOpen] = useState(false);
    const [optimizationOrigin, setOptimizationOrigin] = useState('oficina');
    const [isOptimizing, setIsOptimizing] = useState(false);
    const [optimizedOrder, setOptimizedOrder] = useState(null); // Array of ticket IDs in order

    const isAdmin = currentUser?.role === 'admin';

    // Generamos la lista "aplanada" de items de trabajo (Tickets o Casos Asociados) asignados al usuario
    const myAssignedItems = useMemo(() => {
        if (!currentUser) return [];
        const items = [];
        const uName = (currentUser.name || '').trim().toLowerCase();
        const uId = String(currentUser.id || currentUser.uid || currentUser.uuid || '');
        
        // --- 1. PROCESAR SUB-CASOS (logistics_tasks) ---
        // Fuente principal de verdad para asignaciones individuales
        logisticsTasks.forEach(task => {
            const drvName = (task.delivery_person || task.deliveryPerson || '').trim().toLowerCase();
            const drvId = String(task.assigned_to || task.assignedTo || '');
            
            const isMeByName = drvName && (drvName === uName || uName.includes(drvName) || drvName.includes(uName));
            const isMeById = drvId && (drvId === uId);
            
            if (isMeByName || isMeById) {
                // Ocultar de "Mis Servicios" si la entrega ya se concretó/finalizó o no requiere acción
                const taskStatus = task.status || 'Pendiente';
                if (['Entregado', 'Finalizado', 'Resuelto', 'Cerrado', 'Caso SFDC Cerrado', 'Cancelado', 'No requiere accion'].includes(taskStatus)) return;

                const pTicket = tickets.find(t => String(t.id) === String(task.ticket_id || task.ticketId));
                
                // Agregamos la tarea aunque no encontremos el ticket padre (Resiliencia total)
                items.push({
                    id: pTicket?.id || task.ticket_id || 'N/A',
                    taskId: task.id,
                    isMainTicket: false,
                    displaySubject: task.subject || task.items || pTicket?.subject || 'Gestión de Activos',
                    displayId: task.case_number || task.caseNumber || (pTicket?.id ? String(pTicket.id).substring(0, 8) : 'SUB-CASE'),
                    displayAddress: task.address || pTicket?.logistics?.address || 'Dirección no especificada',
                    displayDate: task.date || 'Pendiente',
                    displayStatus: task.status || 'Pendiente',
                    taskTimeSlot: task.time_slot || task.timeSlot || 'Por definir',
                    requester: task.requester || pTicket?.requester || 'Destinatario',
                    parentTicket: pTicket,
                    caseData: task,
                    instructions: task.instructions || pTicket?.instructions || '',
                    hasNewNotes: (() => {
                        const chat = pTicket?.chatLog || task.chat_log || task.chatLog || [];
                        return chat.length > 0;
                    })(),
                    hasUnreadChat: (() => {
                        const chat = pTicket?.chatLog || task.chat_log || task.chatLog || [];
                        if (chat.length === 0) return false;
                        return chat[chat.length - 1].user !== currentUser?.name;
                    })()
                });
            }
        });

        // --- 2. PROCESAR TICKETS LEGACY (Solo si no tienen sub-casos asociados) ---
        tickets.forEach(ticket => {
            // Si el ticket ya tiene tareas en la nueva tabla, las tareas mandan (evitamos duplicados)
            const hasNewTasks = logisticsTasks.some(tk => String(tk.ticket_id) === String(ticket.id));
            if (hasNewTasks) return;

            const tDriverName = (ticket.logistics?.delivery_person || ticket.logistics?.deliveryPerson || '').trim().toLowerCase();
            const tDriverUid = String(ticket.logistics?.assigned_to || ticket.logistics?.assignedTo || '');
            
            const isMeLegacy = (tDriverName && (tDriverName === uName || uName.includes(tDriverName) || tDriverName.includes(uName))) || 
                               (tDriverUid && (tDriverUid === uId));
            
            if (isMeLegacy) {
                const tStatus = ticket.status || 'Abierto';
                const lStatus = ticket.logistics?.status || 'Pendiente';
                
                if (['Cerrado', 'Resuelto', 'Caso SFDC Cerrado', 'Servicio Facturado', 'Cancelado'].includes(tStatus)) return;
                if (['Entregado', 'Finalizado'].includes(lStatus)) return;

                items.push({
                    ...ticket,
                    displaySubject: ticket.subject,
                    displayId: ticket.id,
                    displayAddress: ticket.logistics?.address || 'Sin dirección',
                    displayDate: ticket.logistics?.date || 'Sin fecha',
                    displayStatus: ticket.logistics?.status || 'Pendiente',
                    isMainTicket: true,
                    taskId: null,
                    instructions: ticket.instructions || '',
                    hasNewNotes: (() => {
                        const chat = ticket.chatLog || [];
                        return chat.length > 0;
                    })(),
                    hasUnreadChat: (() => {
                        const chat = ticket.chatLog || [];
                        if (chat.length === 0) return false;
                        return chat[chat.length - 1].user !== currentUser?.name;
                    })()
                });
            }
        });

        return items;
    }, [tickets, logisticsTasks, currentUser]);

    const handleSelectAll = (e) => {
        if (e.target.checked) {
            setSelectedTickets(sortedAndFilteredTickets.map(t => t.id));
        } else {
            setSelectedTickets([]);
        }
    };

    const handleSelectOne = (id) => {
        setSelectedTickets(prev =>
            prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
        );
    };

    const handleBulkDelete = () => {
        if (confirm(`¿Estás seguro de que deseas eliminar ${selectedTickets.length} tickets seleccionados?`)) {
            deleteTickets(selectedTickets);
            setSelectedTickets([]);
        }
    };

    const handleCreate = async (e) => {
        e.preventDefault();
        // Al crear desde "Mis Servicios", auto-asignar al usuario actual
        const ticketData = {
            ...newTicket,
            logistics: {
                ...newTicket.logistics,
                method: 'Repartidor Propio',
                deliveryPerson: currentUser?.name || ''
            }
        };
        const createdTicket = await addTicket(ticketData);
        setIsModalOpen(false);
        setNewTicket({ subject: '', requester: '', priority: 'Media', status: 'Abierto' });
        if (createdTicket?.id) {
            router.push(`/dashboard/tickets/${createdTicket.id}`);
        }
    };

    const handleSort = (key) => {
        let direction = 'asc';
        if (sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setSortConfig({ key, direction });
        // Clear optimization when manual sort is triggered
        if (key !== 'optimized') setOptimizedOrder(null);
    };

    // Route Optimization Logic
    const handleOptimizeRoute = async () => {
        if (!isMapsLoaded) {
            alert('El mapa aún se está cargando, por favor intenta nuevamente en unos segundos.');
            return;
        }
        setIsOptimizing(true);
        try {
            const geocoder = new window.google.maps.Geocoder();

            const originAddress = optimizationOrigin === 'oficina'
                ? 'Padre Castiglia 1638, Boulogne, Buenos Aires, Argentina'
                : 'Fraga 1312, CABA, Argentina';

            // 1. Geocode Origin
            const originResult = await new Promise((resolve, reject) => {
                geocoder.geocode({ address: originAddress }, (results, status) => {
                    if (status === 'OK') resolve(results[0]);
                    else reject(status);
                });
            });
            const originLoc = originResult.geometry.location;

            // 2. Geocode Tickets (Limit 25 to avoid heavy API usage/limits)
            // Using a simple greedy algorithm: Find nearest to current, then from that finding nearest to next, etc.
            const ticketsToRoute = sortedAndFilteredTickets.filter(t => t.logistics?.address && t.logistics.address.length > 5);

            const ticketsWithLoc = [];
            for (const ticket of ticketsToRoute) {
                try {
                    const res = await new Promise((resolve) => {
                        geocoder.geocode({ address: ticket.logistics.address }, (results, status) => {
                            if (status === 'OK') resolve(results[0]);
                            else resolve(null); // Skip if failed
                        });
                    });

                    if (res) {
                        ticketsWithLoc.push({
                            id: ticket.id,
                            loc: res.geometry.location,
                            ticket: ticket
                        });
                    }
                    // Small delay
                    await new Promise(r => setTimeout(r, 250));
                } catch (e) { console.error(e); }
            }

            // 3. Sort by Nearest Neighbor
            let currentLoc = originLoc;
            const orderedIds = [];
            const pool = [...ticketsWithLoc];

            while (pool.length > 0) {
                // Find nearest in pool to currentLoc
                let nearestIdx = -1;
                let minDist = Infinity;

                for (let i = 0; i < pool.length; i++) {
                    const d = window.google.maps.geometry.spherical.computeDistanceBetween(currentLoc, pool[i].loc);
                    if (d < minDist) {
                        minDist = d;
                        nearestIdx = i;
                    }
                }

                if (nearestIdx !== -1) {
                    const nearest = pool[nearestIdx];
                    orderedIds.push(nearest.id);
                    currentLoc = nearest.loc;
                    pool.splice(nearestIdx, 1);
                } else {
                    break;
                }
            }

            // Add remaining tickets that couldn't be geocoded at the end
            const unmappedIds = sortedAndFilteredTickets
                .filter(t => !orderedIds.includes(t.id))
                .map(t => t.id);

            setOptimizedOrder([...orderedIds, ...unmappedIds]);
            setSortConfig({ key: 'optimized', direction: 'asc' });
            setIsOptimizationModalOpen(false);
            alert('¡Ruta optimizada correctamente!');

        } catch (error) {
            console.error(error);
            alert('Error al optimizar ruta: ' + error.message);
        } finally {
            setIsOptimizing(false);
        }
    };

    const sortedAndFilteredTickets = useMemo(() => {
        let result = myAssignedItems.filter(item => {
            const subject = String(item.displaySubject || '').toLowerCase();
            const requester = String(item.requester || '').toLowerCase();
            const displayId = String(item.displayId || '').toLowerCase();
            const searchTerm = filter.toLowerCase();

            const matchesSearch = subject.includes(searchTerm) ||
                requester.includes(searchTerm) ||
                displayId.includes(searchTerm);

            const matchesStatus = columnFilters.status === 'All' || item.displayStatus === columnFilters.status;
            const matchesRequester = !columnFilters.requester || requester.includes(columnFilters.requester.toLowerCase());

            return matchesSearch && matchesStatus && matchesRequester;
        });

        // Sort: "Para Coordinar" always top, then apply user sort config or default
        result.sort((a, b) => {
            const isCoordA = a.displayStatus === 'Para Coordinar';
            const isCoordB = b.displayStatus === 'Para Coordinar';

            if (isCoordA && !isCoordB) return -1;
            if (!isCoordA && isCoordB) return 1;

            // If both are "Para Coordinar" or both are NOT, apply other sorts
            if (sortConfig.key === 'optimized' && optimizedOrder) {
                const idxA = optimizedOrder.indexOf(a.id);
                const idxB = optimizedOrder.indexOf(b.id);
                const safeIdxA = idxA === -1 ? 9999 : idxA;
                const safeIdxB = idxB === -1 ? 9999 : idxB;
                return safeIdxA - safeIdxB;
            }

            if (sortConfig.key) {
                const valA = a[sortConfig.key] || '';
                const valB = b[sortConfig.key] || '';
                if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
                if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
            }
            return 0; // Default order
        });

        return result;
    }, [myAssignedItems, filter, sortConfig, columnFilters, optimizedOrder]);

    const stats = useMemo(() => {
        try {
            const now = new Date();
            const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
            
            const list = Array.isArray(sortedAndFilteredTickets) ? sortedAndFilteredTickets : [];
            const allTickets = Array.isArray(tickets) ? tickets : [];

            return {
                pending: list.filter(t => t?.displayStatus === 'Para Coordinar' || t?.displayStatus === 'Pendiente').length,
                inProgress: list.filter(t => t?.displayStatus === 'En Transito').length,
                resolvedToday: allTickets.filter(t => {
                    if (!t) return false;
                    const isResolved = t.status === 'Resuelto' || t.status === 'Cerrado';
                    if (!isResolved) return false;
                    
                    const logs = Array.isArray(t.actionLog) ? t.actionLog : (Array.isArray(t.action_log) ? t.action_log : []);
                    const lastLog = logs.length > 0 ? logs[logs.length - 1] : null;
                    if (lastLog && lastLog.date) {
                        try {
                            const logDate = new Date(lastLog.date).getTime();
                            return !isNaN(logDate) && logDate >= startOfToday;
                        } catch (e) { return false; }
                    }
                    return false;
                }).length
            };
        } catch (error) {
            console.error("Error calculating stats:", error);
            return { pending: 0, inProgress: 0, resolvedToday: 0 };
        }
    }, [sortedAndFilteredTickets, tickets]);

    // Estadísticas movidas a /dashboard/my-stats

    const getStatusVariant = (status) => {
        switch (status) {
            case 'Abierto': return 'danger';
            case 'En Progreso': return 'info';
            case 'Resuelto': return 'success';
            case 'Pendiente': return 'warning';
        };
    };

    const SortIcon = ({ column }) => {
        if (sortConfig.key !== column) return <span style={{ opacity: 0.3, marginLeft: '4px' }}>↕</span>;
        return <span style={{ marginLeft: '4px', color: 'var(--primary-color)' }}>{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>;
    };

    return (
        <div style={{ animation: 'fadeIn 0.5s ease-out' }}>
            <div className="flex-mobile-column" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2rem', gap: '1rem' }}>
                <div>
                    <h1 style={{ fontSize: '1.8rem', fontWeight: 700, color: 'var(--text-main)' }}>Mis Servicios</h1>
                    <p style={{ color: 'var(--text-secondary)' }}>Gestiona tus tareas asignadas y reporta entregas.</p>
                </div>
                <div style={{ padding: '0.75rem', backgroundColor: 'rgba(59, 130, 246, 0.1)', borderRadius: '50%', color: '#3b82f6' }}>
                    <Truck size={24} />
                </div>
            </div>

            <div className="grid-responsive-dashboard" style={{ marginBottom: '2rem' }}>
                <Card>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div>
                            <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', fontWeight: 500 }}>Pendientes</p>
                            <h2 style={{ fontSize: '2rem', fontWeight: 700, margin: '0.5rem 0' }}>{stats.pending}</h2>
                        </div>
                        <div style={{ padding: '0.5rem', background: 'rgba(59, 130, 246, 0.1)', borderRadius: '8px', color: '#3b82f6' }}>
                            <Clock size={20} />
                        </div>
                    </div>
                </Card>

                <Card>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div>
                            <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', fontWeight: 500 }}>En Progreso</p>
                            <h2 style={{ fontSize: '2rem', fontWeight: 700, margin: '0.5rem 0' }}>{stats.inProgress}</h2>
                        </div>
                        <div style={{ padding: '0.5rem', background: 'rgba(234, 179, 8, 0.1)', borderRadius: '8px', color: '#eab308' }}>
                            <Truck size={20} />
                        </div>
                    </div>
                </Card>

                <Card>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div>
                            <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', fontWeight: 500 }}>Resueltos Hoy</p>
                            <h2 style={{ fontSize: '2rem', fontWeight: 700, margin: '0.5rem 0' }}>{stats.resolvedToday}</h2>
                        </div>
                        <div style={{ padding: '0.5rem', background: 'rgba(34, 197, 94, 0.1)', borderRadius: '8px', color: '#22c55e' }}>
                            <CheckCircle size={20} />
                        </div>
                    </div>
                </Card>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.75rem', marginBottom: '1rem' }}>
                <div style={{ display: 'flex', gap: '8px' }}>
                    <Button variant="secondary" icon={Route} onClick={() => setIsOptimizationModalOpen(true)}>Optimizar Ruta</Button>
                    <Button variant="secondary" icon={MapIcon} onClick={() => setIsMapOpen(true)}>Ver Mapa</Button>
                    <Button icon={Plus} onClick={() => setIsModalOpen(true)}>Nuevo Servicio</Button>
                </div>
            </div>

            <Card className="p-0">
                <div style={{ padding: '1.5rem', borderBottom: '1px solid var(--border)' }}>
                    <div className="flex-mobile-column" style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                        <div style={{ position: 'relative', flex: 1, width: '100%', minWidth: 'min(300px, 100%)' }}>
                            <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
                            <input
                                type="text"
                                placeholder="Buscar en mis servicios..."
                                value={filter}
                                onChange={(e) => setFilter(e.target.value)}
                                style={{
                                    width: '100%',
                                    padding: '0.6rem 1rem 0.6rem 2.5rem',
                                    borderRadius: 'var(--radius-md)',
                                    border: '1px solid var(--border)',
                                    outline: 'none',
                                    backgroundColor: 'var(--background)',
                                    color: 'var(--text-main)'
                                }}
                            />
                        </div>
                        <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', fontWeight: 500 }}>
                            Total Servicios: <span style={{ color: 'var(--text-main)', fontWeight: 700 }}>{sortedAndFilteredTickets.length}</span>
                        </div>
                        {(columnFilters.status !== 'All' || filter !== '') && (
                            <Button variant="ghost" size="sm" onClick={() => {
                                setColumnFilters({ status: 'All', requester: '' });
                                setFilter('');
                            }}>Limpiar</Button>
                        )}
                    </div>
                </div>

                {/* Vista Web (Tabla) */}
                <div className="hide-mobile" style={{ overflowX: 'auto' }}>
                        {myAssignedItems.length === 0 ? (
                            <div style={{ textAlign: 'center', padding: '3rem 0' }}>
                                <User size={48} style={{ color: 'var(--text-secondary)', opacity: 0.2, marginBottom: '1rem' }} />
                                <p style={{ color: 'var(--text-secondary)' }}>No tienes servicios asignados actualmente.</p>
                            </div>
                        ) : (
                        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                            <thead>
                                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                                    <th onClick={() => handleSort('id')} style={{ padding: '1rem', fontWeight: 600, color: 'var(--text-secondary)', fontSize: '0.85rem', cursor: 'pointer' }}>ID <SortIcon column="id" /></th>
                                    <th onClick={() => handleSort('subject')} style={{ padding: '1rem', fontWeight: 600, color: 'var(--text-secondary)', fontSize: '0.85rem', cursor: 'pointer' }}>Asunto <SortIcon column="subject" /></th>
                                    <th onClick={() => handleSort('requester')} style={{ padding: '1rem', fontWeight: 600, color: 'var(--text-secondary)', fontSize: '0.85rem', cursor: 'pointer' }}>Solicitante <SortIcon column="requester" /></th>
                                    <th onClick={() => handleSort('date')} style={{ padding: '1rem', fontWeight: 600, color: 'var(--text-secondary)', fontSize: '0.85rem', cursor: 'pointer' }}>Fecha Coordinada <SortIcon column="date" /></th>
                                    <th style={{ padding: '1rem', fontWeight: 600, color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Días</th>
                                    <th style={{ padding: '1rem', fontWeight: 600, color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Estado Envío</th>
                                    <th style={{ padding: '1rem', fontWeight: 600, color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Acciones</th>
                                </tr>
                            </thead>
                            <tbody>
                                {sortedAndFilteredTickets.map((ticket) => (
                                    <tr key={`${ticket.id}-${ticket.displayId}`} style={{
                                        borderBottom: '1px solid var(--border)',
                                        backgroundColor: ticket.displayStatus === 'Pendiente' ? '#f8fafc' : 'transparent' 
                                    }} className="table-row-hover">
                                        <td style={{ padding: '1rem', fontWeight: 600 }}>{ticket.displayId}</td>
                                        <td style={{ padding: '1rem' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                <div style={{ fontWeight: 700, color: 'var(--text-main)', fontSize: '0.95rem' }}>{ticket.displaySubject}</div>
                                                {(ticket.instructions || ticket.hasNewNotes) && (
                                                    <div 
                                                        title={ticket.hasUnreadChat ? "Nuevo mensaje sin leer" : "Tiene notas adicionales"} 
                                                        className={ticket.hasUnreadChat ? "unread-badge-v2" : ""}
                                                        style={{ 
                                                            color: ticket.hasUnreadChat ? 'white' : 'var(--primary-color)', 
                                                            display: 'flex',
                                                            marginRight: '8px'
                                                        }}
                                                    >
                                                        <MessageSquare size={16} fill={ticket.hasUnreadChat ? 'white' : 'none'} stroke={ticket.hasUnreadChat ? 'none' : 'currentColor'} />
                                                    </div>
                                                )}
                                            </div>
                                            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '2px' }}>ID: {ticket.displayId}</div>
                                            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                                <span>Prioridad: {ticket.priority}</span>
                                                {ticket.displayAddress && (
                                                    <a
                                                        href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(ticket.displayAddress)}`}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        style={{ color: 'var(--primary-color)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '4px' }}
                                                        onClick={(e) => e.stopPropagation()}
                                                    >
                                                        📍 {ticket.displayAddress}
                                                    </a>
                                                )}
                                            </div>
                                        </td>
                                        <td style={{ padding: '1rem' }}>{ticket.requester}</td>
                                        <td style={{ padding: '1rem' }}>
                                            <div style={{ fontWeight: 500 }}>{ticket.displayDate ? new Date(ticket.displayDate + 'T00:00:00').toLocaleDateString() : '-'}</div>
                                            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                                                {ticket.isMainTicket 
                                                    ? (ticket.logistics?.timeSlot || ticket.logistics?.time_slot || '') 
                                                    : (ticket.taskTimeSlot || ticket.caseData?.time_slot || '')}
                                            </div>
                                        </td>
                                        <td style={{ padding: '1rem' }}>
                                            <span style={{
                                                fontSize: '0.85rem',
                                                fontWeight: 600,
                                                color: (() => {
                                                    const dateStr = ticket.displayDate || ticket.date;
                                                    if (!dateStr || dateStr === 'Pendiente' || dateStr === 'Sin fecha') return 'var(--text-secondary)';
                                                    const d = new Date(dateStr + 'T00:00:00');
                                                    if (isNaN(d.getTime())) return 'var(--text-secondary)';
                                                    const days = Math.floor((new Date() - d) / (1000 * 60 * 60 * 24));
                                                    return days > 5 ? '#ef4444' : (days > 2 ? '#f59e0b' : 'var(--text-secondary)');
                                                })()
                                            }}>
                                                {(() => {
                                                    const dateStr = ticket.displayDate || ticket.date;
                                                    if (!dateStr || dateStr === 'Pendiente' || dateStr === 'Sin fecha') return '-';
                                                    const d = new Date(dateStr + 'T00:00:00');
                                                    if (isNaN(d.getTime())) return '-';
                                                    return Math.floor((new Date() - d) / (1000 * 60 * 60 * 24)) + 'd';
                                                })()}
                                            </span>
                                        </td>
                                        <td style={{ padding: '1rem' }}>
                                            <Badge variant={
                                                ticket.displayStatus === 'En Transito' ? 'info' :
                                                    ticket.displayStatus === 'Entregado' ? 'success' :
                                                        ticket.displayStatus === 'Para Coordinar' ? 'warning' : 'default'
                                            }>
                                                {ticket.displayStatus || 'Pendiente'}
                                            </Badge>
                                        </td>
                                        <td style={{ padding: '1rem' }}>
                                            <Link href={`/dashboard/tickets/${ticket.id}`}>
                                                <Button variant="ghost" size="sm" icon={Eye}>Detalles</Button>
                                            </Link>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>

                {/* Vista Mobile (Tarjetas) */}
                <div className="show-mobile" style={{ padding: '1rem' }}>
                    {sortedAndFilteredTickets.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '2rem 0' }}>
                            <p style={{ color: 'var(--text-secondary)' }}>No se encontraron servicios.</p>
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            {sortedAndFilteredTickets.map((ticket) => (
                                <Card key={`${ticket.id}-${ticket.displayId}`} style={{
                                    padding: '1.25rem',
                                    borderLeft: `4px solid ${ticket.displayStatus === 'En Transito' ? '#0ea5e9' : ticket.displayStatus === 'Entregado' ? '#22c55e' : '#f59e0b'}`
                                }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
                                        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                                            <span style={{ fontWeight: 800, color: 'var(--primary-color)' }}>#{ticket.displayId}</span>
                                            {!ticket.isMainTicket && <span style={{ fontSize: '0.6rem', background: '#f1f5f9', padding: '2px 4px', borderRadius: '4px' }}>Caso SFDC</span>}
                                            {(ticket.instructions || ticket.hasNewNotes) && (
                                                <div 
                                                    className={ticket.hasUnreadChat ? "unread-badge-v2" : ""}
                                                    style={{ 
                                                        color: ticket.hasUnreadChat ? 'white' : 'var(--primary-color)',
                                                        width: ticket.hasUnreadChat ? '22px' : 'auto',
                                                        height: ticket.hasUnreadChat ? '22px' : 'auto'
                                                    }}
                                                >
                                                    <MessageSquare 
                                                        size={14} 
                                                        fill={ticket.hasUnreadChat ? 'white' : 'none'} 
                                                        stroke={ticket.hasUnreadChat ? 'none' : 'currentColor'}
                                                    />
                                                </div>
                                            )}
                                        </div>
                                        <Badge variant={
                                            ticket.displayStatus === 'En Transito' ? 'info' :
                                                ticket.displayStatus === 'Entregado' ? 'success' :
                                                    ticket.displayStatus === 'Para Coordinar' ? 'warning' : 'default'
                                        }>
                                            {ticket.displayStatus || 'Pendiente'}
                                        </Badge>
                                    </div>
                                    <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '0.5rem' }}>{ticket.displaySubject}</h3>

                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1.25rem' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem' }}>
                                            <User size={14} style={{ color: 'var(--text-secondary)' }} />
                                            <span style={{ fontWeight: 500 }}>{ticket.requester}</span>
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem' }}>
                                            <Clock size={14} style={{ color: 'var(--text-secondary)' }} />
                                            <span>{ticket.displayDate || ticket.date}</span>
                                            <span style={{
                                                marginLeft: 'auto',
                                                fontWeight: 700,
                                                color: (() => {
                                                    const dateStr = ticket.displayDate || ticket.date;
                                                    if (!dateStr || dateStr === 'Pendiente' || dateStr === 'Sin fecha') return 'var(--text-secondary)';
                                                    const d = new Date(dateStr + 'T00:00:00');
                                                    if (isNaN(d.getTime())) return 'var(--text-secondary)';
                                                    const days = Math.floor((new Date() - d) / (1000 * 60 * 60 * 24));
                                                    return days > 5 ? '#ef4444' : (days > 2 ? '#f59e0b' : 'var(--text-secondary)');
                                                })()
                                            }}>
                                                {(() => {
                                                    const dateStr = ticket.displayDate || ticket.date;
                                                    if (!dateStr || dateStr === 'Pendiente' || dateStr === 'Sin fecha') return '-';
                                                    const d = new Date(dateStr + 'T00:00:00');
                                                    if (isNaN(d.getTime())) return '-';
                                                    const days = Math.floor((new Date() - d) / (1000 * 60 * 60 * 24));
                                                    return `${days} días`;
                                                })()}
                                            </span>
                                        </div>
                                    </div>

                                        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
                                            <Link href={`/dashboard/tickets/${ticket.id}`} style={{ flex: 1 }}>
                                                <Button variant="secondary" icon={Eye} style={{ width: '100%', padding: '0.9rem', fontSize: '0.9rem' }}>DETALLES</Button>
                                            </Link>
                                            
                                            {/* Atajo de WhatsApp para móvil */}
                                            {ticket.parentTicket?.deliveryDetails?.contactPhone && (
                                                <Button 
                                                    variant="success" 
                                                    onClick={() => window.open(`https://wa.me/${ticket.parentTicket.deliveryDetails.contactPhone.replace(/\D/g, '')}`, '_blank')}
                                                    style={{ width: '56px', height: '52px', flexShrink: 0, padding: 0 }}
                                                >
                                                    <img src="https://upload.wikimedia.org/wikipedia/commons/6/6b/WhatsApp.svg" style={{ width: '24px', height: '24px' }} alt="WA" />
                                                </Button>
                                            )}

                                            {/* Atajo de Navegación para móvil */}
                                            {ticket.displayAddress !== 'Sin dirección' && (
                                                <Button 
                                                    variant="secondary" 
                                                    onClick={() => window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(ticket.displayAddress)}`, '_blank')}
                                                    style={{ width: '56px', height: '52px', flexShrink: 0, color: 'var(--primary-color)' }}
                                                >
                                                    📍
                                                </Button>
                                            )}
                                        </div>
                                </Card>
                            ))}
                        </div>
                    )}
                </div>
            </Card>

            <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Crear Nuevo Ticket">
                <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                    <div className="form-group">
                        <label className="form-label">Asunto</label>
                        <input
                            required
                            className="form-input"
                            placeholder="Ej: Problema con monitor"
                            value={newTicket.subject}
                            onChange={e => setNewTicket({ ...newTicket, subject: e.target.value })}
                        />
                    </div>
                    <div className="form-group">
                        <label className="form-label">Solicitante</label>
                        <input
                            required
                            className="form-input"
                            placeholder="Nombre del empleado"
                            value={newTicket.requester}
                            onChange={e => setNewTicket({ ...newTicket, requester: e.target.value })}
                        />
                    </div>
                    <div className="form-group">
                        <label className="form-label">Prioridad</label>
                        <select
                            className="form-select"
                            value={newTicket.priority}
                            onChange={e => setNewTicket({ ...newTicket, priority: e.target.value })}
                        >
                            <option value="Baja">Baja</option>
                            <option value="Media">Media</option>
                            <option value="Alta">Alta</option>
                            <option value="Crítica">Crítica</option>
                        </select>
                    </div>
                    <div className="flex-mobile-column" style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1rem' }}>
                        <Button type="button" variant="secondary" onClick={() => setIsModalOpen(false)} style={{ flex: 1 }}>Cancelar</Button>
                        <Button type="submit" style={{ flex: 1 }}>Crear Servicio</Button>
                    </div>
                </form>
            </Modal>

            {/* Service Map Modal */}
            <Modal isOpen={isMapOpen} onClose={() => setIsMapOpen(false)} title="Mapa de Servicios" maxWidth="900px">
                <ServiceMap tickets={sortedAndFilteredTickets} />
                <div style={{ marginTop: '1rem', textAlign: 'right' }}>
                    <Button variant="secondary" onClick={() => setIsMapOpen(false)}>Cerrar</Button>
                </div>
            </Modal>

            {/* Optimization Modal */}
            <Modal isOpen={isOptimizationModalOpen} onClose={() => setIsOptimizationModalOpen(false)} title="Optimizar Recorrido">
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                    <p style={{ color: 'var(--text-secondary)' }}>
                        Selecciona el punto de partida. El sistema ordenará tus tickets automáticamente calculando la ruta más corta (Greedy Algorithm).
                    </p>

                    <div className="form-group">
                        <label className="form-label">Punto de Partida</label>
                        <select
                            className="form-select"
                            value={optimizationOrigin}
                            onChange={(e) => setOptimizationOrigin(e.target.value)}
                        >
                            <option value="oficina">Oficina (Padre Castiglia 1638, Boulogne)</option>
                            <option value="deposito">Depósito (Fraga 1312, CABA)</option>
                        </select>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '1rem' }}>
                        <Button variant="secondary" onClick={() => setIsOptimizationModalOpen(false)} disabled={isOptimizing}>Cancelar</Button>
                        <Button
                            onClick={handleOptimizeRoute}
                            disabled={isOptimizing}
                            icon={isOptimizing ? Loader2 : Route}
                        >
                            {isOptimizing ? 'Calculando...' : 'Optimizar Ahora'}
                        </Button>
                    </div>
                </div>
            </Modal>

        </div>
    );
}
