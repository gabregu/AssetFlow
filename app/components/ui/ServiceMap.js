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

export function ServiceMap({ tickets = [] }) {
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

            // We filter tickets that actually have an address
            const validTickets = tickets.filter(t => t.logistics?.address && t.logistics.address.length > 5);
            console.log('ServiceMap: Valid tickets for geocoding:', validTickets.length);

            // Simple implementation: process sequentially to be nice to the API
            // In a real production app, you should cache these lat/lng in your database
            for (const ticket of validTickets) {
                try {
                    const result = await new Promise((resolve, reject) => {
                        geocoder.geocode({ address: ticket.logistics.address }, (results, status) => {
                            if (status === 'OK' && results[0]) {
                                resolve(results[0]);
                            } else {
                                reject(status);
                            }
                        });
                    });

                    newMarkers.push({
                        id: ticket.id,
                        lat: result.geometry.location.lat(),
                        lng: result.geometry.location.lng(),
                        title: ticket.subject,
                        details: ticket
                    });
                } catch (error) {
                    console.error(`Error geocoding ${ticket.id}:`, error);
                }
                // Small delay to avoid OVER_QUERY_LIMIT in rapid succession
                await new Promise(r => setTimeout(r, 200));
            }

            console.log('ServiceMap: Markers created:', newMarkers.length);
            setMarkers(newMarkers);
            setGeocoding(false);

            // Fit bounds if markers exist
            if (newMarkers.length > 0 && map) {
                const bounds = new window.google.maps.LatLngBounds();
                newMarkers.forEach(m => bounds.extend({ lat: m.lat, lng: m.lng }));
                map.fitBounds(bounds);
            }
        };

        geocodeTickets();
    }, [isLoaded, tickets, map, loadError]);

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
                    />
                ))}

                {selectedMarker && (
                    <InfoWindow
                        position={{ lat: selectedMarker.lat, lng: selectedMarker.lng }}
                        onCloseClick={() => setSelectedMarker(null)}
                    >
                        <div style={{ color: '#000', padding: '5px', maxWidth: '200px' }}>
                            <h4 style={{ margin: '0 0 5px 0', fontSize: '14px', fontWeight: 'bold' }}>#{selectedMarker.details.id}</h4>
                            <p style={{ margin: '0 0 5px 0', fontSize: '12px' }}>{selectedMarker.details.subject}</p>
                            <p style={{ margin: '0', fontSize: '11px', color: '#666' }}>📍 {selectedMarker.details.logistics?.address}</p>
                            <a href={`/dashboard/tickets/${selectedMarker.details.id}`} style={{ display: 'block', marginTop: '8px', fontSize: '12px', color: '#2563eb' }}>Ver Ticket</a>
                        </div>
                    </InfoWindow>
                )}
            </GoogleMap>
        </div>
    );
}
