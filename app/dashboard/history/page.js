'use client';
import React, { useState, useMemo } from 'react';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { useStore } from '../../../lib/store';
import { Search, Eye, History, Filter, ArrowUpRight } from 'lucide-react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function HistoryPage() {
    const router = useRouter();
    const { tickets, logisticsTasks, currentUser, countryFilter, getClientName } = useStore();
    const [filter, setFilter] = useState('');
    const [sortConfig, setSortConfig] = useState({ key: 'completedDate', direction: 'desc' });
    const [columnFilters, setColumnFilters] = useState({ requester: '' });

    // Helper to get local resolution/delivery completed date cleanly without timezone shifts
    const getLocalCompletedDateStr = (t) => {
        const rawDate = t.deliveryDetails?.customBillingDate || t.deliveryCompletedDate;
        if (!rawDate) return '';
        
        if (typeof rawDate === 'string') {
            const trimmed = rawDate.trim();
            // If it is YYYY-MM-DD exactly
            if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
                return trimmed;
            }
            // If it is a timestamp representing exactly 00:00:00 in UTC (which is how date-only values are saved in postgres timestamp columns)
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

    // Helper to identify service type (Entrega, Recupero, Ambos)
    const getServiceType = (ticket) => {
        const tasks = (logisticsTasks || []).filter(t => t.ticket_id === ticket.id);
        
        let hasDelivery = false;
        let hasCollection = false;
        
        // 1. Nueva arquitectura: Inspeccionar tareas relacionales y sus activos individuales
        if (tasks.length > 0) {
            tasks.forEach(t => {
                const taskMethod = String(t.method || '').toLowerCase();
                if (taskMethod === 'entrega' || taskMethod === 'delivery') hasDelivery = true;
                if (taskMethod === 'recupero' || taskMethod === 'collection' || taskMethod === 'retiro') hasCollection = true;
                
                const taskAssets = t.assets || [];
                taskAssets.forEach(asset => {
                    const assetType = String(asset.type || '').toLowerCase();
                    if (assetType === 'entrega' || assetType === 'delivery') hasDelivery = true;
                    if (assetType === 'recupero' || assetType === 'collection' || assetType === 'retiro') hasCollection = true;
                });
            });
        }
        
        // 2. Arquitectura Legacy: Inspeccionar casos consolidados y activos del ticket general
        const legacyCases = ticket.associatedCases || [];
        legacyCases.forEach(c => {
            const caseMethod = String(c.method || c.logistics?.method || '').toLowerCase();
            if (caseMethod === 'entrega' || caseMethod === 'delivery') hasDelivery = true;
            if (caseMethod === 'recupero' || caseMethod === 'collection' || caseMethod === 'retiro') hasCollection = true;
            
            const caseAssets = c.assets || [];
            caseAssets.forEach(asset => {
                const assetType = String(asset.type || '').toLowerCase();
                if (assetType === 'entrega' || assetType === 'delivery') hasDelivery = true;
                if (assetType === 'recupero' || assetType === 'collection' || assetType === 'retiro') hasCollection = true;
            });
        });

        const generalAssets = ticket.associatedAssets || ticket.associated_assets || [];
        generalAssets.forEach(asset => {
            const assetType = String(asset.type || '').toLowerCase();
            if (assetType === 'entrega' || assetType === 'delivery') hasDelivery = true;
            if (assetType === 'recupero' || assetType === 'collection' || assetType === 'retiro') hasCollection = true;
        });
        
        // 3. Fallbacks del asunto y tipo de logística
        const subject = String(ticket.subject || '').toLowerCase();
        const hasLegacyDelivery = subject.includes('provisioning') || subject.includes('entrega') || subject.includes('delivery') || ticket.logistics?.type === 'Entrega';
        const hasLegacyCollection = subject.includes('recupero') || subject.includes('retiro') || subject.includes('collection') || ticket.logistics?.type === 'Recupero';
        
        const isDelivery = hasDelivery || hasLegacyDelivery;
        const isCollection = hasCollection || hasLegacyCollection;
        
        if (isDelivery && isCollection) return 'Ambos';
        if (isCollection) return 'Recupero';
        if (isDelivery) return 'Entrega';
        return 'Entrega'; 
    };

    const [selectedMonth, setSelectedMonth] = useState('All'); // 'All' or 'YYYY-MM'

    // Restricted access? Usually history is open but let's assume same roles as tickets for now or maybe everyone?
    // User didn't specify roles, but implied it's a view for "everyone" or admins? 
    // "Similar a Servicios" suggests Admin/Adminstrativo/Gerencial

    const historicalTickets = useMemo(() => {
        // Solo casos en estado "Resuelto"
        return tickets.filter(t => t.status === 'Resuelto' || t.status === 'Cerrado' || t.status === 'Servicio Facturado' || t.status === 'Caso SFDC Cerrado');
    }, [tickets]);

    const handleSort = (key) => {
        let direction = 'asc';
        if (sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setSortConfig({ key, direction });
    };

    const sortedAndFilteredTickets = useMemo(() => {
        let result = historicalTickets.filter(t => {
            const matchesSearch = String(t.subject || '').toLowerCase().includes(filter.toLowerCase()) ||
                String(t.requester || '').toLowerCase().includes(filter.toLowerCase()) ||
                String(t.id || '').toLowerCase().includes(filter.toLowerCase());

            const matchesRequester = !columnFilters.requester || String(t.requester || '').toLowerCase().includes(columnFilters.requester.toLowerCase());

            let matchesMonth = true;
            if (selectedMonth !== 'All') {
                const localCompletedStr = getLocalCompletedDateStr(t);
                if (localCompletedStr) {
                    const [yyyy, mm] = localCompletedStr.split('-');
                    matchesMonth = `${yyyy}-${mm}` === selectedMonth;
                } else {
                    matchesMonth = false;
                }
            }

            // Filtrado por Cliente (campo explícito)
            const expectedClient = getClientName(countryFilter);
            const matchesCountry = expectedClient === 'Todos' || t.client === expectedClient;

            return matchesSearch && matchesRequester && matchesMonth && matchesCountry;
        });

        if (sortConfig.key) {
            result.sort((a, b) => {
                let valA, valB;
                if (sortConfig.key === 'completedDate') {
                    valA = getLocalCompletedDateStr(a);
                    valB = getLocalCompletedDateStr(b);
                } else {
                    valA = a[sortConfig.key] || '';
                    valB = b[sortConfig.key] || '';
                }
                if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
                if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
                return 0;
            });
        }
        return result;
    }, [historicalTickets, filter, sortConfig, columnFilters, countryFilter, getLocalCompletedDateStr]);

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
            <div style={{ marginBottom: '2rem' }} className="flex-mobile-column">
                <div>
                    <h1 style={{ fontSize: '1.8rem', fontWeight: 700, color: 'var(--text-main)' }}>Histórico de Servicios</h1>
                    <p style={{ color: 'var(--text-secondary)' }}>Repositorio de todos los casos resueltos y cerrados de cliente {countryFilter}.</p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginTop: '1rem' }} className="hide-mobile">
                    <div style={{ padding: '0.75rem', backgroundColor: 'rgba(34, 197, 94, 0.1)', borderRadius: '50%', color: '#22c55e' }}>
                        <History size={24} />
                    </div>
                </div>
            </div>

            <Card className="p-0">
                <div style={{ padding: '1.5rem', borderBottom: '1px solid var(--border)' }}>
                    <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }} className="flex-mobile-column">
                        <div style={{ position: 'relative', flex: 1, width: '100%' }}>
                            <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
                            <input
                                type="text"
                                placeholder="Buscar en el histórico..."
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
                        <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', fontWeight: 500, whiteSpace: 'nowrap' }}>
                            Total Resueltos: <span style={{ color: 'var(--text-main)', fontWeight: 700 }}>{historicalTickets.length}</span>
                        </div>
                    </div>

                    {/* Filtro de Mes */}
                    <div style={{ marginTop: '1rem', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Filtrar por Mes:</span>
                        <select
                            className="form-select"
                            style={{ width: 'auto', padding: '0.4rem 2rem 0.4rem 1rem', fontSize: '0.85rem' }}
                            value={selectedMonth}
                            onChange={(e) => setSelectedMonth(e.target.value)}
                        >
                            <option value="All">Todos los meses</option>
                            {/* Generar opciones de meses recientes (dinamicamente podriamos sacar del historial, aqui ultimos 12 meses) */}
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
                                    style={{ padding: '1rem', fontWeight: 600, color: 'var(--text-secondary)', fontSize: '0.875rem', cursor: 'pointer', userSelect: 'none' }}
                                >
                                    ID <SortIcon column="id" />
                                </th>
                                <th
                                    onClick={() => handleSort('subject')}
                                    style={{ padding: '1rem', fontWeight: 600, color: 'var(--text-secondary)', fontSize: '0.875rem', cursor: 'pointer', userSelect: 'none' }}
                                >
                                    Asunto <SortIcon column="subject" />
                                </th>
                                <th style={{ padding: '1rem', fontWeight: 600, color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                        <div onClick={() => handleSort('requester')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                                            Solicitante <SortIcon column="requester" />
                                        </div>
                                        <div style={{ position: 'relative' }}>
                                            <Filter size={14} style={{ cursor: 'pointer', color: columnFilters.requester ? 'var(--primary-color)' : 'inherit' }} />
                                            <input
                                                type="text"
                                                placeholder="Filtrar..."
                                                value={columnFilters.requester}
                                                onChange={(e) => setColumnFilters({ ...columnFilters, requester: e.target.value })}
                                                style={{
                                                    fontSize: '0.7rem',
                                                    padding: '2px 4px',
                                                    width: '80px',
                                                    marginLeft: '4px',
                                                    border: '1px solid var(--border)',
                                                    borderRadius: '4px',
                                                    backgroundColor: 'var(--background)',
                                                    color: 'var(--text-main)'
                                                }}
                                            />
                                        </div>
                                    </div>
                                </th>
                                <th
                                    onClick={() => handleSort('completedDate')}
                                    style={{ padding: '1rem', fontWeight: 600, color: 'var(--text-secondary)', fontSize: '0.875rem', cursor: 'pointer', userSelect: 'none' }}
                                >
                                    Fecha Fin <SortIcon column="completedDate" />
                                </th>
                                <th style={{ padding: '1rem', fontWeight: 600, color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
                                    Estado Servicio
                                </th>
                                <th style={{ padding: '1rem', fontWeight: 600, color: 'var(--text-secondary)', fontSize: '0.875rem' }}>Acciones</th>
                            </tr>
                        </thead>
                        <tbody>
                            {/* Agrupar por FECHA exacta (Día) */}
                            {(() => {
                                const grouped = {};
                                sortedAndFilteredTickets.forEach(t => {
                                    const localCompletedStr = getLocalCompletedDateStr(t);
                                    if (!localCompletedStr) return;
                                    
                                    const [yyyy, mm, dd] = localCompletedStr.split('-');
                                    const dateObj = new Date(parseInt(yyyy), parseInt(mm) - 1, parseInt(dd));
                                    
                                    const key = dateObj.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
                                    const finalKey = key.charAt(0).toUpperCase() + key.slice(1);

                                    if (!grouped[localCompletedStr]) grouped[localCompletedStr] = { label: finalKey, items: [] };
                                    grouped[localCompletedStr].items.push(t);
                                });

                                // Si no hay tickets
                                if (Object.keys(grouped).length === 0) {
                                    return (
                                        <tr>
                                            <td colSpan="6" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                                                <p>No se encontraron tickets en el histórico.</p>
                                            </td>
                                        </tr>
                                    );
                                }

                                // Ordenar fechas descendente (mas reciente primero)
                                return Object.entries(grouped)
                                    .sort(([keyA], [keyB]) => keyB.localeCompare(keyA))
                                    .map(([sortKey, groupData]) => (
                                        <React.Fragment key={sortKey}>
                                            <tr style={{ backgroundColor: 'var(--background-secondary)' }}>
                                                <td colSpan="6" style={{ padding: '0.75rem 1rem', fontWeight: 800, color: 'var(--text-main)', fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '0.05em', borderLeft: '4px solid var(--primary-color)' }}>
                                                    {groupData.label}
                                                </td>
                                            </tr>
                                            {groupData.items.map((ticket, index) => (
                                                <tr key={`${ticket.id}-${index}`} style={{ borderBottom: '1px solid var(--border)' }} className="table-row-hover">
                                                    <td style={{ padding: '1rem', fontWeight: 500, color: 'var(--text-secondary)' }}>{ticket.id}</td>
                                                    <td style={{ padding: '1rem' }}>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                            <div style={{ fontWeight: 500 }}>{String(ticket.subject || 'Sin Asunto')}</div>

                                                        </div>
                                                    </td>
                                                    <td style={{ padding: '1rem' }}>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                            <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: '#e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem', fontWeight: 700 }}>
                                                                {String(ticket.requester || '?').charAt(0)}
                                                            </div>
                                                            {ticket.requester || 'Sin Solicitante'}
                                                        </div>
                                                    </td>
                                                    <td style={{ padding: '1rem', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>{getLocalCompletedDateStr(ticket)}</td>
                                                    <td style={{ padding: '1rem' }}>
                                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'flex-start' }}>
                                                            <Badge variant={getStatusVariant(ticket.status)}>{ticket.status}</Badge>
                                                            {(() => {
                                                                const type = getServiceType(ticket);
                                                                let color = 'var(--text-secondary)';
                                                                let bg = 'rgba(0,0,0,0.05)';
                                                                if (type === 'Entrega') {
                                                                    color = '#22c55e';
                                                                    bg = 'rgba(34, 197, 94, 0.1)';
                                                                } else if (type === 'Recupero') {
                                                                    color = '#eab308';
                                                                    bg = 'rgba(234, 179, 8, 0.1)';
                                                                } else if (type === 'Ambos') {
                                                                    color = '#3b82f6';
                                                                    bg = 'rgba(59, 130, 246, 0.1)';
                                                                }
                                                                return (
                                                                    <span style={{ 
                                                                        fontSize: '0.7rem', 
                                                                        fontWeight: 700, 
                                                                        padding: '2px 6px', 
                                                                        borderRadius: '4px', 
                                                                        color: color, 
                                                                        backgroundColor: bg,
                                                                        textTransform: 'uppercase',
                                                                        letterSpacing: '0.02em'
                                                                    }}>
                                                                        {type}
                                                                    </span>
                                                                );
                                                            })()}
                                                        </div>
                                                    </td>
                                                    <td style={{ padding: '1rem' }}>
                                                        <Link href={`/dashboard/tickets/${ticket.id}`}>
                                                            <Button variant="ghost" size="sm" icon={Eye}>Ver Detalle</Button>
                                                        </Link>
                                                    </td>
                                                </tr>
                                            ))}
                                        </React.Fragment>
                                    ));
                            })()}
                        </tbody>
                    </table>
                </div>
            </Card>
        </div>
    );
}
