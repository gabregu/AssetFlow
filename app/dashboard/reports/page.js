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
    const { tickets, assets, currentUser } = useStore();
    const [filter, setFilter] = useState('');
    const [sortConfig, setSortConfig] = useState({ key: 'date', direction: 'desc' });
    const [columnFilters, setColumnFilters] = useState({ requester: '' });
    const [selectedMonth, setSelectedMonth] = useState('All'); // 'All' or 'YYYY-MM'

    // Filtrar casos que son de interés para "Informes" (por ahora igual que histórico)
    const informativeTickets = useMemo(() => {
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
        let result = informativeTickets.filter(t => {
            const matchesSearch = t.subject.toLowerCase().includes(filter.toLowerCase()) ||
                t.requester.toLowerCase().includes(filter.toLowerCase()) ||
                t.id.toLowerCase().includes(filter.toLowerCase());

            const matchesRequester = !columnFilters.requester || t.requester.toLowerCase().includes(columnFilters.requester.toLowerCase());

            let matchesMonth = true;
            if (selectedMonth !== 'All') {
                const rawDate = t.deliveryCompletedDate || t.closedDate || t.date;
                const d = new Date(rawDate);
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
    }, [informativeTickets, filter, sortConfig, columnFilters, selectedMonth]);

    // Graph Data Calculation
    const graphData = useMemo(() => {
        const data = {};
        if (selectedMonth === 'All') {
            // Last 6 months
            const today = new Date();
            for (let i = 5; i >= 0; i--) {
                const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
                const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
                const label = d.toLocaleDateString('es-ES', { month: 'short' }).replace('.', '');
                data[key] = { label, count: 0 };
            }
            informativeTickets.forEach(t => {
                const rawDate = t.deliveryCompletedDate || t.closedDate || t.date;
                const d = new Date(rawDate);
                const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
                if (data[key]) data[key].count++;
            });
        } else {
            // Days of the selected month
            const [year, month] = selectedMonth.split('-').map(Number);
            const daysInMonth = new Date(year, month, 0).getDate();
            for (let i = 1; i <= daysInMonth; i++) {
                const key = i;
                data[key] = { label: i.toString(), count: 0 };
            }
            informativeTickets.forEach(t => {
                const rawDate = t.deliveryCompletedDate || t.closedDate || t.date;
                const d = new Date(rawDate);
                const ticketMonth = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
                if (ticketMonth === selectedMonth) {
                    const day = d.getDate();
                    if (data[day]) data[day].count++;
                }
            });
        }
        return Object.values(data);
    }, [informativeTickets, selectedMonth]);

    const maxCount = Math.max(...graphData.map(d => d.count), 1);

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
                    <h1 style={{ fontSize: '1.8rem', fontWeight: 700, color: 'var(--text-main)' }}>Informes de Gestión</h1>
                    <p style={{ color: 'var(--text-secondary)' }}>Análisis y reporte detallado de servicios finalizados.</p>
                </div>
                <div style={{ padding: '0.75rem', backgroundColor: 'rgba(59, 130, 246, 0.1)', borderRadius: '50%', color: '#3b82f6' }}>
                    <BarChart3 size={24} />
                </div>
            </div>

            {/* Stats Graphic Area */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: '1.5rem', marginBottom: '1.5rem' }}>
                <Card style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                        <h3 style={{ fontSize: '0.9rem', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <TrendingUp size={16} color="var(--primary-color)" /> Volumen de Casos {selectedMonth === 'All' ? '(Últimos 6 meses)' : `en ${selectedMonth}`}
                        </h3>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'flex-end', gap: '0.75rem', height: '140px', paddingBottom: '20px', position: 'relative' }}>
                        {graphData.map((d, i) => (
                            <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem', height: '100%', justifyContent: 'flex-end' }}>
                                <div style={{
                                    width: '100%',
                                    height: `${(d.count / maxCount) * 100}%`,
                                    background: 'linear-gradient(to top, var(--primary-color), #60a5fa)',
                                    borderRadius: '4px 4px 2px 2px',
                                    transition: 'height 0.5s ease-out',
                                    minHeight: d.count > 0 ? '4px' : '0'
                                }} title={`${d.count} casos`} />
                                <span style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', fontWeight: 600 }}>{d.label}</span>
                            </div>
                        ))}
                    </div>
                </Card>

                <Card style={{ padding: '1.5rem', background: 'var(--primary-color)', color: 'white', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', textAlign: 'center' }}>
                    <p style={{ fontSize: '0.85rem', opacity: 0.9, marginBottom: '0.5rem', fontWeight: 600 }}>Total en el período</p>
                    <h2 style={{ fontSize: '3rem', fontWeight: 800, margin: 0 }}>{sortedAndFilteredTickets.length}</h2>
                    <p style={{ fontSize: '0.75rem', opacity: 0.8, marginTop: '0.5rem' }}>Servicios Completados</p>
                </Card>
            </div>

            <Card className="p-0">
                <div style={{ padding: '1.5rem', borderBottom: '1px solid var(--border)' }}>
                    <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
                        <div style={{ position: 'relative', flex: 1, minWidth: '300px' }}>
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

                <div style={{ overflowX: 'auto' }}>
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
                            {(() => {
                                const grouped = {};
                                sortedAndFilteredTickets.forEach(t => {
                                    const rawDate = t.deliveryCompletedDate || t.closedDate || t.date;
                                    const dateObj = new Date(rawDate);
                                    const safeDate = isNaN(dateObj.getTime()) ? new Date() : dateObj;
                                    const key = safeDate.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
                                    const finalKey = key.charAt(0).toUpperCase() + key.slice(1);
                                    const sortKey = safeDate.toISOString().split('T')[0];

                                    if (!grouped[sortKey]) grouped[sortKey] = { label: finalKey, items: [] };
                                    grouped[sortKey].items.push(t);
                                });

                                if (Object.keys(grouped).length === 0) {
                                    return (
                                        <tr>
                                            <td colSpan="7" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                                                <p>No se encontraron datos para generar informes con los criterios actuales.</p>
                                            </td>
                                        </tr>
                                    );
                                }

                                return Object.entries(grouped)
                                    .sort(([keyA], [keyB]) => keyB.localeCompare(keyA))
                                    .map(([sortKey, groupData]) => (
                                        <React.Fragment key={sortKey}>
                                            <tr style={{ backgroundColor: 'var(--background-secondary)' }}>
                                                <td colSpan="7" style={{ padding: '0.6rem 1rem', fontWeight: 800, color: 'var(--text-main)', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em', borderLeft: '4px solid #3b82f6' }}>
                                                    {groupData.label}
                                                </td>
                                            </tr>
                                            {groupData.items.map((ticket, index) => {
                                                // Determine Type
                                                const isCollection = ticket.subject.toLowerCase().includes('recupero') || ticket.subject.toLowerCase().includes('retiro') || ticket.logistics?.type === 'Recupero';

                                                return (
                                                    <tr key={`${ticket.id}-${index}`} style={{ borderBottom: '1px solid var(--border)' }} className="table-row-hover">
                                                        <td style={{ padding: '1rem', fontWeight: 600, color: 'var(--text-main)', fontSize: '0.9rem' }}>{ticket.id}</td>
                                                        <td style={{ padding: '1rem' }}>
                                                            <div style={{ fontWeight: 500, fontSize: '0.875rem' }}>{ticket.subject}</div>
                                                        </td>
                                                        <td style={{ padding: '1rem' }}>
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem' }}>
                                                                <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem', fontWeight: 700 }}>
                                                                    {ticket.requester.charAt(0)}
                                                                </div>
                                                                {ticket.requester}
                                                            </div>
                                                        </td>
                                                        <td style={{ padding: '1rem' }}>
                                                            <Badge variant={isCollection ? 'warning' : 'success'} style={{ fontSize: '0.7rem' }}>
                                                                {isCollection ? 'RECOLECCIÓN' : 'ENTREGA'}
                                                            </Badge>
                                                        </td>
                                                        <td style={{ padding: '1rem', fontFamily: 'monospace', fontWeight: 600, color: 'var(--text-main)', fontSize: '0.85rem' }}>
                                                            {ticket.logistics?.additionalCase || ticket.id_sf || 'N/A'}
                                                        </td>
                                                        <td style={{ padding: '1rem', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                                                            {ticket.date}
                                                        </td>
                                                        <td style={{ padding: '1rem', textAlign: 'right' }}>
                                                            <div style={{ display: 'flex', gap: '0.25rem', justifyContent: 'flex-end' }}>
                                                                <Link href={`/dashboard/reports/${ticket.id}`}>
                                                                    <Button variant="ghost" size="sm" icon={Eye} title="Ver Detalle" />
                                                                </Link>
                                                                <Button
                                                                    variant="ghost"
                                                                    size="sm"
                                                                    icon={Download}
                                                                    title="Descargar Remito"
                                                                    onClick={() => generateTicketPDF(ticket, assets)}
                                                                />
                                                            </div>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
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
