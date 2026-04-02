"use client";
import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Ticket, Truck, TrendingUp, User } from 'lucide-react';
import { useStore } from '../../../lib/store';

export function MobileBottomNav() {
    const pathname = usePathname();
    const { currentUser } = useStore();

    if (!currentUser || currentUser.role !== 'Conductor') return null;

    const navItems = [
        { name: 'Servicios', icon: Ticket, path: '/dashboard/my-tickets' },
        { name: 'Envíos', icon: Truck, path: '/dashboard/my-deliveries' },
        { name: 'Mis Números', icon: TrendingUp, path: '/dashboard/my-stats' },
        { name: 'Perfil', icon: User, path: '/dashboard/settings' },
    ];

    return (
        <div className="show-mobile" style={{
            position: 'fixed',
            bottom: 0,
            left: 0,
            right: 0,
            height: 'calc(4.5rem + safe-area-inset-bottom)',
            backgroundColor: 'var(--surface)',
            borderTop: '1px solid var(--border)',
            display: 'flex',
            justifyContent: 'space-around',
            alignItems: 'center',
            padding: '0 0.5rem calc(0.5rem + safe-area-inset-bottom) 0.5rem',
            zIndex: 1000,
            boxShadow: '0 -4px 20px rgba(0,0,0,0.05)',
            backdropFilter: 'blur(10px)',
            background: 'var(--glass-bg)'
        }}>
            {navItems.map((item) => {
                const isActive = pathname === item.path;
                return (
                    <Link
                        key={item.path}
                        href={item.path}
                        style={{
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '4px',
                            color: isActive ? 'var(--primary-color)' : 'var(--text-secondary)',
                            textDecoration: 'none',
                            flex: 1,
                            height: '100%',
                            transition: 'all 0.2s ease',
                            position: 'relative'
                        }}
                    >
                        {isActive && (
                            <div style={{
                                position: 'absolute',
                                top: '-2px',
                                width: '20px',
                                height: '3px',
                                backgroundColor: 'var(--primary-color)',
                                borderRadius: '0 0 4px 4px'
                            }} />
                        )}
                        <item.icon size={22} strokeWidth={isActive ? 2.5 : 2} />
                        <span style={{ 
                            fontSize: '0.65rem', 
                            fontWeight: isActive ? 700 : 500,
                            letterSpacing: '0.02em',
                            textTransform: 'uppercase'
                        }}>
                            {item.name}
                        </span>
                    </Link>
                );
            })}
        </div>
    );
}
