import React from 'react';

// ── Mini Donut SVG ──────────────────────────────────────────────────────────
export function DonutChart({ slices, size = 120, thickness = 22, label }) {
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
export function MiniBar({ value, max, color }) {
    const pct = max > 0 ? (value / max) * 100 : 0;
    return (
        <div style={{ height: '6px', background: '#e5e7eb', borderRadius: '99px', overflow: 'hidden', flex: 1 }}>
            <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: '99px', transition: 'width .4s' }} />
        </div>
    );
}

const USER_ICONS = []; // We will receive these as props or just not render them if not needed, but wait! The original code used lucide-react icons in the map, but it didn't render them! It just showed the color block with `u.active`. Let's just use the color block.

export function WorkloadSection({ title, tickets, users, logisticsTasks, isHistorical, monthSelector, selectedMonth, onMonthChange, availableMonths, userColors }) {
    // ── Workload per user ──────────────────────────────────────────────────
    const workloadUsers = (users || []).map((u, i) => {
        const un = String(u.name || u.username || '').toLowerCase();
        const unParts = un.split(' ');
        const matchesUser = (assigned) => {
            const a = String(assigned || '').toLowerCase();
            return a === un || (a && un && a.includes(un)) || (a && unParts.length > 0 && a.includes(unParts[0]));
        };

        const allAssignedTickets = tickets.filter(t => {
            const tasks = (logisticsTasks || []).filter(task => String(task.ticket_id) === String(t.id));
            const taskAssigned = tasks.some(task => matchesUser(task.delivery_person || task.deliveryPerson || task.assigned_to || task.assignedTo));
            const ticketAssigned = matchesUser(t.logistics?.deliveryPerson || t.logistics?.delivery_person || t.assignedTo || t.assignee || t.owner);
            return ticketAssigned || taskAssigned;
        });

        const activeTickets = allAssignedTickets.filter(t => {
            if (['Resuelto', 'Cerrado', 'Cancelado'].includes(t.status)) return false;
            const tasks = (logisticsTasks || []).filter(task => String(task.ticket_id) === String(t.id) && !['Resuelto', 'Cerrado', 'Cancelado', 'Entregado'].includes(task.status));
            const taskAssigned = tasks.some(task => matchesUser(task.delivery_person || task.deliveryPerson || task.assigned_to || task.assignedTo));
            const ticketAssigned = matchesUser(t.logistics?.deliveryPerson || t.logistics?.delivery_person || t.assignedTo || t.assignee || t.owner);
            return ticketAssigned || taskAssigned;
        });

        let monthTotal = 0;
        if (isHistorical) {
            monthTotal = allAssignedTickets.length;
        } else {
            const currentMonthString = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
            monthTotal = allAssignedTickets.filter(t => {
                const dateStr = t.created_at || t.createdAt || t.date || t.dateOpened;
                if (!dateStr) return false;
                const td = new Date(dateStr);
                if (isNaN(td.getTime())) return false;
                return `${td.getFullYear()}-${String(td.getMonth() + 1).padStart(2, '0')}` === currentMonthString;
            }).length;
        }

        const active = isHistorical ? monthTotal : activeTickets.length;
        const baseTicketsForTypes = isHistorical ? allAssignedTickets : activeTickets;
        const entregas = baseTicketsForTypes.filter(t => t.type === 'Entrega' || t.logistics?.type === 'Entrega').length;
        const recolecciones = baseTicketsForTypes.filter(t => t.type === 'Recolección' || t.logistics?.type === 'Recolección' || t.logistics?.type === 'Recoleccion').length;

        return { ...u, active, monthTotal, entregas, recolecciones, color: userColors[i % userColors.length] };
    }).filter(u => u.active > 0 || u.monthTotal > 0);
    
    const maxActive = Math.max(...workloadUsers.map(u => u.active), 1);

    // ── Timeline ───────────────────────────────────────────────────────────
    let days = [];
    if (isHistorical && selectedMonth) {
        const [year, month] = selectedMonth.split('-');
        const daysInMonth = new Date(year, month, 0).getDate();
        days = Array.from({ length: daysInMonth }, (_, i) => {
            const d = new Date(year, month - 1, i + 1);
            const label = i % 3 === 0 ? d.toLocaleDateString('es-AR', { day: 'numeric', month: 'short' }) : ''; 
            const count = tickets.filter(t => {
                const ticketDateStr = t.created_at || t.createdAt || t.date || t.dateOpened;
                if (!ticketDateStr) return false;
                const td = new Date(ticketDateStr);
                if (isNaN(td.getTime())) return false;
                return td.toDateString() === d.toDateString();
            }).length;
            return { label, count, tooltip: d.toLocaleDateString('es-AR', { day: 'numeric', month: 'short' }) };
        });
    } else {
        const today = new Date();
        const year = today.getFullYear();
        const month = today.getMonth();
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        days = Array.from({ length: daysInMonth }, (_, i) => {
            const d = new Date(year, month, i + 1);
            const label = i % 3 === 0 ? d.toLocaleDateString('es-AR', { day: 'numeric', month: 'short' }) : '';
            const count = tickets.filter(t => {
                const ticketDateStr = t.created_at || t.createdAt || t.date || t.dateOpened;
                if (!ticketDateStr) return false;
                const td = new Date(ticketDateStr);
                if (isNaN(td.getTime())) return false;
                return td.toDateString() === d.toDateString();
            }).length;
            return { label, count, tooltip: d.toLocaleDateString('es-AR', { day: 'numeric', month: 'short' }) };
        });
    }
    const maxCount = Math.max(...days.map(d => d.count), 1);

    // ── Donut data ─────────────────────────────────────────────────────────
    const entregas = tickets.filter(t => t.type === 'Entrega' || t.logistics?.type === 'Entrega').length;
    const recolecciones = tickets.filter(t => t.type === 'Recolección' || t.logistics?.type === 'Recolección' || t.logistics?.type === 'Recoleccion').length;
    const otros = tickets.length - (entregas + recolecciones);
    const typeTotal = entregas + recolecciones + otros || 1;

    const donutType = [
        { value: entregas, color: '#3b82f6' },
        { value: recolecciones, color: '#f59e0b' },
        { value: otros, color: '#6b7280' },
    ];
    
    const openTickets = tickets.filter(t => t.status === 'Pendiente').length;
    const inProgress = tickets.filter(t => t.status === 'En Progreso').length;
    const resolved = tickets.filter(t => ['Resuelto', 'Cerrado'].includes(t.status)).length;
    
    const donutStatus = [
        { value: openTickets, color: '#3b82f6' },
        { value: inProgress, color: '#f59e0b' },
        { value: resolved, color: '#22c55e' },
    ];

    return (
        <div className="card" style={{
            marginBottom: '1.5rem'
        }}>
            <div className="flex-mobile-column" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', gap: '1rem' }}>
                <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: 0 }}>{title}</h3>
                {monthSelector && availableMonths?.length > 0 && (
                    <select
                        value={selectedMonth}
                        onChange={e => onMonthChange(e.target.value)}
                        style={{
                            padding: '0.4rem 0.8rem',
                            borderRadius: '8px',
                            border: '1px solid var(--border)',
                            background: 'var(--surface)',
                            fontSize: '0.85rem',
                            fontWeight: 500,
                            color: 'var(--text-main)',
                            outline: 'none',
                            cursor: 'pointer'
                        }}
                    >
                        {availableMonths.map(m => {
                            const [y, mo] = m.split('-');
                            const date = new Date(y, mo - 1, 1);
                            const label = date.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' });
                            return <option key={m} value={m}>{label.charAt(0).toUpperCase() + label.slice(1)}</option>;
                        })}
                    </select>
                )}
            </div>

            <div className="grid-mobile-single" style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '2rem', alignItems: 'start' }}>
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
                                <div style={{ minWidth: '140px', display: 'flex', flexDirection: 'column' }}>
                                    <span style={{ fontWeight: 500, fontSize: '0.9rem' }}>{u.name}</span>
                                    <div style={{ display: 'flex', gap: '6px', fontSize: '0.65rem', marginTop: '2px', opacity: 0.8 }}>
                                        <span style={{ color: '#3b82f6', fontWeight: 600 }}>{u.entregas} Entregas</span>
                                        <span style={{ color: '#f59e0b', fontWeight: 600 }}>{u.recolecciones} Recolecciones</span>
                                        {!isHistorical && (
                                            <>
                                                <span style={{ color: '#9ca3af' }}>|</span>
                                                <span style={{ color: '#10b981', fontWeight: 600 }}>Total mes: {u.monthTotal}</span>
                                            </>
                                        )}
                                    </div>
                                </div>
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
                        {workloadUsers.length === 0 && (
                            <div style={{ padding: '1rem', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                                No hay tickets para mostrar en este período.
                            </div>
                        )}
                    </div>

                    {/* Timeline */}
                    <div style={{ marginTop: '1.5rem' }}>
                        <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 500, marginBottom: '0.75rem', textAlign: 'center' }}>
                            {isHistorical ? 'Línea de Tiempo de Casos (Total del Período)' : 'Línea de Tiempo de Casos (Mes en Curso)'}
                        </p>
                        <div style={{ display: 'flex', alignItems: 'flex-end', gap: '2px', height: '48px', marginBottom: '6px' }}>
                            {days.map((d, i) => (
                                <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                    <div style={{
                                        width: '100%', borderRadius: '3px 3px 0 0',
                                        background: d.count > 0 ? '#3b82f6' : '#e5e7eb',
                                        height: `${(d.count / maxCount) * 40 + 4}px`,
                                        transition: 'height .3s'
                                    }} title={`${d.tooltip}: ${d.count}`} />
                                </div>
                            ))}
                        </div>
                        <div style={{ display: 'flex', gap: '2px' }}>
                            {days.map((d, i) => (
                                <div key={i} style={{ flex: 1, textAlign: 'center', fontSize: '0.55rem', color: '#9ca3af', whiteSpace: 'nowrap', overflow: 'hidden' }}>
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
                            <DonutChart slices={donutType} size={110} thickness={20} label={typeTotal === 1 && (entregas + recolecciones + otros) === 0 ? 0 : entregas + recolecciones + otros} />
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                {[
                                    { label: 'Entregas', color: '#3b82f6', val: entregas },
                                    { label: 'Recolecciones', color: '#f59e0b', val: recolecciones },
                                    { label: 'Otros', color: '#6b7280', val: otros },
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
    );
}
