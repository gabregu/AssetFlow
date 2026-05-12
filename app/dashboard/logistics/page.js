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
    ArrowRight,
    MessageSquare,
    RefreshCw,
    Printer
} from 'lucide-react';
import { Card } from '@/app/components/ui/Card';
import { Badge } from '@/app/components/ui/Badge';
import { Button } from '@/app/components/ui/Button';
import { useStore } from '../../../lib/store';
import { CountryFilter } from '../../components/layout/CountryFilter';
import QRCode from 'qrcode';

export default function LogisticsHubPage() {
    const { logisticsTasks, tickets, users, updateLogisticsTask, countryFilter, currentUser } = useStore();
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('All');
    const [driverFilter, setDriverFilter] = useState('All');
    
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
                if (['Resuelto', 'Cancelado', 'Cerrado', 'Caso SFDC Cerrado', 'No requiere accion', 'Pendiente'].includes(task.status)) return false;
                
                // Ocultar "Entregado" de la vista por defecto, a menos que se busque explícitamente en el filtro
                if (task.status === 'Entregado' && statusFilter !== 'Entregado') return false;

                const parentTicket = tickets.find(t => String(t.id) === String(task.ticket_id));
                
                // Filtro de País
                const matchesCountry = countryFilter === 'Todos' || 
                    (task.address || '').toLowerCase().includes(countryFilter.toLowerCase()) ||
                    (parentTicket?.logistics?.address || '').toLowerCase().includes(countryFilter.toLowerCase());

                // Filtro de Texto
                const displayAddress = task.address || parentTicket?.logistics?.address || '';
                const displayRequester = parentTicket?.requester || '';

                const matchesText = 
                    (task.case_number || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                    displayRequester.toLowerCase().includes(searchTerm.toLowerCase()) ||
                    displayAddress.toLowerCase().includes(searchTerm.toLowerCase()) ||
                    (task.subject || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                    (task.delivery_person || '').toLowerCase().includes(searchTerm.toLowerCase());

                // Filtro de Estado
                const matchesStatus = statusFilter === 'All' || task.status === statusFilter;

                // Filtro de Conductor
                const matchesDriver = driverFilter === 'All' || (task.deliveryPerson || 'Sin Asignar') === driverFilter;

                return matchesCountry && matchesText && matchesStatus && matchesDriver;
            })
            .map(task => {
                const parentTicket = tickets.find(t => String(t.id) === String(task.ticket_id));
                const chat = parentTicket?.chatLog || task.chat_log || task.chatLog || [];
                
                // Fallbacks unificados
                const displayAddress = task.address || parentTicket?.logistics?.address || 'Sin dirección';
                const displayRequester = parentTicket?.requester || 'Sin nombre';
                
                // Detectar desincronización
                const parentAddress = parentTicket?.logistics?.address || '';
                const isOutOfSync = task.address && parentAddress && task.address !== parentAddress;
                
                return {
                    ...task,
                    parentTicket,
                    displayAddress,
                    displayRequester,
                    parentAddress,
                    isOutOfSync,
                    hasNewNotes: chat.length > 0,
                    hasUnreadChat: chat.length > 0 && chat[chat.length - 1].user !== currentUser?.name,
                    visitOrder: task.deliveryOrder || 0
                };
            })
            .sort((a, b) => {
                // Si estamos filtrando por conductor, priorizamos el orden de visita
                if (driverFilter !== 'All') {
                    return (a.visitOrder || 0) - (b.visitOrder || 0);
                }
                // Si no, por fecha de creación (más reciente arriba)
                return new Date(b.created_at || 0) - new Date(a.created_at || 0);
            });
    }, [logisticsTasks, tickets, searchTerm, statusFilter, countryFilter, currentUser, driverFilter]);

    const uniqueDrivers = useMemo(() => {
        const drivers = new Set();
        logisticsTasks.forEach(t => {
            if (t.deliveryPerson) drivers.add(t.deliveryPerson);
        });
        return Array.from(drivers).sort();
    }, [logisticsTasks]);

    // --- 2. ACCIONES RÁPIDAS ---
    const handleUpdateStatus = async (id, newStatus) => {
        await updateLogisticsTask(id, { status: newStatus });
    };

    const handleSyncTaskAddress = async (task) => {
        if (!task.parentAddress) return;
        if (confirm(`¿Sincronizar dirección con el Servicio? Se cambiará a: ${task.parentAddress}`)) {
            await updateLogisticsTask(task.id, { address: null });
        }
    };

    const handlePrintRouteReport = async () => {
        // Agrupar por conductor y ordenar por visita
        const drivers = {};
        const qrCodes = {};
        
        // Generar QRs de Google Maps para cada tarea
        for (const d of tasks) {
            const driverName = d.deliveryPerson || 'Sin Asignar';
            if (!drivers[driverName]) drivers[driverName] = [];
            drivers[driverName].push(d);

            if (d.displayAddress && d.displayAddress !== 'Sin dirección') {
                try {
                    // Nuevo diseño: QR apunta al registro en la app para el conductor
                    const qrContent = `${window.location.origin}/dashboard/my-deliveries?scan=${d.case_number || d.id}`;
                    qrCodes[d.id] = await QRCode.toDataURL(qrContent, {
                        margin: 1,
                        width: 150,
                        errorCorrectionLevel: 'M'
                    });
                } catch (err) {
                    console.error("Error generating Hub QR:", err);
                }
            }
        }

        // Ordenar cada grupo por orden de visita
        Object.keys(drivers).forEach(name => {
            drivers[name].sort((a, b) => (a.visitOrder || 0) - (b.visitOrder || 0));
        });

        let iframe = document.getElementById('print-iframe');
        if (!iframe) {
            iframe = document.createElement('iframe');
            iframe.id = 'print-iframe';
            iframe.style.position = 'absolute'; iframe.style.width = '0'; iframe.style.height = '0'; iframe.style.border = 'none';
            document.body.appendChild(iframe);
        }

        const content = `
            <html>
                <head>
                    <title>Reporte HUB Global - AssetFlow</title>
                    <style>
                        @page { size: A4; margin: 15mm; }
                        body { font-family: 'Inter', 'Segoe UI', Arial, sans-serif; color: #333; line-height: 1.4; }
                        .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #3b82f6; padding-bottom: 10px; margin-bottom: 20px; }
                        .logo { font-weight: 800; font-size: 20px; color: #1e3a8a; }
                        .report-title { font-size: 16px; font-weight: 700; text-transform: uppercase; }
                        .driver-section { margin-bottom: 40px; page-break-inside: avoid; }
                        .driver-info { background: #f8fafc; padding: 10px 15px; border-radius: 8px; margin-bottom: 15px; border-left: 5px solid #3b82f6; }
                        table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 10px; }
                        th { background: #f1f5f9; color: #475569; text-transform: uppercase; font-weight: 700; padding: 8px; border: 1px solid #e2e8f0; text-align: left; }
                        td { padding: 12px 8px; border: 1px solid #e2e8f0; vertical-align: middle; }
                        .order-col { width: 30px; text-align: center; font-weight: 800; font-size: 14px; background: #f8fafc; }
                        .qr-col { width: 80px; text-align: center; vertical-align: middle; padding: 15px 5px !important; }
                        .footer { margin-top: 50px; font-size: 9px; color: #64748b; text-align: center; }
                        .badge { padding: 2px 4px; border-radius: 3px; font-size: 8px; font-weight: 700; background: #e2e8f0; }
                        .qr-wrapper {
                            display: flex;
                            flex-direction: column;
                            align-items: center;
                            gap: 4px;
                        }
                        .qr-order-badge {
                            background: #000;
                            color: #fff;
                            font-size: 10px;
                            font-weight: 900;
                            padding: 2px 6px;
                            border-radius: 4px;
                            width: fit-content;
                        }
                    </style>
                </head>
                <body>
                    <div class="header">
                        <div class="logo">AssetFlow HUB GLOBAL</div>
                        <div class="report-title">Estado de Tráfico Logístico</div>
                        <div style="font-size: 10px;">${new Date().toLocaleDateString()}</div>
                    </div>

                    ${Object.keys(drivers).map(name => `
                        <div class="driver-section">
                            <div class="driver-info">
                                <div style="font-size: 14px; font-weight: 700;">${name}</div>
                            </div>
                            <table>
                                <thead>
                                    <tr>
                                        <th class="order-col">#</th>
                                        <th>Caso / Cliente</th>
                                        <th>Dirección</th>
                                        <th class="qr-col">Mapa</th>
                                        <th style="width: 80px;">Horario</th>
                                        <th>Estado</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${drivers[name].map(d => `
                                        <tr>
                                            <td class="order-col">${d.visitOrder || '-'}</td>
                                            <td>
                                                <strong>${d.case_number}</strong><br/>
                                                <span style="font-size: 9px;">${d.displayRequester}</span>
                                            </td>
                                            <td style="font-size: 9px;">${d.displayAddress}</td>
                                            <td class="qr-col">
                                                ${qrCodes[d.id] ? `
                                                    <div class="qr-wrapper">
                                                        <div class="qr-order-badge">ORDEN ${d.visitOrder || '-'}</div>
                                                        <img src="${qrCodes[d.id]}" style="width: 65px; height: 65px; display: block;" />
                                                    </div>
                                                ` : '-'}
                                            </td>
                                            <td>${d.date ? d.date.split('T')[0] : 'Pend.'} | ${d.time_slot || 'AM'}</td>
                                            <td><span class="badge">${d.status}</span></td>
                                        </tr>
                                    `).join('')}
                                </tbody>
                            </table>
                        </div>
                    `).join('')}
                </body>
            </html>
        `;

        const doc = iframe.contentWindow.document;
        doc.open(); doc.write(content); doc.close();
        setTimeout(() => { iframe.contentWindow.focus(); iframe.contentWindow.print(); }, 500);
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
            <div style={{ marginBottom: '2rem' }} className="flex-mobile-column">
                <div>
                    <h1 style={{ fontSize: '1.8rem', fontWeight: 700, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <Activity className="text-primary-500" />
                        Tráfico de Logística (Hub Global)
                    </h1>
                    <p style={{ color: 'var(--text-secondary)' }}>Gestión centralizada de todas las entregas y retiros de {countryFilter === 'Todos' ? 'todos los clientes' : `cliente ${countryFilter}`}.</p>
                </div>
                <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem' }} className="flex-mobile-column">
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
                                width: '100%',
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
                            background: 'var(--surface)',
                            width: '100%'
                        }}
                    >
                        <option value="All">Todos los Estados</option>
                        <option value="Para Coordinar">Para Coordinar</option>
                        <option value="En Transito">En Tránsito</option>
                        <option value="Entregado">Entregado</option>
                    </select>

                    <select 
                        value={driverFilter}
                        onChange={(e) => setDriverFilter(e.target.value)}
                        style={{
                            padding: '0.6rem 1rem',
                            borderRadius: 'var(--radius-md)',
                            border: '1px solid var(--border)',
                            background: 'var(--surface)',
                            width: '100%',
                            minWidth: '180px'
                        }}
                    >
                        <option value="All">Todos los Conductores</option>
                        <option value="Sin Asignar">Sin Asignar</option>
                        {uniqueDrivers.map(d => (
                            <option key={d} value={d}>{d}</option>
                        ))}
                    </select>

                    <Button icon={Printer} onClick={handlePrintRouteReport} variant="secondary">Imprimir Hub</Button>
                </div>
            </div>

            {/* Metrics cards */}
            <div className="grid-responsive-4" style={{ marginBottom: '2rem' }}>
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
                        {tasks.length}
                    </div>
                </Card>
            </div>

            {/* Global Tasks Table */}
            <Card style={{ padding: 0 }} className="table-responsive">
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
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>{task.displayRequester}</div>
                                        {task.hasNewNotes && (
                                            <div 
                                                title={task.hasUnreadChat ? "Nuevo mensaje sin leer" : "Tiene notas adicionales"} 
                                                className={task.hasUnreadChat ? "unread-badge-v2" : ""}
                                                style={{ 
                                                    color: task.hasUnreadChat ? 'white' : 'var(--primary-color)', 
                                                    display: 'flex',
                                                    marginRight: '8px'
                                                }}
                                            >
                                                <MessageSquare size={14} fill={task.hasUnreadChat ? 'white' : 'none'} stroke={task.hasUnreadChat ? 'none' : 'currentColor'} />
                                            </div>
                                        )}
                                    </div>
                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                        {task.subject}
                                    </div>
                                </td>
                                <td style={{ padding: '1rem' }}>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                                        <div style={{ fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                            <MapPin size={14} className={task.isOutOfSync ? "text-warning" : "text-secondary-400"} />
                                            <span style={{ color: task.isOutOfSync ? 'var(--warning-color)' : 'inherit', fontWeight: task.isOutOfSync ? 600 : 400 }}>
                                                {task.displayAddress}
                                            </span>
                                        </div>
                                        {task.isOutOfSync && (
                                            <button 
                                                onClick={() => handleSyncTaskAddress(task)}
                                                style={{ 
                                                    fontSize: '0.65rem', 
                                                    color: 'var(--primary-color)', 
                                                    background: 'rgba(37, 99, 235, 0.05)', 
                                                    border: '1px solid var(--primary-color)', 
                                                    padding: '2px 6px', 
                                                    borderRadius: '4px',
                                                    cursor: 'pointer',
                                                    width: 'fit-content',
                                                    marginTop: '4px',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '4px'
                                                }}
                                            >
                                                <RefreshCw size={10} /> Sincronizar con Servicio
                                            </button>
                                        )}
                                    </div>
                                </td>
                                <td style={{ padding: '1rem' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                        <div style={{ width: '24px', height: '24px', background: 'var(--background)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                            <User size={14} />
                                        </div>
                                        <div style={{ fontSize: '0.85rem' }}>{task.deliveryPerson || 'Sin Asignar'}</div>
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
