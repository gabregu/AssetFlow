"use client";
import React, { useState, useEffect, useRef } from 'react';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { useStore } from '../../../lib/store';
import { ServiceMap } from '../../components/ui/ServiceMap';
import { Filter, Search, Eye, Trash2, Archive, AlertCircle, Clock, CheckCircle2, Loader2, Map, ChevronDown, ChevronUp, Upload, Plus, GitMerge } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { getStatusVariant } from './constants';
import { Modal } from '../../components/ui/Modal';
import { supabase } from '../../../lib/supabase';

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
    const [newTicket, setNewTicket] = useState({ subject: '', requester: '', priority: 'Media', status: 'Abierto', caseNumber: '', country: '', address: '', zipCode: '', phone: '', email: '', type: 'Entrega' });

    // Similar active tickets for warnings on manual creation
    const [similarTickets, setSimilarTickets] = useState([]);

    const isTicketActive = (t) => {
        if (!t || !t.status) return false;
        const status = t.status.toLowerCase().trim();
        const closedStatuses = [
            'resuelto',
            'cerrado',
            'servicio facturado',
            'caso sfdc cerrado',
            'cancelado',
            'entregado',
            'finalizado',
            'no requiere accion'
        ];
        return !closedStatuses.includes(status);
    };

    useEffect(() => {
        const req = (newTicket.requester || '').trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        if (req.length < 3) {
            setSimilarTickets([]);
            return;
        }
        const active = tickets.filter(t => {
            if (!isTicketActive(t)) return false;
            
            const tReq = (t.requester || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
            return tReq.includes(req) || req.includes(tReq);
        });
        setSimilarTickets(active);
    }, [newTicket.requester, tickets]);

    const [showMap, setShowMap] = useState(false);
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

                    const existingActiveTicket = tickets.find(t => {
                        const isNotResolved = isTicketActive(t);
                        const tReqNorm = normalizeName(t.requester);
                        
                        const hasSameReq = (tReqNorm === reqNameNorm || (tReqNorm.length > 3 && reqNameNorm.length > 3 && (tReqNorm.includes(reqNameNorm) || reqNameNorm.includes(tReqNorm))));
                        const hasSameClient = t.client === getClientName(repCase.country);

                        return isNotResolved && hasSameReq && hasSameClient;
                    });

                    if (existingActiveTicket) {
                        let updatedNotes = existingActiveTicket.internalNotes ? [...existingActiveTicket.internalNotes] : [];
                        let updatedAssociatedCases = existingActiveTicket.associatedCases ? [...existingActiveTicket.associatedCases] : [];
                        let addedToExisting = 0;

                        group.forEach(c => {
                            const alreadyExists = existingActiveTicket.subject.includes(c.caseNumber) ||
                                                  updatedNotes.some(n => n.includes(c.caseNumber)) ||
                                                  updatedAssociatedCases.some(ac => ac.caseNumber === c.caseNumber);
                                                  
                            if (!alreadyExists) {
                                const msg = `• Caso Adicional Agregado via CSV: [SFDC-${c.caseNumber}] ${c.subject}`;
                                updatedNotes.push(msg);
                                updatedAssociatedCases.push({
                                    caseNumber: c.caseNumber,
                                    subject: c.subject,
                                    status: c.status,
                                    priority: c.priority,
                                    dateOpened: c.dateOpened,
                                    logistics: {
                                        address: c.mailingStreet && c.country ? `${c.mailingStreet}, ${c.country} ${c.zipCode}` : existingActiveTicket.logistics?.address,
                                        phone: c.mobile || '',
                                        email: c.email || '',
                                        method: '',
                                        status: 'Pendiente'
                                    }
                                });
                                addedToExisting++;
                                casesProcessed++;
                            }
                        });

                        if (addedToExisting > 0) {
                            await updateTicket(existingActiveTicket.id, {
                                internalNotes: updatedNotes,
                                associatedCases: updatedAssociatedCases,
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
                            client: getClientName(mainCase.country),
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
                } // This closes the for (const key of Object.keys(groupedCases)) loop

                showToast(`Importación completa: ${casesProcessed} casos procesados. ${ticketsCreated} servicios nuevos y ${ticketsUpdated} actualizados.`, 'success');

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

    const [isSubmittingManual, setIsSubmittingManual] = useState(false);

    const handleCreate = async (e) => {
        if (e) e.preventDefault();
        
        if (isSubmittingManual) return;
        
        if (!newTicket.subject || !newTicket.requester) {
            showToast("Por favor completa el Asunto y Solicitante", "error");
            alert("Por favor completa el Asunto y Solicitante");
            return;
        }

        setIsSubmittingManual(true);
        try {
            const clean = (str) => typeof str === 'string' ? str.trim().replace(/[\r\n\t\0]+/g, ' ') : str;
            
            const ticketData = {
                ...newTicket,
                subject: clean(newTicket.subject),
                requester: clean(newTicket.requester),
                associatedCases: newTicket.caseNumber && newTicket.caseNumber.trim() !== '' ? [{
                    caseNumber: clean(newTicket.caseNumber).replace(/\s/g, ''),
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
            setNewTicket({ subject: '', requester: '', priority: 'Media', status: 'Abierto', caseNumber: '', country: '', address: '', zipCode: '', phone: '', email: '', type: 'Entrega' });
            if (createdTicket?.id) {
                showToast("Servicio creado correctamente", "success");
                router.push(`/dashboard/tickets/${createdTicket.id}`);
            }
        } catch (error) {
            console.error("Error creating ticket:", error);
            showToast("Error al crear el servicio: " + (error.message || "Error desconocido"), "error");
            alert("Error del sistema al guardar: " + (error.message || JSON.stringify(error)) + "\nPor favor avísale a soporte.");
        } finally {
            setIsSubmittingManual(false);
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
            abiertos: filteredByCountry.filter(t => t.status === 'Abierto').length,
            enProgreso: filteredByCountry.filter(t => t.status === 'En Progreso').length,
            pendientes: filteredByCountry.filter(t => t.status === 'Pendiente').length
        };
    }, [tickets, countryFilter]);

        // Items para el mapa (respetando filtros activos de la tabla)
    const mapItems = React.useMemo(() => {
        if (!showMap) return [];
        
        // Función auxiliar para obtener el estado logístico más reciente (idéntica a la de la tabla)
        const getAggregatedInfo = (ticket) => {
            const tasks = (logisticsTasks || []).filter(tk => String(tk.ticket_id) === String(ticket.id));
            const legacyCases = ticket.associatedCases || [];
            
            const allSubItems = [
                ...tasks.map(t => ({
                    status: t.status,
                    deliveryPerson: t.delivery_person,
                    updatedAt: t.updated_at || t.created_at || "0"
                })),
                ...legacyCases.map(c => ({
                    status: c.logistics?.status || "Pendiente",
                    deliveryPerson: c.logistics?.deliveryPerson,
                    updatedAt: c.logistics?.lastUpdated || "0"
                }))
            ];

            if (allSubItems.length === 0) return { status: ticket.status, deliveryPerson: ticket.logistics?.deliveryPerson };
            const latest = allSubItems.sort((a,b) => b.updatedAt.localeCompare(a.updatedAt))[0];
            return { status: latest.status, deliveryPerson: latest.deliveryPerson };
        };

        // 1. Tickets filtrados por la UI (Los que ya pasaron por sortedAndFilteredTickets)
        const activeFilteredTickets = sortedAndFilteredTickets.filter(t => 
            ["En Progreso", "Abierto", "Pendiente", "Bloqueado / A la Espera"].includes(t.status)
        ).map(t => {
            const agg = getAggregatedInfo(t);
            return {
                ...t,
                logistics: {
                    ...t.logistics,
                    status: agg.status,
                    deliveryPerson: agg.deliveryPerson
                }
            };
        });

        // 2. Tareas logísticas de los tickets filtrados (Para asegurar que se vean todos los puntos de esos tickets)
        const activeTasks = (logisticsTasks || [])
            .filter(task => !["Resuelto", "Cancelado", "Entregado"].includes(task.status))
            .filter(task => sortedAndFilteredTickets.some(t => String(t.id) === String(task.ticket_id)))
            .map(task => {
                const parentTicket = tickets.find(t => String(t.id) === String(task.ticket_id));
                return {
                    id: `task-${task.id}`,
                    subject: task.case_number ? `Caso ${task.case_number}` : `Tarea Logística ${task.id}`,
                    requester: parentTicket?.requester || 'Sin Solicitante',
                    logistics: {
                        address: task.address || parentTicket?.logistics?.address,
                        status: task.status,
                        deliveryPerson: task.delivery_person
                    },
                    status: task.status
                };
            });

        return [...activeFilteredTickets, ...activeTasks];
    }, [sortedAndFilteredTickets, showMap, tickets, logisticsTasks]);


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



            <Card>
                {/* FILTROS TIPO DE PEDIDO (ENTREGA, RECOLECCIÓN, NEW HIRE) */}
                <div className="grid-responsive-3" style={{ marginBottom: '1.5rem', paddingBottom: '1.5rem', borderBottom: '1px solid var(--border)' }}>
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
                                            <option value="Bloqueado / A la Espera">Bloqueado / A la Espera</option>
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
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                                            <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>{String(ticket.subject || 'Sin Asunto')}</div>
                                            {ticket.client && (
                                                <Badge variant="secondary" style={{ fontSize: '0.65rem', padding: '2px 6px', opacity: 0.8 }}>
                                                    {ticket.client}
                                                </Badge>
                                            )}
                                        </div>
                                        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Prioridad: {String(ticket.priority || 'Normal')}</div>
                                        {ticket.logistics?.address && (
                                            <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '3px' }}>
                                                <Map size={12} /> {ticket.logistics.address}
                                            </div>
                                        )}
                                    </td>
                                    <td style={{ padding: '1rem' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                            <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: '#e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem', fontWeight: 700 }}>
                                                {String(ticket.requester || '?').charAt(0)}
                                            </div>
                                            {ticket.requester || 'Sin Solicitante'}
                                        </div>
                                    </td>
                                    <td style={{ padding: '1rem', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>{String(ticket.date || '')}</td>
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

            <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Crear Nuevo Servicio">
                <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                    <div className="form-group">
                        <label className="form-label">Número de Caso SFDC (Opcional)</label>
                        <input
                            className="form-input"
                            placeholder="Ej: 03102345"
                            value={newTicket.caseNumber}
                            onChange={e => setNewTicket({ ...newTicket, caseNumber: e.target.value })}
                            onPaste={e => {
                                e.preventDefault();
                                const text = e.clipboardData.getData('text').replace(/[\r\n\t]+/g, ' ').trim();
                                setNewTicket({ ...newTicket, caseNumber: text });
                            }}
                        />
                    </div>
                    <div className="form-group">
                        <label className="form-label">Asunto</label>
                        <input
                            className="form-input"
                            placeholder="Ej: Problema con monitor"
                            value={newTicket.subject}
                            onChange={e => setNewTicket({ ...newTicket, subject: e.target.value })}
                            onPaste={e => {
                                e.preventDefault();
                                const text = e.clipboardData.getData('text').replace(/[\r\n\t]+/g, ' ').trim();
                                setNewTicket({ ...newTicket, subject: text });
                            }}
                        />
                    </div>
                    <div className="form-group">
                        <label className="form-label">Solicitante</label>
                        <input
                            className="form-input"
                            placeholder="Nombre del empleado"
                            value={newTicket.requester}
                            onChange={e => setNewTicket({ ...newTicket, requester: e.target.value })}
                            onPaste={e => {
                                e.preventDefault();
                                const text = e.clipboardData.getData('text').replace(/[\r\n\t]+/g, ' ').trim();
                                setNewTicket({ ...newTicket, requester: text });
                            }}
                        />
                        {similarTickets.length > 0 && (
                            <div style={{
                                marginTop: '0.5rem',
                                padding: '0.75rem',
                                background: 'rgba(245, 158, 11, 0.1)',
                                border: '1px dashed #f59e0b',
                                borderRadius: '8px',
                                fontSize: '0.8rem',
                                color: '#d97706',
                                animation: 'fadeIn 0.2s ease-out'
                            }}>
                                <div style={{ fontWeight: 700, marginBottom: '0.25rem', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                    <AlertCircle size={14} /> Ya existe un servicio abierto para este empleado:
                                </div>
                                <ul style={{ margin: 0, paddingLeft: '1.2rem', listStyleType: 'disc' }}>
                                    {similarTickets.map(t => (
                                        <li key={t.id} style={{ marginBottom: '4px' }}>
                                            <strong>{t.id}</strong>: {t.subject} (Estado: {t.status}){' '}
                                            <a 
                                                href={`/dashboard/tickets/${t.id}`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                style={{ textDecoration: 'underline', fontWeight: 600, color: 'var(--primary-color)', marginLeft: '4px' }}
                                            >
                                                Ver y agregar caso asociado →
                                            </a>
                                        </li>
                                    ))}
                                </ul>
                                <div style={{ marginTop: '0.5rem', fontSize: '0.75rem', opacity: 0.9 }}>
                                    Se recomienda abrir el servicio existente y añadir el nuevo caso desde allí para mantener todo agrupado.
                                </div>
                            </div>
                        )}
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

                    <div style={{ borderTop: '1px solid var(--border)', paddingTop: '1rem', marginTop: '0.5rem' }}>
                        <h3 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: '1rem' }}>Datos Logísticos (Opcional)</h3>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                            <div className="form-group">
                                <label className="form-label">Tipo de Servicio</label>
                                <select
                                    className="form-select"
                                    value={newTicket.type}
                                    onChange={e => setNewTicket({ ...newTicket, type: e.target.value })}
                                >
                                    <option value="Entrega">Entrega</option>
                                    <option value="Recolección">Recolección</option>
                                </select>
                            </div>
                             <div className="form-group">
                                <label className="form-label">Cliente</label>
                                <select
                                    className="form-select"
                                    value={newTicket.country}
                                    onChange={e => setNewTicket({ ...newTicket, country: e.target.value })}
                                >
                                    <option value="">Seleccionar Cliente...</option>
                                    {entities.map(e => (
                                        <option key={e.id} value={e.name}>{e.name}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                        <div className="form-group" style={{ marginTop: '1rem' }}>
                            <label className="form-label">Dirección (Mailing Street)</label>
                            <input
                                className="form-input"
                                placeholder="Ej: Av. Siempreviva 742"
                                value={newTicket.address}
                                onChange={e => setNewTicket({ ...newTicket, address: e.target.value })}
                                onPaste={e => {
                                    e.preventDefault();
                                    const text = e.clipboardData.getData('text').replace(/[\r\n\t]+/g, ' ').trim();
                                    setNewTicket({ ...newTicket, address: text });
                                }}
                            />
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '1rem' }}>
                            <div className="form-group">
                                <label className="form-label">Código Postal</label>
                                <input
                                    className="form-input"
                                    placeholder="Ej: 1414"
                                    value={newTicket.zipCode}
                                    onChange={e => setNewTicket({ ...newTicket, zipCode: e.target.value })}
                                />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Teléfono (Mobile)</label>
                                <input
                                    className="form-input"
                                    placeholder="Ej: +54 9 11..."
                                    value={newTicket.phone}
                                    onChange={e => setNewTicket({ ...newTicket, phone: e.target.value })}
                                />
                            </div>
                        </div>
                        <div className="form-group" style={{ marginTop: '1rem' }}>
                            <label className="form-label">Email</label>
                            <input
                                type="email"
                                className="form-input"
                                placeholder="Ej: usuario@empresa.com"
                                value={newTicket.email}
                                onChange={e => setNewTicket({ ...newTicket, email: e.target.value })}
                            />
                        </div>
                    </div>

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


