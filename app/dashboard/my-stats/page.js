"use client";
import React, { useState, useMemo } from 'react';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { useStore } from '../../../lib/store';
import { Archive, AlertCircle, Truck, CheckCircle2, TrendingUp, ArrowUpRight, ClipboardList, BarChart3, User, Printer } from 'lucide-react';
import { resolveTicketServiceDetails, getRate, getExchangeRateForDate, calculateTaskFinancials, calculateTicketFinancials } from '@/lib/billing';
import Link from 'next/link';
import { Button } from '../../components/ui/Button';

export default function MyStatsPage() {
    const { tickets, assets: globalAssets, currentUser, rates, users, logisticsTasks } = useStore();
    const [selectedMonthIndex, setSelectedMonthIndex] = useState(0);
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
    // ==== LOGICA UNIFICADA Y EXACTA CON DRIVER-PAYMENTS ====
    const currentUserFilter = (currentUser?.name || '').trim().toLowerCase();

    const { monthItems, stats, historyData } = useMemo(() => {
        const today = new Date().toLocaleDateString('en-CA');
        const now = new Date();
        const startOfWeek = new Date(now);
        startOfWeek.setDate(now.getDate() - now.getDay());
        const endOfWeek = new Date(startOfWeek);
        endOfWeek.setDate(endOfWeek.getDate() + 6);

        const targetDate = new Date(now.getFullYear(), now.getMonth() - selectedMonthIndex, 1);
        const selectedMonth = targetDate.getMonth();
        const selectedYear = targetDate.getFullYear();
        
        let personalLiquidation = 0;
        let deliveriesCount = 0;
        let recoveriesCount = 0;
        let deliveredToday = 0;
        let finishedThisMonthCount = 0;
        let pendingThisWeekCount = 0;
        
        const myItems = [];
        const processedTaskIds = new Set();
        
        // Historial array (6 meses)
        const hist = [];
        for (let i = 5; i >= 0; i--) {
            const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
            hist.push({ month: d.getMonth(), year: d.getFullYear(), label: d.toLocaleDateString('es-ES', { month: 'short' }).replace('.', ''), total: 0 });
        }

        // 1. Process Tickets
        tickets.forEach(ticket => {
            const financials = calculateTicketFinancials(ticket, rates, globalAssets, users, logisticsTasks);
            if (!financials) return;
            const ticketDateStr = ticket.deliveryCompletedDate || ticket.createdAt;

            if (financials.taskFinancials && financials.taskFinancials.length > 0) {
                financials.taskFinancials.forEach(tFin => {
                    const taskObj = logisticsTasks.find(lt => String(lt.id) === String(tFin.taskId));
                    
                    let taskStatus = taskObj?.status;
                    if (!taskStatus && ticket.associatedCases) {
                        const assoc = ticket.associatedCases.find(c => String(c.caseNumber || c.id) === String(tFin.taskRef || tFin.taskId));
                        if (assoc) taskStatus = assoc.status;
                    }
                    if (!taskStatus) taskStatus = ticket.logistics?.status || ticket.status;

                    if (!isClosedStatus(taskStatus)) {
                        if (taskStatus === 'En Transito' || taskStatus === 'Para Coordinar') {
                            const pendingDate = taskObj?.date ? new Date(taskObj.date + 'T00:00:00') : null;
                            if (pendingDate && pendingDate >= startOfWeek && pendingDate <= endOfWeek) {
                                const driverName = tFin.deliveryPerson;
                                if (driverName && driverName.trim().toLowerCase() === currentUserFilter) {
                                    pendingThisWeekCount++;
                                }
                            }
                        }
                        return;
                    }

                    let taskDateStr = null;
                    if (taskObj) {
                        if (taskObj.date && taskObj.date !== 'Pendiente' && taskObj.date !== 'Sin fecha') taskDateStr = taskObj.date;
                        else if (taskObj.delivery_info?.deliveredAt) taskDateStr = taskObj.delivery_info.deliveredAt.substring(0, 10);
                        else taskDateStr = taskObj.created_at ? taskObj.created_at.substring(0, 10) : null;
                    }
                    if (!taskDateStr) taskDateStr = tFin.date || ticketDateStr;
                    if (!taskDateStr) return;

                    const date = new Date(taskDateStr.toString().includes('T') ? taskDateStr : taskDateStr + 'T00:00:00');
                    if (tFin.taskId) processedTaskIds.add(String(tFin.taskId));
                    
                    const method = tFin.method || '';
                    if (method.includes('Propio') || method === 'Envío Interno' || method.toLowerCase().includes('local')) {
                        const driverName = tFin.deliveryPerson;
                        if (!driverName || driverName.trim().toLowerCase() !== currentUserFilter) return;
                        
                        const completedDateStr = taskObj?.delivery_info?.deliveredAt ? new Date(taskObj.delivery_info.deliveredAt).toLocaleDateString('en-CA') : date.toLocaleDateString('en-CA');
                        if (completedDateStr === today) deliveredToday++;
                        if (date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear()) finishedThisMonthCount++;

                        const match = hist.find(h => h.month === date.getMonth() && h.year === date.getFullYear());
                        if (match) match.total++;

                        if (date.getMonth() !== selectedMonth || date.getFullYear() !== selectedYear) return;

                        let effectiveLogisticCost = tFin.logisticCost;
                        const rawCustom = ticket.deliveryDetails?.customLogisticCost;
                        if (rawCustom !== null && rawCustom !== undefined && rawCustom !== '') {
                            const customVal = parseFloat(rawCustom);
                            if (!isNaN(customVal)) {
                                const internalTasks = financials.taskFinancials.filter(t => (t.method || '').includes('Propio') || (t.method || '') === 'Envío Interno' || (t.method || '').toLowerCase().includes('local'));
                                const totalAutoCost = internalTasks.reduce((s, t) => s + t.logisticCost, 0);
                                effectiveLogisticCost = totalAutoCost > 0 ? customVal * (tFin.logisticCost / totalAutoCost) : customVal / (internalTasks.length || 1);
                                if (ticket.deliveryDetails?.customLogisticCostCurrency === 'ARS') {
                                    const r = getExchangeRateForDate(rates, ticket.createdAt || new Date());
                                    effectiveLogisticCost = effectiveLogisticCost / (r > 0 ? r : 1);
                                }
                            }
                        }

                        if (effectiveLogisticCost > 0) {
                            personalLiquidation += effectiveLogisticCost;
                            const moveLower = (tFin.moveType || '').toLowerCase();
                            if (moveLower.includes('entrega') || moveLower.includes('alta')) deliveriesCount++;
                            if (moveLower.includes('recupero') || moveLower.includes('retiro') || moveLower.includes('baja') || moveLower.includes('collection')) recoveriesCount++;

                            myItems.push({
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
                                        if (missingPrefixes.length > 0) return `${missingPrefixes.map(p => `[${p}]`).join('')} ${subject}`;
                                    }
                                    const ref = tFin.taskRef || ticket.salesforceCase;
                                    if (ref) {
                                        const cleanRef = String(ref).trim();
                                        const finalRef = /^\d+$/.test(cleanRef) ? `SFDC-${cleanRef}` : cleanRef;
                                        if (!subject.includes(finalRef)) return `[${finalRef}] ${subject}`;
                                    }
                                    return subject;
                                })(),
                                client: ticket.client,
                                requester: ticket.requester,
                                cost: effectiveLogisticCost
                            });
                        }
                    }
                });
            } else {
                let taskStatus = ticket.logistics?.status || ticket.status;
                if (!isClosedStatus(taskStatus)) {
                    if (taskStatus === 'En Transito' || taskStatus === 'Para Coordinar') {
                        const pendingDate = ticket.logistics?.date ? new Date(ticket.logistics.date + 'T00:00:00') : null;
                        if (pendingDate && pendingDate >= startOfWeek && pendingDate <= endOfWeek) {
                            const driverName = ticket.logistics?.delivery_person || ticket.logistics?.deliveryPerson;
                            if (driverName && driverName.trim().toLowerCase() === currentUserFilter) pendingThisWeekCount++;
                        }
                    }
                    return;
                }
                
                let taskDateStr = ticket.logistics?.date;
                if (!taskDateStr || taskDateStr === 'Pendiente' || taskDateStr === 'Sin fecha') {
                    taskDateStr = ticket.updatedAt ? ticket.updatedAt.substring(0, 10) : ticketDateStr;
                }
                if (!taskDateStr) return;

                const date = new Date(taskDateStr.toString().includes('T') ? taskDateStr : taskDateStr + 'T00:00:00');
                const method = financials.method || '';
                if (method.includes('Propio') || method === 'Envío Interno' || method.toLowerCase().includes('local')) {
                    const driverName = ticket.logistics?.delivery_person || ticket.logistics?.deliveryPerson;
                    if (!driverName || driverName.trim().toLowerCase() !== currentUserFilter) return;
                    
                    const completedDateStr = date.toLocaleDateString('en-CA');
                    if (completedDateStr === today) deliveredToday++;
                    if (date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear()) finishedThisMonthCount++;
                    
                    const match = hist.find(h => h.month === date.getMonth() && h.year === date.getFullYear());
                    if (match) match.total++;

                    if (date.getMonth() !== selectedMonth || date.getFullYear() !== selectedYear) return;

                    let effectiveLogisticCost = financials.logisticCost || 0;
                    const rawCustom = ticket.deliveryDetails?.customLogisticCost;
                    if (rawCustom !== null && rawCustom !== undefined && rawCustom !== '') {
                        const customVal = parseFloat(rawCustom);
                        if (!isNaN(customVal)) {
                            effectiveLogisticCost = customVal;
                            if (ticket.deliveryDetails?.customLogisticCostCurrency === 'ARS') {
                                const r = getExchangeRateForDate(rates, ticket.createdAt || new Date());
                                effectiveLogisticCost = effectiveLogisticCost / (r > 0 ? r : 1);
                            }
                        }
                    }

                    if (effectiveLogisticCost > 0) {
                        personalLiquidation += effectiveLogisticCost;
                        const moveLower = (financials.moveType || '').toLowerCase();
                        if (moveLower.includes('entrega') || moveLower.includes('alta')) deliveriesCount++;
                        if (moveLower.includes('recupero') || moveLower.includes('retiro') || moveLower.includes('baja') || moveLower.includes('collection')) recoveriesCount++;

                        myItems.push({
                            id: ticket.id,
                            type: 'Ticket',
                            description: ticket.salesforceCase ? `[${ticket.salesforceCase}] ${ticket.subject || 'Sin Asunto'}` : (ticket.subject || 'Sin Asunto'),
                            client: ticket.client,
                            requester: ticket.requester,
                            cost: effectiveLogisticCost
                        });
                    }
                }
            }
        });

        // 2. Process standalone logisticsTasks
        logisticsTasks.forEach(task => {
            if (processedTaskIds.has(String(task.id))) return;
            if (!isClosedStatus(task.status)) return;

            let taskDateStr = task.date;
            if (!taskDateStr || taskDateStr === 'Pendiente' || taskDateStr === 'Sin fecha') {
                taskDateStr = task.delivery_info?.deliveredAt ? task.delivery_info.deliveredAt.substring(0, 10) : (task.updated_at ? task.updated_at.substring(0, 10) : null);
            }
            if (!taskDateStr) return;

            const date = new Date(taskDateStr.toString().includes('T') ? taskDateStr : taskDateStr + 'T00:00:00');
            const driverName = task.deliveryPerson || task.delivery_person;
            if (!driverName || driverName.trim().toLowerCase() !== currentUserFilter) return;

            const completedDateStr = task.delivery_info?.deliveredAt ? new Date(task.delivery_info.deliveredAt).toLocaleDateString('en-CA') : date.toLocaleDateString('en-CA');
            if (completedDateStr === today) deliveredToday++;
            if (date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear()) finishedThisMonthCount++;

            const match = hist.find(h => h.month === date.getMonth() && h.year === date.getFullYear());
            if (match) match.total++;

            if (date.getMonth() !== selectedMonth || date.getFullYear() !== selectedYear) return;

            const pTicket = tickets.find(t => String(t.id) === String(task.ticket_id || task.ticketId));
            if (!pTicket) return;
            
            const taskFin = calculateTaskFinancials(task, rates, globalAssets, users);
            if (!taskFin) return;

            if (taskFin.isInternalDriver && taskFin.logisticCost > 0) {
                personalLiquidation += taskFin.logisticCost;
                const moveLower = (taskFin.moveType || '').toLowerCase();
                if (moveLower.includes('entrega') || moveLower.includes('alta')) deliveriesCount++;
                if (moveLower.includes('recupero') || moveLower.includes('retiro') || moveLower.includes('baja') || moveLower.includes('collection')) recoveriesCount++;

                myItems.push({
                    id: pTicket.id,
                    type: 'Sub-caso',
                    description: taskFin.taskSubject || pTicket.subject || 'Sin Asunto',
                    client: pTicket.client,
                    requester: pTicket.requester,
                    cost: taskFin.logisticCost
                });
            }
        });

        // 3. Extras
        let extraItemsCount = 0;
        const tempMonthKey = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}`;
        if (currentUser?.name && rates?.driverExtraItems?.[tempMonthKey]?.[currentUser.name]) {
            const extraList = rates.driverExtraItems[tempMonthKey][currentUser.name];
            if (Array.isArray(extraList)) {
                extraList.forEach(extraItem => {
                    if (extraItem && Number(extraItem.cost) > 0) {
                        personalLiquidation += Number(extraItem.cost);
                        extraItemsCount++;
                        myItems.push({
                            id: extraItem.id || 'extra',
                            type: 'Extra',
                            description: extraItem.description || 'Gasto / Adicional',
                            requester: currentUser.name,
                            client: extraItem.client || 'Extra / Adicional',
                            cost: Number(extraItem.cost)
                        });
                    }
                });
            }
        }

        return { 
            monthItems: myItems,
            historyData: hist,
            stats: {
                total: myItems.length,
                personalLiquidation,
                deliveriesCount,
                recoveriesCount,
                deliveredToday,
                finishedThisMonthCount,
                pendingThisWeekCount,
                extraItemsCount,
                targetMonth: selectedMonth,
                targetYear: selectedYear
            } 
        };
    }, [tickets, logisticsTasks, currentUser, selectedMonthIndex, rates, globalAssets, users]);

    const monthKey = useMemo(() => {
        return `${stats.targetYear}-${String(stats.targetMonth + 1).padStart(2, '0')}`;
    }, [stats.targetMonth, stats.targetYear]);

    const exchangeRate = useMemo(() => {
        return getExchangeRateForDate(rates, new Date(stats.targetYear, stats.targetMonth, 1));
    }, [rates, stats.targetMonth, stats.targetYear]);


    const handlePrintDriverCases = (driverName, data, savedPaymentUSD) => {
        const printWindow = window.open('', '_blank');
        if (!printWindow) return alert('Por favor, permite las ventanas emergentes (pop-ups) en tu navegador.');
        
        const monthNames = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
        const period = `${monthNames[stats.targetMonth]} de ${stats.targetYear}`;
        const totalARS = exchangeRate > 0 ? (data.total * exchangeRate).toFixed(2) : '0.00';
        const paidUSD = savedPaymentUSD || 0;
        const debtUSD = data.total - paidUSD;

        const savedDate = rates?.driverPaymentDates?.[monthKey]?.[driverName];
        const savedMethod = rates?.driverPaymentMethods?.[monthKey]?.[driverName];
        
        let dateHtml = '';
        if (savedDate) {
            const parts = savedDate.split('-');
            const formattedDate = parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : savedDate;
            dateHtml = `
                <div style="display: flex; justify-content: space-between; margin-bottom: 5px; font-size: 13px; color: #475569;">
                    <span>Fecha de Pago:</span>
                    <strong>${formattedDate}</strong>
                </div>
            `;
        }
        
        let methodHtml = '';
        if (savedMethod) {
            methodHtml = `
                <div style="display: flex; justify-content: space-between; margin-bottom: 10px; font-size: 13px; color: #475569;">
                    <span>Medio de Pago:</span>
                    <strong>${savedMethod}</strong>
                </div>
            `;
        }
        
        let itemsHtml = '';
        data.items.forEach(item => {
            const req = item.requester || '-';
            const clientVal = item.client || 'N/A';
            itemsHtml += `
                <tr>
                    <td style="padding: 10px; border-bottom: 1px solid #e2e8f0;">${item.id}</td>
                    <td style="padding: 10px; border-bottom: 1px solid #e2e8f0;">${item.description}</td>
                    <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; text-align: center;">${clientVal}</td>
                    <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; text-align: center;">${req}</td>
                    <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; text-align: right; font-weight: bold;">USD ${item.cost.toFixed(2)}</td>
                </tr>
            `;
        });

        const arsHtml = exchangeRate > 0 ? `
            <div style="display: flex; justify-content: space-between; margin-bottom: 10px;">
                <span style="color: #64748b;">Equivalente en Pesos:</span>
                <strong>ARS ${(data.total * exchangeRate).toLocaleString('es-AR', { minimumFractionDigits: 2 })}</strong>
            </div>
        ` : '';

        printWindow.document.write(`
            <html>
                <head>
                    <title>Liquidación - ${driverName}</title>
                    <style>
                        body { font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1e293b; padding: 40px; background-color: #f8fafc; }
                        .receipt-card { max-width: 800px; margin: 0 auto; background: white; padding: 40px; border-radius: 12px; box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1); border: 1px solid #e2e8f0; }
                        .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #f1f5f9; padding-bottom: 20px; margin-bottom: 30px; }
                        .logo { font-size: 24px; font-weight: bold; color: #0f172a; display: flex; align-items: center; gap: 8px; }
                        .logo span { color: #3b82f6; }
                        table { width: 100%; border-collapse: collapse; margin-top: 20px; }
                        th { background-color: #f8fafc; padding: 12px; text-align: left; font-size: 12px; font-weight: 600; text-transform: uppercase; color: #64748b; border-bottom: 2px solid #e2e8f0; }
                        td { padding: 12px; border-bottom: 1px solid #e2e8f0; font-size: 14px; }
                        tr:hover { background-color: #f8fafc; }
                    </style>
                </head>
                <body>
                    <div class="receipt-card">
                        <div class="header">
                            <div class="logo">AssetFlow<span>.</span></div>
                            <div style="text-align: right;">
                                <div style="color: #64748b; font-weight: 600; font-size: 12px; text-transform: uppercase;">Comprobante de Liquidación</div>
                                <div style="font-size: 14px; color: #64748b;">Período: ${period}</div>
                            </div>
                        </div>

                        <div style="display: flex; justify-content: space-between; margin-bottom: 30px;">
                            <div>
                                <div style="color: #64748b; font-size: 12px; text-transform: uppercase; font-weight: 600;">Destinatario</div>
                                <p style="margin: 5px 0 0; color: #1f2937; font-size: 16px; font-weight: bold;">${driverName}</p>
                            </div>
                            <div style="text-align: right;">
                                <div style="color: #64748b; font-weight: 600; font-size: 12px; text-transform: uppercase;">Detalle de Cambio</div>
                                <div style="font-size: 14px; font-weight: bold;">${exchangeRate > 0 ? '1 USD = ' + exchangeRate + ' ARS' : 'N/A'}</div>
                            </div>
                        </div>

                        <table>
                            <thead>
                                <tr>
                                    <th>ID</th>
                                    <th>Descripción</th>
                                    <th style="text-align: center;">Cliente</th>
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
                                ${arsHtml}
                                ${dateHtml}
                                ${methodHtml}
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

                        <div style="margin-top: 50px; text-align: center; color: #94a3b8; font-size: 11px; border-top: 1px solid #f1f5f9; padding-top: 20px;">
                            Este es un comprobante de control interno generado automáticamente por AssetFlow.
                        </div>
                    </div>
                    <script>
                        window.onload = function() { window.print(); }
                    </script>
                </body>
            </html>
        `);
        printWindow.document.close();
    };

    const savedPaymentUSD = rates?.driverActualPayments?.[monthKey]?.[currentUser?.name] || 0;
    const isPaid = savedPaymentUSD > 0;
    const isFullyPaid = savedPaymentUSD >= stats.personalLiquidation - 0.01;

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
                        {stats.extraItemsCount > 0 && (
                            <Badge style={{ border: 'none', background: 'rgba(139, 92, 246, 0.05)', color: '#8b5cf6', padding: '0.2rem 0.5rem', fontSize: '0.7rem' }}>
                                {stats.extraItemsCount} extras
                            </Badge>
                        )}
                    </div>
                </Card>

                {/* Gráfico de Evolución de 6 Meses — Premium */}
                <Card style={{ padding: '1rem 1.25rem', backgroundColor: 'var(--surface)', display: 'flex', flexDirection: 'column' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <BarChart3 size={16} style={{ color: '#8b5cf6' }} />
                            <span style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-secondary)' }}>Evolución 6 Meses</span>
                        </div>
                        <span style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', fontWeight: 600 }}>servicios completados</span>
                    </div>

                    {/* Chart area */}
                    <div style={{ position: 'relative' }}>
                        {/* Horizontal grid lines */}
                        {(() => {
                            const maxTotal = Math.max(...historyData.map(item => item.total), 1);
                            const gridLines = [0, 0.25, 0.5, 0.75, 1];
                            return gridLines.map((pct, gi) => (
                                <div key={gi} style={{
                                    position: 'absolute',
                                    left: 0, right: 0,
                                    bottom: `calc(28px + ${pct * 140}px)`,
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '6px',
                                    pointerEvents: 'none',
                                    zIndex: 0
                                }}>
                                    <span style={{ fontSize: '0.55rem', color: 'var(--text-secondary)', fontWeight: 600, width: '18px', textAlign: 'right', flexShrink: 0 }}>
                                        {pct > 0 ? Math.round(maxTotal * pct) : ''}
                                    </span>
                                    <div style={{ flex: 1, height: '1px', background: pct === 0 ? 'var(--border)' : 'rgba(148,163,184,0.15)', borderStyle: pct === 0 ? 'solid' : 'dashed', borderWidth: pct === 0 ? '1px 0 0 0' : '1px 0 0 0' }} />
                                </div>
                            ));
                        })()}

                        {/* Bars + labels */}
                        <div style={{
                            display: 'flex',
                            alignItems: 'flex-end',
                            gap: '8px',
                            height: '168px',
                            paddingLeft: '26px',
                            paddingBottom: '28px',
                            position: 'relative',
                            zIndex: 1
                        }}>
                            {historyData.map((h, i) => {
                                const maxTotal = Math.max(...historyData.map(item => item.total), 1);
                                const barHeightPx = (h.total / maxTotal) * 140;
                                const targetDate = new Date(new Date().getFullYear(), new Date().getMonth() - selectedMonthIndex, 1);
                                const isCurrentSelected = h.month === targetDate.getMonth() && h.year === targetDate.getFullYear();
                                const isEmpty = h.total === 0;
                                const hRate = getExchangeRateForDate(rates, new Date(h.year, h.month, 15));

                                return (
                                    <div
                                        key={i}
                                        title={`${h.label}: ${h.total} servicios${hRate > 0 && h.earnings ? ` · $ ${(h.earnings * hRate).toLocaleString('es-AR', {minimumFractionDigits: 0, maximumFractionDigits: 0})} ARS` : ''}`}
                                        style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', gap: '0', height: '100%', cursor: 'default' }}
                                    >
                                        {/* Value on top */}
                                        <span style={{
                                            fontSize: '0.65rem',
                                            fontWeight: 800,
                                            color: isCurrentSelected ? '#8b5cf6' : (isEmpty ? 'var(--text-secondary)' : 'var(--text-main)'),
                                            marginBottom: '4px',
                                            opacity: isEmpty ? 0.4 : 1,
                                            transition: 'all 0.3s'
                                        }}>
                                            {h.total}
                                        </span>

                                        {/* Bar */}
                                        <div style={{
                                            width: '100%',
                                            maxWidth: '32px',
                                            height: `${Math.max(barHeightPx, isEmpty ? 4 : 8)}px`,
                                            background: isCurrentSelected
                                                ? 'linear-gradient(to top, #7c3aed, #a78bfa)'
                                                : isEmpty
                                                    ? 'rgba(148,163,184,0.12)'
                                                    : 'linear-gradient(to top, rgba(139,92,246,0.5), rgba(167,139,250,0.25))',
                                            borderRadius: '4px 4px 0 0',
                                            boxShadow: isCurrentSelected ? '0 0 10px rgba(139,92,246,0.35)' : 'none',
                                            transition: 'all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)',
                                            position: 'relative',
                                            overflow: 'hidden'
                                        }}>
                                            {/* Shimmer on selected */}
                                            {isCurrentSelected && (
                                                <div style={{
                                                    position: 'absolute', top: 0, left: '-100%', width: '60%', height: '100%',
                                                    background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.25), transparent)',
                                                    animation: 'shimmer 2s infinite'
                                                }} />
                                            )}
                                        </div>

                                        {/* Month label */}
                                        <span style={{
                                            fontSize: '0.6rem',
                                            fontWeight: isCurrentSelected ? 800 : 600,
                                            color: isCurrentSelected ? '#8b5cf6' : 'var(--text-secondary)',
                                            textTransform: 'capitalize',
                                            marginTop: '6px',
                                            letterSpacing: '0.02em'
                                        }}>
                                            {h.label}
                                        </span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    <style>{`
                        @keyframes shimmer {
                            0% { left: -100%; }
                            100% { left: 200%; }
                        }
                    `}</style>
                </Card>
            </div>

            {/* Listado Detallado de Liquidación para el Conductor */}
            <Card style={{ padding: '1.25rem', backgroundColor: 'var(--surface)', marginTop: '0.75rem' }}>
                <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: '1rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.5rem' }}>
                    Detalle de Liquidación — Período Seleccionado
                </h3>

                {monthItems.length === 0 ? (
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', textAlign: 'center', padding: '2rem 0' }}>
                        No hay servicios liquidados en este período.
                    </p>
                ) : (
                    <div>
                        <div style={{ marginBottom: '1rem' }}>
                            <style>{`
                                .driver-table {
                                    width: 100%;
                                    border-collapse: collapse;
                                }
                                .driver-table th {
                                    padding: 0.75rem 1rem;
                                    text-align: left;
                                    color: var(--text-secondary);
                                    font-weight: 600;
                                    font-size: 0.8rem;
                                    border-bottom: 2px solid var(--border);
                                }
                                .driver-table td {
                                    padding: 0.75rem 1rem;
                                    border-bottom: 1px solid var(--border);
                                }
                                
                                @media (max-width: 768px) {
                                    .driver-table thead {
                                        display: none;
                                    }
                                    .driver-table, .driver-table tbody, .driver-table tr, .driver-table td {
                                        display: block;
                                        width: 100%;
                                    }
                                    .driver-table tr {
                                        margin-bottom: 1rem;
                                        border: 1px solid var(--border);
                                        border-radius: 8px;
                                        padding: 0.5rem;
                                        background-color: #fafafa;
                                    }
                                    .driver-table td {
                                        padding: 0.5rem;
                                        border-bottom: none;
                                        display: flex;
                                        justify-content: space-between;
                                        align-items: center;
                                        text-align: right;
                                    }
                                    .driver-table td::before {
                                        content: attr(data-label);
                                        font-weight: 700;
                                        font-size: 0.7rem;
                                        text-transform: uppercase;
                                        color: var(--text-secondary);
                                        float: left;
                                        text-align: left;
                                        margin-right: 1rem;
                                    }
                                    .td-desc {
                                        flex-direction: column;
                                        align-items: flex-start !important;
                                        text-align: left !important;
                                        background: white;
                                        border-radius: 6px;
                                        margin-top: 0.5rem;
                                        border: 1px solid var(--border) !important;
                                    }
                                    .td-desc::before {
                                        margin-bottom: 0.25rem;
                                    }
                                    .td-cost {
                                        font-size: 1.1rem !important;
                                        border-top: 1px dashed var(--border) !important;
                                        margin-top: 0.5rem;
                                        padding-top: 0.75rem !important;
                                    }
                                }
                            `}</style>
                            <table className="driver-table">
                                <thead>
                                    <tr>
                                        <th style={{ width: '40px', textAlign: 'center' }}></th>
                                        <th>ID</th>
                                        <th>Descripción</th>
                                        <th>Cliente</th>
                                        <th>Solicitante</th>
                                        <th style={{ textAlign: 'right' }}>Costo Logístico</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {monthItems.map((item, idx) => {
                                        const checks = rates?.driverItemChecks?.[monthKey]?.[currentUser?.name] || {};
                                        const isChecked = !!checks[item.id];
                                        
                                        return (
                                            <tr key={idx} style={{ background: isChecked ? 'rgba(16, 185, 129, 0.05)' : 'transparent' }}>
                                                <td data-label="Estado" style={{ textAlign: 'center' }}>
                                                    <input 
                                                        type="checkbox" 
                                                        checked={isChecked}
                                                        disabled
                                                        style={{ cursor: 'not-allowed', width: '16px', height: '16px' }}
                                                    />
                                                </td>
                                                <td data-label="ID" style={{ fontWeight: 600, color: 'var(--primary-color)', fontSize: '0.9rem' }}>
                                                    {item.type === 'Ticket' || item.type === 'Sub-caso' ? <Link href={`/dashboard/tickets/${item.id}`}>{item.id}</Link> : item.id}
                                                </td>
                                                <td data-label="Descripción" className="td-desc" style={{ color: 'var(--text-main)', textDecoration: isChecked ? 'line-through' : 'none', opacity: isChecked ? 0.6 : 1, fontSize: '0.85rem' }}>
                                                    {item.description}
                                                </td>
                                                <td data-label="Cliente" style={{ opacity: isChecked ? 0.6 : 1 }}>
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
                                                <td data-label="Solicitante" style={{ color: 'var(--text-main)', opacity: isChecked ? 0.6 : 1, fontSize: '0.85rem' }}>
                                                    {item.requester ? (
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'flex-end' }}>
                                                            <div style={{ width: '22px', height: '22px', borderRadius: '50%', backgroundColor: '#e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.65rem', fontWeight: 600, color: '#475569' }}>
                                                                {String(item.requester).charAt(0).toUpperCase()}
                                                            </div>
                                                            <div>{item.requester}</div>
                                                        </div>
                                                    ) : (
                                                        <span style={{ color: 'var(--text-secondary)' }}>-</span>
                                                    )}
                                                </td>
                                                <td data-label="Monto" className="td-cost" style={{ textAlign: 'right', fontWeight: 700, color: 'var(--text-main)', opacity: isChecked ? 0.6 : 1, fontSize: '0.95rem' }}>
                                                    USD {item.cost.toFixed(2)}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>

                        {/* Footer de información de pago */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem', background: isFullyPaid ? 'rgba(16, 185, 129, 0.05)' : (isPaid ? 'rgba(245, 158, 11, 0.05)' : 'rgba(0,0,0,0.02)'), borderRadius: '8px', border: '1px solid var(--border)', flexWrap: 'wrap', gap: '1rem', marginTop: '1rem' }}>
                            <div style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap' }}>
                                <div>
                                    <span style={{ display: 'block', fontSize: '0.65rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Pagado Real</span>
                                    <strong style={{ fontSize: '1.1rem', color: 'var(--text-main)', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                        {exchangeRate > 0 ? (
                                            <>
                                                <span>ARS {(savedPaymentUSD * exchangeRate).toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
                                                <span style={{ fontSize: '0.8rem', fontWeight: 500, color: 'var(--text-secondary)' }}>
                                                    USD {savedPaymentUSD.toFixed(2)} (T/C: {exchangeRate})
                                                </span>
                                            </>
                                        ) : (
                                            <span>USD {savedPaymentUSD.toFixed(2)}</span>
                                        )}
                                    </strong>
                                </div>
                                {rates?.driverPaymentDates?.[monthKey]?.[currentUser?.name] && (
                                    <div>
                                        <span style={{ display: 'block', fontSize: '0.65rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Fecha de Pago</span>
                                        <strong style={{ fontSize: '0.85rem', color: 'var(--text-main)' }}>
                                            {(() => {
                                                const d = rates.driverPaymentDates[monthKey][currentUser.name];
                                                const parts = d.split('-');
                                                return parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : d;
                                            })()}
                                        </strong>
                                    </div>
                                )}
                                {rates?.driverPaymentMethods?.[monthKey]?.[currentUser?.name] && (
                                    <div>
                                        <span style={{ display: 'block', fontSize: '0.65rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Medio de Pago</span>
                                        <strong style={{ fontSize: '0.85rem', color: 'var(--text-main)' }}>
                                            {rates.driverPaymentMethods[monthKey][currentUser.name]}
                                        </strong>
                                    </div>
                                )}
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                <Button 
                                    variant="secondary"
                                    onClick={() => handlePrintDriverCases(currentUser?.name, { items: monthItems, total: stats.personalLiquidation }, savedPaymentUSD)}
                                    style={{ padding: '0.45rem 1rem', border: '1px solid var(--border)', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '6px' }}
                                >
                                    <Printer size={14} /> PDF
                                </Button>

                                {isPaid && (
                                    <div>
                                        {isFullyPaid ? (
                                            <Badge style={{ background: 'rgba(16, 185, 129, 0.1)', color: '#10b981', border: 'none', padding: '0.25rem 0.5rem', fontSize: '0.72rem' }}>Completado</Badge>
                                        ) : (
                                            <Badge style={{ background: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b', border: 'none', padding: '0.25rem 0.5rem', fontSize: '0.72rem' }}>
                                                Pago Parcial (Deuda: USD {(stats.personalLiquidation - Number(savedPaymentUSD)).toFixed(2)})
                                            </Badge>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </Card>
        </div>
    );
}
