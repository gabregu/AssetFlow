'use client';
import React, { useState, useMemo } from 'react';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { useStore } from '../../../lib/store';
import { Search, Eye, History, Filter, ArrowUpRight } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function HistoryPage() {
    const router = useRouter();
    const { tickets, currentUser } = useStore();
    const [filter, setFilter] = useState('');
    const [sortConfig, setSortConfig] = useState({ key: 'date', direction: 'desc' });
    const [columnFilters, setColumnFilters] = useState({ requester: '' });
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
            const matchesSearch = t.subject.toLowerCase().includes(filter.toLowerCase()) ||
                t.requester.toLowerCase().includes(filter.toLowerCase()) ||
                t.id.toLowerCase().includes(filter.toLowerCase());

            const matchesRequester = !columnFilters.requester || t.requester.toLowerCase().includes(columnFilters.requester.toLowerCase());

            let matchesMonth = true;
            if (selectedMonth !== 'All') {
                const rawDate = t.deliveryCompletedDate || t.closedDate || t.date;
                const d = new Date((rawDate && !rawDate.includes('T') ? rawDate + 'T00:00:00' : rawDate));
                const ticketMonth = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
                matchesMonth = ticketMonth === selectedMonth;
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
    }, [historicalTickets, filter, sortConfig, columnFilters]);

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
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2rem' }}>
                <div>
                    <h1 style={{ fontSize: '1.8rem', fontWeight: 700, color: 'var(--text-main)' }}>Histórico de Servicios</h1>
                    <p style={{ color: 'var(--text-secondary)' }}>Repositorio de todos los casos resueltos y cerrados.</p>
                </div>
                <div style={{ padding: '0.75rem', backgroundColor: 'rgba(34, 197, 94, 0.1)', borderRadius: '50%', color: '#22c55e' }}>
                    <History size={24} />
                </div>
            </div>

            <Card className="p-0">
                <div style={{ padding: '1.5rem', borderBottom: '1px solid var(--border)' }}>
                    <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
                        <div style={{ position: 'relative', flex: 1, minWidth: '300px' }}>
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
                        <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', fontWeight: 500 }}>
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

                <div style={{ overflowX: 'auto' }}>
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
                                    onClick={() => handleSort('date')}
                                    style={{ padding: '1rem', fontWeight: 600, color: 'var(--text-secondary)', fontSize: '0.875rem', cursor: 'pointer', userSelect: 'none' }}
                                >
                                    Fecha Inicio <SortIcon column="date" />
                                </th>
                                <th style={{ padding: '1rem', fontWeight: 600, color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
                                    Estado Final
                                </th>
                                <th style={{ padding: '1rem', fontWeight: 600, color: 'var(--text-secondary)', fontSize: '0.875rem' }}>Acciones</th>
                            </tr>
                        </thead>
                        <tbody>
                            {/* Agrupar por FECHA exacta (Día) */}
                            {(() => {
                                const grouped = {};
                                sortedAndFilteredTickets.forEach(t => {
                                    // Determinar fecha de cierre/resolución
                                    const rawDate = t.deliveryCompletedDate || t.closedDate || t.date;
                                    const dateObj = new Date(rawDate);

                                    // Fallback
                                    const safeDate = isNaN(dateObj.getTime()) ? new Date() : dateObj;

                                    const key = new Date(safeDate.toISOString().split('T')[0] + 'T00:00:00').toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
                                    // Capitalizar
                                    const finalKey = key.charAt(0).toUpperCase() + key.slice(1);

                                    // Clave ordenable para ordenar los grupos (YYYY-MM-DD)
                                    const sortKey = safeDate.toISOString().split('T')[0];

                                    if (!grouped[sortKey]) grouped[sortKey] = { label: finalKey, items: [] };
                                    grouped[sortKey].items.push(t);
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
                                                        <div style={{ fontWeight: 500 }}>{ticket.subject}</div>
                                                    </td>
                                                    <td style={{ padding: '1rem' }}>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                            <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: '#e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem', fontWeight: 700 }}>
                                                                {ticket.requester.charAt(0)}
                                                            </div>
                                                            {ticket.requester}
                                                        </div>
                                                    </td>
                                                    <td style={{ padding: '1rem', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>{ticket.date}</td>
                                                    <td style={{ padding: '1rem' }}>
                                                        <Badge variant={getStatusVariant(ticket.status)}>{ticket.status}</Badge>
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
