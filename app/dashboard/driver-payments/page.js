'use client';
import React, { useMemo, useState } from 'react';
import { useStore } from '../../../lib/store';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { calculateTicketFinancials, calculateTaskFinancials, getExchangeRateForDate } from '@/lib/billing';
import { CreditCard, Save, ChevronLeft, ChevronRight, Truck, Calendar, User } from 'lucide-react';
import Link from 'next/link';

export default function DriverPaymentsPage() {
    const { tickets, logisticsTasks, rates, updateRates, globalAssets, users } = useStore();
    const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
    const [paymentInputs, setPaymentInputs] = useState({});
    const [selectedDriver, setSelectedDriver] = useState('Todos');
    
    const monthKey = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}`;
    
    const exchangeRate = useMemo(() => {
        return getExchangeRateForDate(rates, new Date(selectedYear, selectedMonth, 1));
    }, [rates, selectedMonth, selectedYear]);

    const { driverStats, totalDue, totalPaid } = useMemo(() => {
        const stats = {};
        
        // 1. Process Tickets
        tickets.forEach(ticket => {
            const ticketDateStr = ticket.deliveryCompletedDate || ticket.createdAt;
            if (!ticketDateStr) return;
            const date = new Date(ticketDateStr);
            if (date.getMonth() !== selectedMonth || date.getFullYear() !== selectedYear) return;

            const financials = calculateTicketFinancials(ticket, rates, globalAssets, users, logisticsTasks);
            if (!financials) return;

            const method = financials.method || '';
            if (method.includes('Propio') || method === 'Envío Interno' || method.toLowerCase().includes('local')) {
                const driverName = financials.deliveryPerson;
                if (driverName && driverName !== 'N/A' && driverName !== 'Múltiple' && financials.logisticCost > 0) {
                    if (!stats[driverName]) stats[driverName] = { total: 0, items: [] };
                    stats[driverName].total += financials.logisticCost;
                    stats[driverName].items.push({
                        id: ticket.id,
                        type: 'Ticket',
                        description: ticket.subject || 'Sin Asunto',
                        cost: financials.logisticCost,
                        date: ticketDateStr
                    });
                }
            }
        });

        // 2. Process Logistic Tasks
        logisticsTasks.forEach(task => {
            const taskDateStr = task.completed_at || task.created_at;
            if (!taskDateStr || task.status !== 'Completada') return;
            const date = new Date(taskDateStr);
            if (date.getMonth() !== selectedMonth || date.getFullYear() !== selectedYear) return;

            const method = task.delivery_method || '';
            if (method.includes('Propio') || method === 'Envío Interno' || method.toLowerCase().includes('local')) {
                const driverName = task.delivery_person || task.assigned_to;
                if (driverName) {
                    const financials = calculateTaskFinancials(task, rates);
                    if (financials && financials.logisticCost > 0) {
                        if (!stats[driverName]) stats[driverName] = { total: 0, items: [] };
                        stats[driverName].total += financials.logisticCost;
                        stats[driverName].items.push({
                            id: task.id || 'Tarea Logística',
                            type: 'Tarea',
                            description: task.description || 'Movimiento de Inventario',
                            cost: financials.logisticCost,
                            date: taskDateStr
                        });
                    }
                }
            }
        });
        
        let tDue = 0;
        let tPaid = 0;
        
        Object.entries(stats).forEach(([driver, data]) => {
            tDue += data.total;
            const savedPayment = rates?.driverActualPayments?.[monthKey]?.[driver];
            if (savedPayment) {
                tPaid += Number(savedPayment);
            }
        });

        return { driverStats: stats, totalDue: tDue, totalPaid: tPaid };
    }, [tickets, logisticsTasks, rates, selectedMonth, selectedYear, monthKey, globalAssets, users]);

    const handleSavePayment = async (driverName) => {
        const inputVal = paymentInputs[driverName];
        if (inputVal === undefined || inputVal === '') return; // No change
        
        const numericVal = parseFloat(inputVal);
        if (isNaN(numericVal)) return;

        const currentActualPayments = rates?.driverActualPayments || {};
        const monthPayments = currentActualPayments[monthKey] || {};
        
        const newRates = {
            ...rates,
            driverActualPayments: {
                ...currentActualPayments,
                [monthKey]: {
                    ...monthPayments,
                    [driverName]: numericVal
                }
            }
        };

        await updateRates(newRates, true);
        alert(`Pago guardado para ${driverName}`);
    };

    const handleMonthChange = (delta) => {
        let newMonth = selectedMonth + delta;
        let newYear = selectedYear;
        if (newMonth > 11) {
            newMonth = 0;
            newYear++;
        } else if (newMonth < 0) {
            newMonth = 11;
            newYear--;
        }
        setSelectedMonth(newMonth);
        setSelectedYear(newYear);
    };

    const monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

    return (
        <div style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '2rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                    <h1 style={{ fontSize: '1.75rem', fontWeight: 'bold', color: 'var(--text-main)', marginBottom: '0.25rem' }}>Pago a Conductores</h1>
                    <p style={{ color: 'var(--text-secondary)' }}>Liquidación mensual detallada de servicios logísticos internos</p>
                </div>
                
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', background: 'var(--background)', padding: '0.5rem', borderRadius: '12px', border: '1px solid var(--border)' }}>
                    <Button variant="secondary" onClick={() => handleMonthChange(-1)} style={{ padding: '0.5rem' }}>
                        <ChevronLeft size={18} />
                    </Button>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600, minWidth: '130px', justifyContent: 'center' }}>
                        <Calendar size={18} style={{ color: 'var(--primary-color)' }} />
                        {monthNames[selectedMonth]} {selectedYear}
                    </div>
                    <Button variant="secondary" onClick={() => handleMonthChange(1)} style={{ padding: '0.5rem' }}>
                        <ChevronRight size={18} />
                    </Button>
                </div>
                
                {Object.keys(driverStats).length > 0 && (
                    <div style={{ display: 'flex', alignItems: 'center', background: 'var(--background)', padding: '0.5rem', borderRadius: '12px', border: '1px solid var(--border)' }}>
                        <User size={18} style={{ color: 'var(--text-secondary)', marginLeft: '0.5rem' }} />
                        <select 
                            value={selectedDriver}
                            onChange={(e) => setSelectedDriver(e.target.value)}
                            style={{ padding: '0.25rem 0.5rem', border: 'none', background: 'transparent', color: 'var(--text-main)', fontWeight: 600, outline: 'none', cursor: 'pointer' }}
                        >
                            <option value="Todos">Todos los Conductores</option>
                            {Object.keys(driverStats).sort().map(name => (
                                <option key={name} value={name}>{name}</option>
                            ))}
                        </select>
                    </div>
                )}
            </div>

            {/* Resumen General */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1rem' }}>
                <Card>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <div style={{ padding: '1rem', background: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6', borderRadius: '12px' }}>
                            <User size={24} />
                        </div>
                        <div>
                            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', fontWeight: 600 }}>CONDUCTORES ACTIVOS</p>
                            <h3 style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>{Object.keys(driverStats).length}</h3>
                        </div>
                    </div>
                </Card>
                <Card>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <div style={{ padding: '1rem', background: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b', borderRadius: '12px' }}>
                            <Truck size={24} />
                        </div>
                        <div>
                            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', fontWeight: 600 }}>TOTAL A PAGAR</p>
                            <h3 style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>USD {totalDue.toFixed(2)}</h3>
                            {exchangeRate > 0 && <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: 0 }}>ARS {(totalDue * exchangeRate).toLocaleString('es-AR', { minimumFractionDigits: 2 })}</p>}
                        </div>
                    </div>
                </Card>
                <Card>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <div style={{ padding: '1rem', background: 'rgba(16, 185, 129, 0.1)', color: '#10b981', borderRadius: '12px' }}>
                            <CreditCard size={24} />
                        </div>
                        <div>
                            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', fontWeight: 600 }}>TOTAL PAGADO</p>
                            <h3 style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>USD {totalPaid.toFixed(2)}</h3>
                            {exchangeRate > 0 && <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: 0 }}>ARS {(totalPaid * exchangeRate).toLocaleString('es-AR', { minimumFractionDigits: 2 })}</p>}
                        </div>
                    </div>
                </Card>
            </div>

            {/* Listado de Conductores */}
            {Object.keys(driverStats).length === 0 ? (
                <Card>
                    <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                        <Truck size={48} style={{ margin: '0 auto 1rem', opacity: 0.2 }} />
                        <h3>No hay servicios logísticos registrados</h3>
                        <p>No se encontraron envíos realizados por repartidores propios en {monthNames[selectedMonth]} de {selectedYear}.</p>
                    </div>
                </Card>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                    {Object.entries(driverStats)
                        .filter(([name]) => selectedDriver === 'Todos' || name === selectedDriver)
                        .sort((a,b) => b[1].total - a[1].total).map(([name, data]) => {
                        const savedPayment = rates?.driverActualPayments?.[monthKey]?.[name];
                        const inputRaw = paymentInputs[name];
                        const inputVal = inputRaw !== undefined ? inputRaw : (savedPayment !== undefined ? String(savedPayment) : '');
                        const isPaid = savedPayment !== undefined && savedPayment > 0;
                        const isFullyPaid = savedPayment >= data.total;

                        return (
                            <Card key={name} style={{ border: isPaid ? (isFullyPaid ? '1px solid rgba(16, 185, 129, 0.4)' : '1px solid rgba(245, 158, 11, 0.4)') : undefined }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                        <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'var(--primary-color)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '1.2rem' }}>
                                            {name.charAt(0).toUpperCase()}
                                        </div>
                                        <div>
                                            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-main)', margin: 0 }}>{name}</h3>
                                            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: 0 }}>{data.items.length} servicios completados</p>
                                        </div>
                                    </div>
                                    <div style={{ textAlign: 'right' }}>
                                        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600 }}>A PAGAR</div>
                                        <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-main)' }}>USD {data.total.toFixed(2)}</div>
                                        {exchangeRate > 0 && <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>ARS {(data.total * exchangeRate).toLocaleString('es-AR', { minimumFractionDigits: 2 })}</div>}
                                    </div>
                                </div>

                                {/* Tabla de servicios */}
                                <div style={{ overflowX: 'auto', marginBottom: '1.5rem', background: 'var(--background)', borderRadius: '8px', border: '1px solid var(--border)' }}>
                                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                                        <thead>
                                            <tr style={{ borderBottom: '1px solid var(--border)' }}>
                                                <th style={{ padding: '0.75rem 1rem', textAlign: 'left', color: 'var(--text-secondary)', fontWeight: 600 }}>ID</th>
                                                <th style={{ padding: '0.75rem 1rem', textAlign: 'left', color: 'var(--text-secondary)', fontWeight: 600 }}>Descripción</th>
                                                <th style={{ padding: '0.75rem 1rem', textAlign: 'right', color: 'var(--text-secondary)', fontWeight: 600 }}>Costo Logístico</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {data.items.map((item, idx) => (
                                                <tr key={idx} style={{ borderBottom: idx < data.items.length - 1 ? '1px solid var(--border)' : 'none' }}>
                                                    <td style={{ padding: '0.75rem 1rem', fontWeight: 500, color: 'var(--primary-color)' }}>
                                                        {item.type === 'Ticket' ? <Link href={`/dashboard/tickets/${item.id}`}>{item.id}</Link> : item.id}
                                                    </td>
                                                    <td style={{ padding: '0.75rem 1rem', color: 'var(--text-main)' }}>{item.description}</td>
                                                    <td style={{ padding: '0.75rem 1rem', textAlign: 'right', fontWeight: 600, color: 'var(--text-main)' }}>USD {item.cost.toFixed(2)}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>

                                {/* Area de pago */}
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem', background: isFullyPaid ? 'rgba(16, 185, 129, 0.05)' : (isPaid ? 'rgba(245, 158, 11, 0.05)' : 'rgba(0,0,0,0.02)'), borderRadius: '8px', flexWrap: 'wrap', gap: '1rem' }}>
                                    <div style={{ flex: 1, minWidth: '200px' }}>
                                        <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>PAGADO (REAL)</label>
                                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                                            <div style={{ position: 'relative', flex: 1, maxWidth: '250px' }}>
                                                <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)', fontSize: '0.85rem', fontWeight: 600 }}>USD</span>
                                                <input 
                                                    type="number"
                                                    value={inputVal}
                                                    onChange={(e) => setPaymentInputs({...paymentInputs, [name]: e.target.value})}
                                                    style={{ width: '100%', padding: '0.6rem 1rem 0.6rem 2.5rem', borderRadius: '6px', border: `1px solid ${isFullyPaid ? '#10b981' : 'var(--border)'}`, background: 'var(--card-bg)', color: 'var(--text-main)' }}
                                                    placeholder="0.00"
                                                />
                                            </div>
                                            <Button 
                                                onClick={() => handleSavePayment(name)}
                                                style={{ backgroundColor: 'var(--primary-color)', color: 'white', borderColor: 'var(--primary-color)' }}
                                            >
                                                <Save size={16} style={{ marginRight: '6px' }}/> Guardar
                                            </Button>
                                        </div>
                                    </div>
                                    {isPaid && (
                                        <div style={{ textAlign: 'right' }}>
                                            {isFullyPaid ? (
                                                <Badge style={{ background: 'rgba(16, 185, 129, 0.1)', color: '#10b981' }}>Completado</Badge>
                                            ) : (
                                                <Badge style={{ background: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b' }}>Pago Parcial (Deuda: USD {(data.total - Number(savedPayment)).toFixed(2)})</Badge>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </Card>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
