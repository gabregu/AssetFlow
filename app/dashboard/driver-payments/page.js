'use client';
import React, { useMemo, useState } from 'react';
import { useStore } from '../../../lib/store';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { calculateTicketFinancials, calculateTaskFinancials, getExchangeRateForDate } from '@/lib/billing';
import { CreditCard, Save, ChevronLeft, ChevronRight, Truck, Calendar, User, Printer } from 'lucide-react';
import Link from 'next/link';

export default function DriverPaymentsPage() {
    const { tickets, logisticsTasks, rates, updateRates, globalAssets, users } = useStore();
    const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
    const [paymentInputs, setPaymentInputs] = useState({});
    const [localChecks, setLocalChecks] = useState({});
    const [selectedDriver, setSelectedDriver] = useState('Todos');
    
    const monthKey = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}`;
    
    const exchangeRate = useMemo(() => {
        return getExchangeRateForDate(rates, new Date(selectedYear, selectedMonth, 1));
    }, [rates, selectedMonth, selectedYear]);

    const { driverStats, totalDue, totalPaid } = useMemo(() => {
        const stats = {};
        const processedTaskIds = new Set();
        
        // 1. Process Tickets
        tickets.forEach(ticket => {
            const ticketDateStr = ticket.deliveryCompletedDate || ticket.createdAt;
            if (!ticketDateStr) return;
            const date = new Date(ticketDateStr);
            if (date.getMonth() !== selectedMonth || date.getFullYear() !== selectedYear) return;

            const financials = calculateTicketFinancials(ticket, rates, globalAssets, users, logisticsTasks);
            if (!financials) return;

            if (financials.taskFinancials && financials.taskFinancials.length > 0) {
                // If it has sub-tasks, attribute costs to each driver individually
                financials.taskFinancials.forEach(tFin => {
                    if (tFin.taskId) processedTaskIds.add(String(tFin.taskId));
                    
                    const method = tFin.method || '';
                    if (method.includes('Propio') || method === 'Envío Interno' || method.toLowerCase().includes('local')) {
                        const driverName = tFin.deliveryPerson;
                        if (driverName && driverName !== 'N/A' && driverName !== 'Múltiple' && tFin.logisticCost > 0) {
                            if (!stats[driverName]) stats[driverName] = { total: 0, items: [] };
                            stats[driverName].total += tFin.logisticCost;
                            stats[driverName].items.push({
                                id: tFin.taskId || ticket.id,
                                type: 'Sub-caso',
                                description: tFin.taskSubject || ticket.subject || 'Sin Asunto',
                                requester: ticket.requester || null,
                                salesforceCase: tFin.taskRef || ticket.salesforceCase || null,
                                cost: tFin.logisticCost,
                                date: ticketDateStr
                            });
                        }
                    }
                });
            } else {
                // Normal single ticket
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
                            requester: ticket.requester || null,
                            salesforceCase: ticket.salesforceCase || null,
                            cost: financials.logisticCost,
                            date: ticketDateStr
                        });
                    }
                }
            }
        });

        // 2. Process Logistic Tasks
        logisticsTasks.forEach(task => {
            if (task.id && processedTaskIds.has(String(task.id))) return;
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
                            requester: null,
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
        
        // 1. Process Payment Value
        const currentActualPayments = rates?.driverActualPayments || {};
        const monthPayments = currentActualPayments[monthKey] || {};
        let numericValUSD = monthPayments[driverName]; // Keep existing by default

        if (inputVal !== undefined && inputVal !== '') {
            const numericValARS = parseFloat(inputVal);
            if (!isNaN(numericValARS)) {
                numericValUSD = exchangeRate > 0 ? numericValARS / exchangeRate : numericValARS;
            }
        }

        // 2. Process Checkboxes
        const currentItemChecks = rates?.driverItemChecks || {};
        const monthChecks = currentItemChecks[monthKey] || {};
        const driverChecks = monthChecks[driverName] || {};
        
        let newDriverChecks = { ...driverChecks };
        
        const items = driverStats[driverName]?.items || [];
        items.forEach(item => {
            const key = `${driverName}-${item.id}`;
            if (localChecks[key] !== undefined) {
                newDriverChecks[item.id] = localChecks[key];
            }
        });
        
        const newRates = {
            ...rates,
            driverActualPayments: {
                ...currentActualPayments,
                [monthKey]: {
                    ...monthPayments,
                    [driverName]: numericValUSD
                }
            },
            driverItemChecks: {
                ...currentItemChecks,
                [monthKey]: {
                    ...monthChecks,
                    [driverName]: newDriverChecks
                }
            }
        };

        await updateRates(newRates, true);
        
        // Clear local checks for this driver so they read from rates again
        setLocalChecks(prev => {
            const next = { ...prev };
            items.forEach(item => {
                delete next[`${driverName}-${item.id}`];
            });
            return next;
        });
        
        alert(`Liquidación guardada para ${driverName}`);
    };

    const handlePrintDriverCases = (driverName, data, savedPaymentUSD) => {
        const printWindow = window.open('', '_blank');
        if (!printWindow) return alert('Por favor, permite las ventanas emergentes (pop-ups) en tu navegador.');
        
        const period = `${monthNames[selectedMonth]} de ${selectedYear}`;
        const totalARS = exchangeRate > 0 ? (data.total * exchangeRate).toFixed(2) : '0.00';
        const paidUSD = savedPaymentUSD || 0;
        const debtUSD = data.total - paidUSD;
        
        let itemsHtml = '';
        data.items.forEach(item => {
            const req = item.requester || '-';
            const sfdc = item.salesforceCase ? `[${item.salesforceCase}] ` : '';
            itemsHtml += `
                <tr>
                    <td style="padding: 10px; border-bottom: 1px solid #e2e8f0;">${item.id}</td>
                    <td style="padding: 10px; border-bottom: 1px solid #e2e8f0;">${sfdc}${item.description}</td>
                    <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; text-align: center;">${req}</td>
                    <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; text-align: right; font-weight: bold;">USD ${item.cost.toFixed(2)}</td>
                </tr>
            `;
        });

        const arsHtml = exchangeRate > 0 ? `
            <div style="display: flex; justify-content: space-between; margin-bottom: 15px; font-size: 14px; color: #64748b;">
                <span>Total a Pagar (ARS):</span>
                <strong>ARS ${totalARS}</strong>
            </div>` : '';

        printWindow.document.write(`
            <html>
                <head>
                    <title>Liquidación de Servicios - ${driverName}</title>
                    <style>
                        @page { size: A4; margin: 1.5cm; }
                        body { font-family: system-ui, -apple-system, sans-serif; color: #1e293b; line-height: 1.5; }
                        table { width: 100%; border-collapse: collapse; margin-top: 20px; font-size: 14px; }
                        th { background: #f8fafc; padding: 10px; text-align: left; font-weight: 600; color: #64748b; text-transform: uppercase; border-bottom: 2px solid #e2e8f0; }
                    </style>
                </head>
                <body>
                    <div style="display: flex; justify-content: space-between; border-bottom: 2px solid #334155; padding-bottom: 15px; margin-bottom: 20px;">
                        <div>
                            <h1 style="margin: 0; font-size: 24px;">Liquidación de Servicios Logísticos</h1>
                            <p style="margin: 5px 0 0; color: #64748b; font-size: 16px;">Conductor: <strong>${driverName}</strong></p>
                        </div>
                        <div style="text-align: right;">
                            <div style="color: #64748b; font-weight: 600; font-size: 12px; text-transform: uppercase;">Período</div>
                            <div style="font-size: 18px; font-weight: bold;">${period}</div>
                            <div style="margin-top: 5px; font-size: 12px; color: #64748b;">Tipo de Cambio: ${exchangeRate > 0 ? '1 USD = ' + exchangeRate + ' ARS' : 'N/A'}</div>
                        </div>
                    </div>

                    <table>
                        <thead>
                            <tr>
                                <th>ID</th>
                                <th>Descripción</th>
                                <th style="text-align: center;">Solicitante</th>
                                <th style="text-align: right;">Costo</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${itemsHtml}
                        </tbody>
                    </table>

                    <div style="margin-top: 30px; display: flex; justify-content: flex-end;">
                        <div style="width: 300px; background: #f8fafc; padding: 20px; border-radius: 8px; border: 1px solid #e2e8f0;">
                            <div style="display: flex; justify-content: space-between; margin-bottom: 10px;">
                                <span style="color: #64748b;">Servicios Completados:</span>
                                <strong>${data.items.length}</strong>
                            </div>
                            <div style="display: flex; justify-content: space-between; margin-bottom: 10px; font-size: 18px;">
                                <span>Total a Pagar (USD):</span>
                                <strong>USD ${data.total.toFixed(2)}</strong>
                            </div>
                            </div>
                            ${arsHtml}
                            <div style="border-top: 1px solid #cbd5e1; margin: 10px 0;"></div>
                            <div style="display: flex; justify-content: space-between; margin-bottom: 5px; color: #10b981;">
                                <span>Monto Abonado:</span>
                                <strong>USD ${paidUSD.toFixed(2)}</strong>
                            </div>
                            <div style="display: flex; justify-content: space-between; color: ${debtUSD > 0.01 ? '#f59e0b' : '#64748b'};">
                                <span>Saldo Pendiente:</span>
                                <strong>USD ${debtUSD > 0.01 ? debtUSD.toFixed(2) : '0.00'}</strong>
                            </div>
                        </div>
                    </div>
                    
                    <div style="margin-top: 50px; text-align: center; color: #94a3b8; font-size: 12px;">
                        Documento generado desde el panel de control de AssetFlow.
                    </div>
                    
                    <script>
                        window.onload = function() { window.print(); }
                    </script>
                </body>
            </html>
        `);
        printWindow.document.close();
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
                        const savedPaymentUSD = rates?.driverActualPayments?.[monthKey]?.[name];
                        const savedPaymentARS = savedPaymentUSD !== undefined ? (exchangeRate > 0 ? savedPaymentUSD * exchangeRate : savedPaymentUSD) : undefined;
                        const inputRaw = paymentInputs[name];
                        const inputVal = inputRaw !== undefined ? inputRaw : (savedPaymentARS !== undefined ? String(savedPaymentARS.toFixed(2)) : '');
                        const isPaid = savedPaymentUSD !== undefined && savedPaymentUSD > 0;
                        const isFullyPaid = savedPaymentUSD >= data.total - 0.01; // Allow 1 cent tolerance for float

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
                                                <th style={{ padding: '0.75rem 1rem', width: '40px', textAlign: 'center' }}></th>
                                                <th style={{ padding: '0.75rem 1rem', textAlign: 'left', color: 'var(--text-secondary)', fontWeight: 600 }}>ID</th>
                                                <th style={{ padding: '0.75rem 1rem', textAlign: 'left', color: 'var(--text-secondary)', fontWeight: 600 }}>Descripción</th>
                                                <th style={{ padding: '0.75rem 1rem', textAlign: 'left', color: 'var(--text-secondary)', fontWeight: 600 }}>Solicitante</th>
                                                <th style={{ padding: '0.75rem 1rem', textAlign: 'right', color: 'var(--text-secondary)', fontWeight: 600 }}>Costo Logístico</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {data.items.map((item, idx) => {
                                                const checkKey = `${name}-${item.id}`;
                                                const isChecked = localChecks[checkKey] ?? (rates?.driverItemChecks?.[monthKey]?.[name]?.[item.id] || false);
                                                
                                                return (
                                                <tr key={idx} style={{ borderBottom: idx < data.items.length - 1 ? '1px solid var(--border)' : 'none', background: isChecked ? 'rgba(16, 185, 129, 0.05)' : 'transparent' }}>
                                                    <td style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>
                                                        <input 
                                                            type="checkbox" 
                                                            checked={isChecked}
                                                            onChange={() => setLocalChecks(prev => ({...prev, [checkKey]: !isChecked}))}
                                                            style={{ cursor: 'pointer', width: '16px', height: '16px' }}
                                                        />
                                                    </td>
                                                    <td style={{ padding: '0.75rem 1rem', fontWeight: 500, color: 'var(--primary-color)' }}>
                                                        {item.type === 'Ticket' ? <Link href={`/dashboard/tickets/${item.id}`}>{item.id}</Link> : item.id}
                                                    </td>
                                                    <td style={{ padding: '0.75rem 1rem', color: 'var(--text-main)', textDecoration: isChecked ? 'line-through' : 'none', opacity: isChecked ? 0.6 : 1 }}>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>

                                                            <span>{item.description}</span>
                                                        </div>
                                                    </td>
                                                    <td style={{ padding: '0.75rem 1rem', color: 'var(--text-main)', opacity: isChecked ? 0.6 : 1 }}>
                                                        {item.requester ? (
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                                <div style={{ width: '24px', height: '24px', borderRadius: '50%', backgroundColor: '#e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem', fontWeight: 600, color: '#475569' }}>
                                                                    {String(item.requester).charAt(0).toUpperCase()}
                                                                </div>
                                                                <div style={{ fontSize: '0.85rem' }}>{item.requester}</div>
                                                            </div>
                                                        ) : (
                                                            <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>-</span>
                                                        )}
                                                    </td>
                                                    <td style={{ padding: '0.75rem 1rem', textAlign: 'right', fontWeight: 600, color: 'var(--text-main)', opacity: isChecked ? 0.6 : 1 }}>USD {item.cost.toFixed(2)}</td>
                                                </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>

                                {/* Area de pago */}
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem', background: isFullyPaid ? 'rgba(16, 185, 129, 0.05)' : (isPaid ? 'rgba(245, 158, 11, 0.05)' : 'rgba(0,0,0,0.02)'), borderRadius: '8px', flexWrap: 'wrap', gap: '1rem' }}>
                                    <div style={{ flex: 1, minWidth: '200px' }}>
                                        <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>PAGADO (REAL)</label>
                                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                                            <div style={{ position: 'relative', flex: 1, maxWidth: '250px' }}>
                                                <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)', fontSize: '0.85rem', fontWeight: 600 }}>ARS</span>
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
                                            <Button 
                                                variant="secondary"
                                                onClick={() => handlePrintDriverCases(name, data, savedPaymentUSD)}
                                                style={{ padding: '0.6rem 1rem', border: '1px solid var(--border)' }}
                                            >
                                                <Printer size={16} style={{ marginRight: '6px' }}/> PDF
                                            </Button>
                                        </div>
                                    </div>
                                    {isPaid && (
                                        <div style={{ textAlign: 'right' }}>
                                            {isFullyPaid ? (
                                                <Badge style={{ background: 'rgba(16, 185, 129, 0.1)', color: '#10b981' }}>Completado</Badge>
                                            ) : (
                                                <Badge style={{ background: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b' }}>Pago Parcial (Deuda: USD {(data.total - Number(savedPaymentUSD)).toFixed(2)})</Badge>
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
