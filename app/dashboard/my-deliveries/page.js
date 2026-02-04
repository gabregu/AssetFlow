"use client";
import React, { useState, useMemo, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Modal } from '../../components/ui/Modal';
import { QRScannerModal } from '../../components/ui/QRScannerModal';
import { useStore } from '../../../lib/store';
import { Truck, MapPin, Calendar, Clock, CheckCircle2, Navigation, FileText, BarChart3, TrendingUp, Archive, QrCode, Route, Loader2 } from 'lucide-react';
import { generateTicketPDF } from '../../../lib/pdf-generator';
import { useJsApiLoader } from '@react-google-maps/api';

const GOOGLE_MAPS_LIBRARIES = ['geometry'];

export default function MyDeliveriesPage() {
    const { tickets, assets, currentUser, updateTicket } = useStore();
    const [selectedDelivery, setSelectedDelivery] = useState(null);
    const [isDeliveryModalOpen, setIsDeliveryModalOpen] = useState(false);
    const [isScannerOpen, setIsScannerOpen] = useState(false);
    const [deliveryForm, setDeliveryForm] = useState({
        receivedBy: '',
        dni: '',
        actualTime: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        notes: '',
        photoUrl: ''
    });

    // Route Optimization State
    const [isOptimizationModalOpen, setIsOptimizationModalOpen] = useState(false);
    const [optimizationOrigin, setOptimizationOrigin] = useState('deposito'); // deposito, oficina, custom
    const [customOriginAddress, setCustomOriginAddress] = useState('');
    const [originAddressStatus, setOriginAddressStatus] = useState('idle'); // idle, validating, valid, invalid
    const [isOptimizing, setIsOptimizing] = useState(false);
    const [optimizedOrder, setOptimizedOrder] = useState(null); // Array of ticket IDs in order

    // Maps Loader
    const { isLoaded: isMapsLoaded } = useJsApiLoader({
        id: 'google-map-script',
        googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY,
        libraries: GOOGLE_MAPS_LIBRARIES
    });

    const [scanAlert, setScanAlert] = useState(null);

    // Filter deliveries assigned to me
    const myDeliveries = useMemo(() => {
        if (!currentUser) return [];
        let filtered = tickets.filter(t =>
            (t.logistics?.deliveryPerson === currentUser.name || t.logistics?.deliveryPerson === currentUser.username) &&
            (t.logistics?.enabled || t.logistics?.userContacted || t.deliveryStatus === 'En Transito')
        );

        // Apply optimized order if exists
        if (optimizedOrder) {
            return [...filtered].sort((a, b) => {
                const idxA = optimizedOrder.indexOf(a.id);
                const idxB = optimizedOrder.indexOf(b.id);
                if (idxA === -1 && idxB === -1) return 0;
                if (idxA === -1) return 1;
                if (idxB === -1) return -1;
                return idxA - idxB;
            });
        }

        // Default sort by date
        return filtered.sort((a, b) => {
            const dateA = a.logistics?.date || a.logistics?.datetime || '';
            const dateB = b.logistics?.date || b.logistics?.datetime || '';
            return dateA.localeCompare(dateB);
        });
    }, [tickets, currentUser, optimizedOrder]);

    const stats = useMemo(() => {
        const now = new Date();
        const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

        const finishedThisMonth = tickets.filter(t =>
            (t.logistics?.deliveryPerson === currentUser?.name || t.logistics?.deliveryPerson === currentUser?.username) &&
            t.status === 'Resuelto' &&
            new Date(t.date) >= firstDayOfMonth
        ).length;

        const pendingThisWeek = myDeliveries.filter(t => t.status !== 'Resuelto').length;

        // Mock history for chart
        const last6Months = Array.from({ length: 6 }, (_, i) => {
            const date = new Date();
            date.setMonth(date.getMonth() - (5 - i));
            return {
                label: date.toLocaleString('default', { month: 'short' }),
                count: Math.floor(Math.random() * 10) + 5
            };
        });

        return { finishedThisMonth, pendingThisWeek, last6Months };
    }, [tickets, currentUser, myDeliveries]);

    const groupedDeliveries = useMemo(() => {
        const groups = {};
        myDeliveries.forEach(delivery => {
            const date = delivery.logistics?.date || delivery.logistics?.datetime?.split('T')[0] || 'Sin Fecha';
            if (!groups[date]) groups[date] = [];
            groups[date].push(delivery);
        });
        return groups;
    }, [myDeliveries]);

    const validateOriginAddress = () => {
        if (!isMapsLoaded) return;
        if (!customOriginAddress) return;

        setOriginAddressStatus('validating');
        const geocoder = new window.google.maps.Geocoder();
        geocoder.geocode({ address: customOriginAddress }, (results, status) => {
            if (status === 'OK' && results[0]) {
                setOriginAddressStatus('valid');
                setCustomOriginAddress(results[0].formatted_address);
            } else {
                setOriginAddressStatus('invalid');
            }
        });
    };

    const handleDeliverySubmit = async (e) => {
        e.preventDefault();
        if (!selectedDelivery) return;

        const updatedData = {
            ...selectedDelivery,
            status: 'Resuelto',
            deliveryStatus: 'Entregado',
            logistics: {
                ...selectedDelivery.logistics,
                receivedBy: deliveryForm.receivedBy,
                receivedDni: deliveryForm.dni,
                deliveredAt: new Date().toISOString(),
                notes: deliveryForm.notes
            }
        };

        updateTicket(selectedDelivery.id, updatedData);
        setIsDeliveryModalOpen(false);
        alert('Entrega registrada con éxito');
    };

    const handleScanSuccess = (qrData) => {
        const delivery = myDeliveries.find(d => d.id === qrData || d.logistics?.qrCode === qrData);
        if (delivery) {
            setSelectedDelivery(delivery);
            setIsDeliveryModalOpen(true);
            setIsScannerOpen(false);
        } else {
            setScanAlert('No se encontró un envío asignado con ese código.');
        }
    };

    const sendWhatsApp = () => {
        const text = `Hola! Soy ${currentUser.name} de IT. Te informo que tu equipo ha sido entregado.\nRecibió: ${deliveryForm.receivedBy}\nTicket: #${selectedDelivery.id}`;
        window.open(`https://wa.me/?text=${encodeURIComponent(text)}`);
    };

    const sendEmail = () => {
        const subject = `Comprobante de Entrega - Ticket #${selectedDelivery.id}`;
        const body = `Hola,\n\nSe ha registrado la entrega de tu equipo.\nRecibió: ${deliveryForm.receivedBy}\nDNI: ${deliveryForm.dni}\nFecha: ${new Date().toLocaleDateString()}`;
        window.location.href = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    };

    const getDevicesList = (ticket) => {
        if (!ticket.associatedAssets) return [];
        return ticket.associatedAssets.map(a => typeof a === 'string' ? a : a.serial);
    };

    const openGoogleMaps = (address) => {
        window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`);
    };

    const getColorByDate = (dateStr) => {
        if (dateStr === 'Sin Fecha') return '#94a3b8';
        const date = new Date(dateStr + 'T00:00:00');
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        if (date < today) return '#ef4444'; // Masado
        if (date.getTime() === today.getTime()) return '#3b82f6'; // Hoy
        return '#10b981'; // Futuro
    };

    const handleOptimizeRoute = async () => {
        if (!isMapsLoaded) {
            alert('El mapa aún se está cargando, por favor intenta nuevamente en unos segundos.');
            return;
        }

        if (optimizationOrigin === 'custom' && originAddressStatus !== 'valid') {
            alert('Por favor valida la dirección personalizada antes de optimizar.');
            return;
        }

        setIsOptimizing(true);
        try {
            const geocoder = new window.google.maps.Geocoder();

            let originAddress = '';
            if (optimizationOrigin === 'deposito') originAddress = 'Fraga 1312, CABA, Argentina';
            else if (optimizationOrigin === 'oficina') originAddress = 'Padre Castiglia 1638, Boulogne, Buenos Aires, Argentina';
            else if (optimizationOrigin === 'custom') originAddress = customOriginAddress;

            const originResult = await new Promise((resolve, reject) => {
                geocoder.geocode({ address: originAddress }, (results, status) => {
                    if (status === 'OK') resolve(results[0]);
                    else reject(status);
                });
            });
            const originLoc = originResult.geometry.location;

            const deliveriesToRoute = myDeliveries.filter(t => t.logistics?.address && t.logistics.address.length > 5);

            const ticketsWithLoc = [];
            for (const ticket of deliveriesToRoute) {
                try {
                    const res = await new Promise((resolve) => {
                        geocoder.geocode({ address: ticket.logistics.address }, (results, status) => {
                            if (status === 'OK') resolve(results[0]);
                            else resolve(null);
                        });
                    });

                    if (res) {
                        ticketsWithLoc.push({
                            id: ticket.id,
                            loc: res.geometry.location,
                            ticket: ticket
                        });
                    }
                    await new Promise(r => setTimeout(r, 200));
                } catch (e) { console.error(e); }
            }

            let currentLoc = originLoc;
            const orderedIds = [];
            const pool = [...ticketsWithLoc];

            while (pool.length > 0) {
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

            const unmappedIds = myDeliveries
                .filter(t => !orderedIds.includes(t.id))
                .map(t => t.id);

            setOptimizedOrder([...orderedIds, ...unmappedIds]);
            setIsOptimizationModalOpen(false);
            alert('¡Ruta optimizada correctamente!');

        } catch (error) {
            console.error(error);
            alert('Error al optimizar ruta: ' + error.message);
        } finally {
            setIsOptimizing(false);
        }
    };

    return (
        <div style={{ animation: 'fadeIn 0.5s ease-out' }}>
            <div className="flex-mobile-column" style={{ marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem' }}>
                <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <h1 style={{ fontSize: '1.8rem', fontWeight: 700, color: 'var(--text-main)' }}>Mis Envíos Asignados</h1>
                        {currentUser?.tracking_enabled && (
                            <Badge variant="success" style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '4px 8px' }}>
                                <span style={{ position: 'relative', display: 'flex', height: '8px', width: '8px' }}>
                                    <span style={{ position: 'absolute', display: 'inline-flex', height: '100%', width: '100%', borderRadius: '9999px', backgroundColor: '#22c55e', opacity: 0.75, animation: 'ping 1s cubic-bezier(0, 0, 0.2, 1) infinite' }}></span>
                                    <span style={{ position: 'relative', display: 'inline-flex', height: '8px', width: '8px', borderRadius: '9999px', backgroundColor: '#15803d' }}></span>
                                </span>
                                GPS ACTIVO
                            </Badge>
                        )}
                    </div>
                    <p style={{ color: 'var(--text-secondary)' }}>Gestiona tus entregas programadas y registra el estado en tiempo real.</p>
                </div>
                <div style={{ display: 'flex', gap: '0.75rem' }}>
                    <Button
                        variant="secondary"
                        icon={Route}
                        onClick={() => setIsOptimizationModalOpen(true)}
                        style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }}
                    >
                        OPTIMIZAR
                    </Button>
                    <Button
                        onClick={() => setIsScannerOpen(true)}
                        icon={QrCode}
                        style={{ backgroundColor: 'var(--text-main)', color: 'white' }}
                    >
                        ESCANEAR
                    </Button>
                </div>
            </div>

            {/* Resumen de Productividad - Estética Cuidada y Alto Contraste */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
                gap: '0.75rem',
                marginBottom: '2rem'
            }}>
                <Card style={{ background: '#1e293b', color: 'white', border: 'none', padding: '1.25rem' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                        <span style={{ fontSize: '0.65rem', fontWeight: 800, opacity: 0.7, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Mis Viajes del Mes</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <TrendingUp size={20} style={{ color: '#22c55e' }} />
                            <span style={{ fontSize: '1.5rem', fontWeight: 800 }}>{stats.finishedThisMonth}</span>
                        </div>
                    </div>
                </Card>

                <Card style={{ background: 'var(--primary-color)', color: 'white', border: 'none', padding: '1.25rem' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                        <span style={{ fontSize: '0.65rem', fontWeight: 800, opacity: 0.9, textTransform: 'uppercase', letterSpacing: '0.05em' }}>PENDIENTES SEMANA</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <Clock size={20} style={{ color: 'rgba(255,255,255,0.8)' }} />
                            <span style={{ fontSize: '1.5rem', fontWeight: 800 }}>{stats.pendingThisWeek}</span>
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
                            // Encontrar el maximo valor para escalar, evitar division por cero
                            const max = Math.max(...stats.last6Months.map(h => h.count), 1);
                            // Calcular altura porcentaje, minimo 10% para que siempre se vea algo
                            const heightPercentage = (m.count / max) * 100;
                            const height = Math.max(heightPercentage, 10);

                            return (
                                <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', height: '100%', justifyContent: 'flex-end' }}>
                                    <div style={{
                                        width: '100%',
                                        height: `${height}%`,
                                        backgroundColor: i === 5 ? 'var(--primary-color)' : '#cbd5e1', // Fallback color more visible than text-secondary
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
                                        {date === 'Sin Fecha' ? 'Fecha no definida' : new Date(date + 'T00:00:00').toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}
                                    </h2>
                                    <div style={{ flex: 1, height: '1px', background: `linear-gradient(to right, ${dayColor}44, transparent)` }}></div>
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1rem' }}>
                                    {deliveries.map(delivery => (
                                        <Card key={delivery.id} style={{ borderLeft: `5px solid ${delivery.status === 'Resuelto' ? '#22c55e' : dayColor}` }}>
                                            <div className="flex-mobile-column" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem' }}>
                                                <div style={{ flex: 1, width: '100%' }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem', flexWrap: 'wrap' }}>
                                                        <span style={{ fontWeight: 800, color: dayColor, fontSize: '1.1rem' }}>#{delivery.id}</span>
                                                        <Badge variant={
                                                            delivery.deliveryStatus === 'Entregado' ? 'success' :
                                                                delivery.deliveryStatus === 'En Transito' ? 'info' :
                                                                    delivery.deliveryStatus === 'Para Coordinar' ? 'warning' :
                                                                        'default' // Pendiente
                                                        }>
                                                            {delivery.deliveryStatus || 'Pendiente'}
                                                        </Badge>
                                                    </div>
                                                    <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.75rem' }}>{delivery.requester}</h3>

                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                                                        <div
                                                            onClick={() => openGoogleMaps(delivery.logistics.address)}
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
                                                            <span>{delivery.logistics.address} <Navigation size={12} style={{ opacity: 0.7, marginLeft: '4px' }} /></span>
                                                        </div>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', color: 'var(--text-main)', fontSize: '0.95rem', fontWeight: 600, marginTop: '0.2rem', flexWrap: 'wrap' }}>
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                                                <Calendar size={16} />
                                                                {delivery.logistics.date || delivery.logistics.datetime?.split('T')[0] || 'No definida'}
                                                            </div>
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                                                <Clock size={16} />
                                                                Turno: {delivery.logistics.timeSlot || 'AM'}
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
                                                    {delivery.status !== 'Resuelto' && (
                                                        <Button
                                                            icon={CheckCircle2}
                                                            onClick={() => {
                                                                setSelectedDelivery(delivery);
                                                                setIsDeliveryModalOpen(true);
                                                                setDeliveryForm(prev => ({ ...prev, actualTime: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }));
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
                                                            {delivery.logistics?.deliveryOrder || 0}
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

            <Modal
                isOpen={isDeliveryModalOpen}
                onClose={() => setIsDeliveryModalOpen(false)}
                title={`Registro de Entrega/Recupero: #${selectedDelivery?.id}`}
            >
                <form onSubmit={handleDeliverySubmit}>
                    <div className="flex-mobile-column" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                        <div className="form-group" style={{ marginBottom: '1rem' }}>
                            <label className="form-label">Persona que recibe (Nombre)</label>
                            <input
                                required
                                className="form-input"
                                placeholder="..."
                                value={deliveryForm.receivedBy}
                                onChange={e => setDeliveryForm({ ...deliveryForm, receivedBy: e.target.value })}
                            />
                        </div>
                        <div className="form-group" style={{ marginBottom: '1rem' }}>
                            <label className="form-label">DNI</label>
                            <input
                                required
                                className="form-input"
                                placeholder="..."
                                value={deliveryForm.dni}
                                onChange={e => setDeliveryForm({ ...deliveryForm, dni: e.target.value })}
                            />
                        </div>
                    </div>

                    <div className="flex-mobile-column" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                        <div className="form-group" style={{ marginBottom: '1rem' }}>
                            <label className="form-label">Horario Real</label>
                            <input
                                required
                                type="time"
                                className="form-input"
                                value={deliveryForm.actualTime}
                                onChange={e => setDeliveryForm({ ...deliveryForm, actualTime: e.target.value })}
                            />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Asset(s) Vinculado(s) - {selectedDelivery?.logistics?.type || 'Entrega'}</label>
                            <div style={{
                                padding: '0.75rem',
                                background: 'rgba(0,0,0,0.05)',
                                borderRadius: 'var(--radius-md)',
                                border: '1px solid var(--border)',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '0.5rem'
                            }}>
                                <div style={{ marginBottom: '4px' }}>
                                    <Badge variant="info" style={{ fontSize: '0.65rem' }}>
                                        LISTADO DE MOVIMIENTOS
                                    </Badge>
                                </div>
                                <div style={{
                                    fontSize: '0.85rem',
                                    color: 'var(--text-main)',
                                    fontWeight: 500,
                                    lineHeight: '1.6',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: '0.25rem'
                                }}>
                                    {selectedDelivery && getDevicesList(selectedDelivery).length > 0 ? (
                                        getDevicesList(selectedDelivery).map((item, idx) => (
                                            <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                <div style={{ width: '4px', height: '4px', backgroundColor: 'var(--primary-color)', borderRadius: '50%' }}></div>
                                                {item}
                                            </div>
                                        ))
                                    ) : (
                                        <div style={{ opacity: 0.5 }}>- No especificado -</div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="form-group">
                        <label className="form-label">Conductor responsable</label>
                        <input
                            disabled
                            className="form-input"
                            value={currentUser?.name || ''}
                            style={{ backgroundColor: 'rgba(0,0,0,0.05)' }}
                        />
                    </div>

                    <div className="form-group">
                        <label className="form-label">Notas Adicionales</label>
                        <textarea
                            className="form-textarea"
                            placeholder="Observaciones adicionales..."
                            style={{ minHeight: '60px' }}
                            value={deliveryForm.notes}
                            onChange={e => setDeliveryForm({ ...deliveryForm, notes: e.target.value })}
                        />
                    </div>

                    <div style={{ marginTop: '2.5rem', padding: '1.5rem', background: 'rgba(37, 99, 235, 0.03)', borderRadius: 'var(--radius-lg)', border: '1px dashed var(--primary-color)' }}>
                        <h4 style={{ fontSize: '0.9rem', fontWeight: 700, marginBottom: '0.5rem', color: 'var(--primary-color)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <CheckCircle2 size={16} /> Preparar y Enviar Comprobante
                        </h4>
                        <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
                            Genera el comprobante digital para el usuario. Asegúrate de haber completado los datos arriba.
                        </p>
                        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }} className="flex-mobile-column">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={sendWhatsApp}
                                style={{ flex: '1', minWidth: '100px', borderColor: '#25D366', color: '#25D366', fontWeight: 600, padding: '0.75rem' }}
                            >
                                WhatsApp
                            </Button>
                            <Button
                                type="button"
                                variant="outline"
                                onClick={sendEmail}
                                style={{ flex: '1', minWidth: '100px', fontWeight: 600, padding: '0.75rem' }}
                            >
                                Email
                            </Button>
                            <Button
                                type="button"
                                variant="outline"
                                icon={FileText}
                                onClick={() => generateTicketPDF(selectedDelivery, assets, deliveryForm)}
                                style={{ flex: '1', minWidth: '100px', fontWeight: 600, borderColor: 'var(--primary-color)', color: 'var(--primary-color)', padding: '0.75rem' }}
                            >
                                Descargar PDF
                            </Button>
                        </div>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', borderTop: '1px solid var(--border)', paddingTop: '1.5rem', marginTop: '2rem' }} className="flex-mobile-column">
                        <Button type="button" variant="secondary" onClick={() => setIsDeliveryModalOpen(false)} style={{ flex: 1 }}>Cancelar</Button>
                        <Button type="submit" disabled={!deliveryForm.receivedBy || !deliveryForm.dni} style={{ flex: 1 }}>Confirmar y Finalizar</Button>
                    </div>
                </form>
            </Modal>
            <QRScannerModal
                isOpen={isScannerOpen}
                onClose={() => setIsScannerOpen(false)}
                onScanSuccess={handleScanSuccess}
                validationError={scanAlert}
                resetValidationError={() => setScanAlert(null)}
            />

            {/* Optimization Modal */}
            <Modal isOpen={isOptimizationModalOpen} onClose={() => setIsOptimizationModalOpen(false)} title="Optimizar Recorrido">
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                    <p style={{ color: 'var(--text-secondary)' }}>
                        Selecciona el punto de partida. El sistema ordenará tus entregas automáticamente calculando la ruta más corta.
                    </p>

                    <div className="form-group">
                        <label className="form-label">Punto de Partida</label>
                        <select
                            className="form-select"
                            value={optimizationOrigin}
                            onChange={(e) => setOptimizationOrigin(e.target.value)}
                        >
                            <option value="deposito">Depósito (Fraga 1312, CABA)</option>
                            <option value="oficina">Oficina (Padre Castiglia 1638, Boulogne)</option>
                            <option value="custom">Otro (Personalizado)</option>
                        </select>
                    </div>

                    {optimizationOrigin === 'custom' && (
                        <div className="form-group" style={{ animation: 'fadeIn 0.3s ease-out' }}>
                            <label className="form-label" style={{ fontSize: '0.8rem' }}>Dirección de Inicio</label>
                            <div style={{ position: 'relative' }}>
                                <MapPin size={16} style={{ position: 'absolute', left: '10px', top: '10px', color: 'var(--text-secondary)' }} />
                                <input
                                    className="form-input"
                                    style={{
                                        paddingLeft: '2.2rem',
                                        paddingRight: '80px',
                                        borderColor: originAddressStatus === 'valid' ? '#22c55e' : (originAddressStatus === 'invalid' ? '#ef4444' : 'var(--border)')
                                    }}
                                    placeholder="Ej: Av. Libertador 1000, CABA"
                                    value={customOriginAddress}
                                    onChange={(e) => {
                                        setCustomOriginAddress(e.target.value);
                                        setOriginAddressStatus('idle');
                                    }}
                                />
                                <button
                                    type="button"
                                    onClick={validateOriginAddress}
                                    style={{
                                        position: 'absolute',
                                        right: '4px',
                                        top: '4px',
                                        bottom: '4px',
                                        border: 'none',
                                        background: originAddressStatus === 'valid' ? '#dcfce7' : '#eff6ff',
                                        color: originAddressStatus === 'valid' ? '#166534' : '#1d4ed8',
                                        borderRadius: '4px',
                                        padding: '0 8px',
                                        fontSize: '0.7rem',
                                        fontWeight: 600,
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '4px'
                                    }}
                                >
                                    {originAddressStatus === 'validating' ? (
                                        <Loader2 size={12} className="animate-spin" />
                                    ) : originAddressStatus === 'valid' ? (
                                        <><CheckCircle2 size={12} /> OK</>
                                    ) : (
                                        'Validar'
                                    )}
                                </button>
                            </div>
                            {originAddressStatus === 'invalid' && (
                                <p style={{ color: '#ef4444', fontSize: '0.75rem', marginTop: '4px' }}>
                                    ⚠️ No encontramos esa dirección. Intenta ser más específico.
                                </p>
                            )}
                        </div>
                    )}

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
