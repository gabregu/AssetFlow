'use client';
import React, { useState, useMemo } from 'react';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { useStore } from '../../../lib/store';
import { Search, Eye, FileText, Filter, ArrowUpRight, Download, BarChart3, TrendingUp } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { generateTicketPDF } from '../../../lib/pdf-generator';

export default function ReportsPage() {
    const router = useRouter();
    const { tickets, assets, currentUser, countryFilter, getClientName, logisticsTasks } = useStore();
    const [filter, setFilter] = useState('');
    const [sortConfig, setSortConfig] = useState({ key: 'date', direction: 'desc' });
    const [columnFilters, setColumnFilters] = useState({ requester: '' });

    // Default to current month
    const now = new Date();
    const currentMonthValue = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const [selectedMonth, setSelectedMonth] = useState(currentMonthValue);

    // Manejar apertura de POD consolidando datos de tareas y conductor
    const handleOpenPOD = (ticket) => {
        const tasks = (logisticsTasks || []).filter(t => t.ticket_id === ticket.id);
        
        let mergedAssets = [...(ticket.associatedAssets || []), ...(ticket.associated_assets || [])];
        let mergedAccessories = { ...(ticket.accessories || {}) };
        let mergedYubikeys = [...(ticket.yubikeys || [])];
        let driverName = ticket.logistics?.deliveryPerson || ticket.logistics?.delivery_person || ticket.delivery_person || '';
        let di = ticket.logistics?.deliveryInfo || ticket.logistics?.delivery_info || ticket.deliveryDetails || {};
        let address = ticket.logistics?.address || '';
        let phone = ticket.logistics?.phone || '';
        let trackingNumber = ticket.logistics?.trackingNumber || '';

        if (tasks.length > 0) {
            tasks.forEach(task => {
                if (task.assets && Array.isArray(task.assets)) {
                    task.assets.forEach(a => mergedAssets.push(a));
                }
                if (task.accessories) {
                    mergedAccessories = { ...mergedAccessories, ...task.accessories };
                }
                if (task.yubikeys && Array.isArray(task.yubikeys)) {
                    task.yubikeys.forEach(y => mergedYubikeys.push(y));
                }
                if (!driverName && (task.deliveryPerson || task.delivery_person)) {
                    driverName = task.deliveryPerson || task.delivery_person;
                }
                const taskDi = task.deliveryInfo || task.delivery_info;
                if (taskDi && (taskDi.receivedBy || taskDi.dni || taskDi.deliveredAt || taskDi.actualTime)) {
                    di = { ...di, ...taskDi };
                }
                if (!address && task.address) address = task.address;
                if (!phone && task.phone) phone = task.phone;
                if (!trackingNumber && task.trackingNumber) trackingNumber = task.trackingNumber;
            });
        }

        const consolidatedTicket = {
            ...ticket,
            associatedAssets: mergedAssets,
            accessories: mergedAccessories,
            yubikeys: mergedYubikeys,
            logistics: {
                ...(ticket.logistics || {}),
                deliveryPerson: driverName || ticket.logistics?.deliveryPerson,
                address: address || ticket.logistics?.address,
                phone: phone || ticket.logistics?.phone,
                trackingNumber: trackingNumber || ticket.logistics?.trackingNumber,
                deliveryInfo: di
            }
        };

        generateTicketPDF(consolidatedTicket, assets, di, 'view');
    };

    // Helper to get local resolution/delivery completed date cleanly without timezone shifts
    const getLocalCompletedDateStr = (rawDate) => {
        if (!rawDate) return '';
        if (typeof rawDate === 'string') {
            const trimmed = rawDate.trim();
            if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
                return trimmed;
            }
            if (/^\d{4}-\d{2}-\d{2}T00:00:00/.test(trimmed) || trimmed.includes('00:00:00.000') || trimmed.includes('00:00:00+00') || trimmed.includes('00:00:00Z')) {
                return trimmed.substring(0, 10);
            }
        }
        const dateObj = new Date(rawDate);
        if (isNaN(dateObj.getTime())) return '';
        const yyyy = dateObj.getFullYear();
        const mm = String(dateObj.getMonth() + 1).padStart(2, '0');
        const dd = String(dateObj.getDate()).padStart(2, '0');
        return `${yyyy}-${mm}-${dd}`;
    };

    // Filtrar casos que son de interés para "Informes" (por ahora igual que histórico)
    const informativeTickets = useMemo(() => {
        const expectedClient = getClientName(countryFilter);
        return tickets.filter(t => 
            (t.client === expectedClient) && 
            (t.status === 'Resuelto' || t.status === 'Cerrado' || t.status === 'Servicio Facturado' || t.status === 'Caso SFDC Cerrado')
        );
    }, [tickets, countryFilter]);

    const handleSort = (key) => {
        let direction = 'asc';
        if (sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setSortConfig({ key, direction });
    };

    const sortedAndFilteredTickets = useMemo(() => {
        let result = informativeTickets.filter(t => {
            const matchesSearch = t.subject.toLowerCase().includes(filter.toLowerCase()) ||
                t.requester.toLowerCase().includes(filter.toLowerCase()) ||
                t.id.toLowerCase().includes(filter.toLowerCase());

            const matchesRequester = !columnFilters.requester || t.requester.toLowerCase().includes(columnFilters.requester.toLowerCase());

            let matchesMonth = true;
            if (selectedMonth !== 'All') {
                const rawDate = t.deliveryDetails?.customBillingDate || t.deliveryCompletedDate;
                const localStr = getLocalCompletedDateStr(rawDate);
                if (localStr) {
                    const [yyyy, mm] = localStr.split('-');
                    matchesMonth = `${yyyy}-${mm}` === selectedMonth;
                } else {
                    matchesMonth = false;
                }
            }

            return matchesSearch && matchesRequester && matchesMonth;
        });

        if (sortConfig.key) {
            result.sort((a, b) => {
                const valA = a[sortConfig.key] || '';
                const valB = b[sortConfig.key] || '';
                if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
                if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
                return 0;
            });
        }
        return result;
    }, [informativeTickets, filter, sortConfig, columnFilters, selectedMonth]);

    // Category breakdown for selected month
    const monthlyBreakdown = useMemo(() => {
        const ticketsInPeriod = informativeTickets.filter(t => {
            if (selectedMonth === 'All') return true;
            const rawDate = t.deliveryDetails?.customBillingDate || t.deliveryCompletedDate;
            const localStr = getLocalCompletedDateStr(rawDate);
            if (!localStr) return false;
            const [yyyy, mm] = localStr.split('-');
            return `${yyyy}-${mm}` === selectedMonth;
        });

        let newHire = 0, collection = 0, delivery = 0;
        ticketsInPeriod.forEach(t => {
            const subject = (t.subject || '').toLowerCase();
            if (subject.includes('new hire')) {
                newHire++;
            } else if (
                subject.includes('collection') ||
                subject.includes('offboarding') ||
                subject.includes('recupero')
            ) {
                collection++;
            } else {
                delivery++;
            }
        });
        return { newHire, collection, delivery, total: ticketsInPeriod.length };
    }, [informativeTickets, selectedMonth]);

    const getStatusVariant = (status) => {
        switch (status) {
            case 'Resuelto': return 'success';
            case 'Cerrado': return 'success';
            case 'Caso SFDC Cerrado': return 'success';
            case 'Servicio Facturado': return 'info';
            default: return 'default';
        }
    };

    const SortIcon = ({ column }) => {
        if (sortConfig.key !== column) return <span style={{ opacity: 0.3, marginLeft: '4px' }}>↕</span>;
        return <span style={{ marginLeft: '4px', color: 'var(--primary-color)' }}>{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>;
    };

    return (
        <div style={{ animation: 'fadeIn 0.5s ease-out' }}>
            <div className="flex-mobile-column" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2rem', gap: '1rem' }}>
                <div>
                    <h1 style={{ fontSize: '1.8rem', fontWeight: 700, color: 'var(--text-main)' }}>Informes de Gestión</h1>
                    <p style={{ color: 'var(--text-secondary)' }}>Análisis y reporte detallado de servicios finalizados.</p>
                </div>
                <div style={{ padding: '0.75rem', backgroundColor: 'rgba(59, 130, 246, 0.1)', borderRadius: '50%', color: '#3b82f6' }}>
                    <BarChart3 size={24} />
                </div>
            </div>

            {/* Summary Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
                {/* New Hire */}
                <Card style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.5rem', borderTop: '3px solid #3b82f6' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600, margin: 0, textTransform: 'uppercase', letterSpacing: '0.04em' }}>New Hire</p>
                        <div style={{ padding: '0.4rem', background: 'rgba(59,130,246,.12)', borderRadius: '8px' }}>
                            <FileText size={15} color="#3b82f6" />
                        </div>
                    </div>
                    <h2 style={{ fontSize: '2.2rem', fontWeight: 800, margin: 0, color: '#3b82f6' }}>{monthlyBreakdown.newHire}</h2>
                    <p style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', margin: 0 }}>Incorporaciones del período</p>
                </Card>

                {/* Collection */}
                <Card style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.5rem', borderTop: '3px solid #f59e0b' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600, margin: 0, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Collection</p>
                        <div style={{ padding: '0.4rem', background: 'rgba(245,158,11,.12)', borderRadius: '8px' }}>
                            <ArrowUpRight size={15} color="#f59e0b" />
                        </div>
                    </div>
                    <h2 style={{ fontSize: '2.2rem', fontWeight: 800, margin: 0, color: '#f59e0b' }}>{monthlyBreakdown.collection}</h2>
                    <p style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', margin: 0 }}>Collection / Offboarding / Recupero</p>
                </Card>

                {/* Delivery */}
                <Card style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.5rem', borderTop: '3px solid #22c55e' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600, margin: 0, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Delivery</p>
                        <div style={{ padding: '0.4rem', background: 'rgba(34,197,94,.12)', borderRadius: '8px' }}>
                            <TrendingUp size={15} color="#22c55e" />
                        </div>
                    </div>
                    <h2 style={{ fontSize: '2.2rem', fontWeight: 800, margin: 0, color: '#22c55e' }}>{monthlyBreakdown.delivery}</h2>
                    <p style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', margin: 0 }}>Resto de servicios</p>
                </Card>

                {/* Total */}
                <Card style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.5rem', background: 'var(--primary-color)', color: 'white' }}>
                    <p style={{ fontSize: '0.8rem', opacity: 0.85, fontWeight: 600, margin: 0, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Total del Período</p>
                    <h2 style={{ fontSize: '2.2rem', fontWeight: 800, margin: 0 }}>{monthlyBreakdown.total}</h2>
                    <p style={{ fontSize: '0.72rem', opacity: 0.75, margin: 0 }}>Servicios completados</p>
                </Card>
            </div>

            <Card className="p-0">
                <div style={{ padding: '1.5rem', borderBottom: '1px solid var(--border)' }}>
                    <div className="flex-mobile-column" style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                        <div style={{ position: 'relative', flex: 1, width: '100%', minWidth: 'min(300px, 100%)' }}>
                            <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
                            <input
                                type="text"
                                placeholder="Buscar en informes..."
                                value={filter}
                                onChange={(e) => setFilter(e.target.value)}
                                style={{
                                    width: '100%',
                                    padding: '0.6rem 1rem 0.6rem 2.5rem',
                                    borderRadius: 'var(--radius-md)',
                                    border: '1px solid var(--border)',
                                    outline: 'none',
                                    backgroundColor: 'var(--background)',
                                    color: 'var(--text-main)'
                                }}
                            />
                        </div>
                        <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', fontWeight: 500 }}>
                            Total Casos: <span style={{ color: 'var(--text-main)', fontWeight: 700 }}>{informativeTickets.length}</span>
                        </div>
                    </div>

                    {/* Filtro de Mes */}
                    <div style={{ marginTop: '1rem', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Período:</span>
                        <select
                            className="form-select"
                            style={{ width: 'auto', padding: '0.4rem 2rem 0.4rem 1rem', fontSize: '0.85rem' }}
                            value={selectedMonth}
                            onChange={(e) => setSelectedMonth(e.target.value)}
                        >
                            <option value="All">Todos los meses</option>
                            {(() => {
                                const options = [];
                                const today = new Date();
                                for (let i = 0; i < 12; i++) {
                                    const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
                                    const val = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
                                    const label = d.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
                                    options.push(<option key={val} value={val}>{label.charAt(0).toUpperCase() + label.slice(1)}</option>);
                                }
                                return options;
                            })()}
                        </select>
                    </div>
                </div>

                <div className="table-responsive">
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                        <thead>
                            <tr style={{ borderBottom: '1px solid var(--border)', backgroundColor: 'var(--background-secondary)' }}>
                                <th
                                    onClick={() => handleSort('id')}
                                    style={{ padding: '1rem', fontWeight: 600, color: 'var(--text-secondary)', fontSize: '0.85rem', cursor: 'pointer', userSelect: 'none' }}
                                >
                                    Nº SERVICIO <SortIcon column="id" />
                                </th>
                                <th
                                    onClick={() => handleSort('subject')}
                                    style={{ padding: '1rem', fontWeight: 600, color: 'var(--text-secondary)', fontSize: '0.85rem', cursor: 'pointer', userSelect: 'none' }}
                                >
                                    DESCRIPCIÓN <SortIcon column="subject" />
                                </th>
                                <th style={{ padding: '1rem', fontWeight: 600, color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                                    EMPLEADO
                                </th>
                                <th style={{ padding: '1rem', fontWeight: 600, color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                                    TIPO
                                </th>
                                <th style={{ padding: '1rem', fontWeight: 600, color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                                    CASO SYCOMP
                                </th>
                                <th
                                    onClick={() => handleSort('date')}
                                    style={{ padding: '1rem', fontWeight: 600, color: 'var(--text-secondary)', fontSize: '0.85rem', cursor: 'pointer' }}
                                >
                                    DÍA SERVICIO <SortIcon column="date" />
                                </th>
                                <th style={{ padding: '1rem', fontWeight: 600, color: 'var(--text-secondary)', fontSize: '0.85rem', textAlign: 'right' }}>ACCIONES</th>
                            </tr>
                        </thead>
                        <tbody>
                            {sortedAndFilteredTickets.length === 0 ? (
                                <tr>
                                    <td colSpan="7" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                                        <p>No se encontraron datos para generar informes con los criterios actuales.</p>
                                    </td>
                                </tr>
                            ) : (
                                sortedAndFilteredTickets.map((ticket, index) => {
                                    const subject = (ticket.subject || '').toLowerCase();
                                    const isCollection =
                                        subject.includes('collection') ||
                                        subject.includes('offboarding') ||
                                        subject.includes('recupero') ||
                                        subject.includes('retiro') ||
                                        ticket.logistics?.type === 'Recupero';
                                    const isNewHire = subject.includes('new hire');
                                    const badgeVariant = isNewHire ? 'info' : isCollection ? 'warning' : 'success';
                                    const badgeLabel = isNewHire ? 'NEW HIRE' : isCollection ? 'COLLECTION' : 'DELIVERY';

                                    return (
                                        <tr key={`${ticket.id}-${index}`} style={{ borderBottom: '1px solid var(--border)' }} className="table-row-hover">
                                            <td style={{ padding: '0.65rem 1rem', fontWeight: 600, color: 'var(--text-main)', fontSize: '0.875rem' }}>{ticket.id}</td>
                                            <td style={{ padding: '0.65rem 1rem' }}>
                                                <div style={{ fontWeight: 500, fontSize: '0.85rem' }}>{ticket.subject}</div>
                                            </td>
                                            <td style={{ padding: '0.65rem 1rem' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem' }}>
                                                    <div style={{ width: '22px', height: '22px', borderRadius: '50%', background: 'rgba(59,130,246,0.1)', color: '#3b82f6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.65rem', fontWeight: 700, flexShrink: 0 }}>
                                                        {(ticket.requester || '?').charAt(0)}
                                                    </div>
                                                    {ticket.requester}
                                                </div>
                                            </td>
                                            <td style={{ padding: '0.65rem 1rem' }}>
                                                <Badge variant={badgeVariant} style={{ fontSize: '0.68rem' }}>
                                                    {badgeLabel}
                                                </Badge>
                                            </td>
                                            <td style={{ padding: '0.65rem 1rem', fontFamily: 'monospace', fontWeight: 600, color: 'var(--text-main)', fontSize: '0.82rem' }}>
                                                {ticket.logistics?.additionalCase || ticket.id_sf || 'N/A'}
                                            </td>
                                            <td style={{ padding: '0.65rem 1rem', color: 'var(--text-secondary)', fontSize: '0.82rem' }}>
                                                {ticket.date}
                                            </td>
                                            <td style={{ padding: '0.65rem 1rem', textAlign: 'right' }}>
                                                <div style={{ display: 'flex', gap: '0.25rem', justifyContent: 'flex-end' }}>
                                                    <Link href={`/dashboard/reports/${ticket.id}`}>
                                                        <Button variant="ghost" size="sm" icon={Eye} title="Ver Detalle" />
                                                    </Link>
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        title="Ver POD (Proof of Delivery)"
                                                        onClick={() => handleOpenPOD(ticket)}
                                                        style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--text-secondary)' }}
                                                    >
                                                        POD
                                                    </Button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </Card>
        </div>
    );
}
