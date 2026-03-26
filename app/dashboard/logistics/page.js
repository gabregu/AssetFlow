"use client";
import React, { useState, useMemo } from 'react';
import { 
    Activity, 
    Truck, 
    Calendar, 
    Clock, 
    User, 
    MapPin, 
    Search, 
    Filter, 
    ChevronRight,
    CheckCircle2,
    AlertCircle,
    Package,
    ArrowUpDown,
    ArrowRight
} from 'lucide-react';
import { Card } from '@/app/components/ui/Card';
import { Badge } from '@/app/components/ui/Badge';
import { Button } from '@/app/components/ui/Button';
import { useStore } from '../../../lib/store';
import { CountryFilter } from '../../components/layout/CountryFilter';

export default function LogisticsHubPage() {
    const { logisticsTasks, tickets, users, updateLogisticsTask, countryFilter } = useStore();
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('All');
    
    // --- 1. PROCESAR TAREAS ---
    const tasks = useMemo(() => {
        // Deduplicar tareas por Case Number (Mantiene el más reciente en caso de repetidos importados)
        const uniqueMap = new Map();
        logisticsTasks.forEach(task => {
            const key = task.case_number ? String(task.case_number).trim() : task.id;
            uniqueMap.set(key, task);
        });
        
        const deduplicatedTasks = Array.from(uniqueMap.values());

        return deduplicatedTasks
            .filter(task => {
                // "si están en estado Resuelto que no aparezcan" -> Ocultar absolutos de terminación
                if (['Resuelto', 'Cancelado', 'Cerrado', 'Caso SFDC Cerrado', 'No requiere accion'].includes(task.status)) return false;
                
                // Ocultar "Entregado" de la vista por defecto, a menos que se busque explícitamente en el filtro
                if (task.status === 'Entregado' && statusFilter !== 'Entregado') return false;

                const parentTicket = tickets.find(t => String(t.id) === String(task.ticket_id));
                
                // Filtro de País
                const matchesCountry = countryFilter === 'Todos' || 
                    (task.address || '').toLowerCase().includes(countryFilter.toLowerCase()) ||
                    (parentTicket?.logistics?.address || '').toLowerCase().includes(countryFilter.toLowerCase());

                // Filtro de Texto
                const matchesText = 
                    (task.case_number || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                    (task.subject || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                    (task.delivery_person || '').toLowerCase().includes(searchTerm.toLowerCase());

                // Filtro de Estado
                const matchesStatus = statusFilter === 'All' || task.status === statusFilter;

                return matchesCountry && matchesText && matchesStatus;
            })
            .map(task => {
                const parentTicket = tickets.find(t => String(t.id) === String(task.ticket_id));
                return {
                    ...task,
                    parentTicket
                };
            })
            .sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
    }, [logisticsTasks, tickets, searchTerm, statusFilter, countryFilter]);

    // --- 2. ACCIONES RÁPIDAS ---
    const handleUpdateStatus = async (id, newStatus) => {
        await updateLogisticsTask(id, { status: newStatus });
    };

    const getStatusVariant = (status) => {
        switch(status) {
            case 'Entregado': return 'success';
            case 'En Transito': return 'info';
            case 'Para Coordinar': return 'warning';
            case 'No requiere accion': return 'secondary';
            default: return 'secondary';
        }
    };

    return (
        <div style={{ animation: 'fadeIn 0.5s ease-out' }}>
            {/* Header section */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                <div>
                    <h1 style={{ fontSize: '1.8rem', fontWeight: 700, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <Activity className="text-primary-500" />
                        Tráfico de Logística (Hub Global)
                    </h1>
                    <p style={{ color: 'var(--text-secondary)' }}>Gestión centralizada de todas las entregas y retiros del sistema.</p>
                    <div style={{ marginTop: '1rem' }}>
                        <CountryFilter />
                    </div>
                </div>
                <div style={{ display: 'flex', gap: '1rem' }}>
                    <div style={{ position: 'relative' }}>
                        <Search style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} size={18} />
                        <input 
                            type="text" 
                            placeholder="Buscar caso, persona..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            style={{
                                padding: '0.6rem 1rem 0.6rem 2.5rem',
                                borderRadius: 'var(--radius-md)',
                                border: '1px solid var(--border)',
                                width: '250px',
                                background: 'var(--surface)'
                            }}
                        />
                    </div>
                    <select 
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                        style={{
                            padding: '0.6rem 1rem',
                            borderRadius: 'var(--radius-md)',
                            border: '1px solid var(--border)',
                            background: 'var(--surface)'
                        }}
                    >
                        <option value="All">Todos los Estados</option>
                        <option value="Para Coordinar">Para Coordinar</option>
                        <option value="En Transito">En Tránsito</option>
                        <option value="Entregado">Entregado</option>
                    </select>
                </div>
            </div>

            {/* Metrics cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1.5rem', marginBottom: '2rem' }}>
                <Card className="p-4" style={{ borderLeft: '4px solid #f97316' }}>
                    <div style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', fontWeight: 600, textTransform: 'uppercase' }}>Por Coordinar</div>
                    <div style={{ fontSize: '1.8rem', fontWeight: 700, marginTop: '0.25rem' }}>
                        {logisticsTasks.filter(t => t.status === 'Para Coordinar').length}
                    </div>
                </Card>
                <Card className="p-4" style={{ borderLeft: '4px solid #3b82f6' }}>
                    <div style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', fontWeight: 600, textTransform: 'uppercase' }}>En Tránsito</div>
                    <div style={{ fontSize: '1.8rem', fontWeight: 700, marginTop: '0.25rem' }}>
                        {logisticsTasks.filter(t => t.status === 'En Transito').length}
                    </div>
                </Card>
                <Card className="p-4" style={{ borderLeft: '4px solid #10b981' }}>
                    <div style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', fontWeight: 600, textTransform: 'uppercase' }}>Entregado (Total)</div>
                    <div style={{ fontSize: '1.8rem', fontWeight: 700, marginTop: '0.25rem' }}>
                        {logisticsTasks.filter(t => t.status === 'Entregado').length}
                    </div>
                </Card>
                <Card className="p-4" style={{ background: 'var(--primary-color)', color: 'white' }}>
                    <div style={{ opacity: 0.8, fontSize: '0.8rem', fontWeight: 600, textTransform: 'uppercase' }}>Total Tareas</div>
                    <div style={{ fontSize: '1.8rem', fontWeight: 700, marginTop: '0.25rem' }}>
                        {logisticsTasks.length}
                    </div>
                </Card>
            </div>

            {/* Global Tasks Table */}
            <Card style={{ padding: 0, overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead style={{ background: 'var(--background)', color: 'var(--text-secondary)', borderBottom: '1px solid var(--border)' }}>
                        <tr>
                            <th style={{ padding: '1rem', textAlign: 'left', fontWeight: 600, width: '140px' }}>Caso SFDC</th>
                            <th style={{ padding: '1rem', textAlign: 'left', fontWeight: 600 }}>Usuario / Asunto</th>
                            <th style={{ padding: '1rem', textAlign: 'left', fontWeight: 600 }}>Dirección</th>
                            <th style={{ padding: '1rem', textAlign: 'left', fontWeight: 600 }}>Responsable</th>
                            <th style={{ padding: '1rem', textAlign: 'left', fontWeight: 600 }}>Logística</th>
                            <th style={{ padding: '1rem', textAlign: 'center', fontWeight: 600 }}>Estado</th>
                            <th style={{ padding: '1rem', textAlign: 'right', fontWeight: 600 }}>Acciones</th>
                        </tr>
                    </thead>
                    <tbody>
                        {tasks.length === 0 ? (
                            <tr>
                                <td colSpan="7" style={{ padding: '4rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                                    <Package size={48} style={{ opacity: 0.1, marginBottom: '1rem' }} />
                                    <p>No se encontraron tareas con estos filtros.</p>
                                </td>
                            </tr>
                        ) : tasks.map(task => (
                            <tr key={task.id} style={{ borderBottom: '1px solid var(--border)', transition: 'background 0.2s' }} className="hover-row">
                                <td style={{ padding: '1rem' }}>
                                    <div style={{ fontWeight: 700, color: 'var(--text-main)', fontSize: '0.9rem' }}>{task.case_number}</div>
                                    <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
                                        Serv: {task.ticket_id}
                                    </div>
                                </td>
                                <td style={{ padding: '1rem' }}>
                                    <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{task.parentTicket?.requester || 'Sin nombre'}</div>
                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                        {task.subject}
                                    </div>
                                </td>
                                <td style={{ padding: '1rem' }}>
                                    <div style={{ fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                        <MapPin size={14} className="text-secondary-400" />
                                        {task.address || 'Sin dirección'}
                                    </div>
                                </td>
                                <td style={{ padding: '1rem' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                        <div style={{ width: '24px', height: '24px', background: 'var(--background)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                            <User size={14} />
                                        </div>
                                        <div style={{ fontSize: '0.85rem' }}>{task.delivery_person || 'No asignado'}</div>
                                    </div>
                                </td>
                                <td style={{ padding: '1rem' }}>
                                    <div style={{ fontSize: '0.85rem', color: 'var(--text-main)', fontWeight: 500 }}>
                                        {task.date ? new Date(task.date + 'T00:00:00').toLocaleDateString() : 'Por coordinar'}
                                    </div>
                                    <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
                                        {task.time_slot || 'AM'} | {task.method || 'Propio'}
                                    </div>
                                </td>
                                <td style={{ padding: '1rem', textAlign: 'center' }}>
                                    <Badge variant={getStatusVariant(task.status)}>
                                        {task.status}
                                    </Badge>
                                </td>
                                <td style={{ padding: '1rem', textAlign: 'right' }}>
                                    <Button 
                                        size="sm" 
                                        variant="outline" 
                                        icon={ArrowRight} 
                                        onClick={() => window.location.href = `/dashboard/tickets/${task.ticket_id}`}
                                    >
                                        Gestionar
                                    </Button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </Card>

            <style jsx>{`
                .hover-row:hover {
                    background-color: var(--background);
                }
            `}</style>
        </div>
    );
}
