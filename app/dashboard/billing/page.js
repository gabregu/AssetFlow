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

import { resolveTicketServiceDetails, getRate } from './utils';

export default function BillingPage() {
    const { tickets, assets: globalAssets, users, currentUser, rates, updateRates, deleteTickets } = useStore();
    const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
    const [isRatesModalOpen, setIsRatesModalOpen] = useState(false);
    const [tempRates, setTempRates] = useState({});
    const [selectedTickets, setSelectedTickets] = useState(new Set());
    const [detailModal, setDetailModal] = useState({ isOpen: false, ticket: null, financials: null });
    const [dolarQuotes, setDolarQuotes] = useState({ official: null, blue: null });

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
    const { metrics, filteredTickets, currency } = useMemo(() => {
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
        const useArs = exchangeRate > 0;
        const multiplier = useArs ? exchangeRate : 1;
        const currencyKey = useArs ? 'ARS' : 'USD';

        const filtered = tickets.filter(ticket => {
            const ticketDate = new Date(ticket.date || ticket.deliveryCompletedDate || Date.now());
            const isDateMatch = ticketDate.getMonth() === selectedMonth && ticketDate.getFullYear() === selectedYear;
            const isStatusMatch = ['Resuelto', 'Caso SFDC Cerrado', 'Servicio Facturado'].includes(ticket.status);
            return isDateMatch && isStatusMatch;
        });



        filtered.forEach(ticket => {
            // --- 1. Service Revenue Logic (Matrix A-G) ---
            let ticketServiceRevenue = 0;
            let ticketLogisticRevenue = 0;
            let ticketLogisticCost = 0;

            const assets = ticket.associatedAssets || [];
            const primaryAsset = assets.length > 0 ? assets[0] : null;

            // --- 1. Robust Service & Device Detection (Centralized) ---
            const { moveType: finalMoveType, assetType: finalDeviceType, resolvedAsset } = resolveTicketServiceDetails(ticket, globalAssets);

            const isDelivery = finalMoveType.toLowerCase().includes('entrega') || finalMoveType.toLowerCase().includes('alta');
            const isRecovery = finalMoveType.toLowerCase().includes('recupero') || finalMoveType.toLowerCase().includes('retiro') || finalMoveType.toLowerCase().includes('baja');
            const isWarranty = ticket.subject?.toLowerCase().includes('garantía') || ticket.subject?.toLowerCase().includes('warranty') || ticket.classification === 'Garantía';

            const lowerDevice = (finalDeviceType || '').toLowerCase();
            const isLaptop = lowerDevice.includes('laptop') || lowerDevice.includes('macbook') || lowerDevice.includes('notebook') || lowerDevice.includes('equipo') || lowerDevice.includes('pc');
            const isPhone = lowerDevice.includes('smartphone') || lowerDevice.includes('celular') || lowerDevice.includes('iphone') || lowerDevice.includes('samsung');
            const isKey = lowerDevice.includes('key') || lowerDevice.includes('yubikey') || lowerDevice.includes('llave');



            let serviceRate = 5; // Default

            if (isWarranty) {
                // G: Warranty
                serviceRate = getRate(rates?.service_Warranty, rates?.warrantyService, 60);
            } else if (isLaptop) {
                // A: Laptop Delivery / B: Laptop Recovery
                if (isDelivery) serviceRate = getRate(rates?.service_Laptop_Delivery, rates?.laptopService, 25);
                else if (isRecovery) serviceRate = getRate(rates?.service_Laptop_Recovery, rates?.laptopService, 25);
                else serviceRate = getRate(rates?.laptopService, null, 25);
            } else if (isPhone) {
                // C: Smartphone Delivery / D: Smartphone Recovery
                if (isDelivery) serviceRate = getRate(rates?.service_Smartphone_Delivery, rates?.smartphoneService, 5);
                else if (isRecovery) serviceRate = getRate(rates?.service_Smartphone_Recovery, rates?.smartphoneService, 5);
                else serviceRate = getRate(rates?.smartphoneService, null, 5);
            } else if (isKey) {
                // E: Key Delivery / F: Key Recovery
                if (isDelivery) serviceRate = getRate(rates?.service_Key_Delivery, rates?.securityKeyService, 5);
                else if (isRecovery) serviceRate = getRate(rates?.service_Key_Recovery, rates?.securityKeyService, 5);
                else serviceRate = getRate(rates?.securityKeyService, null, 5);
            }

            ticketServiceRevenue = serviceRate;

            // --- 2. Logistics Revenue (H-I) ---
            const method = ticket.logistics?.method || 'N/A';
            if (method === 'Repartidor Propio' || method === 'Envío Interno' || method.includes('Propio')) {
                // H
                ticketLogisticRevenue = getRate(rates?.logistics_Internal_Revenue, rates?.internalDeliveryRevenue, 20);
            } else if (method === 'Andreani' || method === 'Correo Argentino' || method.includes('Correo')) {
                // I
                const postalCost = parseFloat(ticket.logistics?.cost || 0);
                const baseCost = postalCost > 0 ? postalCost : getRate(rates?.cost_Postal_Base, rates?.postalBaseCost, 12);
                const markup = getRate(rates?.logistics_Postal_Markup, rates?.postalServiceMarkup, 5);
                ticketLogisticRevenue = baseCost + markup;
            }

            // --- 3. Operational/Logistics Costs (J-K) ---
            if (method === 'Repartidor Propio' || method === 'Envío Interno' || method.includes('Propio')) {
                // J: Driver Commission
                let baseCommission = getRate(rates?.cost_Driver_Commission, rates?.driverCommission, 15);
                let extra = 0;

                // Driver Extra Logic
                const driverNameRaw = ticket.logistics?.deliveryPerson || '';
                let driverKey = null;
                const dLower = driverNameRaw.toLowerCase();
                if (dLower.includes('lucas')) driverKey = 'Lucas';
                else if (dLower.includes('facundo')) driverKey = 'Facundo';
                else if (dLower.includes('guillermo')) driverKey = 'Guillermo';

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

                const cost = baseCommission + extra;
                ticketLogisticCost = cost;

                // Driver Payment Tracking
                const driver = ticket.logistics?.deliveryPerson || '';
                if (driver) {
                    if (!driverPayments[driver]) driverPayments[driver] = { count: 0, total: 0, deliveries: 0, recoveries: 0 };
                    driverPayments[driver].count += 1;
                    driverPayments[driver].total += cost; // Accumulate in base USD
                    if (isDelivery) driverPayments[driver].deliveries += 1;
                    if (isRecovery) driverPayments[driver].recoveries += 1;
                }
                totalDriverCost += cost;

            } else if (method === 'Andreani' || method === 'Correo Argentino' || method.includes('Correo')) {
                // K: Postal Cost
                const postalCost = parseFloat(ticket.logistics?.cost || 0);
                const cost = postalCost > 0 ? postalCost : getRate(rates?.cost_Postal_Base, rates?.postalBaseCost, 12);
                ticketLogisticCost = cost;
                totalPostalCost += cost;
            }

            totalServiceRevenue += ticketServiceRevenue;
            totalLogisticRevenue += ticketLogisticRevenue;
            totalRevenue += (ticketServiceRevenue + ticketLogisticRevenue);
            totalLogisticsCost += ticketLogisticCost;

            // Accessories cost (Estimated 1.5 USD)
            if (ticket.accessories) {
                const accCount = Object.values(ticket.accessories).filter(v => v === true && typeof v !== 'string').length;
                if (accCount > 0) totalOperationalCost += (accCount * 1.5);
            }

            // Pending deliveries count
            if (ticket.status === 'Abierto' || ticket.status === 'En Progreso') {
                pendingDeliveriesCount += 1;
            }
        });

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
                pendingDeliveriesCount
            },
            filteredTickets: filtered,
            currency: currencyKey
        };
    }, [tickets, selectedMonth, selectedYear, rates, globalAssets]);

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

    return (
        <div style={{ paddingBottom: '4rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2rem', gap: '1rem', flexWrap: 'wrap' }}>
                <div>
                    <h1 style={{ fontSize: '1.875rem', fontWeight: 800, color: 'var(--text-main)', letterSpacing: '-0.02em', marginBottom: '0.25rem' }}>Facturación ({currency})</h1>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>Análisis financiero en {currency === 'USD' ? 'Dólares Estadounidenses' : 'Pesos Argentinos'}.</p>
                </div>

                <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                    <select
                        className="form-select"
                        value={selectedMonth}
                        onChange={e => setSelectedMonth(parseInt(e.target.value))}
                        style={{ width: 'auto', padding: '0.5rem 2rem 0.5rem 1rem' }}
                    >
                        {MONTHS.map((m, i) => <option key={m} value={i}>{m}</option>)}
                    </select>
                    <select
                        className="form-select"
                        value={selectedYear}
                        onChange={e => setSelectedYear(parseInt(e.target.value))}
                        style={{ width: 'auto', padding: '0.5rem 2rem 0.5rem 1rem' }}
                    >
                        {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
                    </select>
                    {selectedTickets.size > 0 && (
                        <Button icon={Trash} onClick={handleDeleteSelected} style={{ backgroundColor: '#ef4444', color: 'white', borderColor: '#ef4444' }}>Eliminar ({selectedTickets.size})</Button>
                    )}
                    <Button icon={Settings} onClick={() => setIsRatesModalOpen(true)}>Configurar Tarifas</Button>
                    <Button icon={Download} variant="outline">Exportar</Button>
                </div>
            </div>

            {/* Top KPIs Row */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.25rem', marginBottom: '2.5rem' }}>
                <Card style={{ borderLeft: '4px solid #22c55e' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div>
                            <p style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>Facturación Total</p>
                            <h3 style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-main)' }}>{currency} {metrics.totalRevenue.toLocaleString(currency === 'USD' ? 'en-US' : 'es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</h3>
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
                            <h3 style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-main)' }}>{currency} {metrics.totalCost.toLocaleString(currency === 'USD' ? 'en-US' : 'es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</h3>
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
                            <h3 style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-main)' }}>{currency} {metrics.netMargin.toLocaleString(currency === 'USD' ? 'en-US' : 'es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</h3>
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

            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '2rem' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                    {/* Profit Analysis Table */}
                    <Card title="Detalle de Utilidad por Servicio">
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
                                        let serviceRevenue = 0;
                                        let logisticRevenue = 0;
                                        let logisticCost = 0;
                                        let operationalCost = 0;

                                        const method = ticket.logistics?.method;

                                        // Revenue Calculation & Metadata Extraction (Unified)
                                        const { moveType: finalMoveType, assetType: finalDeviceType, resolvedAsset } = resolveTicketServiceDetails(ticket, globalAssets);


                                        // --- 2. Matrix Pricing Logic (A-G) ---
                                        let serviceRate = 5; // Default Base

                                        const isDelivery = finalMoveType.toLowerCase().includes('entrega') || finalMoveType.toLowerCase().includes('alta');
                                        const isRecovery = finalMoveType.toLowerCase().includes('recupero') || finalMoveType.toLowerCase().includes('retiro') || finalMoveType.toLowerCase().includes('baja');
                                        const isWarranty = ticket.subject?.toLowerCase().includes('garantía') || ticket.subject?.toLowerCase().includes('warranty') || ticket.classification === 'Garantía';

                                        const lowerDevice = (finalDeviceType || '').toLowerCase();
                                        const isLaptop = lowerDevice.includes('laptop') || lowerDevice.includes('macbook') || lowerDevice.includes('notebook') || lowerDevice.includes('equipo') || lowerDevice.includes('pc');
                                        const isPhone = lowerDevice.includes('smartphone') || lowerDevice.includes('celular') || lowerDevice.includes('iphone') || lowerDevice.includes('samsung');
                                        const isKey = lowerDevice.includes('key') || lowerDevice.includes('yubikey') || lowerDevice.includes('llave');

                                        // Helper to safely get rate, allowing 0 as a valid value
                                        const getRate = (primary, secondary, def) => {
                                            if (primary !== undefined && primary !== null && primary !== '') return parseFloat(primary);
                                            if (secondary !== undefined && secondary !== null && secondary !== '') return parseFloat(secondary);
                                            return def;
                                        };

                                        if (isWarranty) {
                                            // G: Warranty
                                            serviceRate = getRate(rates?.service_Warranty, rates?.warrantyService, 60);
                                        } else if (isLaptop) {
                                            // A: Laptop Delivery / B: Laptop Recovery
                                            if (isDelivery) serviceRate = getRate(rates?.service_Laptop_Delivery, rates?.laptopService, 25);
                                            else if (isRecovery) serviceRate = getRate(rates?.service_Laptop_Recovery, rates?.laptopService, 25);
                                            else serviceRate = getRate(rates?.laptopService, null, 25);
                                        } else if (isPhone) {
                                            // C: Smartphone Delivery / D: Smartphone Recovery
                                            if (isDelivery) serviceRate = getRate(rates?.service_Smartphone_Delivery, rates?.smartphoneService, 5);
                                            else if (isRecovery) serviceRate = getRate(rates?.service_Smartphone_Recovery, rates?.smartphoneService, 5);
                                            else serviceRate = getRate(rates?.smartphoneService, null, 5);
                                        } else if (isKey) {
                                            // E: Key Delivery / F: Key Recovery
                                            if (isDelivery) serviceRate = getRate(rates?.service_Key_Delivery, rates?.securityKeyService, 5);
                                            else if (isRecovery) serviceRate = getRate(rates?.service_Key_Recovery, rates?.securityKeyService, 5);
                                            else serviceRate = getRate(rates?.securityKeyService, null, 5);
                                        }

                                        serviceRevenue += serviceRate;

                                        const safeMethod = method || 'N/A';

                                        // --- 3. Logistics Logic (H-I) ---
                                        if (safeMethod === 'Repartidor Propio' || safeMethod === 'Envío Interno' || safeMethod.includes('Propio')) {
                                            // H: Internal Delivery Revenue
                                            logisticRevenue += getRate(rates?.logistics_Internal_Revenue, rates?.internalDeliveryRevenue, 20);
                                        } else if (safeMethod === 'Andreani' || safeMethod === 'Correo Argentino' || safeMethod.includes('Correo')) {
                                            // I: Postal Service Markup (Revenue = Cost + Markup)
                                            const postalCost = parseFloat(ticket.logistics?.cost || 0);
                                            // If ticket has recorded cost, use it; otherwise fallback to configured base cost
                                            const baseCost = postalCost > 0 ? postalCost : getRate(rates?.cost_Postal_Base, rates?.postalBaseCost, 12);
                                            const markup = getRate(rates?.logistics_Postal_Markup, rates?.postalServiceMarkup, 5);

                                            logisticRevenue += (baseCost + markup);
                                        }

                                        // --- 4. Operational Costs (J-K) ---
                                        // Commission/Cost
                                        if (safeMethod === 'Repartidor Propio' || safeMethod === 'Envío Interno' || safeMethod.includes('Propio')) {
                                            // J: Driver Commission
                                            let baseCommission = getRate(rates?.cost_Driver_Commission, rates?.driverCommission, 15);
                                            let extra = 0;

                                            // Driver Extra Logic
                                            const driverNameRaw = ticket.logistics?.deliveryPerson || '';
                                            let driverKey = null;
                                            const dLower = driverNameRaw.toLowerCase();
                                            if (dLower.includes('lucas')) driverKey = 'Lucas';
                                            else if (dLower.includes('facundo')) driverKey = 'Facundo';
                                            else if (dLower.includes('guillermo')) driverKey = 'Guillermo';

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

                                            logisticCost += (baseCommission + extra);
                                        } else if (safeMethod === 'Andreani' || safeMethod === 'Correo Argentino' || safeMethod.includes('Correo')) {
                                            // K: Postal Service Cost
                                            const postalCost = parseFloat(ticket.logistics?.cost || 0);
                                            logisticCost += (postalCost > 0 ? postalCost : getRate(rates?.cost_Postal_Base, rates?.postalBaseCost, 12));
                                        }

                                        // Multiplier Logic for Row
                                        const exchangeRate = parseFloat(rates?.exchangeRate) || 0;
                                        const useArs = exchangeRate > 0;
                                        const multiplier = useArs ? exchangeRate : 1;
                                        const currencyKey = useArs ? 'ARS' : 'USD';

                                        // Calculations in USD base
                                        const totalRevenueUSD = serviceRevenue + logisticRevenue;
                                        const totalCostUSD = logisticCost + operationalCost;

                                        // Final conversion
                                        const displayRevenue = totalRevenueUSD * multiplier;
                                        const displayCost = totalCostUSD * multiplier;
                                        const displayProfit = (totalRevenueUSD - totalCostUSD) * multiplier;
                                        const displayServiceRevenue = serviceRevenue * multiplier;
                                        const displayLogisticRevenue = logisticRevenue * multiplier;
                                        const displayLogisticCost = logisticCost * multiplier;
                                        const displayOperationalCost = operationalCost * multiplier;

                                        // Aliases for Table Display Compatibility
                                        const displayMoveType = finalMoveType;
                                        const displayAssetType = finalDeviceType;

                                        // --- END OF NEW LOGIC ---



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
                                                        <span style={{ fontWeight: 600, color: 'var(--text-main)' }}>{currencyKey} {displayRevenue.toLocaleString(currencyKey === 'USD' ? 'en-US' : 'es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                                        <span style={{ fontSize: '0.7rem', color: '#22c55e' }}>Serv: {displayServiceRevenue.toFixed(2)} + Log: {displayLogisticRevenue.toFixed(2)}</span>
                                                    </div>
                                                </td>

                                                {/* Cost Column */}
                                                <td style={{ padding: '1rem', textAlign: 'right' }}>
                                                    {displayCost > 0 ? (
                                                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                                                            <span style={{ fontWeight: 600, color: '#ef4444' }}>- {currencyKey} {displayCost.toLocaleString(currencyKey === 'USD' ? 'en-US' : 'es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                                            <span style={{ fontSize: '0.7rem', color: '#f87171' }}>Log: {displayLogisticCost.toFixed(2)} + Ops: {displayOperationalCost.toFixed(2)}</span>
                                                        </div>
                                                    ) : <span style={{ color: 'var(--text-secondary)' }}>-</span>}
                                                </td>

                                                {/* Utility Column */}
                                                <td style={{ padding: '1rem', fontWeight: 800, textAlign: 'right', color: displayProfit >= 0 ? '#22c55e' : '#ef4444', fontSize: '1rem' }}>
                                                    {currencyKey} {displayProfit.toLocaleString(currencyKey === 'USD' ? 'en-US' : 'es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
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
                                        <div style={{ fontWeight: 700, color: 'var(--text-main)' }}>
                                            {currency} {data.total.toLocaleString(currency === 'USD' ? 'en-US' : 'es-AR', { minimumFractionDigits: 2 })}
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
                        </div>
                    </Card>
                </div>
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
                                    onChange={e => setTempRates({ ...tempRates, exchangeRate: parseFloat(e.target.value) })}
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
                                        onChange={e => setTempRates({ ...tempRates, service_Laptop_Delivery: parseFloat(e.target.value) })}
                                    />
                                </div>
                            </div>
                            <div className="form-group">
                                <label className="form-label">Recupero Laptops</label>
                                <div style={{ position: 'relative' }}>
                                    <span style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }}>USD</span>
                                    <input type="number" className="form-input" style={{ paddingLeft: '45px' }}
                                        value={tempRates.service_Laptop_Recovery !== undefined ? tempRates.service_Laptop_Recovery : (tempRates.laptopService || 25)}
                                        onChange={e => setTempRates({ ...tempRates, service_Laptop_Recovery: parseFloat(e.target.value) })}
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
                                        onChange={e => setTempRates({ ...tempRates, service_Smartphone_Delivery: parseFloat(e.target.value) })}
                                    />
                                </div>
                            </div>
                            <div className="form-group">
                                <label className="form-label">Recupero Smartphones</label>
                                <div style={{ position: 'relative' }}>
                                    <span style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }}>USD</span>
                                    <input type="number" className="form-input" style={{ paddingLeft: '45px' }}
                                        value={tempRates.service_Smartphone_Recovery !== undefined ? tempRates.service_Smartphone_Recovery : (tempRates.smartphoneService || 5)}
                                        onChange={e => setTempRates({ ...tempRates, service_Smartphone_Recovery: parseFloat(e.target.value) })}
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
                                        onChange={e => setTempRates({ ...tempRates, service_Key_Delivery: parseFloat(e.target.value) })}
                                    />
                                </div>
                            </div>
                            <div className="form-group">
                                <label className="form-label">Recupero Security Keys</label>
                                <div style={{ position: 'relative' }}>
                                    <span style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }}>USD</span>
                                    <input type="number" className="form-input" style={{ paddingLeft: '45px' }}
                                        value={tempRates.service_Key_Recovery !== undefined ? tempRates.service_Key_Recovery : (tempRates.securityKeyService || 5)}
                                        onChange={e => setTempRates({ ...tempRates, service_Key_Recovery: parseFloat(e.target.value) })}
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
                                        onChange={e => setTempRates({ ...tempRates, service_Warranty: parseFloat(e.target.value) })}
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
                                        value={tempRates.internalDeliveryRevenue || ''}
                                        onChange={e => setTempRates({ ...tempRates, internalDeliveryRevenue: parseFloat(e.target.value) })}
                                    />
                                </div>
                            </div>
                            <div className="form-group">
                                <label className="form-label">Cobro Extra (Correo)</label>
                                <div style={{ position: 'relative' }}>
                                    <span style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }}>USD</span>
                                    <input type="number" className="form-input" style={{ paddingLeft: '45px' }}
                                        value={tempRates.postalServiceMarkup || ''}
                                        onChange={e => setTempRates({ ...tempRates, postalServiceMarkup: parseFloat(e.target.value) })}
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
                                        value={tempRates.driverCommission || ''}
                                        onChange={e => setTempRates({ ...tempRates, driverCommission: parseFloat(e.target.value) })}
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
                                        value={tempRates.postalBaseCost || ''}
                                        onChange={e => setTempRates({ ...tempRates, postalBaseCost: parseFloat(e.target.value) })}
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Driver Specific Bonuses */}
                        <div style={{ marginTop: '1.5rem', paddingTop: '1rem', borderTop: '1px solid rgba(239, 68, 68, 0.1)' }}>
                            <h5 style={{ fontSize: '0.85rem', fontWeight: 700, marginBottom: '0.75rem', color: 'var(--text-secondary)' }}>Incentivos por Conductor</h5>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem' }}>
                                {['Lucas', 'Facundo', 'Guillermo'].map(driver => (
                                    <div key={driver} style={{ background: 'rgba(255,255,255,0.5)', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border)' }}>
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
                                                {['Laptop', 'Smartphone', 'Key'].map(type => {
                                                    const displayType = {
                                                        'Laptop': 'Notebook',
                                                        'Smartphone': 'Celular',
                                                        'Key': 'Llave'
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
                                                                    onChange={e => setTempRates({ ...tempRates, [`driverExtra_${driver}_Delivery_${type}`]: parseFloat(e.target.value) })}
                                                                />
                                                            </td>
                                                            <td style={{ padding: '0.25rem 0 0.25rem 0.25rem' }}>
                                                                <input
                                                                    type="number"
                                                                    placeholder="0"
                                                                    className="form-input"
                                                                    style={{ padding: '0.25rem 0.5rem', height: 'auto', fontSize: '0.8rem' }}
                                                                    value={tempRates[`driverExtra_${driver}_Recovery_${type}`] || ''}
                                                                    onChange={e => setTempRates({ ...tempRates, [`driverExtra_${driver}_Recovery_${type}`]: parseFloat(e.target.value) })}
                                                                />
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '1rem' }}>
                        <Button type="button" variant="secondary" onClick={() => setIsRatesModalOpen(false)}>Cancelar</Button>
                        <Button type="submit">Guardar Tarifas</Button>
                    </div>
                </form>
            </Modal>

            {/* Detail Modal */}
            <Modal isOpen={detailModal.isOpen} onClose={() => setDetailModal({ ...detailModal, isOpen: false })}>
                <div style={{ padding: '1rem' }}>
                    {(() => {
                        const t = detailModal.ticket;
                        const f = detailModal.financials;
                        if (!t || !f) return null;

                        // Extract Metadata from Asset (Source of Truth)
                        const { moveType, assetType, resolvedAsset } = resolveTicketServiceDetails(t, globalAssets);

                        // Currency context re-check
                        const exchangeRate = parseFloat(rates?.exchangeRate) || 0;
                        const useArs = exchangeRate > 0;
                        const currencyLabel = useArs ? 'ARS' : 'USD';

                        return (
                            <>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', borderBottom: '1px solid var(--border)', paddingBottom: '1rem' }}>
                                    <div>
                                        <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-main)' }}>Detalle Financiero del Servicio</h2>
                                        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Ref: {t.id} • {t.requester}</p>
                                    </div>
                                    <div style={{ textAlign: 'right' }}>
                                        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>GANANCIA TOTAL</div>
                                        <div style={{ fontSize: '1.5rem', fontWeight: 800, color: f.profit >= 0 ? '#22c55e' : '#ef4444' }}>
                                            {currencyLabel} {f.profit.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                        </div>
                                    </div>
                                </div>

                                <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', padding: '1.25rem', marginBottom: '1.5rem' }}>
                                    <h3 style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '1rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Resumen del Servicio</h3>

                                    {/* Primary Info */}
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', marginBottom: '1rem', borderBottom: '1px dashed var(--border)', paddingBottom: '1rem' }}>
                                        <div>
                                            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.25rem' }}>Tipo de Movimiento</span>
                                            <span style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-main)' }}>{moveType}</span>
                                        </div>
                                        <div>
                                            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.25rem' }}>Tipo de Dispositivo</span>
                                            <span style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-main)' }}>{assetType}</span>
                                        </div>
                                        <div>
                                            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.25rem' }}>Conductor</span>
                                            <span style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-main)' }}>{t.logistics?.deliveryPerson || t.driver || t.logistics?.coordinatedBy || 'N/A'}</span>
                                        </div>
                                    </div>

                                    {/* Asset & Accessories Detail */}
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                        <div>
                                            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.25rem' }}>Equipamiento</span>
                                            <span style={{ fontSize: '0.85rem', fontWeight: 500, color: 'var(--text-main)' }}>
                                                {resolvedAsset ? (
                                                    <>
                                                        {resolvedAsset.name || 'Sin Nombre'} <span style={{ opacity: 0.6 }}>({resolvedAsset.serial || 'S/N'})</span>
                                                    </>
                                                ) : 'No especificado'}
                                            </span>
                                        </div>
                                        <div>
                                            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.25rem' }}>Accesorios</span>
                                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem' }}>
                                                {(() => {
                                                    const accs = t.accessories || {};
                                                    const activeAccs = Object.entries(accs)
                                                        .filter(([k, v]) => v && k !== 'filterSize') // filterSize is metadata for screenFilter
                                                        .map(([k]) => {
                                                            const map = { mouse: 'Mouse', headset: 'Auricular', charger: 'Cargador', cover: 'Funda', stand: 'Soporte', screenFilter: 'Filtro' };
                                                            return map[k] || k;
                                                        });

                                                    if (activeAccs.length === 0) return <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontStyle: 'italic' }}>Ninguno</span>;

                                                    return activeAccs.map(a => (
                                                        <span key={a} style={{ fontSize: '0.7rem', background: 'var(--background)', border: '1px solid var(--border)', padding: '2px 6px', borderRadius: '4px' }}>{a}</span>
                                                    ));
                                                })()}
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
                                    {/* INGRESOS */}
                                    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', padding: '1.5rem' }}>
                                        <h3 style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '1.25rem', borderBottom: '2px solid #22c55e', paddingBottom: '0.5rem', display: 'inline-block' }}>INGRESOS</h3>

                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', fontSize: '0.9rem' }}>

                                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                                <span>Total Servicio:</span>
                                                <span style={{ fontWeight: 600 }}>{currencyLabel} {f.serviceRevenue.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                                            </div>
                                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                                <span>Servicio de Delivery (Cobro):</span>
                                                <span style={{ fontWeight: 600 }}>{currencyLabel} {f.logisticRevenue.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                                            </div>

                                            <div style={{ marginTop: '1rem', background: 'rgba(34, 197, 94, 0.1)', padding: '0.75rem', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                <span style={{ fontWeight: 700, color: '#166534' }}>Total Ingresos</span>
                                                <span style={{ fontWeight: 800, fontSize: '1.1rem', color: '#166534' }}>{currencyLabel} {f.totalRevenue.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* COSTOS */}
                                    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', padding: '1.5rem' }}>
                                        <h3 style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '1.25rem', borderBottom: '2px solid #ef4444', paddingBottom: '0.5rem', display: 'inline-block' }}>COSTOS</h3>

                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', fontSize: '0.9rem' }}>
                                            {f.method === 'Andreani' || f.method === 'Correo Argentino' ? (
                                                <>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                                        <span style={{ color: 'var(--text-secondary)' }}>Costo de Envío (Correo):</span>
                                                        <span style={{ fontWeight: 600 }}>{currencyLabel} {(f.logisticCost / 1.1).toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                                                    </div>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                                        <span style={{ color: 'var(--text-secondary)' }}>+10% Markup Adm.:</span>
                                                        <span style={{ fontWeight: 600 }}>{currencyLabel} {(f.logisticCost - (f.logisticCost / 1.1)).toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                                                    </div>
                                                </>
                                            ) : (
                                                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                                    <span style={{ color: 'var(--text-secondary)' }}>Paga del Conductor:</span>
                                                    <span style={{ fontWeight: 600 }}>{currencyLabel} {f.logisticCost.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                                                </div>
                                            )}

                                            {f.operationalCost > 0 && (
                                                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                                    <span style={{ color: 'var(--text-secondary)' }}>Insumos / Accesorios:</span>
                                                    <span style={{ fontWeight: 600 }}>{currencyLabel} {f.operationalCost.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                                                </div>
                                            )}

                                            <div style={{ borderTop: '1px dashed var(--border)', margin: '0.5rem 0' }} />

                                            <div style={{ marginTop: 'auto', background: 'rgba(239, 68, 68, 0.1)', padding: '0.75rem', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                <span style={{ fontWeight: 700, color: '#991b1b' }}>Total de Costos</span>
                                                <span style={{ fontWeight: 800, fontSize: '1.1rem', color: '#991b1b' }}>{currencyLabel} {f.totalCost.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </>
                        );
                    })()}

                    <div style={{ marginTop: '2rem', display: 'flex', justifyContent: 'flex-end' }}>
                        <Button onClick={() => setDetailModal({ ...detailModal, isOpen: false })}>Cerrar</Button>
                    </div>
                </div>
            </Modal>
        </div >
    );
}
