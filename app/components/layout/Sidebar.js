"use client";
import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Ticket, Package, Truck, Settings, LogOut, FileText, X, DollarSign, History } from 'lucide-react';
import { useStore } from '../../../lib/store';

import { Logo } from '../ui/Logo';

export function Sidebar({ isOpen, onClose }) {
    const pathname = usePathname();
    const { currentUser, logout, onlineUsers } = useStore();

    const menuItems = [
        { name: 'Dashboard', icon: LayoutDashboard, path: '/dashboard', roles: ['admin', 'Administrativo', 'Gerencial'] },
        { name: 'Casos SFDC', icon: FileText, path: '/dashboard/salesforce-cases', roles: ['admin', 'Administrativo', 'Gerencial'] },
        { name: 'Servicios', icon: Ticket, path: '/dashboard/tickets', roles: ['admin', 'Administrativo', 'Gerencial'] },
        { name: 'Inventario', icon: Package, path: '/dashboard/inventory', roles: ['admin', 'Administrativo', 'Gerencial'] },
        { name: 'Envíos', icon: Truck, path: '/dashboard/deliveries', roles: ['admin', 'Administrativo', 'Gerencial'] },
        { name: 'Facturación', icon: DollarSign, path: '/dashboard/billing', roles: ['admin', 'Gerencial'] },
        { name: 'Histórico', icon: History, path: '/dashboard/history', roles: ['admin', 'Administrativo', 'Gerencial'] },
    ];

    const personalItems = [
        { name: 'Mis Servicios', icon: Ticket, path: '/dashboard/my-tickets', roles: ['admin', 'Administrativo', 'Gerencial', 'Conductor'] },
        { name: 'Mis Envíos', icon: Truck, path: '/dashboard/my-deliveries', roles: ['Conductor', 'admin', 'Gerencial'] },
    ];

    const reportItems = [
        { name: 'Vista General', icon: FileText, path: '/dashboard/reports', roles: ['admin', 'Administrativo', 'Gerencial'] },
    ];

    const filterByRole = (items) => items.filter(item =>
        !item.roles || (currentUser && item.roles.includes(currentUser.role))
    );

    const filteredMainItems = filterByRole(menuItems);
    const filteredPersonalItems = filterByRole(personalItems);
    const filteredReportItems = filterByRole(reportItems);

    const renderMenuItem = (item) => {
        const isActive = pathname === item.path;
        return (
            <Link
                key={item.path}
                href={item.path}
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.75rem',
                    padding: '0.75rem 1rem',
                    borderRadius: 'var(--radius-md)',
                    color: isActive ? 'var(--primary-color)' : 'var(--text-secondary)',
                    backgroundColor: isActive ? 'rgba(37, 99, 235, 0.08)' : 'transparent',
                    fontWeight: isActive ? 600 : 500,
                    transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
                    position: 'relative',
                    overflow: 'hidden'
                }}
            >
                {isActive && (
                    <div style={{
                        position: 'absolute',
                        left: 0,
                        width: '3px',
                        height: '60%',
                        backgroundColor: 'var(--primary-color)',
                        borderRadius: '0 4px 4px 0'
                    }} />
                )}
                <item.icon size={20} style={{ transition: 'transform 0.2s ease' }} className={isActive ? 'sidebar-icon-active' : ''} />
                {item.name}
            </Link>
        );
    };

    const [isLoggingOut, setIsLoggingOut] = React.useState(false);

    return (
        <aside className={`sidebar-container ${isOpen ? 'open' : ''}`} style={{
            width: '260px',
            height: '100dvh', // Use dvh for better mobile support
            maxHeight: '100vh', // Fallback
            backgroundColor: 'var(--surface)',
            borderRight: '1px solid var(--border)',
            display: 'flex',
            flexDirection: 'column',
            position: 'sticky',
            top: 0,
            zIndex: 1000 // Ensure it stays on top
        }}>
            <div style={{ padding: '2rem', borderBottom: '1px solid var(--border)', position: 'relative', flexShrink: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Logo size="small" />
                    <button className="show-mobile" onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                        <X size={24} />
                    </button>
                </div>
                {currentUser && (
                    <div style={{ marginTop: '0.5rem' }}>
                        <p style={{ fontSize: '0.8rem', color: 'var(--text-main)', margin: 0, fontWeight: 600 }}>{currentUser.name}</p>
                        <p style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', margin: 0, textTransform: 'uppercase' }}>{currentUser.role}</p>
                    </div>
                )}
            </div>

            <nav style={{ 
                flex: 1, 
                padding: '1.5rem 1rem', 
                display: 'flex', 
                flexDirection: 'column', 
                gap: '0.5rem', 
                overflowY: 'auto',
                minHeight: 0 // Crucial for flex nested scrolling
            }}>
                {filteredMainItems.map(renderMenuItem)}

                {filteredPersonalItems.length > 0 && filteredMainItems.length > 0 && (
                    <div style={{
                        margin: '1.5rem 0 0.5rem 0',
                        padding: '0 1rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.75rem'
                    }}>
                        <div style={{ flex: 1, height: '1px', backgroundColor: 'var(--border)' }} />
                        <span style={{
                            fontSize: '0.65rem',
                            fontWeight: 700,
                            color: 'var(--text-secondary)',
                            textTransform: 'uppercase',
                            letterSpacing: '0.1em',
                            whiteSpace: 'nowrap'
                        }}>Personal</span>
                        <div style={{ flex: 1, height: '1px', backgroundColor: 'var(--border)' }} />
                    </div>
                )}

                {filteredPersonalItems.map(renderMenuItem)}

                {filteredReportItems.length > 0 && (
                    <div style={{
                        margin: '1.5rem 0 0.5rem 0',
                        padding: '0 1rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.75rem'
                    }}>
                        <div style={{ flex: 1, height: '1px', backgroundColor: 'var(--border)' }} />
                        <span style={{
                            fontSize: '0.65rem',
                            fontWeight: 700,
                            color: 'var(--text-secondary)',
                            textTransform: 'uppercase',
                            letterSpacing: '0.1em',
                            whiteSpace: 'nowrap'
                        }}>Informes</span>
                        <div style={{ flex: 1, height: '1px', backgroundColor: 'var(--border)' }} />
                    </div>
                )}

                {filteredReportItems.map(renderMenuItem)}
            </nav>

            <div style={{ 
                marginTop: 'auto', 
                paddingTop: '1rem', 
                borderTop: '1px solid var(--border)',
                flexShrink: 0, // Prevent shrinking
                backgroundColor: 'var(--surface)', // Ensure background
                paddingBottom: 'safe-area-inset-bottom' // For iPhone home bar
            }}>
                {/* Sección Usuarios Online (Solo Admin/Gerencial) */}
                {currentUser && ['admin', 'Gerencial'].includes(currentUser.role) && (
                    <div style={{
                        marginBottom: '1rem',
                        padding: '0.75rem',
                        background: 'rgba(34, 197, 94, 0.1)',
                        borderRadius: '8px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.75rem',
                        border: '1px solid rgba(34, 197, 94, 0.2)'
                    }}>
                        <div style={{ position: 'relative' }}>
                            <div style={{
                                width: '10px',
                                height: '10px',
                                background: '#22c55e',
                                borderRadius: '50%',
                                boxShadow: '0 0 0 2px rgba(34, 197, 94, 0.3)'
                            }}></div>
                            <div style={{
                                position: 'absolute',
                                top: '-2px',
                                left: '-2px',
                                width: '14px',
                                height: '14px',
                                background: '#22c55e',
                                borderRadius: '50%',
                                opacity: 0.5,
                                animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite'
                            }}></div>
                        </div>
                        <div>
                            <p style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-main)', margin: 0 }}>
                                Usuarios Online
                            </p>
                            <p style={{ fontSize: '0.7rem', color: '#15803d', margin: 0, fontWeight: 600 }}>
                                {onlineUsers.length} conectados
                            </p>
                        </div>
                    </div>
                )}

                <Link href="/dashboard/settings" style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.75rem',
                    padding: '0.75rem 1rem',
                    color: pathname === '/dashboard/settings' ? 'var(--primary-color)' : 'var(--text-secondary)',
                    backgroundColor: pathname === '/dashboard/settings' ? 'rgba(37, 99, 235, 0.08)' : 'transparent',
                    borderRadius: 'var(--radius-md)',
                    marginBottom: '0.5rem',
                    fontWeight: pathname === '/dashboard/settings' ? 600 : 500
                }}>
                    <Settings size={20} />
                    Configuración
                </Link>
                <button
                    disabled={isLoggingOut}
                    onClick={async () => {
                        setIsLoggingOut(true);
                        try {
                            // Small delay to show feedback if network is instant
                            await new Promise(resolve => setTimeout(resolve, 500));
                            await logout();
                        } catch (e) {
                            console.error("Logout error:", e);
                        } finally {
                            window.location.href = '/';
                        }
                    }}
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.75rem',
                        padding: '0.75rem 1rem',
                        color: isLoggingOut ? 'var(--text-secondary)' : '#ef4444',
                        background: 'none',
                        border: 'none',
                        cursor: isLoggingOut ? 'wait' : 'pointer',
                        width: '100%',
                        textAlign: 'left',
                        fontFamily: 'inherit',
                        fontSize: 'inherit',
                        fontWeight: 500,
                        opacity: isLoggingOut ? 0.7 : 1
                    }}
                >
                    {isLoggingOut ? (
                        <>
                            <div style={{
                                width: '20px',
                                height: '20px',
                                border: '2px solid var(--text-secondary)',
                                borderTop: '2px solid transparent',
                                borderRadius: '50%',
                                animation: 'spin 1s linear infinite'
                            }} />
                            <span>Cerrando...</span>
                        </>
                    ) : (
                        <>
                            <LogOut size={20} />
                            Cerrar Sesión
                        </>
                    )}
                </button>
            </div>
        </aside>
    );
}
