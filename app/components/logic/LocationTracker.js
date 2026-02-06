"use client";
import { useEffect, useRef } from 'react';
import { useStore } from '../../../lib/store';
import { supabase } from '../../../lib/supabase';

export function LocationTracker() {
    const { currentUser } = useStore();
    const watchIdRef = useRef(null);
    const lastUpdateRef = useRef(0);

    useEffect(() => {
        // Only track if user exists and tracking is enabled
        if (!currentUser || !currentUser.tracking_enabled) {
            if (watchIdRef.current) {
                navigator.geolocation.clearWatch(watchIdRef.current);
                watchIdRef.current = null;
                console.log("GPS Tracking stopped (disabled/logged out)");
            }
            return;
        }

        console.log("GPS Tracking started for:", currentUser.name);

        const handlePosition = async (position) => {
            const now = Date.now();
            // Throttle updates: Max once per 60 seconds to save battery and DB writes
            if (now - lastUpdateRef.current < 60000) {
                return;
            }

            const { latitude, longitude } = position.coords;
            console.log("Sending Location Update:", latitude, longitude);

            try {
                // Direct Supabase call to avoid excessive store re-renders if we used updateUser
                // We just want to push the location to the server.
                const { error } = await supabase
                    .from('users')
                    .update({
                        location_latitude: latitude,
                        location_longitude: longitude,
                        last_location_update: new Date().toISOString()
                    })
                    .eq('id', currentUser.id);

                if (error) {
                    console.error("Error updating location:", error);
                } else {
                    lastUpdateRef.current = now;
                }
            } catch (err) {
                console.error("Exception updating location:", err);
            }
        };

        const handleError = (error) => {
            console.warn("GPS Error:", error.message);
        };

        // Start watching
        if ('geolocation' in navigator) {
            watchIdRef.current = navigator.geolocation.watchPosition(
                handlePosition,
                handleError,
                {
                    enableHighAccuracy: true,
                    timeout: 20000,
                    maximumAge: 1000
                }
            );
        } else {
            console.error("Geolocation not supported");
        }

        return () => {
            if (watchIdRef.current) {
                navigator.geolocation.clearWatch(watchIdRef.current);
            }
        };
    }, [currentUser?.id, currentUser?.tracking_enabled]); // Re-run if ID or tracking status changes

    return null; // Component renderless
}
