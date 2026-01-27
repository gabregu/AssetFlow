"use client";
import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Sidebar } from '../components/layout/Sidebar';
import { Menu, Loader2 } from 'lucide-react';
import { useStore } from '../../lib/store';

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

    return (
        <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: 'var(--background)' }}>
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
