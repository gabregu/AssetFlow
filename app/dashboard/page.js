'use client';
import React, { useEffect } from 'react';
import { useStore } from '../../lib/store';
import { supabase } from '../../lib/supabase';
import {
    AlertCircle, TrendingUp, CheckCircle, ShieldAlert, LayoutList, Plus,
    Search, Truck, FileText, Clock, Tag, Mail, Info, Package, History, Users
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { CountryFilter } from '../components/layout/CountryFilter';

import { WorkloadSection } from './components/WorkloadSection';

// ── KPI Card ────────────────────────────────────────────────────────────────
function KpiCard({ label, value, icon: Icon, color, bg, sub, subColor }) {
    return (
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', padding: '1.25rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 500, margin: 0 }}>{label}</p>
                    <h2 style={{ fontSize: '2rem', fontWeight: 700, margin: '0.3rem 0 0' }}>{value}</h2>
                </div>
                <div style={{ padding: '0.6rem', background: bg, borderRadius: '10px', color }}>
                    <Icon size={20} />
                </div>
            </div>
            <div style={{ height: '4px', background: '#e5e7eb', borderRadius: '99px' }}>
                <div style={{ width: value > 0 ? '60%' : '0%', height: '100%', background: color, borderRadius: '99px', transition: 'width .6s' }} />
            </div>
            {sub && <p style={{ fontSize: '0.75rem', color: subColor || 'var(--text-secondary)', margin: 0 }}>{sub}</p>}
        </div>
    );
}

// ── Quick Action ────────────────────────────────────────────────────────────
function QuickBtn({ icon: Icon, label, color, bg, onClick }) {
    return (
        <div onClick={onClick} style={{
            padding: '0.9rem 1rem', background: 'var(--surface)',
            border: '1px solid var(--border)', borderRadius: '12px',
            display: 'flex', alignItems: 'center', gap: '0.75rem',
            cursor: 'pointer', transition: 'all .2s ease',
        }}
            onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.08)'; e.currentTarget.style.borderColor = color; }}
            onMouseLeave={e => { e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.borderColor = 'var(--border)'; }}
        >
            <div style={{ padding: '0.5rem', background: bg, borderRadius: '8px', color }}>
                <Icon size={18} />
            </div>
            <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>{label}</span>
        </div>
    );
}

const USER_ICONS = [Clock, Tag, Mail, Info, Package, Users, Truck];
const USER_COLORS = ['#3b82f6', '#f59e0b', '#8b5cf6', '#ec4899', '#14b8a6', '#22c55e', '#f97316'];

export default function Dashboard() {
    const router = useRouter();
    const { tickets, assets, currentUser, users, countryFilter, getClientName, logisticsTasks } = useStore();

    const [systemStatus, setSystemStatus] = React.useState({
        database: { label: 'Base de Datos', status: 'Comprobando...', color: '#6b7280' },
        apiGateway: { label: 'API Gateway', status: 'Comprobando...', color: '#6b7280' },
        localStorage: { label: 'Persistencia Local', status: 'Comprobando...', color: '#6b7280' },
    });

    const [historicalMonth, setHistoricalMonth] = React.useState('');

    React.useEffect(() => {
        let isMounted = true;

        const checkStatus = async () => {
            // 1. Check LocalStorage
            let lsStatus = 'Inactivo';
            let lsColor = '#ef4444';
            try {
                if (typeof window !== 'undefined' && window.localStorage) {
                    const testKey = '__status_test__';
                    window.localStorage.setItem(testKey, 'ok');
                    const val = window.localStorage.getItem(testKey);
                    window.localStorage.removeItem(testKey);
                    if (val === 'ok') {
                        lsStatus = 'Activo';
                        lsColor = '#22c55e';
                    }
                }
            } catch (e) {
                console.error("Local storage status error:", e);
                lsStatus = 'Bloqueado';
                lsColor = '#f59e0b';
            }

            if (!isMounted) return;
            setSystemStatus(prev => ({
                ...prev,
                localStorage: { label: 'Persistencia Local', status: lsStatus, color: lsColor }
            }));

            // 2. Check Database (Supabase query)
            let dbStatus = 'Fuera de Línea';
            let dbColor = '#ef4444';
            try {
                const { error } = await supabase.from('users').select('id', { count: 'estimated', head: true }).limit(1);
                if (!error) {
                    dbStatus = 'Operativo';
                    dbColor = '#22c55e';
                } else {
                    console.error("Database status error:", error);
                    dbStatus = 'Error Conexión';
                    dbColor = '#f59e0b';
                }
            } catch (e) {
                console.error("Database connection exception:", e);
            }

            if (!isMounted) return;
            setSystemStatus(prev => ({
                ...prev,
                database: { label: 'Base de Datos', status: dbStatus, color: dbColor }
            }));

            // 3. Check API Gateway / Internet connection
            let apiStatus = 'Fuera de Línea';
            let apiColor = '#ef4444';
            try {
                if (typeof window !== 'undefined' && window.navigator.onLine) {
                    const controller = new AbortController();
                    const timeoutId = setTimeout(() => controller.abort(), 4000);
                    
                    const response = await fetch(window.location.origin, {
                        method: 'GET',
                        signal: controller.signal
                    });
                    clearTimeout(timeoutId);
                    
                    if (response.ok || response.status === 404 || response.status === 405) {
                        apiStatus = 'Operativo';
                        apiColor = '#22c55e';
                    } else {
                        apiStatus = 'Degradado';
                        apiColor = '#f59e0b';
                    }
                }
            } catch (e) {
                console.error("API connection error:", e);
                apiStatus = 'Sin Acceso';
                apiColor = '#f59e0b';
            }

            if (!isMounted) return;
            setSystemStatus(prev => ({
                ...prev,
                apiGateway: { label: 'API Gateway', status: apiStatus, color: apiColor }
            }));
        };

        checkStatus();

        // Run periodically every 30 seconds
        const intervalId = setInterval(checkStatus, 30000);

        return () => {
            isMounted = false;
            clearInterval(intervalId);
        };
    }, []);

    useEffect(() => {
        if (currentUser?.role === 'Conductor') router.push('/dashboard/my-tickets');
    }, [currentUser, router]);

    // ── Filtered data ──────────────────────────────────────────────────────
    const filteredTickets = React.useMemo(() => {
        const expectedClient = getClientName(countryFilter);
        return tickets.filter(t => t.client === expectedClient);
    }, [tickets, countryFilter]);

    const filteredAssets = React.useMemo(() => {
        return assets.filter(a =>
            a.country ? a.country.toLowerCase().includes(countryFilter.toLowerCase())
                : String(a.notes || '').includes(countryFilter)
        );
    }, [assets, countryFilter]);

    // ── KPIs ───────────────────────────────────────────────────────────────
    const ACTIVE_STATUSES = ['Pendiente', 'En Progreso', 'Bloqueado / A la Espera'];
    const pendingTickets = filteredTickets.filter(t => t.status === 'Pendiente').length;
    const inProgress     = filteredTickets.filter(t => t.status === 'En Progreso').length;
    const blocked        = filteredTickets.filter(t => t.status === 'Bloqueado / A la Espera').length;
    const totalTickets   = pendingTickets + inProgress + blocked; // solo activos

    // Resueltos: solo del mes en curso
    const now = new Date();
    const currentYear  = now.getFullYear();
    const currentMonth = now.getMonth(); // 0-indexed
    const resolvedThisMonth = filteredTickets.filter(t => {
        const isResolved = ['Resuelto', 'Caso SFDC Cerrado', 'Servicio Facturado'].includes(t.status);
        if (!isResolved) return false;
        const dateStr = t.created_at || t.createdAt || t.date || t.dateOpened;
        if (!dateStr) return false;
        const d = new Date(dateStr);
        return !isNaN(d.getTime()) && d.getFullYear() === currentYear && d.getMonth() === currentMonth;
    }).length;

    // Tickets del mes en curso (para gráfico de carga de trabajo)
    const currentMonthTickets = React.useMemo(() => {
        return filteredTickets.filter(t => {
            const dateStr = t.created_at || t.createdAt || t.date || t.dateOpened;
            if (!dateStr) return false;
            const d = new Date(dateStr);
            return !isNaN(d.getTime()) && d.getFullYear() === currentYear && d.getMonth() === currentMonth;
        });
    }, [filteredTickets, currentYear, currentMonth]);

    // ── Months data for historical workloads ────────────────────────────────
    const availableMonths = React.useMemo(() => {
        const months = new Set();
        filteredTickets.forEach(t => {
            const ticketDateStr = t.created_at || t.createdAt || t.date || t.dateOpened;
            if (ticketDateStr) {
                const td = new Date(ticketDateStr);
                if (!isNaN(td.getTime())) {
                    months.add(`${td.getFullYear()}-${String(td.getMonth() + 1).padStart(2, '0')}`);
                }
            }
        });
        return Array.from(months).sort().reverse();
    }, [filteredTickets]);

    React.useEffect(() => {
        if (availableMonths.length > 0 && !historicalMonth) {
            const current = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
            const prev = availableMonths.find(m => m !== current);
            setHistoricalMonth(prev || availableMonths[0]);
        }
    }, [availableMonths, historicalMonth]);

    const historicalTickets = React.useMemo(() => {
        if (!historicalMonth) return [];
        return filteredTickets.filter(t => {
            const ticketDateStr = t.created_at || t.createdAt || t.date || t.dateOpened;
            if (!ticketDateStr) return false;
            const td = new Date(ticketDateStr);
            if (isNaN(td.getTime())) return false;
            return `${td.getFullYear()}-${String(td.getMonth() + 1).padStart(2, '0')}` === historicalMonth;
        });
    }, [filteredTickets, historicalMonth]);

    return (
        <div style={{ animation: 'fadeIn 0.4s ease-out', maxWidth: '1200px' }}>

            {/* ── Header ────────────────────────────────────────────────── */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.75rem', gap: '1rem', flexWrap: 'wrap' }}>
                <div>
                    <h1 style={{ fontSize: '1.75rem', fontWeight: 700, margin: 0 }}>Hola, {currentUser?.name || 'Usuario'}</h1>
                    <p style={{ color: 'var(--text-secondary)', margin: '0.25rem 0 0', fontSize: '0.9rem' }}>
                        Bienvenido al panel central de cliente {countryFilter}.
                    </p>
                </div>
            </div>

            {/* ── Quick Actions ─────────────────────────────────────────── */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem', marginBottom: '1.75rem' }}>
                <QuickBtn icon={Plus} label="Nuevo Ticket" color="#3b82f6" bg="rgba(59,130,246,.1)" onClick={() => router.push('/dashboard/tickets')} />
                <QuickBtn icon={History} label="Historial" color="#0ea5e9" bg="rgba(14,165,233,.1)" onClick={() => router.push('/dashboard/history')} />
                <QuickBtn icon={Search} label="Buscar Activo" color="#ca8a04" bg="rgba(234,179,8,.1)" onClick={() => router.push('/dashboard/inventory')} />
                <QuickBtn icon={Truck} label="Ver Envíos" color="#16a34a" bg="rgba(34,197,94,.1)" onClick={() => router.push('/dashboard/deliveries')} />
            </div>

            {/* ── KPI Cards ─────────────────────────────────────────────── */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(185px, 1fr))', gap: '1rem', marginBottom: '1.75rem' }}>
                <KpiCard label="Total de Servicios" value={totalTickets} icon={LayoutList}
                    color="#3b82f6" bg="rgba(59,130,246,.1)"
                    sub={`Activos en ${countryFilter}`} />
                <KpiCard label="Pendientes" value={pendingTickets} icon={AlertCircle}
                    color="#f59e0b" bg="rgba(245,158,11,.1)"
                    sub="En cola, sin asignar" />
                <KpiCard label="En Progreso" value={inProgress} icon={TrendingUp}
                    color="#0ea5e9" bg="rgba(14,165,233,.1)"
                    sub="Trabajando activamente" />
                <KpiCard label="Bloqueado / A la Espera" value={blocked} icon={ShieldAlert}
                    color="#ef4444" bg="rgba(239,68,68,.1)"
                    sub="Requieren atención" subColor="#ef4444" />
                <KpiCard label="Resueltos (este mes)" value={resolvedThisMonth} icon={CheckCircle}
                    color="#22c55e" bg="rgba(34,197,94,.1)"
                    sub={`${now.toLocaleString('es-AR', { month: 'long', year: 'numeric' })}`} subColor="#22c55e" />
            </div>

            {/* ── Workload + Charts ──────────────────────────────────────── */}
            <WorkloadSection 
                title={`Carga de Trabajo — ${now.toLocaleString('es-AR', { month: 'long', year: 'numeric' })}`}
                tickets={currentMonthTickets}
                users={users}
                logisticsTasks={logisticsTasks}
                isHistorical={false}
                userColors={USER_COLORS}
            />

            {/* ── Historical Workload ────────────────────────────────────── */}
            {availableMonths.length > 0 && historicalMonth && (
                <WorkloadSection 
                    title="Carga de Trabajo (Histórico)"
                    tickets={historicalTickets}
                    users={users}
                    logisticsTasks={logisticsTasks}
                    isHistorical={true}
                    monthSelector={true}
                    selectedMonth={historicalMonth}
                    onMonthChange={setHistoricalMonth}
                    availableMonths={availableMonths}
                    userColors={USER_COLORS}
                />
            )}

            {/* ── System Status ─────────────────────────────────────────── */}
            <div className="card">
                <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: '0 0 1.25rem' }}>Estado del Sistema</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                    {Object.values(systemStatus).map(s => (
                        <div key={s.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>{s.label}</span>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <span style={{
                                    width: '8px', height: '8px', borderRadius: '50%',
                                    background: s.color, display: 'inline-block',
                                    boxShadow: `0 0 6px ${s.color}`
                                }} />
                                <span style={{ fontSize: '0.85rem', fontWeight: 600, color: s.color }}>{s.status}</span>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
