"use client";
import React, { useState } from 'react';
import { Sidebar } from '../components/layout/Sidebar';
import { Menu, X } from 'lucide-react';

export default function DashboardLayout({ children }) {
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);

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
