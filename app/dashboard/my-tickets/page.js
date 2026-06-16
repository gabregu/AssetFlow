"use client";
import React, { useState, useMemo, useRef } from 'react';
import { useSafeSubmit } from '../../../lib/useSafeSubmit';
import { generateTicketPDF } from '../../../lib/pdf-generator';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Modal } from '../../components/ui/Modal';
import { ServiceMap } from '../../components/ui/ServiceMap';
import { useStore } from '../../../lib/store';
import { Plus, Filter, Search, Eye, Trash2, Archive, AlertCircle, Clock, CheckCircle2, Loader2, User, Truck, CreditCard, TrendingUp, Map as MapIcon, Route, StickyNote, MessageSquare, MapPin, Download } from 'lucide-react';
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
    const [newTicket, setNewTicket] = useState({ subject: '', requester: '', priority: 'Media', status: 'Abierto', caseNumber: '' });
    const [filter, setFilter] = useState('');
    const [sortConfig, setSortConfig] = useState({ key: 'date', direction: 'asc' });
    const [columnFilters, setColumnFilters] = useState({ status: 'All', requester: '' });
    const [conductorFilter, setConductorFilter] = useState('active'); // 'active', 'inRoute', 'toCoordinate', 'completed'
    const [selectedTickets, setSelectedTickets] = useState([]);

    // Route Optimization State
    const [isOptimizationModalOpen, setIsOptimizationModalOpen] = useState(false);
    const [optimizationOrigin, setOptimizationOrigin] = useState('oficina');
    const { isSubmitting: isOptimizing, safeSubmit: safeOptimize } = useSafeSubmit();
    const [optimizedOrder, setOptimizedOrder] = useState(null); // Array of ticket IDs in order

    const isAdmin = currentUser?.role === 'admin' || currentUser?.role === 'Gerencial';
    const isConductor = currentUser?.role === 'Conductor';

    // Generamos la lista "aplanada" de items de trabajo (Tickets o Casos Asociados) asignados al usuario
    const myAssignedItems = useMemo(() => {
        if (!currentUser) return [];
        const items = [];
        const uName = (currentUser.name || '').trim().toLowerCase();
        const uId = String(currentUser.id || currentUser.uid || currentUser.uuid || '');
        
        const tasks = Array.isArray(logisticsTasks) ? logisticsTasks : [];
        const allTickets = Array.isArray(tickets) ? tickets : [];

        // --- 1. PROCESAR SUB-CASOS (logistics_tasks) ---
        tasks.forEach(task => {
            if (!task) return;
            const drvName = (task.delivery_person || task.deliveryPerson || '').trim().toLowerCase();
            const drvId = String(task.assigned_to || task.assignedTo || '');
            
            const isMeByName = drvName && (drvName === uName || uName.includes(drvName) || drvName.includes(uName));
            const isMeById = drvId && (drvId === uId);
            
            if (isMeByName || isMeById) {
                const taskStatus = task.status || 'Pendiente';
                const isCompleted = ['Entregado', 'Finalizado', 'Resuelto', 'Cerrado', 'Caso SFDC Cerrado'].includes(taskStatus);
                const isCancelled = ['Cancelado', 'No requiere accion'].includes(taskStatus);
                if (isCancelled) return; // Omitir cancelados

                const pTicket = allTickets.find(t => t && String(t.id) === String(task.ticket_id || task.ticketId));
                
                items.push({
                    id: pTicket?.id || task.ticket_id || 'N/A',
                    taskId: task.id,
                    isMainTicket: false,
                    isCompleted,
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

        // --- 2. PROCESAR TICKETS LEGACY ---
        allTickets.forEach(ticket => {
            if (!ticket) return;
            const hasNewTasks = tasks.some(tk => tk && String(tk.ticket_id) === String(ticket.id));
            if (hasNewTasks) return;

            const tDriverName = (ticket.logistics?.delivery_person || ticket.logistics?.deliveryPerson || '').trim().toLowerCase();
            const tDriverUid = String(ticket.logistics?.assigned_to || ticket.logistics?.assignedTo || '');
            
            const isMeLegacy = (tDriverName && (tDriverName === uName || uName.includes(tDriverName) || tDriverName.includes(uName))) || 
                               (tDriverUid && (tDriverUid === uId));
            
            if (isMeLegacy) {
                const tStatus = ticket.status || 'Abierto';
                const lStatus = ticket.logistics?.status || 'Pendiente';
                
                const isCompleted = ['Cerrado', 'Resuelto', 'Caso SFDC Cerrado', 'Servicio Facturado'].includes(tStatus) || ['Entregado', 'Finalizado'].includes(lStatus);
                const isCancelled = tStatus === 'Cancelado' || lStatus === 'Cancelado';
                if (isCancelled) return; // Omitir cancelados

                items.push({
                    ...ticket,
                    displaySubject: ticket.subject,
                    displayId: ticket.id,
                    displayAddress: ticket.logistics?.address || 'Sin dirección',
                    displayDate: ticket.logistics?.date || 'Sin fecha',
                    displayStatus: ticket.logistics?.status || 'Pendiente',
                    isMainTicket: true,
                    isCompleted,
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
        const clean = (str) => typeof str === 'string' ? str.trim().replace(/[\r\n\t]+/g, ' ') : String(str || '');
        
        const ticketData = {
            ...newTicket,
            subject: clean(newTicket.subject),
            requester: clean(newTicket.requester),
            associatedCases: newTicket.caseNumber && newTicket.caseNumber.trim() !== '' ? [{
                caseNumber: clean(newTicket.caseNumber).replace(/\s/g, ''),
                subject: clean(newTicket.subject)
            }] : [],
            logistics: {
                ...newTicket.logistics,
                method: 'Repartidor Propio',
                deliveryPerson: currentUser?.name || ''
            }
        };
        const createdTicket = await addTicket(ticketData);
        setIsModalOpen(false);
        setNewTicket({ subject: '', requester: '', priority: 'Media', status: 'Abierto', caseNumber: '' });
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
        await safeOptimize(async () => {
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
        }).catch(error => {
            console.error(error);
            alert('Error al optimizar ruta: ' + error.message);
        });
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

        // Filtrado específico para conductor según la pestaña activa
        if (isConductor) {
            if (conductorFilter === 'active') {
                result = result.filter(item => !item.isCompleted);
            } else if (conductorFilter === 'inRoute') {
                result = result.filter(item => !item.isCompleted && item.displayStatus === 'En Transito');
            } else if (conductorFilter === 'toCoordinate') {
                result = result.filter(item => !item.isCompleted && (item.displayStatus === 'Para Coordinar' || item.displayStatus === 'Pendiente'));
            } else if (conductorFilter === 'completed') {
                result = result.filter(item => item.isCompleted);
            }
        }

        // Sort: if completed view, sort by completion date/time (most recent first)
        if (isConductor && conductorFilter === 'completed') {
            result.sort((a, b) => {
                const infoA = a.caseData?.deliveryInfo || a.caseData?.delivery_info || a.parentTicket?.deliveryDetails || a.logistics?.deliveryInfo || a.deliveryDetails || {};
                const infoB = b.caseData?.deliveryInfo || b.caseData?.delivery_info || b.parentTicket?.deliveryDetails || b.logistics?.deliveryInfo || b.deliveryDetails || {};
                
                const timeA = infoA.deliveredAt || infoA.delivered_at || '';
                const timeB = infoB.deliveredAt || infoB.delivered_at || '';
                
                if (timeA && timeB) {
                    return new Date(timeB) - new Date(timeA); // Más recientes arriba
                }
                if (timeA) return -1;
                if (timeB) return 1;
                return 0;
            });
        } else {
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
        }

        return result;
    }, [myAssignedItems, filter, sortConfig, columnFilters, optimizedOrder, conductorFilter]);

    const groupedCompletedTickets = useMemo(() => {
        if (!isConductor || conductorFilter !== 'completed') return null;
        
        const getCompletionDate = (ticket) => {
            const info = ticket.caseData?.deliveryInfo || ticket.caseData?.delivery_info || ticket.parentTicket?.deliveryDetails || ticket.logistics?.deliveryInfo || ticket.deliveryDetails || {};
            const time = info.deliveredAt || info.delivered_at || '';
            return time ? time.substring(0, 10) : 'Sin Fecha';
        };

        const groups = {};
        sortedAndFilteredTickets.forEach(ticket => {
            const date = getCompletionDate(ticket);
            if (!groups[date]) groups[date] = [];
            groups[date].push(ticket);
        });

        // Retorna las entradas ordenadas por fecha descendente (más recientes primero)
        return Object.entries(groups).sort((a, b) => {
            if (a[0] === 'Sin Fecha') return 1;
            if (b[0] === 'Sin Fecha') return -1;
            return b[0].localeCompare(a[0]);
        });
    }, [sortedAndFilteredTickets, isConductor, conductorFilter]);

    const stats = useMemo(() => {
        try {
            const now = new Date();
            const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
            const currentYear = now.getFullYear();
            const currentMonth = now.getMonth(); // 0-indexed
            
            const list = Array.isArray(myAssignedItems) ? myAssignedItems : [];
            const allTickets = Array.isArray(tickets) ? tickets : [];
            const allTasks = Array.isArray(logisticsTasks) ? logisticsTasks : [];
            
            // Conductor-specific metrics
            // 1. Programados en ruta (En Transito)
            const inRouteCount = list.filter(t => t?.displayStatus === 'En Transito').length;
            
            // 2. Para coordinar (Para Coordinar o Pendiente)
            const toCoordinateCount = list.filter(t => t?.displayStatus === 'Para Coordinar' || t?.displayStatus === 'Pendiente').length;
            
            // 3. Realizados en el mes
            let completedInMonthCount = 0;
            if (currentUser) {
                const uName = (currentUser.name || '').trim().toLowerCase();
                const uId = String(currentUser.id || currentUser.uid || currentUser.uuid || '');
                
                // Count from logisticsTasks
                allTasks.forEach(task => {
                    if (!task) return;
                    const drvName = (task.delivery_person || task.deliveryPerson || '').trim().toLowerCase();
                    const drvId = String(task.assigned_to || task.assignedTo || '');
                    
                    const isMeByName = drvName && (drvName === uName || uName.includes(drvName) || drvName.includes(uName));
                    const isMeById = drvId && (drvId === uId);
                    
                    if (isMeByName || isMeById) {
                        const taskStatus = task.status || 'Pendiente';
                        if (['Entregado', 'Finalizado', 'Resuelto', 'Cerrado', 'Caso SFDC Cerrado'].includes(taskStatus)) {
                            const dateStr = task.date;
                            if (dateStr) {
                                const tDate = new Date(dateStr + 'T00:00:00');
                                if (tDate.getFullYear() === currentYear && tDate.getMonth() === currentMonth) {
                                    completedInMonthCount++;
                                }
                            }
                        }
                    }
                });
                
                // Count from legacy tickets
                allTickets.forEach(ticket => {
                    if (!ticket) return;
                    const hasTasks = allTasks.some(tk => tk && String(tk.ticket_id) === String(ticket.id));
                    if (hasTasks) return;
                    
                    const tDriverName = (ticket.logistics?.delivery_person || ticket.logistics?.deliveryPerson || '').trim().toLowerCase();
                    const tDriverUid = String(ticket.logistics?.assigned_to || ticket.logistics?.assignedTo || '');
                    
                    const isMeLegacy = (tDriverName && (tDriverName === uName || uName.includes(tDriverName) || tDriverName.includes(uName))) || 
                                       (tDriverUid && (tDriverUid === uId));
                    
                    if (isMeLegacy) {
                        const tStatus = ticket.status || 'Abierto';
                        const lStatus = ticket.logistics?.status || 'Pendiente';
                        const isCompleted = ['Cerrado', 'Resuelto', 'Caso SFDC Cerrado', 'Servicio Facturado'].includes(tStatus) || ['Entregado', 'Finalizado'].includes(lStatus);
                        
                        if (isCompleted) {
                            const dateStr = ticket.logistics?.date || ticket.date;
                            if (dateStr) {
                                const tDate = new Date(dateStr + 'T00:00:00');
                                if (tDate.getFullYear() === currentYear && tDate.getMonth() === currentMonth) {
                                    completedInMonthCount++;
                                }
                            }
                        }
                    }
                });
            }
            
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
                }).length,
                inRoute: inRouteCount,
                toCoordinate: toCoordinateCount,
                completedInMonth: completedInMonthCount
            };
        } catch (error) {
            console.error("Error calculating stats:", error);
            return { pending: 0, inProgress: 0, resolvedToday: 0, inRoute: 0, toCoordinate: 0, completedInMonth: 0 };
        }
    }, [sortedAndFilteredTickets, tickets, logisticsTasks, currentUser]);

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

    const handleDownloadRemito = (ticket) => {
        const parentTicket = ticket.parentTicket || ticket;
        const caseData = ticket.caseData || {};
        
        // 1. Normalizar activos de hardware
        let associatedAssets = [];
        if (caseData.assets && caseData.assets.length > 0) {
            associatedAssets = caseData.assets;
        } else if (parentTicket.associatedAssets && parentTicket.associatedAssets.length > 0) {
            associatedAssets = parentTicket.associatedAssets;
        } else if (parentTicket.associatedCases && parentTicket.associatedCases.length > 0 && ticket.legacyCaseIndex !== undefined) {
            const legCase = parentTicket.associatedCases[ticket.legacyCaseIndex];
            if (legCase && legCase.assets) associatedAssets = legCase.assets;
        } else if (parentTicket.assetInfo?.serial) {
            associatedAssets = [{
                serial: parentTicket.assetInfo.serial,
                type: parentTicket.assetInfo.model || 'Hardware',
                name: parentTicket.assetInfo.name || '-'
            }];
        }

        // 2. Normalizar accesorios
        const mappedAccessories = {};
        const rawAccessories = caseData.accessories || (ticket.legacyCaseIndex !== undefined ? parentTicket.associatedCases[ticket.legacyCaseIndex]?.accessories : null) || parentTicket.accessories;
        
        if (Array.isArray(rawAccessories)) {
            rawAccessories.forEach(acc => {
                const name = typeof acc === 'string' ? acc : (acc.name || acc);
                if (name === 'Mochila Técnica' || name === 'backpack') {
                    mappedAccessories.backpack = true;
                } else if (name === 'Filtro de Pantalla' || name === 'screenFilter') {
                    mappedAccessories.screenFilter = true;
                } else if (name === 'Mouse Óptico' || name === 'mouse') {
                    mappedAccessories.mouse = true;
                } else if (name === 'Teclado USB' || name === 'keyboard') {
                    mappedAccessories.keyboard = true;
                } else if (name === 'Auriculares con Micrófono' || name === 'headset') {
                    mappedAccessories.headset = true;
                } else if (name === 'Cargador Original' || name === 'charger') {
                    mappedAccessories.charger = true;
                } else if (name) {
                    mappedAccessories[name] = true;
                }
            });
        } else if (rawAccessories && typeof rawAccessories === 'object') {
            Object.assign(mappedAccessories, rawAccessories);
        }

        // 3. Normalizar Yubikeys
        const rawYubikeys = caseData.yubikeys || parentTicket.yubikeys || [];
        const mappedYubikeys = (Array.isArray(rawYubikeys) ? rawYubikeys : []).map(yk => ({
            serial: typeof yk === 'string' ? yk : yk.serial,
            type: (typeof yk === 'object' && yk?.type) || caseData.logistics?.type || parentTicket.logistics?.type || 'Entrega'
        }));

        // 4. Crear ticket virtual compatible
        const virtualTicket = {
            ...parentTicket,
            id: parentTicket.id,
            subject: ticket.displaySubject || parentTicket.subject,
            caseNumber: caseData.caseNumber || caseData.case_number || parentTicket.caseNumber || parentTicket.case_number,
            associatedAssets,
            accessories: mappedAccessories,
            yubikeys: mappedYubikeys,
            logistics: {
                ...(parentTicket.logistics || {}),
                method: caseData.method || parentTicket.logistics?.method,
                date: caseData.date || parentTicket.logistics?.date,
                timeSlot: caseData.timeSlot || parentTicket.logistics?.timeSlot,
                status: caseData.status || parentTicket.logistics?.status,
                phone: parentTicket.logistics?.phone || '',
                email: parentTicket.logistics?.email || '',
                address: ticket.displayAddress || parentTicket.logistics?.address || '',
                deliveryPerson: caseData.deliveryPerson || parentTicket.logistics?.deliveryPerson || '',
                type: (caseData.method || parentTicket.logistics?.method) === 'Recupero' ? 'Recupero' : 'Entrega'
            }
        };

        const deliveryInfo = caseData.deliveryInfo || caseData.delivery_info || parentTicket.deliveryDetails || {};

        // setTimeout(0) evita que jsPDF bloquee el hilo principal en dispositivos móviles
        setTimeout(() => {
            generateTicketPDF(virtualTicket, globalAssets, {
                receivedBy: deliveryInfo.receivedBy || deliveryInfo.received_by || '',
                dni: deliveryInfo.dni || '',
                notes: deliveryInfo.notes || '',
                actualTime: deliveryInfo.actualTime || deliveryInfo.actual_time || '',
                deliveredAt: deliveryInfo.deliveredAt || deliveryInfo.delivered_at || ''
            }, 'download');
        }, 0);
    };

    const renderTicketRow = (ticket) => (
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
                <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                    <Link href={`/dashboard/tickets/${ticket.id}`}>
                        <Button variant="ghost" size="sm" icon={Eye}>Detalles</Button>
                    </Link>
                    {ticket.isCompleted && (
                        <Button 
                            variant="ghost" 
                            size="sm" 
                            icon={Download} 
                            onClick={() => handleDownloadRemito(ticket)}
                            style={{ color: '#22c55e' }}
                            title="Descargar Remito"
                        >
                            Remito
                        </Button>
                    )}
                </div>
            </td>
        </tr>
    );

    const renderTicketCard = (ticket) => (
        <Card key={`${ticket.id}-${ticket.displayId}`} style={{
            padding: isConductor ? '0.75rem 0.9rem' : '1.25rem',
            borderLeft: `4px solid ${ticket.displayStatus === 'En Transito' ? '#0ea5e9' : ticket.displayStatus === 'Entregado' ? '#22c55e' : '#f59e0b'}`
        }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: isConductor ? '0.4rem' : '0.75rem' }}>
                <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                    <span style={{ fontWeight: 800, color: 'var(--primary-color)', fontSize: isConductor ? '0.8rem' : '1rem' }}>#{ticket.displayId}</span>
                    {!ticket.isMainTicket && <span style={{ fontSize: '0.55rem', background: '#f1f5f9', padding: '1px 3px', borderRadius: '3px' }}>Caso SFDC</span>}
                    {(ticket.instructions || ticket.hasNewNotes) && (
                        <div 
                            className={ticket.hasUnreadChat ? "unread-badge-v2" : ""}
                            style={{ 
                                color: ticket.hasUnreadChat ? 'white' : 'var(--primary-color)',
                                width: ticket.hasUnreadChat ? '16px' : 'auto',
                                height: ticket.hasUnreadChat ? '16px' : 'auto',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                            }}
                        >
                            <MessageSquare 
                                size={isConductor ? 11 : 14} 
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
                } style={{ fontSize: isConductor ? '0.62rem' : 'inherit', padding: isConductor ? '2px 6px' : 'inherit' }}>
                    {ticket.displayStatus || 'Pendiente'}
                </Badge>
            </div>
            <h3 style={{ fontSize: isConductor ? '0.85rem' : '1rem', fontWeight: 700, marginBottom: isConductor ? '0.3rem' : '0.5rem', color: 'var(--text-main)' }}>{ticket.displaySubject}</h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: isConductor ? '0.2rem' : '0.5rem', marginBottom: isConductor ? '0.8rem' : '1.25rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: isConductor ? '0.78rem' : '0.85rem' }}>
                    <User size={isConductor ? 12 : 14} style={{ color: 'var(--text-secondary)' }} />
                    <span style={{ fontWeight: 600 }}>{ticket.requester}</span>
                </div>
                {ticket.displayAddress && (
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.4rem', fontSize: isConductor ? '0.74rem' : '0.82rem', color: 'var(--text-secondary)' }}>
                        <MapPin size={isConductor ? 11 : 13} style={{ marginTop: '2px', flexShrink: 0 }} />
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                            {ticket.displayAddress}
                        </span>
                    </div>
                )}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: isConductor ? '0.78rem' : '0.85rem', marginTop: isConductor ? '2px' : '0' }}>
                    <Clock size={isConductor ? 12 : 14} style={{ color: 'var(--text-secondary)' }} />
                    <span>{ticket.displayDate || ticket.date}</span>
                    {ticket.taskTimeSlot && <span style={{ color: 'var(--text-secondary)', background: 'var(--background)', padding: '1px 4px', borderRadius: '3px', fontSize: '0.65rem', marginLeft: '4px' }}>{ticket.taskTimeSlot}</span>}
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
                            return `${days}d`;
                        })()}
                    </span>
                </div>
            </div>

            <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.5rem' }}>
                <Link href={`/dashboard/tickets/${ticket.id}`} style={{ flex: 1 }}>
                    <Button variant="secondary" icon={Eye} style={{ width: '100%', padding: isConductor ? '0.5rem' : '0.9rem', fontSize: isConductor ? '0.78rem' : '0.9rem', height: isConductor ? '36px' : 'auto' }}>DETALLES</Button>
                </Link>
                
                {ticket.isCompleted && (
                    <Button 
                        variant="success" 
                        icon={Download}
                        onClick={() => handleDownloadRemito(ticket)}
                        style={{ 
                            flex: 1, 
                            padding: isConductor ? '0.5rem' : '0.9rem', 
                            fontSize: isConductor ? '0.78rem' : '0.9rem', 
                            height: isConductor ? '36px' : 'auto',
                            backgroundColor: '#22c55e',
                            borderColor: '#22c55e',
                            color: 'white',
                            fontWeight: 'bold'
                        }}
                    >
                        REMITO
                    </Button>
                )}

                {/* Atajo de WhatsApp para móvil (solo si no está completado) */}
                {!ticket.isCompleted && ticket.parentTicket?.deliveryDetails?.contactPhone && (
                    <Button 
                        variant="success" 
                        onClick={() => window.open(`https://wa.me/${ticket.parentTicket.deliveryDetails.contactPhone.replace(/\D/g, '')}`, '_blank')}
                        style={{ width: isConductor ? '36px' : '56px', height: isConductor ? '36px' : '52px', flexShrink: 0, padding: 0 }}
                    >
                        <img src="https://upload.wikimedia.org/wikipedia/commons/6/6b/WhatsApp.svg" style={{ width: isConductor ? '16px' : '24px', height: isConductor ? '16px' : '24px' }} alt="WA" />
                    </Button>
                )}

                {/* Atajo de Navegación para móvil (solo si no está completado) */}
                {!ticket.isCompleted && ticket.displayAddress !== 'Sin dirección' && (
                    <Button 
                        variant="secondary" 
                        onClick={() => window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(ticket.displayAddress)}`, '_blank')}
                        style={{ width: isConductor ? '36px' : '56px', height: isConductor ? '36px' : '52px', flexShrink: 0, color: 'var(--primary-color)', fontSize: isConductor ? '0.9rem' : 'inherit' }}
                    >
                        📍
                    </Button>
                )}
            </div>
        </Card>
    );

    return (
        <div style={{ animation: 'fadeIn 0.5s ease-out' }}>
            <div className="flex-mobile-column" style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center', 
                marginBottom: isConductor ? '0.75rem' : '2rem', 
                gap: '1rem' 
            }}>
                <div>
                    <h1 style={{ fontSize: isConductor ? '1.4rem' : '1.8rem', fontWeight: 700, color: 'var(--text-main)' }}>Mis Casos</h1>
                    <p style={{ fontSize: isConductor ? '0.78rem' : '1rem', color: 'var(--text-secondary)' }}>Gestiona tus tareas asignadas y reporta entregas.</p>
                </div>
                <div style={{ padding: isConductor ? '0.5rem' : '0.75rem', backgroundColor: 'rgba(59, 130, 246, 0.1)', borderRadius: '50%', color: '#3b82f6' }}>
                    <Truck size={isConductor ? 16 : 24} />
                </div>
            </div>

            <div className="grid-responsive-dashboard" style={{ 
                marginBottom: isConductor ? '0.75rem' : '2rem',
                display: 'grid',
                gridTemplateColumns: isConductor ? 'repeat(4, 1fr)' : 'repeat(3, 1fr)',
                gap: isConductor ? '0.35rem' : '1rem'
            }}>
                {/* CARD 1: TOTAL (Only shown in driver view as first card) */}
                {isConductor && (
                    <Card 
                        onClick={() => setConductorFilter('active')}
                        style={{ 
                            padding: '0.4rem 0.5rem', 
                            position: 'relative', 
                            overflow: 'hidden',
                            cursor: 'pointer',
                            border: conductorFilter === 'active' ? '2px solid var(--primary-color)' : '1px solid var(--border)',
                            transform: conductorFilter === 'active' ? 'scale(1.02)' : 'none',
                            transition: 'all 0.2s ease',
                            backgroundColor: conductorFilter === 'active' ? 'rgba(59, 130, 246, 0.04)' : 'var(--surface)'
                        }}
                    >
                        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', height: '100%' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <p style={{ fontSize: '0.62rem', color: 'var(--text-secondary)', fontWeight: 700, margin: 0, textTransform: 'uppercase', letterSpacing: '0.02em' }}>
                                    Total
                                </p>
                                <div style={{ width: '5px', height: '5px', borderRadius: '50%', backgroundColor: 'var(--primary-color)' }} />
                            </div>
                            <h2 style={{ fontSize: '1.2rem', fontWeight: 800, margin: '0.1rem 0 0 0', color: 'var(--text-main)' }}>
                                {myAssignedItems.filter(item => !item.isCompleted).length}
                            </h2>
                        </div>
                    </Card>
                )}

                <Card 
                    onClick={() => isConductor && setConductorFilter('inRoute')}
                    style={{ 
                        padding: isConductor ? '0.4rem 0.5rem' : '1.5rem', 
                        position: 'relative', 
                        overflow: 'hidden',
                        cursor: isConductor ? 'pointer' : 'default',
                        border: isConductor && conductorFilter === 'inRoute' ? '2px solid #3b82f6' : '1px solid var(--border)',
                        transform: isConductor && conductorFilter === 'inRoute' ? 'scale(1.02)' : 'none',
                        transition: 'all 0.2s ease',
                        backgroundColor: isConductor && conductorFilter === 'inRoute' ? 'rgba(59, 130, 246, 0.04)' : 'var(--surface)'
                    }}
                >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ flex: 1 }}>
                            <p style={{ fontSize: isConductor ? '0.62rem' : '0.875rem', color: 'var(--text-secondary)', fontWeight: 600, margin: 0, textTransform: isConductor ? 'uppercase' : 'none', letterSpacing: isConductor ? '0.02em' : 'normal' }}>
                                {isConductor ? 'En Ruta' : 'Pendientes'}
                            </p>
                            <h2 style={{ fontSize: isConductor ? '1.2rem' : '2rem', fontWeight: 800, margin: '0.1rem 0 0 0' }}>
                                {isConductor ? stats.inRoute : stats.pending}
                            </h2>
                        </div>
                        {!isConductor ? (
                            <div style={{ padding: '0.35rem', background: 'rgba(59, 130, 246, 0.1)', borderRadius: '6px', color: '#3b82f6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <Truck size={20} />
                            </div>
                        ) : (
                            <div style={{ width: '5px', height: '5px', borderRadius: '50%', backgroundColor: '#3b82f6' }} />
                        )}
                    </div>
                </Card>

                <Card 
                    onClick={() => isConductor && setConductorFilter('toCoordinate')}
                    style={{ 
                        padding: isConductor ? '0.4rem 0.5rem' : '1.5rem', 
                        position: 'relative', 
                        overflow: 'hidden',
                        cursor: isConductor ? 'pointer' : 'default',
                        border: isConductor && conductorFilter === 'toCoordinate' ? '2px solid #eab308' : '1px solid var(--border)',
                        transform: isConductor && conductorFilter === 'toCoordinate' ? 'scale(1.02)' : 'none',
                        transition: 'all 0.2s ease',
                        backgroundColor: isConductor && conductorFilter === 'toCoordinate' ? 'rgba(234, 179, 8, 0.04)' : 'var(--surface)'
                    }}
                >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ flex: 1 }}>
                            <p style={{ fontSize: isConductor ? '0.62rem' : '0.875rem', color: 'var(--text-secondary)', fontWeight: 600, margin: 0, textTransform: isConductor ? 'uppercase' : 'none', letterSpacing: isConductor ? '0.02em' : 'normal' }}>
                                {isConductor ? 'Para Coord.' : 'En Progreso'}
                            </p>
                            <h2 style={{ fontSize: isConductor ? '1.2rem' : '2rem', fontWeight: 800, margin: '0.1rem 0 0 0' }}>
                                {isConductor ? stats.toCoordinate : stats.inProgress}
                            </h2>
                        </div>
                        {!isConductor ? (
                            <div style={{ padding: '0.35rem', background: 'rgba(234, 179, 8, 0.1)', borderRadius: '6px', color: '#eab308', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <Clock size={20} />
                            </div>
                        ) : (
                            <div style={{ width: '5px', height: '5px', borderRadius: '50%', backgroundColor: '#eab308' }} />
                        )}
                    </div>
                </Card>

                <Card 
                    onClick={() => isConductor && setConductorFilter('completed')}
                    style={{ 
                        padding: isConductor ? '0.4rem 0.5rem' : '1.5rem', 
                        position: 'relative', 
                        overflow: 'hidden',
                        cursor: isConductor ? 'pointer' : 'default',
                        border: isConductor && conductorFilter === 'completed' ? '2px solid #22c55e' : '1px solid var(--border)',
                        transform: isConductor && conductorFilter === 'completed' ? 'scale(1.02)' : 'none',
                        transition: 'all 0.2s ease',
                        backgroundColor: isConductor && conductorFilter === 'completed' ? 'rgba(34, 197, 94, 0.04)' : 'var(--surface)'
                    }}
                >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ flex: 1 }}>
                            <p style={{ fontSize: isConductor ? '0.62rem' : '0.875rem', color: 'var(--text-secondary)', fontWeight: 600, margin: 0, textTransform: isConductor ? 'uppercase' : 'none', letterSpacing: isConductor ? '0.02em' : 'normal' }}>
                                {isConductor ? 'Realizados' : 'Resueltos Hoy'}
                            </p>
                            <h2 style={{ fontSize: isConductor ? '1.2rem' : '2rem', fontWeight: 800, margin: '0.1rem 0 0 0' }}>
                                {isConductor ? stats.completedInMonth : stats.resolvedToday}
                            </h2>
                        </div>
                        {!isConductor ? (
                            <div style={{ padding: '0.35rem', background: 'rgba(34, 197, 94, 0.1)', borderRadius: '6px', color: '#22c55e', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <CheckCircle2 size={20} />
                            </div>
                        ) : (
                            <div style={{ width: '5px', height: '5px', borderRadius: '50%', backgroundColor: '#22c55e' }} />
                        )}
                    </div>
                </Card>
            </div>

            <div style={{ 
                display: 'flex', 
                justifyContent: isConductor ? 'space-between' : 'flex-end', 
                gap: isConductor ? '6px' : '8px', 
                marginBottom: '1rem',
                width: '100%'
            }}>
                <Button 
                    variant="secondary" 
                    icon={Route} 
                    onClick={() => setIsOptimizationModalOpen(true)}
                    style={isConductor ? { flex: 1, padding: '0.45rem 0.5rem', fontSize: '0.78rem', justifyContent: 'center', height: 'auto', minHeight: '0' } : {}}
                >
                    {isConductor ? 'Optimizar' : 'Optimizar Ruta'}
                </Button>
                <Button 
                    variant="secondary" 
                    icon={MapIcon} 
                    onClick={() => setIsMapOpen(true)}
                    style={isConductor ? { flex: 1, padding: '0.45rem 0.5rem', fontSize: '0.78rem', justifyContent: 'center', height: 'auto', minHeight: '0' } : {}}
                >
                    {isConductor ? 'Mapa' : 'Ver Mapa'}
                </Button>
                <Button 
                    icon={Plus} 
                    onClick={() => setIsModalOpen(true)}
                    style={isConductor ? { flex: 1, padding: '0.45rem 0.5rem', fontSize: '0.78rem', justifyContent: 'center', height: 'auto', minHeight: '0' } : {}}
                >
                    {isConductor ? 'Nuevo' : 'Nuevo Caso'}
                </Button>
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
                            Total Casos: <span style={{ color: 'var(--text-main)', fontWeight: 700 }}>{sortedAndFilteredTickets.length}</span>
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
                                {isConductor && conductorFilter === 'completed' && groupedCompletedTickets ? (
                                    groupedCompletedTickets.map(([date, groupTickets]) => (
                                        <React.Fragment key={date}>
                                            <tr style={{ backgroundColor: 'rgba(34, 197, 94, 0.04)' }}>
                                                <td colSpan={7} style={{ padding: '0.6rem 1rem', fontWeight: 700, fontSize: '0.8rem', color: '#22c55e', borderBottom: '1px solid var(--border)' }}>
                                                    {(() => {
                                                        if (date === 'Sin Fecha') return 'FECHA NO DEFINIDA';
                                                        const d = new Date(date + 'T00:00:00');
                                                        if (isNaN(d.getTime())) return date.toUpperCase();
                                                        const days = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
                                                        const months = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
                                                        return `REALIZADOS EL ${days[d.getDay()].toUpperCase()} ${d.getDate()} DE ${months[d.getMonth()].toUpperCase()}`;
                                                    })()}
                                                </td>
                                            </tr>
                                            {groupTickets.map((ticket) => renderTicketRow(ticket))}
                                        </React.Fragment>
                                    ))
                                ) : (
                                    sortedAndFilteredTickets.map((ticket) => renderTicketRow(ticket))
                                )}
                            </tbody>
                        </table>
                    )}
                </div>

                {/* Vista Mobile (Tarjetas) */}
                <div className="show-mobile" style={{ padding: isConductor ? '0.5rem' : '1rem' }}>
                    {sortedAndFilteredTickets.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '2rem 0' }}>
                            <p style={{ color: 'var(--text-secondary)' }}>No se encontraron servicios.</p>
                        </div>
                    ) : (
                        isConductor && conductorFilter === 'completed' && groupedCompletedTickets ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                                {groupedCompletedTickets.map(([date, groupTickets]) => (
                                    <div key={date} style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                                        {/* Cabecera de fecha agrupada */}
                                        <div style={{ 
                                            display: 'flex', 
                                            alignItems: 'center', 
                                            gap: '0.75rem', 
                                            padding: '0.4rem 0.5rem',
                                            position: 'sticky',
                                            top: '0',
                                            backgroundColor: 'var(--background)',
                                            zIndex: 10,
                                        }}>
                                            <div style={{ backgroundColor: '#22c55e', width: '8px', height: '8px', borderRadius: '50%' }}></div>
                                            <h4 style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-main)', textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0 }}>
                                                {(() => {
                                                    if (date === 'Sin Fecha') return 'FECHA NO DEFINIDA';
                                                    const d = new Date(date + 'T00:00:00');
                                                    if (isNaN(d.getTime())) return date;
                                                    const days = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
                                                    const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
                                                    return `${days[d.getDay()]} ${d.getDate()} ${months[d.getMonth()]}`;
                                                })()}
                                            </h4>
                                            <div style={{ flex: 1, height: '1px', background: 'linear-gradient(to right, rgba(34, 197, 94, 0.2), transparent)' }}></div>
                                        </div>
                                        {groupTickets.map((ticket) => renderTicketCard(ticket))}
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: isConductor ? '0.5rem' : '1rem' }}>
                                {sortedAndFilteredTickets.map((ticket) => renderTicketCard(ticket))}
                            </div>
                        )
                    )}
                </div>
            </Card>

            <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Crear Nuevo Caso">
                <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                    <div className="form-group">
                        <label className="form-label">Número de Caso SFDC (Opcional)</label>
                        <input
                            className="form-input"
                            placeholder="Ej: 03102345"
                            value={newTicket.caseNumber}
                            onChange={e => setNewTicket({ ...newTicket, caseNumber: e.target.value })}
                        />
                    </div>
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
                        <Button type="submit" style={{ flex: 1 }}>Crear Caso</Button>
                    </div>
                </form>
            </Modal>

            {/* Service Map Modal */}
            <Modal isOpen={isMapOpen} onClose={() => setIsMapOpen(false)} title="Mapa de Casos" maxWidth="900px">
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
