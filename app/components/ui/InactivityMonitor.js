"use client";
import { useState, useEffect, useRef, useCallback } from 'react';
import { useStore } from '../../../lib/store';
import { Button } from './Button';
import { Timer, LogOut } from 'lucide-react';

// Configuration
const INACTIVITY_LIMIT_MS = 15 * 60 * 1000; // 15 minutos de inactividad
const WARNING_DURATION_MS = 30 * 1000;        // 30 segundos de aviso
const STORAGE_KEY = 'assetflow_last_activity';

export function InactivityMonitor() {
    const { currentUser, logout } = useStore();
    const [showWarning, setShowWarning] = useState(false);
    const [timeLeft, setTimeLeft] = useState(WARNING_DURATION_MS / 1000);

    // ---- REFS para evitar stale closures en el interval ----
    const isLoggingOut = useRef(false);
    const showWarningRef = useRef(false);           // espejo de showWarning para leer dentro del interval
    const currentUserRef = useRef(currentUser);
    const logoutRef = useRef(logout);
    const intervalRef = useRef(null);

    // Mantener refs sincronizados con los valores mas recientes
    useEffect(() => { currentUserRef.current = currentUser; }, [currentUser]);
    useEffect(() => { logoutRef.current = logout; }, [logout]);
    useEffect(() => { showWarningRef.current = showWarning; }, [showWarning]);

    // ---- Helpers ----
    const getLastActivity = () => {
        const stored = localStorage.getItem(STORAGE_KEY);
        return stored ? parseInt(stored, 10) : Date.now();
    };

    const updateActivity = useCallback(() => {
        if (isLoggingOut.current) return;
        localStorage.setItem(STORAGE_KEY, Date.now().toString());
        setShowWarning(false);
        showWarningRef.current = false;
    }, []);

    const handleLogout = useCallback(async () => {
        if (isLoggingOut.current) return;
        isLoggingOut.current = true;

        console.log("[InactivityMonitor] Auto-logout iniciado.");
        setShowWarning(false);
        showWarningRef.current = false;

        if (intervalRef.current) clearInterval(intervalRef.current);

        try {
            await logoutRef.current();
        } catch (e) {
            console.error("[InactivityMonitor] Error en logout:", e);
        } finally {
            localStorage.removeItem(STORAGE_KEY);
            window.location.href = '/';
        }
    }, []);

    // ---- Activity listeners ----
    useEffect(() => {
        if (!currentUser) return;

        // Inicializar actividad en localStorage si no existe
        if (!localStorage.getItem(STORAGE_KEY)) {
            localStorage.setItem(STORAGE_KEY, Date.now().toString());
        }

        const activityEvents = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart', 'click'];

        let throttleTimer = null;
        const throttledUpdate = () => {
            if (throttleTimer) return;
            throttleTimer = setTimeout(() => {
                updateActivity();
                throttleTimer = null;
            }, 2000);
        };

        activityEvents.forEach(e => window.addEventListener(e, throttledUpdate, { passive: true }));

        return () => {
            activityEvents.forEach(e => window.removeEventListener(e, throttledUpdate));
            if (throttleTimer) clearTimeout(throttleTimer);
        };
    }, [currentUser, updateActivity]);

    // ---- Interval principal de chequeo ----
    // CLAVE: `tick` lee de refs, no de closures de React state, asi que NUNCA queda stale.
    const tick = useCallback(() => {
        if (!currentUserRef.current || isLoggingOut.current) return;

        const now = Date.now();
        const diff = now - getLastActivity();

        if (diff >= INACTIVITY_LIMIT_MS + WARNING_DURATION_MS) {
            // El aviso ya expiro tambien -> logout directo
            handleLogout();
        } else if (diff >= INACTIVITY_LIMIT_MS) {
            // En periodo de gracia
            const remaining = Math.max(0, Math.ceil((WARNING_DURATION_MS - (diff - INACTIVITY_LIMIT_MS)) / 1000));
            setTimeLeft(remaining);

            if (!showWarningRef.current) {
                setShowWarning(true);
                showWarningRef.current = true;
            }

            if (remaining <= 0) {
                handleLogout();
            }
        } else {
            // Usuario activo
            if (showWarningRef.current) {
                setShowWarning(false);
                showWarningRef.current = false;
            }
        }
    }, [handleLogout]);

    useEffect(() => {
        if (!currentUser) {
            if (intervalRef.current) clearInterval(intervalRef.current);
            return;
        }

        if (intervalRef.current) clearInterval(intervalRef.current);
        intervalRef.current = setInterval(tick, 1000);

        return () => {
            if (intervalRef.current) clearInterval(intervalRef.current);
        };
    }, [currentUser, tick]);

    // Visibilidad: cuando la pesta;a vuelve al frente, forzar chequeo inmediato
    useEffect(() => {
        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible') {
                tick();
            }
        };
        document.addEventListener('visibilitychange', handleVisibilityChange);
        return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
    }, [tick]);

    if (!showWarning) return null;

    return (
        <div style={{
            position: 'fixed',
            top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.85)',
            zIndex: 99999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backdropFilter: 'blur(8px)'
        }}>
            <div style={{
                background: 'var(--surface)',
                padding: '2.5rem',
                borderRadius: '20px',
                width: '90%',
                maxWidth: '420px',
                textAlign: 'center',
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                position: 'relative',
                overflow: 'hidden'
            }}>
                {/* Barra de progreso */}
                <div style={{
                    position: 'absolute',
                    top: 0, left: 0,
                    height: '4px',
                    background: '#ef4444',
                    width: `${(timeLeft / (WARNING_DURATION_MS / 1000)) * 100}%`,
                    transition: 'width 1s linear'
                }} />

                <div style={{
                    width: '70px', height: '70px',
                    background: 'rgba(239, 68, 68, 0.15)',
                    color: '#ef4444',
                    borderRadius: '20px',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    margin: '0 auto 1.5rem auto',
                    transform: 'rotate(-10deg)'
                }}>
                    <Timer size={36} />
                </div>

                <h3 style={{ fontSize: '1.5rem', fontWeight: 800, marginBottom: '0.75rem', color: 'var(--text-main)', letterSpacing: '-0.025em' }}>
                    ¿Sigues trabajando?
                </h3>

                <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem', lineHeight: '1.6' }}>
                    Por inactividad, tu sesión se cerrará en:<br />
                    <span style={{
                        color: '#ef4444',
                        fontSize: '2rem',
                        fontWeight: 800,
                        fontFamily: 'monospace',
                        display: 'inline-block',
                        margin: '0.5rem 0'
                    }}>
                        {timeLeft}s
                    </span>
                </p>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr', gap: '1rem' }}>
                    <Button
                        variant="ghost"
                        onClick={handleLogout}
                        icon={LogOut}
                        style={{ border: '1px solid var(--border)' }}
                    >
                        Cerrar sesión
                    </Button>
                    <Button
                        onClick={() => {
                            updateActivity();
                        }}
                        style={{
                            background: 'var(--primary-color)',
                            color: 'white',
                            fontWeight: 700
                        }}
                    >
                        Continuar Sesión
                    </Button>
                </div>
            </div>
        </div>
    );
}
