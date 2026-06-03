"use client";
import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Modal } from '../../components/ui/Modal';
import { QRScannerModal } from '../../components/ui/QRScannerModal';
import { useStore } from '../../../lib/store';
import { Plus, Search, Truck, MapPin, Calendar, CheckCircle, Clock, Loader2, Trash2, ChevronDown, ChevronUp, Sun, Moon, Archive, QrCode, Printer, ExternalLink, Check } from 'lucide-react';
import QRCode from 'qrcode';
import JsBarcode from 'jsbarcode';

const TrackingBadge = ({ method, trackingNumber }) => {
    const [copied, setCopied] = React.useState(false);
    if (!method || !trackingNumber) return null;
    
    const isCorreoArgentino = String(method).toLowerCase().includes('correo argentino') || String(method).toLowerCase().trim() === 'correo';
    const isAndreani = String(method).toLowerCase().includes('andreani');
    
    if (!isCorreoArgentino && !isAndreani) return null;

    const handleTrack = (e) => {
        e.stopPropagation();
        
        // Clean tracking number (remove "TN:" or "TN" prefix if any)
        const cleanTN = String(trackingNumber).trim().replace(/^(tn:?\s*)/i, '').trim();
        
        // Copy to clipboard
        navigator.clipboard.writeText(cleanTN);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
        
        // Open URL
        const url = isCorreoArgentino 
            ? 'https://www.correoargentino.com.ar/formularios/e-commerce'
            : `https://seguimiento.andreani.com/envio/${cleanTN}`;
        
        window.open(url, '_blank');
    };

    return (
        <span 
            onClick={handleTrack}
            title={isCorreoArgentino ? `Copiar TN: ${trackingNumber} e ir a Correo Argentino` : `Ir a seguimiento de Andreani: ${trackingNumber}`}
            style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                padding: '2px 6px',
                background: copied ? 'rgba(16, 185, 129, 0.1)' : 'rgba(37, 99, 235, 0.08)',
                border: `1px solid ${copied ? 'rgba(16, 185, 129, 0.3)' : 'rgba(37, 99, 235, 0.2)'}`,
                color: copied ? '#10b981' : '#2563eb',
                borderRadius: '4px',
                fontSize: '0.7rem',
                fontWeight: 700,
                cursor: 'pointer',
                transition: 'all 0.2s',
                marginLeft: '6px',
                userSelect: 'none'
            }}
            className="tracking-badge-hover"
        >
            {copied ? (
                <>
                    <Check size={10} strokeWidth={3} />
                    <span>¡TN Copiado!</span>
                </>
            ) : (
                <>
                    <span>TN: {trackingNumber}</span>
                    <ExternalLink size={10} strokeWidth={2.5} />
                </>
            )}
        </span>
    );
};

export default function DeliveriesPage() {
    const {
        deliveries,
        addDelivery,
        deleteDelivery,
        deleteDeliveries,
        tickets,
        updateTicket,
        deleteTickets,
        users,
        currentUser,
        countryFilter,
        getClientName,
        logisticsTasks,
        updateLogisticsTask
    } = useStore();
    const router = useRouter();
    const mapRef = useRef(null);
    const googleMap = useRef(null);
    const [googleLoaded, setGoogleLoaded] = useState(false);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isScannerOpen, setIsScannerOpen] = useState(false);
    const [newDelivery, setNewDelivery] = useState({ recipient: '', address: '', items: '', status: 'Pendiente', courier: 'Interno' });
    const [filter, setFilter] = useState('');
    const [statusFilter, setStatusFilter] = useState('En Transito');
    const [geocodedPoints, setGeocodedPoints] = useState([]);
    const [isGeocoding, setIsGeocoding] = useState(false);
    const [sortConfig, setSortConfig] = useState({ key: 'date', direction: 'asc' });
    const [showMap, setShowMap] = useState(false);
    const [selectedIds, setSelectedIds] = useState([]);
    const [driverFilter, setDriverFilter] = useState('All');

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

    // Estilos de Mapa Minimalistas
    const minimalistStyles = [
        { "featureType": "all", "elementType": "labels.text.fill", "stylers": [{ "color": "#7c919e" }] },
        { "featureType": "all", "elementType": "labels.text.stroke", "stylers": [{ "visibility": "off" }] },
        { "featureType": "poi", "stylers": [{ "visibility": "off" }] },
        { "featureType": "transit", "stylers": [{ "visibility": "off" }] },
        { "featureType": "road", "elementType": "geometry", "stylers": [{ "color": "#e2e8f0" }, { "lightness": 50 }] },
        { "featureType": "road", "elementType": "labels", "stylers": [{ "visibility": "off" }] },
        { "featureType": "landscape", "stylers": [{ "color": "#f8fafc" }] },
        { "featureType": "water", "stylers": [{ "color": "#cbd5e1" }] },
        { "featureType": "administrative.locality", "elementType": "labels", "stylers": [{ "visibility": "on" }] },
        { "featureType": "administrative.neighborhood", "elementType": "labels", "stylers": [{ "visibility": "on" }] }
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

    // Unimos los datos de envíos usando la nueva tabla relacional de tareas
    const combinedDeliveries = React.useMemo(() => {
        const items = [];

        // 1. Procesar tareas de logística relacionales
        (logisticsTasks || []).forEach(task => {
            // Solo procesamos si tiene fecha coordinada y no está entregado (para esta vista activa)
            if (!task || !task.date || task.status === 'Entregado') return;

            const parentTicket = tickets.find(t => t.id === task.ticket_id);

            items.push({
                id: task.case_number || `TASK-${task.id?.substring(0, 8) || task.id}`,
                taskId: task.id,
                parentTicketId: task.ticket_id,
                recipient: parentTicket?.requester || 'Destinatario Desconocido',
                address: task.address || parentTicket?.logistics?.address || 'Sin dirección',
                floorDept: task.floorDept || task.floor_dept || parentTicket?.logistics?.floorDept || '',
                items: task.subject || parentTicket?.subject || 'Equipo IT',
                courier: task.method || 'No definido',
                deliveryPerson: task.deliveryPerson,
                trackingNumber: task.tracking_number || '',
                status: task.status || 'Pendiente',
                ticketStatus: parentTicket?.status || 'N/A',
                deliveryStatusOriginal: task.status || 'Pendiente',
                date: `${task.date} [${task.time_slot || 'AM'}]`,
                source: 'Ticket',
                isSubCase: true,
                assets: task.assets || [],
                visitOrder: task.deliveryOrder || 0,
                client: parentTicket?.client
            });
        });

        // 2. Procesar ticket raíz (Compatibilidad con tickets que aún no tienen tasks)
        tickets.forEach(t => {
            const isCompleted = t.status === 'Resuelto' || t.status === 'Cerrado' || t.status === 'Servicio Facturado' || t.status === 'Caso SFDC Cerrado' || t.deliveryStatus === 'Entregado';
            if (isCompleted) return;

            const rootHasDate = t.logistics?.date;
            // Solo si no tiene tareas en la nueva tabla (evitar duplicados)
            const hasNewTasks = logisticsTasks.some(task => task.ticket_id === t.id);

            if (rootHasDate && !hasNewTasks) {
                items.push({
                    id: t.id,
                    recipient: t.requester,
                    address: t.logistics.address || 'Sin dirección',
                    floorDept: t.logistics.floorDept || '',
                    items: t.subject || 'Equipo IT',
                    courier: t.logistics.method || 'No definido',
                    deliveryPerson: t.logistics.deliveryPerson,
                    trackingNumber: t.logistics.trackingNumber || '',
                    status: t.deliveryStatus || 'Pendiente',
                    ticketStatus: t.status,
                    deliveryStatusOriginal: t.deliveryStatus,
                    date: `${t.logistics.date} [${t.logistics.time_slot || 'AM'}]`,
                    source: 'Ticket',
                    isSubCase: false,
                    visitOrder: t.logistics?.deliveryOrder || 0,
                    client: t.client
                });
            }
        });

        const activeManualDeliveries = (deliveries || []).filter(d => d.status !== 'Entregado').map(d => ({
            ...d,
            source: 'Manual',
            ticketStatus: d.status,
            deliveryStatusOriginal: d.status,
            floorDept: d.floorDept || ''
        }));

        return [...activeManualDeliveries, ...items];
    }, [deliveries, tickets, logisticsTasks]);

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
        let result = (combinedDeliveries || []).filter(d => {
            const recipient = String(d.recipient || '').toLowerCase();
            const displayId = String(d.id || '').toLowerCase();
            const address = String(d.address || '').toLowerCase();
            const searchTerm = filter.toLowerCase();

            const matchesText = recipient.includes(searchTerm) ||
                displayId.includes(searchTerm) ||
                address.includes(searchTerm);
            const normalizeStatus = (s) => (s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
            const matchesStatus = statusFilter === 'All' || normalizeStatus(d.status) === normalizeStatus(statusFilter);

            // Filtrado por Cliente (campo explícito)
            const expectedClient = getClientName(countryFilter);
            const matchesCountry = expectedClient === 'Todos' || d.client === expectedClient;

            const matchesDriver = driverFilter === 'All' || (d.deliveryPerson || 'Sin Asignar') === driverFilter;

            return matchesText && matchesStatus && matchesCountry && matchesDriver;
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
    }, [combinedDeliveries, filter, statusFilter, sortConfig, countryFilter, driverFilter]);

    const uniqueDrivers = React.useMemo(() => {
        const drivers = new Set();
        combinedDeliveries.forEach(d => {
            if (d.deliveryPerson) drivers.add(d.deliveryPerson);
        });
        return Array.from(drivers).sort();
    }, [combinedDeliveries]);

    const inTransitCount = sortedAndFilteredDeliveries.filter(d => d.status === 'En Transito').length;
    const deliveredCount = sortedAndFilteredDeliveries.filter(d => d.status === 'Entregado').length;
    const pendingCount = sortedAndFilteredDeliveries.filter(d => d.status === 'Pendiente').length;

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
                        // Extraemos la calle y número limpiando pisos/departamentos
                        const parts = delivery.address.split(',').map(p => p.trim());
                        const firstPart = parts[0];
                        const match = firstPart ? firstPart.match(/^(.*?\s+\d+)(?:\s+.*)?$/) : null;
                        const cleanStreet = match ? match[1].trim() : firstPart;
                        
                        const otherParts = parts.slice(1);
                        let query = [cleanStreet, ...otherParts].filter(Boolean).join(', ');
                        if (!query.toLowerCase().includes('argentina')) {
                            query = `${query}, Argentina`;
                        }

                        geocoder.geocode({
                            address: query,
                            componentRestrictions: {
                                country: 'AR'
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
    
    // Puntos que deben ser visibles según los filtros actuales (Solo en tránsito)
    const visiblePoints = React.useMemo(() => {
        return geocodedPoints.filter(p => {
            const isTransit = p.deliveryStatusOriginal === 'En Transito' || p.status === 'En Transito';
            if (!isTransit) return false;

            // Debe cumplir con el filtro de texto, cliente y conductor
            const recipient = String(p.recipient || '').toLowerCase();
            const displayId = String(p.id || '').toLowerCase();
            const address = String(p.address || '').toLowerCase();
            const searchTerm = filter.toLowerCase();

            const matchesText = recipient.includes(searchTerm) ||
                displayId.includes(searchTerm) ||
                address.includes(searchTerm);

            const expectedClient = getClientName(countryFilter);
            const matchesCountry = expectedClient === 'Todos' || p.client === expectedClient;

            const matchesDriver = driverFilter === 'All' || (p.deliveryPerson || 'Sin Asignar') === driverFilter;

            return matchesText && matchesCountry && matchesDriver;
        });
    }, [geocodedPoints, filter, countryFilter, driverFilter]);

    // Inicializar Google Map y Marcadores
    useEffect(() => {
        if (!googleLoaded || !mapRef.current || !window.google) return;

        const mapOptions = {
            center: { lat: -34.6037, lng: -58.3816 },
            zoom: 12,
            styles: minimalistStyles,
            disableDefaultUI: false,
            zoomControl: true,
            mapTypeControl: false,
        };

        googleMap.current = new window.google.maps.Map(mapRef.current, mapOptions);
        const bounds = new window.google.maps.LatLngBounds();

        visiblePoints.forEach(d => {
            let color = '#3b82f6'; // Default Blue (Pendiente)
            if (d.deliveryStatusOriginal === 'Entregado') color = '#22c55e';
            else if (d.deliveryStatusOriginal === 'En Transito') color = '#06b6d4';
            else if (d.deliveryStatusOriginal === 'Para Coordinar') color = '#f97316';

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
                            <span>📍</span> <span>${d.address}${d.floorDept ? `, ${d.floorDept}` : ''}</span>
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

        // Renderizar conductores activos con ubicación
        const activeDrivers = (users || []).filter(u => 
            String(u.role).toLowerCase() === 'conductor' && 
            u.location_latitude && 
            u.location_longitude
        );

        activeDrivers.forEach(driver => {
            const driverLatLng = { lat: Number(driver.location_latitude), lng: Number(driver.location_longitude) };
            
            const driverMarker = new window.google.maps.Marker({
                position: driverLatLng,
                map: googleMap.current,
                title: `Conductor: ${driver.name}`,
                icon: {
                    url: "data:image/svg+xml;charset=UTF-8," + encodeURIComponent(`
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="40" height="40">
                          <circle cx="12" cy="12" r="10" fill="#dc2626" stroke="#ffffff" stroke-width="2" />
                          <path d="M5 8h9v5H5z" fill="#ffffff" />
                          <path d="M14 9h3l2 2v2h-5z" fill="#ffffff" />
                          <circle cx="7.5" cy="14.5" r="1.5" fill="#000000" stroke="#ffffff" stroke-width="1" />
                          <circle cx="15.5" cy="14.5" r="1.5" fill="#000000" stroke="#ffffff" stroke-width="1" />
                        </svg>
                    `),
                    scaledSize: new window.google.maps.Size(40, 40),
                    origin: new window.google.maps.Point(0, 0),
                    anchor: new window.google.maps.Point(20, 20)
                },
                zIndex: 1000 // Asegurar que los camiones queden por encima de los pines
            });

            let lastUpdateText = 'No registrada';
            if (driver.last_location_update) {
                try {
                    const diffMs = Date.now() - new Date(driver.last_location_update).getTime();
                    const diffMins = Math.round(diffMs / 60000);
                    if (diffMins < 1) lastUpdateText = 'Hace instantes';
                    else if (diffMins < 60) lastUpdateText = `Hace ${diffMins} min`;
                    else lastUpdateText = `Hace ${Math.round(diffMins / 60)} h`;
                } catch (e) {
                    lastUpdateText = new Date(driver.last_location_update).toLocaleTimeString();
                }
            }

            const driverInfoWindow = new window.google.maps.InfoWindow({
                content: `
                    <div style="padding: 10px; font-family: 'Inter', sans-serif; min-width: 180px; color: #333;">
                        <div style="font-size: 10px; text-transform: uppercase; color: #dc2626; font-weight: 800; margin-bottom: 2px;">🚚 Conductor Activo</div>
                        <strong style="display: block; font-size: 14px; color: #1e293b; margin-bottom: 6px;">${driver.name}</strong>
                        <div style="font-size: 11px; color: #64748b; border-top: 1px solid #f1f5f9; padding-top: 6px; display: flex; justify-content: space-between;">
                            <span>Último reporte:</span>
                            <span style="font-weight: 600; color: #334155;">${lastUpdateText}</span>
                        </div>
                    </div>
                `
            });

            driverMarker.addListener("click", () => {
                driverInfoWindow.open(googleMap.current, driverMarker);
            });

            bounds.extend(driverLatLng);
        });

        if (visiblePoints.length > 0 || activeDrivers.length > 0) {
            googleMap.current.fitBounds(bounds, { padding: 50 });
        }

    }, [googleLoaded, visiblePoints, users]);

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

    const handleUpdateOrder = async (delivery, newOrder) => {
        const orderVal = parseInt(newOrder, 10) || 0;
        try {
            if (delivery.isSubCase) {
                await updateLogisticsTask(delivery.taskId, { deliveryOrder: orderVal });
            } else if (delivery.source === 'Ticket') {
                const ticket = tickets.find(t => t.id === delivery.id);
                if (ticket) {
                    await updateTicket(ticket.id, { 
                        logistics: { ...(ticket.logistics || {}), deliveryOrder: orderVal } 
                    });
                }
            }
        } catch (error) {
            console.error("Error updating visit order:", error);
        }
    };

    const handlePrintDeliveryLabel = async (delivery) => {
        try {
            // Contenido dinámico para el QR: URL que lleva al conductor directo al registro
            const qrContent = `${window.location.origin}/dashboard/my-deliveries?scan=${delivery.id}`;
            const qrDataUrl = await QRCode.toDataURL(qrContent, {
                margin: 1,
                width: 200,
                errorCorrectionLevel: 'M', // Nivel medio para mayor robustez
                color: { dark: '#000000', light: '#ffffff' }
            });

            // Barcode para el ID
            const canvas = document.createElement('canvas');
            JsBarcode(canvas, String(delivery.id), {
                format: "CODE128",
                width: 2,
                height: 40,
                displayValue: false,
                margin: 0
            });
            const barcodeDataUrl = canvas.toDataURL("image/png");

            let iframe = document.getElementById('print-iframe');
            if (!iframe) {
                iframe = document.createElement('iframe');
                iframe.id = 'print-iframe';
                iframe.style.position = 'absolute';
                iframe.style.width = '0';
                iframe.style.height = '0';
                iframe.style.border = 'none';
                document.body.appendChild(iframe);
            }

            const content = `
                <html>
                    <head>
                        <meta charset="utf-8">
                        <style>
                            @page { size: 50mm 25mm; margin: 0; }
                            * { box-sizing: border-box; -webkit-print-color-adjust: exact; }
                            html, body { width: 50mm; height: 25mm; margin: 0; padding: 0; background: #fff; overflow: hidden; }
                            .label-container {
                                width: 50mm; height: 25mm; padding: 1.8mm 2.8mm;
                                display: flex; position: absolute; top: 0; left: 0;
                                font-family: 'Helvetica', 'Arial', sans-serif;
                            }
                            .left-side {
                                flex: 1; display: flex; flex-direction: column;
                                justify-content: center; gap: 0.3mm; padding-right: 1.5mm;
                                overflow: hidden;
                            }
                            .ticket-id {
                                font-size: 5.5pt; font-weight: 800; color: #000;
                                margin-bottom: 0.1mm; line-height: 1;
                            }
                            .recipient-name {
                                font-size: 7.5pt; font-weight: 900; line-height: 1.1;
                                color: #000; text-transform: uppercase;
                                display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;
                                overflow: hidden; margin-bottom: 0.2mm;
                            }
                            .address-text {
                                font-size: 5.2pt; font-weight: 600; line-height: 1.1;
                                color: #111; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical;
                                overflow: hidden;
                            }
                            .date-text {
                                font-size: 4.8pt; font-weight: 800; color: #000;
                                margin-top: 0.2mm;
                            }
                            .right-side {
                                width: 14.5mm; display: flex;
                                align-items: center; justify-content: center;
                                height: 100%;
                            }
                            .qr-code { width: 14.5mm; height: 14.5mm; }
                        </style>
                    </head>
                    <body>
                        <div class="label-container">
                            <div class="left-side">
                                <div class="ticket-id">TICKET #${delivery.id}</div>
                                <div class="recipient-name">${delivery.recipient}</div>
                                <div class="address-text">${delivery.address}</div>
                                <div class="date-text">📅 ${delivery.date}</div>
                            </div>
                            <div class="right-side">
                                <img class="qr-code" src="${qrDataUrl}" />
                            </div>
                        </div>
                    </body>
                </html>
            `;

            const doc = iframe.contentWindow.document;
            doc.open();
            doc.write(content);
            doc.close();

            setTimeout(() => {
                iframe.contentWindow.focus();
                iframe.contentWindow.print();
            }, 500);

        } catch (err) {
            console.error('Error printing delivery label:', err);
            alert('Error al imprimir la etiqueta de envío');
        }
    };

    const handlePrintRouteReport = () => {
        // Agrupar por conductor y ordenar por visita
        const drivers = {};

        sortedAndFilteredDeliveries.forEach(d => {
            const driverName = d.deliveryPerson || 'Sin Asignar';
            if (!drivers[driverName]) drivers[driverName] = [];
            drivers[driverName].push(d);
        });

        // Ordenar cada grupo por orden de visita
        Object.keys(drivers).forEach(name => {
            drivers[name].sort((a, b) => (a.visitOrder || 0) - (b.visitOrder || 0));
        });

        let iframe = document.getElementById('print-iframe');
        if (!iframe) {
            iframe = document.createElement('iframe');
            iframe.id = 'print-iframe';
            iframe.style.position = 'absolute'; iframe.style.width = '0'; iframe.style.height = '0'; iframe.style.border = 'none';
            document.body.appendChild(iframe);
        }

        const content = `
            <html>
                <head>
                    <title>Reporte de Rutas - AssetFlow</title>
                    <style>
                        @page { size: A4; margin: 15mm; }
                        body { font-family: 'Inter', 'Segoe UI', Arial, sans-serif; color: #333; line-height: 1.4; }
                        .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #3b82f6; padding-bottom: 10px; margin-bottom: 20px; }
                        .logo { font-weight: 800; font-size: 20px; color: #1e3a8a; }
                        .report-title { font-size: 18px; font-weight: 700; text-transform: uppercase; }
                        .driver-section { margin-bottom: 40px; page-break-inside: avoid; }
                        .driver-info { background: #f8fafc; padding: 10px 15px; border-radius: 8px; margin-bottom: 15px; border-left: 5px solid #3b82f6; }
                        table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 11px; }
                        th { background: #f1f5f9; color: #475569; text-transform: uppercase; font-weight: 700; padding: 10px; border: 1px solid #e2e8f0; text-align: left; }
                        td { padding: 10px; border: 1px solid #e2e8f0; vertical-align: top; }
                        .order-col { width: 40px; text-align: center; font-weight: 700; background: #f8fafc; }
                        .obs-col { width: 150px; color: #94a3b8; font-style: italic; }
                        .footer { margin-top: 50px; font-size: 10px; color: #64748b; text-align: center; border-top: 1px solid #e2e8f0; padding-top: 10px; }
                        .badge { padding: 2px 6px; border-radius: 4px; font-size: 9px; font-weight: 700; background: #e2e8f0; }
                    </style>
                </head>
                <body>
                    <div class="header">
                        <div class="logo">AssetFlow LOGISTICS</div>
                        <div class="report-title">Hoja de Ruta de Conductores</div>
                        <div style="font-size: 10px; text-align: right;">${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}</div>
                    </div>

                    ${Object.keys(drivers).map(name => `
                        <div class="driver-section">
                            <div class="driver-info">
                                <div style="font-size: 10px; color: #64748b; text-transform: uppercase;">Conductor Asignado</div>
                                <div style="font-size: 16px; font-weight: 700; color: #1e293b;">${name}</div>
                            </div>
                            <table>
                                <thead>
                                    <tr>
                                        <th class="order-col">#</th>
                                        <th style="width: 80px;">ID / Servicio</th>
                                        <th>Destinatario / Dirección</th>
                                        <th style="width: 100px;">Horario / Estado</th>
                                        <th class="obs-col">Observaciones / Firma</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${drivers[name].map(d => `
                                        <tr>
                                            <td class="order-col">${d.visitOrder || '-'}</td>
                                            <td>
                                                <div style="font-weight: 700;">${d.id}</div>
                                                <div style="font-size: 9px; margin-top: 4px; color: #64748b;">${d.items}</div>
                                            </td>
                                            <td>
                                                <div style="font-weight: 600;">${d.recipient}</div>
                                                <div style="margin-top: 4px; color: #475569;">${d.address}</div>
                                            </td>
                                            <td>
                                                <div style="font-weight: 700;">${(d.date || '').split('[')[1]?.replace(']', '') || 'AM'}</div>
                                                <div style="margin-top: 4px;"><span class="badge">${d.status}</span></div>
                                            </td>
                                            <td class="obs-col">
                                                <div style="border-bottom: 1px dotted #cbd5e1; height: 15px; margin-bottom: 10px;"></div>
                                                <div style="border-bottom: 1px dotted #cbd5e1; height: 15px;"></div>
                                            </td>
                                        </tr>
                                    `).join('')}
                                </tbody>
                            </table>
                        </div>
                    `).join('')}

                    <div class="footer">
                        Este documento es propiedad de AssetFlow. Generado automáticamente por el sistema de gestión logística.
                    </div>
                </body>
            </html>
        `;

        const doc = iframe.contentWindow.document;
        doc.open(); doc.write(content); doc.close();

        setTimeout(() => {
            iframe.contentWindow.focus();
            iframe.contentWindow.print();
        }, 500);
    };

    return (
        <div style={{ animation: 'fadeIn 0.5s ease-out' }}>
            <div style={{ marginBottom: '2rem' }} className="flex-mobile-column">
                <div>
                    <h1 style={{ fontSize: '1.8rem', fontWeight: 700, color: 'var(--text-main)' }}>Gestión de Envíos</h1>
                    <p style={{ color: 'var(--text-secondary)' }}>Logística avanzada de cliente {countryFilter}.</p>
                </div>
                <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }} className="flex-mobile-column">
                    {(currentUser?.role === 'Administrador' || currentUser?.role === 'admin' || currentUser?.role === 'Gerencial') && selectedIds.length > 0 && (
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
                    <Button icon={Printer} onClick={handlePrintRouteReport} variant="secondary">Imprimir Hoja de Ruta</Button>
                    <Button icon={QrCode} onClick={() => setIsScannerOpen(true)} variant="secondary">Escanear QR</Button>
                    <Button icon={Plus} onClick={() => setIsModalOpen(true)}>Nuevo Envío</Button>
                </div>
            </div>

            <div className="grid-responsive-4" style={{ marginBottom: '2rem' }}>
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
                        backgroundColor: statusFilter === 'En Transito' ? 'rgba(37, 99, 235, 0.1)' : 'var(--surface)',
                        transition: 'all 0.2s ease',
                        boxShadow: statusFilter === 'En Transito' ? 'inset 0 0 0 1px #2563eb, var(--shadow-sm)' : 'var(--shadow-sm)'
                    }}
                    onClick={() => setStatusFilter('En Transito')}
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
                        <Badge variant="outline" style={{ fontSize: '0.7rem' }}>Ubicaciones Reales: {visiblePoints.length}</Badge>
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
                        <div style={{ display: 'flex', gap: '1.5rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <div style={{ width: '12px', height: '12px', background: '#3b82f6', borderRadius: '50%', boxShadow: '0 0 0 4px rgba(59, 130, 246, 0.1)' }}></div>
                                <span style={{ fontSize: '0.8rem', fontWeight: 500 }}>Pendiente</span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <div style={{ width: '12px', height: '12px', background: '#f97316', borderRadius: '50%', boxShadow: '0 0 0 4px rgba(249, 115, 22, 0.1)' }}></div>
                                <span style={{ fontSize: '0.8rem', fontWeight: 500 }}>Para Coordinar</span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <div style={{ width: '12px', height: '12px', background: '#06b6d4', borderRadius: '50%', boxShadow: '0 0 0 4px rgba(6, 182, 212, 0.1)' }}></div>
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
                <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', alignItems: 'center' }} className="flex-mobile-column">
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
                    <select
                        value={driverFilter}
                        onChange={(e) => setDriverFilter(e.target.value)}
                        style={{
                            padding: '0.6rem 1rem',
                            borderRadius: 'var(--radius-md)',
                            border: '1px solid var(--border)',
                            backgroundColor: 'var(--background)',
                            color: 'var(--text-main)',
                            outline: 'none',
                            minWidth: '200px'
                        }}
                    >
                        <option value="All">Todos los Conductores</option>
                        <option value="Sin Asignar">Sin Asignar</option>
                        {uniqueDrivers.map(driver => (
                            <option key={driver} value={driver}>{driver}</option>
                        ))}
                    </select>

                    {(statusFilter !== 'All' || filter !== '' || driverFilter !== 'All') && (
                        <Button variant="ghost" size="sm" onClick={() => { setStatusFilter('All'); setFilter(''); setDriverFilter('All'); }}>Limpiar Filtros</Button>
                    )}
                </div>

                <div className="table-responsive">
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                        <thead>
                            <tr style={{ borderBottom: '1px solid var(--border)' }}>
                                {(currentUser?.role === 'Administrador' || currentUser?.role === 'admin' || currentUser?.role === 'Gerencial') && (
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
                                            <option value="En Transito">En Tránsito</option>
                                            <option value="Entregado">Entregado</option>
                                        </select>
                                    </div>
                                </th>
                                <th style={{ padding: '1rem', fontWeight: 600, color: 'var(--text-secondary)', fontSize: '0.85rem', textAlign: 'right' }}>ACCIONES</th>
                            </tr>
                        </thead>
                        <tbody>
                            {(() => {
                                let lastDateKey = null;
                                return sortedAndFilteredDeliveries.map((delivery) => {
                                    const dateColor = getColorByDate(delivery.date);
                                    // Usar solo la parte YYYY-MM-DD para agrupar (ignorar [AM]/[PM])
                                    const dateKey = (delivery.date || '').split(' ')[0] || delivery.date;
                                    const showDateHeader = dateKey !== lastDateKey;
                                    lastDateKey = dateKey;

                                    return (
                                        <React.Fragment key={delivery.id}>
                                            {showDateHeader && (
                                                <tr style={{ backgroundColor: 'var(--background)' }}>
                                                    <td colSpan={(currentUser?.role === 'Administrador' || currentUser?.role === 'admin' || currentUser?.role === 'Gerencial') ? "7" : "6"} style={{ padding: '1.5rem 1rem 0.5rem 1rem' }}>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                                            <div style={{ backgroundColor: dateColor, width: '8px', height: '8px', borderRadius: '50%' }}></div>
                                                            <span style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                                                {(() => {
                                                                    if (!delivery.date || delivery.date === 'A Confirmar' || delivery.date === 'No definida') return 'Por Confirmar';
                                                                    const cleanDate = (delivery.date || '').split(' ')[0]; // Extraer 'YYYY-MM-DD'
                                                                    if (!cleanDate) return 'Sin Fecha';
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
                                                    {(() => {
                                                        const hasPerson = !!delivery.deliveryPerson && delivery.deliveryPerson !== 'No definido';
                                                        const hasMethod = !!delivery.courier && delivery.courier !== 'No definido';
                                                        const hasTracking = !!delivery.trackingNumber;

                                                        if (hasPerson) {
                                                            return (
                                                                <div style={{ fontSize: '0.75rem', color: 'var(--primary-color)', marginTop: '4px', fontWeight: 700 }}>
                                                                    Repartidor: {delivery.deliveryPerson}
                                                                </div>
                                                            );
                                                        } else if (hasMethod) {
                                                            return (
                                                                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '4px', fontWeight: 600, display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '4px' }}>
                                                                    <span>{delivery.courier}</span>
                                                                    {hasTracking && (
                                                                        <TrackingBadge method={delivery.courier} trackingNumber={delivery.trackingNumber} />
                                                                    )}
                                                                </div>
                                                            );
                                                        }
                                                        return null;
                                                    })()}
                                                </td>
                                                <td style={{ padding: '1rem', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                        <MapPin size={14} style={{ color: dateColor, flexShrink: 0 }} />
                                                        {delivery.address}
                                                        {delivery.floorDept && ` - ${delivery.floorDept}`}
                                                    </div>
                                                </td>
                                                <td style={{ padding: '1rem', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                        <Calendar size={14} />
                                                        {delivery.date}
                                                    </div>
                                                </td>
                                                <td style={{ padding: '1rem' }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
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

                                                        <div style={{ position: 'relative' }}>
                                                            <input
                                                                type='number'
                                                                min='0'
                                                                defaultValue={delivery.visitOrder || 0}
                                                                onBlur={(e) => handleUpdateOrder(delivery, e.target.value)}
                                                                onKeyDown={(e) => {
                                                                    if (e.key === 'Enter') {
                                                                        handleUpdateOrder(delivery, e.target.value);
                                                                        e.target.blur();
                                                                    }
                                                                }}
                                                                style={{
                                                                    width: '32px',
                                                                    height: '32px',
                                                                    borderRadius: '8px',
                                                                    border: '2px solid var(--primary-color)',
                                                                    background: (delivery.visitOrder && delivery.visitOrder > 0) ? 'var(--primary-color)' : 'transparent',
                                                                    color: (delivery.visitOrder && delivery.visitOrder > 0) ? 'white' : 'var(--primary-color)',
                                                                    textAlign: 'center',
                                                                    fontWeight: 900,
                                                                    fontSize: '1rem',
                                                                    appearance: 'none',
                                                                    MozAppearance: 'textfield',
                                                                    cursor: 'pointer',
                                                                    transition: 'all 0.2s',
                                                                    outline: 'none',
                                                                    boxShadow: (delivery.visitOrder && delivery.visitOrder > 0) ? '0 4px 10px rgba(37, 99, 235, 0.2)' : 'none'
                                                                }}
                                                                title='Editar Orden de Visita'
                                                            />
                                                        </div>
                                                    </div>
                                                </td>
                                                <td style={{ padding: '1rem', textAlign: 'right' }}>
                                                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            style={{ color: 'var(--primary-color)' }}
                                                            onClick={() => handlePrintDeliveryLabel(delivery)}
                                                            title="Imprimir Etiqueta Logística"
                                                        >
                                                            <Printer size={18} />
                                                        </Button>

                                                        {delivery.source === 'Ticket' ? (
                                                            <Button variant="ghost" size="sm" onClick={() => router.push(`/dashboard/tickets/${delivery.parentTicketId || delivery.id}`)}>Ver Ticket</Button>
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
            
            <style jsx>{`
                .tracking-badge-hover:hover {
                    filter: brightness(0.95);
                    transform: scale(1.02);
                }
            `}</style>
        </div>
    );
}
