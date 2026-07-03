"use client";
import React, { useState, useEffect, useRef } from 'react';
import { useSafeSubmit } from '../../../lib/useSafeSubmit';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { useStore } from '../../../lib/store';
import { MoreVertical,  RefreshCw,  Filter, Search, Eye, Trash2, Archive, AlertCircle, Clock, CheckCircle2, Loader2, Map, ChevronDown, ChevronUp, Upload, Plus, GitMerge   } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { getStatusVariant } from './constants';
import { Modal } from '../../components/ui/Modal';
import { supabase } from '../../../lib/supabase';
import { CopyButton } from '../../components/ui/CopyButton';

export default function TicketsPage() {
    const { tickets, assets, sfdcCases, addTicket, deleteTickets, updateTicket, importSfdcCases, currentUser, users, countryFilter, logisticsTasks, entities, getClientName, refreshData } = useStore();
    const fileInputRef = useRef(null);
    const [toast, setToast] = useState({ show: false, message: '', type: 'success' });
    const router = useRouter();

    const showToast = (message, type = 'success') => {
        setToast({ show: true, message, type });
        setTimeout(() => setToast({ show: false, message: '', type: 'success' }), 5000);
    };


    const [filter, setFilter] = useState('');
    const [sortConfig, setSortConfig] = useState({ key: 'date', direction: 'desc' });
    const [columnFilters, setColumnFilters] = useState({ status: 'All', requester: '' });
    const [selectedTickets, setSelectedTickets] = useState([]);
    
    // Manual Creation State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [newTicket, setNewTicket] = useState({ subject: '', requester: '', priority: 'Media', status: 'Pendiente', caseNumber: '', country: '', address: '', zipCode: '', phone: '', email: '', type: 'Entrega' , floor: '', sycompCase: ''});

    // Safe Auto-complete logic when requester loses focus or changes
    useEffect(() => {
        if (!newTicket.requester || String(newTicket.requester).trim().length < 3) return;
        const searchName = String(newTicket.requester).toLowerCase().trim();
        const match = tickets.find(t => 
            t.requester && String(t.requester).toLowerCase().trim() === searchName
        );
        if (match) {
            setNewTicket(prev => {
                const newAddress = prev.address ? prev.address : (match.logistics?.address || match.address || '');
                const newPhone = prev.phone ? prev.phone : (match.logistics?.phone || match.phone || '');
                const newEmail = prev.email ? prev.email : (match.logistics?.email || match.email || '');
                const newFloor = prev.floor ? prev.floor : (match.logistics?.floor || match.floor || '');
                
                // Only update if there's an actual change to prevent infinite re-renders
                if (prev.address === newAddress && prev.phone === newPhone && prev.email === newEmail && prev.floor === newFloor) {
                    return prev;
                }
                
                return {
                    ...prev,
                    address: newAddress,
                    phone: newPhone,
                    email: newEmail,
                    floor: newFloor
                };
            });
        }
    }, [newTicket.requester, tickets]);

        const [filterType, setFilterType] = useState('ALL'); // 'ALL', 'DELIVERY', 'COLLECTION', 'NEW_HIRE'

    const canDelete = currentUser?.role === 'admin' || currentUser?.role === 'Gerencial' || currentUser?.role === 'Administrativo';

    const handleFileUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (event) => {
            const buffer = event.target.result;
            const decoder = new TextDecoder('utf-8');
            let text = decoder.decode(buffer);

            // Si detectamos el carácter de reemplazo , re-decodificamos como Latin1
            if (text.includes('')) {
                console.log("Detectada codificación no UTF-8 en Tickets. Re-decodificando como ISO-8859-1...");
                const latinDecoder = new TextDecoder('iso-8859-1');
                text = latinDecoder.decode(buffer);
            }

            try {
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
                
                // --- NUEVO: Permitir Sobrescribir Región ---
                let overrideRegion = false;
                if (countryFilter !== 'Todos') {
                    overrideRegion = confirm(`¿Deseas asignar todos los casos importados a la región "${countryFilter}"?\n\n(Aceptar = Usar "${countryFilter}" / Cancelar = Usar país del CSV)`);
                }
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
                        country: overrideRegion ? countryFilter : mailingCountry,
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

                let ticketsCreated = 0;
                let casesProcessed = 0;
                let ticketsSkipped = 0;

                for (const c of newCases) {
                    // Check if this specific caseNumber is already in any ticket
                    const alreadyExists = tickets.some(t => 
                        (t.subject && t.subject.includes(c.caseNumber)) || 
                        (t.associatedCases && t.associatedCases.some(ac => ac.caseNumber === c.caseNumber)) ||
                        (t.internalNotes && t.internalNotes.some(n => n.includes(c.caseNumber)))
                    );

                    if (alreadyExists) {
                        ticketsSkipped++;
                        continue;
                    }

                    const subject = `[SFDC-${c.caseNumber}] ${c.subject}`;
                    
                    const newTicketData = {
                        subject: subject,
                        requester: c.requestedFor,
                        priority: c.priority === 'High' ? 'Alta' : 'Media',
                        status: 'Pendiente',
                        client: getClientName(c.country),
                        internalNotes: [],
                        logistics: {
                            address: c.mailingStreet && c.country ? `${c.mailingStreet}, ${c.country} ${c.zipCode}` : c.country,
                            phone: c.mobile || '',
                            email: c.email || '',
                            type: 'Entrega'
                        },
                        associatedCases: [{
                            caseNumber: c.caseNumber,
                            subject: c.subject,
                            status: c.status,
                            priority: c.priority,
                            dateOpened: c.dateOpened,
                            logistics: {
                                address: c.mailingStreet && c.country ? `${c.mailingStreet}, ${c.country} ${c.zipCode}` : c.country,
                                phone: c.mobile || '',
                                email: c.email || '',
                                method: '',
                                status: 'Pendiente'
                            }
                        }]
                    };

                    await addTicket(newTicketData);
                    ticketsCreated++;
                    casesProcessed++;
                }

                showToast(`Importación completa: ${casesProcessed} casos procesados. ${ticketsCreated} servicios creados (${ticketsSkipped} omitidos por ya existir).`, 'success');

            } catch (err) {
                console.error("Error procesando CSV:", err);
                alert("Error al procesar el archivo CSV: " + err.message);
            }
            e.target.value = null; // reset 
        };
        reader.readAsArrayBuffer(file);
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

    const handleMergeTickets = async () => {
        if (selectedTickets.length < 2) return;
        
        const selectedObjects = tickets.filter(t => selectedTickets.includes(t.id));
        const firstRequester = selectedObjects[0].requester;
        const differentRequester = selectedObjects.some(t => t.requester !== firstRequester);
        
        if (differentRequester) {
            if (!confirm("Los servicios seleccionados pertenecen a diferentes solicitantes. ¿Estás seguro de que deseas fusionarlos de todos modos?")) {
                return;
            }
        } else {
            if (!confirm(`¿Estás seguro de que deseas fusionar los ${selectedTickets.length} servicios de ${firstRequester} en uno solo?`)) {
                return;
            }
        }
        
        // Ordenar por ID para mantener el más viejo (menor ID) como primario
        selectedObjects.sort((a, b) => {
            const numA = parseInt(a.id.split('-')[1]) || 0;
            const numB = parseInt(b.id.split('-')[1]) || 0;
            return numA - numB;
        });
        
        const primary = selectedObjects[0];
        const sources = selectedObjects.slice(1);
        const sourceIds = sources.map(s => s.id);
        
        try {
            // 1. Unificar asociados
            let mergedCases = primary.associatedCases ? [...primary.associatedCases] : [];
            
            // Garantizar que el caso primario principal esté listado en asociados
            const matchPrimary = primary.subject.match(/\[SFDC-(\d+)\]/i);
            if (matchPrimary) {
                const pCaseNum = matchPrimary[1];
                if (!mergedCases.some(mc => mc.caseNumber === pCaseNum)) {
                    const subText = primary.subject.replace(/\[SFDC-\d+\]\s*/i, '').replace(/\s*\(\+\s*\d+\s*casos agrupados\)/i, '');
                    mergedCases.push({
                        caseNumber: pCaseNum,
                        subject: subText,
                        status: primary.status,
                        priority: primary.priority === 'Alta' ? 'High' : 'Medium',
                        dateOpened: primary.date || new Date().toISOString().split('T')[0],
                        logistics: {
                            address: primary.logistics?.address || '',
                            phone: primary.logistics?.phone || '',
                            email: primary.logistics?.email || '',
                            method: '',
                            status: 'Pendiente'
                        }
                    });
                }
            }
            
            // Extraer y agrupar de los tickets secundarios
            sources.forEach(src => {
                const srcCases = src.associatedCases || [];
                srcCases.forEach(c => {
                    if (!mergedCases.some(mc => mc.caseNumber === c.caseNumber)) {
                        mergedCases.push(c);
                    }
                });
                
                const match = src.subject.match(/\[SFDC-(\d+)\]/i);
                if (match) {
                    const caseNum = match[1];
                    if (!mergedCases.some(mc => mc.caseNumber === caseNum)) {
                        const subText = src.subject.replace(/\[SFDC-\d+\]\s*/i, '').replace(/\s*\(\+\s*\d+\s*casos agrupados\)/i, '');
                        mergedCases.push({
                            caseNumber: caseNum,
                            subject: subText,
                            status: src.status,
                            priority: src.priority === 'Alta' ? 'High' : 'Medium',
                            dateOpened: src.date || new Date().toISOString().split('T')[0],
                            logistics: {
                                address: src.logistics?.address || '',
                                phone: src.logistics?.phone || '',
                                email: src.logistics?.email || '',
                                method: '',
                                status: 'Pendiente'
                            }
                        });
                    }
                }
            });
            
            // 2. Combinar notas internas
            let mergedNotes = primary.internalNotes ? [...primary.internalNotes] : [];
            sources.forEach(src => {
                if (src.internalNotes && src.internalNotes.length > 0) {
                    mergedNotes.push(`=== NOTAS FUSIONADAS DE ${src.id} ===`);
                    src.internalNotes.forEach(note => {
                        mergedNotes.push(note);
                    });
                }
            });
            
            mergedNotes.push(`=== FUSIÓN DE SERVICIOS [${new Date().toLocaleString()}] ===\nSe fusionaron los servicios: ${sourceIds.join(', ')} en este servicio por el usuario ${currentUser?.name || 'Operador'}.`);
            
            // Actualizar ticket principal en DB
            const updatedSubject = primary.subject.includes('casos agrupados') 
                ? primary.subject 
                : `${primary.subject} (+ casos agrupados)`;
                
            const { error: primaryError } = await supabase.from('tickets').update({
                associated_assets: mergedCases,
                internal_notes: mergedNotes,
                subject: updatedSubject
            }).eq('id', primary.id);
            
            if (primaryError) throw primaryError;
            
            // 3. Mover tareas logísticas al ticket principal
            const { error: taskError } = await supabase.from('logistics_tasks')
                .update({ ticket_id: primary.id })
                .in('ticket_id', sourceIds);
                
            if (taskError) {
                console.error("Error moving logistics tasks:", taskError);
            }
            
            // 4. Mover inventario relacionado
            const { error: assetError } = await supabase.from('assets')
                .update({ sfdc_case: primary.id })
                .in('sfdc_case', sourceIds);
                
            if (assetError) {
                console.error("Error moving assets:", assetError);
            }
            
            // 5. Eliminar tickets secundarios
            const { error: deleteError } = await supabase.from('tickets')
                .delete()
                .in('id', sourceIds);
                
            if (deleteError) throw deleteError;
            
            // 6. Recargar estado local
            await refreshData();
            
            setSelectedTickets([]);
            showToast("Servicios fusionados con éxito", "success");
        } catch (err) {
            console.error("Error during merge:", err);
            alert("Error al fusionar servicios: " + err.message);
        }
    };

    const { isSubmitting: isSubmittingManual, safeSubmit: safeSubmitTicket } = useSafeSubmit();

    
    const handleCreate = async (e) => {
        if (e) e.preventDefault();
        
        if (!newTicket.subject || !newTicket.requester) {
            showToast("Por favor completa el Asunto y Solicitante", "error");
            return;
        }

        await safeSubmitTicket(async () => {
            const clean = (str) => typeof str === 'string' ? str.trim().replace(/[\r\n\t\0]+/g, ' ') : String(str || '');
            
            const caseNumClean = newTicket.caseNumber ? String(newTicket.caseNumber).trim() : '';
            
            const ticketData = {
                sycompCase: newTicket.sycompCase,
                country: countryFilter,
                floor: newTicket.floor,
                ...newTicket,
                subject: clean(newTicket.subject),
                requester: clean(newTicket.requester),
                associatedCases: caseNumClean !== '' ? [{
                    caseNumber: clean(caseNumClean).replace(/\s/g, ''),
                    subject: clean(newTicket.subject),
                    logistics: {
                        address: newTicket.address || newTicket.country ? `${clean(newTicket.address)}, ${clean(newTicket.country)} ${clean(newTicket.zipCode)}`.trim() : '',
                        phone: clean(newTicket.phone),
                        email: clean(newTicket.email),
                        method: '',
                        status: 'Pendiente'
                    }
                }] : [],
                logistics: {
                    address: newTicket.address || newTicket.country ? `${clean(newTicket.address)}, ${clean(newTicket.country)} ${clean(newTicket.zipCode)}`.trim() : '',
                    phone: clean(newTicket.phone),
                    email: clean(newTicket.email),
                    type: newTicket.type,
                    method: '',
                    deliveryPerson: ''
                }
            };
            const createdTicket = await addTicket(ticketData);
            console.log("Manual ticket created:", createdTicket);
            setIsModalOpen(false);
            setNewTicket({ subject: '', requester: '', priority: 'Media', status: 'Pendiente', caseNumber: '', country: '', address: '', zipCode: '', phone: '', email: '', type: 'Entrega' });
            if (createdTicket?.id) {
                showToast("Servicio creado correctamente", "success");
                router.push(`/dashboard/tickets/${createdTicket.id}`);
            }
        }).catch(error => {
            console.error("Error creating ticket:", error);
            showToast("Error al crear el servicio: " + (error.message || "Error desconocido"), "error");
            setTimeout(() => {
                alert("Error del sistema al guardar: " + (error.message || JSON.stringify(error)) + "\nPor favor avísale a soporte.");
            }, 100);
        });
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
            const associatedTasks = (logisticsTasks || []).filter(tk => String(tk.ticket_id) === String(t.id));
            const taskRecipients = associatedTasks.map(tk => String(tk.recipient || '').toLowerCase());
            const taskAddresses = associatedTasks.map(tk => String(tk.address || '').toLowerCase());
            const matchesSearch = String(t.subject || '').toLowerCase().includes(filter.toLowerCase()) ||
                String(t.requester || '').toLowerCase().includes(filter.toLowerCase()) ||
                String(t.id || '').toLowerCase().includes(filter.toLowerCase()) ||
                taskRecipients.some(rec => rec.includes(filter.toLowerCase())) ||
                taskAddresses.some(addr => addr.includes(filter.toLowerCase()));

            const matchesStatus = columnFilters.status === 'All' || t.status === columnFilters.status;
            const matchesRequester = !columnFilters.requester || String(t.requester || '').toLowerCase().includes(columnFilters.requester.toLowerCase());

            // Excluir Resueltos de esta vista
            const isNotResolved = isTicketActive(t);

            // Filtrado por Cliente (campo explícito)
            // Aislamiento por Cliente
            const expectedClient = getClientName(countryFilter);
            const matchesCountry = expectedClient === 'Todos' || t.client === expectedClient;

            // Filtrado por Tipo (Delivery, Collection, New Hire)
            // Helper New Hire
            const isNewHire = (t) => {
                const isNewHireSubject = String(t.subject || '').toLowerCase().includes('new hire') || String(t.subject || '').toLowerCase().includes('nuevo ingreso');
                let isFutureDate = false;
                if (t.logistics?.date) {
                    const today = new Date();
                    today.setHours(0, 0, 0, 0);
                    const rawDate = t.deliveryCompletedDate || t.closedDate || t.date;
                    const ticketDate = new Date((rawDate && typeof rawDate === 'string' && !rawDate.includes('T') ? rawDate + 'T00:00:00' : rawDate));
                    ticketDate.setHours(0, 0, 0, 0);
                    if (ticketDate > today) isFutureDate = true;
                }
                return isNewHireSubject || isFutureDate;
            };

            let matchesType = true;
            if (filterType === 'DELIVERY') {
                matchesType = !String(t.subject || '').toLowerCase().includes('collection') && !String(t.subject || '').toLowerCase().includes('offboarding') && !isNewHire(t);
            } else if (filterType === 'COLLECTION') {
                matchesType = String(t.subject || '').toLowerCase().includes('collection') || String(t.subject || '').toLowerCase().includes('offboarding');
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
                // Si son iguales, ordenamos por ID numérico descendente para que el último creado quede arriba
                const numA = parseInt((a.id || '').split('-')[1]) || 0;
                const numB = parseInt((b.id || '').split('-')[1]) || 0;
                if (numA !== numB) return numB - numA; // Siempre desc para el secundario
                return 0;
            });
        }
        return result;
    }, [tickets, filter, sortConfig, columnFilters, countryFilter, filterType]);

    const statsByType = React.useMemo(() => {
        // Filter by country first to match the view logic roughly (ignoring status for now or keeping it consistent?)
        // The original logic in Cases filtered by country. Here we probably should too.
        // But `tickets` here includes all statuses. We usually care about active tickets for these counts.
        const activeTickets = tickets.filter(t => isTicketActive(t));

        const expectedClient = getClientName(countryFilter);
        const filteredByCountry = activeTickets.filter(t => expectedClient === 'Todos' || t.client === expectedClient);

        const isNewHire = (t) => {
            const isNewHireSubject = String(t.subject || '').toLowerCase().includes('new hire') || String(t.subject || '').toLowerCase().includes('nuevo ingreso');
            let isFutureDate = false;
            if (t.logistics?.date) {
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                const rawDate = t.deliveryCompletedDate || t.closedDate || t.date;
                const ticketDate = new Date((rawDate && typeof rawDate === 'string' && !rawDate.includes('T') ? rawDate + 'T00:00:00' : rawDate));
                ticketDate.setHours(0, 0, 0, 0);
                if (ticketDate > today) isFutureDate = true;
            }
            return isNewHireSubject || isFutureDate;
        };

        const deliveryCount = filteredByCountry.filter(t => !String(t.subject || '').toLowerCase().includes('collection') && !String(t.subject || '').toLowerCase().includes('offboarding') && !isNewHire(t)).length;
        const collectionCount = filteredByCountry.filter(t => String(t.subject || '').toLowerCase().includes('collection') || String(t.subject || '').toLowerCase().includes('offboarding')).length;
        const newHireCount = filteredByCountry.filter(t => isNewHire(t)).length;

        return { delivery: deliveryCount, collection: collectionCount, newHire: newHireCount };
    }, [tickets, countryFilter, sfdcCases]);

    // Estadísticas para las tarjetas KPI
    // Estadísticas para las tarjetas KPI
    const stats = React.useMemo(() => {
        // Filter by client field
        const expectedClient = getClientName(countryFilter);
        const filteredByCountry = tickets.filter(t => expectedClient === 'Todos' || t.client === expectedClient);

        return {
            total: filteredByCountry.filter(t => isTicketActive(t)).length,
            abiertos: filteredByCountry.filter(t => t.status === 'Pendiente').length,
            enProgreso: filteredByCountry.filter(t => t.status === 'En Progreso').length,
            pendientes: filteredByCountry.filter(t => t.status === 'Pendiente').length
        };
    }, [tickets, countryFilter]);

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
            <div style={{ marginBottom: '2rem' }} className="flex-mobile-column">
                <div>
                    <h1 style={{ fontSize: '1.8rem', fontWeight: 700, color: 'var(--text-main)' }}>Gestión de Servicios</h1>
                    <p style={{ color: 'var(--text-secondary)' }}>Gestiona y resuelve las incidencias reportadas de cliente {countryFilter}.</p>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.75rem', marginTop: '1rem' }}>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <Button icon={Plus} onClick={() => {
                            setNewTicket({ ...newTicket, country: countryFilter });
                            setIsModalOpen(true);
                        }} style={{ backgroundColor: '#8b5cf6', borderColor: '#8b5cf6', color: 'white' }}>
                            Nuevo Servicio
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

            <div className="grid-responsive-3" style={{ marginBottom: '2.5rem' }}>
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
                        backgroundColor: columnFilters.status === 'Pendiente' ? 'rgba(239, 68, 68, 0.1)' : 'var(--surface)',
                        transition: 'all 0.2s ease',
                        boxShadow: columnFilters.status === 'Pendiente' ? 'inset 0 0 0 1px #ef4444, var(--shadow-sm)' : 'var(--shadow-sm)'
                    }}
                    onClick={() => setColumnFilters({ ...columnFilters, status: 'Pendiente' })}
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
                

                <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', alignItems: 'center' }} className="flex-mobile-column">
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
                            {selectedTickets.length >= 2 && (
                                <Button 
                                    size="sm" 
                                    onClick={handleMergeTickets} 
                                    style={{ backgroundColor: '#8b5cf6', borderColor: '#8b5cf6', color: 'white' }}
                                >
                                    <GitMerge size={16} style={{ marginRight: '0.5rem' }} /> Fusionar Seleccionados
                                </Button>
                            )}
                            <Button variant="ghost" size="sm" onClick={() => setSelectedTickets([])} style={{ marginLeft: 'auto', color: '#64748b' }}>
                                Cancelar
                            </Button>
                        </div>
                    ) : (
                        <div style={{ position: 'relative', flex: 1, minWidth: '300px' }}>
                            <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
                            <input
                                type="text"
                                placeholder="Buscar servicios..."
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

                <div className="table-responsive">
                    
                    <div className="mobile-only">
                        {sortedAndFilteredTickets.map((ticket, index) => {
                            const isGrouped = ticket.associatedCases && ticket.associatedCases.length > 0;
                            const subjectPrefix = '';
                            const rawSubject = ticket.subject || 'Sin Asunto';
                                const cleanedSubject = rawSubject.replace(/\[SFDC-[\w\d]+\]\s*/gi, '').replace(/\s*\(\+.*\scasos agrupados\)/i, '').trim();
                                const subjectText = `${subjectPrefix}${cleanedSubject}`;
                            return (
                                <Card key={`mobile-${ticket.id}-${index}`} style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                        <div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-main)' }}>{ticket.id}</div>
                                        <Badge variant={getStatusVariant(ticket.status)} style={{ fontSize: '0.75rem', padding: '2px 8px' }}>
                                            {ticket.status}
                                        </Badge>
                                    </div>
                                    <div style={{ fontWeight: 600, fontSize: '1rem', color: isGrouped ? 'var(--primary-color)' : 'var(--text-main)' }}>
                                        {subjectText}
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                                        <div style={{ width: '20px', height: '20px', borderRadius: '50%', background: '#e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.6rem', fontWeight: 700, color: 'var(--text-main)' }}>
                                            {String(ticket.requester || '?').charAt(0)}
                                        </div>
                                        <span>{ticket.requester || 'Sin Solicitante'}</span>
                                    </div>
                                    <div style={{ marginTop: '0.5rem', display: 'flex', justifyContent: 'flex-end' }}>
                                        <Link href={`/dashboard/tickets/${ticket.id}`}>
                                            <Button variant="ghost" size="sm" style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                                <MoreVertical size={16} /> Ver Detalles
                                            </Button>
                                        </Link>
                                    </div>
                                </Card>
                            );
                        })}
                    </div>
                    <table className="desktop-only" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
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
                                <th onClick={() => handleSort('id')} style={{ padding: '1rem', fontWeight: 600, color: 'var(--text-secondary)', fontSize: '0.875rem', cursor: 'pointer', userSelect: 'none' }}>ID <SortIcon column="id" /></th>
                                <th onClick={() => handleSort('requester')} style={{ padding: '1rem', fontWeight: 600, color: 'var(--text-secondary)', fontSize: '0.875rem', cursor: 'pointer', userSelect: 'none' }}>SOLICITANTE <SortIcon column="requester" /></th>
                                <th onClick={() => handleSort('subject')} style={{ padding: '1rem', fontWeight: 600, color: 'var(--text-secondary)', fontSize: '0.875rem', cursor: 'pointer', userSelect: 'none' }}>ASUNTO <SortIcon column="subject" /></th>
                                <th style={{ padding: '1rem', fontWeight: 600, color: 'var(--text-secondary)', fontSize: '0.875rem' }}>DIRECCIÓN</th>
                                <th onClick={() => handleSort('date')} style={{ padding: '1rem', fontWeight: 600, color: 'var(--text-secondary)', fontSize: '0.875rem', cursor: 'pointer', userSelect: 'none' }}>FECHA <SortIcon column="date" /></th>
                                <th onClick={() => handleSort('status')} style={{ padding: '1rem', fontWeight: 600, color: 'var(--text-secondary)', fontSize: '0.875rem', cursor: 'pointer', userSelect: 'none' }}>ESTADO <SortIcon column="status" /></th>
                                <th style={{ padding: '1rem', fontWeight: 600, color: 'var(--text-secondary)', fontSize: '0.875rem' }}>TIPO SRV</th>
                                <th style={{ padding: '1rem', fontWeight: 600, color: 'var(--text-secondary)', fontSize: '0.875rem' }}>DETALLE</th>
                            </tr>
                        </thead>
                        <tbody>
                            {sortedAndFilteredTickets.map((ticket, index) => {
                                // Determine if grouped
                                const isGrouped = ticket.associatedCases && ticket.associatedCases.length > 0;
                                const subjectPrefix = '';
                                const rawSubject = ticket.subject || 'Sin Asunto';
                                const cleanedSubject = rawSubject.replace(/\[SFDC-[\w\d]+\]\s*/gi, '').replace(/\s*\(\+.*\scasos agrupados\)/i, '').trim();
                                const subjectText = `${subjectPrefix}${cleanedSubject}`;
                                
                                // Logistics Address
                                const address = ticket.logistics?.address || ticket.address || '';
                                
                                // Type
                                const srvType = ticket.type || ticket.logistics?.type || 'No definido';

                                // Date formatting
                                const dateStr = ticket.date ? new Date(ticket.date).toLocaleDateString('es-AR') : '';

                                return (
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
                                        <td className="hover-container" style={{ padding: '1rem', fontWeight: 500, whiteSpace: 'nowrap' }}>
                                            {ticket.id}
                                        </td>
                                        <td className="hover-container" style={{ padding: '1rem' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: '#e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem', fontWeight: 700 }}>
                                                    {String(ticket.requester || '?').charAt(0)}
                                                </div>
                                                <span style={{ fontWeight: 500 }}>{ticket.requester || 'Sin Solicitante'}</span>
                                            </div>
                                        </td>
                                        <td style={{ padding: '1rem', maxWidth: '250px' }}>
                                            <div style={{ fontWeight: 600, fontSize: '0.9rem', color: isGrouped ? 'var(--primary-color)' : 'inherit' }}>
                                                {subjectText}
                                            </div>
                                        </td>
                                        <td style={{ padding: '1rem', maxWidth: '200px', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                                            {address ? (
                                                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '4px' }}>
                                                    <Map size={14} style={{ marginTop: '2px', flexShrink: 0 }} />
                                                    <span style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', textOverflow: 'ellipsis' }} title={address}>
                                                        {address}
                                                    </span>
                                                </div>
                                            ) : '-'}
                                        </td>
                                        <td className="hover-container" style={{ padding: '1rem', color: 'var(--text-secondary)', fontSize: '0.9rem', whiteSpace: 'nowrap' }}>
                                            {dateStr || ticket.date}
                                        </td>
                                        <td style={{ padding: '1rem' }}>
                                            <Badge 
                                                variant={getStatusVariant(ticket.status)} 
                                                style={{ fontSize: '0.75rem', padding: '4px 10px', boxShadow: 'var(--shadow-sm)', border: '1px solid currentColor', fontWeight: 600, whiteSpace: 'nowrap' }}
                                            >
                                                {ticket.status}
                                            </Badge>
                                        </td>
                                        <td style={{ padding: '1rem', fontSize: '0.85rem', fontWeight: 500, whiteSpace: 'nowrap' }}>
                                            {srvType}
                                        </td>
                                        <td style={{ padding: '1rem' }}>
                                            <Link href={`/dashboard/tickets/${ticket.id}`}>
                                                <Button variant="ghost" size="sm" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><MoreVertical size={16} /> Ver Detalles</Button>
                                            </Link>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </Card>

            <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Crear Nuevo Servicio" disableOutsideClick={true}>
                <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                    {/* 1) Tipo de Servicio */}
                    <div className="form-group">
                        <label className="form-label">Tipo de Servicio</label>
                        <select
                            className="form-select"
                            value={newTicket.type || 'Entrega'}
                            onChange={e => setNewTicket({ ...newTicket, type: e.target.value })}
                        >
                            <option value="Entrega">Entrega</option>
                            <option value="Recolección">Retiro</option>
                            <option value="Reemplazo">Reemplazo</option>
                        </select>
                    </div>

                    {/* 2) Asunto */}
                    <div className="form-group">
                        <label className="form-label">Asunto</label>
                        <input
                            className="form-input"
                            placeholder="Ej: Problema con monitor"
                            value={newTicket.subject}
                            onChange={e => setNewTicket({ ...newTicket, subject: e.target.value })}
                        />
                    </div>

                    {/* 3) Solicitante */}
                    <div className="form-group">
                        <label className="form-label">Solicitante</label>
                        <input
                            className="form-input"
                            placeholder="Nombre del empleado"
                            value={newTicket.requester}
                            onChange={e => setNewTicket({ ...newTicket, requester: e.target.value })}
                        />
                    </div>

                    {/* 4) Direccion & 5) Piso / Dpto */}
                    <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1rem' }}>
                        <div className="form-group">
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                                <label className="form-label" style={{ marginBottom: 0 }}>Dirección</label>
                                {newTicket.address && (
                                    <a 
                                        href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(newTicket.address)}`} 
                                        target="_blank" 
                                        rel="noopener noreferrer"
                                        style={{ fontSize: '0.7rem', color: 'var(--primary-color)', background: 'rgba(37, 99, 235, 0.05)', border: '1px solid var(--primary-color)', padding: '2px 8px', borderRadius: '4px', display: 'flex', alignItems: 'center', gap: '4px', textDecoration: 'none', fontWeight: 600 }}
                                    >
                                        <Check size={12} strokeWidth={2.5} /> Validar Dirección
                                    </a>
                                )}
                            </div>
                            <input
                                className="form-input"
                                placeholder="Ej: Av. Siempreviva 742"
                                value={newTicket.address}
                                onChange={e => setNewTicket({ ...newTicket, address: e.target.value })}
                            />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Piso / Dpto.</label>
                            <input
                                className="form-input"
                                placeholder="Ej: 3B"
                                value={newTicket.floor}
                                onChange={e => setNewTicket({ ...newTicket, floor: e.target.value })}
                            />
                        </div>
                    </div>

                    {/* 6) Telefono & 7) Correo electrónico */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                        <div className="form-group">
                            <label className="form-label">Teléfono</label>
                            <input
                                className="form-input"
                                placeholder="Ej: +54 9 11..."
                                value={newTicket.phone}
                                onChange={e => setNewTicket({ ...newTicket, phone: e.target.value })}
                            />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Correo electrónico</label>
                            <input
                                type="email"
                                className="form-input"
                                placeholder="Ej: usuario@empresa.com"
                                value={newTicket.email}
                                onChange={e => setNewTicket({ ...newTicket, email: e.target.value })}
                            />
                        </div>
                    </div>

                    {/* 8) Prioridad */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                        <div className="form-group">
                            <label className="form-label">Caso SYCOMP (Opcional)</label>
                            <input
                                className="form-input"
                                placeholder="Ej: SYC-12345"
                                value={newTicket.sycompCase}
                                onChange={e => setNewTicket({ ...newTicket, sycompCase: e.target.value })}
                            />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Prioridad</label>
                        <select
                            className="form-select"
                            value={newTicket.priority || 'Media'}
                            onChange={e => setNewTicket({ ...newTicket, priority: e.target.value })}
                        >
                            <option value="Baja">Baja</option>
                            <option value="Media">Media</option>
                            <option value="Alta">Alta</option>
                        </select>
                    </div>
                    </div>

                    {/* 9) Caso SFDC (solo si el cliente tiene SFDC) */}
                    {getClientName(countryFilter).toUpperCase().includes('SFDC') && (
                        <div className="form-group" style={{ borderTop: '1px solid var(--border)', paddingTop: '1rem' }}>
                            <label className="form-label" style={{ color: 'var(--primary-color)' }}>Caso SFDC</label>
                            <input
                                className="form-input"
                                placeholder="Ej: 03102345"
                                value={newTicket.caseNumber}
                                onChange={e => setNewTicket({ ...newTicket, caseNumber: e.target.value })}
                            />
                        </div>
                    )}

                    <div className="flex-mobile-column" style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1rem' }}>
                        <Button type="button" variant="secondary" onClick={() => setIsModalOpen(false)} style={{ flex: 1 }} disabled={isSubmittingManual}>Cancelar</Button>
                        <Button type="button" onClick={handleCreate} style={{ flex: 1 }} disabled={isSubmittingManual}>
                            {isSubmittingManual ? 'Procesando...' : 'Crear Servicio'}
                        </Button>
                    </div>
                </form>
            </Modal>
        </div >
    );
}


