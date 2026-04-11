'use client';
import React, { useMemo, useState, useEffect } from 'react';
import { useStore } from '../../../lib/store';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import {
    DollarSign,
    TrendingUp,
    TrendingDown,
    Users,
    CreditCard,
    ArrowUpRight,
    Download,
    PieChart,
    Calendar,
    ArrowRight,
    Truck,
    Settings,
    Trash,
    Info
} from 'lucide-react';
import { CountryFilter } from '../../components/layout/CountryFilter';

import { calculateTicketFinancials, resolveTicketServiceDetails, calculateTaskFinancials } from '@/lib/billing';
import Link from 'next/link';

export default function BillingPage() {
    const { tickets, assets: globalAssets, users, currentUser, rates, updateRates, deleteTickets, expenses, addExpense, deleteExpense, sfdcCases, countryFilter, logisticsTasks } = useStore();
    const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
    const [isRatesModalOpen, setIsRatesModalOpen] = useState(false);
    const [tempRates, setTempRates] = useState({});
    const [selectedTickets, setSelectedTickets] = useState(new Set());
    const [detailModal, setDetailModal] = useState({ isOpen: false, ticket: null, financials: null });
    const [dolarQuotes, setDolarQuotes] = useState({ official: null, blue: null });
    const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
    const [expenseForm, setExpenseForm] = useState({ description: '', amount: '' });

    useEffect(() => {
        if (isRatesModalOpen) {
            fetch('https://dolarapi.com/v1/dolares/oficial')
                .then(r => r.json())
                .then(d => setDolarQuotes(prev => ({ ...prev, official: d })))
                .catch(e => console.error("Error fetching official dollar:", e));

            fetch('https://dolarapi.com/v1/dolares/blue')
                .then(r => r.json())
                .then(d => setDolarQuotes(prev => ({ ...prev, blue: d })))
                .catch(e => console.error("Error fetching blue dollar:", e));
        }
    }, [isRatesModalOpen]);


    const MONTHS = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
    const YEARS = [2024, 2025, 2026];

    useEffect(() => {
        if (isRatesModalOpen) setTempRates(rates);
    }, [isRatesModalOpen, rates]);

    // Advanced analysis
    const { metrics, filteredTickets, currency, filteredExpenses } = useMemo(() => {
        let totalRevenue = 0;
        let totalLogisticsCost = 0;
        let totalOperationalCost = 0;
        let totalServiceRevenue = 0;
        let totalLogisticRevenue = 0;
        let totalPostalCost = 0;
        let totalDriverCost = 0; // Explicit tracker for driver payments sum
        let pendingDeliveriesCount = 0;

        const driverPayments = {};

        // Currency Conversion Logic
        const exchangeRate = parseFloat(rates?.exchangeRate) || 0;
        // const useArs = exchangeRate > 0; // DISABLED: User wants USD enforced
        // const multiplier = useArs ? exchangeRate : 1;
        // const currencyKey = useArs ? 'ARS' : 'USD';
        const useArs = false;
        const multiplier = 1;
        const currencyKey = 'USD';

        const filtered = tickets.filter(ticket => {
            const ticketDate = new Date(ticket.date || ticket.deliveryCompletedDate || Date.now());
            const isDateMatch = ticketDate.getMonth() === selectedMonth && ticketDate.getFullYear() === selectedYear;
            const isStatusMatch = ['Resuelto', 'Caso SFDC Cerrado', 'Servicio Facturado'].includes(ticket.status);

            let isCountryMatch = true;
            if (countryFilter !== 'Todos') {
                // Try to determine country from address
                if (ticket.logistics?.address && ticket.logistics.address.toLowerCase().includes(countryFilter.toLowerCase())) {
                    isCountryMatch = true;
                } else {
                    // Try SFDC match
                    const sfdcMatch = ticket.subject.match(/SFDC-(\d+)/);
                    if (sfdcMatch) {
                        const caseNum = sfdcMatch[1];
                        const sfdcCase = sfdcCases?.find(c => c.caseNumber === caseNum);
                        if (sfdcCase && sfdcCase.country) {
                            isCountryMatch = sfdcCase.country.toLowerCase().includes(countryFilter.toLowerCase());
                        } else {
                            isCountryMatch = false;
                        }
                    } else {
                        isCountryMatch = false;
                    }
                }
            }

            return isDateMatch && isStatusMatch && isCountryMatch;
        });

        // Filter Expenses
        const filteredExpenses = (expenses || []).filter(e => {
            const d = new Date(e.date);
            return d.getMonth() === selectedMonth && d.getFullYear() === selectedYear;
        });
        const totalManualExpenses = filteredExpenses.reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0);



        filtered.forEach(ticket => {
            const financials = calculateTicketFinancials(ticket, rates, globalAssets, users, logisticsTasks);
            
            if (!financials) return;

            const {
                serviceRevenue,
                logisticRevenue,
                logisticCost,
                operationalCost: ticketOperationalCost,
                moveType,
                assetType,
                method
            } = financials;

            totalServiceRevenue += serviceRevenue;
            totalLogisticRevenue += logisticRevenue;
            totalRevenue += (serviceRevenue + logisticRevenue);
            totalLogisticsCost += logisticCost;
            totalOperationalCost += ticketOperationalCost;

            // Driver Payment Tracking
            const isDelivery = moveType.toLowerCase().includes('entrega') || moveType.toLowerCase().includes('alta');
            const isRecovery = moveType.toLowerCase().includes('recupero') || moveType.toLowerCase().includes('retiro') || moveType.toLowerCase().includes('baja');

            if (method === 'Repartidor Propio' || method === 'Envío Interno' || method.includes('Propio')) {
                const driver = ticket.logistics?.deliveryPerson || '';
                if (driver) {
                    if (!driverPayments[driver]) driverPayments[driver] = { count: 0, total: 0, deliveries: 0, recoveries: 0 };
                    driverPayments[driver].count += 1;
                    driverPayments[driver].total += logisticCost;
                    if (isDelivery) driverPayments[driver].deliveries += 1;
                    if (isRecovery) driverPayments[driver].recoveries += 1;
                }
                totalDriverCost += logisticCost;
            } else if (method === 'Andreani' || method === 'Correo Argentino' || method.includes('Correo')) {
                totalPostalCost += logisticCost;
            }

            // Pending deliveries count
            if (ticket.status === 'Abierto' || ticket.status === 'En Progreso') {
                pendingDeliveriesCount += 1;
            }
        });

        totalOperationalCost += (totalManualExpenses * multiplier); // Expenses are usually USD, apply multiplier if converting to ARS logic matches

        // Apply Currency Multiplier to Finals
        totalRevenue *= multiplier;
        totalLogisticsCost *= multiplier;
        totalOperationalCost *= multiplier;

        Object.keys(driverPayments).forEach(driver => {
            driverPayments[driver].total *= multiplier;
        });

        const totalCost = totalLogisticsCost + totalOperationalCost;
        const netMargin = totalRevenue - totalCost;
        const marginPercent = totalRevenue > 0 ? (netMargin / totalRevenue) * 100 : 0;

        return {
            metrics: {
                totalRevenue,
                totalCost,
                netMargin,
                marginPercent,
                totalLogisticsCost,
                totalOperationalCost,
                totalServiceRevenue,
                totalLogisticRevenue,
                totalPostalCost,
                totalDriverCost,
                driverPayments,
                pendingDeliveriesCount,
                totalManualExpenses
            },
            filteredTickets: filtered,
            filteredExpenses,
            currency: currencyKey
        };
    }, [tickets, selectedMonth, selectedYear, rates, globalAssets, expenses, sfdcCases, countryFilter]);

    const handleSaveRates = (e) => {
        e.preventDefault();
        updateRates(tempRates);
        setIsRatesModalOpen(false);
    };

    const toggleSelectAll = (e) => {
        if (e.target.checked) {
            setSelectedTickets(new Set(filteredTickets.map(t => t.id)));
        } else {
            setSelectedTickets(new Set());
        }
    };

    const toggleSelect = (id) => {
        const newSet = new Set(selectedTickets);
        if (newSet.has(id)) newSet.delete(id);
        else newSet.add(id);
        setSelectedTickets(newSet);
    };

    const handleDeleteSelected = () => {
        if (confirm(`¿Estás seguro de eliminar ${selectedTickets.size} registros seleccionados? Esta acción no se puede deshacer.`)) {
            deleteTickets(Array.from(selectedTickets));
            setSelectedTickets(new Set());
        }
    };

    const handleCreateExpense = async () => {
        if (!expenseForm.description || !expenseForm.amount) return alert('Completa todos los campos');

        const exchangeRate = parseFloat(rates?.exchangeRate) || 0;
        if (exchangeRate <= 0) return alert('No hay un valor de referencia (dólar) configurado en las tarifas. Configúralo primero.');

        const amountARS = parseFloat(expenseForm.amount);
        const amountUSD = amountARS / exchangeRate;

        await addExpense({
            description: expenseForm.description,
            amount: amountUSD, // Stored in USD
            date: new Date().toISOString(),
            type: 'Operational',
            created_by: currentUser?.name || currentUser?.username || 'Usuario'
        });
        setExpenseForm({ description: '', amount: '' });
        setIsExpenseModalOpen(false);
    };

    return (
        <div style={{ paddingBottom: '4rem' }}>
            <div style={{ marginBottom: '2rem' }} className="flex-mobile-column">
                <div>
                    <h1 style={{ fontSize: '1.875rem', fontWeight: 800, color: 'var(--text-main)', letterSpacing: '-0.02em', marginBottom: '0.25rem' }}>Facturación ({currency})</h1>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>Análisis financiero en {currency === 'USD' ? 'Dólares Estadounidenses' : 'Pesos Argentinos'}.</p>
                    <div style={{ marginTop: '0.5rem' }}>
                        <CountryFilter />
                    </div>
                </div>

                <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', marginTop: '1.5rem' }} className="flex-mobile-column">
                    <div style={{ display: 'flex', gap: '0.5rem', width: '100%' }}>
                        <select
                            className="form-select"
                            value={selectedMonth}
                            onChange={e => setSelectedMonth(parseInt(e.target.value))}
                            style={{ flex: 1, padding: '0.5rem 1rem' }}
                        >
                            {MONTHS.map((m, i) => <option key={m} value={i}>{m}</option>)}
                        </select>
                        <select
                            className="form-select"
                            value={selectedYear}
                            onChange={e => setSelectedYear(parseInt(e.target.value))}
                            style={{ flex: 1, padding: '0.5rem 1rem' }}
                        >
                            {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
                        </select>
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem', width: '100%', flexWrap: 'wrap' }}>
                        {selectedTickets.size > 0 && (
                            <Button icon={Trash} onClick={handleDeleteSelected} style={{ backgroundColor: '#ef4444', color: 'white', borderColor: '#ef4444', flex: 1 }}>Eliminar ({selectedTickets.size})</Button>
                        )}
                        <Button icon={Settings} onClick={() => setIsRatesModalOpen(true)} style={{ flex: 1 }}>Tarifas</Button>
                        <Button
                            icon={DollarSign}
                            onClick={() => setIsExpenseModalOpen(true)}
                            style={{ backgroundColor: '#800020', borderColor: '#800020', color: 'white', flex: 1 }}
                        >
                            Gasto
                        </Button>
                        <Button icon={Download} variant="outline" style={{ flex: 1 }}>Exportar</Button>
                    </div>
                </div>
            </div>

            {/* Top KPIs Row */}
            <div className="grid-responsive-4" style={{ marginBottom: '2.5rem' }}>
                <Card style={{ borderLeft: '4px solid #22c55e' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div>
                            <p style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>Facturación Total</p>
                            <h3 style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-main)' }}>USD {metrics.totalRevenue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</h3>
                            {(parseFloat(rates?.exchangeRate) || 0) > 0 && (
                                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: 0 }}>ARS {(metrics.totalRevenue * parseFloat(rates.exchangeRate)).toLocaleString('es-AR', { minimumFractionDigits: 2 })}</p>
                            )}
                        </div>
                        <div style={{ padding: '0.6rem', background: 'rgba(34, 197, 94, 0.1)', color: '#22c55e', borderRadius: '12px' }}>
                            <TrendingUp size={24} />
                        </div>
                    </div>
                    <div style={{ marginTop: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <Badge variant="success">+{metrics.marginPercent.toFixed(1)}% Margen</Badge>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>vs mes anterior</span>
                    </div>
                </Card>

                <Card style={{ borderLeft: '4px solid #ef4444' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div>
                            <p style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>Costos Operativos</p>
                            <h3 style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-main)' }}>USD {metrics.totalCost.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</h3>
                            {(parseFloat(rates?.exchangeRate) || 0) > 0 && (
                                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: 0 }}>ARS {(metrics.totalCost * parseFloat(rates.exchangeRate)).toLocaleString('es-AR', { minimumFractionDigits: 2 })}</p>
                            )}
                        </div>
                        <div style={{ padding: '0.6rem', background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', borderRadius: '12px' }}>
                            <TrendingDown size={24} />
                        </div>
                    </div>
                    <div style={{ marginTop: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Logística + Insumos</span>
                    </div>
                </Card>

                <Card style={{ borderLeft: '4px solid var(--primary-color)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div>
                            <p style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>Utilidad Neta</p>
                            <h3 style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-main)' }}>USD {metrics.netMargin.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</h3>
                            {(parseFloat(rates?.exchangeRate) || 0) > 0 && (
                                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: 0 }}>ARS {(metrics.netMargin * parseFloat(rates.exchangeRate)).toLocaleString('es-AR', { minimumFractionDigits: 2 })}</p>
                            )}
                        </div>
                        <div style={{ padding: '0.6rem', background: 'rgba(37, 99, 235, 0.1)', color: 'var(--primary-color)', borderRadius: '12px' }}>
                            <DollarSign size={24} />
                        </div>
                    </div>
                    <div style={{ marginTop: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Proyectado cierre de mes</span>
                    </div>
                </Card>

                <Card style={{ borderLeft: '4px solid #f59e0b' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div>
                            <p style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>Pago a Repartidores</p>
                            <h3 style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-main)' }}>{currency} {Object.values(metrics.driverPayments).reduce((sum, d) => sum + d.total, 0).toLocaleString(currency === 'USD' ? 'en-US' : 'es-AR', { minimumFractionDigits: 2 })}</h3>
                            {(parseFloat(rates?.exchangeRate) || 0) > 0 && (
                                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: 0 }}>ARS {(Object.values(metrics.driverPayments).reduce((sum, d) => sum + d.total, 0) * parseFloat(rates.exchangeRate)).toLocaleString('es-AR', { minimumFractionDigits: 2 })}</p>
                            )}
                        </div>
                        <div style={{ padding: '0.6rem', background: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b', borderRadius: '12px' }}>
                            <Users size={24} />
                        </div>
                    </div>
                    <div style={{ marginTop: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Pendiente de liquidación</span>
                    </div>
                </Card>
            </div>

            <div className="grid-responsive-dashboard">
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                    {/* Profit Analysis Table */}
                    <Card title="Detalle de Utilidad por Servicio" className="table-responsive">
                        <div style={{ overflowX: 'auto' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                                <thead>
                                    <tr style={{ borderBottom: '1px solid var(--border)' }}>
                                        <th style={{ padding: '1rem', width: '40px' }}>
                                            <input
                                                type="checkbox"
                                                onChange={toggleSelectAll}
                                                checked={filteredTickets.length > 0 && selectedTickets.size === filteredTickets.length}
                                            />
                                        </th>
                                        <th style={{ padding: '1rem', color: 'var(--text-secondary)', fontSize: '0.75rem', textTransform: 'uppercase' }}>Ticket / Caso</th>
                                        <th style={{ padding: '1rem', color: 'var(--text-secondary)', fontSize: '0.75rem', textTransform: 'uppercase' }}>Estado</th>

                                        <th style={{ padding: '1rem', color: 'var(--text-secondary)', fontSize: '0.75rem', textTransform: 'uppercase' }}>Método</th>
                                        <th style={{ padding: '1rem', color: 'var(--text-secondary)', fontSize: '0.75rem', textTransform: 'uppercase', textAlign: 'right' }}>Ingresos</th>
                                        <th style={{ padding: '1rem', color: 'var(--text-secondary)', fontSize: '0.75rem', textTransform: 'uppercase', textAlign: 'right' }}>Costos</th>
                                        <th style={{ padding: '1rem', color: 'var(--text-secondary)', fontSize: '0.75rem', textTransform: 'uppercase', textAlign: 'right' }}>Utilidad</th>
                                        <th style={{ padding: '1rem', width: '50px' }}></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredTickets.length > 0 ? filteredTickets.map(ticket => {
                                        // Calculate Profit for this row
                                        const financials = calculateTicketFinancials(ticket, rates, globalAssets, users, logisticsTasks);
                                        if (!financials) return null;

                                        const {
                                            serviceRevenue: displayServiceRevenue,
                                            logisticRevenue: displayLogisticRevenue,
                                            logisticCost: displayLogisticCost,
                                            operationalCost: displayOperationalCost,
                                            totalRevenue: displayRevenue,
                                            totalCost: displayCost,
                                            profit: displayProfit,
                                            moveType: finalMoveType,
                                            assetType: finalDeviceType,
                                            method
                                        } = financials;
                                        
                                        const currencyKey = 'USD'; // Enforced for consistency



                                        return (
                                            <tr key={ticket.id} style={{ borderBottom: '1px solid var(--border)', fontSize: '0.9rem' }} className="table-row">
                                                <td style={{ padding: '1rem' }}>
                                                    <input
                                                        type="checkbox"
                                                        checked={selectedTickets.has(ticket.id)}
                                                        onChange={() => toggleSelect(ticket.id)}
                                                    />
                                                </td>
                                                <td style={{ padding: '1rem' }}>
                                                    <span style={{ fontWeight: 600, color: 'var(--text-main)', display: 'block' }}>{ticket.id}</span>
                                                    <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{ticket.requester}</span>
                                                </td>
                                                <td style={{ padding: '1rem' }}>
                                                    <Badge variant={ticket.status === 'Servicio Facturado' ? 'success' : 'outline'}>{ticket.status}</Badge>
                                                </td>

                                                <td style={{ padding: '1rem', color: 'var(--text-main)' }}>{method || 'N/A'}</td>

                                                {/* Revenue Column */}
                                                <td style={{ padding: '1rem', textAlign: 'right' }}>
                                                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                                                        <span style={{ fontWeight: 600, color: 'var(--text-main)' }}>USD {displayRevenue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                                        <span style={{ fontSize: '0.7rem', color: '#22c55e' }}>Serv: {displayServiceRevenue.toFixed(2)} + Log: {displayLogisticRevenue.toFixed(2)}</span>
                                                    </div>
                                                </td>

                                                {/* Cost Column */}
                                                <td style={{ padding: '1rem', textAlign: 'right' }}>
                                                    {displayCost > 0 ? (
                                                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                                                            <span style={{ fontWeight: 600, color: '#ef4444' }}>- USD {displayCost.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                                            <span style={{ fontSize: '0.7rem', color: '#f87171' }}>Log: {displayLogisticCost.toFixed(2)} + Ops: {displayOperationalCost.toFixed(2)}</span>
                                                        </div>
                                                    ) : <span style={{ color: 'var(--text-secondary)' }}>-</span>}
                                                </td>

                                                {/* Utility Column */}
                                                <td style={{ padding: '1rem', fontWeight: 800, textAlign: 'right', color: displayProfit >= 0 ? '#22c55e' : '#ef4444', fontSize: '1rem' }}>
                                                    USD {displayProfit.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                </td>
                                                <td style={{ padding: '1rem', textAlign: 'center' }}>
                                                    <Button variant="ghost" size="sm" icon={Info} onClick={(e) => { e.preventDefault(); setDetailModal({ isOpen: true, ticket, financials: { serviceRevenue: displayServiceRevenue, logisticRevenue: displayLogisticRevenue, logisticCost: displayLogisticCost, operationalCost: displayOperationalCost, totalRevenue: displayRevenue, totalCost: displayCost, profit: displayProfit, method: method } }); }} style={{ color: 'var(--text-secondary)' }} />
                                                </td>
                                            </tr>
                                        );
                                    }) : (
                                        <tr>
                                            <td colSpan="8" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                                                <p>No hay registros para el período seleccionado.</p>
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </Card>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                    {/* Driver Payments */}
                    <Card title="Liquidación repartidores" action={<CreditCard size={18} style={{ opacity: 0.6 }} />}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                            {Object.entries(metrics.driverPayments).length > 0 ? (
                                Object.entries(metrics.driverPayments).map(([name, data]) => (
                                    <div key={name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem', background: 'rgba(0,0,0,0.02)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                            <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: '#e0f2fe', color: '#0284c7', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '0.85rem' }}>
                                                {name.charAt(0).toUpperCase()}
                                            </div>
                                            <div>
                                                <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{name}</div>
                                                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'flex', gap: '0.5rem' }}>
                                                    <span>{data.deliveries} E</span>
                                                    <span style={{ opacity: 0.3 }}>|</span>
                                                    <span>{data.recoveries} R</span>
                                                </div>
                                            </div>
                                        </div>
                                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                                            <div style={{ fontWeight: 700, color: 'var(--text-main)' }}>
                                                {currency} {data.total.toLocaleString(currency === 'USD' ? 'en-US' : 'es-AR', { minimumFractionDigits: 2 })}
                                            </div>
                                            {(parseFloat(rates?.exchangeRate) || 0) > 0 && (
                                                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                                                    ARS {(data.total * parseFloat(rates.exchangeRate)).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', textAlign: 'center' }}>No hay liquidaciones pendientes para el período.</p>
                            )}
                        </div>
                        {Object.entries(metrics.driverPayments).length > 0 && (
                            <Button style={{ width: '100%', marginTop: '1.5rem', justifyContent: 'center' }} variant="outline">Ver Historial de Pagos</Button>
                        )}
                    </Card>

                    {/* Financial Distribution */}
                    <Card title="Distribución de Gastos">
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            {/* Revenue Comparison */}
                            <div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '0.5rem' }}>
                                    <span style={{ color: 'var(--text-secondary)' }}>Ingresos por Servicios</span>
                                    <span style={{ fontWeight: 600 }}>{currency} {metrics.totalServiceRevenue.toLocaleString(currency === 'USD' ? 'en-US' : 'es-AR', { minimumFractionDigits: 2 })}</span>
                                </div>
                                <div style={{ height: '8px', background: 'var(--border)', borderRadius: '4px', overflow: 'hidden' }}>
                                    <div style={{ height: '100%', background: '#22c55e', width: `${metrics.totalRevenue > 0 ? (metrics.totalServiceRevenue / metrics.totalRevenue) * 100 : 0}%` }} />
                                </div>
                            </div>
                            <div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '0.5rem' }}>
                                    <span style={{ color: 'var(--text-secondary)' }}>Ingresos por Logística</span>
                                    <span style={{ fontWeight: 600 }}>{currency} {metrics.totalLogisticRevenue.toLocaleString(currency === 'USD' ? 'en-US' : 'es-AR', { minimumFractionDigits: 2 })}</span>
                                </div>
                                <div style={{ height: '8px', background: 'var(--border)', borderRadius: '4px', overflow: 'hidden' }}>
                                    <div style={{ height: '100%', background: '#3b82f6', width: `${metrics.totalRevenue > 0 ? (metrics.totalLogisticRevenue / metrics.totalRevenue) * 100 : 0}%` }} />
                                </div>
                            </div>

                            <div style={{ height: '1px', background: 'var(--border)', margin: '0.5rem 0' }} />

                            {/* Costs Breakdown */}
                            <div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '0.5rem' }}>
                                    <span style={{ color: 'var(--text-secondary)' }}>Costos Envíos Correo</span>
                                    <span style={{ fontWeight: 600, color: '#ef4444' }}>{currency} {metrics.totalPostalCost.toLocaleString(currency === 'USD' ? 'en-US' : 'es-AR', { minimumFractionDigits: 2 })}</span>
                                </div>
                                <div style={{ height: '6px', background: 'var(--border)', borderRadius: '4px', overflow: 'hidden' }}>
                                    <div style={{ height: '100%', background: '#ef4444', width: `${metrics.totalRevenue > 0 ? (metrics.totalPostalCost / metrics.totalRevenue) * 100 : 0}%` }} />
                                </div>
                            </div>
                            <div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '0.5rem' }}>
                                    <span style={{ color: 'var(--text-secondary)' }}>Pagado a Repartidores</span>
                                    <span style={{ fontWeight: 600 }}>{currency} {metrics.totalDriverCost.toLocaleString(currency === 'USD' ? 'en-US' : 'es-AR', { minimumFractionDigits: 2 })}</span>
                                </div>
                                <div style={{ height: '6px', background: 'var(--border)', borderRadius: '4px', overflow: 'hidden' }}>
                                    <div style={{ height: '100%', background: '#f59e0b', width: `${metrics.totalRevenue > 0 ? (metrics.totalDriverCost / metrics.totalRevenue) * 100 : 0}%` }} />
                                </div>
                            </div>
                            <div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '0.5rem' }}>
                                    <span style={{ color: 'var(--text-secondary)' }}>Gastos Operativos (Manual)</span>
                                    <span style={{ fontWeight: 600, color: '#800020' }}>{currency} {(metrics.totalManualExpenses * (currency === 'USD' ? 1 : (parseFloat(rates?.exchangeRate) || 1))).toLocaleString(currency === 'USD' ? 'en-US' : 'es-AR', { minimumFractionDigits: 2 })}</span>
                                </div>
                                <div style={{ height: '6px', background: 'var(--border)', borderRadius: '4px', overflow: 'hidden' }}>
                                    <div style={{ height: '100%', background: '#800020', width: `${metrics.totalRevenue > 0 ? ((metrics.totalManualExpenses * (currency === 'USD' ? 1 : (parseFloat(rates?.exchangeRate) || 1))) / metrics.totalRevenue) * 100 : 0}%` }} />
                                </div>
                            </div>
                        </div>
                    </Card>

                    {/* Manual Expenses Detail Card */}
                    <Card title="Gastos Operativos (Manual)" action={<DollarSign size={18} style={{ opacity: 0.6 }} />}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                            {filteredExpenses && filteredExpenses.length > 0 ? (
                                filteredExpenses.map(expense => (
                                    <div key={expense.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem', background: 'var(--background)', borderRadius: '8px', border: '1px solid var(--border)' }}>
                                        <div>
                                            <div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-main)' }}>{expense.description}</div>
                                            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                                                <span>{new Date(expense.date).toLocaleDateString()}</span>
                                                <span style={{ width: '4px', height: '4px', background: 'var(--text-secondary)', borderRadius: '50%', opacity: 0.5 }}></span>
                                                <span style={{ fontStyle: 'italic' }}>{expense.created_by || 'Usuario'}</span>
                                            </div>
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                                                <span style={{ fontWeight: 700, color: '#800020' }}>
                                                    {currency} {(parseFloat(expense.amount) * (currency === 'USD' ? 1 : (parseFloat(rates?.exchangeRate) || 1))).toLocaleString(currency === 'USD' ? 'en-US' : 'es-AR', { minimumFractionDigits: 2 })}
                                                </span>
                                                {(parseFloat(rates?.exchangeRate) || 0) > 0 && (
                                                    <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                                                        ARS {(parseFloat(expense.amount) * parseFloat(rates.exchangeRate)).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                                                    </span>
                                                )}
                                            </div>
                                            <button
                                                onClick={() => { if (confirm('¿Eliminar este gasto?')) deleteExpense(expense.id); }}
                                                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', padding: '4px' }}
                                                title="Eliminar gasto"
                                            >
                                                <Trash size={14} />
                                            </button>
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', textAlign: 'center', padding: '1rem' }}>No hay gastos manuales registrados este mes.</p>
                            )}
                        </div>
                    </Card>
                </div >
            </div >

            <Modal isOpen={isRatesModalOpen} onClose={() => setIsRatesModalOpen(false)} title="Configuración de Cuadro Tarifario">
                <form onSubmit={handleSaveRates} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                    {/* Dolar Section */}
                    <div style={{ padding: '1rem', background: 'var(--surface)', borderRadius: '8px', border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <h4 style={{ fontSize: '0.9rem', fontWeight: 700, margin: 0, color: 'var(--text-main)' }}>Cotización Dólar (Hoy)</h4>
                            <div style={{ display: 'flex', gap: '1rem', fontSize: '0.75rem' }}>
                                {dolarQuotes.official && (
                                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                                        <span style={{ color: 'var(--text-secondary)' }}>Banco Nación (Oficial)</span>
                                        <span style={{ fontWeight: 600, color: '#2563eb' }}>C: ${dolarQuotes.official.compra} / V: ${dolarQuotes.official.venta}</span>
                                    </div>
                                )}
                                {dolarQuotes.blue && (
                                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                                        <span style={{ color: 'var(--text-secondary)' }}>Dólar Blue</span>
                                        <span style={{ fontWeight: 600, color: '#16a34a' }}>C: ${dolarQuotes.blue.compra} / V: ${dolarQuotes.blue.venta}</span>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="form-group">
                            <label className="form-label">Valor de Referencia (Interno)</label>
                            <div style={{ position: 'relative' }}>
                                <span style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }}>ARS</span>
                                <input
                                    type="number"
                                    className="form-input"
                                    style={{ paddingLeft: '45px', fontWeight: 700 }}
                                    placeholder={dolarQuotes.official?.venta ? String(dolarQuotes.official.venta) : '0.00'}
                                    value={tempRates.exchangeRate || ''}
                                    onChange={e => { const val = e.target.value; setTempRates(prev => ({ ...prev, exchangeRate: val === '' ? '' : parseFloat(val) })) }}
                                />
                            </div>
                            <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                                Este valor se utilizará para cálculos de conversión si es necesario.
                            </p>
                        </div>
                    </div>
                    <div style={{ padding: '1rem', background: 'rgba(37, 99, 235, 0.05)', borderRadius: '8px', border: '1px solid rgba(37, 99, 235, 0.1)' }}>
                        <h4 style={{ fontSize: '0.9rem', fontWeight: 700, marginBottom: '1rem', color: 'var(--primary-color)' }}>Ingresos por Servicios (Cuadro Tarifario)</h4>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                            {/* Laptops */}
                            <div className="form-group">
                                <label className="form-label">Entrega Laptops</label>
                                <div style={{ position: 'relative' }}>
                                    <span style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }}>USD</span>
                                    <input type="number" className="form-input" style={{ paddingLeft: '45px' }}
                                        value={tempRates.service_Laptop_Delivery !== undefined ? tempRates.service_Laptop_Delivery : (tempRates.laptopService || 25)}
                                        onChange={e => { const val = e.target.value; setTempRates(prev => ({ ...prev, service_Laptop_Delivery: val === '' ? '' : parseFloat(val) })) }}
                                    />
                                </div>
                            </div>
                            <div className="form-group">
                                <label className="form-label">Recupero Laptops</label>
                                <div style={{ position: 'relative' }}>
                                    <span style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }}>USD</span>
                                    <input type="number" className="form-input" style={{ paddingLeft: '45px' }}
                                        value={tempRates.service_Laptop_Recovery !== undefined ? tempRates.service_Laptop_Recovery : (tempRates.laptopService || 25)}
                                        onChange={e => { const val = e.target.value; setTempRates(prev => ({ ...prev, service_Laptop_Recovery: val === '' ? '' : parseFloat(val) })) }}
                                    />
                                </div>
                            </div>

                            {/* Smartphones */}
                            <div className="form-group">
                                <label className="form-label">Entrega Smartphones</label>
                                <div style={{ position: 'relative' }}>
                                    <span style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }}>USD</span>
                                    <input type="number" className="form-input" style={{ paddingLeft: '45px' }}
                                        value={tempRates.service_Smartphone_Delivery !== undefined ? tempRates.service_Smartphone_Delivery : (tempRates.smartphoneService || 5)}
                                        onChange={e => { const val = e.target.value; setTempRates(prev => ({ ...prev, service_Smartphone_Delivery: val === '' ? '' : parseFloat(val) })) }}
                                    />
                                </div>
                            </div>
                            <div className="form-group">
                                <label className="form-label">Recupero Smartphones</label>
                                <div style={{ position: 'relative' }}>
                                    <span style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }}>USD</span>
                                    <input type="number" className="form-input" style={{ paddingLeft: '45px' }}
                                        value={tempRates.service_Smartphone_Recovery !== undefined ? tempRates.service_Smartphone_Recovery : (tempRates.smartphoneService || 5)}
                                        onChange={e => { const val = e.target.value; setTempRates(prev => ({ ...prev, service_Smartphone_Recovery: val === '' ? '' : parseFloat(val) })) }}
                                    />
                                </div>
                            </div>

                            {/* Security Keys */}
                            <div className="form-group">
                                <label className="form-label">Entrega Security Keys</label>
                                <div style={{ position: 'relative' }}>
                                    <span style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }}>USD</span>
                                    <input type="number" className="form-input" style={{ paddingLeft: '45px' }}
                                        value={tempRates.service_Key_Delivery !== undefined ? tempRates.service_Key_Delivery : (tempRates.securityKeyService || 5)}
                                        onChange={e => { const val = e.target.value; setTempRates(prev => ({ ...prev, service_Key_Delivery: val === '' ? '' : parseFloat(val) })) }}
                                    />
                                </div>
                            </div>
                            <div className="form-group">
                                <label className="form-label">Recupero Security Keys</label>
                                <div style={{ position: 'relative' }}>
                                    <span style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }}>USD</span>
                                    <input type="number" className="form-input" style={{ paddingLeft: '45px' }}
                                        value={tempRates.service_Key_Recovery !== undefined ? tempRates.service_Key_Recovery : (tempRates.securityKeyService || 5)}
                                        onChange={e => { const val = e.target.value; setTempRates(prev => ({ ...prev, service_Key_Recovery: val === '' ? '' : parseFloat(val) })) }}
                                    />
                                </div>
                            </div>

                            {/* Warranty */}
                            <div className="form-group">
                                <label className="form-label">Garantía (Cualquier Disp.)</label>
                                <div style={{ position: 'relative' }}>
                                    <span style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }}>USD</span>
                                    <input type="number" className="form-input" style={{ paddingLeft: '45px' }}
                                        value={tempRates.service_Warranty !== undefined ? tempRates.service_Warranty : (tempRates.warrantyService || 60)}
                                        onChange={e => { const val = e.target.value; setTempRates(prev => ({ ...prev, service_Warranty: val === '' ? '' : parseFloat(val) })) }}
                                    />
                                </div>
                            </div>
                        </div>

                        <h4 style={{ fontSize: '0.9rem', fontWeight: 700, margin: '1.5rem 0 1rem 0', color: 'var(--primary-color)' }}>Logística</h4>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                            <div className="form-group">
                                <label className="form-label">Cobro Envío (Repartidor Propio)</label>
                                <div style={{ position: 'relative' }}>
                                    <span style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }}>USD</span>
                                    <input type="number" className="form-input" style={{ paddingLeft: '45px' }}
                                        value={tempRates.logistics_Internal_Revenue !== undefined ? tempRates.logistics_Internal_Revenue : (tempRates.internalDeliveryRevenue || '')}
                                        onChange={e => { const val = e.target.value; setTempRates(prev => ({ ...prev, logistics_Internal_Revenue: val === '' ? '' : parseFloat(val) })) }}
                                    />
                                </div>
                            </div>
                            <div className="form-group">
                                <label className="form-label">Cobro Extra (Correo)</label>
                                <div style={{ position: 'relative' }}>
                                    <span style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }}>USD</span>
                                    <input type="number" className="form-input" style={{ paddingLeft: '45px' }}
                                        value={tempRates.logistics_Postal_Markup !== undefined ? tempRates.logistics_Postal_Markup : (tempRates.postalServiceMarkup || '')}
                                        onChange={e => { const val = e.target.value; setTempRates(prev => ({ ...prev, logistics_Postal_Markup: val === '' ? '' : parseFloat(val) })) }}
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    <div style={{ padding: '1rem', background: 'rgba(239, 68, 68, 0.05)', borderRadius: '8px', border: '1px solid rgba(239, 68, 68, 0.1)' }}>
                        <h4 style={{ fontSize: '0.9rem', fontWeight: 700, marginBottom: '1rem', color: '#ef4444' }}>Costos Operativos (Egresos)</h4>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                            <div className="form-group">
                                <label className="form-label">Pago a Repartidor Propio</label>
                                <div style={{ position: 'relative' }}>
                                    <span style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }}>USD</span>
                                    <input
                                        type="number"
                                        className="form-input"
                                        style={{ paddingLeft: '45px' }}
                                        value={tempRates.cost_Driver_Commission !== undefined ? tempRates.cost_Driver_Commission : (tempRates.driverCommission || '')}
                                        onChange={e => { const val = e.target.value; setTempRates(prev => ({ ...prev, cost_Driver_Commission: val === '' ? '' : parseFloat(val) })) }}
                                    />
                                </div>
                            </div>
                            <div className="form-group">
                                <label className="form-label">Costo Base Correo (Promedio)</label>
                                <div style={{ position: 'relative' }}>
                                    <span style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }}>USD</span>
                                    <input
                                        type="number"
                                        className="form-input"
                                        style={{ paddingLeft: '45px' }}
                                        value={tempRates.cost_Postal_Base !== undefined ? tempRates.cost_Postal_Base : (tempRates.postalBaseCost || '')}
                                        onChange={e => { const val = e.target.value; setTempRates(prev => ({ ...prev, cost_Postal_Base: val === '' ? '' : parseFloat(val) })) }}
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Driver Specific Bonuses */}
                        <div style={{ marginTop: '1.5rem', paddingTop: '1rem', borderTop: '1px solid rgba(239, 68, 68, 0.1)' }}>
                            <h5 style={{ fontSize: '0.85rem', fontWeight: 700, marginBottom: '0.75rem', color: 'var(--text-secondary)' }}>Incentivos por Conductor</h5>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem' }}>
                                {users.map(user => {
                                    const driver = user.name;
                                    return (
                                        <div key={user.id} style={{ background: 'rgba(255,255,255,0.5)', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border)' }}>
                                            <div style={{ fontWeight: 700, fontSize: '0.8rem', marginBottom: '0.5rem', textTransform: 'uppercase', color: 'var(--primary-color)' }}>{driver}</div>
                                            <table style={{ width: '100%', fontSize: '0.75rem', borderCollapse: 'collapse' }}>
                                                <thead>
                                                    <tr style={{ color: 'var(--text-secondary)' }}>
                                                        <th style={{ textAlign: 'left', paddingBottom: '0.25rem' }}>Disp.</th>
                                                        <th style={{ textAlign: 'left', paddingBottom: '0.25rem' }}>Entrega</th>
                                                        <th style={{ textAlign: 'left', paddingBottom: '0.25rem' }}>Recupero</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {['Laptop', 'Smartphone', 'Yubikey'].map(type => {
                                                        const displayType = {
                                                            'Laptop': 'Notebook',
                                                            'Smartphone': 'Celular',
                                                            'Yubikey': 'Llave'
                                                        }[type] || type;

                                                        return (
                                                            <tr key={type}>
                                                                <td style={{ padding: '0.25rem 0', fontWeight: 500 }}>{displayType}</td>
                                                                <td style={{ padding: '0.25rem 0.25rem 0.25rem 0' }}>
                                                                    <input
                                                                        type="number"
                                                                        placeholder="0"
                                                                        className="form-input"
                                                                        style={{ padding: '0.25rem 0.5rem', height: 'auto', fontSize: '0.8rem' }}
                                                                        value={tempRates[`driverExtra_${driver}_Delivery_${type}`] || ''}
                                                                        onChange={e => {
                                                                            const val = e.target.value;
                                                                            setTempRates(prev => ({ ...prev, [`driverExtra_${driver}_Delivery_${type}`]: val === '' ? '' : parseFloat(val) }))
                                                                        }}
                                                                    />
                                                                </td>
                                                                <td style={{ padding: '0.25rem 0 0.25rem 0.25rem' }}>
                                                                    <input
                                                                        type="number"
                                                                        placeholder="0"
                                                                        className="form-input"
                                                                        style={{ padding: '0.25rem 0.5rem', height: 'auto', fontSize: '0.8rem' }}
                                                                        value={tempRates[`driverExtra_${driver}_Recovery_${type}`] || ''}
                                                                        onChange={e => {
                                                                            const val = e.target.value;
                                                                            setTempRates(prev => ({ ...prev, [`driverExtra_${driver}_Recovery_${type}`]: val === '' ? '' : parseFloat(val) }))
                                                                        }}
                                                                    />
                                                                </td>
                                                            </tr>
                                                        );
                                                    })}
                                                </tbody>
                                            </table>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '1rem' }}>
                        <Button type="button" variant="secondary" onClick={() => setIsRatesModalOpen(false)}>Cancelar</Button>
                        <Button type="submit">Guardar Tarifas</Button>
                    </div>
                </form>
            </Modal>

            {/* Detail Modal - Redesigned */}
            <Modal isOpen={detailModal.isOpen} onClose={() => setDetailModal({ ...detailModal, isOpen: false })}>
                <div style={{ padding: '1rem', maxHeight: '85vh', overflowY: 'auto' }}>
                    {(() => {
                        const t = detailModal.ticket;
                        if (!t) return null;

                        // Get all sub-tasks for this ticket
                        const relatedTasks = (logisticsTasks || []).filter(task =>
                            String(task.ticket_id || task.ticketId) === String(t.id)
                        );

                        // Calculate per-task financials
                        const taskFinancials = relatedTasks.map(task => calculateTaskFinancials(task, rates, globalAssets, users)).filter(Boolean);

                        // If no sub-tasks, fall back to ticket-level calculation
                        const fallbackF = calculateTicketFinancials(t, rates, globalAssets, users, logisticsTasks);
                        
                        // Grand totals
                        const grandTotalRevenue = taskFinancials.length > 0
                            ? taskFinancials.reduce((s, f) => s + f.totalRevenue, 0)
                            : (fallbackF?.totalRevenue || 0);
                        const grandTotalCost = taskFinancials.length > 0
                            ? taskFinancials.reduce((s, f) => s + f.totalCost, 0)
                            : (fallbackF?.totalCost || 0);
                        const grandProfit = grandTotalRevenue - grandTotalCost;

                        const fmt = (n) => `USD ${(n || 0).toFixed(2)}`;

                        const MoveTypeBadge = ({ type }) => {
                            const isD = (type || '').toLowerCase().includes('entrega') || (type || '').toLowerCase().includes('alta');
                            const isR = (type || '').toLowerCase().includes('recupero') || (type || '').toLowerCase().includes('retiro') || (type || '').toLowerCase().includes('baja');
                            const color = isD ? '#2563eb' : (isR ? '#dc2626' : '#64748b');
                            const bg = isD ? '#eff6ff' : (isR ? '#fef2f2' : '#f1f5f9');
                            return <span style={{ background: bg, color, fontWeight: 700, fontSize: '0.75rem', padding: '3px 10px', borderRadius: '20px', border: `1px solid ${color}22` }}>{type || 'N/D'}</span>;
                        };

                        const DeviceBadge = ({ type }) => {
                            const icons = { Laptop: '💻', Smartphone: '📱', Tablet: '📲', 'Security Key': '🔑', Yubikey: '🔑' };
                            return <span style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-main)' }}>{icons[type] || '📦'} {type || 'Dispositivo'}</span>;
                        };

                        return (
                            <>
                                {/* Header */}
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem', borderBottom: '2px solid var(--border)', paddingBottom: '1rem' }}>
                                    <div>
                                        <h2 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-main)', margin: 0 }}>Detalle Financiero del Servicio</h2>
                                        <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', margin: '4px 0 0 0' }}>
                                            Ref: {t.id} &bull; {t.requester} &bull; {relatedTasks.length > 0 ? `${relatedTasks.length} sub-caso(s)` : 'Sin sub-casos'}
                                        </p>
                                    </div>
                                    <div style={{ textAlign: 'right', background: grandProfit >= 0 ? '#f0fdf4' : '#fef2f2', border: `1px solid ${grandProfit >= 0 ? '#bbf7d0' : '#fecaca'}`, borderRadius: '10px', padding: '0.5rem 1rem' }}>
                                        <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Ganancia Neta</div>
                                        <div style={{ fontSize: '1.5rem', fontWeight: 900, color: grandProfit >= 0 ? '#16a34a' : '#dc2626' }}>{fmt(grandProfit)}</div>
                                    </div>
                                </div>

                                {/* Per-task blocks */}
                                {taskFinancials.length > 0 ? (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                                        {taskFinancials.map((tf, idx) => (
                                            <div key={tf.taskId || idx} style={{ border: '1px solid var(--border)', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
                                                {/* Task Header */}
                                                <div style={{ background: 'var(--surface)', padding: '0.75rem 1rem', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                    <div>
                                                        <span style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-main)' }}>{tf.taskSubject}</span>
                                                        {tf.taskRef && <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginLeft: '0.5rem' }}>#{tf.taskRef}</span>}
                                                    </div>
                                                    <span style={{ fontWeight: 800, fontSize: '0.95rem', color: tf.profit >= 0 ? '#16a34a' : '#dc2626' }}>{fmt(tf.profit)}</span>
                                                </div>

                                                <div style={{ padding: '1rem' }}>
                                                    {/* Service Info Row */}
                                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '1rem', marginBottom: '1rem', paddingBottom: '1rem', borderBottom: '1px dashed var(--border)' }}>
                                                        <div>
                                                            <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase', marginBottom: '4px' }}>Tipo de Servicio</div>
                                                            <MoveTypeBadge type={tf.moveType} />
                                                        </div>
                                                        <div>
                                                            <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase', marginBottom: '4px' }}>Tipo de Dispositivo</div>
                                                            <DeviceBadge type={tf.assetType} />
                                                            {tf.deviceSerial && <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginTop: '2px' }}>S/N: {tf.deviceSerial}</div>}
                                                        </div>
                                                        <div>
                                                            <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase', marginBottom: '4px' }}>Medio de Entrega</div>
                                                            <span style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-main)' }}>{tf.method || 'N/A'}</span>
                                                            {/* Show tracking if postal */}
                                                            {(tf.isAndreani || tf.isCorreo) && (
                                                                <div style={{ marginTop: '4px' }}>
                                                                    <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Tracking: </span>
                                                                    <span style={{ fontSize: '0.8rem', fontWeight: 700, color: tf.trackingNumber ? '#2563eb' : 'var(--text-secondary)', fontFamily: 'monospace' }}>
                                                                        {tf.trackingNumber || '(sin número)'}
                                                                    </span>
                                                                </div>
                                                            )}
                                                            {/* Show driver name if internal */}
                                                            {tf.isInternalDriver && (
                                                                <div style={{ marginTop: '4px' }}>
                                                                    <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Responsable: </span>
                                                                    <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-main)' }}>{tf.deliveryPerson || '(sin asignar)'}</span>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>

                                                    {/* Income / Cost breakdown */}
                                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                                                        {/* INCOME */}
                                                        <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '8px', padding: '0.85rem' }}>
                                                            <div style={{ fontSize: '0.7rem', fontWeight: 800, color: '#166534', textTransform: 'uppercase', marginBottom: '0.75rem', letterSpacing: '0.05em' }}>Ingresos</div>
                                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                                                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem' }}>
                                                                    <span style={{ color: '#166534' }}>Servicio ({tf.assetType})</span>
                                                                    <span style={{ fontWeight: 700 }}>{fmt(tf.serviceRevenue)}</span>
                                                                </div>
                                                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem' }}>
                                                                    <span style={{ color: '#166534' }}>Logística</span>
                                                                    <span style={{ fontWeight: 700 }}>{fmt(tf.logisticRevenue)}</span>
                                                                </div>
                                                                <div style={{ borderTop: '1px solid #bbf7d0', marginTop: '4px', paddingTop: '6px', display: 'flex', justifyContent: 'space-between', fontWeight: 800, color: '#166534' }}>
                                                                    <span>TOTAL</span>
                                                                    <span>{fmt(tf.totalRevenue)}</span>
                                                                </div>
                                                            </div>
                                                        </div>

                                                        {/* COST */}
                                                        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', padding: '0.85rem' }}>
                                                            <div style={{ fontSize: '0.7rem', fontWeight: 800, color: '#991b1b', textTransform: 'uppercase', marginBottom: '0.75rem', letterSpacing: '0.05em' }}>Egresos</div>
                                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                                                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem' }}>
                                                                    <span style={{ color: '#991b1b' }}>{tf.isInternalDriver ? 'Comisión base' : 'Costo postal'}</span>
                                                                    <span style={{ fontWeight: 700 }}>{fmt(tf.logisticCost - tf.extraDriverCost)}</span>
                                                                </div>
                                                                {tf.isInternalDriver && (
                                                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem' }}>
                                                                        <span style={{ color: '#991b1b' }}>Extras repartidor</span>
                                                                        <span style={{ fontWeight: 700 }}>{fmt(tf.extraDriverCost)}</span>
                                                                    </div>
                                                                )}
                                                                <div style={{ borderTop: '1px solid #fecaca', marginTop: '4px', paddingTop: '6px', display: 'flex', justifyContent: 'space-between', fontWeight: 800, color: '#991b1b' }}>
                                                                    <span>TOTAL</span>
                                                                    <span>{fmt(tf.totalCost)}</span>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    /* Fallback: no sub-tasks, show ticket-level */
                                    fallbackF && (
                                        <div style={{ border: '1px solid var(--border)', borderRadius: '12px', padding: '1rem', background: 'var(--surface)' }}>
                                            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '1rem' }}>ℹ️ Este ticket no tiene sub-casos de logística registrados. Mostrando datos estimados del ticket principal.</p>
                                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                                                <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '8px', padding: '1rem' }}>
                                                    <div style={{ fontWeight: 800, color: '#166534', fontSize: '0.75rem', textTransform: 'uppercase', marginBottom: '0.5rem' }}>Ingresos Estimados</div>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '4px' }}><span>Servicio</span><span style={{ fontWeight: 700 }}>{fmt(fallbackF.serviceRevenue)}</span></div>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}><span>Logística</span><span style={{ fontWeight: 700 }}>{fmt(fallbackF.logisticRevenue)}</span></div>
                                                    <div style={{ borderTop: '1px solid #bbf7d0', marginTop: '8px', paddingTop: '8px', display: 'flex', justifyContent: 'space-between', fontWeight: 800, color: '#166534' }}><span>TOTAL</span><span>{fmt(fallbackF.totalRevenue)}</span></div>
                                                </div>
                                                <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', padding: '1rem' }}>
                                                    <div style={{ fontWeight: 800, color: '#991b1b', fontSize: '0.75rem', textTransform: 'uppercase', marginBottom: '0.5rem' }}>Egresos Estimados</div>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '4px' }}><span>Logística</span><span style={{ fontWeight: 700 }}>{fmt(fallbackF.logisticCost)}</span></div>
                                                    <div style={{ borderTop: '1px solid #fecaca', marginTop: '8px', paddingTop: '8px', display: 'flex', justifyContent: 'space-between', fontWeight: 800, color: '#991b1b' }}><span>TOTAL</span><span>{fmt(fallbackF.totalCost)}</span></div>
                                                </div>
                                            </div>
                                        </div>
                                    )
                                )}

                                {/* Grand Total Footer */}
                                {taskFinancials.length > 1 && (
                                    <div style={{ marginTop: '1.25rem', padding: '1rem', background: 'var(--surface)', border: '2px solid var(--border)', borderRadius: '12px', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem', textAlign: 'center' }}>
                                        <div>
                                            <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase' }}>Total Ingresos</div>
                                            <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#16a34a' }}>{fmt(grandTotalRevenue)}</div>
                                        </div>
                                        <div>
                                            <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase' }}>Total Egresos</div>
                                            <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#dc2626' }}>{fmt(grandTotalCost)}</div>
                                        </div>
                                        <div style={{ borderLeft: '2px solid var(--border)', paddingLeft: '1rem' }}>
                                            <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase' }}>Ganancia Neta</div>
                                            <div style={{ fontSize: '1.1rem', fontWeight: 900, color: grandProfit >= 0 ? '#16a34a' : '#dc2626' }}>{fmt(grandProfit)}</div>
                                        </div>
                                    </div>
                                )}

                                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '1.5rem' }}>
                                    <Link href={`/dashboard/tickets/${t.id}`} style={{ textDecoration: 'none' }}>
                                        <Button icon={ArrowRight} variant="outline" size="sm">Ver Ticket Completo</Button>
                                    </Link>
                                    <Button onClick={() => setDetailModal({ ...detailModal, isOpen: false })}>Cerrar Detalle</Button>
                                </div>
                            </>
                        );
                    })()}
                </div>
            </Modal>

            {/* Expense Modal */}
            <Modal isOpen={isExpenseModalOpen} onClose={() => setIsExpenseModalOpen(false)} title="Agregar Gasto Operativo">
                <div style={{ padding: '1rem' }}>
                    <div className="form-group">
                        <label className="form-label">Descripción del Gasto</label>
                        <input
                            className="form-input"
                            placeholder="Ej: Cajas, Cinta de embalar"
                            value={expenseForm.description}
                            onChange={e => setExpenseForm({ ...expenseForm, description: e.target.value })}
                        />
                    </div>
                    <div className="form-group" style={{ marginTop: '1rem' }}>
                        <label className="form-label">Monto (ARS)</label>
                        <input
                            type="number"
                            className="form-input"
                            placeholder="0.00"
                            value={expenseForm.amount}
                            onChange={e => setExpenseForm({ ...expenseForm, amount: e.target.value })}
                        />
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.5rem', background: 'var(--surface-hover)', padding: '0.5rem', borderRadius: '6px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <span>Cotización ref (Guardada):</span>
                                <strong style={{ color: 'var(--primary-color)' }}>${rates?.exchangeRate || '0.00'}</strong>
                            </div>
                            {(!rates?.exchangeRate || rates.exchangeRate === 0) && (
                                <div style={{ color: '#ef4444', marginTop: '0.25rem', fontWeight: 600 }}>
                                    ⚠️ Configura y GUARDA el "Valor de Referencia" en Tarifas.
                                </div>
                            )}
                            <div>Equivalente: <strong>USD {((parseFloat(expenseForm.amount) || 0) / (parseFloat(rates?.exchangeRate) || 1)).toFixed(2)}</strong></div>
                        </div>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '1.5rem' }}>
                        <Button variant="secondary" onClick={() => setIsExpenseModalOpen(false)}>Cancelar</Button>
                        <Button onClick={handleCreateExpense} style={{ backgroundColor: '#800020', borderColor: '#800020', color: 'white' }}>Registrar Gasto</Button>
                    </div>
                </div>
            </Modal>
        </div >
    );
}
