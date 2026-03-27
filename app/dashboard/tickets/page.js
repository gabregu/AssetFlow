"use client";
import React, { useState, useRef } from 'react';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { useStore } from '../../../lib/store';
import { ServiceMap } from '../../components/ui/ServiceMap';
import { Filter, Search, Eye, Trash2, Archive, AlertCircle, Clock, CheckCircle2, Loader2, Map, ChevronDown, ChevronUp, Upload } from 'lucide-react';
import Link from 'next/link';
import { CountryFilter } from '../../components/layout/CountryFilter';
import { getStatusVariant } from './constants';

export default function TicketsPage() {
    const { tickets, assets, sfdcCases, addTicket, deleteTickets, updateTicket, importSfdcCases, currentUser, users, countryFilter, logisticsTasks } = useStore();
    const fileInputRef = useRef(null);
    const [toast, setToast] = useState({ show: false, message: '', type: 'success' });

    const showToast = (message, type = 'success') => {
        setToast({ show: true, message, type });
        setTimeout(() => setToast({ show: false, message: '', type: 'success' }), 5000);
    };


    const [filter, setFilter] = useState('');
    const [sortConfig, setSortConfig] = useState({ key: 'date', direction: 'desc' });
    const [columnFilters, setColumnFilters] = useState({ status: 'All', requester: '' });
    const [selectedTickets, setSelectedTickets] = useState([]);

    const [showMap, setShowMap] = useState(false);
    const [filterType, setFilterType] = useState('ALL'); // 'ALL', 'DELIVERY', 'COLLECTION', 'NEW_HIRE'

    const canDelete = currentUser?.role === 'admin' || currentUser?.role === 'Administrativo';

    const handleFileUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (event) => {
            try {
                let text = event.target.result;
                if (text.includes('"Mailing Country"wner Alias"')) {
                    text = text.replace('"Mailing Country"wner Alias"', '"Mailing Country","Case Owner Alias"');
                }

                const parseCSV = (str) => {
                    const arr = [];
                    let quote = false, col = 0, row = 0, c = 0, val = '';
                    for (; c < str.length; c++) {
                        const cc = str[c], nc = str[c + 1];
                        if (cc === '"') {
                            if (quote && nc === '"') { val += '"'; c++; }
                            else { quote = !quote; }
                        } else if (cc === ',' && !quote) {
                            if (!arr[row]) arr[row] = [];
                            arr[row][col] = val; val = ''; col++;
                        } else if ((cc === '\r' || cc === '\n') && !quote) {
                            if (cc === '\r' && nc === '\n') c++;
                            if (!arr[row]) arr[row] = [];
                            arr[row][col] = val; val = ''; row++; col = 0;
                        } else {
                            val += cc;
                        }
                    }
                    if (val || (arr[row] && arr[row].length > 0)) {
                        if (!arr[row]) arr[row] = [];
                        arr[row][col] = val;
                    }
                    return arr;
                };

                const data = parseCSV(text);
                if (data.length < 2) return;

                const headers = data[0].map(h => h.trim().replace(/^"|"$/g, ''));
                const rows = data.slice(1);
                
                const getVal = (rowValues, colName) => {
                    const index = headers.indexOf(colName);
                    if (index === -1) {
                        const indexAlt = headers.findIndex(h => h.toLowerCase() === colName.toLowerCase());
                        return indexAlt !== -1 ? (rowValues[indexAlt] || '').trim() : '';
                    }
                    return (rowValues[index] || '').trim();
                };

                const newCases = [];
                for (let i = 0; i < rows.length; i++) {
                    const rowValues = rows[i];
                    if (!rowValues || rowValues.length === 0) continue;
                    
                    const caseNum = getVal(rowValues, 'Case Number');
                    if (!caseNum) continue;

                    const mailingCountry = getVal(rowValues, 'Mailing Country') || '';
                    if (!mailingCountry) {
                        alert(`Error en fila ${i + 2}: Falta "Mailing Country". Abortando importación.`);
                        return;
                    }

                    // Cálculo de Age basado en fecha de apertura (Copiado de salesforce-cases/page.js para consistencia)
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
                        subject: getVal(rowValues, 'Subject') || 'Sin Asunto',
                        requestedFor: getVal(rowValues, 'Requested For') || 'Desconocido',
                        priority: getVal(rowValues, 'Priority') || 'Medium',
                        status: getVal(rowValues, 'Status') || 'New',
                        country: mailingCountry,
                        mailingStreet: getVal(rowValues, 'Mailing Street') || '',
                        mobile: getVal(rowValues, 'Mobile') || '',
                        email: getVal(rowValues, 'Contact: Email') || '',
                        zipCode: getVal(rowValues, 'Mailing Zip/Postal Code') || '',
                        dateOpened: openedDisplay,
                        startDate: getVal(rowValues, 'Start Date') || '',
                        caseRecordType: getVal(rowValues, 'Case Record Type') || '',
                        resourceType: getVal(rowValues, 'Resource Type') || '',
                        caseOwner: getVal(rowValues, 'Case Owner Alias') || '',
                        age: ageDisplay,
                        description: getVal(rowValues, 'Description') || ''
                    });
                }
                
                // --- INTEGRACION: Importar también como casos SFDC ---
                if (newCases.length > 0) {
                    await importSfdcCases(newCases);
                }

                const normalizeName = (name) => (name || '').normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
                const normalizeCountry = (country) => (country || '').toLowerCase().trim();

                const groupedCases = {};
                for (const c of newCases) {
                    const key = `${normalizeName(c.requestedFor)}|${normalizeCountry(c.country)}`;
                    if (!groupedCases[key]) groupedCases[key] = [];
                    groupedCases[key].push(c);
                }

                let ticketsCreated = 0;
                let ticketsUpdated = 0;
                let casesProcessed = 0;

                for (const key of Object.keys(groupedCases)) {
                    const group = groupedCases[key];
                    if (group.length === 0) continue;

                    const repCase = group[0];
                    const reqNameNorm = normalizeName(repCase.requestedFor);
                    const countryNorm = normalizeCountry(repCase.country);

                    const existingActiveTicket = tickets.find(t => {
                        const isNotResolved = t.status !== 'Resuelto' && t.status !== 'Cerrado' && t.status !== 'Servicio Facturado' && t.status !== 'Caso SFDC Cerrado';
                        const tReqNorm = normalizeName(t.requester);
                        let tCountryNorm = '';
                        if (t.logistics?.address) tCountryNorm = normalizeCountry(t.logistics.address);
                        
                        const hasSameReq = (tReqNorm === reqNameNorm || (tReqNorm.length > 3 && reqNameNorm.length > 3 && (tReqNorm.includes(reqNameNorm) || reqNameNorm.includes(tReqNorm))));
                        const hasSameCountry = tCountryNorm.includes(countryNorm) || countryNorm.includes(tCountryNorm);

                        return isNotResolved && hasSameReq && (hasSameCountry || !tCountryNorm);
                    });

                    if (existingActiveTicket) {
                        let updatedNotes = existingActiveTicket.internalNotes ? [...existingActiveTicket.internalNotes] : [];
                        let addedToExisting = 0;

                        group.forEach(c => {
                            const alreadyExists = existingActiveTicket.subject.includes(c.caseNumber) ||
                                                  updatedNotes.some(n => n.includes(c.caseNumber));
                                                  
                            if (!alreadyExists) {
                                const msg = `• Caso Adicional Agregado via CSV: [SFDC-${c.caseNumber}] ${c.subject}`;
                                updatedNotes.push(msg);
                                addedToExisting++;
                                casesProcessed++;
                            }
                        });

                        if (addedToExisting > 0) {
                            await updateTicket(existingActiveTicket.id, {
                                internalNotes: updatedNotes,
                                subject: existingActiveTicket.subject + (existingActiveTicket.subject.includes('casos agrupados') ? '' : ` (+ casos agrupados)`)
                            });
                            ticketsUpdated++;
                        }
                    } else {
                        const mainCase = group[0];
                        const additionalCases = group.slice(1);
                        
                        let subject = `[SFDC-${mainCase.caseNumber}] ${mainCase.subject}`;
                        let internalNotes = [];

                        if (additionalCases.length > 0) {
                            subject += ` (+ ${additionalCases.length} casos agrupados)`;
                            const siblingNotes = additionalCases.map(s => `• Caso Adicional: [SFDC-${s.caseNumber}] ${s.subject}`).join('\n');
                            internalNotes.push(`=== AUTOMATIZACIÓN: CASOS AGRUPADOS (CSV) ===\nSe importaron múltiples casos para ${mainCase.requestedFor}:\n${siblingNotes}`);
                        }

                        const newTicketData = {
                            subject: subject,
                            requester: mainCase.requestedFor,
                            priority: mainCase.priority === 'High' ? 'Alta' : 'Media',
                            status: 'Abierto',
                            internalNotes: internalNotes,
                            logistics: {
                                address: mainCase.mailingStreet && mainCase.country ? `${mainCase.mailingStreet}, ${mainCase.country} ${mainCase.zipCode}` : mainCase.country,
                                phone: mainCase.mobile || '',
                                email: mainCase.email || '',
                                type: 'Entrega'
                            },
                            associatedCases: group.map(c => ({
                                caseNumber: c.caseNumber,
                                subject: c.subject,
                                status: c.status,
                                priority: c.priority,
                                dateOpened: c.dateOpened,
                                logistics: {
                                    address: c.mailingStreet && c.country ? `${c.mailingStreet}, ${c.country} ${c.zipCode}` : mainCase.country,
                                    phone: c.mobile || '',
                                    email: c.email || '',
                                    method: '',
                                    status: 'Pendiente'
                                }
                            }))
                        };

                        await addTicket(newTicketData);
                        ticketsCreated++;
                        casesProcessed += group.length;
                    }
                }

                showToast(`Importación completa: ${casesProcessed} casos procesados. ${ticketsCreated} servicios nuevos y ${ticketsUpdated} actualizados.`, 'success');

            } catch (err) {
                console.error("Error procesando CSV:", err);
                alert("Error al procesar el archivo CSV: " + err.message);
            }
            e.target.value = null; // reset 
        };
        reader.readAsText(file);
    };

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

            // Filtrado por Pais (Link with SFDC Case)
            let matchesCountry = true;
            if (countryFilter !== 'Todos') {
                let foundCountry = false;

                // 1. Try Address
                if (t.logistics?.address && t.logistics.address.toLowerCase().includes(countryFilter.toLowerCase())) {
                    matchesCountry = true;
                    foundCountry = true;
                }

                if (!foundCountry) {
                    // 2. Try SFDC match
                    const sfdcMatch = t.subject.match(/SFDC-(\d+)/);
                    if (sfdcMatch) {
                        const caseNum = sfdcMatch[1];
                        const sfdcCase = sfdcCases.find(c => c.caseNumber === caseNum);
                        if (sfdcCase && sfdcCase.country) {
                            matchesCountry = sfdcCase.country.toLowerCase().includes(countryFilter.toLowerCase());
                        } else {
                            matchesCountry = false;
                        }
                    } else {
                        matchesCountry = false;
                    }
                }
            }

            // Filtrado por Tipo (Delivery, Collection, New Hire)
            // Helper New Hire
            const isNewHire = (t) => {
                const isNewHireSubject = t.subject.toLowerCase().includes('new hire') || t.subject.toLowerCase().includes('nuevo ingreso');
                let isFutureDate = false;
                if (t.logistics?.date) {
                    const today = new Date();
                    today.setHours(0, 0, 0, 0);
                    const ticketDate = new Date(t.logistics.date);
                    if (!isNaN(ticketDate.getTime())) {
                        ticketDate.setHours(0, 0, 0, 0);
                        if (ticketDate > today) isFutureDate = true;
                    }
                }
                return isNewHireSubject || isFutureDate;
            };

            let matchesType = true;
            if (filterType === 'DELIVERY') {
                matchesType = !t.subject.toLowerCase().includes('collection') && !t.subject.toLowerCase().includes('offboarding') && !isNewHire(t);
            } else if (filterType === 'COLLECTION') {
                matchesType = t.subject.toLowerCase().includes('collection') || t.subject.toLowerCase().includes('offboarding');
            } else if (filterType === 'NEW_HIRE') {
                matchesType = isNewHire(t);
            }

            return matchesSearch && matchesStatus && matchesRequester && isNotResolved && matchesCountry && matchesType;
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
    }, [tickets, filter, sortConfig, columnFilters, countryFilter, filterType]);

    const statsByType = React.useMemo(() => {
        // Filter by country first to match the view logic roughly (ignoring status for now or keeping it consistent?)
        // The original logic in Cases filtered by country. Here we probably should too.
        // But `tickets` here includes all statuses. We usually care about active tickets for these counts.
        const activeTickets = tickets.filter(t => t.status !== 'Resuelto' && t.status !== 'Cerrado' && t.status !== 'Servicio Facturado' && t.status !== 'Caso SFDC Cerrado');

        const filteredByCountry = activeTickets.filter(t => {
            if (countryFilter === 'Todos') return true;
            // Reuse simplistic check or the complex one? Let's use simplified for perf, or copy complex if needed.
            // Complex matchesCountry logic from above is better but harder to extract inside useMemo without refactor.
            // Let's copy-paste the core logic for consistency.
            let matchesCountry = false;
            if (t.logistics?.address && t.logistics.address.toLowerCase().includes(countryFilter.toLowerCase())) matchesCountry = true;
            else {
                const sfdcMatch = t.subject.match(/SFDC-(\d+)/);
                if (sfdcMatch) {
                    const caseNum = sfdcMatch[1];
                    const sfdcCase = sfdcCases.find(c => c.caseNumber === caseNum);
                    if (sfdcCase && sfdcCase.country && sfdcCase.country.toLowerCase().includes(countryFilter.toLowerCase())) matchesCountry = true;
                }
            }
            return matchesCountry;
        });

        const isNewHire = (t) => {
            const isNewHireSubject = t.subject.toLowerCase().includes('new hire') || t.subject.toLowerCase().includes('nuevo ingreso');
            let isFutureDate = false;
            if (t.logistics?.date) {
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                const ticketDate = new Date(t.logistics.date);
                if (!isNaN(ticketDate.getTime())) {
                    ticketDate.setHours(0, 0, 0, 0);
                    if (ticketDate > today) isFutureDate = true;
                }
            }
            return isNewHireSubject || isFutureDate;
        };

        const deliveryCount = filteredByCountry.filter(t => !t.subject.toLowerCase().includes('collection') && !t.subject.toLowerCase().includes('offboarding') && !isNewHire(t)).length;
        const collectionCount = filteredByCountry.filter(t => t.subject.toLowerCase().includes('collection') || t.subject.toLowerCase().includes('offboarding')).length;
        const newHireCount = filteredByCountry.filter(t => isNewHire(t)).length;

        return { delivery: deliveryCount, collection: collectionCount, newHire: newHireCount };
    }, [tickets, countryFilter, sfdcCases]);

    // Estadísticas para las tarjetas KPI
    // Estadísticas para las tarjetas KPI
    const stats = React.useMemo(() => {
        // Filter by country first
        const filteredByCountry = tickets.filter(t => {
            if (countryFilter === 'Todos') return true;
            let matchesCountry = false;
            // 1. Try Address
            if (t.logistics?.address && t.logistics.address.toLowerCase().includes(countryFilter.toLowerCase())) {
                matchesCountry = true;
            } else {
                // 2. Try SFDC Link
                const sfdcMatch = t.subject.match(/SFDC-(\d+)/);
                if (sfdcMatch) {
                    const caseNum = sfdcMatch[1];
                    const sfdcCase = sfdcCases.find(c => c.caseNumber === caseNum);
                    if (sfdcCase && sfdcCase.country && sfdcCase.country.toLowerCase().includes(countryFilter.toLowerCase())) {
                        matchesCountry = true;
                    }
                }
            }
            return matchesCountry;
        });

        return {
            total: filteredByCountry.filter(t => t.status !== 'Resuelto' && t.status !== 'Cerrado' && t.status !== 'Servicio Facturado' && t.status !== 'Caso SFDC Cerrado').length,
            abiertos: filteredByCountry.filter(t => t.status === 'Abierto').length,
            enProgreso: filteredByCountry.filter(t => t.status === 'En Progreso').length,
            pendientes: filteredByCountry.filter(t => t.status === 'Pendiente').length
        };
    }, [tickets, countryFilter, sfdcCases]);


    const SortIcon = ({ column }) => {
        if (sortConfig.key !== column) return <span style={{ opacity: 0.3, marginLeft: '4px' }}>↕</span>;
        return <span style={{ marginLeft: '4px', color: 'var(--primary-color)' }}>{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>;
    };

    return (
        <div>
            {toast.show && (
                <div style={{
                    position: 'fixed',
                    bottom: '2rem',
                    right: '2rem',
                    backgroundColor: toast.type === 'success' ? '#10b981' : '#ef4444',
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
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2rem' }}>
                <div>
                    <h1 style={{ fontSize: '1.8rem', fontWeight: 700, color: 'var(--text-main)' }}>Gestión de Servicios</h1>
                    <p style={{ color: 'var(--text-secondary)' }}>Gestiona y resuelve las incidencias reportadas.</p>
                    <div style={{ marginTop: '1rem' }}>
                        <CountryFilter />
                    </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.75rem' }}>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <input
                            type="file"
                            ref={fileInputRef}
                            style={{ display: 'none' }}
                            accept=".csv"
                            onChange={handleFileUpload}
                        />
                        <Button variant="secondary" icon={Upload} onClick={() => fileInputRef.current.click()}>
                            Importar SFDC
                        </Button>
                    </div>
                    {canDelete && selectedTickets.length > 0 && (
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
                            <Map size={18} style={{ color: 'var(--primary-color)' }} /> Mapa de Operaciones
                        </h3>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                            {users && (
                                <Badge variant="default" style={{ background: 'var(--primary-color)', color: 'white', fontSize: '0.7rem' }}>
                                    {users.filter(u => u.tracking_enabled && u.location_latitude).length} Conductor(es) Activo(s)
                                </Badge>
                            )}
                            {showMap ? <ChevronUp size={20} style={{ color: 'var(--text-secondary)' }} /> : <ChevronDown size={20} style={{ color: 'var(--text-secondary)' }} />}
                        </div>
                    </div>

                    {showMap && (
                        <div style={{ borderRadius: 0, overflow: 'hidden' }}>
                            <ServiceMap
                                tickets={tickets.filter(t => t.status === 'En Progreso' || t.status === 'Abierto' || t.status === 'Pendiente')}
                                drivers={users ? users.filter(u => u.tracking_enabled && u.location_latitude) : []}
                            />
                        </div>
                    )}
                </Card>
            </div>



            <Card>
                {/* FILTROS TIPO DE PEDIDO (ENTREGA, RECOLECCIÓN, NEW HIRE) */}
                <div style={{ display: 'flex', gap: '2rem', marginBottom: '1.5rem', paddingBottom: '1.5rem', borderBottom: '1px solid var(--border)' }}>
                    {/* BOTÓN VERDE (ENTREGA) */}
                    <button
                        onClick={() => setFilterType(filterType === 'DELIVERY' ? 'ALL' : 'DELIVERY')}
                        style={{
                            flex: 1,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '1rem',
                            backgroundColor: filterType === 'DELIVERY' ? '#dcfce7' : 'var(--background-secondary)',
                            border: `2px solid ${filterType === 'DELIVERY' ? '#22c55e' : 'transparent'}`,
                            borderRadius: 'var(--radius-md)',
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                            boxShadow: filterType === 'DELIVERY' ? '0 4px 6px -1px rgba(34, 197, 94, 0.1)' : 'none'
                        }}
                    >
                        <div style={{ textAlign: 'left' }}>
                            <div style={{ fontSize: '1rem', fontWeight: 800, color: '#166534' }}>ENTREGAS</div>
                            <div style={{ fontSize: '0.75rem', color: '#14532d', opacity: 0.8 }}>General</div>
                        </div>
                        <div style={{
                            backgroundColor: '#22c55e',
                            color: 'white',
                            padding: '0.25rem 0.75rem',
                            borderRadius: '9999px',
                            fontWeight: 700,
                            fontSize: '1.25rem'
                        }}>
                            {statsByType.delivery}
                        </div>
                    </button>

                    {/* BOTÓN NARANJA (RECOLECCIÓN) */}
                    <button
                        onClick={() => setFilterType(filterType === 'COLLECTION' ? 'ALL' : 'COLLECTION')}
                        style={{
                            flex: 1,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '1rem',
                            backgroundColor: filterType === 'COLLECTION' ? '#ffedd5' : 'var(--background-secondary)',
                            border: `2px solid ${filterType === 'COLLECTION' ? '#f97316' : 'transparent'}`,
                            borderRadius: 'var(--radius-md)',
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                            boxShadow: filterType === 'COLLECTION' ? '0 4px 6px -1px rgba(249, 115, 22, 0.1)' : 'none'
                        }}
                    >
                        <div style={{ textAlign: 'left' }}>
                            <div style={{ fontSize: '1rem', fontWeight: 800, color: '#c2410c' }}>RECOLECCIONES</div>
                            <div style={{ fontSize: '0.75rem', color: '#9a3412', opacity: 0.8 }}>Devoluciones</div>
                        </div>
                        <div style={{
                            backgroundColor: '#f97316',
                            color: 'white',
                            padding: '0.25rem 0.75rem',
                            borderRadius: '9999px',
                            fontWeight: 700,
                            fontSize: '1.25rem'
                        }}>
                            {statsByType.collection}
                        </div>
                    </button>

                    {/* BOTÓN ROJO (NEW HIRE) */}
                    <button
                        onClick={() => setFilterType(filterType === 'NEW_HIRE' ? 'ALL' : 'NEW_HIRE')}
                        style={{
                            flex: 1,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '1rem',
                            backgroundColor: filterType === 'NEW_HIRE' ? '#fee2e2' : 'var(--background-secondary)',
                            border: `2px solid ${filterType === 'NEW_HIRE' ? '#ef4444' : 'transparent'}`,
                            borderRadius: 'var(--radius-md)',
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                            boxShadow: filterType === 'NEW_HIRE' ? '0 4px 6px -1px rgba(239, 68, 68, 0.1)' : 'none'
                        }}
                    >
                        <div style={{ textAlign: 'left' }}>
                            <div style={{ fontSize: '1rem', fontWeight: 800, color: '#b91c1c' }}>NEW HIRE</div>
                            <div style={{ fontSize: '0.75rem', color: '#991b1b', opacity: 0.8 }}>Ingresos / Futuros</div>
                        </div>
                        <div style={{
                            backgroundColor: '#ef4444',
                            color: 'white',
                            padding: '0.25rem 0.75rem',
                            borderRadius: '9999px',
                            fontWeight: 700,
                            fontSize: '1.25rem'
                        }}>
                            {statsByType.newHire}
                        </div>
                    </button>
                </div>

                <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
                    {selectedTickets.length > 0 && canDelete ? (
                        <div style={{
                            flex: 1,
                            display: 'flex',
                            alignItems: 'center',
                            gap: '1rem',
                            background: '#fee2e2',
                            border: '1px solid #fecaca',
                            padding: '0.5rem 1rem',
                            borderRadius: 'var(--radius-md)',
                            animation: 'fadeIn 0.3s ease-out'
                        }}>
                            <span style={{ fontWeight: 600, color: '#991b1b' }}>{selectedTickets.length} servicios seleccionados</span>
                            <Button size="sm" onClick={handleBulkDelete} style={{ backgroundColor: '#ef4444', borderColor: '#ef4444', color: 'white' }}>
                                <Trash2 size={16} style={{ marginRight: '0.5rem' }} /> Borrar Seleccionados
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => setSelectedTickets([])} style={{ marginLeft: 'auto', color: '#64748b' }}>
                                Cancelar
                            </Button>
                        </div>
                    ) : (
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
                    )}
                    {(columnFilters.status !== 'All' || columnFilters.requester !== '' || filter !== '') && !selectedTickets.length && (
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
                                {canDelete && (
                                    <th style={{ padding: '1rem', width: '40px' }}>
                                        <input
                                            type="checkbox"
                                            onChange={handleSelectAll}
                                            checked={sortedAndFilteredTickets.length > 0 && selectedTickets.length === sortedAndFilteredTickets.length}
                                            style={{ cursor: 'pointer', width: '16px', height: '16px' }}
                                        />
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
                                    {canDelete && (
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
                                        {ticket.logistics?.address && (
                                            <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '3px' }}>
                                                <Map size={12} /> {ticket.logistics.address}
                                            </div>
                                        )}
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
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'flex-start' }}>
                                            {(() => {
                                                // 1. Get current sub-cases
                                                const tasks = logisticsTasks.filter(tk => String(tk.ticket_id) === String(ticket.id));
                                                const legacyCases = ticket.associatedCases || [];
                                                
                                                // 2. Map all to a common format
                                                const allSubItems = [
                                                    ...tasks.map(t => ({
                                                        status: t.status,
                                                        method: t.method,
                                                        deliveryPerson: t.delivery_person,
                                                        trackingNumber: t.tracking_number,
                                                        date: t.date,
                                                        updatedAt: t.updated_at || t.created_at || '0'
                                                    })),
                                                    ...legacyCases.map(c => ({
                                                        status: c.logistics?.status || 'Pendiente',
                                                        method: c.logistics?.method,
                                                        deliveryPerson: c.logistics?.deliveryPerson,
                                                        trackingNumber: c.logistics?.trackingNumber,
                                                        date: c.logistics?.date,
                                                        updatedAt: c.logistics?.lastUpdated || '0'
                                                    }))
                                                ];

                                                // 3. Sort by updatedAt descending to find the latest log
                                                const latestLog = allSubItems.sort((a,b) => b.updatedAt.localeCompare(a.updatedAt))[0];

                                                // Determine badges
                                                const dateStr = (latestLog?.date) ? new Date(latestLog.date + 'T12:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' }) : '';
                                                const methodName = latestLog?.method || '';
                                                const senderName = latestLog?.deliveryPerson || '';
                                                const tracking = (latestLog?.method && latestLog?.method !== 'Repartidor Propio' && latestLog?.trackingNumber) ? ` (${latestLog.trackingNumber})` : '';
                                                let displaySender = methodName === 'Repartidor Propio' ? (senderName || 'Propio') : (methodName ? (methodName + tracking) : (senderName || ''));

                                                return (
                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                                        {/* Main Management Status (THE REQUESTED FIX) */}
                                                        <Badge 
                                                            variant={getStatusVariant(ticket.status)} 
                                                            style={{ fontSize: '0.8rem', padding: '4px 10px', boxShadow: 'var(--shadow-sm)', border: '1px solid currentColor', fontWeight: 600 }}
                                                        >
                                                            {ticket.status}
                                                        </Badge>

                                                        {/* Secondary Logistics Info (if exists) */}
                                                        {latestLog && (
                                                            <div style={{ 
                                                                fontSize: '0.65rem', 
                                                                color: 'var(--text-secondary)', 
                                                                background: `${latestLog.status === 'Entregado' ? '#10b98110' : 'var(--background-secondary)'}`, 
                                                                padding: '4px 8px', 
                                                                borderRadius: '4px',
                                                                border: `1px solid ${latestLog.status === 'Entregado' ? '#10b98144' : 'var(--border)'}`,
                                                                display: 'flex',
                                                                flexDirection: 'column',
                                                                gap: '1px'
                                                            }}>
                                                                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                                    <div style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: latestLog.status === 'Entregado' ? '#10b981' : (latestLog.status === 'En Transito' ? '#3b82f6' : '#eab308') }}></div>
                                                                    <span style={{ fontWeight: 600 }}>{latestLog.status}</span>
                                                                </div>
                                                                {displaySender && <div style={{ opacity: 0.8 }}>{displaySender}</div>}
                                                                {dateStr && <div style={{ opacity: 0.8 }}>{dateStr}</div>}
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            })()}
                                        </div>
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
        </div >
    );
}
