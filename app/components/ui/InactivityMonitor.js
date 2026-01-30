"use client";
import { useState, useEffect, useRef, useCallback } from 'react';
import { useStore } from '../../../lib/store';
import { Button } from './Button';
import { Modal } from './Modal';
import { Timer } from 'lucide-react';

// Configuration
const INACTIVITY_LIMIT_MS = 5 * 60 * 1000; // 5 minutes
const WARNING_DURATION_MS = 10 * 1000; // 10 seconds warning
const CHECK_INTERVAL_MS = 1000; // Check every second

export function InactivityMonitor() {
    const { currentUser, logout } = useStore();
    const [lastActivity, setLastActivity] = useState(Date.now());
    const [showWarning, setShowWarning] = useState(false);
    const [timeLeft, setTimeLeft] = useState(WARNING_DURATION_MS / 1000);
    const logoutTimerRef = useRef(null);

    // Reset inactivity timer on user user interaction
    const resetTimer = useCallback(() => {
        setLastActivity(Date.now());
        if (showWarning) {
            setShowWarning(false);
            if (logoutTimerRef.current) clearTimeout(logoutTimerRef.current);
        }
    }, [showWarning]);

    // Setup event listeners for user activity
    useEffect(() => {
        if (!currentUser) return;

        const events = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart'];

        // Throttled handler to improve performance
        let throttleTimer;
        const handleActivity = () => {
            if (!throttleTimer) {
                throttleTimer = setTimeout(() => {
                    resetTimer();
                    throttleTimer = null;
                }, 1000); // Only update state at most once per second
            }
        };

        events.forEach(event => document.addEventListener(event, handleActivity));

        return () => {
            events.forEach(event => document.removeEventListener(event, handleActivity));
            if (throttleTimer) clearTimeout(throttleTimer);
        };
    }, [currentUser, resetTimer]);

    // Check for inactivity interval
    useEffect(() => {
        if (!currentUser) return;

        const interval = setInterval(() => {
            const now = Date.now();
            const timeSinceLastActivity = now - lastActivity;

            // If we exceeded the limit but haven't shown warning yet
            if (timeSinceLastActivity >= INACTIVITY_LIMIT_MS && !showWarning) {
                setShowWarning(true);
            }

            // Update remaining time for the warning countdown
            if (showWarning) {
                const totalElapsedTime = timeSinceLastActivity - INACTIVITY_LIMIT_MS;
                const remaining = Math.max(0, Math.ceil((WARNING_DURATION_MS - totalElapsedTime) / 1000));

                setTimeLeft(remaining);

                if (remaining <= 0) {
                    handleLogout();
                }
            }
        }, CHECK_INTERVAL_MS);

        return () => clearInterval(interval);
    }, [currentUser, lastActivity, showWarning]);

    const handleLogout = () => {
        // Clear everything and logout
        setShowWarning(false);
        logout();
        window.location.href = '/'; // Force redirect to login
    };

    const handleStayLoggedIn = () => {
        resetTimer();
        setShowWarning(false);
    };

    if (!showWarning) return null;

    return (
        <div style={{
            position: 'fixed',
            top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.7)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backdropFilter: 'blur(4px)'
        }}>
            <div style={{
                background: 'var(--surface)',
                padding: '2rem',
                borderRadius: '12px',
                width: '100%',
                maxWidth: '400px',
                textAlign: 'center',
                boxShadow: '0 10px 25px rgba(0,0,0,0.2)',
                border: '1px solid var(--border)'
            }}>
                <div style={{
                    width: '60px',
                    height: '60px',
                    background: 'rgba(239, 68, 68, 0.1)',
                    color: '#ef4444',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    margin: '0 auto 1.5rem auto'
                }}>
                    <Timer size={32} />
                </div>

                <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.5rem', color: 'var(--text-main)' }}>
                    ¿Sigues ahí?
                </h3>

                <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
                    Tu sesión se cerrará automáticamente en <strong style={{ color: '#ef4444', fontSize: '1.1em' }}>{timeLeft}</strong> segundos por inactividad.
                </p>

                <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
                    <Button
                        variant="secondary"
                        onClick={handleLogout}
                        style={{ width: '100px' }}
                    >
                        Salir
                    </Button>
                    <Button
                        onClick={handleStayLoggedIn}
                        style={{ width: '140px', backgroundColor: 'var(--primary-color)', color: 'white' }}
                    >
                        Continuar
                    </Button>
                </div>
            </div>
        </div>
    );
}
