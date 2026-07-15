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
    Printer,
    ExternalLink,
    Check,
    Map as MapIcon,
    ChevronDown,
    ChevronUp
} from 'lucide-react';
import { Card } from '@/app/components/ui/Card';
import { Badge } from '@/app/components/ui/Badge';
import { Button } from '@/app/components/ui/Button';
import { Modal } from '@/app/components/ui/Modal';
import { useStore } from '../../../lib/store';

import { ServiceMap } from '../../components/ui/ServiceMap';
import QRCode from 'qrcode';
import JsBarcode from 'jsbarcode';

const TrackingBadge = ({ method, trackingNumber }) => {
    const [copied, setCopied] = React.useState(false);
    if (!method || !trackingNumber) return null;
    
    const isCorreoArgentino = String(method).toLowerCase().includes('correo argentino') || String(method).toLowerCase().trim() === 'correo';
    const isAndreani = String(method).toLowerCase().includes('andreani');
    
    if (!isCorreoArgentino && !isAndreani) return null;

    const handleTrack = (e) => {
        e.stopPropagation();
        
        // Clean tracking number (remove "TN:" or "TN" prefix if any)
        const cleanTN = String(trackingNumber).trim().replace(/^(tn:?\s*)/i, '').trim();
        
        // Copy to clipboard
        navigator.clipboard.writeText(cleanTN);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
        
        // Open URL
        const url = isCorreoArgentino 
            ? 'https://www.correoargentino.com.ar/formularios/e-commerce'
            : `https://seguimiento.andreani.com/envio/${cleanTN}`;
        
        window.open(url, '_blank');
    };

    return (
        <span 
            onClick={handleTrack}
            title={isCorreoArgentino ? `Copiar TN: ${trackingNumber} e ir a Correo Argentino` : `Ir a seguimiento de Andreani: ${trackingNumber}`}
            style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                padding: '2px 6px',
                background: copied ? 'rgba(16, 185, 129, 0.1)' : 'rgba(37, 99, 235, 0.08)',
                border: `1px solid ${copied ? 'rgba(16, 185, 129, 0.3)' : 'rgba(37, 99, 235, 0.2)'}`,
                color: copied ? '#10b981' : '#2563eb',
                borderRadius: '4px',
                fontSize: '0.7rem',
                fontWeight: 700,
                cursor: 'pointer',
                transition: 'all 0.2s',
                marginLeft: '6px',
                userSelect: 'none'
            }}
            className="tracking-badge-hover"
        >
            {copied ? (
                <>
                    <Check size={10} strokeWidth={3} />
                    <span>¡TN Copiado!</span>
                </>
            ) : (
                <>
                    <span>TN: {trackingNumber}</span>
                    <ExternalLink size={10} strokeWidth={2.5} />
                </>
            )}
        </span>
    );
};


export default function LogisticsHubPage() {

    const { logisticsTasks, tickets, users, updateLogisticsTask, countryFilter, getClientName, currentUser, assets, warehouseLocations } = useStore();
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('All');
    const [driverFilter, setDriverFilter] = useState('All');
    const [showMap, setShowMap] = useState(false);

    // Modal States
    const [actionModal, setActionModal] = useState({ isOpen: false, type: null, task: null });
    // type: 'prepare_shipping' | 'schedule_appointment'

    // Scanner States
    const [scannedAssets, setScannedAssets] = useState({});
    const [manualChecks, setManualChecks] = useState({});
    const [scanInput, setScanInput] = useState('');

    const handleScanSubmit = (e) => {
        e.preventDefault();
        const serialToMatch = scanInput.trim().toLowerCase();
        if (!serialToMatch || !actionModal.task?.assets) return;

        const assetMatch = actionModal.task.assets.find(a => 
            a.serial && String(a.serial).trim().toLowerCase() === serialToMatch
        );

        if (assetMatch) {
            setScannedAssets(prev => ({ ...prev, [assetMatch.serial]: true }));
            setScanInput(''); // clear input on success
        }
    };

    const handleModalClose = () => {
        setActionModal({ isOpen: false, type: null, task: null });
        setScannedAssets({});
        setManualChecks({});
        setScanInput('');
    };

    const [scheduleData, setScheduleData] = useState({
        method: '',
        delivery_person: '',
        date: '',
        time_slot: 'AM',
        tracking_number: ''
    });

    const [hwChecklist, setHwChecklist] = useState({
        serial: false,
        cleaning: false,
        wipe: false,
        reinstall: false
    });

    const isDeliveryCase = (subject = '') => {
        const s = String(subject).toLowerCase();
        return /provisioning|breakfix|new hire|entrega|swap|deploy|nueva asignaci/.test(s);
    };
    
    const isCollectionCase = (subject = '') => {
        const s = String(subject).toLowerCase();
        return /collection|recupero|recovery|recolecci|return|retiro/.test(s);
    };

    // Helper para iniciales
    const getInitials = (name) => {
        if (!name) return 'IT';
        return String(name).split(' ').map(n => n && n[0] ? n[0] : '').join('').toUpperCase().substring(0, 2);
    };

    // Helper para asignar color distintivo a cada conductor
    const getDriverColor = (name) => {
        if (!name) return '#dc2626';
        const driverColors = [
            '#dc2626', // Rojo
            '#2563eb', // Azul
            '#16a34a', // Verde
            '#7c3aed', // Violeta
            '#db2777', // Rosa
            '#ea580c', // Naranja
            '#0d9488', // Teal
            '#6366f1', // Índigo
            '#854d0e', // Amarillo oscuro/Marrón
        ];
        // Algoritmo DJB2 para evitar colisiones en nombres con sumas de caracteres idénticas (como LM y FS)
        let hash = 5381;
        const strName = String(name);
        for (let i = 0; i < strName.length; i++) {
            hash = ((hash << 5) + hash) + strName.charCodeAt(i);
        }
        const index = Math.abs(hash) % driverColors.length;
        return driverColors[index];
    };
    
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
                
                // Filtro de Cliente (via ticket padre)
                const expectedClient = getClientName(countryFilter);
                const matchesCountry = parentTicket?.client === expectedClient;

                // Filtro de Texto
                const displayAddress = task.address || parentTicket?.logistics?.address || '';
                const displayRequester = parentTicket?.requester || '';

                const matchesText = 
                    String(task.case_number || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                    String(displayRequester || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                    String(displayAddress || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                    String(task.subject || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                    String(task.delivery_person || '').toLowerCase().includes(searchTerm.toLowerCase());

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
                const floorDept = task.floorDept || task.floor_dept || parentTicket?.logistics?.floorDept || '';
                const displayRequester = parentTicket?.requester || 'Sin nombre';
                
                // Detectar desincronización
                const parentAddress = parentTicket?.logistics?.address || '';
                const isOutOfSync = task.address && parentAddress && task.address !== parentAddress;
                
                return {
                    ...task,
                    parentTicket,
                    displayAddress,
                    floorDept,
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

    const metrics = useMemo(() => {
        const uniqueMap = new Map();
        logisticsTasks.forEach(task => {
            const key = task.case_number ? String(task.case_number).trim() : task.id;
            uniqueMap.set(key, task);
        });
        
        const deduplicatedTasks = Array.from(uniqueMap.values());

        const filtered = deduplicatedTasks.filter(task => {
            if (['Resuelto', 'Cancelado', 'Cerrado', 'Caso SFDC Cerrado', 'No requiere accion', 'Pendiente'].includes(task.status)) return false;
            if (task.status === 'Entregado') return false;

            const parentTicket = tickets.find(t => String(t.id) === String(task.ticket_id));
            const expectedClient = getClientName(countryFilter);
            const matchesCountry = parentTicket?.client === expectedClient;

            const displayAddress = task.address || parentTicket?.logistics?.address || '';
            const displayRequester = parentTicket?.requester || '';

            const matchesText = 
                String(task.case_number || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                String(displayRequester || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                String(displayAddress || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                String(task.subject || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                String(task.delivery_person || '').toLowerCase().includes(searchTerm.toLowerCase());

            const matchesDriver = driverFilter === 'All' || (task.deliveryPerson || 'Sin Asignar') === driverFilter;

            return matchesCountry && matchesText && matchesDriver;
        });

        return {
            porCoordinar: filtered.filter(t => t.status === 'Para Coordinar').length,
            enTransito: filtered.filter(t => t.status === 'En Transito').length,
            total: filtered.length
        };
    }, [logisticsTasks, tickets, searchTerm, countryFilter, driverFilter]);

    
    const mapItems = React.useMemo(() => {
        if (!showMap) return [];
        return tasks.map(task => ({
            id: task.id,
            subject: task.subject || (task.case_number ? `Caso ${task.case_number}` : `Tarea ${task.id}`),
            requester: task.displayRequester,
            logistics: {
                address: task.displayAddress,
                status: task.status,
                deliveryPerson: task.deliveryPerson || task.delivery_person
            },
            status: task.status
        }));
    }, [tasks, showMap]);

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

    const handlePrintDeliveryLabel = async (task) => {
        try {
            // Contenido dinámico para el QR: URL que lleva al conductor directo al registro
            const qrContent = `${window.location.origin}/dashboard/my-deliveries?scan=${task.case_number || task.id}`;
            const qrDataUrl = await QRCode.toDataURL(qrContent, {
                margin: 1,
                width: 200,
                errorCorrectionLevel: 'M', // Nivel medio para mayor robustez
                color: { dark: '#000000', light: '#ffffff' }
            });

            // Barcode para el ID
            const canvas = document.createElement('canvas');
            JsBarcode(canvas, String(task.case_number || task.id), {
                format: "CODE128",
                width: 2,
                height: 40,
                displayValue: false,
                margin: 0
            });
            const barcodeDataUrl = canvas.toDataURL("image/png");

            let iframe = document.getElementById('print-iframe');
            if (!iframe) {
                iframe = document.createElement('iframe');
                iframe.id = 'print-iframe';
                iframe.style.position = 'absolute';
                iframe.style.width = '0';
                iframe.style.height = '0';
                iframe.style.border = 'none';
                document.body.appendChild(iframe);
            }

            const content = `
                <html>
                    <head>
                        <meta charset="utf-8">
                        <style>
                            @page { size: 50mm 25mm; margin: 0; }
                            * { box-sizing: border-box; -webkit-print-color-adjust: exact; }
                            html, body { width: 50mm; height: 25mm; margin: 0; padding: 0; background: #fff; overflow: hidden; }
                            .label-container {
                                width: 50mm; height: 25mm; padding: 1.8mm 2.8mm;
                                display: flex; position: absolute; top: 0; left: 0;
                                font-family: 'Helvetica', 'Arial', sans-serif;
                            }
                            .left-side {
                                flex: 1; display: flex; flex-direction: column;
                                justify-content: center; gap: 0.3mm; padding-right: 1.5mm;
                                overflow: hidden;
                            }
                            .ticket-id {
                                font-size: 5.5pt; font-weight: 800; color: #000;
                                margin-bottom: 0.1mm; line-height: 1;
                            }
                            .recipient-name {
                                font-size: 7.5pt; font-weight: 900; line-height: 1.1;
                                color: #000; text-transform: uppercase;
                                display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;
                                overflow: hidden; margin-bottom: 0.2mm;
                            }
                            .address-text {
                                font-size: 5.2pt; font-weight: 600; line-height: 1.1;
                                color: #111; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical;
                                overflow: hidden;
                            }
                            .date-text {
                                font-size: 4.8pt; font-weight: 800; color: #000;
                                margin-top: 0.2mm;
                            }
                            .right-side {
                                width: 14.5mm; display: flex;
                                align-items: center; justify-content: center;
                                height: 100%;
                            }
                            .qr-code { width: 14.5mm; height: 14.5mm; }
                        </style>
                    </head>
                    <body>
                        <div class="label-container">
                            <div class="left-side">
                                <div class="ticket-id">TICKET #${task.case_number || task.id}</div>
                                <div class="recipient-name">${task.displayRequester}</div>
                                <div class="address-text">${task.displayAddress}</div>
                                <div class="date-text">📅 ${task.date ? new Date(task.date + 'T00:00:00').toLocaleDateString() : 'Por coordinar'}</div>
                            </div>
                            <div class="right-side">
                                <img class="qr-code" src="${qrDataUrl}" />
                            </div>
                        </div>
                    </body>
                </html>
            `;

            const doc = iframe.contentWindow.document;
            doc.open();
            doc.write(content);
            doc.close();

            setTimeout(() => {
                iframe.contentWindow.focus();
                iframe.contentWindow.print();
            }, 500);

        } catch (err) {
            console.error('Error printing delivery label:', err);
            alert('Error al imprimir la etiqueta de envío');
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
                    <p style={{ color: 'var(--text-secondary)' }}>Gestión centralizada de todas las entregas y retiros de cliente {countryFilter}.</p>
                </div>
                <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem' }} className="flex-mobile-column">
                    <div style={{ position: 'relative', width: '100%' }}>
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
                        <option value="En Preparación">En Preparación</option>
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
            <div className="grid-responsive-3" style={{ marginBottom: '2rem' }}>
                <Card className="p-4" style={{ borderLeft: '4px solid #f97316' }}>
                    <div style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', fontWeight: 600, textTransform: 'uppercase' }}>Por Coordinar</div>
                    <div style={{ fontSize: '1.8rem', fontWeight: 700, marginTop: '0.25rem' }}>
                        {metrics.porCoordinar}
                    </div>
                </Card>
                <Card className="p-4" style={{ borderLeft: '4px solid #3b82f6' }}>
                    <div style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', fontWeight: 600, textTransform: 'uppercase' }}>En Tránsito</div>
                    <div style={{ fontSize: '1.8rem', fontWeight: 700, marginTop: '0.25rem' }}>
                        {metrics.enTransito}
                    </div>
                </Card>
                <Card className="p-4" style={{ background: 'var(--primary-color)', color: 'white' }}>
                    <div style={{ opacity: 0.8, fontSize: '0.8rem', fontWeight: 600, textTransform: 'uppercase' }}>Total Tareas</div>
                    <div style={{ fontSize: '1.8rem', fontWeight: 700, marginTop: '0.25rem' }}>
                        {metrics.total}
                    </div>
                </Card>
            </div>

            
            {/* Live Map Integration */}
            <div style={{ marginBottom: '2.5rem' }}>
                <Card style={{ padding: 0, overflow: 'hidden' }}>
                    <div
                        style={{
                            padding: '1rem 1.25rem',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            cursor: 'pointer',
                            userSelect: 'none',
                            background: showMap ? 'var(--background)' : 'transparent',
                            borderBottom: showMap ? '1px solid var(--border)' : 'none'
                        }}
                        onClick={() => setShowMap(!showMap)}
                    >
                        <h3 style={{ fontSize: '1rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.6rem', margin: 0 }}>
                            <MapIcon size={18} style={{ color: 'var(--primary-color)' }} /> Mapa de Operaciones
                        </h3>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                            {showMap ? <ChevronUp size={20} style={{ color: 'var(--text-secondary)' }} /> : <ChevronDown size={20} style={{ color: 'var(--text-secondary)' }} />}
                        </div>
                    </div>

                    {showMap && (
                        <div style={{ borderRadius: 0, overflow: 'hidden' }}>
                            <ServiceMap
                                tickets={mapItems}
                                drivers={[]}
                            />
                        </div>
                    )}
                </Card>
            </div>

            {/* Global Tasks Table */}
            <Card style={{ padding: 0 }} className="table-responsive">
                <table className="desktop-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead style={{ background: 'var(--background)', color: 'var(--text-secondary)', borderBottom: '1px solid var(--border)' }}>
                        <tr>
                            <th style={{ padding: '1rem', textAlign: 'left', fontWeight: 600, width: '140px' }}>ID</th>
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
                                <td style={{ padding: '1rem', fontWeight: 700, color: 'var(--text-main)', fontSize: '0.9rem' }}>
                                    {task.ticket_id}
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
                                                {task.displayAddress}{task.floorDept ? `, ${task.floorDept}` : ''}
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
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                            {(() => {
                                                const driverName = task.deliveryPerson || task.delivery_person;
                                                const method = task.method || '';
                                                
                                                if (driverName && driverName !== 'Sin Asignar' && driverName !== 'No definido') {
                                                    const initials = getInitials(driverName);
                                                    const color = getDriverColor(driverName);
                                                    return (
                                                        <div 
                                                            style={{
                                                                width: '24px',
                                                                height: '24px',
                                                                borderRadius: '50%',
                                                                backgroundColor: color,
                                                                color: '#ffffff',
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                justifyContent: 'center',
                                                                fontSize: '0.7rem',
                                                                fontWeight: 800,
                                                                flexShrink: 0,
                                                                boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
                                                            }}
                                                            title={driverName}
                                                        >
                                                            {initials}
                                                        </div>
                                                    );
                                                }
                                                
                                                const methodStr = String(method).toLowerCase();
                                                const isCorreo = methodStr.includes('correo argentino') || methodStr.trim() === 'correo';
                                                const isAndreani = methodStr.includes('andreani');
                                                
                                                if (isCorreo) {
                                                    return (
                                                        <div style={{ width: '24px', height: '24px', borderRadius: '50%', backgroundColor: '#0055A5', color: '#FFE600', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem', fontWeight: 800, flexShrink: 0, boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }} title="Correo Argentino">
                                                            CA
                                                        </div>
                                                    );
                                                }
                                                
                                                if (isAndreani) {
                                                    return (
                                                        <div style={{ width: '24px', height: '24px', borderRadius: '50%', backgroundColor: '#E2001A', color: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem', fontWeight: 800, flexShrink: 0, boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }} title="Andreani">
                                                            A
                                                        </div>
                                                    );
                                                }

                                                return (
                                                    <>
                                                        <div style={{ width: '24px', height: '24px', background: 'var(--background)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                                            <User size={14} style={{ color: 'var(--text-secondary)' }} />
                                                        </div>
                                                        <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-main)' }}>
                                                            Sin Asignar
                                                        </div>
                                                    </>
                                                );
                                            })()}
                                        </div>
                                        {(task.coordinatedBy || task.coordinated_by) ? (
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', paddingLeft: '28px' }}>
                                                <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                                                    Coordinó: <strong style={{ color: 'var(--primary-color)' }}>{task.coordinatedBy || task.coordinated_by}</strong>
                                                </span>
                                            </div>
                                        ) : (
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', paddingLeft: '28px' }}>
                                                <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', fontStyle: 'italic' }}>
                                                    Sin coordinar
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                </td>
                                <td style={{ padding: '1rem' }}>
                                    <div style={{ fontSize: '0.85rem', color: 'var(--text-main)', fontWeight: 500 }}>
                                        {task.date ? new Date(task.date + 'T00:00:00').toLocaleDateString() : 'Por coordinar'}
                                    </div>
                                    <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '4px', marginTop: '2px' }}>
                                        <span>{task.time_slot || 'AM'} | {task.method || 'Propio'}</span>
                                        {task.tracking_number && (
                                            <TrackingBadge method={task.method} trackingNumber={task.tracking_number} />
                                        )}
                                    </div>
                                </td>
                                <td style={{ padding: '1rem', textAlign: 'center' }}>
                                    <Badge variant={getStatusVariant(task.status)}>
                                        {task.status}
                                    </Badge>
                                </td>
                                <td style={{ padding: '1rem', textAlign: 'right' }}>
                                    <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                                        {(() => {
                                            const isOutbound = isDeliveryCase(task.subject) || task.case_type === 'entrega' || task.caseType === 'entrega';
                                            
                                            const btnGestionar = (
                                                <Button 
                                                    size="sm" 
                                                    variant="outline" 
                                                    icon={ArrowRight} 
                                                    onClick={() => window.location.href = `/dashboard/tickets/${task.ticket_id}`}
                                                >
                                                    Gestionar
                                                </Button>
                                            );

                                            if (task.status === 'En Preparación' || (isOutbound && (!task.status || task.status === 'Pendiente'))) {
                                                return (
                                                    <>
                                                        <Button size="sm" style={{ background: '#10b981', color: 'white', border: 'none' }} icon={Package} onClick={() => setActionModal({ isOpen: true, type: 'prepare_shipping', task })}>
                                                            Verificación HW
                                                        </Button>
                                                    </>
                                                );
                                            } else if (task.status === 'Para Coordinar') {
                                                return (
                                                    <>
                                                        <Button size="sm" style={{ background: '#3b82f6', color: 'white', border: 'none' }} icon={Calendar} onClick={() => {
                                                            setScheduleData({
                                                                method: task.method || '',
                                                                delivery_person: task.deliveryPerson || task.delivery_person || '',
                                                                date: task.date || '',
                                                                time_slot: task.time_slot || 'AM',
                                                                tracking_number: task.tracking_number || '',
                                                                address: task.address || task.parentAddress || '',
                                                                coordinated_by: task.coordinated_by || task.coordinatedBy || '',
                                                                deliveryInfo: task.deliveryInfo || {}
                                                            });
                                                            setActionModal({ isOpen: true, type: 'schedule_appointment', task });
                                                        }}>
                                                            Agendar Cita
                                                        </Button>
                                                    </>
                                                );
                                            }
                                            
                                            return btnGestionar;
                                        })()}
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>

                {/* Mobile Cards View */}
                {tasks.length === 0 ? (
                    <div className="mobile-only" style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                        <Package size={48} style={{ opacity: 0.1, margin: '0 auto 1rem' }} />
                        <p>No se encontraron tareas con estos filtros.</p>
                    </div>
                ) : tasks.map(task => {
                    const isOutbound = task.title === 'Hardware Provisioning' || task.type === 'Hardware Provisioning' || String(task.subject).toLowerCase().includes('provisioning');
                    
                    const btnGestionar = (
                        <Button 
                            size="sm" 
                            variant="secondary" 
                            icon={ArrowRight} 
                            onClick={() => window.open(`/dashboard/tickets/${task.ticket_id || task.id}?tab=logistics`, '_blank')}
                            style={{ width: '100%' }}
                        >
                            Gestionar
                        </Button>
                    );

                    let actionBtn = btnGestionar;
                    if (task.status === 'En Preparación' || (isOutbound && (!task.status || task.status === 'Pendiente'))) {
                        actionBtn = (
                            <Button size="sm" style={{ background: '#10b981', color: 'white', border: 'none', width: '100%' }} icon={Package} onClick={() => setActionModal({ isOpen: true, type: 'prepare_shipping', task })}>
                                Verificación HW
                            </Button>
                        );
                    } else if (task.status === 'Para Coordinar') {
                        actionBtn = (
                            <Button size="sm" style={{ background: '#3b82f6', color: 'white', border: 'none', width: '100%' }} icon={Calendar} onClick={() => {
                                setScheduleData({
                                    method: task.method || '',
                                    delivery_person: task.deliveryPerson || task.delivery_person || '',
                                    date: task.date || '',
                                    time_slot: task.time_slot || 'AM',
                                    tracking_number: task.tracking_number || '',
                                    address: task.address || task.parentAddress || '',
                                    coordinated_by: task.coordinated_by || task.coordinatedBy || '',
                                    deliveryInfo: task.deliveryInfo || {}
                                });
                                setActionModal({ isOpen: true, type: 'schedule_appointment', task });
                            }}>
                                Agendar Cita
                            </Button>
                        );
                    }

                    return (
                        <div key={task.id} className="ticket-card-mobile mobile-only">
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                <div>
                                    <div style={{ fontWeight: 800, color: 'var(--text-main)', fontSize: '1rem', marginBottom: '4px' }}>
                                        {task.ticket_id}
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <div style={{ fontWeight: 600 }}>{task.displayRequester}</div>
                                        {task.hasNewNotes && (
                                            <div title={task.hasUnreadChat ? "Nuevo mensaje sin leer" : "Tiene notas adicionales"} className={task.hasUnreadChat ? "unread-badge-v2" : ""} style={{ color: task.hasUnreadChat ? 'white' : 'var(--primary-color)', display: 'flex' }}>
                                                <MessageSquare size={14} fill={task.hasUnreadChat ? 'white' : 'none'} stroke={task.hasUnreadChat ? 'none' : 'currentColor'} />
                                            </div>
                                        )}
                                    </div>
                                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                                        {task.subject}
                                    </div>
                                </div>
                                <Badge variant={getStatusVariant(task.status || 'Pendiente')} style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem' }}>
                                    {task.status || 'Pendiente'}
                                </Badge>
                            </div>

                            <div style={{ background: 'var(--background)', padding: '0.75rem', borderRadius: '6px', fontSize: '0.85rem' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                                    <MapPin size={14} className={task.isOutOfSync ? "text-warning" : "text-secondary-400"} />
                                    <span style={{ color: task.isOutOfSync ? 'var(--warning-color)' : 'inherit' }}>
                                        {task.displayAddress}{task.floorDept ? `, ${task.floorDept}` : ''}
                                    </span>
                                </div>
                                
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                                    <Truck size={14} className="text-secondary-400" />
                                    <span style={{ fontWeight: 600 }}>
                                        {task.method || 'Medio no definido'}
                                    </span>
                                    {task.tracking_number && (
                                        <TrackingBadge method={task.method} trackingNumber={task.tracking_number} />
                                    )}
                                </div>

                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <User size={14} className="text-secondary-400" />
                                    <span>
                                        {task.deliveryPerson || task.delivery_person || 'Sin Asignar'}
                                    </span>
                                    {task.date && (
                                        <span style={{ color: 'var(--primary-color)', fontWeight: 600, fontSize: '0.8rem', marginLeft: 'auto' }}>
                                            {task.date.split('T')[0]} | {task.time_slot || 'AM'}
                                        </span>
                                    )}
                                </div>
                            </div>

                            <div style={{ marginTop: '0.5rem' }}>
                                {actionBtn}
                            </div>
                        </div>
                    );
                })}
            </Card>

            {/* MODALS */}
            
            {/* 1. Modal Prepare Shipping (Verificación HW) */}
            <Modal
                isOpen={actionModal.isOpen && actionModal.type === 'prepare_shipping'}
                onClose={handleModalClose}
                title="Verificación HW (Preparar Envío)"
            >
                {actionModal.task && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', padding: '1rem' }}>
                        <div style={{ background: 'rgba(37, 99, 235, 0.05)', padding: '1rem', borderRadius: 'var(--radius-md)', border: '1px solid rgba(37, 99, 235, 0.2)' }}>
                            <h4 style={{ fontWeight: 600, color: 'var(--text-main)', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <Package size={18} />
                                Activos a preparar para el envío
                            </h4>
                            <form onSubmit={handleScanSubmit} style={{ marginBottom: '1rem' }}>
                                <div style={{ display: 'flex', gap: '0.5rem' }}>
                                    <input 
                                        type="text" 
                                        className="form-input" 
                                        placeholder="Escanea o ingresa número de serie..." 
                                        value={scanInput}
                                        onChange={(e) => setScanInput(e.target.value)}
                                        autoFocus
                                    />
                                    <Button type="submit" variant="secondary">Confirmar</Button>
                                </div>
                            </form>
                            {actionModal.task.assets && actionModal.task.assets.length > 0 ? (
                                <ul style={{ listStyleType: 'none', paddingLeft: '0', margin: 0, color: 'var(--text-secondary)' }}>
                                    {actionModal.task.assets.map((asset, i) => {
                                        const isScanned = asset.serial && scannedAssets[asset.serial];
                                        const isManualCheck = !asset.serial && manualChecks[`${asset.type}-${i}`];
                                        const fullAsset = asset.serial ? assets.find(a => String(a.serial).trim().toLowerCase() === String(asset.serial).trim().toLowerCase()) : null;
                                        const assetSource = fullAsset || asset;
                                        
                                        let locationInfo = '';
                                        if (assetSource.locationId) {
                                            const wh = warehouseLocations?.find(w => String(w.id) === String(assetSource.locationId));
                                            locationInfo = wh ? wh.id : 'Depósito Desconocido';
                                        } else {
                                            locationInfo = assetSource.boxNumber || assetSource.assignee || 'Sin ubicación';
                                        }

                                        
                                        return (
                                            <li key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem', background: 'var(--surface)', padding: '0.75rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
                                                {asset.serial ? (
                                                    <div style={{ color: isScanned ? 'var(--success-color)' : 'var(--text-secondary)' }}>
                                                        <CheckCircle2 size={18} />
                                                    </div>
                                                ) : (
                                                    <input 
                                                        type="checkbox" 
                                                        checked={isManualCheck || false}
                                                        onChange={(e) => setManualChecks(prev => ({...prev, [`${asset.type}-${i}`]: e.target.checked}))}
                                                    />
                                                )}
                                                <div>
                                                    <div style={{ fontWeight: 500, color: 'var(--text-main)' }}>
                                                        {asset.type} {asset.model}
                                                    </div>
                                                    {asset.serial && (
                                                        <div style={{ fontSize: '0.8rem', display: 'flex', gap: '0.75rem' }}>
                                                            <strong>SN: {asset.serial}</strong>
                                                            {locationInfo && (
                                                                <span style={{ color: 'var(--primary-color)' }}>
                                                                    <MapPin size={12} style={{ display: 'inline', marginRight: '2px' }}/>
                                                                    {locationInfo}
                                                                </span>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            </li>
                                        );
                                    })}
                                </ul>
                            ) : (
                                <p style={{ color: 'var(--text-secondary)', fontStyle: 'italic', fontSize: '0.9rem' }}>No hay activos específicos listados. Verifique el detalle del caso principal.</p>
                            )}
                        </div>
                        
                        <div style={{ padding: '1rem', border: '1px dashed var(--border)', borderRadius: 'var(--radius-md)' }}>
                            <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
                                Por favor, asegúrese de que todos los dispositivos y accesorios están dentro de la caja listos para ser despachados e imprima la etiqueta.
                            </p>
                            <Button 
                                variant="outline" 
                                icon={Printer} 
                                onClick={() => handlePrintDeliveryLabel(actionModal.task)}
                                style={{ width: '100%', marginBottom: '1rem' }}
                            >
                                Imprimir Remito / Etiqueta
                            </Button>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '1rem' }}>
                            <Button variant="outline" onClick={handleModalClose}>
                                Cancelar
                            </Button>
                            <Button variant="primary" disabled={
                                actionModal.task.assets?.some((asset, i) => 
                                    (asset.serial && !scannedAssets[asset.serial]) || 
                                    (!asset.serial && !manualChecks[`${asset.type}-${i}`])
                                )
                            } onClick={async () => {
                                await updateLogisticsTask(actionModal.task.id, { status: 'Para Coordinar' });
                                handleModalClose();
                            }}>
                                Confirmar Caja Preparada
                            </Button>
                        </div>
                    </div>
                )}
            </Modal>

            {/* 2. Modal Schedule Appointment */}
            <Modal
                isOpen={actionModal.isOpen && actionModal.type === 'schedule_appointment'}
                onClose={() => setActionModal({ isOpen: false, type: null, task: null })}
                title="Agendar Cita (Coordinar Logística)"
            >
                {actionModal.task && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', padding: '1rem' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                            <div className="form-group">
                                <label className="form-label">Fecha de Envío/Retiro</label>
                                <input 
                                    type="date" 
                                    className="form-input" 
                                    value={scheduleData.date}
                                    onChange={e => setScheduleData({...scheduleData, date: e.target.value})}
                                />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Turno (AM / PM)</label>
                                <div style={{ display: 'flex', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
                                    {['AM', 'PM'].map(turno => (
                                        <button
                                            key={turno}
                                            type="button"
                                            onClick={() => setScheduleData({...scheduleData, time_slot: turno})}
                                            style={{
                                                flex: 1,
                                                padding: '0.625rem',
                                                border: 'none',
                                                background: scheduleData.time_slot === turno ? 'var(--primary-color)' : 'transparent',
                                                color: scheduleData.time_slot === turno ? 'white' : 'var(--text-secondary)',
                                                fontWeight: scheduleData.time_slot === turno ? 600 : 400,
                                                cursor: 'pointer',
                                                transition: 'all 0.2s'
                                            }}
                                        >
                                            {turno}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>

                        <div className="form-group">
                            <label className="form-label">Medio Proveedor</label>
                            <select
                                className="form-select"
                                value={scheduleData.method}
                                onChange={e => setScheduleData({...scheduleData, method: e.target.value})}
                            >
                                <option value="">Seleccionar...</option>
                                <option value="Propio">Repartidor Propio (IT)</option>
                                <option value="Correo Argentino">Correo Argentino</option>
                                <option value="Andreani">Andreani</option>
                                <option value="FedEx">FedEx</option>
                                <option value="DHL">DHL</option>
                                <option value="OCA">OCA</option>
                                <option value="Otro">Otro Privado</option>
                            </select>
                        </div>

                        {scheduleData.method === 'Propio' && (
                            <div className="form-group">
                                <label className="form-label">Conductor / Responsable</label>
                                <select 
                                    className="form-select"
                                    value={scheduleData.delivery_person}
                                    onChange={e => setScheduleData({...scheduleData, delivery_person: e.target.value})}
                                >
                                    <option value="">Seleccionar responsable...</option>
                                    {users.filter(u => u.isDriver || u.role === 'Conductor' || u.role === 'admin' || u.role === 'Administrador' || u.role === 'Administrativo' || u.role === 'Gerencial').map(u => (
                                        <option key={u.id} value={u.name}>{u.name}</option>
                                    ))}
                                </select>
                            </div>
                        )}

                        <div className="form-group">
                            <label className="form-label">Dirección de Entrega / Retiro</label>
                            <input
                                className="form-input"
                                placeholder="Ej: Av. Siempreviva 123"
                                value={scheduleData.address}
                                onChange={e => setScheduleData({...scheduleData, address: e.target.value})}
                            />
                        </div>

                        <div className="form-group">
                            <label className="form-label">Coordinado por</label>
                            <select
                                className="form-select"
                                value={scheduleData.coordinated_by}
                                onChange={e => setScheduleData({...scheduleData, coordinated_by: e.target.value})}
                            >
                                <option value="">Seleccionar responsable...</option>
                                {currentUser?.name && (
                                    <option value={currentUser.name}>
                                        {currentUser.name} (Tú)
                                    </option>
                                )}
                                {users
                                    .filter(u => u.name !== currentUser?.name)
                                    .map(u => (
                                        <option key={u.id} value={u.name}>
                                            {u.name} {u.role ? `(${u.role})` : ''}
                                        </option>
                                    ))
                                }
                            </select>
                        </div>

                        <div className="form-group">
                            <label className="form-label">Notas Adicionales (se muestran en el Remito impreso)</label>
                            <textarea
                                className="form-input"
                                value={scheduleData.deliveryInfo?.notes || ''}
                                onChange={e => setScheduleData({...scheduleData, deliveryInfo: { ...(scheduleData.deliveryInfo || {}), notes: e.target.value }})}
                                placeholder="Escriba aquí notas o aclaraciones que se imprimirán en el remito..."
                                style={{
                                    minHeight: '80px',
                                    resize: 'vertical',
                                    width: '100%',
                                    padding: '0.625rem 0.875rem'
                                }}
                            />
                        </div>

                        {scheduleData.method && scheduleData.method !== 'Propio' && (
                            <div className="form-group">
                                <label className="form-label">Tracking Number (Opcional)</label>
                                <input 
                                    type="text" 
                                    className="form-input" 
                                    placeholder="TN: ..."
                                    value={scheduleData.tracking_number}
                                    onChange={e => setScheduleData({...scheduleData, tracking_number: e.target.value})}
                                />
                            </div>
                        )}

                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '1rem' }}>
                            <Button variant="outline" onClick={() => setActionModal({ isOpen: false, type: null, task: null })}>
                                Cancelar
                            </Button>
                            <Button variant="primary" onClick={async () => {
                                await updateLogisticsTask(actionModal.task.id, {
                                    date: scheduleData.date,
                                    time_slot: scheduleData.time_slot,
                                    method: scheduleData.method,
                                    delivery_person: scheduleData.delivery_person,
                                    deliveryPerson: scheduleData.delivery_person,
                                    tracking_number: scheduleData.tracking_number,
                                    address: scheduleData.address,
                                    deliveryInfo: scheduleData.deliveryInfo,
                                    status: 'En Transito',
                                    coordinated_by: scheduleData.coordinated_by || currentUser?.name || 'Sistema',
                                    coordinatedBy: scheduleData.coordinated_by || currentUser?.name || 'Sistema'
                                });
                                setActionModal({ isOpen: false, type: null, task: null });
                            }}>
                                Agendar y Pasar a Tránsito
                            </Button>
                        </div>
                    </div>
                )}
            </Modal>

            <style jsx>{`
                .hover-row:hover {
                    background-color: var(--background);
                }
                .tracking-badge-hover:hover {
                    filter: brightness(0.95);
                    transform: scale(1.02);
                }
            `}</style>
        </div>
    );
}
