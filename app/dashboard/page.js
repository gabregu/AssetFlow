'use client';
import React, { useEffect } from 'react';

import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { useStore } from '../../lib/store';
import {
    AlertCircle,
    TrendingUp,
    CheckCircle,
    Users,
    Plus,
    Search,
    Truck,
    FileText,
    Calendar,
    ArrowRight,
    Map
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { CountryFilter } from '../components/layout/CountryFilter';


export default function Dashboard() {
    const router = useRouter();
    const { tickets, assets, currentUser, users, countryFilter, sfdcCases } = useStore();

    useEffect(() => {
        if (currentUser?.role === 'Conductor') {
            router.push('/dashboard/my-tickets');
        }
    }, [currentUser, router]);

    // Calcular métricas reales (Filtradas por País)
    const filteredTickets = React.useMemo(() => {
        if (countryFilter === 'Todos') return tickets;
        return tickets.filter(t => {
            let matches = false;
            // 1. Try Address
            // 1. Try Address
            if (t.logistics?.address && String(t.logistics.address).toLowerCase().includes(String(countryFilter).toLowerCase())) {
                matches = true;
            } else {
                // 2. Try SFDC Link
                const subject = String(t.subject || '');
                const sfdcMatch = subject.match(/SFDC-(\d+)/);
                if (sfdcMatch) {
                    const caseNum = sfdcMatch[1];
                    const sfdcCase = sfdcCases?.find(c => String(c.caseNumber) === caseNum);
                    if (sfdcCase && sfdcCase.country) {
                        matches = String(sfdcCase.country).toLowerCase().includes(String(countryFilter).toLowerCase());
                    }
                }
            }
            return matches;
        });
    }, [tickets, countryFilter, sfdcCases]);

    const filteredAssets = React.useMemo(() => {
        if (countryFilter === 'Todos') return assets;
        return assets.filter(a => {
            if (a.country) {
                return a.country.toLowerCase().includes(countryFilter.toLowerCase());
            } else if (a.notes && a.notes.includes(countryFilter)) {
                return true;
            }
            return false;
        });
    }, [assets, countryFilter]);

    const openTickets = filteredTickets.filter(t => t.status === 'Abierto').length;
    const inProgressTickets = filteredTickets.filter(t => t.status === 'En Progreso').length;
    const resolvedTickets = filteredTickets.filter(t => t.status === 'Resuelto' || t.status === 'Cerrado').length;
    const assignedAssets = filteredAssets.filter(a => a.status === 'Assigned').length;

    // Obtener los últimos 3 tickets reales
    const recentTickets = filteredTickets.slice(0, 3);

    return (
        <div style={{ animation: 'fadeIn 0.5s ease-out' }}>
            <div className="flex-mobile-column" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2rem', gap: '1rem' }}>
                <div>
                    <h1 style={{ fontSize: '1.8rem', fontWeight: 700, color: 'var(--text-main)', margin: 0 }}>Hola, {currentUser?.name || 'Usuario'}</h1>
                    <p style={{ color: 'var(--text-secondary)' }}>Aquí tienes un resumen de la actividad de hoy en AssetFlow.</p>
                </div>
                <div>
                    <CountryFilter />
                </div>
            </div>

            {/* Quick Actions */}
            <div className="grid-responsive-4" style={{ marginBottom: '2.5rem' }}>
                {currentUser?.role === 'Conductor' ? (
                    <div
                        onClick={() => router.push('/dashboard/my-tickets')}
                        style={{
                            padding: '1.5rem',
                            background: 'var(--surface)',
                            border: '2px solid var(--primary-color)',
                            borderRadius: 'var(--radius-lg)',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '1rem',
                            cursor: 'pointer',
                            transition: 'all 0.2s ease',
                        }}
                        className="table-row quick-action-card"
                    >
                        <div style={{ padding: '0.75rem', background: 'rgba(37, 99, 235, 0.1)', color: 'var(--primary-color)', borderRadius: '12px' }}>
                            <FileText size={24} />
                        </div>
                        <div>
                            <span style={{ fontWeight: 700, fontSize: '1.1rem', display: 'block' }}>Ir a Mis Servicios</span>
                            <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Tienes servicios pendientes por gestionar</span>
                        </div>
                    </div>
                ) : (
                    <>
                        <div
                            onClick={() => router.push('/dashboard/tickets')}
                            style={{
                                padding: '1rem',
                                background: 'var(--surface)',
                                border: '1px solid var(--border)',
                                borderRadius: 'var(--radius-md)',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.75rem',
                                cursor: 'pointer',
                                transition: 'all 0.2s ease',
                            }}
                            className="table-row quick-action-card"
                        >
                            <div style={{ padding: '0.5rem', background: 'rgba(37, 99, 235, 0.1)', color: 'var(--primary-color)', borderRadius: '8px' }}>
                                <Plus size={18} />
                            </div>
                            <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>Nuevo Ticket</span>
                        </div>

                        <div
                            onClick={() => router.push('/dashboard/salesforce-cases')}
                            style={{
                                padding: '1rem',
                                background: 'var(--surface)',
                                border: '1px solid var(--border)',
                                borderRadius: 'var(--radius-md)',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.75rem',
                                cursor: 'pointer',
                                transition: 'all 0.2s ease',
                            }}
                            className="table-row quick-action-card"
                        >
                            <div style={{ padding: '0.5rem', background: 'rgba(14, 165, 233, 0.1)', color: 'var(--accent-color)', borderRadius: '8px' }}>
                                <FileText size={18} />
                            </div>
                            <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>Importar Casos</span>
                        </div>

                        <div
                            onClick={() => router.push('/dashboard/inventory')}
                            style={{
                                padding: '1rem',
                                background: 'var(--surface)',
                                border: '1px solid var(--border)',
                                borderRadius: 'var(--radius-md)',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.75rem',
                                cursor: 'pointer',
                                transition: 'all 0.2s ease',
                            }}
                            className="table-row quick-action-card"
                        >
                            <div style={{ padding: '0.5rem', background: 'rgba(234, 179, 8, 0.1)', color: '#ca8a04', borderRadius: '8px' }}>
                                <Search size={18} />
                            </div>
                            <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>Buscar Activo</span>
                        </div>

                        <div
                            onClick={() => router.push('/dashboard/deliveries')}
                            style={{
                                padding: '1rem',
                                background: 'var(--surface)',
                                border: '1px solid var(--border)',
                                borderRadius: 'var(--radius-md)',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.75rem',
                                cursor: 'pointer',
                                transition: 'all 0.2s ease',
                            }}
                            className="table-row quick-action-card"
                        >
                            <div style={{ padding: '0.5rem', background: 'rgba(34, 197, 94, 0.1)', color: '#16a34a', borderRadius: '8px' }}>
                                <Truck size={18} />
                            </div>
                            <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>Ver Envíos</span>
                        </div>
                    </>
                )}
            </div>

            {/* KPI Cards */}
            <div className="grid-responsive-dashboard" style={{ marginBottom: '2rem' }}>
                <Card>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div>
                            <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', fontWeight: 500 }}>Servicios Abiertos</p>
                            <h2 style={{ fontSize: '2rem', fontWeight: 700, margin: '0.5rem 0' }}>{openTickets}</h2>
                        </div>
                        <div style={{ padding: '0.5rem', background: 'rgba(59, 130, 246, 0.1)', borderRadius: '8px', color: '#3b82f6' }}>
                            <AlertCircle size={20} />
                        </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem' }}>
                        <span style={{ color: '#22c55e', fontWeight: 500 }}>Activos</span>
                        <span style={{ color: 'var(--text-secondary)' }}>en cola</span>
                    </div>
                </Card>

                <Card>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div>
                            <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', fontWeight: 500 }}>En Progreso</p>
                            <h2 style={{ fontSize: '2rem', fontWeight: 700, margin: '0.5rem 0' }}>{inProgressTickets}</h2>
                        </div>
                        <div style={{ padding: '0.5rem', background: 'rgba(234, 179, 8, 0.1)', borderRadius: '8px', color: '#eab308' }}>
                            <TrendingUp size={20} />
                        </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem' }}>
                        <span style={{ color: 'var(--text-secondary)' }}>Trabajando activamente</span>
                    </div>
                </Card>

                <Card>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div>
                            <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', fontWeight: 500 }}>Resueltos (Total)</p>
                            <h2 style={{ fontSize: '2rem', fontWeight: 700, margin: '0.5rem 0' }}>{resolvedTickets}</h2>
                        </div>
                        <div style={{ padding: '0.5rem', background: 'rgba(34, 197, 94, 0.1)', borderRadius: '8px', color: '#22c55e' }}>
                            <CheckCircle size={20} />
                        </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem' }}>
                        <span style={{ color: '#22c55e', fontWeight: 500 }}>Completados</span>
                        <span style={{ color: 'var(--text-secondary)' }}>histórico</span>
                    </div>
                </Card>

                <Card>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div>
                            <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', fontWeight: 500 }}>Activos Asignados</p>
                            <h2 style={{ fontSize: '2rem', fontWeight: 700, margin: '0.5rem 0' }}>{assignedAssets}</h2>
                        </div>
                        <div style={{ padding: '0.5rem', background: 'rgba(124, 58, 237, 0.1)', borderRadius: '8px', color: '#7c3aed' }}>
                            <Users size={20} />
                        </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem' }}>
                        <span style={{ color: 'var(--text-secondary)' }}>En manos de usuarios</span>
                    </div>
                </Card>
            </div>

            {/* Employee Workload Stats */}
            <div style={{ marginBottom: '2rem' }}>
                <Card>
                    <h3 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '1.5rem' }}>Carga de Trabajo (Empleados)</h3>
                    <div className="grid-responsive-dashboard">

                        {(users || []).map(user => {
                            const activeCount = filteredTickets.filter(t => {
                                const deliveryPerson = String(t.logistics?.deliveryPerson || t.logistics?.delivery_person || '').toLowerCase();
                                const userName = String(user.name || user.username || '').toLowerCase();
                                return (deliveryPerson === userName || (deliveryPerson && userName && deliveryPerson.includes(userName))) &&
                                    t.status !== 'Resuelto' &&
                                    t.status !== 'Cerrado'
                            }).length;

                            return (
                                <div key={user.id} style={{
                                    padding: '1rem',
                                    background: 'var(--surface)',
                                    border: '1px solid var(--border)',
                                    borderRadius: 'var(--radius-md)',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: '0.5rem'
                                }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>{user.name}</span>
                                        {user.role === 'Conductor' && <Truck size={14} style={{ opacity: 0.5 }} />}
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                        <span style={{ fontSize: '1.5rem', fontWeight: 700, color: activeCount > 0 ? 'var(--primary-color)' : 'var(--text-secondary)' }}>
                                            {activeCount}
                                        </span>
                                        <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>casos activos</span>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </Card>
            </div>

            {/* System Status Card */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1.5rem' }}>
                <Card>
                    <h3 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '1.5rem' }}>Estado del Sistema</h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ color: 'var(--text-secondary)' }}>Base de Datos</span>
                            <div style={{ display: 'flex', alignItems: 'center' }}>
                                <span className="status-pulse"></span>
                                <span style={{ color: '#22c55e', fontWeight: 500, fontSize: '0.875rem' }}>Operativo</span>
                            </div>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ color: 'var(--text-secondary)' }}>API Gateway</span>
                            <div style={{ display: 'flex', alignItems: 'center' }}>
                                <span className="status-pulse"></span>
                                <span style={{ color: '#22c55e', fontWeight: 500, fontSize: '0.875rem' }}>Operativo</span>
                            </div>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ color: 'var(--text-secondary)' }}>Persistencia Local</span>
                            <div style={{ display: 'flex', alignItems: 'center' }}>
                                <span className="status-pulse"></span>
                                <span style={{ color: '#22c55e', fontWeight: 500, fontSize: '0.875rem' }}>Activa</span>
                            </div>
                        </div>
                    </div>
                </Card>
            </div>
        </div >
    );
}
