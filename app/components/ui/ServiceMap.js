import React, { useState, useEffect, useCallback } from 'react';
import { GoogleMap, useJsApiLoader, Marker, InfoWindow } from '@react-google-maps/api';
import { Loader2 } from 'lucide-react';

const containerStyle = {
    width: '100%',
    height: '500px'
};

const centerDefault = {
    lat: -34.603722,
    lng: -58.381592 // Buenos Aires
};

export function ServiceMap({ tickets = [], drivers = [] }) {
    const { isLoaded, loadError } = useJsApiLoader({
        id: 'google-map-script',
        googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY,
        libraries: ['geometry'] // Must match the loader options used in parent pages
    });

    const [map, setMap] = useState(null);
    const [markers, setMarkers] = useState([]);
    const [selectedMarker, setSelectedMarker] = useState(null);
    const [geocoding, setGeocoding] = useState(false);
    const [initError, setInitError] = useState(null);

    const onLoad = useCallback(function callback(map) {
        setMap(map);
    }, []);

    const onUnmount = useCallback(function callback(map) {
        setMap(null);
    }, []);

    useEffect(() => {
        // Debug logging
        console.log('ServiceMap: Rendering', {
            ticketsCount: tickets.length,
            isLoaded,
            hasApiKey: !!process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
        });

        if (loadError) {
            console.error('ServiceMap: Load Error', loadError);
            setInitError(loadError.message);
        }

        if (!isLoaded || tickets.length === 0) return;

        const geocodeTickets = async () => {
            setGeocoding(true);
            const geocoder = new window.google.maps.Geocoder();
            const newMarkers = [];

            // 1. Add Drivers (Instant, no geocoding needed)
            if (drivers && drivers.length > 0) {
                drivers.forEach(d => {
                    if (d.location_latitude && d.location_longitude) {
                        newMarkers.push({
                            id: `driver-${d.id}`,
                            lat: d.location_latitude,
                            lng: d.location_longitude,
                            title: `Conductor: ${d.name}`,
                            type: 'driver',
                            details: d,
                            icon: {
                                path: "M1 3h14v2H1zm16 8H1V5h12v2h4v4zM1 18h2.5c0 1.93 1.57 3.5 3.5 3.5S10.5 19.93 10.5 18h3c0 1.93 1.57 3.5 3.5 3.5s3.5-1.57 3.5-3.5H23v-6l-3-4h-5V5c0-1.1-.9-2-2-2H1c-1.1 0-2 .9-2 2v13h2zm6 0c0 .83-.67 1.5-1.5 1.5S4 18.83 4 18s.67-1.5 1.5-1.5 1.5.67 1.5 1.5zm11.5 1.5c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zM17 9h4l1.3 2H17V9z", // Simple Truck Path
                                fillColor: "#2563eb",
                                fillOpacity: 1,
                                strokeColor: "#ffffff",
                                strokeWeight: 2,
                                scale: 1.2,
                                anchor: new window.google.maps.Point(0, 20)
                            }
                        });
                    }
                });
            }

            // 2. Geocode Tickets (if any)
            const validTickets = tickets.filter(t => t.logistics?.address && t.logistics.address.length > 5);

            for (const ticket of validTickets) {
                try {
                    const result = await new Promise((resolve, reject) => {
                        geocoder.geocode({ address: ticket.logistics.address }, (results, status) => {
                            if (status === 'OK' && results[0]) resolve(results[0]);
                            else reject(status);
                        });
                    });

                    const isAssigned = ticket.logistics && ticket.logistics.deliveryPerson;
                    const markerColor = isAssigned ? "#16a34a" : "#ef4444"; // Green vs Red

                    newMarkers.push({
                        id: ticket.id,
                        lat: result.geometry.location.lat(),
                        lng: result.geometry.location.lng(),
                        title: ticket.subject,
                        type: 'ticket',
                        details: ticket,
                        icon: {
                            path: "M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z",
                            fillColor: markerColor,
                            fillOpacity: 1,
                            strokeColor: "#ffffff",
                            strokeWeight: 2,
                            scale: 1.5,
                            anchor: new window.google.maps.Point(12, 22)
                        }
                    });
                } catch (error) {
                    console.error(`Error geocoding ${ticket.id}:`, error);
                }
                await new Promise(r => setTimeout(r, 200));
            }

            setMarkers(newMarkers);
            setGeocoding(false);

            if (newMarkers.length > 0 && map) {
                const bounds = new window.google.maps.LatLngBounds();
                newMarkers.forEach(m => bounds.extend({ lat: m.lat, lng: m.lng }));
                map.fitBounds(bounds);
            }
        };

        geocodeTickets();
    }, [isLoaded, tickets, drivers, map, loadError]);

    if (loadError || initError) {
        return <div style={{ padding: '2rem', color: 'red' }}>Error cargando el mapa: {initError || loadError?.message}</div>;
    }

    if (!process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY) {
        return <div style={{ padding: '2rem', color: 'orange' }}>Falta API Key. Reinicia el servidor si acabas de agregarla.</div>;
    }

    if (!isLoaded) {
        return <div style={{ display: 'flex', justifyContent: 'center', padding: '2rem' }}><Loader2 className="animate-spin" /></div>;
    }

    return (
        <div style={{ position: 'relative' }}>
            {geocoding && (
                <div style={{
                    position: 'absolute',
                    top: 10,
                    left: '50%',
                    transform: 'translateX(-50%)',
                    zIndex: 10,
                    background: 'rgba(255,255,255,0.9)',
                    padding: '5px 15px',
                    borderRadius: '20px',
                    boxShadow: '0 2px 5px rgba(0,0,0,0.2)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    fontSize: '0.85rem',
                    fontWeight: 600
                }}>
                    <Loader2 size={16} className="animate-spin" /> Cargando ubicaciones...
                </div>
            )}

            <GoogleMap
                mapContainerStyle={containerStyle}
                center={centerDefault}
                zoom={12}
                onLoad={onLoad}
                onUnmount={onUnmount}
            >
                {markers.map(marker => (
                    <Marker
                        key={marker.id}
                        position={{ lat: marker.lat, lng: marker.lng }}
                        onClick={() => setSelectedMarker(marker)}
                        title={marker.title}
                        icon={marker.icon}
                    />
                ))}

                {selectedMarker && (
                    <InfoWindow
                        position={{ lat: selectedMarker.lat, lng: selectedMarker.lng }}
                        onCloseClick={() => setSelectedMarker(null)}
                    >
                        <div style={{ color: '#000', padding: '5px', maxWidth: '200px' }}>
                            {selectedMarker.type === 'driver' ? (
                                <>
                                    <h4 style={{ margin: '0 0 5px 0', fontSize: '14px', fontWeight: 'bold' }}>🚛 {selectedMarker.details.name}</h4>
                                    <p style={{ margin: '0', fontSize: '11px', color: '#666' }}>
                                        Última señal: {selectedMarker.details.last_location_update ? new Date(selectedMarker.details.last_location_update).toLocaleTimeString() : 'Desconocido'}
                                    </p>
                                </>
                            ) : (
                                <>
                                    <h4 style={{ margin: '0 0 5px 0', fontSize: '14px', fontWeight: 'bold' }}>#{selectedMarker.details.id}</h4>
                                    <div style={{
                                        marginBottom: '6px',
                                        padding: '2px 6px',
                                        borderRadius: '4px',
                                        background: selectedMarker.details.logistics?.deliveryPerson ? '#dcfce7' : '#fee2e2',
                                        color: selectedMarker.details.logistics?.deliveryPerson ? '#166534' : '#991b1b',
                                        fontSize: '10px',
                                        fontWeight: '700',
                                        display: 'inline-block'
                                    }}>
                                        {selectedMarker.details.logistics?.deliveryPerson ? `Estad: ASIGNADO` : 'Estado: PENDIENTE'}
                                    </div>
                                    <p style={{ margin: '0 0 5px 0', fontSize: '12px' }}>{selectedMarker.details.subject}</p>
                                    <p style={{ margin: '0 0 5px 0', fontSize: '11px', color: '#666' }}>📍 {selectedMarker.details.logistics?.address}</p>
                                    {selectedMarker.details.logistics?.deliveryPerson && (
                                        <p style={{ margin: '0 0 5px 0', fontSize: '11px', fontWeight: 600 }}>👤 Conductor: {selectedMarker.details.logistics.deliveryPerson}</p>
                                    )}
                                    <a href={`/dashboard/tickets/${selectedMarker.details.id}`} style={{ display: 'block', marginTop: '8px', fontSize: '12px', color: '#2563eb' }}>Ver Ticket</a>
                                </>
                            )}
                        </div>
                    </InfoWindow>
                )}
            </GoogleMap>
        </div>
    );
}
