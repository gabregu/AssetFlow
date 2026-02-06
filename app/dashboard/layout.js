"use client";
import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Sidebar } from '../components/layout/Sidebar';
import { Menu, Loader2, Shield } from 'lucide-react';
import { useStore } from '../../lib/store';
import { LocationTracker } from '../components/logic/LocationTracker';
import { DeliveryNotificationListener } from '../components/logic/DeliveryNotificationListener';

export default function DashboardLayout({ children }) {
    const router = useRouter();
    const { currentUser, loading } = useStore();
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);

    // Auth Guard
    useEffect(() => {
        if (!loading && !currentUser) {
            router.push('/');
        }
    }, [currentUser, loading, router]);

    if (loading) {
        return (
            <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'var(--background)' }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem', color: 'var(--text-secondary)' }}>
                    <Loader2 size={48} className="animate-spin" style={{ color: 'var(--primary-color)' }} />
                    <p>Verificando sesión...</p>
                </div>
            </div>
        );
    }

    if (!currentUser) {
        return null; // Will redirect in useEffect
    }

    if (currentUser.role === 'pending') {
        return (
            <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', backgroundColor: 'var(--background)', padding: '2rem', textAlign: 'center' }}>
                <div style={{ padding: '2rem', background: 'var(--surface)', borderRadius: '1rem', border: '1px solid var(--border)', maxWidth: '500px' }}>
                    <Shield size={64} style={{ color: '#f59e0b', marginBottom: '1.5rem', margin: '0 auto' }} />
                    <h1 style={{ fontSize: '1.5rem', marginBottom: '1rem' }}>Cuenta en Revisión</h1>
                    <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem' }}>
                        Su solicitud de acceso ha sido recibida y está siendo revisada por un administrador.
                        <br /><br />
                        Recibirá una notificación por correo electrónico una vez que su cuenta haya sido aprobada.
                    </p>
                    <button
                        onClick={() => window.location.href = '/'}
                        style={{ padding: '0.75rem 1.5rem', background: 'transparent', border: '1px solid var(--border)', borderRadius: '0.5rem', cursor: 'pointer', color: 'var(--text-main)' }}
                    >
                        Volver al Inicio
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: 'var(--background)' }}>
            <LocationTracker />
            <DeliveryNotificationListener />
            {/* Overlay para móvil */}
            <div
                className={`mobile-sidebar-overlay ${isSidebarOpen ? 'open' : ''}`}
                onClick={() => setIsSidebarOpen(false)}
            />

            <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />

            <main className="dashboard-main" style={{ flex: 1, padding: '2rem', overflowY: 'auto', position: 'relative' }}>
                {/* Header Móvil */}
                <div className="show-mobile" style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <button
                        onClick={() => setIsSidebarOpen(true)}
                        style={{ background: 'var(--surface)', border: '1px solid var(--border)', padding: '0.5rem', borderRadius: '8px', cursor: 'pointer' }}
                    >
                        <Menu size={24} color="var(--text-main)" />
                    </button>
                    <span style={{ fontWeight: 700, fontSize: '1.2rem' }}>AssetFlow</span>
                </div>

                <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
                    {children}
                </div>
            </main>
        </div>
    );
}
