"use client";
import React, { useState } from 'react';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Modal } from '../../components/ui/Modal';
import { useStore } from '../../../lib/store';
import { Plus, Filter, Search, Eye, Trash2, Archive, AlertCircle, Clock, CheckCircle2, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function TicketsPage() {
    const router = useRouter();
    const { tickets, addTicket, deleteTickets, currentUser } = useStore();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [newTicket, setNewTicket] = useState({ subject: '', requester: '', priority: 'Media', status: 'Abierto' });
    const [filter, setFilter] = useState('');
    const [sortConfig, setSortConfig] = useState({ key: 'date', direction: 'desc' });
    const [columnFilters, setColumnFilters] = useState({ status: 'All', requester: '' });
    const [showStatusFilter, setShowStatusFilter] = useState(false);
    const [selectedTickets, setSelectedTickets] = useState([]);

    const isAdmin = currentUser?.role === 'admin';

    const handleSelectAll = (e) => {
        if (e.target.checked) {
            setSelectedTickets(sortedAndFilteredTickets.map(t => t.id));
        } else {
            setSelectedTickets([]);
        }
    };

    const handleSelectOne = (id) => {
        setSelectedTickets(prev =>
            prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
        );
    };

    const handleBulkDelete = () => {
        if (confirm(`¿Estás seguro de que deseas eliminar ${selectedTickets.length} tickets seleccionados?`)) {
            deleteTickets(selectedTickets);
            setSelectedTickets([]);
        }
    };

    const handleCreate = (e) => {
        e.preventDefault();
        const createdTicket = addTicket(newTicket);
        setIsModalOpen(false);
        setNewTicket({ subject: '', requester: '', priority: 'Media', status: 'Abierto' });
        // Navegación automática
        router.push(`/dashboard/tickets/${createdTicket.id}`);
    };

    const handleSort = (key) => {
        let direction = 'asc';
        if (sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setSortConfig({ key, direction });
    };

    const sortedAndFilteredTickets = React.useMemo(() => {
        // ... (existing filter/sort logic remains same)
        let result = tickets.filter(t => {
            const matchesSearch = t.subject.toLowerCase().includes(filter.toLowerCase()) ||
                t.requester.toLowerCase().includes(filter.toLowerCase()) ||
                t.id.toLowerCase().includes(filter.toLowerCase());

            const matchesStatus = columnFilters.status === 'All' || t.status === columnFilters.status;
            const matchesRequester = !columnFilters.requester || t.requester.toLowerCase().includes(columnFilters.requester.toLowerCase());

            // Excluir Resueltos de esta vista
            const isNotResolved = t.status !== 'Resuelto' && t.status !== 'Cerrado' && t.status !== 'Servicio Facturado' && t.status !== 'Caso SFDC Cerrado';

            return matchesSearch && matchesStatus && matchesRequester && isNotResolved;
        });

        if (sortConfig.key) {
            result.sort((a, b) => {
                const valA = a[sortConfig.key] || '';
                const valB = b[sortConfig.key] || '';
                if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
                if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
                if (sortConfig.key !== 'requester') {
                    const reqA = a.requester || '';
                    const reqB = b.requester || '';
                    if (reqA < reqB) return -1;
                    if (reqA > reqB) return 1;
                }
                return 0;
            });
        }
        return result;
    }, [tickets, filter, sortConfig, columnFilters]);

    // Estadísticas para las tarjetas KPI
    const stats = React.useMemo(() => {
        return {
            total: tickets.filter(t => t.status !== 'Resuelto' && t.status !== 'Cerrado' && t.status !== 'Servicio Facturado' && t.status !== 'Caso SFDC Cerrado').length,
            abiertos: tickets.filter(t => t.status === 'Abierto').length,
            enProgreso: tickets.filter(t => t.status === 'En Progreso').length,
            pendientes: tickets.filter(t => t.status === 'Pendiente').length
        };
    }, [tickets]);

    const getStatusVariant = (status) => {
        switch (status) {
            case 'Abierto': return 'danger';
            case 'En Progreso': return 'info';
            case 'Resuelto': return 'success';
            case 'Pendiente': return 'warning';
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
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2rem' }}>
                <div>
                    <h1 style={{ fontSize: '1.8rem', fontWeight: 700, color: 'var(--text-main)' }}>Gestión de Servicios</h1>
                    <p style={{ color: 'var(--text-secondary)' }}>Gestiona y resuelve las incidencias reportadas.</p>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.75rem' }}>
                    <Button icon={Plus} onClick={() => setIsModalOpen(true)}>Nuevo Ticket</Button>
                    {isAdmin && selectedTickets.length > 0 && (
                        <Button
                            variant="secondary"
                            size="sm"
                            icon={Trash2}
                            style={{ color: '#ef4444', borderColor: '#ef4444' }}
                            onClick={handleBulkDelete}
                        >
                            Eliminar ({selectedTickets.length})
                        </Button>
                    )}
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1.5rem', marginBottom: '2.5rem' }}>
                <Card
                    className="p-4 clickable-card"
                    style={{
                        borderLeft: '4px solid var(--primary-color)',
                        cursor: 'pointer',
                        backgroundColor: columnFilters.status === 'All' ? 'rgba(37, 99, 235, 0.1)' : 'var(--surface)',
                        transition: 'all 0.2s ease',
                        boxShadow: columnFilters.status === 'All' ? 'inset 0 0 0 1px var(--primary-color), var(--shadow-sm)' : 'var(--shadow-sm)'
                    }}
                    onClick={() => setColumnFilters({ ...columnFilters, status: 'All' })}
                >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <div style={{ padding: '0.75rem', backgroundColor: 'var(--background)', borderRadius: '50%', color: 'var(--primary-color)' }}>
                            <Archive size={24} />
                        </div>
                        <div>
                            <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>Todos</p>
                            <h3 style={{ fontSize: '1.5rem', fontWeight: 700, margin: 0 }}>{stats.total}</h3>
                        </div>
                    </div>
                </Card>
                <Card
                    className="p-4 clickable-card"
                    style={{
                        borderLeft: '4px solid #ef4444',
                        cursor: 'pointer',
                        backgroundColor: columnFilters.status === 'Abierto' ? 'rgba(239, 68, 68, 0.1)' : 'var(--surface)',
                        transition: 'all 0.2s ease',
                        boxShadow: columnFilters.status === 'Abierto' ? 'inset 0 0 0 1px #ef4444, var(--shadow-sm)' : 'var(--shadow-sm)'
                    }}
                    onClick={() => setColumnFilters({ ...columnFilters, status: 'Abierto' })}
                >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <div style={{ padding: '0.75rem', backgroundColor: '#fef2f2', borderRadius: '50%', color: '#ef4444' }}>
                            <AlertCircle size={24} />
                        </div>
                        <div>
                            <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>Abiertos</p>
                            <h3 style={{ fontSize: '1.5rem', fontWeight: 700, margin: 0 }}>{stats.abiertos}</h3>
                        </div>
                    </div>
                </Card>
                <Card
                    className="p-4 clickable-card"
                    style={{
                        borderLeft: '4px solid #eab308',
                        cursor: 'pointer',
                        backgroundColor: columnFilters.status === 'En Progreso' ? 'rgba(234, 179, 8, 0.1)' : 'var(--surface)',
                        transition: 'all 0.2s ease',
                        boxShadow: columnFilters.status === 'En Progreso' ? 'inset 0 0 0 1px #eab308, var(--shadow-sm)' : 'var(--shadow-sm)'
                    }}
                    onClick={() => setColumnFilters({ ...columnFilters, status: 'En Progreso' })}
                >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <div style={{ padding: '0.75rem', backgroundColor: '#fffbeb', borderRadius: '50%', color: '#eab308' }}>
                            <Loader2 size={24} className={columnFilters.status === 'En Progreso' ? 'animate-spin' : ''} />
                        </div>
                        <div>
                            <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>En Progreso</p>
                            <h3 style={{ fontSize: '1.5rem', fontWeight: 700, margin: 0 }}>{stats.enProgreso}</h3>
                        </div>
                    </div>
                </Card>

            </div>

            <Card>
                <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
                    <div style={{ position: 'relative', flex: 1, minWidth: '300px' }}>
                        <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
                        <input
                            type="text"
                            placeholder="Buscar tickets..."
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
                    {(columnFilters.status !== 'All' || columnFilters.requester !== '' || filter !== '') && (
                        <Button variant="ghost" size="sm" onClick={() => {
                            setColumnFilters({ status: 'All', requester: '' });
                            setFilter('');
                        }}>Limpiar Filtros</Button>
                    )}
                </div>

                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                        <thead>
                            <tr style={{ borderBottom: '1px solid var(--border)' }}>
                                {isAdmin && (
                                    <th style={{ padding: '1rem', width: '40px' }}>
                                    </th>
                                )}
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
                                    Fecha <SortIcon column="date" />
                                </th>
                                <th style={{ padding: '1rem', fontWeight: 600, color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                        <div onClick={() => handleSort('status')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                                            Estado <SortIcon column="status" />
                                        </div>
                                        <select
                                            value={columnFilters.status}
                                            onChange={(e) => setColumnFilters({ ...columnFilters, status: e.target.value })}
                                            style={{
                                                fontSize: '0.75rem',
                                                padding: '2px',
                                                border: '1px solid var(--border)',
                                                borderRadius: '4px',
                                                backgroundColor: 'var(--background)',
                                                color: 'var(--text-main)',
                                                cursor: 'pointer'
                                            }}
                                        >
                                            <option value="All">Todos</option>
                                            <option value="Abierto">Abierto</option>
                                            <option value="En Progreso">En Progreso</option>
                                            <option value="Pendiente">Pendiente</option>
                                        </select>
                                    </div>
                                </th>
                                <th style={{ padding: '1rem', fontWeight: 600, color: 'var(--text-secondary)', fontSize: '0.875rem' }}>Acciones</th>
                            </tr>
                        </thead>
                        <tbody>
                            {sortedAndFilteredTickets.map((ticket, index) => (
                                <tr key={`${ticket.id}-${index}`} style={{ borderBottom: '1px solid var(--border)' }} className="table-row-hover">
                                    {isAdmin && (
                                        <td style={{ padding: '1rem' }}>
                                            <input
                                                type="checkbox"
                                                checked={selectedTickets.includes(ticket.id)}
                                                onChange={() => handleSelectOne(ticket.id)}
                                                style={{ cursor: 'pointer', width: '16px', height: '16px' }}
                                            />
                                        </td>
                                    )}
                                    <td style={{ padding: '1rem', fontWeight: 500 }}>{ticket.id}</td>
                                    <td style={{ padding: '1rem' }}>
                                        <div style={{ fontWeight: 500 }}>{ticket.subject}</div>
                                        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Prioridad: {ticket.priority}</div>
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
                                            <Button variant="ghost" size="sm" icon={Eye}>Detalles</Button>
                                        </Link>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </Card>

            <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Crear Nuevo Ticket">
                <form onSubmit={handleCreate}>
                    <div className="form-group">
                        <label className="form-label">Asunto</label>
                        <input
                            required
                            className="form-input"
                            placeholder="Ej: Problema con monitor"
                            value={newTicket.subject}
                            onChange={e => setNewTicket({ ...newTicket, subject: e.target.value })}
                        />
                    </div>
                    <div className="form-group">
                        <label className="form-label">Solicitante</label>
                        <input
                            required
                            className="form-input"
                            placeholder="Nombre del empleado"
                            value={newTicket.requester}
                            onChange={e => setNewTicket({ ...newTicket, requester: e.target.value })}
                        />
                    </div>
                    <div className="form-group">
                        <label className="form-label">Prioridad</label>
                        <select
                            className="form-select"
                            value={newTicket.priority}
                            onChange={e => setNewTicket({ ...newTicket, priority: e.target.value })}
                        >
                            <option value="Baja">Baja</option>
                            <option value="Media">Media</option>
                            <option value="Alta">Alta</option>
                            <option value="Crítica">Crítica</option>
                        </select>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '2rem' }}>
                        <Button type="button" variant="secondary" onClick={() => setIsModalOpen(false)}>Cancelar</Button>
                        <Button type="submit">Crear Ticket</Button>
                    </div>
                </form>
            </Modal>
        </div>
    );
}
