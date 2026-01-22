"use client";
import React, { useState } from 'react';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Modal } from '../../components/ui/Modal';
import { useStore } from '../../../lib/store';
import { Filter, Search, ArrowRight, Upload, Trash2, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { useRef, useMemo } from 'react';

import { useRouter } from 'next/navigation';

export default function SFDCCasesPage() {
    const router = useRouter();
    const { sfdcCases, tickets, addTicket, importSfdcCases, clearSfdcCases, removeSfdcCase, lastImportCount, currentUser } = useStore();
    const [filter, setFilter] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedCase, setSelectedCase] = useState(null);
    const [newTicket, setNewTicket] = useState({ subject: '', requester: '', priority: 'Media', status: 'Abierto' });
    const [sortConfig, setSortConfig] = useState({ key: null, direction: 'ascending' });
    const [toast, setToast] = useState({ show: false, message: '', type: 'success' }); // Nuevo estado
    const fileInputRef = useRef(null);

    const showToast = (message, type = 'success') => {
        setToast({ show: true, message, type });
        setTimeout(() => setToast({ show: false, message: '', type: 'success' }), 3000);
    };

    // 1. Filtrado
    const filteredCases = useMemo(() => {
        return sfdcCases.filter(c =>
            c.subject.toLowerCase().includes(filter.toLowerCase()) ||
            c.requestedFor.toLowerCase().includes(filter.toLowerCase()) ||
            c.caseNumber.toLowerCase().includes(filter.toLowerCase())
        );
    }, [sfdcCases, filter]);

    // 2. Ordenamiento
    const sortedCases = useMemo(() => {
        let sortableItems = [...filteredCases];

        // Criterios Base: Si no hay ordenamiento manual, usamos Fecha (Desc) + Requested For (Asc)
        const key = sortConfig.key || 'dateOpened';
        const direction = sortConfig.key ? sortConfig.direction : 'descending';

        sortableItems.sort((a, b) => {
            let aValue = a[key];
            let bValue = b[key];

            // Manejo especial para números en strings (Age)
            if (key === 'age') {
                aValue = parseInt(aValue) || 0;
                bValue = parseInt(bValue) || 0;
            }
            // Manejo especial para fechas
            if (key === 'dateOpened') {
                aValue = new Date(aValue).getTime();
                bValue = new Date(bValue).getTime();
            }

            if (aValue < bValue) {
                return direction === 'ascending' ? -1 : 1;
            }
            if (aValue > bValue) {
                return direction === 'ascending' ? 1 : -1;
            }

            // Orden secundario: Agrupar por Requested For si el primario es igual
            if (key !== 'requestedFor') {
                const reqA = a.requestedFor || '';
                const reqB = b.requestedFor || '';
                if (reqA < reqB) return -1;
                if (reqA > reqB) return 1;
            }

            return 0;
        });

        return sortableItems;
    }, [filteredCases, sortConfig]);

    const requestSort = (key) => {
        let direction = 'ascending';
        if (sortConfig.key === key && sortConfig.direction === 'ascending') {
            direction = 'descending';
        }
        setSortConfig({ key, direction });
    };

    const SortIcon = ({ column }) => {
        if (sortConfig.key !== column) return <ArrowUpDown size={14} style={{ opacity: 0.3, marginLeft: '4px' }} />;
        return sortConfig.direction === 'ascending'
            ? <ArrowUp size={14} style={{ marginLeft: '4px' }} />
            : <ArrowDown size={14} style={{ marginLeft: '4px' }} />;
    };

    const Th = ({ id, children, width }) => (
        <th
            style={{
                padding: '1rem',
                fontWeight: 600,
                color: 'var(--text-secondary)',
                fontSize: '0.875rem',
                cursor: 'pointer',
                userSelect: 'none',
                width: width
            }}
            onClick={() => requestSort(id)}
        >
            <div style={{ display: 'flex', alignItems: 'center' }}>
                {children}
                <SortIcon column={id} />
            </div>
        </th>
    );

    const handleOpenCreateService = (sfdcCase) => {
        setSelectedCase(sfdcCase);
        setNewTicket({
            subject: `[SFDC-${sfdcCase.caseNumber}] ${sfdcCase.subject}`,
            requester: sfdcCase.requestedFor,
            priority: sfdcCase.priority === 'High' ? 'Alta' : 'Media',
            status: 'Abierto',
            logistics: {
                address: sfdcCase.mailingStreet && sfdcCase.country ? `${sfdcCase.mailingStreet}, ${sfdcCase.country} ${sfdcCase.zipCode}` : '',
                phone: sfdcCase.mobile || '',
                email: sfdcCase.email || '',
                type: 'Entrega'
            }
        });
        setIsModalOpen(true);
    };

    const handleCreateService = (e) => {
        e.preventDefault();
        const createdTicket = addTicket(newTicket);
        if (selectedCase) {
            removeSfdcCase(selectedCase.caseNumber);
        }
        setIsModalOpen(false);
        // Navegación automática al detalle del nuevo ticket
        router.push(`/dashboard/tickets/${createdTicket.id}`);
    };

    const handleFileUpload = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            const text = event.target.result;

            // Parser CSV RFC 4180 robusto (Máquina de estados)
            const parseCSV = (str) => {
                const arr = [];
                let quote = false;  // 'true' means we're inside a quoted field
                let col = 0;        // Current column index
                let row = 0;        // Current row index
                let c = 0;          // Current character index
                let val = '';       // Current field value

                for (; c < str.length; c++) {
                    const cc = str[c]; // Current character
                    const nc = str[c + 1]; // Next character

                    // Check for double quotes
                    if (cc === '"') {
                        if (quote && nc === '"') {
                            // Escaped quote ("") inside a quoted field -> add single quote
                            val += '"';
                            c++; // Skip next quote
                        } else {
                            // Toggle quote state
                            quote = !quote;
                        }
                    }
                    // Check for comma (field separator)
                    else if (cc === ',' && !quote) {
                        if (!arr[row]) arr[row] = [];
                        arr[row][col] = val;
                        val = '';
                        col++;
                    }
                    // Check for newline (record separator)
                    else if ((cc === '\r' || cc === '\n') && !quote) {
                        if (cc === '\r' && nc === '\n') c++; // Skip \n if \r\n

                        // Save last field of the row
                        if (!arr[row]) arr[row] = [];
                        arr[row][col] = val;

                        // Move to next row
                        val = '';
                        row++;
                        col = 0;
                    }
                    // Regular character
                    else {
                        val += cc;
                    }
                }

                // Add the very last field if file doesn't end with newline
                if (val || (arr[row] && arr[row].length > 0)) {
                    if (!arr[row]) arr[row] = [];
                    arr[row][col] = val;
                }

                return arr;
            };

            const data = parseCSV(text);

            if (data.length < 2) return;

            // Headers are first row
            const headers = data[0].map(h => h.trim());
            const rows = data.slice(1);

            const newCases = [];

            // Helper to get value by header name
            const getVal = (rowValues, colName) => {
                const index = headers.indexOf(colName);
                return index !== -1 ? (rowValues[index] || '').trim() : '';
            };

            for (let i = 0; i < rows.length; i++) {
                const rowValues = rows[i];
                if (!rowValues || rowValues.length === 0) continue;

                // Validate valid row (must have Case Number)
                const caseNum = getVal(rowValues, 'Case Number');
                if (!caseNum) continue;

                // Cálculo de Age basado en fecha de apertura
                const openedRaw = getVal(rowValues, 'Date/Time Opened');
                let ageDisplay = '0 días';
                let openedDisplay = openedRaw;

                if (openedRaw) {
                    const openedDate = new Date(openedRaw);
                    if (!isNaN(openedDate.getTime())) {
                        const now = new Date();
                        const diffTime = Math.abs(now - openedDate);
                        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
                        ageDisplay = diffDays === 1 ? '1 día' : `${diffDays} días`;
                        openedDisplay = openedDate.toLocaleDateString(); // Solo fecha
                    }
                }

                newCases.push({
                    caseNumber: caseNum,
                    status: getVal(rowValues, 'Status') || 'New',
                    priority: getVal(rowValues, 'Priority') || 'Medium',
                    dateOpened: openedDisplay, // Ahora guarda solo la fecha formateada
                    startDate: getVal(rowValues, 'Start Date') || '',
                    subject: getVal(rowValues, 'Subject') || 'Sin Asunto',
                    caseRecordType: getVal(rowValues, 'Case Record Type') || '',
                    resourceType: getVal(rowValues, 'Resource Type') || '',
                    requestedFor: getVal(rowValues, 'Requested For') || 'Desconocido',
                    email: getVal(rowValues, 'Contact: Email') || '',
                    mailingStreet: getVal(rowValues, 'Mailing Street') || '',
                    mobile: getVal(rowValues, 'Mobile') || '',
                    zipCode: getVal(rowValues, 'Mailing Zip/Postal Code') || '',
                    caseOwner: getVal(rowValues, 'Case Owner Alias') || '',
                    age: ageDisplay, // Age calculada
                    description: getVal(rowValues, 'Description') || '',
                    country: getVal(rowValues, 'Mailing Country') || ''
                });
            }

            // Filtrar duplicados en INBOX
            const existingInboxCaseNumbers = new Set(sfdcCases.map(c => c.caseNumber));

            // Filtrar duplicados ya convertidos a SERVICIOS/TICKETS
            // Buscamos tickets cuyo asunto comience con [SFDC-XXXXX]
            const existingConvertedCaseNumbers = new Set(tickets.map(t => {
                const match = t.subject.match(/^\[SFDC-(\d+)\]/);
                return match ? match[1] : null;
            }).filter(Boolean));

            const uniqueCases = newCases.filter(c => {
                const isInData = existingInboxCaseNumbers.has(c.caseNumber);
                const isConverted = existingConvertedCaseNumbers.has(c.caseNumber);
                return !isInData && !isConverted;
            });

            if (uniqueCases.length > 0) {
                importSfdcCases(uniqueCases);
                const skippedCount = newCases.length - uniqueCases.length;
                showToast(`Se añadieron ${uniqueCases.length} casos nuevos. (${skippedCount} omitidos)`, 'success');
            } else {
                showToast('No se encontraron casos nuevos.', 'info');
            }

            e.target.value = null; // Reset input
        };
        reader.readAsText(file);
    };

    // 3. Estadísticas
    const stats = useMemo(() => {
        const counts = {};
        sfdcCases.forEach(c => {
            const s = c.status || 'Desconocido';
            counts[s] = (counts[s] || 0) + 1;
        });
        return counts;
    }, [sfdcCases]);

    const getStatusColor = (status) => {
        const s = status.toLowerCase();
        if (s.includes('new')) return '#3b82f6'; // Blue
        if (s.includes('progress')) return '#eab308'; // Yellow
        if (s.includes('escalated')) return '#ef4444'; // Red
        if (s.includes('hold') || s.includes('waiting')) return '#f97316'; // Orange
        if (s.includes('closed') || s.includes('resolved')) return '#22c55e'; // Green
        return '#94a3b8'; // Grey default
    };

    return (
        <div>
            {/* Toast Notification */}
            {toast.show && (
                <div style={{
                    position: 'fixed',
                    bottom: '2rem',
                    right: '2rem',
                    backgroundColor: toast.type === 'success' ? '#10b981' : '#3b82f6',
                    color: 'white',
                    padding: '1rem 1.5rem',
                    borderRadius: 'var(--radius-md)',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                    zIndex: 1000,
                    animation: 'fadeIn 0.3s ease-out',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    fontWeight: 500
                }}>
                    {toast.message}
                </div>
            )}
            <div style={{ marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                    <h1 style={{ fontSize: '1.8rem', fontWeight: 700, color: 'var(--text-main)' }}>Casos Salesforce (SFDC)</h1>
                    <p style={{ color: 'var(--text-secondary)' }}>Importar y gestionar casos provenientes de Salesforce.</p>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', alignItems: 'flex-end' }}>
                    <div>
                        <input
                            type="file"
                            ref={fileInputRef}
                            style={{ display: 'none' }}
                            accept=".csv"
                            onChange={handleFileUpload}
                        />
                        <Button icon={Upload} onClick={() => fileInputRef.current.click()}>
                            Importar CSV
                        </Button>
                    </div>
                    {(currentUser?.role === 'admin' || currentUser?.role === 'Gerencial') && (
                        <button
                            onClick={() => {
                                if (confirm('¿Estás seguro de borrar todos los casos importados?')) {
                                    clearSfdcCases();
                                }
                            }}
                            style={{
                                background: 'transparent',
                                border: 'none',
                                color: '#ef4444',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.5rem',
                                cursor: 'pointer',
                                fontSize: '0.875rem',
                                padding: '0.25rem 0.5rem'
                            }}
                        >
                            <Trash2 size={16} /> Limpiar Todo (Dev)
                        </button>
                    )}
                </div>
            </div>

            {/* Dashboard / Metrics Section */}
            {sfdcCases.length > 0 && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
                    {/* Total Backlog Card */}
                    <Card>
                        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', justifyContent: 'center' }}>
                            <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                TOTAL BACKLOG
                            </div>
                            <div style={{ fontSize: '2.5rem', fontWeight: 800, color: 'var(--text-main)', marginTop: '0.5rem' }}>
                                {sfdcCases.length}
                            </div>
                            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Casos importados</div>
                        </div>
                    </Card>

                    {/* New Imported Card */}
                    <Card style={{ borderLeft: '4px solid #8b5cf6', background: 'rgba(139, 92, 246, 0.03)' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', justifyContent: 'center' }}>
                            <div style={{ fontSize: '0.875rem', color: '#8b5cf6', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                Nuevos Importados
                            </div>
                            <div style={{ fontSize: '2.5rem', fontWeight: 800, color: '#8b5cf6', marginTop: '0.5rem' }}>
                                +{lastImportCount}
                            </div>
                            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>En la última sincronización</div>
                        </div>
                    </Card>

                    {/* Dynamic Status Cards */}
                    {Object.entries(stats).map(([status, count]) => (
                        <Card key={status}>
                            <div style={{ display: 'flex', flexDirection: 'column', height: '100%', justifyContent: 'space-between' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                    <div style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-main)' }}>{status}</div>
                                    <div style={{
                                        width: '12px',
                                        height: '12px',
                                        borderRadius: '50%',
                                        backgroundColor: getStatusColor(status),
                                        boxShadow: `0 0 8px ${getStatusColor(status)}`
                                    }} />
                                </div>
                                <div style={{ marginTop: '1rem' }}>
                                    <div style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--text-main)' }}>{count}</div>
                                    <div style={{ width: '100%', height: '4px', background: 'var(--border)', borderRadius: '2px', marginTop: '0.5rem', overflow: 'hidden' }}>
                                        <div style={{
                                            width: `${(count / sfdcCases.length) * 100}%`,
                                            height: '100%',
                                            background: getStatusColor(status)
                                        }} />
                                    </div>
                                </div>
                            </div>
                        </Card>
                    ))}
                </div>
            )}

            <Card>
                <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
                    <div style={{ position: 'relative', flex: 1, minWidth: '300px' }}>
                        <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
                        <input
                            type="text"
                            placeholder="Buscar por Case #, Asunto o Solicitante..."
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
                </div>

                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                        <thead>
                            <tr style={{ borderBottom: '1px solid var(--border)' }}>
                                <Th id="caseNumber">Case #</Th>
                                <Th id="status">Status</Th>
                                <Th id="age">Age</Th>
                                <Th id="dateOpened">Opened</Th>
                                <Th id="subject">Subject</Th>
                                <Th id="requestedFor">Requested For</Th>
                                <th style={{ padding: '1rem', fontWeight: 600, color: 'var(--text-secondary)', fontSize: '0.875rem' }}>Acción</th>
                            </tr>
                        </thead>
                        <tbody>
                            {sortedCases.map((c) => (
                                <tr key={c.caseNumber} style={{ borderBottom: '1px solid var(--border)' }}>
                                    <td style={{ padding: '1rem', fontWeight: 500 }}>{c.caseNumber}</td>
                                    <td style={{ padding: '1rem' }}>
                                        <Badge variant="outline">{c.status}</Badge>
                                    </td>
                                    <td style={{ padding: '1rem', color: 'var(--text-secondary)' }}>{c.age}</td>
                                    <td style={{ padding: '1rem', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>{c.dateOpened}</td>
                                    <td style={{ padding: '1rem', fontWeight: 500 }}>
                                        <div style={{ maxWidth: '250px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={c.subject}>
                                            {c.subject}
                                        </div>
                                    </td>
                                    <td style={{ padding: '1rem' }}>{c.requestedFor}</td>
                                    <td style={{ padding: '1rem' }}>
                                        <Button
                                            size="sm"
                                            icon={ArrowRight}
                                            onClick={() => handleOpenCreateService(c)}
                                        >
                                            Crear Servicio
                                        </Button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </Card>

            <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Crear Servicio desde SFDC">
                <form onSubmit={handleCreateService}>
                    {/* Resumen del Caso Original - Compacto y Visual */}
                    <div style={{
                        background: 'var(--background)',
                        borderRadius: 'var(--radius-md)',
                        padding: '1rem',
                        marginBottom: '1.5rem',
                        borderLeft: '4px solid var(--primary-color)'
                    }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                            <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--primary-color)', textTransform: 'uppercase' }}>Detalles SFDC</span>
                            <Badge variant="outline">Case #{selectedCase?.caseNumber}</Badge>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', fontSize: '0.85rem' }}>
                            <div>
                                <p style={{ color: 'var(--text-secondary)', margin: 0 }}>Prioridad</p>
                                <p style={{ fontWeight: 600, margin: 0 }}>{selectedCase?.priority || 'Media'}</p>
                            </div>
                            <div>
                                <p style={{ color: 'var(--text-secondary)', margin: 0 }}>Tipo de Recurso</p>
                                <p style={{ fontWeight: 600, margin: 0 }}>{selectedCase?.resourceType || 'N/A'}</p>
                            </div>
                            <div style={{ gridColumn: '1 / -1' }}>
                                <p style={{ color: 'var(--text-secondary)', margin: 0 }}>Dirección de Entrega</p>
                                <p style={{ fontWeight: 500, margin: 0, fontSize: '0.8rem' }}>
                                    {selectedCase?.mailingStreet}, {selectedCase?.country}
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Formulario de Creación */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                        <div className="form-group">
                            <label className="form-label" style={{ marginBottom: '0.5rem', display: 'block' }}>Asunto del Servicio</label>
                            <input
                                required
                                className="form-input"
                                value={newTicket.subject}
                                onChange={e => setNewTicket({ ...newTicket, subject: e.target.value })}
                            />
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                            <div className="form-group">
                                <label className="form-label" style={{ marginBottom: '0.5rem', display: 'block' }}>Solicitante</label>
                                <input
                                    required
                                    className="form-input"
                                    value={newTicket.requester}
                                    onChange={e => setNewTicket({ ...newTicket, requester: e.target.value })}
                                />
                            </div>
                            <div className="form-group">
                                <label className="form-label" style={{ marginBottom: '0.5rem', display: 'block' }}>Prioridad</label>
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
                        </div>
                    </div>

                    <div style={{
                        display: 'flex',
                        justifyContent: 'flex-end',
                        gap: '1rem',
                        marginTop: '2rem',
                        paddingTop: '1rem',
                        borderTop: '1px solid var(--border)'
                    }}>
                        <Button type="button" variant="secondary" onClick={() => setIsModalOpen(false)}>Cancelar</Button>
                        <Button type="submit">Generar Ticket</Button>
                    </div>
                </form>
            </Modal>
        </div>
    );
}
