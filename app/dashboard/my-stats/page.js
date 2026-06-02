"use client";
import React, { useState, useMemo } from 'react';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { useStore } from '../../../lib/store';
import { Archive, AlertCircle, Truck, CheckCircle2, TrendingUp, ArrowUpRight, ClipboardList, BarChart3, User } from 'lucide-react';
import { resolveTicketServiceDetails, getRate, getExchangeRateForDate } from '@/lib/billing';

export default function MyStatsPage() {
    const { tickets, assets: globalAssets, currentUser, rates, users, logisticsTasks } = useStore();
    const [selectedMonthIndex, setSelectedMonthIndex] = useState(0);

    // Generamos las opciones del selector de meses (últimos 6 meses)
    const monthOptions = useMemo(() => {
        const options = [];
        const now = new Date();
        const currentMonth = now.getMonth();
        const currentYear = now.getFullYear();
        
        for (let i = 0; i < 6; i++) {
            const date = new Date(currentYear, currentMonth - i, 1);
            options.push({
                index: i,
                month: date.getMonth(),
                year: date.getFullYear(),
                label: date.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })
            });
        }
        return options;
    }, []);

    // Reutilizamos la lógica de aplanado de items (Tickets/Sub-Casos)
    const myAssignedItems = useMemo(() => {
        if (!currentUser) return [];
        const items = [];
        const uName = (currentUser.name || '').trim().toLowerCase();
        const uId = String(currentUser.id || currentUser.uid || currentUser.uuid || '');
        
        // --- 1. PROCESAR SUB-CASOS ---
        logisticsTasks.forEach(task => {
            const drvName = (task.delivery_person || task.deliveryPerson || '').trim().toLowerCase();
            const drvId = String(task.assigned_to || task.assignedTo || '');
            const isMeByName = drvName && (drvName === uName || uName.includes(drvName) || drvName.includes(uName));
            const isMeById = drvId && (drvId === uId);
            
            if (isMeByName || isMeById) {
                const pTicket = tickets.find(t => String(t.id) === String(task.ticket_id || task.ticketId));
                items.push({
                    id: pTicket?.id || task.ticket_id || 'N/A',
                    taskId: task.id,
                    isMainTicket: false,
                    displayDate: task.date || 'Pendiente',
                    displayStatus: task.status || 'Pendiente',
                    deliveryCompletedDate: task.updated_at,
                    parentTicket: pTicket,
                    caseData: task,
                });
            }
        });

        // --- 2. PROCESAR TICKETS LEGACY ---
        tickets.forEach(ticket => {
            const hasNewTasks = logisticsTasks.some(tk => String(tk.ticket_id) === String(ticket.id));
            if (hasNewTasks) return;

            const tDriverName = (ticket.logistics?.delivery_person || ticket.logistics?.deliveryPerson || '').trim().toLowerCase();
            const tDriverUid = String(ticket.logistics?.assigned_to || ticket.logistics?.assignedTo || '');
            const isMeLegacy = (tDriverName && (tDriverName === uName || uName.includes(tDriverName) || tDriverName.includes(uName))) || 
                               (tDriverUid && (tDriverUid === uId));
            
            if (isMeLegacy) {
                items.push({
                    ...ticket,
                    displayDate: ticket.logistics?.date || 'Sin fecha',
                    displayStatus: ticket.logistics?.status || 'Pendiente',
                    deliveryCompletedDate: ticket.logistics?.status === 'Entregado' ? ticket.updatedAt : null,
                    isMainTicket: true,
                    taskId: null
                });
            }
        });

        return items;
    }, [tickets, logisticsTasks, currentUser]);

    // Calcular todas las estadísticas
    const stats = useMemo(() => {
        const today = new Date().toLocaleDateString('en-CA');
        const now = new Date();
        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
        const startOfWeek = new Date(now);
        startOfWeek.setDate(now.getDate() - now.getDay());
        const endOfWeek = new Date(startOfWeek);
        endOfWeek.setDate(endOfWeek.getDate() + 6);

        // Mes y año seleccionados para liquidación
        const targetDate = new Date(now.getFullYear(), now.getMonth() - selectedMonthIndex, 1);
        const targetMonth = targetDate.getMonth();
        const targetYear = targetDate.getFullYear();

        let personalLiquidation = 0;
        let deliveriesCount = 0;
        let recoveriesCount = 0;
        let deliveredToday = 0;
        let finishedThisMonthCount = 0;
        let pendingThisWeekCount = 0;

        myAssignedItems.forEach(item => {
            const t = item.isMainTicket ? item : (item.parentTicket || item); 
            
            const rawDate = item.deliveryCompletedDate || item.date || item.displayDate;
            const isValidDate = rawDate && !['Pendiente', 'Sin fecha', 'Por definir'].includes(rawDate);
            const ticketDate = isValidDate ? new Date(rawDate.toString().includes('T') ? rawDate : rawDate + 'T00:00:00') : new Date();
            const isFinished = ['Resuelto', 'Caso SFDC Cerrado', 'Servicio Facturado'].includes(t.status || '') || item.displayStatus === 'Entregado' || item.displayStatus === 'Finalizado';

            // Liquidación detallada
            const { moveType: finalMoveType, assetType: finalDeviceType } = resolveTicketServiceDetails(t, globalAssets);
            const moveLower = (finalMoveType || '').toLowerCase();
            const isDelivery = moveLower.includes('entrega') || moveLower.includes('alta');
            const isRecovery = moveLower.includes('recupero') || moveLower.includes('retiro') || moveLower.includes('baja') || moveLower.includes('collection');

            const lowerDevice = (finalDeviceType || '').toLowerCase();
            const isLaptop = lowerDevice.includes('laptop') || lowerDevice.includes('macbook') || lowerDevice.includes('notebook') || lowerDevice.includes('equipo') || lowerDevice.includes('pc');
            const isPhone = lowerDevice.includes('smartphone') || lowerDevice.includes('celular') || lowerDevice.includes('iphone') || lowerDevice.includes('samsung');
            const isKey = lowerDevice.includes('key') || lowerDevice.includes('yubikey') || lowerDevice.includes('llave');

            const baseCommission = getRate(rates?.cost_Driver_Commission, rates?.driverCommission, 15);
            let extra = 0;

            const driverNameRaw = t.logistics?.deliveryPerson || '';
            let driverKey = null;
            const dLower = driverNameRaw.toLowerCase();

            const matchedUser = [...users].find(u => u.name && (dLower.includes(u.name.toLowerCase()) || u.name.toLowerCase().includes(dLower)));
            if (matchedUser) {
                driverKey = matchedUser.name;
            } else {
                if (dLower.includes('lucas')) driverKey = 'Lucas';
                else if (dLower.includes('facundo')) driverKey = 'Facundo';
                else if (dLower.includes('guillermo')) driverKey = 'Guillermo';
            }

            if (driverKey) {
                const moveKey = isDelivery ? 'Delivery' : (isRecovery ? 'Recovery' : null);
                const deviceKey = isLaptop ? 'Laptop' : (isPhone ? 'Smartphone' : (isKey ? 'Key' : null));
                if (moveKey && deviceKey) {
                    const rateKey = `driverExtra_${driverKey}_${moveKey}_${deviceKey}`;
                    const extraVal = rates?.[rateKey];
                    if (extraVal !== undefined && extraVal !== null && !isNaN(parseFloat(extraVal))) {
                        extra = parseFloat(extraVal);
                    }
                }
            }
            const amount = (baseCommission + extra);

            // Conteos diarios y semanales (siempre actuales)
            if (isFinished) {
                const completedDate = item.deliveryCompletedDate ? new Date(item.deliveryCompletedDate).toLocaleDateString('en-CA') : ticketDate.toLocaleDateString('en-CA');
                if (completedDate === today) deliveredToday++;
                
                const updatedAt = item.deliveryCompletedDate ? new Date(item.deliveryCompletedDate) : new Date();
                const currentMonth = now.getMonth();
                const currentYear = now.getFullYear();
                if (updatedAt.getMonth() === currentMonth && updatedAt.getFullYear() === currentYear) {
                    finishedThisMonthCount++;
                }
            } else if (item.displayStatus === 'En Transito' || item.displayStatus === 'Para Coordinar') {
                const deliveryDate = item.displayDate ? new Date(item.displayDate + 'T00:00:00') : null;
                if (deliveryDate && deliveryDate >= startOfWeek && deliveryDate <= endOfWeek) {
                    pendingThisWeekCount++;
                }
            }

            // Liquidación mensual filtrada por mes seleccionado
            if (isFinished && ticketDate.getMonth() === targetMonth && ticketDate.getFullYear() === targetYear) {
                personalLiquidation += amount;
                if (isDelivery) deliveriesCount++;
                if (isRecovery) recoveriesCount++;
            }
        });

        // Generar lista de los últimos 6 meses
        const historyData = [];
        const currentMonth = now.getMonth();
        const currentYear = now.getFullYear();
        for (let i = 5; i >= 0; i--) {
            const date = new Date(currentYear, currentMonth - i, 1);
            historyData.push({
                month: date.getMonth(),
                year: date.getFullYear(),
                label: date.toLocaleDateString('es-ES', { month: 'short' }).replace('.', ''),
                total: 0
            });
        }

        // Llenar datos reales en la evolución histórica de 6 meses
        myAssignedItems.forEach(item => {
            const t = item.isMainTicket ? item : (item.parentTicket || item); 
            const isFinished = ['Resuelto', 'Caso SFDC Cerrado', 'Servicio Facturado'].includes(t.status || '') || item.displayStatus === 'Entregado' || item.displayStatus === 'Finalizado';
            
            if (isFinished) {
                const rawDate = item.deliveryCompletedDate || item.date || item.displayDate;
                const isValidDate = rawDate && !['Pendiente', 'Sin fecha', 'Por definir'].includes(rawDate);
                if (isValidDate) {
                    const ticketDate = new Date(rawDate.toString().includes('T') ? rawDate : rawDate + 'T00:00:00');
                    const tMonth = ticketDate.getMonth();
                    const tYear = ticketDate.getFullYear();
                    
                    const match = historyData.find(h => h.month === tMonth && h.year === tYear);
                    if (match) {
                        match.total++;
                    }
                }
            }
        });

        return {
            total: myAssignedItems.length,
            pendiente: myAssignedItems.filter(t => !t.displayStatus || t.displayStatus === 'Pendiente').length,
            paraCoordinar: myAssignedItems.filter(t => t.displayStatus === 'Para Coordinar').length,
            enTransito: myAssignedItems.filter(t => t.displayStatus === 'En Transito').length,
            entregadosHoy: deliveredToday,
            finishedThisMonth: finishedThisMonthCount,
            pendingThisWeek: pendingThisWeekCount,
            personalLiquidation,
            deliveriesCount,
            recoveriesCount,
            historyData,
            targetMonth,
            targetYear
        };
    }, [myAssignedItems, globalAssets, currentUser, rates, users, selectedMonthIndex]);

    return (
        <div style={{ animation: 'fadeIn 0.5s ease-out', paddingBottom: '2rem' }}>
            {/* Título de la sección */}
            <div className="flex-mobile-column" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.25rem', gap: '1rem' }}>
                <div>
                    <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-main)', margin: 0, letterSpacing: '-0.02em', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <TrendingUp size={28} style={{ color: 'var(--primary-color)' }} />
                        Mis <span style={{ color: 'var(--primary-color)' }}>Números</span>
                    </h1>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.82rem', marginTop: '0.2rem' }}>
                        Visualiza el rendimiento de tus entregas y tu liquidación.
                    </p>
                </div>
                <div style={{ padding: '0.5rem', backgroundColor: 'rgba(59, 130, 246, 0.1)', borderRadius: '50%', color: '#3b82f6' }}>
                    <BarChart3 size={20} />
                </div>
            </div>

            {/* Rendimiento y Carga Semanal */}
            <div style={{ 
                marginBottom: '0.75rem',
                display: 'grid',
                gridTemplateColumns: 'repeat(2, 1fr)',
                gap: '0.5rem'
            }}>
                <Card style={{ padding: '0.8rem 1rem', borderLeft: '4px solid var(--primary-color)', backgroundColor: 'var(--surface)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
                            <span style={{ fontSize: '0.6rem', fontWeight: 800, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Rendimiento</span>
                            <span style={{ fontSize: '1.3rem', fontWeight: 900 }}>{stats.finishedThisMonth}</span>
                            <span style={{ fontSize: '0.65rem', color: '#10b981', display: 'flex', alignItems: 'center', gap: '1px', fontWeight: 600 }}>
                                <ArrowUpRight size={12} /> Mes actual
                            </span>
                        </div>
                    </div>
                </Card>

                <Card style={{ padding: '0.8rem 1rem', borderLeft: '4px solid #f59e0b', backgroundColor: 'var(--surface)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
                            <span style={{ fontSize: '0.6rem', fontWeight: 800, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Carga Semanal</span>
                            <span style={{ fontSize: '1.3rem', fontWeight: 900 }}>{stats.pendingThisWeek}</span>
                            <span style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Esta semana</span>
                        </div>
                    </div>
                </Card>
            </div>

            {/* Fila de Indicadores Básicos (2x2 en Móviles, 4x1 en Desktop) */}
            <div style={{ 
                marginBottom: '0.75rem',
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
                gap: '0.5rem'
            }}>
                <Card style={{ padding: '0.6rem 0.8rem', borderLeft: '4px solid #3b82f6', backgroundColor: 'var(--surface)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <div style={{ padding: '0.35rem', backgroundColor: '#eff6ff', borderRadius: '50%', color: '#3b82f6' }}>
                            <Archive size={16} />
                        </div>
                        <div>
                            <p style={{ color: 'var(--text-secondary)', fontSize: '0.62rem', margin: 0, textTransform: 'uppercase', fontWeight: 700 }}>Total Servicios</p>
                            <h3 style={{ fontSize: '1.1rem', fontWeight: 800, margin: 0 }}>{stats.total}</h3>
                        </div>
                    </div>
                </Card>

                <Card style={{ padding: '0.6rem 0.8rem', borderLeft: '4px solid #f97316', backgroundColor: 'var(--surface)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <div style={{ padding: '0.35rem', backgroundColor: '#fff7ed', borderRadius: '50%', color: '#f97316' }}>
                            <AlertCircle size={16} />
                        </div>
                        <div>
                            <p style={{ color: 'var(--text-secondary)', fontSize: '0.62rem', margin: 0, textTransform: 'uppercase', fontWeight: 700 }}>Para Coordinar</p>
                            <h3 style={{ fontSize: '1.1rem', fontWeight: 800, margin: 0 }}>{stats.paraCoordinar}</h3>
                        </div>
                    </div>
                </Card>

                <Card style={{ padding: '0.6rem 0.8rem', borderLeft: '4px solid #0ea5e9', backgroundColor: 'var(--surface)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <div style={{ padding: '0.35rem', backgroundColor: '#e0f2fe', borderRadius: '50%', color: '#0ea5e9' }}>
                            <Truck size={16} />
                        </div>
                        <div>
                            <p style={{ color: 'var(--text-secondary)', fontSize: '0.62rem', margin: 0, textTransform: 'uppercase', fontWeight: 700 }}>En Tránsito</p>
                            <h3 style={{ fontSize: '1.1rem', fontWeight: 800, margin: 0 }}>{stats.enTransito}</h3>
                        </div>
                    </div>
                </Card>

                <Card style={{ padding: '0.6rem 0.8rem', borderLeft: '4px solid #22c55e', backgroundColor: 'rgba(34, 197, 94, 0.05)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <div style={{ padding: '0.35rem', backgroundColor: '#f0fdf4', borderRadius: '50%', color: '#22c55e' }}>
                            <CheckCircle2 size={16} />
                        </div>
                        <div>
                            <p style={{ color: 'var(--text-secondary)', fontSize: '0.62rem', margin: 0, textTransform: 'uppercase', fontWeight: 700 }}>Entregados Hoy</p>
                            <h3 style={{ fontSize: '1.1rem', fontWeight: 800, margin: 0 }}>{stats.entregadosHoy}</h3>
                        </div>
                    </div>
                </Card>
            </div>

            {/* Fila de Liquidación y Evolución Histórica */}
            <div style={{ 
                display: 'grid', 
                gridTemplateColumns: 'repeat(auto-fit, minmax(290px, 1fr))', 
                gap: '0.75rem',
                marginBottom: '1rem'
            }}>
                {/* Resumen de Liquidación */}
                <Card style={{ padding: '1rem', borderLeft: '4px solid #8b5cf6', backgroundColor: 'var(--surface)', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                            <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: '#f5f3ff', color: '#8b5cf6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '1.2rem', border: '2px solid rgba(139, 92, 246, 0.1)' }}>
                                {(currentUser?.name || 'U').charAt(0).toUpperCase()}
                            </div>
                            <div>
                                <div style={{ fontWeight: 700, fontSize: '1.05rem', color: 'var(--text-main)' }}>{currentUser?.name}</div>
                                <select 
                                    value={selectedMonthIndex}
                                    onChange={(e) => setSelectedMonthIndex(parseInt(e.target.value))}
                                    style={{
                                        marginTop: '4px',
                                        padding: '3px 8px',
                                        borderRadius: '6px',
                                        border: '1px solid var(--border)',
                                        backgroundColor: 'var(--background)',
                                        color: 'var(--text-main)',
                                        fontSize: '0.72rem',
                                        outline: 'none',
                                        cursor: 'pointer',
                                        fontWeight: 600
                                    }}
                                >
                                    {monthOptions.map(opt => (
                                        <option key={opt.index} value={opt.index}>{opt.label}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                        <div style={{ textAlign: 'right', minWidth: '130px' }}>
                            <div style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 700 }}>Liquidación</div>
                            <div style={{ fontSize: '1.5rem', fontWeight: 850, color: 'var(--text-main)', letterSpacing: '-0.5px', marginTop: '2px' }}>
                                USD {stats.personalLiquidation.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                            </div>
                            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600, marginTop: '1px' }}>
                                {(() => {
                                    const currentMonthRate = getExchangeRateForDate(rates, new Date(stats.targetYear, stats.targetMonth, 15));
                                    return currentMonthRate > 0 ? (
                                        <>ARS {(stats.personalLiquidation * currentMonthRate).toLocaleString('es-AR', { minimumFractionDigits: 2 })}</>
                                    ) : (
                                        <span style={{ color: '#ef4444', fontSize: '0.65rem' }}>Sin cotización en Tarifas</span>
                                    );
                                })()}
                            </div>
                        </div>
                    </div>
                    
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.75rem', paddingTop: '0.5rem', borderTop: '1px dashed var(--border)' }}>
                        <Badge style={{ border: 'none', background: 'rgba(139, 92, 246, 0.05)', color: '#8b5cf6', padding: '0.2rem 0.5rem', fontSize: '0.7rem' }}>
                            {stats.deliveriesCount} entregas
                        </Badge>
                        <Badge style={{ border: 'none', background: 'rgba(139, 92, 246, 0.05)', color: '#8b5cf6', padding: '0.2rem 0.5rem', fontSize: '0.7rem' }}>
                            {stats.recoveriesCount} recuperos
                        </Badge>
                    </div>
                </Card>

                {/* Gráfico de Evolución de 6 Meses */}
                <Card style={{ padding: '1rem', backgroundColor: 'var(--surface)', display: 'flex', flexDirection: 'column', minHeight: '170px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.25rem' }}>
                        <BarChart3 size={16} style={{ color: '#8b5cf6' }} />
                        <span style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-secondary)' }}>Evolución 6 Meses</span>
                    </div>

                    <div style={{ 
                        height: '90px', 
                        display: 'flex', 
                        alignItems: 'flex-end', 
                        gap: '6px', 
                        paddingBottom: '5px',
                        borderBottom: '1px solid var(--border)'
                    }}>
                        {stats.historyData.map((h, i) => {
                            const maxTotal = Math.max(...stats.historyData.map(item => item.total), 1);
                            const percentHeight = (h.total / maxTotal) * 100;
                            const targetDate = new Date(new Date().getFullYear(), new Date().getMonth() - selectedMonthIndex, 1);
                            const isCurrentSelected = h.month === targetDate.getMonth() && h.year === targetDate.getFullYear();
                            
                            return (
                                <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', position: 'relative' }}>
                                    <span style={{ 
                                        fontSize: '0.6rem', 
                                        fontWeight: '800', 
                                        color: isCurrentSelected ? '#8b5cf6' : 'var(--text-secondary)',
                                        marginBottom: '2px'
                                    }}>
                                        {h.total}
                                    </span>
                                    
                                    <div style={{
                                        width: '100%',
                                        maxWidth: '24px',
                                        height: `${Math.max(percentHeight, 4)}%`,
                                        background: isCurrentSelected 
                                            ? 'linear-gradient(to top, #8b5cf6, #a78bfa)' 
                                            : 'rgba(139, 92, 246, 0.15)',
                                        borderRadius: '3px 3px 0 0',
                                        transition: 'all 0.4s ease'
                                    }} />
                                    
                                    <span style={{ 
                                        fontSize: '0.6rem', 
                                        fontWeight: 700, 
                                        color: isCurrentSelected ? 'var(--text-main)' : 'var(--text-secondary)',
                                        textTransform: 'capitalize',
                                        marginTop: '4px'
                                    }}>
                                        {h.label}
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                </Card>
            </div>
        </div>
    );
}
