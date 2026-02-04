"use client";
import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Modal } from '../../components/ui/Modal';
import { QRScannerModal } from '../../components/ui/QRScannerModal';
import { useStore } from '../../../lib/store';
import { Plus, Search, Truck, MapPin, Calendar, CheckCircle, Clock, Loader2, Trash2, ChevronDown, ChevronUp, Sun, Moon, Archive, QrCode } from 'lucide-react';

export default function DeliveriesPage() {
    const { deliveries, addDelivery, deleteDelivery, deleteDeliveries, tickets, deleteTickets, users, currentUser } = useStore();
    const router = useRouter();
    const mapRef = useRef(null);
    const googleMap = useRef(null);
    const [googleLoaded, setGoogleLoaded] = useState(false);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isScannerOpen, setIsScannerOpen] = useState(false);
    const [newDelivery, setNewDelivery] = useState({ recipient: '', address: '', items: '', status: 'Pendiente', courier: 'Interno' });
    const [filter, setFilter] = useState('');
    const [statusFilter, setStatusFilter] = useState('All');
    const [geocodedPoints, setGeocodedPoints] = useState([]);
    const [isGeocoding, setIsGeocoding] = useState(false);
    const [sortConfig, setSortConfig] = useState({ key: 'date', direction: 'asc' });
    const [showMap, setShowMap] = useState(false);
    const [mapTheme, setMapTheme] = useState('dark');
    const [selectedIds, setSelectedIds] = useState([]);

    const handleBulkDelete = async () => {
        if (!confirm(`¿Estás seguro de eliminar ${selectedIds.length} envíos seleccionados? Esta acción no se puede deshacer.`)) return;

        const manualIds = [];
        const ticketIds = [];

        selectedIds.forEach(id => {
            const item = combinedDeliveries.find(d => d.id === id);
            if (item) {
                if (item.source === 'Ticket') ticketIds.push(id);
                else manualIds.push(id);
            }
        });

        if (manualIds.length > 0) await deleteDeliveries(manualIds);
        if (ticketIds.length > 0) await deleteTickets(ticketIds);

        setSelectedIds([]);
    };

    const toggleSelectAll = () => {
        if (selectedIds.length === sortedAndFilteredDeliveries.length) {
            setSelectedIds([]);
        } else {
            setSelectedIds(sortedAndFilteredDeliveries.map(d => d.id));
        }
    };

    const toggleSelect = (id) => {
        if (selectedIds.includes(id)) {
            setSelectedIds(selectedIds.filter(i => i !== id));
        } else {
            setSelectedIds([...selectedIds, id]);
        }
    };

    // Estilos de Mapa
    const nightStyles = [
        { "featureType": "all", "elementType": "labels.text.fill", "stylers": [{ "color": "#76a5af" }] },
        { "featureType": "all", "elementType": "labels.text.stroke", "stylers": [{ "color": "#000000" }, { "lightness": 13 }] },
        { "featureType": "administrative", "elementType": "geometry.fill", "stylers": [{ "color": "#000000" }, { "lightness": 20 }] },
        { "featureType": "administrative", "elementType": "geometry.stroke", "stylers": [{ "color": "#000000" }, { "lightness": 17 }, { "weight": 1.2 }] },
        { "featureType": "landscape", "elementType": "geometry", "stylers": [{ "color": "#08304b" }] },
        { "featureType": "poi", "stylers": [{ "visibility": "off" }] },
        { "featureType": "road.highway", "elementType": "geometry.fill", "stylers": [{ "color": "#000000" }, { "lightness": 17 }] },
        { "featureType": "road.highway", "elementType": "geometry.stroke", "stylers": [{ "color": "#000000" }, { "lightness": 29 }, { "weight": 0.2 }] },
        { "featureType": "road.arterial", "elementType": "geometry", "stylers": [{ "color": "#000000" }, { "lightness": 18 }] },
        { "featureType": "road.local", "elementType": "geometry", "stylers": [{ "color": "#134262" }] },
        { "featureType": "transit", "elementType": "geometry", "stylers": [{ "color": "#000000" }, { "lightness": 19 }] },
        { "featureType": "water", "elementType": "geometry", "stylers": [{ "color": "#001e32" }] }
    ];

    const dayStyles = [
        { "featureType": "water", "stylers": [{ "color": "#e9e9e9" }, { "visibility": "on" }] },
        { "featureType": "landscape", "stylers": [{ "color": "#f5f5f5" }] },
        { "featureType": "road", "stylers": [{ "color": "#ffffff" }] },
        { "featureType": "poi", "stylers": [{ "visibility": "off" }] },
        { "elementType": "labels.text.fill", "stylers": [{ "color": "#616161" }] },
        { "elementType": "labels.icon", "stylers": [{ "visibility": "off" }] }
    ];

    // Cargar Google Maps API Principal
    useEffect(() => {
        if (typeof window === 'undefined') return;

        if (window.google && window.google.maps) {
            setGoogleLoaded(true);
            return;
        }

        // Check if script is already included (to prevent double inclusion)
        const existingScript = document.querySelector('script[src*="maps.googleapis.com/maps/api/js"]');
        if (existingScript) {
            // Script exists but might not be fully loaded or window.google not populated yet
            existingScript.addEventListener('load', () => setGoogleLoaded(true));
            return;
        }

        const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
        // Avoid adding script if no API key is set (prevent errors but allow app to run)
        if (!apiKey) {
            console.warn("Google Maps API Key missing");
            return;
        }

        const script = document.createElement('script');
        script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places,geometry&v=weekly`;
        script.async = true;
        script.defer = true;
        script.onload = () => setGoogleLoaded(true);
        document.head.appendChild(script);
    }, []);

    // Helper para iniciales
    const getInitials = (name) => {
        if (!name) return 'IT';
        return name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);
    };

    const getStatusVariant = (status) => {
        switch (status) {
            case 'Abierto': return 'danger';
            case 'En Progreso': return 'info';
            case 'Resuelto': return 'success';
            case 'Pendiente': return 'warning';
            case 'Caso SFDC Cerrado': return 'success';
            case 'Servicio Facturado': return 'info';
            default: return 'default';
        }
    };

    // Unimos los datos de envíos
    const combinedDeliveries = React.useMemo(() => {
        const ticketDeliveries = tickets.filter(t => {
            const isCompleted = t.status === 'Resuelto' || t.status === 'Cerrado' || t.status === 'Servicio Facturado' || t.status === 'Caso SFDC Cerrado' || t.deliveryStatus === 'Entregado';
            return t.logistics && !isCompleted;
        })
            .map(t => {
                const assetsList = t.associatedAssets || [];
                const deliveryCount = assetsList.filter(a => typeof a === 'string' ? t.logistics.type !== 'Recupero' : a.type !== 'Recupero').length;
                const pickupCount = assetsList.filter(a => typeof a === 'string' ? t.logistics.type === 'Recupero' : a.type === 'Recupero').length;

                let summaryItems = [];
                if (deliveryCount > 0) summaryItems.push(`${deliveryCount} Entr.`);
                if (pickupCount > 0) summaryItems.push(`${pickupCount} Rec.`);

                const logisticsDate = t.logistics.date;
                const displayDate = logisticsDate || (t.logistics.datetime ? t.logistics.datetime.split('T')[0] : t.date);
                const timeSlot = t.logistics.timeSlot || 'AM';

                const hasDriver = !!t.logistics.deliveryPerson && t.logistics.deliveryPerson !== 'No definido';

                return {
                    id: t.id,
                    recipient: t.requester,
                    address: t.logistics.address || 'Sin dirección',
                    items: summaryItems.length > 0 ? summaryItems.join(" / ") : 'Equipo IT',
                    courier: t.logistics.method || 'No definido',
                    deliveryPerson: t.logistics.deliveryPerson,
                    status: hasDriver ? 'En Tránsito' : 'Pendiente',
                    ticketStatus: t.status,
                    deliveryStatusOriginal: t.deliveryStatus,
                    date: logisticsDate ? `${displayDate} [${timeSlot}]` : 'A Confirmar',
                    source: 'Ticket'
                };
            });

        const activeManualDeliveries = deliveries.filter(d => d.status !== 'Entregado').map(d => ({
            ...d,
            source: 'Manual',
            ticketStatus: d.status,
            deliveryStatusOriginal: d.status
        }));

        return [...activeManualDeliveries, ...ticketDeliveries];
    }, [deliveries, tickets]);

    // Colores vibrantes para los diferentes días (Consistente con Mis Envíos)
    const dayColors = [
        '#f97316', // Naranja
        '#3b82f6', // Azul
        '#10b981', // Verde
        '#8b5cf6', // Violeta
        '#ec4899', // Rosa
        '#06b6d4', // Cian
        '#f59e0b', // Ámbar
    ];

    const getColorByDate = (dateStr) => {
        if (!dateStr || dateStr === 'No definida' || dateStr === 'Sin fecha' || dateStr === 'A Confirmar') return '#64748b';
        const hash = dateStr.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
        return dayColors[hash % dayColors.length];
    };

    const handleSort = (key) => {
        let direction = 'asc';
        if (sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setSortConfig({ key, direction });
    };

    const sortedAndFilteredDeliveries = React.useMemo(() => {
        let result = combinedDeliveries.filter(d => {
            const matchesText = d.recipient.toLowerCase().includes(filter.toLowerCase()) ||
                d.id.toLowerCase().includes(filter.toLowerCase()) ||
                d.address.toLowerCase().includes(filter.toLowerCase());
            const matchesStatus = statusFilter === 'All' || d.status === statusFilter;
            return matchesText && matchesStatus;
        });

        if (sortConfig.key) {
            result.sort((a, b) => {
                // Orden Primario por la columna seleccionada
                const valA = a[sortConfig.key] || '';
                const valB = b[sortConfig.key] || '';

                if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
                if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;

                // Orden Secundario por Dirección (para agrupar si la fecha o ID es igual)
                if (sortConfig.key !== 'address') {
                    const addrA = a.address || '';
                    const addrB = b.address || '';
                    if (addrA < addrB) return -1;
                    if (addrA > addrB) return 1;
                }

                return 0;
            });
        }
        return result;
    }, [combinedDeliveries, filter, statusFilter, sortConfig]);

    const inTransitCount = combinedDeliveries.filter(d => d.status === 'En Tránsito').length;
    const deliveredCount = combinedDeliveries.filter(d => d.status === 'Entregado').length;
    const pendingCount = combinedDeliveries.filter(d => d.status === 'Pendiente').length;

    const SortIcon = ({ column }) => {
        if (sortConfig.key !== column) return <span style={{ opacity: 0.3, marginLeft: '4px' }}>↕</span>;
        return <span style={{ marginLeft: '4px', color: 'var(--primary-color)' }}>{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>;
    };

    // GEOPROCESSING: Usamos Google Maps Geocoder Oficial
    useEffect(() => {
        if (!googleLoaded || !combinedDeliveries.length) return;

        const geocodeAll = async () => {
            setIsGeocoding(true);
            const geocoder = new window.google.maps.Geocoder();
            const points = [];

            // Procesar cada envío
            for (const delivery of combinedDeliveries) {
                // Si la dirección es inválida o no existe
                if (!delivery.address || delivery.address === 'Sin dirección') {
                    continue;
                }

                try {
                    const result = await new Promise((resolve, reject) => {
                        // Limpiamos la dirección y añadimos contexto regional fuerte
                        const cleanAddress = delivery.address.split(',')[0].trim();
                        const query = `${cleanAddress}, Ciudad Autónoma de Buenos Aires, Argentina`;

                        geocoder.geocode({
                            address: query,
                            componentRestrictions: {
                                country: 'AR',
                                administrativeArea: 'CABA'
                            }
                        }, (results, status) => {
                            if (status === 'OK') {
                                resolve(results[0].geometry.location);
                            } else {
                                reject(status);
                            }
                        });
                    });
                    points.push({ ...delivery, coords: { lat: result.lat(), lng: result.lng() } });
                } catch (e) {
                    console.error("Geocoding error for:", delivery.address, e);
                    // Fallback visual inteligente: Cerca del Obelisco con un pequeño offset aleatorio
                    const hash = delivery.address.split('').reduce((a, b) => { a = ((a << 5) - a) + b.charCodeAt(0); return a & a; }, 0);
                    points.push({
                        ...delivery,
                        coords: {
                            lat: -34.6037 + (Math.abs(hash % 50) / 2000),
                            lng: -58.3816 + (Math.abs((hash >> 2) % 50) / 2000)
                        }
                    });
                }
            }

            setGeocodedPoints(points);
            setIsGeocoding(false);
        };

        geocodeAll();
    }, [googleLoaded, combinedDeliveries]);

    // Inicializar Google Map y Marcadores
    useEffect(() => {
        if (!googleLoaded || !mapRef.current || !window.google || geocodedPoints.length === 0) return;

        const mapOptions = {
            center: { lat: -34.6037, lng: -58.3816 },
            zoom: 12,
            styles: mapTheme === 'dark' ? nightStyles : dayStyles,
            disableDefaultUI: false,
            zoomControl: true,
            mapTypeControl: false,
        };

        googleMap.current = new window.google.maps.Map(mapRef.current, mapOptions);
        const bounds = new window.google.maps.LatLngBounds();

        geocodedPoints.forEach(d => {
            const color = d.status === 'Entregado' ? '#22c55e' : (d.status === 'En Tránsito' ? '#2563eb' : '#ca8a04');
            const initials = getInitials(d.deliveryPerson || d.courier);

            const marker = new window.google.maps.Marker({
                position: d.coords,
                map: googleMap.current,
                label: {
                    text: initials,
                    color: "white",
                    fontSize: "11px",
                    fontWeight: "bold"
                },
                title: d.recipient,
                icon: {
                    path: "M 0,0 C -2,-20 -10,-22 -10,-30 A 10,10 0 1,1 10,-30 C 10,-22 2,-20 0,0 z",
                    fillColor: color,
                    fillOpacity: 1,
                    strokeWeight: 2,
                    strokeColor: "white",
                    scale: 1,
                    labelOrigin: new window.google.maps.Point(0, -30)
                },
                animation: window.google.maps.Animation.DROP
            });

            // Guardamos la referencia al marcador para interactuar desde la tabla
            d.marker = marker;

            const infoWindow = new window.google.maps.InfoWindow({
                content: `
                    <div style="padding: 12px; font-family: 'Inter', sans-serif; min-width: 200px; color: #333;">
                        <div style="font-size: 10px; text-transform: uppercase; color: #64748b; font-weight: 700; margin-bottom: 2px;">Destinatario</div>
                        <strong style="display: block; font-size: 15px; color: #1e293b; margin-bottom: 8px;">${d.recipient}</strong>
                        <div style="font-size: 12px; color: #475569; margin-bottom: 10px; display: flex; align-items: flex-start; gap: 4px;">
                            <span>📍</span> <span>${d.address}</span>
                        </div>
                        <div style="display: flex; align-items: center; justify-content: space-between; border-top: 1px solid #f1f5f9; padding-top: 8px;">
                            <span style="display: flex; align-items: center; gap: 4px; font-size: 11px; font-weight: 700; color: ${color};">
                                <span style="width: 8px; height: 8px; background: ${color}; border-radius: 50%;"></span>
                                ${d.status}
                            </span>
                            <span style="font-size: 10px; color: #94a3b8;">ID: ${d.id}</span>
                        </div>
                    </div>
                `
            });

            marker.addListener("click", () => {
                infoWindow.open(googleMap.current, marker);
            });

            bounds.extend(d.coords);
        });

        if (geocodedPoints.length > 0) {
            googleMap.current.fitBounds(bounds, { padding: 50 });
        }

    }, [googleLoaded, geocodedPoints, mapTheme]);

    const handleCreate = (e) => {
        e.preventDefault();
        addDelivery(newDelivery);
        setIsModalOpen(false);
        setNewDelivery({ recipient: '', address: '', items: '', status: 'Pendiente', courier: 'Interno' });
    };

    const handleScanSuccess = (data) => {
        setIsScannerOpen(false);
        if (data && data.id) {
            setFilter(String(data.id));
            // Optionally check if exists
            const exists = combinedDeliveries.some(d => String(d.id) === String(data.id));
            if (!exists) {
                alert(`El envío #${data.id} no fue encontrado en los registros activos.`);
            }
        } else {
            alert("Lectura incorrecta o código QR inválido.");
        }
    };

    return (
        <div style={{ animation: 'fadeIn 0.5s ease-out' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                <div>
                    <h1 style={{ fontSize: '1.8rem', fontWeight: 700, color: 'var(--text-main)' }}>Gestión de Envíos</h1>
                    <p style={{ color: 'var(--text-secondary)' }}>Logística avanzada con posicionamiento geográfico real.</p>
                </div>
                <div style={{ display: 'flex', gap: '1rem' }}>
                    {currentUser?.role === 'Administrador' && selectedIds.length > 0 && (
                        <Button
                            icon={Trash2}
                            onClick={handleBulkDelete}
                            style={{ backgroundColor: '#ef4444', color: 'white', border: 'none' }}
                        >
                            Eliminar ({selectedIds.length})
                        </Button>
                    )}
                    {isGeocoding && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--primary-color)', fontSize: '0.875rem', fontWeight: 500 }}>
                            <Loader2 className="animate-spin" size={18} />
                            Ubicando puntos...
                        </div>
                    )}
                    <Button icon={QrCode} onClick={() => setIsScannerOpen(true)} variant="secondary">Escanear QR</Button>
                    <Button icon={Plus} onClick={() => setIsModalOpen(true)}>Nuevo Envío</Button>
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1.5rem', marginBottom: '2rem' }}>
                <Card
                    className="p-4 clickable-card"
                    style={{
                        borderLeft: '4px solid var(--primary-color)',
                        cursor: 'pointer',
                        backgroundColor: statusFilter === 'All' ? 'rgba(37, 99, 235, 0.1)' : 'var(--surface)',
                        transition: 'all 0.2s ease',
                        boxShadow: statusFilter === 'All' ? 'inset 0 0 0 1px var(--primary-color), var(--shadow-sm)' : 'var(--shadow-sm)'
                    }}
                    onClick={() => setStatusFilter('All')}
                >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <div style={{ padding: '0.75rem', backgroundColor: 'var(--background)', borderRadius: '50%', color: 'var(--primary-color)' }}>
                            <Archive size={24} />
                        </div>
                        <div>
                            <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>Todos</p>
                            <h3 style={{ fontSize: '1.5rem', fontWeight: 700, margin: 0 }}>{combinedDeliveries.length}</h3>
                        </div>
                    </div>
                </Card>
                <Card
                    className="p-4 clickable-card"
                    style={{
                        borderLeft: '4px solid #2563eb',
                        cursor: 'pointer',
                        backgroundColor: statusFilter === 'En Tránsito' ? 'rgba(37, 99, 235, 0.1)' : 'var(--surface)',
                        transition: 'all 0.2s ease',
                        boxShadow: statusFilter === 'En Tránsito' ? 'inset 0 0 0 1px #2563eb, var(--shadow-sm)' : 'var(--shadow-sm)'
                    }}
                    onClick={() => setStatusFilter('En Tránsito')}
                >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <div style={{ padding: '0.75rem', backgroundColor: '#eff6ff', borderRadius: '50%', color: '#2563eb' }}>
                            <Truck size={24} />
                        </div>
                        <div>
                            <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>En Tránsito</p>
                            <h3 style={{ fontSize: '1.5rem', fontWeight: 700, margin: 0 }}>{inTransitCount}</h3>
                        </div>
                    </div>
                </Card>
                <Card
                    className="p-4 clickable-card"
                    style={{
                        borderLeft: '4px solid #16a34a',
                        cursor: 'pointer',
                        backgroundColor: statusFilter === 'Entregado' ? 'rgba(22, 163, 74, 0.1)' : 'var(--surface)',
                        transition: 'all 0.2s ease',
                        boxShadow: statusFilter === 'Entregado' ? 'inset 0 0 0 1px #16a34a, var(--shadow-sm)' : 'var(--shadow-sm)'
                    }}
                    onClick={() => setStatusFilter('Entregado')}
                >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <div style={{ padding: '0.75rem', backgroundColor: '#f0fdf4', borderRadius: '50%', color: '#16a34a' }}>
                            <CheckCircle size={24} />
                        </div>
                        <div>
                            <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>Entregados</p>
                            <h3 style={{ fontSize: '1.5rem', fontWeight: 700, margin: 0 }}>{deliveredCount}</h3>
                        </div>
                    </div>
                </Card>
                <Card
                    className="p-4 clickable-card"
                    style={{
                        borderLeft: '4px solid #ca8a04',
                        cursor: 'pointer',
                        backgroundColor: statusFilter === 'Pendiente' ? 'rgba(202, 138, 4, 0.1)' : 'var(--surface)',
                        transition: 'all 0.2s ease',
                        boxShadow: statusFilter === 'Pendiente' ? 'inset 0 0 0 1px #ca8a04, var(--shadow-sm)' : 'var(--shadow-sm)'
                    }}
                    onClick={() => setStatusFilter('Pendiente')}
                >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <div style={{ padding: '0.75rem', backgroundColor: '#fffbeb', borderRadius: '50%', color: '#ca8a04' }}>
                            <Clock size={24} />
                        </div>
                        <div>
                            <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>Pendientes</p>
                            <h3 style={{ fontSize: '1.5rem', fontWeight: 700, margin: 0 }}>{pendingCount}</h3>
                        </div>
                    </div>
                </Card>
            </div>

            {/* Google Maps Card Especial */}
            <Card style={{ marginBottom: '2.5rem', padding: '0', overflow: 'hidden', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-md)' }}>
                <div style={{ padding: '1.25rem', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'var(--background)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <div style={{ width: '40px', height: '40px', background: 'var(--surface)', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <MapPin size={20} style={{ color: 'var(--primary-color)' }} />
                        </div>
                        <div>
                            <h3 style={{ fontSize: '1rem', fontWeight: 600, margin: 0 }}>Rutas de Entrega Activas</h3>
                            <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', margin: 0 }}>Región: Buenos Aires, Argentina</p>
                        </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setMapTheme(mapTheme === 'dark' ? 'light' : 'dark')}
                            style={{ padding: '0.5rem', color: mapTheme === 'dark' ? '#fbbf24' : '#64748b' }}
                            title={mapTheme === 'dark' ? 'Modo Día' : 'Modo Noche'}
                        >
                            {mapTheme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
                        </Button>
                        <div style={{ width: '1px', height: '20px', background: 'var(--border)', margin: '0 0.5rem' }}></div>
                        <Badge variant="outline" style={{ fontSize: '0.7rem' }}>Ubicaciones Reales: {geocodedPoints.length}</Badge>
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setShowMap(!showMap)}
                            style={{ padding: '0.5rem' }}
                        >
                            {showMap ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                        </Button>
                    </div>
                </div>

                <div style={{ display: showMap ? 'block' : 'none' }}>
                    <div
                        ref={mapRef}
                        style={{ height: '550px', width: '100%', background: '#1a1a1a' }}
                    >
                        {!googleLoaded && (
                            <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)', gap: '1rem' }}>
                                <Loader2 className="animate-spin" size={32} />
                                <span>Iniciando servicios de mapas...</span>
                            </div>
                        )}
                    </div>

                    <div style={{ padding: '1rem 1.5rem', background: 'var(--background)', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ display: 'flex', gap: '2rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <div style={{ width: '12px', height: '12px', background: '#eab308', borderRadius: '50%', boxShadow: '0 0 0 4px rgba(234, 179, 8, 0.1)' }}></div>
                                <span style={{ fontSize: '0.8rem', fontWeight: 500 }}>Pendiente</span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <div style={{ width: '12px', height: '12px', background: '#2563eb', borderRadius: '50%', boxShadow: '0 0 0 4px rgba(37, 99, 235, 0.1)' }}></div>
                                <span style={{ fontSize: '0.8rem', fontWeight: 500 }}>En Tránsito</span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <div style={{ width: '12px', height: '12px', background: '#22c55e', borderRadius: '50%', boxShadow: '0 0 0 4px rgba(34, 197, 94, 0.1)' }}></div>
                                <span style={{ fontSize: '0.8rem', fontWeight: 500 }}>Entregado</span>
                            </div>
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                            Información geolocalizada mediante Google Maps API
                        </div>
                    </div>
                </div>
            </Card>

            <Card>
                <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
                    <div style={{ position: 'relative', flex: 1, minWidth: '300px' }}>
                        <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
                        <input
                            type="text"
                            placeholder="Buscar por dirección, nombre o ID..."
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
                    {(statusFilter !== 'All' || filter !== '') && (
                        <Button variant="ghost" size="sm" onClick={() => { setStatusFilter('All'); setFilter(''); }}>Limpiar Filtros</Button>
                    )}
                </div>

                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                        <thead>
                            <tr style={{ borderBottom: '1px solid var(--border)' }}>
                                {currentUser?.role === 'Administrador' && (
                                    <th style={{ padding: '1rem', width: '40px' }}>
                                        <input
                                            type="checkbox"
                                            checked={sortedAndFilteredDeliveries.length > 0 && selectedIds.length === sortedAndFilteredDeliveries.length}
                                            onChange={toggleSelectAll}
                                            style={{ cursor: 'pointer', width: '16px', height: '16px' }}
                                        />
                                    </th>
                                )}
                                <th
                                    onClick={() => handleSort('id')}
                                    style={{ padding: '1rem', fontWeight: 600, color: 'var(--text-secondary)', fontSize: '0.85rem', cursor: 'pointer', userSelect: 'none' }}
                                >
                                    ID <SortIcon column="id" />
                                </th>
                                <th
                                    onClick={() => handleSort('recipient')}
                                    style={{ padding: '1rem', fontWeight: 600, color: 'var(--text-secondary)', fontSize: '0.85rem', cursor: 'pointer', userSelect: 'none' }}
                                >
                                    DESTINATARIO <SortIcon column="recipient" />
                                </th>
                                <th
                                    onClick={() => handleSort('address')}
                                    style={{ padding: '1rem', fontWeight: 600, color: 'var(--text-secondary)', fontSize: '0.85rem', cursor: 'pointer', userSelect: 'none' }}
                                >
                                    DIRECCIÓN <SortIcon column="address" />
                                </th>
                                <th
                                    onClick={() => handleSort('date')}
                                    style={{ padding: '1rem', fontWeight: 600, color: 'var(--text-secondary)', fontSize: '0.85rem', cursor: 'pointer', userSelect: 'none' }}
                                >
                                    FECHA <SortIcon column="date" />
                                </th>
                                <th style={{ padding: '1rem', fontWeight: 600, color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                        ESTADO
                                        <select
                                            value={statusFilter}
                                            onChange={(e) => setStatusFilter(e.target.value)}
                                            style={{
                                                fontSize: '0.75rem',
                                                padding: '2px',
                                                border: '1px solid var(--border)',
                                                borderRadius: '4px',
                                                backgroundColor: 'var(--background)',
                                                color: 'var(--text-main)',
                                                cursor: 'pointer'
                                            }}
                                        >
                                            <option value="All">Todos</option>
                                            <option value="Pendiente">Pendiente</option>
                                            <option value="En Tránsito">En Tránsito</option>
                                            <option value="Entregado">Entregado</option>
                                        </select>
                                    </div>
                                </th>
                                <th style={{ padding: '1rem', fontWeight: 600, color: 'var(--text-secondary)', fontSize: '0.85rem', textAlign: 'right' }}>ACCIONES</th>
                            </tr>
                        </thead>
                        <tbody>
                            {(() => {
                                let lastDate = null;
                                return sortedAndFilteredDeliveries.map((delivery) => {
                                    const dateColor = getColorByDate(delivery.date);
                                    const showDateHeader = delivery.date !== lastDate;
                                    lastDate = delivery.date;

                                    return (
                                        <React.Fragment key={delivery.id}>
                                            {showDateHeader && (
                                                <tr style={{ backgroundColor: 'var(--background)' }}>
                                                    <td colSpan={currentUser?.role === 'Administrador' ? "7" : "6"} style={{ padding: '1.5rem 1rem 0.5rem 1rem' }}>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                                            <div style={{ backgroundColor: dateColor, width: '8px', height: '8px', borderRadius: '50%' }}></div>
                                                            <span style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                                                {(() => {
                                                                    if (!delivery.date || delivery.date === 'A Confirmar') return 'Por Confirmar';
                                                                    const cleanDate = delivery.date.split(' ')[0]; // Extraer 'YYYY-MM-DD'
                                                                    return new Date(cleanDate + 'T00:00:00').toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
                                                                })()}
                                                            </span>
                                                            <div style={{ flex: 1, height: '1px', background: `linear-gradient(to right, ${dateColor}33, transparent)` }}></div>
                                                        </div>
                                                    </td>
                                                </tr>
                                            )}
                                            <tr
                                                style={{ borderBottom: '1px solid var(--border)', cursor: 'pointer', borderLeft: `4px solid ${dateColor}` }}
                                                className="table-row-hover"
                                                onMouseEnter={() => {
                                                    const point = geocodedPoints.find(p => p.id === delivery.id);
                                                    if (point && point.marker) {
                                                        point.marker.setAnimation(window.google.maps.Animation.BOUNCE);
                                                        googleMap.current.panTo(point.coords);
                                                    }
                                                }}
                                                onMouseLeave={() => {
                                                    const point = geocodedPoints.find(p => p.id === delivery.id);
                                                    if (point && point.marker) {
                                                        point.marker.setAnimation(null);
                                                    }
                                                }}
                                            >
                                                <td style={{ padding: '1rem' }}>
                                                    <span style={{ fontWeight: 700, color: dateColor, fontSize: '0.875rem' }}>{delivery.id}</span>
                                                </td>
                                                <td style={{ padding: '1rem' }}>
                                                    <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>{delivery.recipient}</div>
                                                    <div style={{ fontSize: '0.6rem', color: 'var(--text-secondary)', marginTop: '2px', fontStyle: 'italic', opacity: 0.8 }}>{delivery.address}</div>
                                                    {delivery.deliveryPerson && (
                                                        <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginTop: '2px' }}>Repartidor: {delivery.deliveryPerson}</div>
                                                    )}
                                                </td>
                                                <td style={{ padding: '1rem', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                        <MapPin size={14} style={{ color: dateColor, flexShrink: 0 }} />
                                                        {delivery.address}
                                                    </div>
                                                </td>
                                                <td style={{ padding: '1rem', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                        <Calendar size={14} />
                                                        {delivery.date}
                                                    </div>
                                                </td>
                                                <td style={{ padding: '1rem' }}>
                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'flex-start' }}>
                                                        <Badge variant={getStatusVariant(delivery.ticketStatus)} style={{ fontSize: '0.7rem', padding: '2px 6px' }}>
                                                            S: {delivery.ticketStatus || 'N/A'}
                                                        </Badge>
                                                        {delivery.deliveryStatusOriginal && (
                                                            <Badge
                                                                variant={
                                                                    delivery.deliveryStatusOriginal === 'Entregado' ? 'success' :
                                                                        delivery.deliveryStatusOriginal === 'En Transito' ? 'info' :
                                                                            delivery.deliveryStatusOriginal === 'Para Coordinar' ? 'warning' :
                                                                                'default'
                                                                }
                                                                style={{ fontSize: '0.7rem', padding: '2px 6px' }}
                                                            >
                                                                E: {delivery.deliveryStatusOriginal}
                                                            </Badge>
                                                        )}
                                                    </div>
                                                </td>
                                                <td style={{ padding: '1rem', textAlign: 'right' }}>
                                                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                                                        {delivery.source === 'Ticket' ? (
                                                            <Button variant="ghost" size="sm" onClick={() => router.push(`/dashboard/tickets/${delivery.id}`)}>Ver Ticket</Button>
                                                        ) : (
                                                            <Button
                                                                variant="ghost"
                                                                size="sm"
                                                                style={{ color: '#ef4444' }}
                                                                onClick={() => {
                                                                    if (confirm('¿Estás seguro de que deseas eliminar este envío manual?')) {
                                                                        deleteDelivery(delivery.id);
                                                                    }
                                                                }}
                                                            >
                                                                <Trash2 size={16} />
                                                            </Button>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        </React.Fragment>
                                    );
                                });
                            })()}
                        </tbody>
                    </table>
                </div>
            </Card>

            <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Programar Nuevo Envío Manual">
                <form onSubmit={handleCreate}>
                    <div className="form-group">
                        <label className="form-label">Nombre del Destinatario</label>
                        <input
                            required
                            className="form-input"
                            value={newDelivery.recipient}
                            onChange={e => setNewDelivery({ ...newDelivery, recipient: e.target.value })}
                        />
                    </div>
                    <div className="form-group">
                        <label className="form-label">Dirección Completa de Entrega</label>
                        <input
                            required
                            className="form-input"
                            placeholder="Ej: Juana Manso 999, CABA, Argentina"
                            value={newDelivery.address}
                            onChange={e => setNewDelivery({ ...newDelivery, address: e.target.value })}
                        />
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '2rem' }}>
                        <Button type="button" variant="secondary" onClick={() => setIsModalOpen(false)}>Cancelar</Button>
                        <Button type="submit">Generar Envío</Button>
                    </div>
                </form>
            </Modal>
            <QRScannerModal
                isOpen={isScannerOpen}
                onClose={() => setIsScannerOpen(false)}
                onScanSuccess={handleScanSuccess}
            />
        </div>
    );
}
