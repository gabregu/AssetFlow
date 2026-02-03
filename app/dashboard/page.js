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
import { ServiceMap } from '../components/ui/ServiceMap';

export default function Dashboard() {
    const router = useRouter();
    const { tickets, assets, currentUser, users } = useStore();

    // Redirección para conductores (solo deben ver Mis Envíos y Mis Servicios)
    useEffect(() => {
        if (currentUser?.role === 'Conductor') {
            router.push('/dashboard/my-deliveries');
        }
    }, [currentUser, router]);

    // Calcular métricas reales
    const openTickets = tickets.filter(t => t.status === 'Abierto').length;
    const inProgressTickets = tickets.filter(t => t.status === 'En Progreso').length;
    const resolvedTickets = tickets.filter(t => t.status === 'Resuelto' || t.status === 'Cerrado').length;
    const assignedAssets = assets.filter(a => a.status === 'Assigned').length;

    // Obtener los últimos 3 tickets reales
    const recentTickets = tickets.slice(0, 3);

    return (
        <div>
            <div style={{ marginBottom: '2rem' }}>
                <h1 style={{ fontSize: '1.8rem', fontWeight: 700, color: 'var(--text-main)' }}>Hola, {currentUser?.name || 'Usuario'}</h1>
                <p style={{ color: 'var(--text-secondary)' }}>Aquí tienes un resumen de la actividad de hoy en AssetFlow.</p>
            </div>

            {/* Quick Actions */}
            <div style={{ display: 'grid', gridTemplateColumns: `repeat(${currentUser?.role === 'Conductor' ? 1 : 4}, 1fr)`, gap: '1rem', marginBottom: '2.5rem' }}>
                {currentUser?.role === 'Conductor' ? (
                    <div
                        onClick={() => router.push('/dashboard/my-deliveries')}
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
                            <Truck size={24} />
                        </div>
                        <div>
                            <span style={{ fontWeight: 700, fontSize: '1.1rem', display: 'block' }}>Ir a Mis Envíos</span>
                            <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Tienes entregas pendientes por gestionar</span>
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
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
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

            {/* Live Map - Only for non-drivers usually, or everyone */}
            {
                currentUser?.role !== 'Conductor' && (
                    <div style={{ marginBottom: '2rem' }}>
                        <Card>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                                <h3 style={{ fontSize: '1.1rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <Map size={18} /> Mapa en Vivo
                                </h3>
                                <Badge variant="default" style={{ background: 'var(--primary-color)', color: 'white' }}>
                                    {users.filter(u => u.tracking_enabled && u.location_latitude).length} Conductor(es) Activo(s)
                                </Badge>
                            </div>
                            <div style={{ borderRadius: 'var(--radius-md)', overflow: 'hidden', border: '1px solid var(--border)' }}>
                                <ServiceMap
                                    tickets={tickets.filter(t => t.status === 'En Progreso' || t.status === 'Abierto')}
                                    drivers={users.filter(u => u.tracking_enabled && u.location_latitude)}
                                />
                            </div>
                        </Card>
                    </div>
                )
            }

            {/* Employee Workload Stats */}
            <div style={{ marginBottom: '2rem' }}>
                <Card>
                    <h3 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '1.5rem' }}>Carga de Trabajo (Empleados)</h3>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1rem' }}>
                        {users.map(user => {
                            const activeCount = tickets.filter(t =>
                                (t.logistics?.deliveryPerson === user.name || t.logistics?.deliveryPerson === user.username) &&
                                t.status !== 'Resuelto' &&
                                t.status !== 'Cerrado'
                            ).length;

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
