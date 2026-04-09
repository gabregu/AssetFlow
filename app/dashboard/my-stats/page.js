"use client";
import React, { useMemo } from 'react';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { useStore } from '../../../lib/store';
import { Archive, AlertCircle, Truck, CheckCircle2, TrendingUp, ArrowUpRight, ClipboardList, BarChart3, User } from 'lucide-react';
import { resolveTicketServiceDetails, getRate } from '@/lib/billing';

export default function MyStatsPage() {
    const { tickets, assets: globalAssets, currentUser, rates, users, logisticsTasks } = useStore();

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
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const startOfWeek = new Date(now);
        startOfWeek.setDate(now.getDate() - now.getDay());
        const endOfWeek = new Date(startOfWeek);
        endOfWeek.setDate(endOfWeek.getDate() + 6);

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

            // Conteos diarios y semanales
            if (isFinished) {
                const completedDate = item.deliveryCompletedDate ? new Date(item.deliveryCompletedDate).toLocaleDateString('en-CA') : ticketDate.toLocaleDateString('en-CA');
                if (completedDate === today) deliveredToday++;
                
                const updatedAt = item.deliveryCompletedDate ? new Date(item.deliveryCompletedDate) : new Date();
                if (updatedAt >= startOfMonth) finishedThisMonthCount++;
            } else if (item.displayStatus === 'En Transito' || item.displayStatus === 'Para Coordinar') {
                const deliveryDate = item.displayDate ? new Date(item.displayDate + 'T00:00:00') : null;
                if (deliveryDate && deliveryDate >= startOfWeek && deliveryDate <= endOfWeek) {
                    pendingThisWeekCount++;
                }
            }

            // Liquidación mensual (mes actual)
            const currentMonth = now.getMonth();
            const currentYear = now.getFullYear();
            
            if (isFinished && ticketDate.getMonth() === currentMonth && ticketDate.getFullYear() === currentYear) {
                personalLiquidation += amount;
                if (isDelivery) deliveriesCount++;
                if (isRecovery) recoveriesCount++;
            }
        });

        const historyData = [];
        const currentMonth = now.getMonth();
        const currentYear = now.getFullYear();
        for (let i = 5; i >= 0; i--) {
            const date = new Date(currentYear, currentMonth - i, 1);
            historyData.push({
                month: date.getMonth(),
                year: date.getFullYear(),
                label: date.toLocaleDateString('es-ES', { month: 'short' }),
                total: 0 // Simplificado para visual
            });
        }

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
            historyData
        };
    }, [myAssignedItems, globalAssets, currentUser, rates, users]);

    return (
        <div style={{ animation: 'fadeIn 0.5s ease-out' }}>
            <div className="flex-mobile-column" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2rem', gap: '1rem' }}>
                <div>
                    <h1 style={{ fontSize: '1.8rem', fontWeight: 700, color: 'var(--text-main)', margin: 0, letterSpacing: '-0.02em', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <TrendingUp size={32} style={{ color: 'var(--primary-color)' }} />
                        Mis <span style={{ color: 'var(--primary-color)' }}>Números</span>
                    </h1>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', marginTop: '0.25rem' }}>
                        Visualiza el rendimiento de tus entregas y tu liquidación.
                    </p>
                </div>
                <div style={{ padding: '0.75rem', backgroundColor: 'rgba(59, 130, 246, 0.1)', borderRadius: '50%', color: '#3b82f6' }}>
                    <BarChart3 size={24} />
                </div>
            </div>

            <div className="grid-responsive-dashboard" style={{ marginBottom: '1.25rem' }}>
                <Card style={{ padding: '1.25rem', borderLeft: '5px solid var(--primary-color)', backgroundColor: 'var(--surface)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                            <span style={{ fontSize: '0.65rem', fontWeight: 800, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Rendimiento</span>
                            <span style={{ fontSize: '1.75rem', fontWeight: 900 }}>{stats.finishedThisMonth}</span>
                            <span style={{ fontSize: '0.75rem', color: '#10b981', display: 'flex', alignItems: 'center', gap: '2px', fontWeight: 600 }}>
                                <ArrowUpRight size={14} /> Entregados este mes
                            </span>
                        </div>
                        <div style={{ padding: '0.6rem', backgroundColor: 'var(--primary-light)', borderRadius: '12px', color: 'var(--primary-color)' }}>
                            <TrendingUp size={20} />
                        </div>
                    </div>
                </Card>

                <Card style={{ padding: '1.25rem', borderLeft: '5px solid #f59e0b', backgroundColor: 'var(--surface)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                            <span style={{ fontSize: '0.65rem', fontWeight: 800, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Carga Semanal</span>
                            <span style={{ fontSize: '1.75rem', fontWeight: 900 }}>{stats.pendingThisWeek}</span>
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Servicios para esta semana</span>
                        </div>
                        <div style={{ padding: '0.6rem', backgroundColor: '#fef3c7', borderRadius: '12px', color: '#f59e0b' }}>
                            <ClipboardList size={20} />
                        </div>
                    </div>
                </Card>
            </div>

            {/* Fila 1: Indicadores Básicos */}
            <div className="grid-responsive-4" style={{ marginBottom: '1.25rem' }}>
                <Card style={{ padding: '1.25rem', borderLeft: '4px solid #94a3b8', backgroundColor: 'var(--surface)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <div style={{ padding: '0.5rem', backgroundColor: '#f1f5f9', borderRadius: '50%', color: '#64748b' }}>
                            <Archive size={20} />
                        </div>
                        <div>
                            <p style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', margin: 0, textTransform: 'uppercase', fontWeight: 700 }}>Total Pendientes</p>
                            <h3 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0 }}>{stats.total}</h3>
                        </div>
                    </div>
                </Card>

                <Card style={{ padding: '1.25rem', borderLeft: '4px solid #f97316', backgroundColor: 'var(--surface)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <div style={{ padding: '0.5rem', backgroundColor: '#fff7ed', borderRadius: '50%', color: '#f97316' }}>
                            <AlertCircle size={20} />
                        </div>
                        <div>
                            <p style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', margin: 0, textTransform: 'uppercase', fontWeight: 700 }}>Para Coordinar</p>
                            <h3 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0 }}>{stats.paraCoordinar}</h3>
                        </div>
                    </div>
                </Card>

                <Card style={{ padding: '1.25rem', borderLeft: '4px solid #3b82f6', backgroundColor: 'var(--surface)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <div style={{ padding: '0.5rem', backgroundColor: '#eff6ff', borderRadius: '50%', color: '#3b82f6' }}>
                            <Truck size={20} />
                        </div>
                        <div>
                            <p style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', margin: 0, textTransform: 'uppercase', fontWeight: 700 }}>En Tránsito</p>
                            <h3 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0 }}>{stats.enTransito}</h3>
                        </div>
                    </div>
                </Card>

                <Card style={{ padding: '1.25rem', borderLeft: '4px solid #22c55e', backgroundColor: 'rgba(34, 197, 94, 0.05)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <div style={{ padding: '0.5rem', backgroundColor: '#f0fdf4', borderRadius: '50%', color: '#22c55e' }}>
                            <CheckCircle2 size={20} />
                        </div>
                        <div>
                            <p style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', margin: 0, textTransform: 'uppercase', fontWeight: 700 }}>Entregados Hoy</p>
                            <h3 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0 }}>{stats.entregadosHoy}</h3>
                        </div>
                    </div>
                </Card>
            </div>

            {/* Fila 2: Liquidación y Evolución */}
            <div className="grid-responsive-dashboard" style={{ marginBottom: '2rem' }}>
                {/* Resumen de Liquidación */}
                <Card style={{ padding: '1.5rem', borderLeft: '4px solid #8b5cf6', backgroundColor: 'var(--surface)', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
                            <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: '#f5f3ff', color: '#8b5cf6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '1.4rem', border: '2px solid rgba(139, 92, 246, 0.1)' }}>
                                {(currentUser?.name || 'U').charAt(0).toUpperCase()}
                            </div>
                            <div>
                                <div style={{ fontWeight: 700, fontSize: '1.2rem', color: 'var(--text-main)', marginBottom: '4px' }}>{currentUser?.name}</div>
                                <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <Badge variant="outline" style={{ border: 'none', background: 'rgba(139, 92, 246, 0.05)', color: '#8b5cf6' }}>{stats.deliveriesCount} entregas</Badge>
                                    <span style={{ opacity: 0.3 }}>|</span>
                                    <Badge variant="outline" style={{ border: 'none', background: 'rgba(139, 92, 246, 0.05)', color: '#8b5cf6' }}>{stats.recoveriesCount} recuperos</Badge>
                                </div>
                            </div>
                        </div>
                        <div style={{ textAlign: 'right', minWidth: '140px' }}>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 700, marginBottom: '2px' }}>Liquidación (Mes Actual)</div>
                            <div style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-main)', letterSpacing: '-0.5px' }}>
                                USD {stats.personalLiquidation.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                            </div>
                            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 500, marginTop: '2px' }}>
                                {rates?.exchangeRate ? (
                                    <>ARS {(stats.personalLiquidation * parseFloat(rates.exchangeRate)).toLocaleString('es-AR', { minimumFractionDigits: 2 })}</>
                                ) : (
                                    <span style={{ color: '#ef4444', fontSize: '0.7rem' }}>Sin TC Configurado</span>
                                )}
                            </div>
                        </div>
                    </div>
                </Card>

                {/* Grafico Placeholder */}
                <Card style={{ padding: '1.5rem', backgroundColor: 'var(--surface)', display: 'flex', flexDirection: 'column' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <BarChart3 size={18} style={{ color: '#8b5cf6' }} />
                            <span style={{ fontSize: '0.85rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-secondary)' }}>Evolución 6 Meses</span>
                        </div>
                        <span style={{ fontSize: '0.75rem', color: '#8b5cf6', fontWeight: 600 }}>Próximamente...</span>
                    </div>

                    <div style={{ height: '80px', display: 'flex', alignItems: 'flex-end', gap: '10px', paddingBottom: '5px', opacity: 0.5 }}>
                        {stats.historyData.map((h, i) => {
                            const max = 1;
                            const height = 10;
                            return (
                                <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
                                    <div style={{
                                        width: '100%',
                                        height: `${Math.max(height, 5)}%`,
                                        background: i === 5 ? 'linear-gradient(to top, #8b5cf6, #a78bfa)' : 'rgba(139, 92, 246, 0.15)',
                                        borderRadius: '4px',
                                        transition: 'height 0.4s ease'
                                    }} />
                                    <span style={{ fontSize: '0.65rem', fontWeight: 700, color: i === 5 ? 'var(--text-main)' : 'var(--text-secondary)' }}>{h.label}</span>
                                </div>
                            );
                        })}
                    </div>
                </Card>
            </div>
        </div>
    );
}
