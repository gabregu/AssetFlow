"use client";
import React, { useState, useEffect, useRef } from 'react';
import { useSafeSubmit } from '../../../lib/useSafeSubmit';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { useStore } from '../../../lib/store';

import { MoreVertical, RefreshCw, Filter, Search, Eye, Trash2, Archive, AlertCircle, Clock, CheckCircle, CheckCircle2, Loader2, Map, ChevronDown, ChevronUp, Upload, Plus, GitMerge, Check, MapPin, Hash, Phone, Mail } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { getStatusVariant } from './constants';
import { Modal } from '../../components/ui/Modal';
import { supabase } from '../../../lib/supabase';
import { CopyButton } from '../../components/ui/CopyButton';

const getTypeStyles = (type) => {
    switch (String(type || '').toLowerCase()) {
        case 'entrega': return { label: 'ENT', color: '#16a34a', bg: '#dcfce7' };
        case 'recolección':
        case 'retiro':
        case 'recupero': return { label: 'REC', color: '#dc2626', bg: '#fee2e2' };
        case 'reemplazo': return { label: 'REE', color: '#ea580c', bg: '#ffedd5' };
        case 'garantia':
        case 'garantía': return { label: 'GAR', color: '#4b5563', bg: '#f3f4f6' };
        default: return { label: type?.substring(0,3).toUpperCase() || 'N/A', color: '#4b5563', bg: '#f3f4f6' };
    }
};

// Helpers del Motor Logístico para Importación SFDC con Reglas
const extractEmployeeName = (subject, requestedFor) => {
    if (!subject) return requestedFor || 'Desconocido';
    const cleanSubject = subject.replace(/\[[^\]]+\]/g, '').trim();
    
    const forMatch = cleanSubject.match(/(?:case for|for)\s+([A-Z][a-z\u00c0-\u00ff]+(?:\s+[A-Z][a-z\u00c0-\u00ff]+)+)/i);
    if (forMatch && forMatch[1]) {
        return forMatch[1].trim();
    }
    
    const parts = cleanSubject.split('-');
    if (parts.length > 1) {
        const lastPart = parts[parts.length - 1].trim();
        const techTerms = ['laptop', 'device', 'windows', 'macbook', 'apple', 'mobile', 'yubikey', 'headset', 'monitor', 'swap', 'request', 'bundle', 'provisioning', 'onboarding', 'offboarding', 'collection', 'recolect', 'itam', 'bag', 'kit', 'accs', 'accesorio', 'arg', 'cl', 'uy', 'br', 'la', 'us', 'es'];
        const wordCount = lastPart.split(/\s+/).filter(Boolean).length;
        const hasTech = techTerms.some(term => lastPart.toLowerCase().includes(term));
        if (wordCount >= 2 && wordCount <= 4 && !hasTech) {
            return lastPart;
        }
    }
    
    return requestedFor || 'Desconocido';
};

const classifyAction = (subject) => {
    const sub = (subject || '').toLowerCase();
    
    if (sub.includes('swap request bundle')) {
        return { action: 'RETIRO', isSwapBundle: true, needsWarning: false };
    }
    if (sub.includes('offboarding') || sub.includes('collection')) {
        return { action: 'RETIRO', needsWarning: false };
    }
    if (sub.includes('swap') || sub.includes('refresh') || sub.includes('upgrade') || sub.includes('breakfix')) {
        return { action: 'REEMPLAZO', needsWarning: true };
    }
    return { action: 'ENTREGA', needsWarning: false };
};

const findContactDetailsFromHistory = (employeeName, localTickets) => {
    if (!localTickets || localTickets.length === 0) return null;
    const normalize = (val) => (val || '').normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
    const searchName = normalize(employeeName);
    
    const userTickets = localTickets.filter(t => 
        t.requester && normalize(t.requester) === searchName && t.logistics
    );
    
    if (userTickets.length === 0) return null;
    
    const latestTicket = userTickets.sort((a, b) => {
        const idA = parseInt(String(a.id).replace('CAS-', '')) || 0;
        const idB = parseInt(String(b.id).replace('CAS-', '')) || 0;
        return idB - idA;
    })[0];
    
    return {
        address: latestTicket.logistics.address || '',
        floorDept: latestTicket.logistics.floorDept || '',
        phone: latestTicket.logistics.phone || '',
        email: latestTicket.logistics.email || ''
    };
};

export default function TicketsPage() {
    const { tickets, assets, sfdcCases, addTicket, deleteTickets, updateTicket, importSfdcCases, currentUser, users, countryFilter, logisticsTasks, entities, getClientName, refreshData } = useStore();
    const fileInputRef = useRef(null);
    const [toast, setToast] = useState({ show: false, message: '', type: 'success' });
    const router = useRouter();
    const [importMode, setImportMode] = useState('STANDARD'); // 'SFDC' | 'STANDARD'
    
    const triggerImport = (mode) => {
        setImportMode(mode);
        if (fileInputRef.current) {
            fileInputRef.current.click();
        }
    };

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
    const [newTicket, setNewTicket] = useState({ subject: '', requester: '', priority: 'Media', status: 'Pendiente', caseNumber: '', country: '', address: '', zipCode: '', phone: '', email: '', type: 'Entrega', floor: '', sycompCase: '', addressStatus: 'idle' });
    const [requesterSuggestions, setRequesterSuggestions] = useState([]);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [modalAddressStatus, setModalAddressStatus] = useState('idle'); // idle | validating | valid | invalid | api_error

    const closeModal = () => {
        setIsModalOpen(false);
        setRequesterSuggestions([]);
        setShowSuggestions(false);
        setModalAddressStatus('idle');
        setNewTicket({ subject: '', requester: '', priority: 'Media', status: 'Pendiente', caseNumber: '', country: '', address: '', zipCode: '', phone: '', email: '', type: 'Entrega', floor: '', sycompCase: '', addressStatus: 'idle' });
    };

    // Search existing tickets by requester name
    const handleRequesterChange = (value) => {
        setNewTicket(prev => ({ ...prev, requester: value }));
        setModalAddressStatus('idle');
        if (value.trim().length < 2) {
            setRequesterSuggestions([]);
            setShowSuggestions(false);
            return;
        }
        const normalize = (s) => (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
        const query = normalize(value);
        const seen = new Set();
        const matches = tickets
            .filter(t => {
                const name = normalize(t.requester);
                return name.includes(query) && !seen.has(name) && seen.add(name);
            })
            .slice(0, 5)
            .map(t => ({
                requester: t.requester,
                address: t.logistics?.address || '',
                phone: t.logistics?.phone || '',
                email: t.logistics?.email || '',
                floor: t.logistics?.floorDept || '',
            }));
        setRequesterSuggestions(matches);
        setShowSuggestions(matches.length > 0);
    };

    const applyRequesterSuggestion = (suggestion) => {
        setNewTicket(prev => ({
            ...prev,
            requester: suggestion.requester,
            address: suggestion.address,
            phone: suggestion.phone,
            email: suggestion.email,
            floor: suggestion.floor,
        }));
        setModalAddressStatus(suggestion.address ? 'valid' : 'idle');
        setShowSuggestions(false);
        setRequesterSuggestions([]);
    };

    // Validate address in the modal using Google Maps
    const validateModalAddress = () => {
        if (typeof window === 'undefined' || !window.google || !window.google.maps) {
            setModalAddressStatus('api_error');
            return;
        }
        const address = newTicket.address;
        if (!address) return;
        setModalAddressStatus('validating');
        const timeoutId = setTimeout(() => setModalAddressStatus('api_error'), 8000);
        try {
            const geocoder = new window.google.maps.Geocoder();
            geocoder.geocode({ address }, (results, status) => {
                clearTimeout(timeoutId);
                if (status === 'OK' && results && results[0]) {
                    setModalAddressStatus('valid');
                    setNewTicket(prev => ({ ...prev, address: results[0].formatted_address }));
                } else if (status === 'ZERO_RESULTS') {
                    setModalAddressStatus('invalid');
                } else {
                    setModalAddressStatus('api_error');
                }
            });
        } catch (e) {
            clearTimeout(timeoutId);
            setModalAddressStatus('api_error');
        }
    };

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

                if (importMode === 'SFDC') {
                    // --- MODO SFDC: Con reglas de Agrupación y Clasificación ---
                    const groups = {};
                    newCases.forEach(c => {
                        const employeeName = extractEmployeeName(c.subject, c.requestedFor);
                        const classification = classifyAction(c.subject);
                        
                        const dateRaw = c.dateOpened ? c.dateOpened.split(/[ T]/)[0] : 'nodate';
                        const normalizeName = (val) => (val || '').normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
                        const groupKey = `${normalizeName(employeeName)}_${classification.action}_${dateRaw}`;
                        
                        if (!groups[groupKey]) {
                            groups[groupKey] = {
                                employeeName,
                                action: classification.action,
                                needsWarning: classification.needsWarning,
                                hasSwapBundle: classification.isSwapBundle || false,
                                cases: []
                            };
                        }
                        groups[groupKey].cases.push(c);
                        if (classification.needsWarning) {
                            groups[groupKey].needsWarning = true;
                        }
                        if (classification.isSwapBundle) {
                            groups[groupKey].hasSwapBundle = true;
                        }
                    });

                    const groupEntries = Object.values(groups);

                    for (const groupData of groupEntries) {
                        const { employeeName, action, needsWarning, hasSwapBundle, cases: group } = groupData;
                        
                        // Filtrar casos que ya existen en tickets
                        const uniqueGroupCases = group.filter(c => {
                            const alreadyExists = tickets.some(t => 
                                (t.subject && t.subject.includes(c.caseNumber)) || 
                                (t.associatedCases && t.associatedCases.some(ac => ac.caseNumber === c.caseNumber)) ||
                                (t.internalNotes && t.internalNotes.some(n => {
                                    if (typeof n === 'string') return n.includes(c.caseNumber);
                                    if (n && typeof n === 'object' && n.content) return n.content.includes(c.caseNumber);
                                    return false;
                                }))
                            );
                            if (alreadyExists) {
                                ticketsSkipped++;
                                return false;
                            }
                            return true;
                        });

                        if (uniqueGroupCases.length === 0) continue;

                        const mainCase = uniqueGroupCases[0];
                        const siblings = uniqueGroupCases.slice(1);

                        // Historial de Contacto
                        const historicalContact = findContactDetailsFromHistory(employeeName, tickets);
                        let contactInfo = {
                            address: mainCase.mailingStreet && mainCase.country ? `${mainCase.mailingStreet}, ${mainCase.country} ${mainCase.zipCode}` : '',
                            floorDept: '',
                            phone: mainCase.mobile || '',
                            email: mainCase.email || ''
                        };
                        
                        if (historicalContact && (historicalContact.address || historicalContact.phone || historicalContact.email)) {
                            if (historicalContact.address) {
                                contactInfo.address = historicalContact.address;
                                contactInfo.floorDept = historicalContact.floorDept || '';
                            }
                            if (historicalContact.phone) contactInfo.phone = historicalContact.phone;
                            if (historicalContact.email) contactInfo.email = historicalContact.email;
                        }

                        // Limpieza de Asunto y Formateo Final
                        let cleanSubject = mainCase.subject.replace(/\[SFDC-[^\]]+\]\s*/g, '').trim();
                        const ticketSubject = `${cleanSubject}${siblings.length > 0 ? ` (+ ${siblings.length} casos agrupados)` : ''}`;

                        const ticketData = {
                            subject: ticketSubject,
                            salesforceCase: mainCase.caseNumber,
                            requester: employeeName,
                            priority: mainCase.priority === 'High' ? 'Alta' : 'Media',
                            status: hasSwapBundle ? 'Bloqueado / A la Espera' : 'Pendiente',
                            client: getClientName(mainCase.country),
                            logistics: {
                                address: contactInfo.address || mainCase.country,
                                floorDept: contactInfo.floorDept,
                                phone: contactInfo.phone,
                                email: contactInfo.email,
                                type: action === 'ENTREGA' ? 'Entrega' : (action === 'REEMPLAZO' ? 'Reemplazo' : 'Recolección')
                            },
                            associatedCases: uniqueGroupCases.map(c => ({
                                caseNumber: c.caseNumber,
                                subject: c.subject,
                                status: c.status,
                                priority: c.priority,
                                dateOpened: c.dateOpened,
                                logistics: {
                                    address: contactInfo.address || c.country,
                                    phone: contactInfo.phone,
                                    email: contactInfo.email,
                                    method: '',
                                    status: 'Pendiente'
                                }
                            }))
                        };

                        ticketData.internalNotes = [];

                        if (siblings.length > 0) {
                            const siblingNotes = siblings.map(s => `• Caso Adicional: [SFDC-${s.caseNumber}] ${s.subject}`).join('\n');
                            ticketData.internalNotes.push(`=== AUTOMATIZACIÓN: CASOS AGRUPADOS ===\nSe han agrupado ${siblings.length} casos adicionales para este flujo físico en el mismo día para ${employeeName}:\n${siblingNotes}`);
                        }

                        if (needsWarning) {
                            ticketData.internalNotes.push(`⚠️ ATENCIÓN: Estar atentos al próximo nuevo caso de RETIRO, ya que en los próximos días ingresará un caso para ir a buscar el asset reemplazado o dañado. O tal vez no se requiera acción porque el asset fue robado o extraviado.`);
                        }
                        
                        if (ticketData.internalNotes.length > 0) {
                            ticketData.description = (mainCase.description || '') + '\n\n' + ticketData.internalNotes.join('\n\n');
                        }

                        await addTicket(ticketData);
                        ticketsCreated++;
                        casesProcessed += uniqueGroupCases.length;
                    }

                    showToast(`Importación completa: Se crearon ${ticketsCreated} servicios unificando ${casesProcessed} casos (${ticketsSkipped} omitidos por ya existir).`, 'success');
                } else {
                    // --- MODO STANDARD: Sin ninguna regla (Comportamiento actual) ---
                    for (const c of newCases) {
                        const alreadyExists = tickets.some(t => 
                            (t.subject && t.subject.includes(c.caseNumber)) || 
                            (t.associatedCases && t.associatedCases.some(ac => ac.caseNumber === c.caseNumber)) ||
                            (t.internalNotes && t.internalNotes.some(n => {
                                if (typeof n === 'string') return n.includes(c.caseNumber);
                                if (n && typeof n === 'object' && n.content) return n.content.includes(c.caseNumber);
                                return false;
                            }))
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
                }

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
                        address: clean(newTicket.address),
                        addressStatus: newTicket.addressStatus || 'idle',
                        phone: clean(newTicket.phone),
                        email: clean(newTicket.email),
                        method: '',
                        status: 'Pendiente'
                    }
                }] : [],
                logistics: {
                    address: clean(newTicket.address),
                    phone: clean(newTicket.phone),
                    email: clean(newTicket.email),
                    type: newTicket.type,
                      method: '',
                      deliveryPerson: '',
                      addressStatus: newTicket.addressStatus || 'idle'
                }
            };
            const createdTicket = await addTicket(ticketData);
            console.log("Manual ticket created:", createdTicket);
            closeModal();
            
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

            // Excluir Resueltos de esta vista, a menos que estemos buscando explicitamente ese estado
            const isNotResolved = columnFilters.status === 'Resuelto' ? true : isTicketActive(t);

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
            pendientes: filteredByCountry.filter(t => t.status === 'Pendiente').length,
            enProgreso: filteredByCountry.filter(t => t.status === 'En Progreso').length,
            bloqueados: filteredByCountry.filter(t => t.status === 'Bloqueado / A la Espera').length,
            resueltos: filteredByCountry.filter(t => t.status === 'Resuelto').length
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
                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
                        <input
                            type="file"
                            ref={fileInputRef}
                            accept=".csv"
                            onChange={handleFileUpload}
                            style={{ display: 'none' }}
                        />
                        {getClientName(countryFilter).toUpperCase().includes('SFDC') && (
                            <Button 
                                onClick={() => triggerImport('SFDC')} 
                                style={{ 
                                    backgroundColor: 'white', 
                                    borderColor: '#00a1e0', 
                                    color: '#00a1e0',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    fontWeight: 600,
                                    boxShadow: 'var(--shadow-sm)'
                                }}
                            >
                                <svg viewBox="0 0 24 24" width="16" height="16" style={{ marginRight: '6px', fill: '#00a1e0', flexShrink: 0 }}>
                                    <path d="M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96z" />
                                </svg>
                                Importar SFDC
                            </Button>
                        )}
                        <Button 
                            icon={Upload} 
                            onClick={() => triggerImport('STANDARD')} 
                            variant="secondary"
                        >
                            Importar CSV
                        </Button>
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

            <div style={{ display: 'flex', gap: '2rem', marginBottom: '2.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
                <Card
                    className="p-4 clickable-card"
                    style={{
                        borderLeft: '4px solid #8b5cf6',
                        cursor: 'pointer',
                        backgroundColor: columnFilters.status === 'All' ? 'rgba(139, 92, 246, 0.15)' : 'var(--surface)',
                        transition: 'all 0.2s ease',
                        minWidth: '220px',
                        boxShadow: columnFilters.status === 'All' ? 'inset 0 0 0 1px #8b5cf6, var(--shadow-sm)' : 'var(--shadow-sm)',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'center',
                        padding: '1.5rem'
                    }}
                    onClick={() => setColumnFilters({ ...columnFilters, status: 'All' })}
                >
                    <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: '0 0 0.5rem 0', color: 'var(--text-secondary)' }}>Total de Servicios</h3>
                    <h2 style={{ fontSize: '2.5rem', fontWeight: 800, margin: 0, color: 'var(--text-main)', lineHeight: '1' }}>{stats.total}</h2>
                </Card>

                <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', maxWidth: '600px' }}>
                    {/* Pendiente Pill */}
                    <div 
                        style={{
                            padding: '0.6rem 1.2rem',
                            borderRadius: '9999px',
                            border: columnFilters.status === 'Pendiente' ? '2px solid #eab308' : '1px solid var(--border)',
                            backgroundColor: columnFilters.status === 'Pendiente' ? '#fef08a' : 'var(--surface)',
                            color: columnFilters.status === 'Pendiente' ? '#854d0e' : 'var(--text-main)',
                            fontWeight: 600,
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                            fontSize: '0.9rem'
                        }}
                        onClick={() => setColumnFilters({ ...columnFilters, status: 'Pendiente' })}
                    >
                        Pendiente {stats.pendientes > 0 && <span>({stats.pendientes})</span>}
                    </div>

                    {/* En Progreso Pill */}
                    <div 
                        style={{
                            padding: '0.6rem 1.2rem',
                            borderRadius: '9999px',
                            border: columnFilters.status === 'En Progreso' ? '2px solid #3b82f6' : '1px solid var(--border)',
                            backgroundColor: columnFilters.status === 'En Progreso' ? '#bfdbfe' : 'var(--surface)',
                            color: columnFilters.status === 'En Progreso' ? '#1e40af' : 'var(--text-main)',
                            fontWeight: 600,
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                            fontSize: '0.9rem'
                        }}
                        onClick={() => setColumnFilters({ ...columnFilters, status: 'En Progreso' })}
                    >
                        En Progreso {stats.enProgreso > 0 && <span>({stats.enProgreso})</span>}
                    </div>

                    {/* Bloqueado Pill */}
                    <div 
                        style={{
                            padding: '0.6rem 1.2rem',
                            borderRadius: '9999px',
                            border: columnFilters.status === 'Bloqueado / A la Espera' ? '2px solid #ef4444' : '1px solid var(--border)',
                            backgroundColor: columnFilters.status === 'Bloqueado / A la Espera' ? '#fecaca' : 'var(--surface)',
                            color: columnFilters.status === 'Bloqueado / A la Espera' ? '#991b1b' : 'var(--text-main)',
                            fontWeight: 600,
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                            fontSize: '0.9rem'
                        }}
                        onClick={() => setColumnFilters({ ...columnFilters, status: 'Bloqueado / A la Espera' })}
                    >
                        Bloqueado / A la Espera {stats.bloqueados > 0 && <span>({stats.bloqueados})</span>}
                    </div>

                    {/* Resuelto Pill */}
                    <div 
                        style={{
                            padding: '0.6rem 1.2rem',
                            borderRadius: '9999px',
                            border: columnFilters.status === 'Resuelto' ? '2px solid #22c55e' : '1px solid var(--border)',
                            backgroundColor: columnFilters.status === 'Resuelto' ? '#bbf7d0' : 'var(--surface)',
                            color: columnFilters.status === 'Resuelto' ? '#166534' : 'var(--text-main)',
                            fontWeight: 600,
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                            fontSize: '0.9rem'
                        }}
                        onClick={() => setColumnFilters({ ...columnFilters, status: 'Resuelto' })}
                    >
                        Resuelto {stats.resueltos > 0 && <span>({stats.resueltos})</span>}
                    </div>
                </div>
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
                                <th style={{ padding: '1rem', fontWeight: 600, color: 'var(--text-secondary)', fontSize: '0.875rem' }}>SRV</th>
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
                                const typeStyles = getTypeStyles(srvType);

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
                                        <td style={{ padding: '1rem', whiteSpace: 'nowrap' }}>
                                            <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '0.25rem 0.5rem', borderRadius: '0.375rem', fontSize: '0.75rem', fontWeight: 700, backgroundColor: typeStyles.bg, color: typeStyles.color, border: `1px solid ${typeStyles.color}` }} title={srvType}>
                                                {typeStyles.label}
                                            </div>
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

            <Modal isOpen={isModalOpen} onClose={() => closeModal()} title="Crear Nuevo Servicio" disableOutsideClick={true}>
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
                            <option value="Recupero">Recupero</option>
                            <option value="Reemplazo">Reemplazo</option>
                            <option value="Garantia">Garantia</option>
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
                    <div className="form-group" style={{ position: 'relative' }}>
                        <label className="form-label">Solicitante</label>
                        <input
                            className="form-input"
                            placeholder="Nombre del empleado"
                            value={newTicket.requester}
                            onChange={e => handleRequesterChange(e.target.value)}
                            onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
                            autoComplete="off"
                        />
                        {showSuggestions && requesterSuggestions.length > 0 && (
                            <div style={{
                                position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50,
                                background: 'var(--card-bg)', border: '1px solid var(--border)',
                                borderRadius: '8px', boxShadow: 'var(--shadow-md)', overflow: 'hidden', marginTop: '2px'
                            }}>
                                {requesterSuggestions.map((s, i) => (
                                    <div
                                        key={i}
                                        onMouseDown={() => applyRequesterSuggestion(s)}
                                        style={{
                                            padding: '0.6rem 1rem', cursor: 'pointer',
                                            borderBottom: i < requesterSuggestions.length - 1 ? '1px solid var(--border)' : 'none',
                                            display: 'flex', flexDirection: 'column', gap: '2px',
                                        }}
                                        onMouseEnter={e => e.currentTarget.style.background = 'var(--surface)'}
                                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                                    >
                                        <span style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-main)' }}>{s.requester}</span>
                                        {s.address && <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>📍 {s.address}</span>}
                                        {s.phone && <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>📞 {s.phone}</span>}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* 4) Direccion & 5) Piso / Dpto */}
                    <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1rem' }}>
                        <div className="form-group" style={{ marginBottom: 0 }}>
                            <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                Dirección Completa
                                {modalAddressStatus === 'valid' && <span style={{ fontSize: '0.7rem', color: '#22c55e', fontWeight: 700 }}>✓ Validada</span>}
                                {modalAddressStatus === 'invalid' && <span style={{ fontSize: '0.7rem', color: '#ef4444', fontWeight: 700 }}>⚠ No encontrada</span>}
                                {modalAddressStatus === 'api_error' && <span style={{ fontSize: '0.7rem', color: '#f59e0b', fontWeight: 700 }}>⚠ Sin validar</span>}
                            </label>
                            <div style={{ position: 'relative' }}>
                                {modalAddressStatus === 'valid'
                                    ? <CheckCircle2 size={12} style={{ position: 'absolute', left: '10px', top: '15px', color: '#22c55e' }} />
                                    : <MapPin size={12} style={{ position: 'absolute', left: '10px', top: '15px', color: 'var(--text-secondary)' }} />
                                }
                                <input
                                    className="form-input"
                                    style={{
                                        paddingLeft: '2.2rem',
                                        paddingRight: newTicket.address ? '80px' : '10px',
                                        height: 'auto',
                                        minHeight: '42px',
                                        fontSize: '1.1rem',
                                        fontWeight: 600,
                                        lineHeight: '1.4',
                                        background: 'var(--background)',
                                        color: 'var(--text-main)',
                                        borderColor: modalAddressStatus === 'valid' ? '#22c55e' : modalAddressStatus === 'invalid' ? '#ef4444' : 'var(--border)'
                                    }}
                                    placeholder="Ej: Av. Siempreviva 742"
                                    value={newTicket.address}
                                    onChange={e => { setModalAddressStatus('idle'); setNewTicket({ ...newTicket, address: e.target.value }); }}
                                />
                                {newTicket.address && (
                                    <button
                                        type="button"
                                        onClick={validateModalAddress}
                                        style={{
                                            position: 'absolute', right: '4px', top: '4px', bottom: '4px',
                                            border: 'none',
                                            background: modalAddressStatus === 'valid' ? '#dcfce7' : '#eff6ff',
                                            color: modalAddressStatus === 'valid' ? '#166534' : '#1d4ed8',
                                            borderRadius: '4px', padding: '0 8px',
                                            fontSize: '0.7rem', fontWeight: 600, cursor: 'pointer',
                                            display: 'flex', alignItems: 'center', gap: '4px'
                                        }}
                                    >
                                        {modalAddressStatus === 'validating' ? (
                                            <Loader2 size={12} className="animate-spin" />
                                        ) : modalAddressStatus === 'valid' ? (
                                            <><CheckCircle size={12} /> OK</>
                                        ) : (
                                            'Validar'
                                        )}
                                    </button>
                                )}
                            </div>
                        </div>
                        <div className="form-group" style={{ marginBottom: 0 }}>
                            <label className="form-label">Piso y Departamento</label>
                            <div style={{ position: 'relative' }}>
                                <Hash size={12} style={{ position: 'absolute', left: '10px', top: '15px', color: 'var(--text-secondary)' }} />
                                <input
                                    className="form-input"
                                    style={{
                                        paddingLeft: '2.2rem',
                                        height: 'auto',
                                        minHeight: '42px',
                                        fontSize: '1.1rem',
                                        fontWeight: 600,
                                        lineHeight: '1.4',
                                        background: 'var(--background)',
                                        color: 'var(--text-main)'
                                    }}
                                    placeholder="Ej: Piso 5, Depto B"
                                    value={newTicket.floor}
                                    onChange={e => setNewTicket({ ...newTicket, floor: e.target.value })}
                                />
                            </div>
                        </div>
                    </div>

                    {/* 6) Telefono & 7) Correo */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                        <div className="form-group" style={{ marginBottom: 0 }}>
                            <label className="form-label">Teléfono de contacto</label>
                            <div style={{ position: 'relative' }}>
                                <Phone size={12} style={{ position: 'absolute', left: '10px', top: '10px', color: 'var(--text-secondary)' }} />
                                <input
                                    className="form-input"
                                    style={{ paddingLeft: '2.2rem', height: '32px', fontSize: '0.85rem' }}
                                    placeholder="Ej: +54 9 11..."
                                    value={newTicket.phone}
                                    onChange={e => setNewTicket({ ...newTicket, phone: e.target.value })}
                                />
                            </div>
                        </div>
                        <div className="form-group" style={{ marginBottom: 0 }}>
                            <label className="form-label">Correo electrónico</label>
                            <div style={{ position: 'relative' }}>
                                <Mail size={12} style={{ position: 'absolute', left: '10px', top: '10px', color: 'var(--text-secondary)' }} />
                                <input
                                    type="email"
                                    className="form-input"
                                    style={{ paddingLeft: '2.2rem', height: '32px', fontSize: '0.85rem' }}
                                    placeholder="Ej: usuario@empresa.com"
                                    value={newTicket.email}
                                    onChange={e => setNewTicket({ ...newTicket, email: e.target.value })}
                                />
                            </div>
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
                        <Button type="button" variant="secondary" onClick={() => closeModal()} style={{ flex: 1 }} disabled={isSubmittingManual}>Cancelar</Button>
                        <Button type="button" onClick={handleCreate} style={{ flex: 1 }} disabled={isSubmittingManual}>
                            {isSubmittingManual ? 'Procesando...' : 'Crear Servicio'}
                        </Button>
                    </div>
                </form>
            </Modal>
        </div >
    );
}


