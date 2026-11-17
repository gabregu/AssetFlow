"use client";
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { GoogleMap, useJsApiLoader, Marker, InfoWindow, Circle } from '@react-google-maps/api';
import { Loader2, MapPin, Navigation, CheckSquare, Square, ExternalLink, Layers, Maximize2, Minimize2, Search } from 'lucide-react';
import Link from 'next/link';

const centerDefault = {
    lat: -34.603722,
    lng: -58.381592 // Buenos Aires
};

const COUNTRY_CENTERS = {
    'Argentina': { lat: -34.603722, lng: -58.381592 },
    'SFDC-Argentina': { lat: -34.603722, lng: -58.381592 },
    'Chile': { lat: -33.44889, lng: -70.669265 },
    'SFDC-Chile': { lat: -33.44889, lng: -70.669265 },
    'Colombia': { lat: 4.710989, lng: -74.072092 },
    'SFDC-Colombia': { lat: 4.710989, lng: -74.072092 },
    'Costa Rica': { lat: 9.928069, lng: -84.090725 },
    'SFDC-Costa Rica': { lat: 9.928069, lng: -84.090725 },
    'Uruguay': { lat: -34.901112, lng: -56.164532 },
    'SFDC-Uruguay': { lat: -34.901112, lng: -56.164532 }
};

const minimalistStyles = [
    {
        "featureType": "all",
        "elementType": "labels.text.fill",
        "stylers": [{ "color": "#475569" }]
    },
    {
        "featureType": "poi",
        "stylers": [{ "visibility": "off" }]
    },
    {
        "featureType": "transit",
        "stylers": [{ "visibility": "off" }]
    },
    {
        "featureType": "road",
        "elementType": "geometry",
        "stylers": [{ "color": "#cbd5e1" }, { "lightness": 35 }]
    },
    {
        "featureType": "landscape",
        "stylers": [{ "color": "#f8fafc" }]
    },
    {
        "featureType": "water",
        "stylers": [{ "color": "#bae6fd" }]
    },
    {
        "featureType": "administrative.locality",
        "elementType": "labels",
        "stylers": [{ "visibility": "on" }]
    },
    {
        "featureType": "administrative.neighborhood",
        "elementType": "labels",
        "stylers": [{ "visibility": "on" }]
    }
];

const CACHE_STORAGE_KEY = 'assetflow_geocode_cache_v2';
const geocodeCache = new Map();

// Hydrate cache from localStorage on client load
if (typeof window !== 'undefined') {
    try {
        const raw = window.localStorage.getItem(CACHE_STORAGE_KEY);
        if (raw) {
            const parsed = JSON.parse(raw);
            Object.entries(parsed).forEach(([k, v]) => {
                if (v && typeof v.lat === 'number' && typeof v.lng === 'number') {
                    geocodeCache.set(k, v);
                }
            });
        }
    } catch (e) {
        // ignore storage errors
    }
}

const persistGeocodeCache = () => {
    if (typeof window === 'undefined') return;
    try {
        const obj = {};
        // Keep up to 1500 entries in localStorage
        const entries = Array.from(geocodeCache.entries()).slice(-1500);
        entries.forEach(([k, v]) => { obj[k] = v; });
        window.localStorage.setItem(CACHE_STORAGE_KEY, JSON.stringify(obj));
    } catch (e) {
        // ignore storage quota errors
    }
};

// Clean address for higher geocoding hit rate (removes floor noise, SFDC-* prefixes)
const buildGeocodeCandidates = (rawAddress, clientOrCountry = '') => {
    if (!rawAddress) return [];
    let cleaned = String(rawAddress).trim();
    cleaned = cleaned
        .replace(/\bSFDC-Argentina\b/gi, 'Argentina')
        .replace(/\bSFDC-Chile\b/gi, 'Chile')
        .replace(/\bSFDC-Colombia\b/gi, 'Colombia')
        .replace(/\bSFDC-Costa Rica\b/gi, 'Costa Rica')
        .replace(/\bSFDC-Uruguay\b/gi, 'Uruguay')
        .replace(/\bSFDC\b/gi, '')
        .replace(/\s+/g, ' ')
        .trim();

    const countryHint = String(clientOrCountry || '')
        .replace(/^SFDC-/i, '')
        .trim();

    const candidates = [cleaned];

    // Strip floor / apartment / office noise for fallback query
    const strippedFloor = cleaned
        .replace(/,?\s*\b\d+(?:st|nd|rd|th)?\s*(?:and\s*\d+(?:st|nd|rd|th)?)?\s*floors?\b/gi, '')
        .replace(/,?\s*\bpiso\s*\w+\b/gi, '')
        .replace(/,?\s*\bdepto\.?\s*\w+\b/gi, '')
        .replace(/,?\s*\boficina\s*\w+\b/gi, '')
        .replace(/,\s*,/g, ',')
        .replace(/,\s*$/g, '')
        .trim();

    if (strippedFloor && strippedFloor !== cleaned) {
        candidates.push(strippedFloor);
    }

    if (countryHint && countryHint !== 'Todos' && !strippedFloor.toLowerCase().includes(countryHint.toLowerCase())) {
        candidates.push(`${strippedFloor}, ${countryHint}`);
    }

    return [...new Set(candidates.filter(c => c.length > 4))];
};

// Haversine distance in meters
const getDistanceMeters = (lat1, lng1, lat2, lng2) => {
    const R = 6371000;
    const toRad = (deg) => (deg * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
        Math.sin(dLng / 2) * Math.sin(dLng / 2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

const formatDistance = (meters) => {
    if (meters < 50) return 'Misma ubicación';
    if (meters < 1000) return `${Math.round(meters)} m`;
    return `${(meters / 1000).toFixed(1)} km`;
};

const getSrvBadge = (ticket) => {
    const rawType = String(ticket?.type || ticket?.logistics?.type || ticket?.subject || '').toLowerCase();
    if (rawType.includes('recolec') || rawType.includes('retiro') || rawType.includes('recupero') || rawType.includes('offboarding') || rawType.includes('collection') || rawType.includes('swap request bundle')) {
        return { label: 'REC', color: '#dc2626', bg: '#fee2e2', name: 'Retiro / Recolección' };
    }
    if (rawType.includes('reemplazo') || rawType.includes('swap') || rawType.includes('refresh') || rawType.includes('breakfix')) {
        return { label: 'REE', color: '#ea580c', bg: '#ffedd5', name: 'Reemplazo' };
    }
    return { label: 'ENT', color: '#16a34a', bg: '#dcfce7', name: 'Entrega' };
};

const getTicketAddress = (ticket) => {
    return (
        ticket?.logistics?.address ||
        ticket?.displayAddress ||
        ticket?.address ||
        (Array.isArray(ticket?.associatedCases) && ticket.associatedCases.find(c => c?.logistics?.address || c?.mailingStreet)?.logistics?.address) ||
        (Array.isArray(ticket?.associatedCases) && ticket.associatedCases.find(c => c?.mailingStreet)?.mailingStreet) ||
        ''
    );
};

const EMPTY_ARRAY = [];

export function ServiceMap({
    tickets = EMPTY_ARRAY,
    drivers = EMPTY_ARRAY,
    selectedTickets = EMPTY_ARRAY,
    onToggleSelectTicket = null,
    onSelectMultipleTickets = null,
    onFilterBySelection = null,
    enableProximityTools = false,
    countryFilter = 'Argentina'
}) {
    const { isLoaded, loadError } = useJsApiLoader({
        id: 'google-map-script',
        googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY,
        libraries: ['places', 'geometry']
    });

    const [map, setMap] = useState(null);
    const [geocodedTickets, setGeocodedTickets] = useState([]);
    const [driverMarkers, setDriverMarkers] = useState([]);
    const [selectedGroup, setSelectedGroup] = useState(null);
    const [geocoding, setGeocoding] = useState(false);
    const [geocodeProgress, setGeocodeProgress] = useState({ done: 0, total: 0 });
    const [initError, setInitError] = useState(null);
    const [colorMode, setColorMode] = useState('status'); // 'status' | 'srv'
    const [proximityRadiusKm, setProximityRadiusKm] = useState(3); // 1, 2, 3, 5, 10 km
    const [isExpandedHeight, setIsExpandedHeight] = useState(false);
    const [zoneSearch, setZoneSearch] = useState('');

    const defaultCenter = useMemo(() => {
        return COUNTRY_CENTERS[countryFilter] || centerDefault;
    }, [countryFilter]);

    const onLoad = useCallback(function callback(mapInstance) {
        setMap(mapInstance);
    }, []);

    const onUnmount = useCallback(function callback() {
        setMap(null);
    }, []);

    useEffect(() => {
        if (loadError) {
            setInitError(loadError.message);
        }
    }, [loadError]);

    // Build driver markers
    useEffect(() => {
        if (!isLoaded) return;
        const dMarkers = [];
        if (drivers && drivers.length > 0) {
            drivers.forEach(d => {
                if (d.location_latitude && d.location_longitude) {
                    dMarkers.push({
                        id: `driver-${d.id}`,
                        lat: Number(d.location_latitude),
                        lng: Number(d.location_longitude),
                        title: `Conductor: ${d.name}`,
                        type: 'driver',
                        details: d
                    });
                }
            });
        }
        setDriverMarkers(dMarkers);
    }, [isLoaded, drivers]);

    // Geocode tickets with deduplication, smart address fallback, and localStorage persistence
    useEffect(() => {
        if (!isLoaded) return;
        let cancelled = false;

        const validTickets = (tickets || []).filter(t => {
            const addr = getTicketAddress(t);
            return addr && addr.trim().length > 4 && addr !== 'Dirección no especificada' && addr !== 'Sin dirección';
        });

        if (validTickets.length === 0) {
            setGeocodedTickets([]);
            setGeocoding(false);
            return;
        }

        const runGeocoding = async () => {
            const geocoder = new window.google.maps.Geocoder();

            // Group tickets by normalized raw address so we only geocode each unique address once
            const uniqueAddressMap = new Map();
            validTickets.forEach(t => {
                const rawAddr = getTicketAddress(t).trim();
                const normKey = rawAddr.toUpperCase();
                if (!uniqueAddressMap.has(normKey)) {
                    uniqueAddressMap.set(normKey, {
                        rawAddr,
                        client: t.client || t.country || countryFilter,
                        tickets: []
                    });
                }
                uniqueAddressMap.get(normKey).tickets.push(t);
            });

            const uncachedKeys = [];
            uniqueAddressMap.forEach((val, key) => {
                if (!geocodeCache.has(key)) {
                    uncachedKeys.push(key);
                }
            });

            const buildResolvedList = () => {
                const list = [];
                uniqueAddressMap.forEach((val, key) => {
                    const coords = geocodeCache.get(key);
                    if (coords && typeof coords.lat === 'number' && typeof coords.lng === 'number') {
                        val.tickets.forEach(t => {
                            list.push({
                                ticket: t,
                                address: val.rawAddr,
                                lat: coords.lat,
                                lng: coords.lng
                            });
                        });
                    }
                });
                return list;
            };

            // Immediately show cached markers
            const initialList = buildResolvedList();
            if (!cancelled) {
                setGeocodedTickets(initialList);
            }

            if (uncachedKeys.length === 0) {
                if (!cancelled) setGeocoding(false);
                return;
            }

            if (!cancelled) {
                setGeocoding(true);
                setGeocodeProgress({ done: 0, total: uncachedKeys.length });
            }

            const geocodeSingleKey = async (key) => {
                const entry = uniqueAddressMap.get(key);
                if (!entry) return;
                const candidates = buildGeocodeCandidates(entry.rawAddr, entry.client);
                for (const candidate of candidates) {
                    try {
                        const result = await new Promise((resolve, reject) => {
                            geocoder.geocode({ address: candidate }, (results, status) => {
                                if (status === 'OK' && results && results[0]) resolve(results[0]);
                                else reject(status);
                            });
                        });
                        if (result) {
                            const lat = result.geometry.location.lat();
                            const lng = result.geometry.location.lng();
                            geocodeCache.set(key, { lat, lng });
                            return;
                        }
                    } catch (errStatus) {
                        if (errStatus === 'OVER_QUERY_LIMIT') {
                            await new Promise(r => setTimeout(r, 600));
                        }
                    }
                }
            };

            // Process in small batches of 3 for fast progressive rendering
            const BATCH_SIZE = 3;
            for (let i = 0; i < uncachedKeys.length; i += BATCH_SIZE) {
                if (cancelled) break;
                const batch = uncachedKeys.slice(i, i + BATCH_SIZE);
                await Promise.all(batch.map(k => geocodeSingleKey(k)));
                persistGeocodeCache();

                if (!cancelled) {
                    setGeocodeProgress({ done: Math.min(i + BATCH_SIZE, uncachedKeys.length), total: uncachedKeys.length });
                    setGeocodedTickets(buildResolvedList());
                }
                if (i + BATCH_SIZE < uncachedKeys.length) {
                    await new Promise(r => setTimeout(r, 220));
                }
            }

            if (!cancelled) {
                setGeocoding(false);
            }
        };

        runGeocoding();
        return () => { cancelled = true; };
    }, [isLoaded, tickets, countryFilter]);

    // Group markers that share the same or very close coordinates (~35m) so pins never hide each other
    const locationGroups = useMemo(() => {
        const groups = [];
        const filteredGeo = zoneSearch.trim()
            ? geocodedTickets.filter(item => {
                const q = zoneSearch.toLowerCase().trim();
                const addr = (item.address || '').toLowerCase();
                const req = (item.ticket?.requester || '').toLowerCase();
                const id = String(item.ticket?.id || item.ticket?.displayId || '').toLowerCase();
                const subj = (item.ticket?.subject || item.ticket?.displaySubject || '').toLowerCase();
                return addr.includes(q) || req.includes(q) || id.includes(q) || subj.includes(q);
            })
            : geocodedTickets;

        filteredGeo.forEach(item => {
            const existing = groups.find(g => getDistanceMeters(g.lat, g.lng, item.lat, item.lng) <= 35);
            if (existing) {
                existing.items.push(item);
            } else {
                groups.push({
                    id: `loc-${item.lat.toFixed(5)}-${item.lng.toFixed(5)}`,
                    lat: item.lat,
                    lng: item.lng,
                    primaryAddress: item.address,
                    items: [item]
                });
            }
        });
        return groups;
    }, [geocodedTickets, zoneSearch]);

    // Fit bounds when groups change
    useEffect(() => {
        if (!map || !window.google?.maps) return;
        const allPoints = [
            ...locationGroups.map(g => ({ lat: g.lat, lng: g.lng })),
            ...driverMarkers.map(d => ({ lat: d.lat, lng: d.lng }))
        ];
        if (allPoints.length === 1) {
            map.setCenter(allPoints[0]);
            map.setZoom(14);
        } else if (allPoints.length > 1) {
            const bounds = new window.google.maps.LatLngBounds();
            allPoints.forEach(p => bounds.extend(p));
            map.fitBounds(bounds);
        }
    }, [map, locationGroups.length, driverMarkers.length]);

    // Keep selectedGroup updated if items or selection changes
    const activeGroup = useMemo(() => {
        if (!selectedGroup) return null;
        return locationGroups.find(g => g.id === selectedGroup.id) || selectedGroup;
    }, [selectedGroup, locationGroups]);

    // Compute nearby services within proximityRadiusKm of activeGroup
    const nearbyItems = useMemo(() => {
        if (!activeGroup || activeGroup.type === 'driver') return [];
        const maxMeters = proximityRadiusKm * 1000;
        const list = [];
        locationGroups.forEach(g => {
            const dist = getDistanceMeters(activeGroup.lat, activeGroup.lng, g.lat, g.lng);
            if (dist <= maxMeters) {
                g.items.forEach(it => {
                    list.push({
                        ...it,
                        distanceMeters: dist,
                        isSameSpot: g.id === activeGroup.id
                    });
                });
            }
        });
        list.sort((a, b) => a.distanceMeters - b.distanceMeters);
        return list;
    }, [activeGroup, locationGroups, proximityRadiusKm]);

    const getGroupColor = (group) => {
        const firstTicket = group.items[0]?.ticket;
        if (!firstTicket) return '#3b82f6';

        // Highlight in purple if all tickets in this group are selected
        if (selectedTickets && selectedTickets.length > 0) {
            const allSelected = group.items.every(it => selectedTickets.includes(it.ticket.id));
            if (allSelected) return '#7c3aed';
        }

        if (colorMode === 'srv') {
            const srv = getSrvBadge(firstTicket);
            return srv.color;
        }

        const status = String(
            firstTicket.status ||
            firstTicket.logistics?.status ||
            firstTicket.displayStatus ||
            firstTicket.deliveryStatus ||
            'Pendiente'
        );
        const sLower = status.toLowerCase();
        if (sLower.includes('bloqueado') || sLower.includes('espera')) return '#ef4444';
        if (sLower.includes('progreso') || sLower.includes('transito')) return '#3b82f6';
        if (sLower.includes('resuelto') || sLower.includes('entregado') || sLower.includes('cerrado')) return '#22c55e';
        if (sLower.includes('coordinar')) return '#f97316';
        return '#eab308'; // Pendiente (Ámbar)
    };

    if (loadError || initError) {
        return <div style={{ padding: '2rem', color: 'red' }}>Error cargando el mapa: {initError || loadError?.message}</div>;
    }

    if (!process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY) {
        return <div style={{ padding: '2rem', color: 'orange' }}>Falta API Key de Google Maps.</div>;
    }

    if (!isLoaded) {
        return <div style={{ display: 'flex', justifyContent: 'center', padding: '2rem' }}><Loader2 className="animate-spin" /></div>;
    }

    const mapHeight = isExpandedHeight ? '660px' : '480px';
    const selectedSet = new Set(selectedTickets || []);

    return (
        <div style={{ display: 'flex', flexDirection: 'column', borderRadius: '10px', overflow: 'hidden', border: '1px solid var(--border)', background: 'var(--surface)' }}>
            {/* Top Controls Bar */}
            <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '0.65rem 1rem',
                background: 'var(--background)',
                borderBottom: '1px solid var(--border)',
                flexWrap: 'wrap',
                gap: '0.75rem'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                    <div style={{ position: 'relative', minWidth: '220px' }}>
                        <Search size={14} style={{ position: 'absolute', left: '9px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
                        <input
                            type="text"
                            value={zoneSearch}
                            onChange={e => setZoneSearch(e.target.value)}
                            placeholder="Filtrar en el mapa (dirección, barrio, usuario)..."
                            style={{
                                width: '100%',
                                padding: '0.35rem 0.65rem 0.35rem 1.85rem',
                                fontSize: '0.78rem',
                                borderRadius: '6px',
                                border: '1px solid var(--border)',
                                backgroundColor: 'var(--surface)',
                                color: 'var(--text-main)',
                                outline: 'none'
                            }}
                        />
                    </div>

                    <div style={{ display: 'inline-flex', alignItems: 'center', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '6px', padding: '2px' }}>
                        <button
                            type="button"
                            onClick={() => setColorMode('status')}
                            style={{
                                padding: '3px 9px',
                                fontSize: '0.73rem',
                                fontWeight: 700,
                                borderRadius: '4px',
                                border: 'none',
                                cursor: 'pointer',
                                background: colorMode === 'status' ? '#8b5cf6' : 'transparent',
                                color: colorMode === 'status' ? 'white' : 'var(--text-secondary)'
                            }}
                        >
                            Color por Estado
                        </button>
                        <button
                            type="button"
                            onClick={() => setColorMode('srv')}
                            style={{
                                padding: '3px 9px',
                                fontSize: '0.73rem',
                                fontWeight: 700,
                                borderRadius: '4px',
                                border: 'none',
                                cursor: 'pointer',
                                background: colorMode === 'srv' ? '#8b5cf6' : 'transparent',
                                color: colorMode === 'srv' ? 'white' : 'var(--text-secondary)'
                            }}
                        >
                            Color por Tipo (ENT/REC)
                        </button>
                    </div>

                    {enableProximityTools && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
                            <span>Radio de proximidad:</span>
                            {[1, 2, 3, 5, 10].map(km => (
                                <button
                                    key={km}
                                    type="button"
                                    onClick={() => setProximityRadiusKm(km)}
                                    style={{
                                        padding: '2px 7px',
                                        fontSize: '0.72rem',
                                        fontWeight: 700,
                                        borderRadius: '5px',
                                        border: proximityRadiusKm === km ? '1px solid #2563eb' : '1px solid var(--border)',
                                        background: proximityRadiusKm === km ? '#eff6ff' : 'var(--surface)',
                                        color: proximityRadiusKm === km ? '#1d4ed8' : 'var(--text-secondary)',
                                        cursor: 'pointer'
                                    }}
                                >
                                    {km} km
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                    <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
                        📍 {geocodedTickets.length} servicios ubicados en {locationGroups.length} puntos
                    </span>
                    <button
                        type="button"
                        onClick={() => setIsExpandedHeight(prev => !prev)}
                        style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            padding: '4px 8px',
                            fontSize: '0.73rem',
                            fontWeight: 700,
                            borderRadius: '6px',
                            border: '1px solid var(--border)',
                            background: 'var(--surface)',
                            color: 'var(--text-main)',
                            cursor: 'pointer'
                        }}
                        title={isExpandedHeight ? 'Reducir altura del mapa' : 'Ampliar altura del mapa'}
                    >
                        {isExpandedHeight ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
                        {isExpandedHeight ? 'Reducir' : 'Ampliar Mapa'}
                    </button>
                </div>
            </div>

            {/* Main Map + Side Proximity Panel */}
            <div style={{ display: 'grid', gridTemplateColumns: enableProximityTools && activeGroup && activeGroup.type !== 'driver' ? '1fr 370px' : '1fr', position: 'relative' }} className="flex-mobile-column">
                <div style={{ position: 'relative' }}>
                    {geocoding && (
                        <div style={{
                            position: 'absolute',
                            top: 12,
                            left: '50%',
                            transform: 'translateX(-50%)',
                            zIndex: 10,
                            background: 'rgba(15, 23, 42, 0.88)',
                            color: 'white',
                            padding: '6px 14px',
                            borderRadius: '20px',
                            boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            fontSize: '0.78rem',
                            fontWeight: 600
                        }}>
                            <Loader2 size={15} className="animate-spin" />
                            <span>
                                Geolocalizando direcciones ({geocodeProgress.done}/{geocodeProgress.total})...
                            </span>
                        </div>
                    )}

                    <GoogleMap
                        mapContainerStyle={{ width: '100%', height: mapHeight }}
                        center={defaultCenter}
                        zoom={12}
                        onLoad={onLoad}
                        onUnmount={onUnmount}
                        options={{
                            styles: minimalistStyles,
                            disableDefaultUI: false,
                            mapTypeControl: false,
                            streetViewControl: false,
                            fullscreenControl: true,
                            zoomControl: true,
                            gestureHandling: 'greedy'
                        }}
                    >
                        {/* Proximity radius circle around selected point */}
                        {enableProximityTools && activeGroup && activeGroup.type !== 'driver' && (
                            <Circle
                                center={{ lat: activeGroup.lat, lng: activeGroup.lng }}
                                radius={proximityRadiusKm * 1000}
                                options={{
                                    fillColor: '#3b82f6',
                                    fillOpacity: 0.08,
                                    strokeColor: '#2563eb',
                                    strokeOpacity: 0.45,
                                    strokeWeight: 1.5,
                                    clickable: false
                                }}
                            />
                        )}

                        {/* Driver Markers */}
                        {driverMarkers.map(dm => (
                            <Marker
                                key={dm.id}
                                position={{ lat: dm.lat, lng: dm.lng }}
                                onClick={() => setSelectedGroup(dm)}
                                title={dm.title}
                                icon={{
                                    path: "M1 3h14v2H1zm16 8H1V5h12v2h4v4zM1 18h2.5c0 1.93 1.57 3.5 3.5 3.5S10.5 19.93 10.5 18h3c0 1.93 1.57 3.5 3.5 3.5s3.5-1.57 3.5-3.5H23v-6l-3-4h-5V5c0-1.1-.9-2-2-2H1c-1.1 0-2 .9-2 2v13h2zm6 0c0 .83-.67 1.5-1.5 1.5S4 18.83 4 18s.67-1.5 1.5-1.5 1.5.67 1.5 1.5zm11.5 1.5c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zM17 9h4l1.3 2H17V9z",
                                    fillColor: "#1e293b",
                                    fillOpacity: 1,
                                    strokeColor: "#ffffff",
                                    strokeWeight: 1.5,
                                    scale: 1.5,
                                    anchor: new window.google.maps.Point(10, 15)
                                }}
                            />
                        ))}

                        {/* Location Group Markers */}
                        {locationGroups.map(group => {
                            const count = group.items.length;
                            const fillColor = getGroupColor(group);
                            const isGroupSelected = activeGroup && activeGroup.id === group.id;

                            return (
                                <Marker
                                    key={group.id}
                                    position={{ lat: group.lat, lng: group.lng }}
                                    onClick={() => setSelectedGroup(group)}
                                    title={`${group.primaryAddress} (${count} ${count === 1 ? 'servicio' : 'servicios'})`}
                                    label={count > 1 ? {
                                        text: String(count),
                                        color: '#ffffff',
                                        fontSize: '11px',
                                        fontWeight: '900'
                                    } : undefined}
                                    icon={{
                                        path: count > 1
                                            ? window.google.maps.SymbolPath.CIRCLE
                                            : "M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z",
                                        fillColor,
                                        fillOpacity: 1,
                                        strokeColor: isGroupSelected ? "#0f172a" : "#ffffff",
                                        strokeWeight: isGroupSelected ? 3 : 2,
                                        scale: count > 1 ? Math.min(18, 11 + count) : (isGroupSelected ? 1.85 : 1.55),
                                        anchor: count > 1 ? new window.google.maps.Point(0, 0) : new window.google.maps.Point(12, 22)
                                    }}
                                />
                            );
                        })}

                        {/* InfoWindow on Map */}
                        {activeGroup && (
                            <InfoWindow
                                position={{ lat: activeGroup.lat, lng: activeGroup.lng }}
                                onCloseClick={() => setSelectedGroup(null)}
                                options={{ pixelOffset: new window.google.maps.Size(0, -12), disableAutoPan: false }}
                            >
                                <div style={{ color: '#0f172a', padding: '4px', maxWidth: '280px', maxHeight: '260px', overflowY: 'auto' }}>
                                    {activeGroup.type === 'driver' ? (
                                        <div>
                                            <h4 style={{ margin: '0 0 4px 0', fontSize: '13px', fontWeight: 800 }}>🚛 {activeGroup.details.name}</h4>
                                            <p style={{ margin: 0, fontSize: '11px', color: '#64748b' }}>
                                                Última señal: {activeGroup.details.last_location_update ? new Date(activeGroup.details.last_location_update).toLocaleTimeString() : 'Desconocido'}
                                            </p>
                                        </div>
                                    ) : (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                            <div style={{ borderBottom: '1px solid #e2e8f0', paddingBottom: '5px' }}>
                                                <div style={{ fontSize: '11px', fontWeight: 800, color: '#2563eb' }}>
                                                    📍 {activeGroup.items.length} {activeGroup.items.length === 1 ? 'SERVICIO EN ESTE PUNTO' : 'SERVICIOS EN ESTE PUNTO'}
                                                </div>
                                                <div style={{ fontSize: '11.5px', fontWeight: 700, color: '#1e293b', marginTop: '2px' }}>
                                                    {activeGroup.primaryAddress}
                                                </div>
                                            </div>

                                            {activeGroup.items.map(({ ticket }) => {
                                                const tId = ticket.id || ticket.displayId;
                                                const srv = getSrvBadge(ticket);
                                                const isChecked = selectedSet.has(ticket.id);
                                                return (
                                                    <div
                                                        key={tId}
                                                        style={{
                                                            padding: '6px',
                                                            borderRadius: '6px',
                                                            background: isChecked ? '#f5f3ff' : '#f8fafc',
                                                            border: isChecked ? '1px solid #8b5cf6' : '1px solid #e2e8f0',
                                                            display: 'flex',
                                                            flexDirection: 'column',
                                                            gap: '3px'
                                                        }}
                                                    >
                                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '6px' }}>
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                                                                {onToggleSelectTicket && (
                                                                    <input
                                                                        type="checkbox"
                                                                        checked={isChecked}
                                                                        onChange={() => onToggleSelectTicket(ticket.id)}
                                                                        style={{ cursor: 'pointer', width: '14px', height: '14px' }}
                                                                    />
                                                                )}
                                                                <span style={{ fontWeight: 800, fontSize: '11.5px', color: '#0f172a' }}>{tId}</span>
                                                            </div>
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                                <span style={{
                                                                    fontSize: '9.5px',
                                                                    fontWeight: 800,
                                                                    padding: '1px 5px',
                                                                    borderRadius: '4px',
                                                                    background: srv.bg,
                                                                    color: srv.color
                                                                }}>
                                                                    {srv.label}
                                                                </span>
                                                                <span style={{
                                                                    fontSize: '9.5px',
                                                                    fontWeight: 700,
                                                                    padding: '1px 5px',
                                                                    borderRadius: '4px',
                                                                    background: '#e2e8f0',
                                                                    color: '#334155'
                                                                }}>
                                                                    {ticket.status || ticket.displayStatus || 'Pendiente'}
                                                                </span>
                                                            </div>
                                                        </div>
                                                        <div style={{ fontSize: '11.5px', fontWeight: 700, color: '#1e293b' }}>
                                                            {ticket.requester || 'Sin Solicitante'}
                                                        </div>
                                                        <div style={{ fontSize: '10.5px', color: '#475569', lineHeight: 1.25 }}>
                                                            {ticket.subject || ticket.displaySubject}
                                                        </div>
                                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '2px' }}>
                                                            <a
                                                                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(getTicketAddress(ticket))}`}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                style={{ fontSize: '10.5px', color: '#64748b', textDecoration: 'underline' }}
                                                            >
                                                                Abrir en Google Maps
                                                            </a>
                                                            <Link
                                                                href={`/dashboard/tickets/${String(tId).replace('task-', '')}`}
                                                                style={{ fontSize: '11px', fontWeight: 700, color: '#2563eb', textDecoration: 'none' }}
                                                            >
                                                                Ver Detalles →
                                                            </Link>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            </InfoWindow>
                        )}
                    </GoogleMap>
                </div>

                {/* Right Proximity Panel (shown when enableProximityTools is true and a pin is clicked) */}
                {enableProximityTools && activeGroup && activeGroup.type !== 'driver' && (
                    <div style={{
                        borderLeft: '1px solid var(--border)',
                        background: 'var(--surface)',
                        display: 'flex',
                        flexDirection: 'column',
                        height: mapHeight,
                        overflow: 'hidden'
                    }}>
                        <div style={{
                            padding: '0.75rem 0.9rem',
                            background: 'var(--background)',
                            borderBottom: '1px solid var(--border)',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '0.45rem'
                        }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span style={{ fontSize: '0.72rem', fontWeight: 800, color: '#2563eb', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                                    📍 Zona de Proximidad ({proximityRadiusKm} km)
                                </span>
                                <button
                                    type="button"
                                    onClick={() => setSelectedGroup(null)}
                                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', fontWeight: 800, fontSize: '0.85rem' }}
                                >
                                    ✕
                                </button>
                            </div>
                            <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-main)', lineHeight: 1.25 }}>
                                {activeGroup.primaryAddress}
                            </div>
                            <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)' }}>
                                <strong>{nearbyItems.length}</strong> servicio(s) encontrados dentro de <strong>{proximityRadiusKm} km</strong>
                            </div>

                            {onSelectMultipleTickets && nearbyItems.length > 0 && (
                                <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginTop: '2px' }}>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            const ids = nearbyItems.map(it => it.ticket.id).filter(Boolean);
                                            onSelectMultipleTickets(ids, true);
                                        }}
                                        style={{
                                            flex: 1,
                                            padding: '5px 8px',
                                            fontSize: '0.73rem',
                                            fontWeight: 700,
                                            borderRadius: '6px',
                                            border: '1px solid #8b5cf6',
                                            background: '#8b5cf6',
                                            color: 'white',
                                            cursor: 'pointer'
                                        }}
                                    >
                                        ✓ Seleccionar Zona ({nearbyItems.length})
                                    </button>
                                    {onFilterBySelection && (
                                        <button
                                            type="button"
                                            onClick={() => {
                                                const ids = nearbyItems.map(it => it.ticket.id).filter(Boolean);
                                                onSelectMultipleTickets(ids, true);
                                                onFilterBySelection(ids);
                                            }}
                                            style={{
                                                padding: '5px 8px',
                                                fontSize: '0.73rem',
                                                fontWeight: 700,
                                                borderRadius: '6px',
                                                border: '1px solid #2563eb',
                                                background: '#eff6ff',
                                                color: '#1d4ed8',
                                                cursor: 'pointer'
                                            }}
                                        >
                                            Ver en Tabla
                                        </button>
                                    )}
                                </div>
                            )}
                        </div>

                        <div style={{ flex: 1, overflowY: 'auto', padding: '0.65rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                            {nearbyItems.map(({ ticket, address, distanceMeters, isSameSpot }) => {
                                const srv = getSrvBadge(ticket);
                                const isChecked = selectedSet.has(ticket.id);
                                return (
                                    <div
                                        key={ticket.id}
                                        style={{
                                            padding: '0.55rem 0.65rem',
                                            borderRadius: '8px',
                                            border: isChecked ? '1.5px solid #8b5cf6' : '1px solid var(--border)',
                                            background: isChecked ? 'rgba(139, 92, 246, 0.06)' : 'var(--background)',
                                            display: 'flex',
                                            flexDirection: 'column',
                                            gap: '3px'
                                        }}
                                    >
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                {onToggleSelectTicket && (
                                                    <input
                                                        type="checkbox"
                                                        checked={isChecked}
                                                        onChange={() => onToggleSelectTicket(ticket.id)}
                                                        style={{ cursor: 'pointer', width: '14px', height: '14px' }}
                                                    />
                                                )}
                                                <span style={{ fontWeight: 800, fontSize: '0.78rem', color: 'var(--text-main)' }}>
                                                    {ticket.id}
                                                </span>
                                                <span style={{
                                                    fontSize: '0.65rem',
                                                    fontWeight: 800,
                                                    padding: '1px 5px',
                                                    borderRadius: '4px',
                                                    background: srv.bg,
                                                    color: srv.color
                                                }}>
                                                    {srv.label}
                                                </span>
                                            </div>
                                            <span style={{
                                                fontSize: '0.68rem',
                                                fontWeight: 700,
                                                padding: '1px 6px',
                                                borderRadius: '999px',
                                                background: isSameSpot ? '#dcfce7' : '#e0f2fe',
                                                color: isSameSpot ? '#15803d' : '#0369a1'
                                            }}>
                                                {formatDistance(distanceMeters)}
                                            </span>
                                        </div>

                                        <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-main)' }}>
                                            {ticket.requester || 'Sin Solicitante'}
                                        </div>
                                        <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={ticket.subject}>
                                            {ticket.subject}
                                        </div>
                                        <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                            <MapPin size={11} style={{ flexShrink: 0 }} />
                                            <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={address}>
                                                {address}
                                            </span>
                                        </div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '2px' }}>
                                            <span style={{ fontSize: '0.68rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                                                {ticket.status}
                                            </span>
                                            <Link
                                                href={`/dashboard/tickets/${ticket.id}`}
                                                style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--primary-color)', textDecoration: 'none' }}
                                            >
                                                Abrir Servicio →
                                            </Link>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}
            </div>

            {/* Bottom Legend */}
            <div style={{
                display: 'flex',
                gap: '1.25rem',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '0.6rem 1rem',
                backgroundColor: 'var(--background)',
                borderTop: '1px solid var(--border)',
                fontSize: '0.75rem',
                fontWeight: 600,
                color: 'var(--text-secondary)',
                flexWrap: 'wrap'
            }}>
                <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
                    {colorMode === 'status' ? (
                        <>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                                <span style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#eab308', display: 'inline-block' }}></span>
                                <span>Pendiente</span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                                <span style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#3b82f6', display: 'inline-block' }}></span>
                                <span>En Progreso / Tránsito</span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                                <span style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#ef4444', display: 'inline-block' }}></span>
                                <span>Bloqueado / A la Espera</span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                                <span style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#22c55e', display: 'inline-block' }}></span>
                                <span>Resuelto / Entregado</span>
                            </div>
                        </>
                    ) : (
                        <>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                                <span style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#16a34a', display: 'inline-block' }}></span>
                                <span>ENT (Entrega)</span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                                <span style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#dc2626', display: 'inline-block' }}></span>
                                <span>REC (Retiro / Recolección)</span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                                <span style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#ea580c', display: 'inline-block' }}></span>
                                <span>REE (Reemplazo)</span>
                            </div>
                        </>
                    )}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                        <span style={{ width: '14px', height: '14px', borderRadius: '50%', backgroundColor: '#334155', color: 'white', fontSize: '9px', fontWeight: 900, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>2+</span>
                        <span>Múltiples servicios en misma ubicación</span>
                    </div>
                </div>
                {enableProximityTools && (
                    <span style={{ fontSize: '0.72rem', color: '#2563eb' }}>
                        💡 Tocá cualquier pin para ver y seleccionar todos los servicios cercanos por radio de proximidad
                    </span>
                )}
            </div>
        </div>
    );
}
