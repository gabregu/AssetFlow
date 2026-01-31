"use client";
import React, { useState, useMemo } from 'react';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Modal } from '../../components/ui/Modal';
import { ServiceMap } from '../../components/ui/ServiceMap';
import { useStore } from '../../../lib/store';
import { Plus, Filter, Search, Eye, Trash2, Archive, AlertCircle, Clock, CheckCircle2, Loader2, User, Truck, CreditCard, TrendingUp, Map as MapIcon, Route } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { resolveTicketServiceDetails, getRate } from '../billing/utils';
import { useJsApiLoader } from '@react-google-maps/api';

const GOOGLE_MAPS_LIBRARIES = ['geometry'];

export default function MyTicketsPage() {
    const router = useRouter();
    const { tickets, assets: globalAssets, addTicket, deleteTickets, currentUser, rates } = useStore();

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

    // Filtramos los tickets asignados al usuario actual que NO estén resueltos
    const myTickets = useMemo(() => {
        return tickets.filter(t =>
            t.logistics?.deliveryPerson === currentUser?.name &&
            t.status !== 'Cerrado' &&
            t.status !== 'Resuelto' &&
            t.status !== 'Caso SFDC Cerrado' &&
            t.status !== 'Servicio Facturado'
        );
    }, [tickets, currentUser]);

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

    const handleCreate = (e) => {
        e.preventDefault();
        // Al crear desde "Mis Servicios", auto-asignar al usuario actual
        const ticketData = {
            ...newTicket,
            logistics: {
                ...newTicket.logistics,
                method: 'Repartidor Propio',
                deliveryPerson: currentUser.name
            }
        };
        const createdTicket = addTicket(ticketData);
        setIsModalOpen(false);
        setNewTicket({ subject: '', requester: '', priority: 'Media', status: 'Abierto' });
        router.push(`/dashboard/tickets/${createdTicket.id}`);
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
        let result = myTickets.filter(t => {
            const matchesSearch = t.subject.toLowerCase().includes(filter.toLowerCase()) ||
                t.requester.toLowerCase().includes(filter.toLowerCase()) ||
                t.id.toLowerCase().includes(filter.toLowerCase());

            const matchesStatus = columnFilters.status === 'All' || t.status === columnFilters.status;
            const matchesRequester = !columnFilters.requester || t.requester.toLowerCase().includes(columnFilters.requester.toLowerCase());

            return matchesSearch && matchesStatus && matchesRequester;
        });

        // Apply Optimized Order if Active
        if (sortConfig.key === 'optimized' && optimizedOrder) {
            result.sort((a, b) => {
                const idxA = optimizedOrder.indexOf(a.id);
                const idxB = optimizedOrder.indexOf(b.id);
                // If ID not found (new ticket?), put at end
                const safeIdxA = idxA === -1 ? 9999 : idxA;
                const safeIdxB = idxB === -1 ? 9999 : idxB;
                return safeIdxA - safeIdxB;
            });
            return result;
        }

        if (sortConfig.key) {
            result.sort((a, b) => {
                const valA = a[sortConfig.key] || '';
                const valB = b[sortConfig.key] || '';
                if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
                if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
                return 0;
            });
        }
        return result;
    }, [myTickets, filter, sortConfig, columnFilters, optimizedOrder]);

    // Estadísticas para las tarjetas KPI basándose solo en mis tickets
    const stats = useMemo(() => {
        const today = new Date().toLocaleDateString('en-CA');

        const allMyTickets = tickets.filter(t => t.logistics?.deliveryPerson === currentUser?.name);

        let personalLiquidation = 0;
        let deliveriesCount = 0;
        let recoveriesCount = 0;

        const deliveredToday = allMyTickets.filter(t => {
            if (t.deliveryStatus !== 'Entregado') return false;
            if (!t.deliveryCompletedDate) return false;
            const completedDate = new Date(t.deliveryCompletedDate).toLocaleDateString('en-CA');
            return completedDate === today;
        }).length;

        const currentMonth = new Date().getMonth();
        const currentYear = new Date().getFullYear();

        const historyData = [];
        for (let i = 5; i >= 0; i--) {
            const date = new Date(currentYear, currentMonth - i, 1);
            historyData.push({
                month: date.getMonth(),
                year: date.getFullYear(),
                label: date.toLocaleDateString('es-ES', { month: 'short' }),
                total: 0
            });
        }

        allMyTickets.forEach(t => {
            const ticketDate = new Date(t.date || t.deliveryCompletedDate || Date.now());
            const isFinished = ['Resuelto', 'Caso SFDC Cerrado', 'Servicio Facturado'].includes(t.status);

            const { moveType: finalMoveType, assetType: finalDeviceType } = resolveTicketServiceDetails(t, globalAssets);
            const isDelivery = finalMoveType.toLowerCase().includes('entrega') || finalMoveType.toLowerCase().includes('alta');
            const isRecovery = finalMoveType.toLowerCase().includes('recupero') || finalMoveType.toLowerCase().includes('retiro') || finalMoveType.toLowerCase().includes('baja');

            // --- Calcular Monto ---
            const lowerDevice = (finalDeviceType || '').toLowerCase();
            const isLaptop = lowerDevice.includes('laptop') || lowerDevice.includes('macbook') || lowerDevice.includes('notebook') || lowerDevice.includes('equipo') || lowerDevice.includes('pc');
            const isPhone = lowerDevice.includes('smartphone') || lowerDevice.includes('celular') || lowerDevice.includes('iphone') || lowerDevice.includes('samsung');
            const isKey = lowerDevice.includes('key') || lowerDevice.includes('yubikey') || lowerDevice.includes('llave');

            const baseCommission = getRate(rates?.cost_Driver_Commission, rates?.driverCommission, 15);
            let extra = 0;

            const driverNameRaw = currentUser?.name || '';
            let driverKey = null;
            const dLower = driverNameRaw.toLowerCase();
            if (dLower.includes('lucas')) driverKey = 'Lucas';
            else if (dLower.includes('facundo')) driverKey = 'Facundo';
            else if (dLower.includes('guillermo')) driverKey = 'Guillermo';

            if (driverKey) {
                const moveKey = isDelivery ? 'Delivery' : (isRecovery ? 'Recovery' : null);
                const deviceKey = isLaptop ? 'Laptop' : (isPhone ? 'Smartphone' : (isKey ? 'Key' : null));
                if (moveKey && deviceKey) {
                    const rateKey = `driverExtra_${driverKey}_${moveKey}_${deviceKey}`;
                    const extraVal = rates?.[rateKey];
                    if (extraVal !== undefined && extraVal !== null && !isNaN(parseFloat(extraVal))) {
                        extra = parseFloat(extraVal);
                    }
                }
            }
            const amount = (baseCommission + extra);

            // --- Asignar a Meses ---
            if (isFinished) {
                if (ticketDate.getMonth() === currentMonth && ticketDate.getFullYear() === currentYear) {
                    personalLiquidation += amount;
                    if (isDelivery) deliveriesCount++;
                    if (isRecovery) recoveriesCount++;
                }

                const histIdx = historyData.findIndex(h => h.month === ticketDate.getMonth() && h.year === ticketDate.getFullYear());
                if (histIdx !== -1) {
                    historyData[histIdx].total += amount;
                }
            }
        });

        return {
            total: myTickets.length,
            pendiente: myTickets.filter(t => !t.deliveryStatus || t.deliveryStatus === 'Pendiente').length,
            paraCoordinar: myTickets.filter(t => t.deliveryStatus === 'Para Coordinar').length,
            enTransito: myTickets.filter(t => t.deliveryStatus === 'En Transito').length,
            entregadosHoy: deliveredToday,
            personalLiquidation,
            deliveriesCount,
            recoveriesCount,
            historyData
        };
    }, [myTickets, tickets, currentUser, rates, globalAssets]);

    const getStatusVariant = (status) => {
        switch (status) {
            case 'Abierto': return 'danger';
            case 'En Progreso': return 'info';
            case 'Resuelto': return 'success';
            case 'Pendiente': return 'warning';
            default: return 'default';
        }
    };

    const SortIcon = ({ column }) => {
        if (sortConfig.key !== column) return <span style={{ opacity: 0.3, marginLeft: '4px' }}>↕</span>;
        return <span style={{ marginLeft: '4px', color: 'var(--primary-color)' }}>{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>;
    };

    return (
        <div style={{ animation: 'fadeIn 0.5s ease-out' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2rem' }}>
                <div>
                    <h1 style={{ fontSize: '1.8rem', fontWeight: 700, color: 'var(--text-main)' }}>Mis Servicios</h1>
                    <p style={{ color: 'var(--text-secondary)' }}>Tickets asignados bajo tu responsabilidad.</p>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.75rem' }}>
                    <div style={{ display: 'flex', gap: '8px' }}>
                        <Button variant="secondary" icon={Route} onClick={() => setIsOptimizationModalOpen(true)}>Optimizar Ruta</Button>
                        <Button variant="secondary" icon={MapIcon} onClick={() => setIsMapOpen(true)}>Ver Mapa</Button>
                        <Button icon={Plus} onClick={() => setIsModalOpen(true)}>Nuevo Servicio</Button>
                    </div>
                </div>
            </div>

            {/* Fila 1: Indicadores Básicos */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                gap: '1.25rem',
                marginBottom: '1.25rem'
            }}>
                {/* Total */}
                <Card
                    style={{
                        padding: '1.25rem',
                        borderLeft: '4px solid var(--primary-color)',
                        backgroundColor: 'var(--surface)',
                    }}
                >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <div style={{ padding: '0.5rem', backgroundColor: 'var(--background)', borderRadius: '50%', color: 'var(--primary-color)' }}>
                            <Archive size={20} />
                        </div>
                        <div>
                            <p style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', margin: 0, textTransform: 'uppercase', fontWeight: 700 }}>Total Pend.</p>
                            <h3 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0 }}>{stats.total}</h3>
                        </div>
                    </div>
                </Card>

                {/* Pendiente / Para Coordinar */}
                <Card
                    style={{
                        padding: '1.25rem',
                        borderLeft: '4px solid #f97316',
                        backgroundColor: 'var(--surface)',
                    }}
                >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <div style={{ padding: '0.5rem', backgroundColor: '#fff7ed', borderRadius: '50%', color: '#f97316' }}>
                            <AlertCircle size={20} />
                        </div>
                        <div>
                            <p style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', margin: 0, textTransform: 'uppercase', fontWeight: 700 }}>Para Coordinar</p>
                            <h3 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0 }}>{stats.paraCoordinar}</h3>
                        </div>
                    </div>
                </Card>

                {/* En Transito */}
                <Card
                    style={{
                        padding: '1.25rem',
                        borderLeft: '4px solid #3b82f6',
                        backgroundColor: 'var(--surface)',
                    }}
                >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <div style={{ padding: '0.5rem', backgroundColor: '#eff6ff', borderRadius: '50%', color: '#3b82f6' }}>
                            <Truck size={20} />
                        </div>
                        <div>
                            <p style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', margin: 0, textTransform: 'uppercase', fontWeight: 700 }}>En Tránsito</p>
                            <h3 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0 }}>{stats.enTransito}</h3>
                        </div>
                    </div>
                </Card>

                {/* Entregados HOY */}
                <Card
                    style={{
                        padding: '1.25rem',
                        borderLeft: '4px solid #22c55e',
                        backgroundColor: 'rgba(34, 197, 94, 0.05)',
                    }}
                >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <div style={{ padding: '0.5rem', backgroundColor: '#f0fdf4', borderRadius: '50%', color: '#22c55e' }}>
                            <CheckCircle2 size={20} />
                        </div>
                        <div>
                            <p style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', margin: 0, textTransform: 'uppercase', fontWeight: 700 }}>Entregados Hoy</p>
                            <h3 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0 }}>{stats.entregadosHoy}</h3>
                        </div>
                    </div>
                </Card>
            </div>

            {/* Fila 2: Liquidación y Evolución */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
                gap: '1.25rem',
                marginBottom: '2rem'
            }}>
                {/* Resumen de Liquidación Estilo Billing */}
                <Card
                    style={{
                        padding: '1.5rem',
                        borderLeft: '4px solid #8b5cf6',
                        backgroundColor: 'var(--surface)',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'center'
                    }}
                >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
                            <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: '#f5f3ff', color: '#8b5cf6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '1.4rem', border: '2px solid rgba(139, 92, 246, 0.1)' }}>
                                {(currentUser?.name || 'U').charAt(0).toUpperCase()}
                            </div>
                            <div>
                                <div style={{ fontWeight: 700, fontSize: '1.2rem', color: 'var(--text-main)', marginBottom: '4px' }}>{currentUser?.name}</div>
                                <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <Badge variant="outline" style={{ border: 'none', background: 'rgba(139, 92, 246, 0.05)', color: '#8b5cf6' }}>{stats.deliveriesCount} entregas</Badge>
                                    <span style={{ opacity: 0.3 }}>|</span>
                                    <Badge variant="outline" style={{ border: 'none', background: 'rgba(139, 92, 246, 0.05)', color: '#8b5cf6' }}>{stats.recoveriesCount} recuperos</Badge>
                                </div>
                            </div>
                        </div>
                        <div style={{ textAlign: 'right', minWidth: '140px' }}>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 700, marginBottom: '2px' }}>Personal Liquidation</div>
                            <div style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-main)', letterSpacing: '-0.5px' }}>
                                USD {stats.personalLiquidation.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                            </div>
                        </div>
                    </div>
                </Card>

                {/* Gráfico Comparativo 6 Meses */}
                <Card
                    style={{
                        padding: '1.5rem',
                        backgroundColor: 'var(--surface)',
                        display: 'flex',
                        flexDirection: 'column'
                    }}
                >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <TrendingUp size={18} style={{ color: '#8b5cf6' }} />
                            <span style={{ fontSize: '0.85rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-secondary)' }}>Evolución 6 Meses</span>
                        </div>
                        <span style={{ fontSize: '0.75rem', color: '#8b5cf6', fontWeight: 600 }}>Crecimiento Personal</span>
                    </div>

                    <div style={{ height: '80px', display: 'flex', alignItems: 'flex-end', gap: '10px', paddingBottom: '5px' }}>
                        {stats.historyData.map((h, i) => {
                            const max = Math.max(...stats.historyData.map(d => d.total), 1);
                            const height = (h.total / max) * 100;
                            return (
                                <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
                                    <div style={{
                                        width: '100%',
                                        height: `${Math.max(height, 5)}%`,
                                        background: i === 5 ? 'linear-gradient(to top, #8b5cf6, #a78bfa)' : 'rgba(139, 92, 246, 0.15)',
                                        borderRadius: '4px',
                                        transition: 'height 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
                                        cursor: 'pointer'
                                    }} title={`USD ${h.total.toFixed(2)}`} />
                                    <span style={{ fontSize: '0.65rem', fontWeight: 700, color: i === 5 ? 'var(--text-main)' : 'var(--text-secondary)' }}>{h.label}</span>
                                </div>
                            );
                        })}
                    </div>
                </Card>
            </div>

            <Card style={{ padding: 0 }}>
                <div style={{ padding: '1.5rem', borderBottom: '1px solid var(--border)' }}>
                    <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                        <div style={{ position: 'relative', flex: 1, minWidth: '240px' }}>
                            <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
                            <input
                                type="text"
                                placeholder="Buscar en mis tickets..."
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
                    {myTickets.length === 0 ? (
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
                                    <tr key={ticket.id} style={{ borderBottom: '1px solid var(--border)' }} className="table-row-hover">
                                        <td style={{ padding: '1rem', fontWeight: 600 }}>{ticket.id}</td>
                                        <td style={{ padding: '1rem' }}>
                                            <div style={{ fontWeight: 600 }}>{ticket.subject}</div>
                                            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                                <span>Prioridad: {ticket.priority}</span>
                                                {ticket.logistics?.address && (
                                                    <a
                                                        href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(ticket.logistics.address)}`}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        style={{ color: 'var(--primary-color)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '4px' }}
                                                        onClick={(e) => e.stopPropagation()}
                                                    >
                                                        📍 {ticket.logistics.address}
                                                    </a>
                                                )}
                                            </div>
                                        </td>
                                        <td style={{ padding: '1rem' }}>{ticket.requester}</td>
                                        <td style={{ padding: '1rem' }}>
                                            <div style={{ fontWeight: 500 }}>{ticket.logistics?.date ? new Date(ticket.logistics.date).toLocaleDateString() : '-'}</div>
                                            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                                                {ticket.logistics?.timeSlot ? `Turno: ${ticket.logistics.timeSlot}` : ''}
                                            </div>
                                        </td>
                                        <td style={{ padding: '1rem' }}>
                                            <span style={{
                                                fontSize: '0.85rem',
                                                fontWeight: 600,
                                                color: (() => {
                                                    const days = Math.floor((new Date() - new Date(ticket.date)) / (1000 * 60 * 60 * 24));
                                                    return days > 5 ? '#ef4444' : (days > 2 ? '#f59e0b' : 'var(--text-secondary)');
                                                })()
                                            }}>
                                                {Math.floor((new Date() - new Date(ticket.date)) / (1000 * 60 * 60 * 24))}d
                                            </span>
                                        </td>
                                        <td style={{ padding: '1rem' }}>
                                            <Badge variant={
                                                ticket.deliveryStatus === 'En Transito' ? 'info' :
                                                    ticket.deliveryStatus === 'Entregado' ? 'success' :
                                                        ticket.deliveryStatus === 'Para Coordinar' ? 'warning' : 'default'
                                            }>
                                                {ticket.deliveryStatus || 'Pendiente'}
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
                                <Card key={ticket.id} style={{
                                    padding: '1.25rem',
                                    borderLeft: `4px solid ${ticket.status === 'Abierto' ? '#ef4444' : ticket.status === 'Resuelto' ? '#22c55e' : '#eab308'}`
                                }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
                                        <span style={{ fontWeight: 800, color: 'var(--primary-color)' }}>#{ticket.id}</span>
                                        <Badge variant={getStatusVariant(ticket.status)}>{ticket.status}</Badge>
                                    </div>
                                    <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '0.5rem' }}>{ticket.subject}</h3>

                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1.25rem' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem' }}>
                                            <User size={14} style={{ color: 'var(--text-secondary)' }} />
                                            <span style={{ fontWeight: 500 }}>{ticket.requester}</span>
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem' }}>
                                            <Clock size={14} style={{ color: 'var(--text-secondary)' }} />
                                            <span>{ticket.date}</span>
                                            <span style={{
                                                marginLeft: 'auto',
                                                fontWeight: 700,
                                                color: (() => {
                                                    const days = Math.floor((new Date() - new Date(ticket.date)) / (1000 * 60 * 60 * 24));
                                                    return days > 5 ? '#ef4444' : (days > 2 ? '#f59e0b' : 'var(--text-secondary)');
                                                })()
                                            }}>
                                                {Math.floor((new Date() - new Date(ticket.date)) / (1000 * 60 * 60 * 24))} días
                                            </span>
                                        </div>
                                    </div>

                                    <Link href={`/dashboard/tickets/${ticket.id}`} style={{ width: '100%' }}>
                                        <Button variant="secondary" icon={Eye} style={{ width: '100%', padding: '0.8rem' }}>DETALLES</Button>
                                    </Link>
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
