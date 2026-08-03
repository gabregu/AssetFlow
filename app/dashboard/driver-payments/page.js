'use client';
import React, { useMemo, useState, useEffect } from 'react';
import { useStore } from '../../../lib/store';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { calculateTicketFinancials, calculateTaskFinancials, getExchangeRateForDate } from '@/lib/billing';
import { CreditCard, Save, ChevronLeft, ChevronRight, Truck, Calendar, User, Printer, Briefcase } from 'lucide-react';
import Link from 'next/link';

export default function DriverPaymentsPage() {
    const { tickets, logisticsTasks, rates, updateRates, assets: globalAssets, users } = useStore();
    const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
    const [paymentInputs, setPaymentInputs] = useState({});
    const [paymentDates, setPaymentDates] = useState({});
    const [paymentMethods, setPaymentMethods] = useState({});
    const [localChecks, setLocalChecks] = useState({});
    const [selectedDriver, setSelectedDriver] = useState('Todos');
    const [selectedClientFilter, setSelectedClientFilter] = useState('Todos');
    
    const monthKey = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}`;
    
    const exchangeRate = useMemo(() => {
        return getExchangeRateForDate(rates, new Date(selectedYear, selectedMonth, 1));
    }, [rates, selectedMonth, selectedYear]);

    const isClosedStatus = (statusStr) => {
        if (!statusStr) return false;
        const s = String(statusStr).trim().toLowerCase();
        return [
            'entregado',
            'completada',
            'completado',
            'finalizado',
            'recuperado',
            'resuelto',
            'cerrado',
            'cerrada',
            'servicio facturado',
            'caso sfdc cerrado'
        ].includes(s);
    };

    const { driverStats, totalDue, totalPaid } = useMemo(() => {
        const stats = {};
        const processedTaskIds = new Set();
        
        // 1. Process Tickets
        tickets.forEach(ticket => {
            const financials = calculateTicketFinancials(ticket, rates, globalAssets, users, logisticsTasks);
            if (!financials) return;

            const ticketDateStr = ticket.deliveryCompletedDate || ticket.createdAt;

            if (financials.taskFinancials && financials.taskFinancials.length > 0) {
                // If it has sub-tasks, attribute costs to each driver individually based on the sub-task's date
                financials.taskFinancials.forEach(tFin => {
                    const taskObj = logisticsTasks.find(lt => String(lt.id) === String(tFin.taskId));
                    
                    // Filter: Only include tasks/cases that are performed/closed
                    let taskStatus = taskObj?.status;
                    if (!taskStatus && ticket.associatedCases) {
                        const assoc = ticket.associatedCases.find(c => String(c.caseNumber || c.id) === String(tFin.taskRef || tFin.taskId));
                        if (assoc) taskStatus = assoc.status;
                    }
                    if (!taskStatus) taskStatus = ticket.logistics?.status || ticket.status;

                    if (!isClosedStatus(taskStatus)) return;

                    // Unified task stable date
                    let taskDateStr = null;
                    if (taskObj) {
                        if (taskObj.date && taskObj.date !== 'Pendiente' && taskObj.date !== 'Sin fecha') {
                            taskDateStr = taskObj.date;
                        } else if (taskObj.delivery_info?.deliveredAt) {
                            taskDateStr = taskObj.delivery_info.deliveredAt.substring(0, 10);
                        } else {
                            taskDateStr = taskObj.created_at ? taskObj.created_at.substring(0, 10) : null;
                        }
                    }
                    if (!taskDateStr) taskDateStr = tFin.date || ticketDateStr;
                    if (!taskDateStr) return;

                    const date = new Date(taskDateStr.toString().includes('T') ? taskDateStr : taskDateStr + 'T00:00:00');
                    if (date.getMonth() !== selectedMonth || date.getFullYear() !== selectedYear) return;

                    if (tFin.taskId) processedTaskIds.add(String(tFin.taskId));
                    
                    const method = tFin.method || '';
                    if (method.includes('Propio') || method === 'Envío Interno' || method.toLowerCase().includes('local')) {
                        const driverName = tFin.deliveryPerson;

                        // Resolve effective logistic cost for this task:
                        // If the parent ticket has a customLogisticCost set in the financial summary
                        // (Proyección Financiera), use that as the final cost for the driver.
                        // When there are multiple driver tasks, distribute proportionally.
                        let effectiveLogisticCost = tFin.logisticCost;
                        const rawCustom = ticket.deliveryDetails?.customLogisticCost;
                        if (rawCustom !== null && rawCustom !== undefined && rawCustom !== '') {
                            const customVal = parseFloat(rawCustom);
                            if (!isNaN(customVal)) {
                                const internalTasks = financials.taskFinancials.filter(t =>
                                    (t.method || '').includes('Propio') ||
                                    (t.method || '') === 'Envío Interno' ||
                                    (t.method || '').toLowerCase().includes('local')
                                );
                                const totalAutoCost = internalTasks.reduce((s, t) => s + t.logisticCost, 0);
                                // Distribute the override proportionally to each driver task
                                effectiveLogisticCost = totalAutoCost > 0
                                    ? customVal * (tFin.logisticCost / totalAutoCost)
                                    : customVal / (internalTasks.length || 1);
                                // Convert if saved in ARS
                                if (ticket.deliveryDetails?.customLogisticCostCurrency === 'ARS') {
                                    const r = getExchangeRateForDate(rates, ticket.createdAt || new Date());
                                    effectiveLogisticCost = effectiveLogisticCost / (r > 0 ? r : 1);
                                }
                            }
                        }

                        if (driverName && driverName !== 'N/A' && driverName !== 'Múltiple' && effectiveLogisticCost > 0) {
                            if (!stats[driverName]) stats[driverName] = { total: 0, items: [] };
                            stats[driverName].total += effectiveLogisticCost;
                            stats[driverName].items.push({
                                id: ticket.id,
                                type: 'Sub-caso',
                                description: (() => {
                                    const assetRefs = Array.from(new Set(tFin.assetCases || []));
                                    let subject = tFin.taskSubject || ticket.subject || 'Sin Asunto';
                                    
                                    if (assetRefs.length > 0) {
                                        const prefixes = assetRefs.map(ref => {
                                            const cleanRef = String(ref).trim();
                                            return /^\d+$/.test(cleanRef) ? `SFDC-${cleanRef}` : cleanRef;
                                        });
                                        const missingPrefixes = prefixes.filter(prefix => !subject.includes(prefix));
                                        if (missingPrefixes.length > 0) {
                                            const prefixHeader = missingPrefixes.map(p => `[${p}]`).join('');
                                            return `${prefixHeader} ${subject}`;
                                        }
                                    }
                                    
                                    const ref = tFin.taskRef || ticket.salesforceCase;
                                    if (ref) {
                                        const cleanRef = String(ref).trim();
                                        const prefix = /^\d+$/.test(cleanRef) ? `SFDC-${cleanRef}` : cleanRef;
                                        if (!subject.includes(prefix)) {
                                            return `[${prefix}] ${subject}`;
                                        }
                                    }
                                    return subject;
                                })(),
                                requester: ticket.requester || null,
                                cost: effectiveLogisticCost,
                                date: taskDateStr,
                                client: ticket.client || 'N/A'
                            });
                        }
                    }
                });
            } else {
                // Normal single ticket
                const ticketStatus = ticket.logistics?.status || ticket.status;
                if (!isClosedStatus(ticketStatus)) return;

                if (!ticketDateStr) return;
                const date = new Date(ticketDateStr);
                if (date.getMonth() !== selectedMonth || date.getFullYear() !== selectedYear) return;

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
                            cost: financials.logisticCost,
                            date: ticketDateStr,
                            client: ticket.client || 'N/A'
                        });
                    }
                }
            }
        });

        // 2. Process Logistic Tasks
        logisticsTasks.forEach(task => {
            if (task.id && processedTaskIds.has(String(task.id))) return;
            
            // Filter: Only include tasks that are performed/closed
            if (!isClosedStatus(task.status)) return;

            // Unified task stable date
            let taskDateStr = null;
            if (task.date && task.date !== 'Pendiente' && task.date !== 'Sin fecha') {
                taskDateStr = task.date;
            } else if (task.delivery_info?.deliveredAt) {
                taskDateStr = task.delivery_info.deliveredAt.substring(0, 10);
            } else {
                taskDateStr = task.created_at ? task.created_at.substring(0, 10) : null;
            }
            if (!taskDateStr) return;

            const date = new Date(taskDateStr.toString().includes('T') ? taskDateStr : taskDateStr + 'T00:00:00');
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
                            date: taskDateStr,
                            client: 'Inventario'
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

    const availableClients = useMemo(() => {
        const clients = new Set();
        Object.values(driverStats).forEach(driver => {
            driver.items.forEach(item => {
                if (item.client) clients.add(item.client);
            });
        });
        return ['Todos', ...Array.from(clients).sort()];
    }, [driverStats]);

    useEffect(() => {
        if (!availableClients.includes(selectedClientFilter)) {
            setSelectedClientFilter('Todos');
        }
    }, [availableClients, selectedClientFilter]);

    const handleSavePayment = async (driverName) => {
        const inputVal = paymentInputs[driverName];
        const dateVal = paymentDates[driverName];
        const methodVal = paymentMethods[driverName];
        
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

        // Process Date and Method
        const currentPaymentDates = rates?.driverPaymentDates || {};
        const monthPaymentDates = currentPaymentDates[monthKey] || {};
        const savedDate = dateVal !== undefined ? dateVal : (monthPaymentDates[driverName] || null);

        const currentPaymentMethods = rates?.driverPaymentMethods || {};
        const monthPaymentMethods = currentPaymentMethods[monthKey] || {};
        const savedMethod = methodVal !== undefined ? methodVal : (monthPaymentMethods[driverName] || null);

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
            driverPaymentDates: {
                ...currentPaymentDates,
                [monthKey]: {
                    ...monthPaymentDates,
                    [driverName]: savedDate
                }
            },
            driverPaymentMethods: {
                ...currentPaymentMethods,
                [monthKey]: {
                    ...monthPaymentMethods,
                    [driverName]: savedMethod
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
        const rate = exchangeRate > 0 ? exchangeRate : 1;

        // Always work in ARS as primary currency
        const totalUSD = data.total;
        const totalARS = totalUSD * rate;
        const savedPaymentARS = (savedPaymentUSD || 0) * rate;
        const debtARS = totalARS - savedPaymentARS;

        const savedDate = rates?.driverPaymentDates?.[monthKey]?.[driverName];
        const savedMethod = rates?.driverPaymentMethods?.[monthKey]?.[driverName];
        
        const formattedSavedDate = savedDate
            ? savedDate.split('-').reverse().join('/')
            : null;

        // Build items rows — cost shown in ARS
        let itemsHtml = '';
        data.items.forEach((item, idx) => {
            const itemARS = item.cost * rate;
            const clientVal = item.client || 'N/A';
            const dateVal = item.date
                ? item.date.substring(0, 10).split('-').reverse().join('/')
                : '-';
            const bg = idx % 2 === 0 ? '#ffffff' : '#f8fafc';
            itemsHtml += `
                <tr style="background:${bg};">
                    <td style="padding: 9px 10px; border-bottom: 1px solid #e2e8f0; font-size: 12px; color: #64748b;">${idx + 1}</td>
                    <td style="padding: 9px 10px; border-bottom: 1px solid #e2e8f0; font-size: 13px;">${item.description}</td>
                    <td style="padding: 9px 10px; border-bottom: 1px solid #e2e8f0; font-size: 12px; text-align: center; color: #475569;">${clientVal}</td>
                    <td style="padding: 9px 10px; border-bottom: 1px solid #e2e8f0; font-size: 12px; text-align: center; color: #475569;">${dateVal}</td>
                    <td style="padding: 9px 10px; border-bottom: 1px solid #e2e8f0; text-align: right; font-weight: 700; font-size: 13px;">$ ${itemARS.toLocaleString('es-AR', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
                </tr>
            `;
        });

        // Totals section
        const paidRowHtml = savedPaymentARS > 0 ? `
            <tr>
                <td colspan="4" style="padding: 8px 10px; text-align: right; font-size: 13px; color: #10b981;">Monto Abonado:</td>
                <td style="padding: 8px 10px; text-align: right; font-weight: 700; font-size: 13px; color: #10b981;">$ ${savedPaymentARS.toLocaleString('es-AR', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
            </tr>
            <tr>
                <td colspan="4" style="padding: 8px 10px; text-align: right; font-size: 13px; color: ${debtARS > 1 ? '#f59e0b' : '#64748b'};">Saldo Pendiente:</td>
                <td style="padding: 8px 10px; text-align: right; font-weight: 700; font-size: 13px; color: ${debtARS > 1 ? '#f59e0b' : '#64748b'};">$ ${(debtARS > 1 ? debtARS : 0).toLocaleString('es-AR', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
            </tr>
        ` : '';

        const paymentInfoHtml = (formattedSavedDate || savedMethod) ? `
            <div style="margin-top: 18px; padding: 12px 16px; background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; font-size: 13px;">
                <div style="font-weight: 700; color: #166534; margin-bottom: 8px; text-transform: uppercase; font-size: 11px; letter-spacing: 0.05em;">✓ Información de Pago</div>
                ${formattedSavedDate ? `<div style="display:flex; justify-content:space-between; margin-bottom: 5px;"><span style="color:#475569;">Fecha de Pago:</span><strong>${formattedSavedDate}</strong></div>` : ''}
                ${savedMethod ? `<div style="display:flex; justify-content:space-between;"><span style="color:#475569;">Medio de Pago:</span><strong>${savedMethod}</strong></div>` : ''}
            </div>
        ` : '';

        const today = new Date().toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });

        printWindow.document.write(`
            <html>
                <head>
                    <title>Liquidación - ${driverName} - ${period}</title>
                    <style>
                        @page { size: A4; margin: 1.5cm; }
                        * { box-sizing: border-box; }
                        body { font-family: 'Segoe UI', system-ui, -apple-system, sans-serif; color: #1e293b; line-height: 1.5; margin: 0; padding: 0; }
                        table { width: 100%; border-collapse: collapse; margin-top: 0; font-size: 13px; }
                        th { background: #1e293b; color: #fff; padding: 10px; text-align: left; font-weight: 600; font-size: 11px; text-transform: uppercase; letter-spacing: 0.04em; }
                        th:last-child { text-align: right; }
                        .header-band { background: #1e293b; color: white; padding: 22px 28px; border-radius: 10px; display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 22px; }
                        .badge { display: inline-block; background: rgba(255,255,255,0.15); padding: 3px 10px; border-radius: 20px; font-size: 11px; font-weight: 600; letter-spacing: 0.03em; margin-top: 6px; }
                        .total-box { margin-top: 24px; border: 2px solid #1e293b; border-radius: 10px; overflow: hidden; }
                        .total-main { background: #1e293b; color: white; padding: 16px 20px; display: flex; justify-content: space-between; align-items: center; }
                        .total-main-label { font-size: 13px; font-weight: 600; opacity: 0.8; }
                        .total-main-value { font-size: 26px; font-weight: 800; }
                        .total-sub { padding: 0 20px; background: #f8fafc; }
                        .footer { margin-top: 40px; display: flex; justify-content: space-between; align-items: flex-end; }
                        .signature-box { border-top: 1px solid #cbd5e1; padding-top: 8px; text-align: center; width: 200px; font-size: 11px; color: #94a3b8; }
                        .generated { font-size: 10px; color: #cbd5e1; text-align: right; }
                        @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
                    </style>
                </head>
                <body>
                    <!-- HEADER -->
                    <div class="header-band">
                        <div>
                            <div style="font-size: 11px; font-weight: 600; opacity: 0.6; text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 4px;">Liquidación de Servicios Logísticos</div>
                            <div style="font-size: 22px; font-weight: 800;">${driverName}</div>
                            <div class="badge">📅 ${period}</div>
                        </div>
                        <div style="text-align: right;">
                            <div style="font-size: 11px; opacity: 0.6; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 4px;">Tipo de Cambio</div>
                            <div style="font-size: 16px; font-weight: 700;">1 USD = $ ${rate.toLocaleString('es-AR', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</div>
                            <div style="font-size: 11px; opacity: 0.5; margin-top: 8px;">Emitido el ${today}</div>
                        </div>
                    </div>

                    <!-- ITEMS TABLE -->
                    <table>
                        <thead>
                            <tr>
                                <th style="width: 32px;">#</th>
                                <th>Descripción del Servicio</th>
                                <th style="text-align: center; width: 110px;">Cliente</th>
                                <th style="text-align: center; width: 90px;">Fecha</th>
                                <th style="text-align: right; width: 130px;">Monto (ARS)</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${itemsHtml}
                            <!-- SUBTOTAL ROW -->
                            <tr style="background: #f1f5f9;">
                                <td colspan="4" style="padding: 10px; text-align: right; font-size: 13px; font-weight: 700; color: #334155; border-top: 2px solid #cbd5e1;">
                                    Total ${data.items.length} servicio${data.items.length !== 1 ? 's' : ''}:
                                </td>
                                <td style="padding: 10px; text-align: right; font-weight: 800; font-size: 15px; color: #1e293b; border-top: 2px solid #cbd5e1;">
                                    $ ${totalARS.toLocaleString('es-AR', {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                                </td>
                            </tr>
                            ${paidRowHtml}
                        </tbody>
                    </table>

                    <!-- TOTAL BOX -->
                    <div class="total-box">
                        <div class="total-main">
                            <div>
                                <div class="total-main-label">TOTAL A PAGAR</div>
                                <div style="font-size: 11px; opacity: 0.5; margin-top: 2px;">≈ USD ${totalUSD.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})} al tipo de cambio vigente</div>
                            </div>
                            <div class="total-main-value">$ ${totalARS.toLocaleString('es-AR', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</div>
                        </div>
                    </div>

                    <!-- PAYMENT INFO -->
                    ${paymentInfoHtml}

                    <!-- FOOTER -->
                    <div class="footer">
                        <div class="signature-box">Firma y aclaración del conductor</div>
                        <div class="generated">Documento generado por AssetFlow · ${today}</div>
                    </div>

                    <script>
                        window.onload = function() { window.print(); }
                    <\/script>
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
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
                <div>
                    <h1 style={{ fontSize: '1.75rem', fontWeight: 'bold', color: 'var(--text-main)', marginBottom: '0.25rem' }}>Pago a Conductores</h1>
                    <p style={{ color: 'var(--text-secondary)' }}>Liquidación mensual detallada de servicios logísticos internos</p>
                </div>
                
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
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
                        <>
                            {/* Selector de Cliente */}
                            <div style={{ display: 'flex', alignItems: 'center', background: 'var(--background)', padding: '0.5rem', borderRadius: '12px', border: '1px solid var(--border)' }}>
                                <Briefcase size={18} style={{ color: 'var(--text-secondary)', marginLeft: '0.5rem' }} />
                                <select 
                                    value={selectedClientFilter}
                                    onChange={(e) => setSelectedClientFilter(e.target.value)}
                                    style={{ padding: '0.25rem 0.5rem', border: 'none', background: 'transparent', color: 'var(--text-main)', fontWeight: 600, outline: 'none', cursor: 'pointer' }}
                                >
                                    {availableClients.map(client => (
                                        <option key={client} value={client}>{client === 'Todos' ? 'Todos los Clientes' : client}</option>
                                    ))}
                                </select>
                            </div>

                            {/* Selector de Conductor */}
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
                        </>
                    )}
                </div>
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

                        const filteredItems = data.items.filter(item => selectedClientFilter === 'Todos' || item.client === selectedClientFilter);
                        const filteredTotal = filteredItems.reduce((sum, item) => sum + item.cost, 0);

                        return (
                            <Card key={name} style={{ border: isPaid ? (isFullyPaid ? '1px solid rgba(16, 185, 129, 0.4)' : '1px solid rgba(245, 158, 11, 0.4)') : undefined }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                        <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'var(--primary-color)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '1.2rem' }}>
                                            {name.charAt(0).toUpperCase()}
                                        </div>
                                        <div>
                                            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-main)', margin: 0 }}>{name}</h3>
                                            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: 0 }}>
                                                {selectedClientFilter === 'Todos' 
                                                    ? `${data.items.length} servicios completados` 
                                                    : `${filteredItems.length} de ${data.items.length} servicios completados`}
                                            </p>
                                        </div>
                                    </div>
                                    <div style={{ textAlign: 'right' }}>
                                        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600 }}>A PAGAR (TOTAL)</div>
                                        <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-main)' }}>USD {data.total.toFixed(2)}</div>
                                        {exchangeRate > 0 && <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>ARS {(data.total * exchangeRate).toLocaleString('es-AR', { minimumFractionDigits: 2 })}</div>}
                                        
                                        {selectedClientFilter !== 'Todos' && (
                                            <div style={{ marginTop: '0.5rem', paddingTop: '0.5rem', borderTop: '1px dashed var(--border)' }}>
                                                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600 }}>FILTRADO ({selectedClientFilter})</div>
                                                <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--primary-color)' }}>USD {filteredTotal.toFixed(2)}</div>
                                                {exchangeRate > 0 && <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>ARS {(filteredTotal * exchangeRate).toLocaleString('es-AR', { minimumFractionDigits: 2 })}</div>}
                                            </div>
                                        )}
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
                                                <th style={{ padding: '0.75rem 1rem', textAlign: 'left', color: 'var(--text-secondary)', fontWeight: 600 }}>Cliente</th>
                                                <th style={{ padding: '0.75rem 1rem', textAlign: 'left', color: 'var(--text-secondary)', fontWeight: 600 }}>Solicitante</th>
                                                <th style={{ padding: '0.75rem 1rem', textAlign: 'right', color: 'var(--text-secondary)', fontWeight: 600 }}>Costo Logístico</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {filteredItems.map((item, idx) => {
                                                const checkKey = `${name}-${item.id}`;
                                                const isChecked = localChecks[checkKey] ?? (rates?.driverItemChecks?.[monthKey]?.[name]?.[item.id] || false);
                                                
                                                return (
                                                <tr key={idx} style={{ borderBottom: idx < filteredItems.length - 1 ? '1px solid var(--border)' : 'none', background: isChecked ? 'rgba(16, 185, 129, 0.05)' : 'transparent' }}>
                                                    <td style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>
                                                        <input 
                                                            type="checkbox" 
                                                            checked={isChecked}
                                                            onChange={() => setLocalChecks(prev => ({...prev, [checkKey]: !isChecked}))}
                                                            style={{ cursor: 'pointer', width: '16px', height: '16px' }}
                                                        />
                                                    </td>
                                                    <td style={{ padding: '0.75rem 1rem', fontWeight: 500, color: 'var(--primary-color)' }}>
                                                        {item.type === 'Ticket' || item.type === 'Sub-caso' ? <Link href={`/dashboard/tickets/${item.id}`}>{item.id}</Link> : item.id}
                                                    </td>
                                                    <td style={{ padding: '0.75rem 1rem', color: 'var(--text-main)', textDecoration: isChecked ? 'line-through' : 'none', opacity: isChecked ? 0.6 : 1 }}>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                                                            <span>{item.description}</span>
                                                        </div>
                                                    </td>
                                                    <td style={{ padding: '0.75rem 1rem', opacity: isChecked ? 0.6 : 1 }}>
                                                         <span style={{ 
                                                             padding: '0.2rem 0.5rem', 
                                                             borderRadius: '6px', 
                                                             fontSize: '0.75rem', 
                                                             fontWeight: 600,
                                                             backgroundColor: item.client === 'SFDC-Argentina' ? 'rgba(59, 130, 246, 0.1)' : (item.client === 'Inventario' ? 'rgba(107, 114, 128, 0.1)' : 'rgba(139, 92, 246, 0.1)'),
                                                             color: item.client === 'SFDC-Argentina' ? '#3b82f6' : (item.client === 'Inventario' ? '#6b7280' : '#8b5cf6')
                                                         }}>
                                                             {item.client}
                                                         </span>
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
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', padding: '1rem', background: isFullyPaid ? 'rgba(16, 185, 129, 0.05)' : (isPaid ? 'rgba(245, 158, 11, 0.05)' : 'rgba(0,0,0,0.02)'), borderRadius: '8px', border: '1px solid var(--border)' }}>
                                    <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
                                        <div style={{ flex: '1 1 200px', minWidth: '150px' }}>
                                            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>PAGADO (REAL)</label>
                                            <div style={{ position: 'relative' }}>
                                                <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)', fontSize: '0.85rem', fontWeight: 600 }}>ARS</span>
                                                <input 
                                                    type="number"
                                                    value={inputVal}
                                                    onChange={(e) => setPaymentInputs({...paymentInputs, [name]: e.target.value})}
                                                    style={{ width: '100%', padding: '0.45rem 1rem 0.45rem 2.5rem', borderRadius: '6px', border: `1px solid ${isFullyPaid ? '#10b981' : 'var(--border)'}`, background: 'var(--card-bg)', color: 'var(--text-main)', fontSize: '0.85rem' }}
                                                    placeholder="0.00"
                                                />
                                            </div>
                                        </div>
                                        <div style={{ flex: '1 1 150px', minWidth: '130px' }}>
                                            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>FECHA DE PAGO</label>
                                            <input 
                                                type="date"
                                                value={paymentDates[name] ?? (rates?.driverPaymentDates?.[monthKey]?.[name] || '')}
                                                onChange={(e) => setPaymentDates({...paymentDates, [name]: e.target.value})}
                                                style={{ width: '100%', padding: '0.45rem 0.75rem', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--card-bg)', color: 'var(--text-main)', fontSize: '0.85rem' }}
                                            />
                                        </div>
                                        <div style={{ flex: '1 1 150px', minWidth: '130px' }}>
                                            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>MEDIO DE PAGO</label>
                                            <select 
                                                value={paymentMethods[name] ?? (rates?.driverPaymentMethods?.[monthKey]?.[name] || '')}
                                                onChange={(e) => setPaymentMethods({...paymentMethods, [name]: e.target.value})}
                                                style={{ width: '100%', padding: '0.45rem 0.75rem', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--card-bg)', color: 'var(--text-main)', fontSize: '0.85rem' }}
                                            >
                                                <option value="">Selecciona...</option>
                                                <option value="Efectivo">Efectivo</option>
                                                <option value="Transferencia">Transferencia</option>
                                            </select>
                                        </div>
                                        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                                            <Button 
                                                onClick={() => handleSavePayment(name)}
                                                style={{ backgroundColor: 'var(--primary-color)', color: 'white', borderColor: 'var(--primary-color)', padding: '0.5rem 1rem' }}
                                            >
                                                <Save size={16} style={{ marginRight: '6px' }}/> Guardar
                                            </Button>
                                            <Button 
                                                variant="secondary"
                                                onClick={() => handlePrintDriverCases(name, { ...data, items: filteredItems, total: filteredTotal }, savedPaymentUSD)}
                                                style={{ padding: '0.5rem 1rem', border: '1px solid var(--border)' }}
                                            >
                                                <Printer size={16} style={{ marginRight: '6px' }}/> PDF
                                            </Button>
                                        </div>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border)', paddingTop: '0.75rem', marginTop: '0.25rem' }}>
                                        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                                            {rates?.driverPaymentDates?.[monthKey]?.[name] && (
                                                <span style={{ marginRight: '1rem' }}>
                                                    📅 Pagado el: <strong>{(() => {
                                                        const d = rates.driverPaymentDates[monthKey][name];
                                                        const parts = d.split('-');
                                                        return parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : d;
                                                    })()}</strong>
                                                </span>
                                            )}
                                            {rates?.driverPaymentMethods?.[monthKey]?.[name] && (
                                                <span>
                                                    💳 Medio: <strong>{rates.driverPaymentMethods[monthKey][name]}</strong>
                                                </span>
                                            )}
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
                                </div>
                            </Card>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
