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
    Info,
    Search,
    FileText,
    Printer,
    Edit3,
    Check,
    Building,
    Landmark,
    RefreshCw,
    Eye
} from 'lucide-react';


import { calculateTicketFinancials, resolveTicketServiceDetails, calculateTaskFinancials, getExchangeRateForDate } from '@/lib/billing';
import Link from 'next/link';
import * as XLSX from 'xlsx';

export default function BillingPage() {
    const { tickets, assets: globalAssets, users, currentUser, rates, updateRates, deleteTickets, expenses, addExpense, deleteExpense, countryFilter, getClientName, logisticsTasks, updateTicket, entities = [], invoiceProfiles, updateInvoiceProfile } = useStore();
    const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
    const [isRatesModalOpen, setIsRatesModalOpen] = useState(false);
    const [tempRates, setTempRates] = useState({});
    const [selectedTickets, setSelectedTickets] = useState(new Set());
    const [detailModal, setDetailModal] = useState({ isOpen: false, ticket: null, financials: null });
    const [dolarQuotes, setDolarQuotes] = useState({ official: null, blue: null });
    const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
    const [expenseForm, setExpenseForm] = useState({ description: '', amount: '' });
    const [searchQuery, setSearchQuery] = useState('');
    const [isInvoiceModalOpen, setIsInvoiceModalOpen] = useState(false);
    const [isEditingInvoiceConfig, setIsEditingInvoiceConfig] = useState(false);

    const activeClientName = useMemo(() => {
        if (countryFilter && countryFilter !== 'Todos') {
            return (getClientName(countryFilter) || countryFilter).trim();
        }
        if (entities && entities.length > 0) {
            return entities[0].name.trim();
        }
        return 'SFDC-Argentina';
    }, [countryFilter, getClientName, entities]);

    const [selectedClientKey, setSelectedClientKey] = useState(activeClientName);
    const [saveStatus, setSaveStatus] = useState('Guardado'); // 'Guardado' | 'Guardando...'

    // Sincronizar cliente seleccionado cuando cambia el filtro global en la barra lateral
    useEffect(() => {
        if (activeClientName) {
            setSelectedClientKey(activeClientName);
        }
    }, [activeClientName]);

    // Lista consolidada de clientes/entornos disponibles para personalización y emisión
    const availableClients = useMemo(() => {
        const set = new Set();
        if (entities && entities.length > 0) {
            entities.forEach(e => {
                if (e.name) set.add(e.name.trim());
            });
        }
        ['SFDC-Argentina', 'EdPuzzle Inc', 'Sycomp-SRV', 'Commvault', 'SFDC-Chile', 'SFDC-Colombia', 'SFDC-Costa Rica', 'SFDC-Uruguay'].forEach(c => set.add(c));
        if (invoiceProfiles && typeof invoiceProfiles === 'object') {
            Object.keys(invoiceProfiles).forEach(k => {
                if (k && k !== 'Todos') set.add(k.trim());
            });
        }
        if (countryFilter && countryFilter !== 'Todos') {
            set.add(getClientName(countryFilter));
        }
        return Array.from(set);
    }, [entities, invoiceProfiles, countryFilter, getClientName]);

    // Generador de plantilla por defecto adaptada a cada cliente/entorno
    const getDefaultInvoiceConfigForClient = (clientKey = 'SFDC-Argentina') => {
        const key = (clientKey || '').trim();
        const isEdPuzzle = key.toLowerCase().includes('edpuzzle');
        const isSycomp = key.toLowerCase().includes('sycomp');
        const isArgentina = key.toLowerCase().includes('argentina') || key.toLowerCase().includes('sfdc');

        return {
            companyName: 'YAWI INFORMÁTICA',
            companyTagline: 'Servicios Integrales de IT y Logística Informática',
            companyCuit: '',
            companyIva: 'Consumidor Final',
            companyAddress: '',
            companyEmail: 'info@yawi.ar',
            docNumber: '0001 - 00000001',
            emissionDate: new Date().toLocaleDateString('es-AR'),
            paymentCondition: 'Transferencia',
            currency: 'USD',
            clientName: key,
            clientTaxId: isEdPuzzle ? 'US-94-3829102' : (isSycomp ? 'US-83-1122334' : ''),
            clientEmail: isEdPuzzle ? 'billing@edpuzzle.com' : (isSycomp ? 'ap@sycomp.com' : (isArgentina ? 'beltran.pablo@thelabit.com' : '')),
            clientAddress: isEdPuzzle ? 'San Francisco, CA - Estados Unidos' : (isSycomp ? 'Miami, FL - Estados Unidos' : (isArgentina ? 'San Francisco, CA - Estados Unidos' : '')),
            extraConceptDesc: 'Otros Conceptos / Gastos',
            extraConceptAmount: 0,
            bankHolder: 'Guillermo Abregu',
            bankName: 'BNA',
            bankAccountType: 'Cuenta Corriente Especial',
            bankCbu: 'abreguceser.bna',
            bankAlias: '',
            bankSwift: '',
            bankAccountNumber: ''
        };
    };

    const [invoiceConfig, setInvoiceConfig] = useState(() => getDefaultInvoiceConfigForClient(activeClientName));

    // Cargar perfil específico para el cliente seleccionado (Nube -> Local -> Default)
    useEffect(() => {
        if (!selectedClientKey) return;

        // 1. Perfil sincronizado en la nube (app_config)
        const cloudProfile = invoiceProfiles?.[selectedClientKey];

        // 2. Perfil guardado localmente en este navegador
        let localClientProfile = null;
        try {
            const savedLocal = localStorage.getItem(`yawi_invoice_config_${selectedClientKey}`);
            if (savedLocal) localClientProfile = JSON.parse(savedLocal);
        } catch (e) {
            console.error('Error leyendo config local:', e);
        }

        // 3. Fallback: Configuración heredada antigua para migración sin pérdida de datos
        let legacyProfile = null;
        try {
            const savedLegacy = localStorage.getItem('yawi_invoice_template_config');
            if (savedLegacy) {
                const parsed = JSON.parse(savedLegacy);
                if (!cloudProfile && !localClientProfile) {
                    legacyProfile = parsed;
                }
            }
        } catch (e) {}

        const defaults = getDefaultInvoiceConfigForClient(selectedClientKey);

        const merged = {
            ...defaults,
            ...(legacyProfile || {}),
            ...(localClientProfile || {}),
            ...(cloudProfile || {}),
            clientName: (cloudProfile?.clientName || localClientProfile?.clientName || legacyProfile?.clientName || selectedClientKey),
            emissionDate: cloudProfile?.emissionDate || localClientProfile?.emissionDate || legacyProfile?.emissionDate || new Date().toLocaleDateString('es-AR')
        };

        setInvoiceConfig(merged);
    }, [selectedClientKey, invoiceProfiles]);

    const updateInvoiceConfigField = (field, value) => {
        setInvoiceConfig(prev => {
            const next = { ...prev, [field]: value };
            setSaveStatus('Guardando...');

            // 1. Guardar en almacenamiento local para este cliente específico
            try {
                localStorage.setItem(`yawi_invoice_config_${selectedClientKey}`, JSON.stringify(next));
                localStorage.setItem('yawi_invoice_template_config', JSON.stringify(next));
            } catch (e) {
                console.error('Error guardando en localStorage:', e);
            }

            // 2. Sincronizar en la nube en Supabase (app_config)
            if (updateInvoiceProfile) {
                updateInvoiceProfile(selectedClientKey, next);
            }

            setTimeout(() => setSaveStatus('Guardado'), 600);
            return next;
        });
    };

    // Estado para edición de cotización histórica
    const currentDate = new Date();
    const [historyEditMonth, setHistoryEditMonth] = useState(String(currentDate.getMonth() + 1).padStart(2, '0'));
    const [historyEditYear, setHistoryEditYear] = useState(String(currentDate.getFullYear()));
    const [historyEditValue, setHistoryEditValue] = useState('');

    // Estado para campos de pago real a repartidores (edición local antes de guardar)
    const [driverPaymentInputs, setDriverPaymentInputs] = useState({});

    // Clave del mes seleccionado (ej: "2026-04")
    const selectedMonthKey = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}`;

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

    const period = useMemo(() => {
        const monthNames = [
            "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
            "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
        ];
        return `${monthNames[selectedMonth]} ${selectedYear}`;
    }, [selectedMonth, selectedYear]);

    // Advanced analysis
    const { metrics, filteredTickets, currency, filteredExpenses, selectedExchangeRate } = useMemo(() => {
        let totalRevenue = 0;
        let totalLogisticsCost = 0;
        let totalOperationalCost = 0;
        let totalServiceRevenue = 0;
        let totalLogisticRevenue = 0;
        let totalPostalCost = 0;
        let totalDriverCost = 0; // Explicit tracker for driver payments sum
        let pendingDeliveriesCount = 0;

        const driverPayments = {};
        const processedTaskIds = new Set();

        // Currency Conversion Logic
        // Usar la cotización del MES SELECCIONADO, no la actual
        // Esto garantiza que meses anteriores usen su cotización histórica correcta
        const historicalDate = new Date(selectedYear, selectedMonth, 1);
        const exchangeRate = getExchangeRateForDate(rates, historicalDate);
        const useArs = false;
        const multiplier = 1;
        const currencyKey = 'USD';

        const allPeriodTickets = tickets.filter(ticket => {
            let ticketDate;
            if (ticket.deliveryDetails?.customBillingDate) {
                const [yyyy, mm, dd] = ticket.deliveryDetails.customBillingDate.split('-');
                ticketDate = new Date(parseInt(yyyy), parseInt(mm) - 1, parseInt(dd));
            } else if (ticket.deliveryCompletedDate) {
                const dateStr = typeof ticket.deliveryCompletedDate === 'string' ? ticket.deliveryCompletedDate.substring(0, 10) : '';
                if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
                    const [yyyy, mm, dd] = dateStr.split('-');
                    ticketDate = new Date(parseInt(yyyy), parseInt(mm) - 1, parseInt(dd));
                } else {
                    ticketDate = new Date(ticket.deliveryCompletedDate);
                }
            } else {
                return false;
            }
            const isDateMatch = ticketDate.getMonth() === selectedMonth && ticketDate.getFullYear() === selectedYear;
            const isStatusMatch = ['Resuelto', 'Caso SFDC Cerrado', 'Servicio Facturado'].includes(ticket.status);
            return isDateMatch && isStatusMatch;
        });

        const filtered = tickets.filter(ticket => {
            let ticketDate;
            if (ticket.deliveryDetails?.customBillingDate) {
                const [yyyy, mm, dd] = ticket.deliveryDetails.customBillingDate.split('-');
                ticketDate = new Date(parseInt(yyyy), parseInt(mm) - 1, parseInt(dd));
            } else if (ticket.deliveryCompletedDate) {
                const dateStr = typeof ticket.deliveryCompletedDate === 'string' ? ticket.deliveryCompletedDate.substring(0, 10) : '';
                if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
                    const [yyyy, mm, dd] = dateStr.split('-');
                    ticketDate = new Date(parseInt(yyyy), parseInt(mm) - 1, parseInt(dd));
                } else {
                    ticketDate = new Date(ticket.deliveryCompletedDate);
                }
            } else {
                return false; // Exclude completely if no delivery completed date or billing date
            }
            const isDateMatch = ticketDate.getMonth() === selectedMonth && ticketDate.getFullYear() === selectedYear;
            const isStatusMatch = ['Resuelto', 'Caso SFDC Cerrado', 'Servicio Facturado'].includes(ticket.status);

            // Filtrado por Cliente (campo explícito)
            const expectedClient = getClientName(countryFilter);
            const isCountryMatch = ticket.client === expectedClient;

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

            // Driver Payment Tracking for active client metrics (legacy model)
            const hasRelatedTasks = (logisticsTasks || []).some(tk =>
                String(tk.ticket_id || tk.ticketId) === String(ticket.id)
            );

            if (!hasRelatedTasks) {
                if (String(method || '').includes('Repartidor Propio') || String(method || '').includes('Envío Interno') || String(method || '').includes('Propio')) {
                    totalDriverCost += logisticCost;
                } else if (String(method || '').includes('Andreani') || String(method || '').includes('Correo Argentino') || String(method || '').includes('Correo')) {
                    totalPostalCost += logisticCost;
                }
            }

            // Pending deliveries count
            if (ticket.status === 'Pendiente' || ticket.status === 'En Progreso') {
                pendingDeliveriesCount += 1;
            }
        });

        // Driver cost tracking via logisticsTasks for active client metrics (new model)
        const filteredTasksForMetrics = (logisticsTasks || []).filter(task => {
            const parentTicket = filtered.find(t => String(t.id) === String(task.ticket_id || task.ticketId));
            return !!parentTicket;
        });

        filteredTasksForMetrics.forEach(task => {
            const taskF = calculateTaskFinancials(task, rates, globalAssets, users);
            if (!taskF) return;

            const taskMethod = taskF.method || task.method || '';
            const isPropio = taskMethod === 'Repartidor Propio' || taskMethod === 'Envío Interno' || taskMethod.includes('Propio');
            const isPostal = taskMethod === 'Andreani' || taskMethod === 'Correo Argentino' || taskMethod.includes('Correo');

            if (isPropio) {
                totalDriverCost += taskF.logisticCost || 0;
            } else if (isPostal) {
                totalPostalCost += taskF.logisticCost || 0;
            }
        });

        // ── DRIVER TRACKING FOR DRIVER PAYMENTS (cross-client visibility) ──
        // Calculate driver payments using all tickets of the selected period across all clients
        tickets.forEach(ticket => {
            const financials = calculateTicketFinancials(ticket, rates, globalAssets, users, logisticsTasks);
            if (!financials) return;

            const ticketDateStr = ticket.deliveryCompletedDate || ticket.createdAt;

            if (financials.taskFinancials && financials.taskFinancials.length > 0) {
                // Process sub-tasks based on sub-task date
                financials.taskFinancials.forEach(tFin => {
                    const taskObj = logisticsTasks.find(lt => String(lt.id) === String(tFin.taskId));
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
                    if (method.includes('Repartidor Propio') || method === 'Envío Interno' || method.includes('Propio')) {
                        const driver = (tFin.deliveryPerson || '').trim();
                        if (driver) {
                            const isDelivery = (tFin.moveType || '').toLowerCase().includes('entrega') || (tFin.moveType || '').toLowerCase().includes('alta');
                            const isRecovery = (tFin.moveType || '').toLowerCase().includes('recupero') || (tFin.moveType || '').toLowerCase().includes('retiro') || (tFin.moveType || '').toLowerCase().includes('baja');
                            if (!driverPayments[driver]) driverPayments[driver] = { count: 0, total: 0, deliveries: 0, recoveries: 0 };
                            driverPayments[driver].count += 1;
                            driverPayments[driver].total += tFin.logisticCost || 0;
                            if (isDelivery) driverPayments[driver].deliveries += 1;
                            if (isRecovery) driverPayments[driver].recoveries += 1;
                        }
                    }
                });
            } else {
                // Normal single ticket based on ticket date
                if (!ticketDateStr) return;
                const date = new Date(ticketDateStr);
                if (date.getMonth() !== selectedMonth || date.getFullYear() !== selectedYear) return;

                const { logisticCost, moveType, method } = financials;
                if (String(method || '').includes('Repartidor Propio') || String(method || '').includes('Envío Interno') || String(method || '').includes('Propio')) {
                    const driver = (ticket.logistics?.deliveryPerson || '').trim();
                    if (driver) {
                        const isDelivery = String(moveType || '').toLowerCase().includes('entrega') || String(moveType || '').toLowerCase().includes('alta');
                        const isRecovery = String(moveType || '').toLowerCase().includes('recupero') || String(moveType || '').toLowerCase().includes('retiro') || String(moveType || '').toLowerCase().includes('baja');
                        if (!driverPayments[driver]) driverPayments[driver] = { count: 0, total: 0, deliveries: 0, recoveries: 0 };
                        driverPayments[driver].count += 1;
                        driverPayments[driver].total += logisticCost;
                        if (isDelivery) driverPayments[driver].deliveries += 1;
                        if (isRecovery) driverPayments[driver].recoveries += 1;
                    }
                }
            }
        });

        // Track driver payments via logisticsTasks for all period tickets (cross-client)
        logisticsTasks.forEach(task => {
            if (task.id && processedTaskIds.has(String(task.id))) return;
            
            let taskDateStr = null;
            if (task.date && task.date !== 'Pendiente' && task.date !== 'Sin fecha') {
                taskDateStr = task.date;
            } else if (task.delivery_info?.deliveredAt) {
                taskDateStr = task.delivery_info.deliveredAt.substring(0, 10);
            } else {
                taskDateStr = task.created_at ? task.created_at.substring(0, 10) : null;
            }
            if (!taskDateStr || task.status !== 'Completada') return;

            const date = new Date(taskDateStr.toString().includes('T') ? taskDateStr : taskDateStr + 'T00:00:00');
            if (date.getMonth() !== selectedMonth || date.getFullYear() !== selectedYear) return;

            const taskF = calculateTaskFinancials(task, rates, globalAssets, users);
            if (!taskF) return;

            const taskMethod = taskF.method || task.method || '';
            const isPropio = taskMethod === 'Repartidor Propio' || taskMethod === 'Envío Interno' || taskMethod.includes('Propio');

            if (isPropio) {
                const driver = (task.delivery_person || task.deliveryPerson || taskF.deliveryPerson || '').trim();
                if (driver) {
                    const isDelivery = (taskF.moveType || '').toLowerCase().includes('entrega') || (taskF.moveType || '').toLowerCase().includes('alta');
                    const isRecovery = (taskF.moveType || '').toLowerCase().includes('recupero') || (taskF.moveType || '').toLowerCase().includes('retiro') || (taskF.moveType || '').toLowerCase().includes('baja');
                    if (!driverPayments[driver]) driverPayments[driver] = { count: 0, total: 0, deliveries: 0, recoveries: 0 };
                    driverPayments[driver].count += 1;
                    driverPayments[driver].total += taskF.logisticCost || 0;
                    if (isDelivery) driverPayments[driver].deliveries += 1;
                    if (isRecovery) driverPayments[driver].recoveries += 1;
                }
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
            currency: currencyKey,
            selectedExchangeRate: exchangeRate  // Cotización histórica del mes seleccionado
        };
    }, [tickets, selectedMonth, selectedYear, rates, globalAssets, expenses, countryFilter]);

    // Tickets seleccionados o todos los del cliente filtrado para el período
    const invoiceTickets = useMemo(() => {
        if (selectedTickets.size > 0) {
            return (filteredTickets || []).filter(t => selectedTickets.has(t.id));
        }
        if (selectedClientKey === activeClientName && filteredTickets) {
            return filteredTickets;
        }
        return (tickets || []).filter(ticket => {
            let ticketDate;
            if (ticket.deliveryDetails?.customBillingDate) {
                const [yyyy, mm, dd] = ticket.deliveryDetails.customBillingDate.split('-');
                ticketDate = new Date(parseInt(yyyy), parseInt(mm) - 1, parseInt(dd));
            } else if (ticket.deliveryCompletedDate) {
                const dateStr = typeof ticket.deliveryCompletedDate === 'string' ? ticket.deliveryCompletedDate.substring(0, 10) : '';
                if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
                    const [yyyy, mm, dd] = dateStr.split('-');
                    ticketDate = new Date(parseInt(yyyy), parseInt(mm) - 1, parseInt(dd));
                } else {
                    ticketDate = new Date(ticket.deliveryCompletedDate);
                }
            } else {
                return false;
            }
            const isDateMatch = ticketDate.getMonth() === selectedMonth && ticketDate.getFullYear() === selectedYear;
            const isStatusMatch = ['Resuelto', 'Caso SFDC Cerrado', 'Servicio Facturado'].includes(ticket.status);
            const isClientMatch = ticket.client === selectedClientKey;
            return isDateMatch && isStatusMatch && isClientMatch;
        });
    }, [selectedTickets, filteredTickets, tickets, selectedClientKey, activeClientName, selectedMonth, selectedYear]);

    // Items limpios para el Resumen del Cliente (sin costos internos ni pagos a choferes)
    const invoiceItems = useMemo(() => {
        return invoiceTickets.map(ticket => {
            const financials = calculateTicketFinancials(ticket, rates, globalAssets, users, logisticsTasks);
            if (!financials) return null;

            const isArs = invoiceConfig.currency === 'ARS';
            const rate = selectedExchangeRate || 1;

            const unitPriceUSD = financials.totalRevenue || 0;
            const unitPrice = isArs ? (unitPriceUSD * rate) : unitPriceUSD;
            const subtotal = unitPrice * 1;

            const { moveType, assetType } = financials;
            const details = [];
            if (moveType && moveType !== 'Servicio Técnico') details.push(moveType);
            if (assetType && assetType !== 'Dispositivo') details.push(assetType);
            if (ticket.requester) details.push(ticket.requester);

            let desc = ticket.subject || 'Servicio Logístico e IT';
            if (details.length > 0) {
                desc = `${desc} (${details.join(' • ')})`;
            }

            return {
                id: ticket.id,
                caseNumber: ticket.caseNumber || ticket.id,
                description: desc,
                quantity: 1,
                unitPriceUSD,
                unitPrice,
                subtotal
            };
        }).filter(Boolean);
    }, [invoiceTickets, rates, globalAssets, users, logisticsTasks, invoiceConfig.currency, selectedExchangeRate]);

    // Totales calculados para el Resumen
    const invoiceTotals = useMemo(() => {
        let subtotal = 0;
        let serviceRevenueUSD = 0;
        let logisticRevenueUSD = 0;
        let totalRevenueUSD = 0;

        invoiceTickets.forEach(ticket => {
            const f = calculateTicketFinancials(ticket, rates, globalAssets, users, logisticsTasks);
            if (!f) return;
            serviceRevenueUSD += f.serviceRevenue || 0;
            logisticRevenueUSD += f.logisticRevenue || 0;
            totalRevenueUSD += f.totalRevenue || 0;
        });

        invoiceItems.forEach(item => {
            subtotal += item.subtotal;
        });

        const isArs = invoiceConfig.currency === 'ARS';
        const rate = selectedExchangeRate || 1;
        const extraRaw = parseFloat(invoiceConfig.extraConceptAmount) || 0;
        const extra = isArs ? (extraRaw * rate) : extraRaw;
        const totalLiquidar = subtotal + extra;

        return {
            subtotal,
            extra,
            totalLiquidar,
            serviceRevenue: serviceRevenueUSD,
            logisticRevenue: logisticRevenueUSD,
            totalRevenue: totalRevenueUSD,
            currencySymbol: isArs ? 'ARS' : 'USD'
        };
    }, [invoiceTickets, invoiceItems, rates, globalAssets, users, logisticsTasks, invoiceConfig.currency, invoiceConfig.extraConceptAmount, selectedExchangeRate]);

    const formatInvoiceMoney = (amount, cur = invoiceConfig.currency) => {
        if (cur === 'ARS') {
            return `ARS ${Number(amount || 0).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
        }
        return `USD ${Number(amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    };



    const handleSaveRates = (e) => {
        e.preventDefault();
        // Guardar todo el objeto tempRates (que ya incluye el exchangeRateHistory actualizado)
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

    const handleDownloadExcel = () => {
        const isArs = invoiceConfig.currency === 'ARS';
        const curSymbol = isArs ? 'ARS' : 'USD';
        const formattedDate = (invoiceConfig.emissionDate || new Date().toLocaleDateString('es-AR')).replace(/\//g, '-');
        const clientName = invoiceConfig.clientName || selectedClientKey || activeClientName || 'Cliente';

        const rows = [
            { 'TICKET / CASO': 'RESUMEN DE SERVICIO', 'DESCRIPCIÓN DEL SERVICIO LOGÍSTICO / IT': `Nº ${invoiceConfig.docNumber}`, 'CANT.': '', 'PRECIO UNIT.': '', 'SUBTOTAL': '' },
            { 'TICKET / CASO': 'Emisor:', 'DESCRIPCIÓN DEL SERVICIO LOGÍSTICO / IT': `${invoiceConfig.companyName} - CUIT: ${invoiceConfig.companyCuit}`, 'CANT.': '', 'PRECIO UNIT.': '', 'SUBTOTAL': '' },
            { 'TICKET / CASO': 'Cliente:', 'DESCRIPCIÓN DEL SERVICIO LOGÍSTICO / IT': `${clientName} - ID/CUIT: ${invoiceConfig.clientTaxId || '-'}`, 'CANT.': '', 'PRECIO UNIT.': '', 'SUBTOTAL': '' },
            { 'TICKET / CASO': 'Fecha Emisión:', 'DESCRIPCIÓN DEL SERVICIO LOGÍSTICO / IT': invoiceConfig.emissionDate, 'CANT.': '', 'PRECIO UNIT.': '', 'SUBTOTAL': '' },
            { 'TICKET / CASO': 'Período:', 'DESCRIPCIÓN DEL SERVICIO LOGÍSTICO / IT': period, 'CANT.': '', 'PRECIO UNIT.': '', 'SUBTOTAL': '' },
            { 'TICKET / CASO': 'Moneda:', 'DESCRIPCIÓN DEL SERVICIO LOGÍSTICO / IT': curSymbol, 'CANT.': '', 'PRECIO UNIT.': '', 'SUBTOTAL': '' },
            { 'TICKET / CASO': 'Condición de Pago:', 'DESCRIPCIÓN DEL SERVICIO LOGÍSTICO / IT': invoiceConfig.paymentCondition, 'CANT.': '', 'PRECIO UNIT.': '', 'SUBTOTAL': '' },
            {},
        ];

        invoiceItems.forEach(item => {
            rows.push({
                'TICKET / CASO': item.caseNumber,
                'DESCRIPCIÓN DEL SERVICIO LOGÍSTICO / IT': item.description,
                'CANT.': item.quantity,
                'PRECIO UNIT.': Number(item.unitPrice.toFixed(2)),
                'SUBTOTAL': Number(item.subtotal.toFixed(2))
            });
        });

        rows.push({});
        rows.push({
            'TICKET / CASO': '',
            'DESCRIPCIÓN DEL SERVICIO LOGÍSTICO / IT': 'Subtotal Servicios:',
            'CANT.': '',
            'PRECIO UNIT.': '',
            'SUBTOTAL': Number(invoiceTotals.subtotal.toFixed(2))
        });

        if (invoiceTotals.extra !== 0) {
            rows.push({
                'TICKET / CASO': '',
                'DESCRIPCIÓN DEL SERVICIO LOGÍSTICO / IT': invoiceConfig.extraConceptDesc || 'Otros Conceptos / Gastos:',
                'CANT.': '',
                'PRECIO UNIT.': '',
                'SUBTOTAL': Number(invoiceTotals.extra.toFixed(2))
            });
        }

        rows.push({
            'TICKET / CASO': '',
            'DESCRIPCIÓN DEL SERVICIO LOGÍSTICO / IT': 'TOTAL A LIQUIDAR:',
            'CANT.': '',
            'PRECIO UNIT.': curSymbol,
            'SUBTOTAL': Number(invoiceTotals.totalLiquidar.toFixed(2))
        });

        rows.push({});
        rows.push({ 'TICKET / CASO': 'DATOS BANCARIOS:', 'DESCRIPCIÓN DEL SERVICIO LOGÍSTICO / IT': `${invoiceConfig.bankName} (${invoiceConfig.bankHolder})`, 'CANT.': '', 'PRECIO UNIT.': '', 'SUBTOTAL': '' });
        rows.push({ 'TICKET / CASO': 'CBU / Routing:', 'DESCRIPCIÓN DEL SERVICIO LOGÍSTICO / IT': invoiceConfig.bankCbu, 'CANT.': '', 'PRECIO UNIT.': '', 'SUBTOTAL': '' });
        rows.push({ 'TICKET / CASO': 'Alias / SWIFT:', 'DESCRIPCIÓN DEL SERVICIO LOGÍSTICO / IT': invoiceConfig.bankAlias, 'CANT.': '', 'PRECIO UNIT.': '', 'SUBTOTAL': '' });
        rows.push({ 'TICKET / CASO': 'Nº Cuenta / IBAN:', 'DESCRIPCIÓN DEL SERVICIO LOGÍSTICO / IT': invoiceConfig.bankAccountNumber, 'CANT.': '', 'PRECIO UNIT.': '', 'SUBTOTAL': '' });

        const worksheet = XLSX.utils.json_to_sheet(rows);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Resumen");
        XLSX.writeFile(workbook, `Resumen_Servicio_${clientName.replace(/\s+/g, '_')}_${formattedDate}.xlsx`);
    };

    const handlePrintInvoice = () => {
        const isArs = invoiceConfig.currency === 'ARS';
        const curSymbol = isArs ? 'ARS' : 'USD';
        const emissionDate = invoiceConfig.emissionDate || new Date().toLocaleDateString('es-AR');
        const clientName = invoiceConfig.clientName || selectedClientKey || activeClientName || 'Cliente';
        const origin = typeof window !== 'undefined' ? window.location.origin : '';

        const printWindow = window.open('', '_blank');
        if (!printWindow) return alert('Por favor, permite las ventanas emergentes (pop-ups) en tu navegador para imprimir.');

        const rowsHtml = invoiceItems.map(item => `
            <tr>
                <td style="padding: 7px 10px; border-bottom: 1px solid #cbd5e1; border-right: 1px solid #cbd5e1; font-weight: 700; color: #1e3a8a;">${item.caseNumber}</td>
                <td style="padding: 7px 10px; border-bottom: 1px solid #cbd5e1; border-right: 1px solid #cbd5e1; color: #1e293b;">${item.description}</td>
                <td style="padding: 7px 10px; border-bottom: 1px solid #cbd5e1; border-right: 1px solid #cbd5e1; text-align: center; color: #1e293b;">${item.quantity}</td>
                <td style="padding: 7px 10px; border-bottom: 1px solid #cbd5e1; border-right: 1px solid #cbd5e1; text-align: right; color: #1e293b;">${formatInvoiceMoney(item.unitPrice)}</td>
                <td style="padding: 7px 10px; border-bottom: 1px solid #cbd5e1; text-align: right; font-weight: 700; color: #0f172a;">${formatInvoiceMoney(item.subtotal)}</td>
            </tr>
        `).join('');

        const emptyRowsCount = Math.max(0, 6 - invoiceItems.length);
        let emptyRowsHtml = '';
        for (let i = 0; i < emptyRowsCount; i++) {
            emptyRowsHtml += `
                <tr>
                    <td style="padding: 10px; border-bottom: 1px solid #f1f5f9; border-right: 1px solid #cbd5e1;">&nbsp;</td>
                    <td style="padding: 10px; border-bottom: 1px solid #f1f5f9; border-right: 1px solid #cbd5e1;">&nbsp;</td>
                    <td style="padding: 10px; border-bottom: 1px solid #f1f5f9; border-right: 1px solid #cbd5e1;">&nbsp;</td>
                    <td style="padding: 10px; border-bottom: 1px solid #f1f5f9; border-right: 1px solid #cbd5e1;">&nbsp;</td>
                    <td style="padding: 10px; border-bottom: 1px solid #f1f5f9;">&nbsp;</td>
                </tr>
            `;
        }

        printWindow.document.write(`
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="utf-8" />
                <title>Resumen de Servicio - ${clientName} - ${invoiceConfig.docNumber}</title>
                <style>
                    @page {
                        size: A4 portrait;
                        margin: 12mm 15mm 12mm 15mm;
                    }
                    * {
                        box-sizing: border-box;
                        -webkit-print-color-adjust: exact !important;
                        print-color-adjust: exact !important;
                    }
                    body {
                        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
                        color: #0f172a;
                        margin: 0;
                        padding: 0;
                        background: #ffffff;
                        font-size: 11px;
                        line-height: 1.35;
                    }
                    .doc-container {
                        width: 100%;
                        display: flex;
                        flex-direction: column;
                        min-height: 265mm;
                        justify-content: space-between;
                    }
                    .top-header {
                        display: flex;
                        justify-content: space-between;
                        align-items: flex-start;
                        margin-bottom: 16px;
                    }
                    .company-block {
                        width: 44%;
                    }
                    .logo-row {
                        display: flex;
                        align-items: center;
                        gap: 8px;
                        margin-bottom: 5px;
                    }
                    .logo-img {
                        height: 42px;
                        width: auto;
                        object-fit: contain;
                    }
                    .yawi-badge {
                        background: #1e3a8a;
                        color: #ffffff;
                        padding: 3px 8px;
                        border-radius: 5px;
                        font-weight: 800;
                        font-size: 14px;
                        letter-spacing: 0.5px;
                    }
                    .yawi-title {
                        font-size: 15px;
                        font-weight: 800;
                        color: #1e3a8a;
                        letter-spacing: 0.5px;
                    }
                    .company-tagline {
                        font-size: 9.5px;
                        font-weight: 600;
                        color: #475569;
                        margin-bottom: 6px;
                    }
                    .company-fields {
                        font-size: 9.5px;
                        color: #334155;
                        line-height: 1.45;
                    }
                    .company-fields strong {
                        color: #0f172a;
                    }
                    .center-box {
                        width: 20%;
                        display: flex;
                        flex-direction: column;
                        align-items: center;
                        text-align: center;
                    }
                    .x-square {
                        width: 42px;
                        height: 42px;
                        border: 2px solid #0f172a;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        font-size: 24px;
                        font-weight: 900;
                        margin-bottom: 4px;
                        background: #ffffff;
                    }
                    .center-title {
                        font-size: 10.5px;
                        font-weight: 800;
                        color: #0f172a;
                        letter-spacing: 0.5px;
                    }
                    .center-subtitle {
                        font-size: 8px;
                        color: #64748b;
                        font-style: italic;
                    }
                    .meta-block {
                        width: 33%;
                        border: 1px solid #94a3b8;
                        border-radius: 2px;
                    }
                    .meta-row {
                        display: flex;
                        justify-content: space-between;
                        padding: 4px 6px;
                        border-bottom: 1px solid #cbd5e1;
                        font-size: 9.5px;
                    }
                    .meta-row:last-child {
                        border-bottom: none;
                    }
                    .meta-lbl {
                        font-weight: 700;
                        color: #334155;
                    }
                    .meta-val {
                        color: #0f172a;
                        font-weight: 600;
                        text-align: right;
                    }
                    .meta-val.blue {
                        color: #1e3a8a;
                        font-weight: 800;
                    }
                    .client-card {
                        border: 1px solid #94a3b8;
                        border-radius: 2px;
                        margin-bottom: 16px;
                        overflow: hidden;
                    }
                    .client-header {
                        background: #1e3a8a;
                        color: #ffffff;
                        font-weight: 800;
                        font-size: 11px;
                        padding: 4px 8px;
                        letter-spacing: 0.5px;
                    }
                    .client-grid {
                        display: grid;
                        grid-template-columns: 1fr 1fr;
                        background: #ffffff;
                    }
                    .client-cell {
                        padding: 5px 8px;
                        border-bottom: 1px solid #e2e8f0;
                        font-size: 9.5px;
                    }
                    .client-cell:nth-child(odd) {
                        border-right: 1px solid #e2e8f0;
                    }
                    .client-cell:nth-last-child(-n+2) {
                        border-bottom: none;
                    }
                    .client-cell strong {
                        color: #334155;
                    }
                    .items-table {
                        width: 100%;
                        border-collapse: collapse;
                        margin-bottom: 12px;
                        border: 1px solid #94a3b8;
                    }
                    .items-table th {
                        background: #0f172a;
                        color: #ffffff;
                        font-weight: 800;
                        font-size: 9.5px;
                        padding: 6px 8px;
                        text-transform: uppercase;
                        border-right: 1px solid #334155;
                    }
                    .items-table th:last-child {
                        border-right: none;
                    }
                    .items-table td {
                        font-size: 9.5px;
                    }
                    .totals-wrapper {
                        display: flex;
                        justify-content: flex-end;
                        margin-bottom: 18px;
                    }
                    .totals-card {
                        width: 48%;
                        border: 1px solid #94a3b8;
                        border-collapse: collapse;
                    }
                    .totals-card td {
                        padding: 5px 10px;
                        font-size: 10px;
                    }
                    .totals-lbl {
                        font-weight: 700;
                        color: #334155;
                        border-bottom: 1px solid #cbd5e1;
                    }
                    .totals-val {
                        text-align: right;
                        font-weight: 700;
                        color: #0f172a;
                        border-bottom: 1px solid #cbd5e1;
                    }
                    .totals-grand {
                        background: #eff6ff;
                    }
                    .totals-grand .totals-lbl {
                        color: #1e3a8a;
                        font-weight: 800;
                        font-size: 11.5px;
                        border-bottom: none;
                    }
                    .totals-grand .totals-val {
                        color: #1e3a8a;
                        font-weight: 800;
                        font-size: 12.5px;
                        border-bottom: none;
                    }
                    .bank-card {
                        border: 1px solid #94a3b8;
                        border-radius: 4px;
                        padding: 10px 12px;
                        margin-bottom: 12px;
                        background: #f8fafc;
                    }
                    .bank-title {
                        font-size: 10.5px;
                        font-weight: 800;
                        color: #1e3a8a;
                        margin-bottom: 6px;
                        text-transform: uppercase;
                    }
                    .bank-lines {
                        font-size: 9.5px;
                        color: #1e293b;
                        line-height: 1.5;
                    }
                    .bank-lines strong {
                        color: #334155;
                    }
                    .doc-footer {
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                        border-top: 1px solid #e2e8f0;
                        padding-top: 6px;
                        font-size: 8.5px;
                        color: #94a3b8;
                    }
                </style>
            </head>
            <body>
                <div class="doc-container">
                    <div>
                        <!-- Header -->
                        <div class="top-header">
                            <div class="company-block">
                                <div class="logo-row">
                                    <img src="${origin}/assetflow-yaw-logo.png" alt="YAWI" class="logo-img" />
                                    <div style="display: flex; align-items: center; gap: 6px;">
                                        <span class="yawi-badge">YAWI</span>
                                        <span class="yawi-title">INFORMÁTICA</span>
                                    </div>
                                </div>
                                <div class="company-tagline">${invoiceConfig.companyTagline}</div>
                                <div class="company-fields">
                                    <div><strong>C.U.I.T.:</strong> ${invoiceConfig.companyCuit}</div>
                                    <div><strong>Condición IVA:</strong> ${invoiceConfig.companyIva}</div>
                                    <div><strong>Domicilio Comercial:</strong> ${invoiceConfig.companyAddress}</div>
                                    <div><strong>Contacto / Email:</strong> ${invoiceConfig.companyEmail}</div>
                                </div>
                            </div>

                            <div class="center-box">
                                <div class="x-square">X</div>
                                <div class="center-title">RESUMEN DE SERVICIO</div>
                                <div class="center-subtitle">Doc. no válido como factura</div>
                            </div>

                            <div class="meta-block">
                                <div class="meta-row">
                                    <span class="meta-lbl">Nº Resumen:</span>
                                    <span class="meta-val blue">${invoiceConfig.docNumber}</span>
                                </div>
                                <div class="meta-row">
                                    <span class="meta-lbl">Fecha de Emisión:</span>
                                    <span class="meta-val">${emissionDate}</span>
                                </div>
                                <div class="meta-row">
                                    <span class="meta-lbl">Periodo:</span>
                                    <span class="meta-val">${period}</span>
                                </div>
                                <div class="meta-row">
                                    <span class="meta-lbl">Moneda:</span>
                                    <span class="meta-val">[ ${!isArs ? 'X' : '&nbsp;'} ] USD &nbsp;&nbsp; [ ${isArs ? 'X' : '&nbsp;'} ] ARS</span>
                                </div>
                                <div class="meta-row">
                                    <span class="meta-lbl">Condición Pago:</span>
                                    <span class="meta-val">${invoiceConfig.paymentCondition}</span>
                                </div>
                            </div>
                        </div>

                        <!-- Datos del Cliente -->
                        <div class="client-card">
                            <div class="client-header">DATOS DEL CLIENTE</div>
                            <div class="client-grid">
                                <div class="client-cell">
                                    <strong>Razón Social:</strong> ${invoiceConfig.clientName || clientName}
                                </div>
                                <div class="client-cell">
                                    <strong>ID / CUIT / Tax ID:</strong> ${invoiceConfig.clientTaxId || '—'}
                                </div>
                                <div class="client-cell">
                                    <strong>Contacto / Mail:</strong> ${invoiceConfig.clientEmail || '—'}
                                </div>
                                <div class="client-cell">
                                    <strong>Dirección / País:</strong> ${invoiceConfig.clientAddress || '—'}
                                </div>
                            </div>
                        </div>

                        <!-- Items Table -->
                        <table class="items-table">
                            <thead>
                                <tr>
                                    <th style="width: 14%; text-align: left;">TICKET / CASO</th>
                                    <th style="width: 50%; text-align: left;">DESCRIPCIÓN DEL SERVICIO LOGÍSTICO / IT</th>
                                    <th style="width: 8%; text-align: center;">CANT.</th>
                                    <th style="width: 14%; text-align: right;">PRECIO UNIT.</th>
                                    <th style="width: 14%; text-align: right;">SUBTOTAL</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${rowsHtml}
                                ${emptyRowsHtml}
                            </tbody>
                        </table>

                        <!-- Totals Box -->
                        <div class="totals-wrapper">
                            <table class="totals-card">
                                <tr>
                                    <td class="totals-lbl">Subtotal Servicios:</td>
                                    <td class="totals-val">${formatInvoiceMoney(invoiceTotals.subtotal)}</td>
                                </tr>
                                <tr>
                                    <td class="totals-lbl">${invoiceConfig.extraConceptDesc || 'Otros Conceptos / Gastos'}:</td>
                                    <td class="totals-val">${formatInvoiceMoney(invoiceTotals.extra)}</td>
                                </tr>
                                <tr class="totals-grand">
                                    <td class="totals-lbl">Total a Liquidar:</td>
                                    <td class="totals-val">${formatInvoiceMoney(invoiceTotals.totalLiquidar)}</td>
                                </tr>
                            </table>
                        </div>
                    </div>

                    <div>
                        <!-- Bank Details -->
                        <div class="bank-card">
                            <div class="bank-title">DATOS BANCARIOS PARA LIQUIDACIÓN / TRANSFERENCIA</div>
                            <div class="bank-lines">
                                <div><strong>Titular / Beneficiario:</strong> ${invoiceConfig.bankHolder}</div>
                                <div style="display: flex; justify-content: space-between; max-width: 520px;">
                                    <span><strong>Banco:</strong> ${invoiceConfig.bankName}</span>
                                    <span><strong>Moneda:</strong> [ ${!isArs ? 'X' : '&nbsp;'} ] USD / [ ${isArs ? 'X' : '&nbsp;'} ] ARS</span>
                                </div>
                                <div><strong>CBU / CVU / Routing (ABA):</strong> <span style="font-family: monospace;">${invoiceConfig.bankCbu}</span></div>
                                <div><strong>Alias / SWIFT Code:</strong> <span style="font-family: monospace;">${invoiceConfig.bankAlias}</span></div>
                                <div><strong>Nº de Cuenta / IBAN:</strong> <span style="font-family: monospace;">${invoiceConfig.bankAccountNumber}</span></div>
                            </div>
                        </div>

                        <!-- Footer -->
                        <div class="doc-footer">
                            <span>Documento emitido con fines informativos de liquidación. No posee validez fiscal ni impositiva formal.</span>
                            <span>Página 1 de 1</span>
                        </div>
                    </div>
                </div>

                <script>
                    window.onload = function() {
                        window.focus();
                        window.print();
                    };
                </script>
            </body>
            </html>
        `);
        printWindow.document.close();
    };

    const handleCreateExpense = async () => {
        if (!expenseForm.description || !expenseForm.amount) return alert('Completa todos los campos');

        if (!selectedExchangeRate || selectedExchangeRate <= 0) return alert('No hay cotización del dólar configurada para este mes en el Historial de Tarifas.');

        const amountARS = parseFloat(expenseForm.amount);
        const amountUSD = amountARS / selectedExchangeRate;

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
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>Análisis financiero de cliente {countryFilter} en {currency === 'USD' ? 'Dólares Estadounidenses' : 'Pesos Argentinos'}.</p>
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
                    <div className="flex-mobile-column" style={{ display: 'flex', gap: '0.5rem', width: '100%', flexWrap: 'wrap' }}>
                        <Button 
                            icon={FileText} 
                            onClick={() => setIsInvoiceModalOpen(true)} 
                            style={{ 
                                backgroundColor: '#1e3a8a', 
                                borderColor: '#1e3a8a', 
                                color: 'white', 
                                flex: 1 
                            }}
                        >
                            {selectedTickets.size > 0 
                                ? `Resumen Selección (${selectedTickets.size})` 
                                : `Resumen de Servicio (${filteredTickets.length})`}
                        </Button>
                        {selectedTickets.size > 0 && (
                            <Button 
                                icon={Trash} 
                                onClick={handleDeleteSelected} 
                                style={{ 
                                    backgroundColor: '#ef4444', 
                                    color: 'white', 
                                    borderColor: '#ef4444', 
                                    flex: 1 
                                }}
                            >
                                Eliminar ({selectedTickets.size})
                            </Button>
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
                            {selectedExchangeRate > 0 && (
                                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: 0 }}>ARS {(metrics.totalRevenue * selectedExchangeRate).toLocaleString('es-AR', { minimumFractionDigits: 2 })}</p>
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
                            {selectedExchangeRate > 0 && (
                                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: 0 }}>ARS {(metrics.totalCost * selectedExchangeRate).toLocaleString('es-AR', { minimumFractionDigits: 2 })}</p>
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
                            {selectedExchangeRate > 0 && (
                                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: 0 }}>ARS {(metrics.netMargin * selectedExchangeRate).toLocaleString('es-AR', { minimumFractionDigits: 2 })}</p>
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
                            {selectedExchangeRate > 0 && (
                                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: 0 }}>ARS {(Object.values(metrics.driverPayments).reduce((sum, d) => sum + d.total, 0) * selectedExchangeRate).toLocaleString('es-AR', { minimumFractionDigits: 2 })}</p>
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
                    <Card 
                        title="Detalle de Utilidad por Servicio" 
                        className="table-responsive desktop-table"
                        action={
                            <div style={{ position: 'relative', width: '250px' }}>
                                <Search size={16} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
                                <input
                                    type="text"
                                    placeholder="Buscar Ticket o solicitante..."
                                    value={searchQuery}
                                    onChange={e => setSearchQuery(e.target.value)}
                                    className="form-input"
                                    style={{ paddingLeft: '35px', height: '36px', fontSize: '0.85rem' }}
                                />
                            </div>
                        }
                    >
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
                                    {filteredTickets.length > 0 ? filteredTickets
                                        .filter(ticket => {
                                            if (!searchQuery.trim()) return true;
                                            const query = searchQuery.toLowerCase().trim();
                                            return (ticket.id && ticket.id.toLowerCase().includes(query)) ||
                                                   (ticket.requester && ticket.requester.toLowerCase().includes(query)) ||
                                                   (ticket.subject && ticket.subject.toLowerCase().includes(query));
                                        })
                                        .map(ticket => {
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
                                            method,
                                            deliveryPerson
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
                                                    {ticket.subject && (
                                                        <span style={{ fontSize: '0.8rem', fontWeight: 500, color: 'var(--text-main)', display: 'block', margin: '2px 0 4px 0', maxWidth: '280px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={ticket.subject}>
                                                            {ticket.subject}
                                                        </span>
                                                    )}
                                                    <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{ticket.requester}</span>
                                                </td>
                                                <td style={{ padding: '1rem' }}>
                                                    <Badge variant={ticket.status === 'Servicio Facturado' ? 'success' : 'outline'}>{ticket.status}</Badge>
                                                </td>

                                                <td style={{ padding: '1rem', color: 'var(--text-main)' }}>
                                                    {(method === 'Repartidor Propio' || method === 'Envío Interno' || String(method || '').includes('Propio')) && deliveryPerson ? (
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                            <span>{method}</span>
                                                            <div 
                                                                title={deliveryPerson}
                                                                style={{
                                                                    display: 'flex',
                                                                    alignItems: 'center',
                                                                    justifyContent: 'center',
                                                                    width: '22px',
                                                                    height: '22px',
                                                                    borderRadius: '50%',
                                                                    backgroundColor: 'var(--primary-color)',
                                                                    color: 'white',
                                                                    fontSize: '0.6rem',
                                                                    fontWeight: 700,
                                                                    boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                                                                }}
                                                            >
                                                                {deliveryPerson.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()}
                                                            </div>
                                                        </div>
                                                    ) : (method || 'N/A')}
                                                </td>

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
                    {/* Driver Payments - Liquidación detallada con pago real */}
                    <Card title="Liquidación Conductores" action={<CreditCard size={18} style={{ opacity: 0.6 }} />}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            {Object.entries(metrics.driverPayments).length > 0 ? (
                                Object.entries(metrics.driverPayments).map(([name, data]) => {
                                    // Pago real persistido en BD para este conductor y mes
                                    const savedPayment = rates?.driverActualPayments?.[selectedMonthKey]?.[name];
                                    // Valor que el usuario está editando localmente
                                    const inputRaw = driverPaymentInputs[name];
                                    const inputVal = inputRaw !== undefined ? inputRaw : (savedPayment !== undefined ? String(savedPayment) : '');
                                    const paidUSD = parseFloat(inputVal) || savedPayment || 0;
                                    const diff = data.total - paidUSD;
                                    const isPaid = savedPayment !== undefined && savedPayment > 0;

                                    return (
                                        <div key={name} style={{
                                            padding: '1rem',
                                            background: 'var(--background)',
                                            borderRadius: '10px',
                                            border: `1px solid ${isPaid ? 'rgba(34, 197, 94, 0.25)' : 'var(--border)'}`,
                                        }}>
                                            {/* Header conductor */}
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                                    <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: 'linear-gradient(135deg, #0ea5e9, #2563eb)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '1rem' }}>
                                                        {name.charAt(0).toUpperCase()}
                                                    </div>
                                                    <div>
                                                        <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-main)' }}>{name}</div>
                                                        <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', display: 'flex', gap: '0.4rem' }}>
                                                            <span style={{ background: 'rgba(37, 99, 235, 0.08)', color: '#2563eb', padding: '1px 5px', borderRadius: '4px', fontWeight: 600 }}>{data.deliveries} Entregas</span>
                                                            <span style={{ background: 'rgba(245, 158, 11, 0.08)', color: '#d97706', padding: '1px 5px', borderRadius: '4px', fontWeight: 600 }}>{data.recoveries} Recuperos</span>
                                                        </div>
                                                    </div>
                                                </div>
                                                {/* Calculado */}
                                                <div style={{ textAlign: 'right' }}>
                                                    <div style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 700 }}>A pagar</div>
                                                    <div style={{ fontWeight: 800, fontSize: '1.1rem', color: 'var(--text-main)' }}>
                                                        USD {data.total.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                                    </div>
                                                    {selectedExchangeRate > 0 && (
                                                        <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                                                            ARS {(data.total * selectedExchangeRate).toLocaleString('es-AR', { minimumFractionDigits: 0 })}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Fila: Pago real ingresado */}
                                            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                                                <div style={{ flex: 1 }}>
                                                    <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', fontWeight: 600, marginBottom: '3px', textTransform: 'uppercase' }}>Pagado (real)</div>
                                                    <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                                                        <span style={{ position: 'absolute', left: '8px', fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600 }}>USD</span>
                                                        <input
                                                            type="number"
                                                            className="form-input"
                                                            style={{ paddingLeft: '40px', height: '34px', fontSize: '0.9rem', fontWeight: 700, borderColor: isPaid ? 'rgba(34, 197, 94, 0.5)' : undefined }}
                                                            placeholder="0.00"
                                                            value={inputVal}
                                                            onChange={e => setDriverPaymentInputs(prev => ({ ...prev, [name]: e.target.value }))}
                                                        />
                                                    </div>
                                                </div>
                                                <button
                                                    title="Guardar pago real"
                                                    onClick={async () => {
                                                        const val = parseFloat(inputVal);
                                                        if (isNaN(val)) { alert('Ingresa un valor válido'); return; }
                                                        const existing = rates?.driverActualPayments || {};
                                                        const monthData = { ...(existing[selectedMonthKey] || {}), [name]: val };
                                                        await updateRates({ ...rates, driverActualPayments: { ...existing, [selectedMonthKey]: monthData } }, true);
                                                        // Limpiar input local (ya queda en BD)
                                                        setDriverPaymentInputs(prev => { const n = {...prev}; delete n[name]; return n; });
                                                    }}
                                                    style={{
                                                        background: 'var(--primary-color)', color: 'white', border: 'none',
                                                        borderRadius: '8px', padding: '0 12px', height: '34px',
                                                        cursor: 'pointer', fontSize: '0.85rem', whiteSpace: 'nowrap',
                                                        alignSelf: 'flex-end', fontWeight: 700,
                                                        display: 'flex', alignItems: 'center', gap: '4px'
                                                    }}
                                                >
                                                    💾 Guardar
                                                </button>
                                            </div>

                                            {/* Balance */}
                                            {isPaid && (
                                                <div style={{
                                                    marginTop: '0.6rem',
                                                    padding: '0.4rem 0.6rem',
                                                    borderRadius: '6px',
                                                    background: Math.abs(diff) < 0.01 ? 'rgba(34, 197, 94, 0.07)' : 'rgba(239, 68, 68, 0.07)',
                                                    display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                                                }}>
                                                    <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
                                                        {Math.abs(diff) < 0.01 ? '✅ Cuadrado' : diff > 0 ? '⚠️ Pendiente' : '⬆️ Exceso'}
                                                    </span>
                                                    <span style={{
                                                        fontSize: '0.8rem', fontWeight: 700,
                                                        color: Math.abs(diff) < 0.01 ? '#16a34a' : diff > 0 ? '#f59e0b' : '#ef4444'
                                                    }}>
                                                        {diff > 0.01 ? '-' : ''}{Math.abs(diff) < 0.01 ? '—' : `USD ${Math.abs(diff).toFixed(2)}`}
                                                    </span>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })
                            ) : (
                                <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', textAlign: 'center', padding: '1rem' }}>No hay liquidaciones para este período.</p>
                            )}
                        </div>
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
                                    <span style={{ fontWeight: 600, color: '#800020' }}>{currency} {(metrics.totalManualExpenses * (currency === 'USD' ? 1 : (selectedExchangeRate || 1))).toLocaleString(currency === 'USD' ? 'en-US' : 'es-AR', { minimumFractionDigits: 2 })}</span>
                                </div>
                                <div style={{ height: '6px', background: 'var(--border)', borderRadius: '4px', overflow: 'hidden' }}>
                                    <div style={{ height: '100%', background: '#800020', width: `${metrics.totalRevenue > 0 ? ((metrics.totalManualExpenses * (currency === 'USD' ? 1 : (selectedExchangeRate || 1))) / metrics.totalRevenue) * 100 : 0}%` }} />
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
                                                    {currency} {(parseFloat(expense.amount) * (currency === 'USD' ? 1 : (selectedExchangeRate || 1))).toLocaleString(currency === 'USD' ? 'en-US' : 'es-AR', { minimumFractionDigits: 2 })}
                                                </span>
                                                {selectedExchangeRate > 0 && (
                                                    <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                                                        ARS {(parseFloat(expense.amount) * selectedExchangeRate).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
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

            <Modal isOpen={isRatesModalOpen} onClose={() => setIsRatesModalOpen(false)} title={`Configuración de Cuadro Tarifario (${countryFilter})`}>
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


                        {/* Historial de Cotizaciones por Mes - EDITABLE */}
                        <div style={{ borderTop: '1px solid var(--border)', paddingTop: '1rem' }}>
                            <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                Historial de Cotizaciones por Mes
                            </div>

                            {/* Selector de mes + input de valor */}
                            <div className="flex-mobile-column" style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-end', marginBottom: '0.75rem', flexWrap: 'wrap' }}>
                                <div style={{ display: 'flex', gap: '0.4rem', flex: '1 1 auto', minWidth: '200px' }}>
                                    <div className="form-group" style={{ margin: 0, flex: 1 }}>
                                        <label className="form-label" style={{ fontSize: '0.7rem' }}>Mes</label>
                                        <select
                                            className="form-select"
                                            style={{ fontSize: '0.85rem', padding: '0.4rem 0.6rem', height: 'auto' }}
                                            value={historyEditMonth}
                                            onChange={e => {
                                                setHistoryEditMonth(e.target.value);
                                                // Precargar valor existente si lo hay
                                                const key = `${historyEditYear}-${e.target.value}`;
                                                setHistoryEditValue(tempRates.exchangeRateHistory?.[key] || '');
                                            }}
                                        >
                                            {MONTHS.map((m, i) => (
                                                <option key={i} value={String(i + 1).padStart(2, '0')}>{m}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="form-group" style={{ margin: 0, flex: '0 0 90px' }}>
                                        <label className="form-label" style={{ fontSize: '0.7rem' }}>Año</label>
                                        <select
                                            className="form-select"
                                            style={{ fontSize: '0.85rem', padding: '0.4rem 0.6rem', height: 'auto' }}
                                            value={historyEditYear}
                                            onChange={e => {
                                                setHistoryEditYear(e.target.value);
                                                const key = `${e.target.value}-${historyEditMonth}`;
                                                setHistoryEditValue(tempRates.exchangeRateHistory?.[key] || '');
                                            }}
                                        >
                                            {YEARS.map(y => (
                                                <option key={y} value={String(y)}>{y}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                                <div className="form-group" style={{ margin: 0, flex: '1 1 120px', minWidth: '120px' }}>
                                    <label className="form-label" style={{ fontSize: '0.7rem' }}>Valor ARS</label>
                                    <div style={{ position: 'relative' }}>
                                        <span style={{ position: 'absolute', left: '8px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)', fontSize: '0.8rem' }}>$</span>
                                        <input
                                            type="number"
                                            className="form-input"
                                            style={{ paddingLeft: '22px', fontSize: '0.9rem', fontWeight: 700 }}
                                            placeholder="Ej: 1440"
                                            value={historyEditValue}
                                            onChange={e => setHistoryEditValue(e.target.value)}
                                        />
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    onClick={async () => {
                                        const val = parseFloat(historyEditValue);
                                        if (!val || val <= 0) { alert('Ingresa un valor válido'); return; }
                                        const key = `${historyEditYear}-${historyEditMonth}`;
                                        const existing = rates?.exchangeRateHistory || {};
                                        const newHistory = { ...existing, [key]: val };
                                        // Construir el rates completo actualizado
                                        const newRates = { ...rates, exchangeRateHistory: newHistory };
                                        // Actualizar UI local instantáneamente
                                        setTempRates(newRates);
                                        // Persistir en Supabase de inmediato (silencioso: sin alert)
                                        await updateRates(newRates, true);
                                        setHistoryEditValue('');
                                    }}
                                    style={{
                                        background: 'var(--primary-color)',
                                        color: 'white',
                                        border: 'none',
                                        borderRadius: '8px',
                                        padding: '0.45rem 1rem',
                                        fontWeight: 700,
                                        fontSize: '0.8rem',
                                        cursor: 'pointer',
                                        whiteSpace: 'nowrap',
                                        alignSelf: 'flex-end',
                                        height: '38px'
                                    }}
                                >
                                    + Guardar
                                </button>
                            </div>

                            {/* Tabla del historial */}
                            {tempRates.exchangeRateHistory && Object.keys(tempRates.exchangeRateHistory).length > 0 ? (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', maxHeight: '160px', overflowY: 'auto' }}>
                                    {Object.entries(tempRates.exchangeRateHistory)
                                        .sort(([a], [b]) => b.localeCompare(a))
                                        .map(([monthKey, value]) => {
                                            const [year, monthNum] = monthKey.split('-');
                                            const monthName = MONTHS[parseInt(monthNum) - 1];
                                            const now = new Date();
                                            const currentKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
                                            const isCurrentMonth = monthKey === currentKey;
                                            return (
                                                <div key={monthKey} style={{
                                                    display: 'flex',
                                                    justifyContent: 'space-between',
                                                    alignItems: 'center',
                                                    padding: '0.4rem 0.75rem',
                                                    borderRadius: '6px',
                                                    background: isCurrentMonth ? 'rgba(37, 99, 235, 0.07)' : 'var(--background)',
                                                    border: `1px solid ${isCurrentMonth ? 'rgba(37, 99, 235, 0.25)' : 'var(--border)'}`,
                                                }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                        {isCurrentMonth && <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#2563eb', display: 'inline-block' }} />}
                                                        <span style={{ fontSize: '0.82rem', fontWeight: isCurrentMonth ? 700 : 500, color: isCurrentMonth ? '#2563eb' : 'var(--text-main)' }}>
                                                            {monthName} {year}
                                                        </span>
                                                        {isCurrentMonth && <span style={{ fontSize: '0.65rem', color: '#2563eb', background: 'rgba(37, 99, 235, 0.1)', padding: '1px 5px', borderRadius: '4px', fontWeight: 700 }}>Actual</span>}
                                                    </div>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                                        <span style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-main)' }}>
                                                            ARS {Number(value).toLocaleString('es-AR')}
                                                        </span>
                                                        <button
                                                            type="button"
                                                            title="Eliminar este registro"
                                                            onClick={async () => {
                                                                if (confirm(`¿Eliminar cotización de ${monthName} ${year}?`)) {
                                                                    const newHistory = { ...(rates?.exchangeRateHistory || {}) };
                                                                    delete newHistory[monthKey];
                                                                    const newRates = { ...rates, exchangeRateHistory: newHistory };
                                                                    setTempRates(newRates);
                                                                    await updateRates(newRates, true);
                                                                }
                                                            }}
                                                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', padding: '2px', opacity: 0.5, lineHeight: 1 }}
                                                        >
                                                            <Trash size={13} />
                                                        </button>
                                                    </div>
                                                </div>
                                            );
                                        })
                                    }
                                </div>
                            ) : (
                                <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', textAlign: 'center', padding: '0.5rem', fontStyle: 'italic' }}>
                                    Sin historial aun. Agrega la cotización de cada mes.
                                </p>
                            )}
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

                            {/* Otros */}
                            <div className="form-group">
                                <label className="form-label">Otros</label>
                                <div style={{ position: 'relative' }}>
                                    <span style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }}>USD</span>
                                    <input type="number" className="form-input" style={{ paddingLeft: '45px' }}
                                        value={tempRates.service_Other !== undefined ? tempRates.service_Other : (tempRates.otherService || 5)}
                                        onChange={e => { const val = e.target.value; setTempRates(prev => ({ ...prev, service_Other: val === '' ? '' : parseFloat(val) })) }}
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
                        
                        // Use fallbackF (ticket-level financials which include custom overrides) as the source of truth for grand totals
                        const grandTotalRevenue = fallbackF?.totalRevenue || 0;
                        const grandTotalCost = fallbackF?.totalCost || 0;
                        const grandProfit = fallbackF?.profit || 0;

                        // If there is only one sub-task, apply the custom overrides to it so the breakdown matches the grand totals
                        if (taskFinancials.length === 1 && fallbackF) {
                            taskFinancials[0].serviceRevenue = fallbackF.serviceRevenue;
                            taskFinancials[0].logisticRevenue = fallbackF.logisticRevenue;
                            taskFinancials[0].logisticCost = fallbackF.logisticCost;
                            taskFinancials[0].totalRevenue = fallbackF.totalRevenue;
                            taskFinancials[0].totalCost = fallbackF.totalCost;
                            taskFinancials[0].profit = fallbackF.profit;
                        }

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
                                <div className="flex-mobile-column" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2rem', gap: '1rem', borderBottom: '2px solid var(--border)', paddingBottom: '1rem' }}>
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

                                {/* Custom values warning */}
                                {(t.deliveryDetails?.customServiceRevenue !== null && t.deliveryDetails?.customServiceRevenue !== undefined || 
                                  t.deliveryDetails?.customLogisticRevenue !== null && t.deliveryDetails?.customLogisticRevenue !== undefined || 
                                  t.deliveryDetails?.customLogisticCost !== null && t.deliveryDetails?.customLogisticCost !== undefined ||
                                  t.deliveryDetails?.customLogisticCostARS !== null && t.deliveryDetails?.customLogisticCostARS !== undefined ||
                                  t.deliveryDetails?.customPostalCost !== null && t.deliveryDetails?.customPostalCost !== undefined) && (
                                    <div style={{ 
                                        padding: '0.6rem 0.85rem', 
                                        background: 'rgba(245, 158, 11, 0.05)', 
                                        border: '1px solid rgba(245, 158, 11, 0.2)', 
                                        borderRadius: '8px', 
                                        color: '#b45309', 
                                        fontSize: '0.75rem', 
                                        fontWeight: 600, 
                                        marginBottom: '1rem', 
                                        display: 'flex', 
                                        alignItems: 'center', 
                                        gap: '6px' 
                                    }}>
                                        <Info size={14} /> Valores personalizados aplicados a nivel de servicio
                                    </div>
                                )}

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

                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1.5rem' }}>
                                    <label style={{ fontSize: '0.85rem', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', background: 'var(--surface)', padding: '0.5rem 0.75rem', borderRadius: '8px', border: '1px solid var(--border)' }}>
                                        <input 
                                            type="checkbox" 
                                            checked={t.deliveryDetails?.hasSecondVisitSurcharge || false}
                                            onChange={async (e) => await updateTicket(t.id, { deliveryDetails: { ...t.deliveryDetails, hasSecondVisitSurcharge: e.target.checked } })}
                                            style={{ cursor: 'pointer' }}
                                        />
                                        Recargo por 2ª visita
                                    </label>
                                    <div style={{ display: 'flex', gap: '1rem' }}>
                                        <Link href={`/dashboard/tickets/${t.id}`} style={{ textDecoration: 'none' }}>
                                            <Button icon={ArrowRight} variant="outline" size="sm">Ver Ticket Completo</Button>
                                        </Link>
                                        <Button onClick={() => setDetailModal({ ...detailModal, isOpen: false })}>Cerrar Detalle</Button>
                                    </div>
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
                                <span>Cotización del mes (Historial):</span>
                                <strong style={{ color: 'var(--primary-color)' }}>ARS {selectedExchangeRate ? selectedExchangeRate.toLocaleString('es-AR') : '—'}</strong>
                            </div>
                            {(!selectedExchangeRate || selectedExchangeRate === 0) && (
                                <div style={{ color: '#ef4444', marginTop: '0.25rem', fontWeight: 600 }}>
                                    ⚠️ Agrega la cotización de este mes en Tarifas → Historial.
                                </div>
                            )}
                            <div>Equivalente: <strong>USD {((parseFloat(expenseForm.amount) || 0) / (selectedExchangeRate || 1)).toFixed(2)}</strong></div>
                        </div>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '1.5rem' }}>
                        <Button variant="secondary" onClick={() => setIsExpenseModalOpen(false)}>Cancelar</Button>
                        <Button onClick={handleCreateExpense} style={{ backgroundColor: '#800020', borderColor: '#800020', color: 'white' }}>Registrar Gasto</Button>
                    </div>
                </div>
            </Modal>

            {/* Invoice/Resumen de Servicio Modal para el Cliente */}
            <Modal 
                isOpen={isInvoiceModalOpen} 
                onClose={() => setIsInvoiceModalOpen(false)} 
                title={`Resumen de Servicio para Cliente: ${selectedClientKey} (YAWI Informática)`}
                maxWidth="1020px"
            >
                <div style={{ padding: '0.25rem', maxHeight: '85vh', overflowY: 'auto' }}>
                    {/* Control Bar */}
                    <div style={{ 
                        display: 'flex', 
                        justifyContent: 'space-between', 
                        alignItems: 'center', 
                        flexWrap: 'wrap', 
                        gap: '0.75rem', 
                        marginBottom: '1rem',
                        background: 'var(--surface-hover)',
                        padding: '0.75rem 1rem',
                        borderRadius: '8px',
                        border: '1px solid var(--border)'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                            {/* Selector dinámico de Cliente / Entorno */}
                            <div style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '0.4rem',
                                background: 'var(--surface)',
                                padding: '0.3rem 0.65rem',
                                borderRadius: '8px',
                                border: '1px solid var(--border)'
                            }}>
                                <Building size={14} style={{ color: '#1e3a8a' }} />
                                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)' }}>Entorno:</span>
                                <select
                                    value={selectedClientKey}
                                    onChange={e => setSelectedClientKey(e.target.value)}
                                    style={{
                                        background: 'transparent',
                                        border: 'none',
                                        fontWeight: 800,
                                        fontSize: '0.85rem',
                                        color: '#1e3a8a',
                                        cursor: 'pointer',
                                        outline: 'none',
                                        padding: '0.1rem 0.25rem'
                                    }}
                                >
                                    {availableClients.map(c => (
                                        <option key={c} value={c}>{c}</option>
                                    ))}
                                </select>
                            </div>

                            <Badge variant="info" style={{ fontSize: '0.85rem', padding: '0.35rem 0.75rem' }}>
                                {invoiceItems.length} servicio(s) incluido(s)
                            </Badge>
                            {selectedTickets.size > 0 && (
                                <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                                    (Selección manual activa)
                                </span>
                            )}
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                            {/* Currency Switcher */}
                            <div style={{ display: 'inline-flex', borderRadius: '6px', border: '1px solid var(--border)', overflow: 'hidden' }}>
                                <button
                                    type="button"
                                    onClick={() => updateInvoiceConfigField('currency', 'USD')}
                                    style={{
                                        padding: '0.4rem 0.75rem',
                                        fontSize: '0.8rem',
                                        fontWeight: 700,
                                        border: 'none',
                                        cursor: 'pointer',
                                        background: invoiceConfig.currency === 'USD' ? '#1e3a8a' : 'transparent',
                                        color: invoiceConfig.currency === 'USD' ? '#ffffff' : 'var(--text-main)',
                                        transition: 'all 0.2s'
                                    }}
                                >
                                    USD ($)
                                </button>
                                <button
                                    type="button"
                                    onClick={() => updateInvoiceConfigField('currency', 'ARS')}
                                    style={{
                                        padding: '0.4rem 0.75rem',
                                        fontSize: '0.8rem',
                                        fontWeight: 700,
                                        border: 'none',
                                        cursor: 'pointer',
                                        background: invoiceConfig.currency === 'ARS' ? '#1e3a8a' : 'transparent',
                                        color: invoiceConfig.currency === 'ARS' ? '#ffffff' : 'var(--text-main)',
                                        transition: 'all 0.2s'
                                    }}
                                >
                                    ARS ($)
                                </button>
                            </div>

                            {/* Toggle Edit Config */}
                            <Button 
                                icon={Edit3}
                                variant={isEditingInvoiceConfig ? 'primary' : 'outline'}
                                size="sm"
                                onClick={() => setIsEditingInvoiceConfig(!isEditingInvoiceConfig)}
                            >
                                {isEditingInvoiceConfig ? 'Ver Documento' : 'Editar Datos'}
                            </Button>

                            {/* Excel */}
                            <Button 
                                icon={Download} 
                                size="sm"
                                onClick={handleDownloadExcel}
                                style={{ backgroundColor: '#10b981', color: 'white', borderColor: '#10b981' }}
                            >
                                Excel
                            </Button>

                            {/* Print / PDF */}
                            <Button 
                                icon={Printer} 
                                size="sm"
                                onClick={handlePrintInvoice}
                                style={{ backgroundColor: '#1e3a8a', color: 'white', borderColor: '#1e3a8a' }}
                            >
                                Imprimir / PDF
                            </Button>

                            <Button 
                                variant="secondary" 
                                size="sm"
                                onClick={() => setIsInvoiceModalOpen(false)}
                            >
                                Cerrar
                            </Button>
                        </div>
                    </div>

                    {/* Edit Configuration Drawer */}
                    {isEditingInvoiceConfig && (
                        <div style={{
                            background: 'var(--surface)',
                            border: '1px solid var(--border)',
                            borderRadius: '8px',
                            padding: '1.25rem',
                            marginBottom: '1.5rem',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '1rem'
                        }}>
                            <div style={{ 
                                display: 'flex', 
                                justifyContent: 'space-between', 
                                alignItems: 'center', 
                                borderBottom: '1px solid var(--border)', 
                                paddingBottom: '0.6rem',
                                flexWrap: 'wrap',
                                gap: '0.5rem'
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                                    <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-main)' }}>
                                        ⚙️ Personalización del Resumen
                                    </h4>
                                    <span style={{
                                        background: '#dbeafe',
                                        color: '#1e40af',
                                        fontSize: '0.75rem',
                                        fontWeight: 800,
                                        padding: '0.2rem 0.6rem',
                                        borderRadius: '9999px',
                                        border: '1px solid #bfdbfe'
                                    }}>
                                        {selectedClientKey}
                                    </span>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.75rem' }}>
                                    {saveStatus === 'Guardado' ? (
                                        <span style={{ color: '#16a34a', display: 'flex', alignItems: 'center', gap: '0.35rem', fontWeight: 600 }}>
                                            <Check size={14} /> Guardado para <strong>{selectedClientKey}</strong> (nube y local)
                                        </span>
                                    ) : (
                                        <span style={{ color: '#d97706', display: 'flex', alignItems: 'center', gap: '0.35rem', fontWeight: 600 }}>
                                            <RefreshCw size={14} className="spin-fast" /> Guardando cambios...
                                        </span>
                                    )}
                                </div>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
                                {/* Metadatos */}
                                <div style={{ background: 'var(--surface-hover)', padding: '0.75rem', borderRadius: '6px' }}>
                                    <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#1e3a8a', textTransform: 'uppercase', display: 'block', marginBottom: '0.5rem' }}>
                                        Documento
                                    </span>
                                    <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Nº Resumen</label>
                                    <input 
                                        className="form-input" 
                                        style={{ height: '32px', fontSize: '0.8rem', marginBottom: '0.5rem' }}
                                        value={invoiceConfig.docNumber} 
                                        onChange={e => updateInvoiceConfigField('docNumber', e.target.value)} 
                                    />
                                    <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Fecha de Emisión</label>
                                    <input 
                                        className="form-input" 
                                        style={{ height: '32px', fontSize: '0.8rem', marginBottom: '0.5rem' }}
                                        value={invoiceConfig.emissionDate} 
                                        onChange={e => updateInvoiceConfigField('emissionDate', e.target.value)} 
                                    />
                                    <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Condición de Pago</label>
                                    <input 
                                        className="form-input" 
                                        style={{ height: '32px', fontSize: '0.8rem' }}
                                        value={invoiceConfig.paymentCondition} 
                                        onChange={e => updateInvoiceConfigField('paymentCondition', e.target.value)} 
                                    />
                                </div>

                                {/* Cliente */}
                                <div style={{ background: 'var(--surface-hover)', padding: '0.75rem', borderRadius: '6px' }}>
                                    <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#1e3a8a', textTransform: 'uppercase', display: 'block', marginBottom: '0.5rem' }}>
                                        Datos del Cliente
                                    </span>
                                    <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Razón Social</label>
                                    <input 
                                        className="form-input" 
                                        style={{ height: '32px', fontSize: '0.8rem', marginBottom: '0.5rem' }}
                                        value={invoiceConfig.clientName} 
                                        onChange={e => updateInvoiceConfigField('clientName', e.target.value)} 
                                    />
                                    <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>ID / CUIT / Tax ID</label>
                                    <input 
                                        className="form-input" 
                                        style={{ height: '32px', fontSize: '0.8rem', marginBottom: '0.5rem' }}
                                        value={invoiceConfig.clientTaxId} 
                                        onChange={e => updateInvoiceConfigField('clientTaxId', e.target.value)} 
                                    />
                                    <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Contacto / Email</label>
                                    <input 
                                        className="form-input" 
                                        style={{ height: '32px', fontSize: '0.8rem', marginBottom: '0.5rem' }}
                                        value={invoiceConfig.clientEmail} 
                                        onChange={e => updateInvoiceConfigField('clientEmail', e.target.value)} 
                                    />
                                    <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Dirección / País</label>
                                    <input 
                                        className="form-input" 
                                        style={{ height: '32px', fontSize: '0.8rem' }}
                                        value={invoiceConfig.clientAddress} 
                                        onChange={e => updateInvoiceConfigField('clientAddress', e.target.value)} 
                                    />
                                </div>

                                {/* YAWI Informática */}
                                <div style={{ background: 'var(--surface-hover)', padding: '0.75rem', borderRadius: '6px' }}>
                                    <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#1e3a8a', textTransform: 'uppercase', display: 'block', marginBottom: '0.5rem' }}>
                                        YAWI Informática
                                    </span>
                                    <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>C.U.I.T.</label>
                                    <input 
                                        className="form-input" 
                                        style={{ height: '32px', fontSize: '0.8rem', marginBottom: '0.5rem' }}
                                        value={invoiceConfig.companyCuit} 
                                        onChange={e => updateInvoiceConfigField('companyCuit', e.target.value)} 
                                    />
                                    <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Condición IVA</label>
                                    <input 
                                        className="form-input" 
                                        style={{ height: '32px', fontSize: '0.8rem', marginBottom: '0.5rem' }}
                                        value={invoiceConfig.companyIva} 
                                        onChange={e => updateInvoiceConfigField('companyIva', e.target.value)} 
                                    />
                                    <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Domicilio Comercial</label>
                                    <input 
                                        className="form-input" 
                                        style={{ height: '32px', fontSize: '0.8rem', marginBottom: '0.5rem' }}
                                        value={invoiceConfig.companyAddress} 
                                        onChange={e => updateInvoiceConfigField('companyAddress', e.target.value)} 
                                    />
                                    <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Email</label>
                                    <input 
                                        className="form-input" 
                                        style={{ height: '32px', fontSize: '0.8rem' }}
                                        value={invoiceConfig.companyEmail} 
                                        onChange={e => updateInvoiceConfigField('companyEmail', e.target.value)} 
                                    />
                                </div>

                                {/* Datos Bancarios y Otros Conceptos */}
                                <div style={{ background: 'var(--surface-hover)', padding: '0.75rem', borderRadius: '6px' }}>
                                    <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#1e3a8a', textTransform: 'uppercase', display: 'block', marginBottom: '0.5rem' }}>
                                        Liquidación Bancaria
                                    </span>
                                    <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Titular Beneficiario</label>
                                    <input 
                                        className="form-input" 
                                        style={{ height: '32px', fontSize: '0.8rem', marginBottom: '0.5rem' }}
                                        value={invoiceConfig.bankHolder} 
                                        onChange={e => updateInvoiceConfigField('bankHolder', e.target.value)} 
                                    />
                                    <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Banco</label>
                                    <input 
                                        className="form-input" 
                                        style={{ height: '32px', fontSize: '0.8rem', marginBottom: '0.5rem' }}
                                        value={invoiceConfig.bankName} 
                                        onChange={e => updateInvoiceConfigField('bankName', e.target.value)} 
                                    />
                                    <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>CBU / Routing (ABA)</label>
                                    <input 
                                        className="form-input" 
                                        style={{ height: '32px', fontSize: '0.8rem', marginBottom: '0.5rem' }}
                                        value={invoiceConfig.bankCbu} 
                                        onChange={e => updateInvoiceConfigField('bankCbu', e.target.value)} 
                                    />
                                    <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Alias / SWIFT</label>
                                    <input 
                                        className="form-input" 
                                        style={{ height: '32px', fontSize: '0.8rem', marginBottom: '0.5rem' }}
                                        value={invoiceConfig.bankAlias} 
                                        onChange={e => updateInvoiceConfigField('bankAlias', e.target.value)} 
                                    />
                                    <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Nº Cuenta / IBAN</label>
                                    <input 
                                        className="form-input" 
                                        style={{ height: '32px', fontSize: '0.8rem', marginBottom: '0.5rem' }}
                                        value={invoiceConfig.bankAccountNumber} 
                                        onChange={e => updateInvoiceConfigField('bankAccountNumber', e.target.value)} 
                                    />
                                    <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Otros Conceptos (+/- USD)</label>
                                    <input 
                                        type="number"
                                        className="form-input" 
                                        style={{ height: '32px', fontSize: '0.8rem' }}
                                        value={invoiceConfig.extraConceptAmount} 
                                        onChange={e => updateInvoiceConfigField('extraConceptAmount', e.target.value)} 
                                    />
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Paper Sheet Preview Container (Pixel-perfect exact replica of user mockup) */}
                    <div style={{
                        background: '#ffffff',
                        color: '#0f172a',
                        padding: '32px 36px',
                        border: '1px solid #cbd5e1',
                        borderRadius: '4px',
                        boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.05)',
                        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
                        maxWidth: '920px',
                        margin: '0 auto',
                        boxSizing: 'border-box'
                    }}>
                        {/* Header: YAWI Informática | X Box | Metadata */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
                            {/* Left: YAWI Informática Logo & Info */}
                            <div style={{ width: '45%' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
                                    <img 
                                        src="/assetflow-yaw-logo.png" 
                                        alt="YAWI" 
                                        style={{ height: '46px', width: 'auto', objectFit: 'contain' }} 
                                    />
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                        <span style={{ 
                                            background: '#1e3a8a', 
                                            color: '#ffffff', 
                                            padding: '4px 9px', 
                                            borderRadius: '6px', 
                                            fontWeight: 900, 
                                            fontSize: '15px',
                                            letterSpacing: '0.5px'
                                        }}>
                                            YAWI
                                        </span>
                                        <span style={{ 
                                            fontSize: '16px', 
                                            fontWeight: 800, 
                                            color: '#1e3a8a',
                                            letterSpacing: '0.5px'
                                        }}>
                                            INFORMÁTICA
                                        </span>
                                    </div>
                                </div>
                                <div style={{ fontSize: '10.5px', fontWeight: 600, color: '#475569', marginBottom: '8px' }}>
                                    {invoiceConfig.companyTagline}
                                </div>
                                <div style={{ fontSize: '10px', color: '#334155', lineHeight: 1.5 }}>
                                    <div><strong>C.U.I.T.:</strong> {invoiceConfig.companyCuit}</div>
                                    <div><strong>Condición IVA:</strong> {invoiceConfig.companyIva}</div>
                                    <div><strong>Domicilio Comercial:</strong> {invoiceConfig.companyAddress}</div>
                                    <div><strong>Contacto / Email:</strong> {invoiceConfig.companyEmail}</div>
                                </div>
                            </div>

                            {/* Center: Square X Box */}
                            <div style={{ width: '18%', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
                                <div style={{ 
                                    width: '46px', 
                                    height: '46px', 
                                    border: '2px solid #0f172a', 
                                    display: 'flex', 
                                    alignItems: 'center', 
                                    justifyContent: 'center',
                                    fontSize: '28px',
                                    fontWeight: 900,
                                    marginBottom: '4px',
                                    background: '#ffffff'
                                }}>
                                    X
                                </div>
                                <div style={{ fontSize: '11px', fontWeight: 800, color: '#0f172a', letterSpacing: '0.5px' }}>
                                    RESUMEN DE SERVICIO
                                </div>
                                <div style={{ fontSize: '8.5px', color: '#64748b', fontStyle: 'italic' }}>
                                    Doc. no válido como factura
                                </div>
                            </div>

                            {/* Right: Metadata Table */}
                            <div style={{ width: '34%', border: '1px solid #94a3b8', borderRadius: '3px', overflow: 'hidden' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 8px', borderBottom: '1px solid #cbd5e1', fontSize: '10px' }}>
                                    <span style={{ fontWeight: 700, color: '#334155' }}>Nº Resumen:</span>
                                    <span style={{ fontWeight: 800, color: '#1e3a8a' }}>{invoiceConfig.docNumber}</span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 8px', borderBottom: '1px solid #cbd5e1', fontSize: '10px' }}>
                                    <span style={{ fontWeight: 700, color: '#334155' }}>Fecha de Emisión:</span>
                                    <span style={{ fontWeight: 600, color: '#0f172a' }}>{invoiceConfig.emissionDate || new Date().toLocaleDateString('es-AR')}</span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 8px', borderBottom: '1px solid #cbd5e1', fontSize: '10px' }}>
                                    <span style={{ fontWeight: 700, color: '#334155' }}>Periodo:</span>
                                    <span style={{ fontWeight: 600, color: '#0f172a' }}>{period}</span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 8px', borderBottom: '1px solid #cbd5e1', fontSize: '10px' }}>
                                    <span style={{ fontWeight: 700, color: '#334155' }}>Moneda:</span>
                                    <span style={{ fontWeight: 700, color: '#0f172a' }}>
                                        [ {invoiceConfig.currency === 'USD' ? 'X' : ' '} ] USD &nbsp;&nbsp; [ {invoiceConfig.currency === 'ARS' ? 'X' : ' '} ] ARS
                                    </span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 8px', fontSize: '10px' }}>
                                    <span style={{ fontWeight: 700, color: '#334155' }}>Condición Pago:</span>
                                    <span style={{ fontWeight: 600, color: '#0f172a' }}>{invoiceConfig.paymentCondition}</span>
                                </div>
                            </div>
                        </div>

                        {/* DATOS DEL CLIENTE Banner & Grid */}
                        <div style={{ border: '1px solid #94a3b8', borderRadius: '3px', marginBottom: '20px', overflow: 'hidden' }}>
                            <div style={{ background: '#1e3a8a', color: '#ffffff', fontWeight: 800, fontSize: '11px', padding: '6px 10px', letterSpacing: '0.5px' }}>
                                DATOS DEL CLIENTE
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', background: '#ffffff' }}>
                                <div style={{ padding: '7px 10px', borderBottom: '1px solid #e2e8f0', borderRight: '1px solid #e2e8f0', fontSize: '10px' }}>
                                    <strong style={{ color: '#475569' }}>Razón Social:</strong> <span style={{ fontWeight: 700, color: '#0f172a' }}>{invoiceConfig.clientName || selectedClientKey || activeClientName}</span>
                                </div>
                                <div style={{ padding: '7px 10px', borderBottom: '1px solid #e2e8f0', fontSize: '10px' }}>
                                    <strong style={{ color: '#475569' }}>ID / CUIT / Tax ID:</strong> <span style={{ fontWeight: 600, color: '#0f172a' }}>{invoiceConfig.clientTaxId || '—'}</span>
                                </div>
                                <div style={{ padding: '7px 10px', borderRight: '1px solid #e2e8f0', fontSize: '10px' }}>
                                    <strong style={{ color: '#475569' }}>Contacto / Mail:</strong> <span style={{ fontWeight: 600, color: '#0f172a' }}>{invoiceConfig.clientEmail || '—'}</span>
                                </div>
                                <div style={{ padding: '7px 10px', fontSize: '10px' }}>
                                    <strong style={{ color: '#475569' }}>Dirección / País:</strong> <span style={{ fontWeight: 600, color: '#0f172a' }}>{invoiceConfig.clientAddress || '—'}</span>
                                </div>
                            </div>
                        </div>

                        {/* Services Table */}
                        <div style={{ overflowX: 'auto', marginBottom: '16px' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #94a3b8', fontSize: '10px' }}>
                                <thead>
                                    <tr>
                                        <th style={{ background: '#0f172a', color: '#ffffff', fontWeight: 800, padding: '8px 10px', textAlign: 'left', borderRight: '1px solid #334155', width: '15%' }}>
                                            TICKET / CASO
                                        </th>
                                        <th style={{ background: '#0f172a', color: '#ffffff', fontWeight: 800, padding: '8px 10px', textAlign: 'left', borderRight: '1px solid #334155', width: '49%' }}>
                                            DESCRIPCIÓN DEL SERVICIO LOGÍSTICO / IT
                                        </th>
                                        <th style={{ background: '#0f172a', color: '#ffffff', fontWeight: 800, padding: '8px 10px', textAlign: 'center', borderRight: '1px solid #334155', width: '8%' }}>
                                            CANT.
                                        </th>
                                        <th style={{ background: '#0f172a', color: '#ffffff', fontWeight: 800, padding: '8px 10px', textAlign: 'right', borderRight: '1px solid #334155', width: '14%' }}>
                                            PRECIO UNIT.
                                        </th>
                                        <th style={{ background: '#0f172a', color: '#ffffff', fontWeight: 800, padding: '8px 10px', textAlign: 'right', width: '14%' }}>
                                            SUBTOTAL
                                        </th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {invoiceItems.map((item, idx) => (
                                        <tr key={item.id || idx} style={{ borderBottom: '1px solid #cbd5e1' }}>
                                            <td style={{ padding: '8px 10px', fontWeight: 700, color: '#1e3a8a', borderRight: '1px solid #cbd5e1' }}>
                                                {item.caseNumber}
                                            </td>
                                            <td style={{ padding: '8px 10px', color: '#1e293b', borderRight: '1px solid #cbd5e1' }}>
                                                {item.description}
                                            </td>
                                            <td style={{ padding: '8px 10px', textAlign: 'center', color: '#1e293b', borderRight: '1px solid #cbd5e1' }}>
                                                {item.quantity}
                                            </td>
                                            <td style={{ padding: '8px 10px', textAlign: 'right', color: '#1e293b', borderRight: '1px solid #cbd5e1' }}>
                                                {formatInvoiceMoney(item.unitPrice)}
                                            </td>
                                            <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 700, color: '#0f172a' }}>
                                                {formatInvoiceMoney(item.subtotal)}
                                            </td>
                                        </tr>
                                    ))}

                                    {/* Empty lines if few items to keep the sheet proportion */}
                                    {Array.from({ length: Math.max(0, 4 - invoiceItems.length) }).map((_, i) => (
                                        <tr key={'empty-' + i} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                            <td style={{ padding: '10px', borderRight: '1px solid #cbd5e1' }}>&nbsp;</td>
                                            <td style={{ padding: '10px', borderRight: '1px solid #cbd5e1' }}>&nbsp;</td>
                                            <td style={{ padding: '10px', borderRight: '1px solid #cbd5e1' }}>&nbsp;</td>
                                            <td style={{ padding: '10px', borderRight: '1px solid #cbd5e1' }}>&nbsp;</td>
                                            <td style={{ padding: '10px' }}>&nbsp;</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {/* Subtotals Box (Right-aligned) */}
                        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '20px' }}>
                            <table style={{ width: '48%', border: '1px solid #94a3b8', borderCollapse: 'collapse', fontSize: '10.5px' }}>
                                <tbody>
                                    <tr>
                                        <td style={{ padding: '6px 12px', fontWeight: 700, color: '#334155', borderBottom: '1px solid #cbd5e1' }}>
                                            Subtotal Servicios:
                                        </td>
                                        <td style={{ padding: '6px 12px', textAlign: 'right', fontWeight: 700, color: '#0f172a', borderBottom: '1px solid #cbd5e1' }}>
                                            {formatInvoiceMoney(invoiceTotals.subtotal)}
                                        </td>
                                    </tr>
                                    <tr>
                                        <td style={{ padding: '6px 12px', fontWeight: 700, color: '#334155', borderBottom: '1px solid #cbd5e1' }}>
                                            {invoiceConfig.extraConceptDesc || 'Otros Conceptos / Gastos'}:
                                        </td>
                                        <td style={{ padding: '6px 12px', textAlign: 'right', fontWeight: 700, color: '#0f172a', borderBottom: '1px solid #cbd5e1' }}>
                                            {formatInvoiceMoney(invoiceTotals.extra)}
                                        </td>
                                    </tr>
                                    <tr style={{ background: '#eff6ff' }}>
                                        <td style={{ padding: '8px 12px', fontWeight: 800, color: '#1e3a8a', fontSize: '12px' }}>
                                            Total a Liquidar:
                                        </td>
                                        <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 900, color: '#1e3a8a', fontSize: '13px' }}>
                                            {formatInvoiceMoney(invoiceTotals.totalLiquidar)}
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>

                        {/* DATOS BANCARIOS Section */}
                        <div style={{
                            border: '1px solid #94a3b8',
                            borderRadius: '4px',
                            padding: '12px 16px',
                            background: '#f8fafc',
                            marginBottom: '16px'
                        }}>
                            <div style={{ fontSize: '11px', fontWeight: 800, color: '#1e3a8a', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                DATOS BANCARIOS PARA LIQUIDACIÓN / TRANSFERENCIA
                            </div>
                            <div style={{ fontSize: '10px', color: '#1e293b', lineHeight: 1.6 }}>
                                <div><strong style={{ color: '#334155' }}>Titular / Beneficiario:</strong> {invoiceConfig.bankHolder}</div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', maxWidth: '540px' }}>
                                    <span><strong style={{ color: '#334155' }}>Banco:</strong> {invoiceConfig.bankName}</span>
                                    <span>
                                        <strong style={{ color: '#334155' }}>Moneda:</strong> [ {invoiceConfig.currency === 'USD' ? 'X' : ' '} ] USD / [ {invoiceConfig.currency === 'ARS' ? 'X' : ' '} ] ARS
                                    </span>
                                </div>
                                <div><strong style={{ color: '#334155' }}>CBU / CVU / Routing (ABA):</strong> <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>{invoiceConfig.bankCbu}</span></div>
                                <div><strong style={{ color: '#334155' }}>Alias / SWIFT Code:</strong> <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>{invoiceConfig.bankAlias}</span></div>
                                <div><strong style={{ color: '#334155' }}>Nº de Cuenta / IBAN:</strong> <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>{invoiceConfig.bankAccountNumber}</span></div>
                            </div>
                        </div>

                        {/* Document Footer */}
                        <div style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            borderTop: '1px solid #e2e8f0',
                            paddingTop: '8px',
                            fontSize: '9px',
                            color: '#94a3b8'
                        }}>
                            <span>Documento emitido con fines informativos de liquidación. No posee validez fiscal ni impositiva formal.</span>
                            <span>Página 1 de 1</span>
                        </div>
                    </div>
                </div>
            </Modal>
        </div>
    );
}
