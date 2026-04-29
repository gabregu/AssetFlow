'use client';
import React, { useEffect } from 'react';
import { useStore } from '../../lib/store';
import {
    AlertCircle, TrendingUp, CheckCircle, Users, Plus,
    Search, Truck, FileText, Clock, Tag, Mail, Info, Package
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { CountryFilter } from '../components/layout/CountryFilter';

// ── Mini Donut SVG ──────────────────────────────────────────────────────────
function DonutChart({ slices, size = 120, thickness = 22, label }) {
    const r = (size - thickness) / 2;
    const circ = 2 * Math.PI * r;
    const total = slices.reduce((s, x) => s + (x.value || 0), 0) || 1;
    let offset = 0;
    const segs = slices.map((s) => {
        const dash = (s.value / total) * circ;
        const seg = { ...s, dash, gap: circ - dash, offset };
        offset += dash;
        return seg;
    });
    return (
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
            <circle cx={size / 2} cy={size / 2} r={r} fill="none"
                stroke="#e5e7eb" strokeWidth={thickness} />
            {segs.map((s, i) => (
                <circle key={i} cx={size / 2} cy={size / 2} r={r} fill="none"
                    stroke={s.color} strokeWidth={thickness}
                    strokeDasharray={`${s.dash} ${s.gap}`}
                    strokeDashoffset={-s.offset}
                    style={{ transform: 'rotate(-90deg)', transformOrigin: '50% 50%' }} />
            ))}
            {label !== undefined && (
                <>
                    <text x="50%" y="46%" textAnchor="middle" dominantBaseline="middle"
                        style={{ fontSize: '1.4rem', fontWeight: 700, fill: 'var(--text-main)' }}>
                        {label}
                    </text>
                    <text x="50%" y="64%" textAnchor="middle" dominantBaseline="middle"
                        style={{ fontSize: '0.55rem', fill: '#9ca3af' }}>
                        TOTAL
                    </text>
                </>
            )}
        </svg>
    );
}

// ── Bar mini ────────────────────────────────────────────────────────────────
function MiniBar({ value, max, color }) {
    const pct = max > 0 ? (value / max) * 100 : 0;
    return (
        <div style={{ height: '6px', background: '#e5e7eb', borderRadius: '99px', overflow: 'hidden', flex: 1 }}>
            <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: '99px', transition: 'width .4s' }} />
        </div>
    );
}

// ── KPI Card ────────────────────────────────────────────────────────────────
function KpiCard({ label, value, icon: Icon, color, bg, sub, subColor }) {
    return (
        <div style={{
            background: 'var(--surface)', border: '1px solid var(--border)',
            borderRadius: '12px', padding: '1.25rem', display: 'flex',
            flexDirection: 'column', gap: '0.75rem'
        }}>
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
    const { tickets, assets, currentUser, users, countryFilter, sfdcCases } = useStore();

    useEffect(() => {
        if (currentUser?.role === 'Conductor') router.push('/dashboard/my-tickets');
    }, [currentUser, router]);

    // ── Filtered data ──────────────────────────────────────────────────────
    const filteredTickets = React.useMemo(() => {
        if (countryFilter === 'Todos') return tickets;
        return tickets.filter(t => {
            if (t.logistics?.address && String(t.logistics.address).toLowerCase().includes(String(countryFilter).toLowerCase())) return true;
            const subject = String(t.subject || '');
            const m = subject.match(/SFDC-(\d+)/);
            if (m) {
                const sc = sfdcCases?.find(c => String(c.caseNumber) === m[1]);
                if (sc?.country && String(sc.country).toLowerCase().includes(String(countryFilter).toLowerCase())) return true;
            }
            return false;
        });
    }, [tickets, countryFilter, sfdcCases]);

    const filteredAssets = React.useMemo(() => {
        if (countryFilter === 'Todos') return assets;
        return assets.filter(a =>
            a.country ? a.country.toLowerCase().includes(countryFilter.toLowerCase())
                : a.notes?.includes(countryFilter)
        );
    }, [assets, countryFilter]);

    // ── KPIs ───────────────────────────────────────────────────────────────
    const openTickets = filteredTickets.filter(t => t.status === 'Abierto').length;
    const inProgress = filteredTickets.filter(t => t.status === 'En Progreso').length;
    const resolved = filteredTickets.filter(t => ['Resuelto', 'Cerrado'].includes(t.status)).length;
    const assignedAssets = filteredAssets.filter(a => a.assignee && !['Almacén', 'En Almacén'].includes(a.assignee)).length;

    // ── Workload per user ──────────────────────────────────────────────────
    const workloadUsers = (users || []).map((u, i) => {
        const active = filteredTickets.filter(t => {
            const dp = String(t.logistics?.deliveryPerson || t.logistics?.delivery_person || '').toLowerCase();
            const un = String(u.name || u.username || '').toLowerCase();
            return (dp === un || (dp && un && dp.includes(un))) && !['Resuelto', 'Cerrado'].includes(t.status);
        }).length;
        return { ...u, active, color: USER_COLORS[i % USER_COLORS.length], Icon: USER_ICONS[i % USER_ICONS.length] };
    });
    const maxActive = Math.max(...workloadUsers.map(u => u.active), 1);

    // ── Timeline (last 10 days) ────────────────────────────────────────────
    const today = new Date();
    const days = Array.from({ length: 10 }, (_, i) => {
        const d = new Date(today);
        d.setDate(today.getDate() - (9 - i));
        const label = d.toLocaleDateString('es-AR', { day: 'numeric', month: 'short' });
        const count = filteredTickets.filter(t => {
            if (!t.createdAt) return false;
            const td = new Date(t.createdAt);
            return td.toDateString() === d.toDateString();
        }).length;
        return { label, count };
    });
    const maxCount = Math.max(...days.map(d => d.count), 1);

    // ── Donut data ─────────────────────────────────────────────────────────
    const incidentes = filteredTickets.filter(t => t.type === 'Incidente').length;
    const solicitudes = filteredTickets.filter(t => t.type === 'Solicitud').length;
    const mantenimiento = filteredTickets.filter(t => t.type === 'Mantenimiento').length;
    const typeTotal = incidentes + solicitudes + mantenimiento || 1;

    const donutType = [
        { value: incidentes, color: '#6b7280' },
        { value: solicitudes, color: '#d1d5db' },
        { value: mantenimiento, color: '#e5e7eb' },
    ];
    const donutStatus = [
        { value: openTickets, color: '#3b82f6' },
        { value: inProgress, color: '#f59e0b' },
        { value: resolved, color: '#22c55e' },
    ];

    return (
        <div style={{ animation: 'fadeIn 0.4s ease-out', maxWidth: '1200px' }}>

            {/* ── Header ────────────────────────────────────────────────── */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.75rem', gap: '1rem', flexWrap: 'wrap' }}>
                <div>
                    <h1 style={{ fontSize: '1.75rem', fontWeight: 700, margin: 0 }}>Hola, {currentUser?.name || 'Usuario'}</h1>
                    <p style={{ color: 'var(--text-secondary)', margin: '0.25rem 0 0', fontSize: '0.9rem' }}>Aquí tienes un resumen de la actividad de hoy en AssetFlow.</p>
                </div>
                <CountryFilter />
            </div>

            {/* ── Quick Actions ─────────────────────────────────────────── */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem', marginBottom: '1.75rem' }}>
                <QuickBtn icon={Plus} label="Nuevo Ticket" color="#3b82f6" bg="rgba(59,130,246,.1)" onClick={() => router.push('/dashboard/tickets')} />
                <QuickBtn icon={FileText} label="Importar Casos" color="#0ea5e9" bg="rgba(14,165,233,.1)" onClick={() => router.push('/dashboard/salesforce-cases')} />
                <QuickBtn icon={Search} label="Buscar Activo" color="#ca8a04" bg="rgba(234,179,8,.1)" onClick={() => router.push('/dashboard/inventory')} />
                <QuickBtn icon={Truck} label="Ver Envíos" color="#16a34a" bg="rgba(34,197,94,.1)" onClick={() => router.push('/dashboard/deliveries')} />
            </div>

            {/* ── KPI Cards ─────────────────────────────────────────────── */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.75rem' }}>
                <KpiCard label="Servicios Abiertos" value={openTickets} icon={AlertCircle}
                    color="#3b82f6" bg="rgba(59,130,246,.1)"
                    sub={`${openTickets} Activos en cola`} />
                <KpiCard label="En Progreso" value={inProgress} icon={TrendingUp}
                    color="#f59e0b" bg="rgba(234,179,8,.1)"
                    sub="Trabajando activamente" />
                <KpiCard label="Resueltos (Total)" value={resolved} icon={CheckCircle}
                    color="#22c55e" bg="rgba(34,197,94,.1)"
                    sub="Completados histórico" subColor="#22c55e" />
                <KpiCard label="Activos Asignados" value={assignedAssets} icon={Users}
                    color="#8b5cf6" bg="rgba(139,92,246,.1)"
                    sub="En manos de usuarios" />
            </div>

            {/* ── Workload + Charts ──────────────────────────────────────── */}
            <div style={{
                background: 'var(--surface)', border: '1px solid var(--border)',
                borderRadius: '14px', padding: '1.5rem', marginBottom: '1.5rem'
            }}>
                <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: '0 0 1.25rem' }}>Carga de Trabajo (Empleados)</h3>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '2rem', alignItems: 'start' }}>

                    {/* Left: user list + timeline */}
                    <div>
                        {/* User rows */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
                            {workloadUsers.map((u, i) => (
                                <div key={u.id} style={{
                                    display: 'flex', alignItems: 'center', gap: '1rem',
                                    padding: '0.65rem 0',
                                    borderBottom: i < workloadUsers.length - 1 ? '1px solid var(--border)' : 'none'
                                }}>
                                    <span style={{ minWidth: '140px', fontWeight: 500, fontSize: '0.9rem' }}>{u.name}</span>
                                    <MiniBar value={u.active} max={maxActive} color={u.color} />
                                    <div style={{
                                        minWidth: '28px', height: '28px', borderRadius: '6px',
                                        background: u.active > 0 ? u.color : '#e5e7eb',
                                        color: u.active > 0 ? 'white' : '#9ca3af',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        fontSize: '0.8rem', fontWeight: 700
                                    }}>{u.active}</div>
                                </div>
                            ))}
                        </div>

                        {/* Timeline */}
                        <div style={{ marginTop: '1.5rem' }}>
                            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 500, marginBottom: '0.75rem', textAlign: 'center' }}>
                                Línea de Tiempo de Casos (Total Histórico)
                            </p>
                            <div style={{ display: 'flex', alignItems: 'flex-end', gap: '2px', height: '48px', marginBottom: '6px' }}>
                                {days.map((d, i) => (
                                    <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                        <div style={{
                                            width: '100%', borderRadius: '3px 3px 0 0',
                                            background: d.count > 0 ? '#3b82f6' : '#e5e7eb',
                                            height: `${(d.count / maxCount) * 40 + 4}px`,
                                            transition: 'height .3s'
                                        }} title={`${d.label}: ${d.count}`} />
                                    </div>
                                ))}
                            </div>
                            <div style={{ display: 'flex', gap: '2px' }}>
                                {days.map((d, i) => (
                                    <div key={i} style={{ flex: 1, textAlign: 'center', fontSize: '0.6rem', color: '#9ca3af', whiteSpace: 'nowrap' }}>
                                        {d.label}
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Right: donuts */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', alignItems: 'center', minWidth: '180px' }}>
                        {/* Type donut */}
                        <div>
                            <p style={{ fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.75rem', textAlign: 'center' }}>Carga de Trabajo por Tipo</p>
                            <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                                <DonutChart slices={donutType} size={110} thickness={20} label={typeTotal === 1 && (incidentes + solicitudes + mantenimiento) === 0 ? 0 : incidentes + solicitudes + mantenimiento} />
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                    {[
                                        { label: 'Incidentes', color: '#6b7280', val: incidentes },
                                        { label: 'Solicitudes', color: '#d1d5db', val: solicitudes },
                                        { label: 'Mantenimiento', color: '#e5e7eb', val: mantenimiento },
                                    ].map(l => (
                                        <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.72rem' }}>
                                            <span style={{ width: '10px', height: '10px', borderRadius: '2px', background: l.color, flexShrink: 0 }} />
                                            {l.label}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* Status donut */}
                        <div>
                            <p style={{ fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.75rem', textAlign: 'center' }}>Resueltos vs. Abiertos</p>
                            <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                                <DonutChart slices={donutStatus} size={110} thickness={20} label={openTickets + inProgress + resolved} />
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                    {[
                                        { label: `Abiertos: ${openTickets}`, color: '#3b82f6' },
                                        { label: `En Prog: ${inProgress}`, color: '#f59e0b' },
                                        { label: `Resueltos: ${resolved}`, color: '#22c55e' },
                                    ].map(l => (
                                        <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.72rem' }}>
                                            <span style={{ width: '10px', height: '10px', borderRadius: '2px', background: l.color, flexShrink: 0 }} />
                                            {l.label}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* ── System Status ─────────────────────────────────────────── */}
            <div style={{
                background: 'var(--surface)', border: '1px solid var(--border)',
                borderRadius: '14px', padding: '1.5rem'
            }}>
                <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: '0 0 1.25rem' }}>Estado del Sistema</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                    {[
                        { label: 'Base de Datos', status: 'Operativo', color: '#22c55e' },
                        { label: 'API Gateway', status: 'Precaución', color: '#f59e0b' },
                        { label: 'Persistencia Local', status: 'Activo', color: '#22c55e' },
                    ].map(s => (
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
