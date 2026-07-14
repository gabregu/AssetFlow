"use client";
import React, { useState } from 'react';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Modal } from '../../components/ui/Modal';
import { useStore } from '../../../lib/store';
import { Filter, Search, ArrowRight, Upload, Trash2, ArrowUpDown, ArrowUp, ArrowDown, Plus } from 'lucide-react';
import { useRef, useMemo } from 'react';


import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { CopyButton } from '../../components/ui/CopyButton';

export default function SFDCCasesPage() {
    const router = useRouter();
    const { sfdcCases, tickets, logisticsTasks, addTicket, updateTicket, importSfdcCases, clearSfdcCases, removeSfdcCase, lastImportedCases, currentUser, users, countryFilter, getClientName, entities = [] } = useStore();
    
    useEffect(() => {
        if (countryFilter && !countryFilter.toLowerCase().includes('sfdc')) {
            router.push('/dashboard');
        }
    }, [countryFilter, router]);

    const [filter, setFilter] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedCase, setSelectedCase] = useState(null);
    const [newTicket, setNewTicket] = useState({ subject: '', requester: '', priority: 'Media', status: 'Pendiente' });
    const [sortConfig, setSortConfig] = useState({ key: 'age', direction: 'ascending' });
    const [toast, setToast] = useState({ show: false, message: '', type: 'success' }); // Nuevo estado

    // New State for Delivery/Collection Filter
    const [filterType, setFilterType] = useState('ALL'); // 'ALL', 'DELIVERY', 'COLLECTION'

    // Manual Creation State
    const [isManualModalOpen, setIsManualModalOpen] = useState(false);
    const [manualTicket, setManualTicket] = useState({ caseNumber: '', subject: '', requester: '', priority: 'Media', status: 'Pendiente', country: '', address: '', zipCode: '', phone: '', email: '', type: 'Entrega' });

    const fileInputRef = useRef(null);

    // Bulk Actions State
    const [selectedCases, setSelectedCases] = useState([]);

    // Estado para modal de fusión (agregar como caso asociado a ticket existente)
    const [mergeModal, setMergeModal] = useState({ open: false, sfdcCase: null, existingTicket: null });

    const showToast = (message, type = 'success') => {
        setToast({ show: true, message, type });
        setTimeout(() => setToast({ show: false, message: '', type: 'success' }), 3000);
    };

    // Helper functions for filtering cases
    const hasService = (c) => {
        return (tickets && tickets.some(t => 
            String(t.id) === String(c.caseNumber) || 
            (t.associatedCases && t.associatedCases.some(ac => String(ac.caseNumber) === String(c.caseNumber))) ||
            (t.subject && t.subject.includes(c.caseNumber))
        )) || 
        (logisticsTasks && logisticsTasks.some(tk => String(tk.case_number) === String(c.caseNumber)));
    };

    const isActiveCaseStatus = (c) => {
        const status = String(c.status || '').toLowerCase();
        return status.includes('new') || status.includes('progress') || status.includes('hold') || status.includes('waiting') || status.includes('escalated') || status.includes('approved');
    };

    const isCaseInCountryFilter = (c) => {
        const expectedClient = getClientName(countryFilter);
        if (expectedClient === 'Todos') return true;
        const caseClient = getClientName(c.country);
        const matchesCountry = caseClient.toLowerCase() === expectedClient.toLowerCase();
        let forceSycomp = false;
        if (expectedClient === 'Sycomp-SRV' && (String(c.subject || '').includes('1053') || String(c.subject || '').includes('1055') || String(c.subject || '').includes('1056'))) {
            forceSycomp = true;
        }
        return matchesCountry || forceSycomp;
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

    const isTaskActive = (tk) => {
        if (!tk || !tk.status) return false;
        const status = tk.status.toLowerCase().trim();
        const closedStatuses = ['entregado', 'completado', 'cancelado', 'resuelto'];
        return !closedStatuses.includes(status);
    };

    const shouldHideCase = (c) => {
        const relatedTickets = tickets ? tickets.filter(t => 
            String(t.id) === String(c.caseNumber) || 
            (t.salesforceCase && String(t.salesforceCase).trim() === String(c.caseNumber).trim()) ||
            (t.associatedCases && t.associatedCases.some(ac => String(ac.caseNumber).trim() === String(c.caseNumber).trim())) ||
            (t.excludedCases && t.excludedCases.some(ec => String(ec).trim() === String(c.caseNumber).trim())) ||
            (t.subject && t.subject.includes(c.caseNumber))
        ) : [];

        const relatedTasks = logisticsTasks ? logisticsTasks.filter(tk => 
            String(tk.case_number) === String(c.caseNumber)
        ) : [];

        // Si no tiene ningún servicio (ticket o tarea) asociado aún, no se oculta
        if (relatedTickets.length === 0 && relatedTasks.length === 0) {
            return false;
        }

        // Si tiene algún servicio asociado que está abierto/activo, no se oculta (sigue visible)
        const hasOpenService = relatedTickets.some(t => isTicketActive(t)) || relatedTasks.some(tk => isTaskActive(tk));
        if (hasOpenService) {
            return false;
        }

        // Si todos los servicios asociados están cerrados, entonces se oculta
        return true;
    };

    // 3. Estadísticas (Moved up to be available for statsByType and filteredCases)
    const countryFilteredCases = useMemo(() => {
        return sfdcCases.filter(c => {
            if (!isActiveCaseStatus(c)) return false;
            if (!isCaseInCountryFilter(c)) return false;

            // Ocultamos el caso solo si todos sus servicios asociados ya están cerrados/finalizados
            if (shouldHideCase(c)) return false;

            return true;
        });
    }, [sfdcCases, countryFilter, tickets, logisticsTasks]);

    // Metrics for Buttons (Including NEW HIRE filter)
    const statsByType = useMemo(() => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const isNewHire = (c) => {
            const subject = String(c.subject || '').toLowerCase();
            let futureStart = false;
            if (c.startDate) {
                const start = new Date(c.startDate);
                if (!isNaN(start.getTime())) {
                    start.setHours(0, 0, 0, 0);
                    if (start > today) futureStart = true;
                }
            }
            return subject.includes('new hire') || futureStart;
        };

        return {
            delivery: countryFilteredCases.filter(c => !String(c.subject || '').toLowerCase().includes('collection') && !String(c.subject || '').toLowerCase().includes('offboarding') && !isNewHire(c)).length,
            collection: countryFilteredCases.filter(c => String(c.subject || '').toLowerCase().includes('collection') || String(c.subject || '').toLowerCase().includes('offboarding')).length,
            newHire: countryFilteredCases.filter(c => isNewHire(c)).length
        };
    }, [countryFilteredCases]);

    // 1. Filtrado
    const filteredCases = useMemo(() => {
        return countryFilteredCases.filter(c => {
            const matchesText = String(c.subject || '').toLowerCase().includes(filter.toLowerCase()) ||
                String(c.requestedFor || '').toLowerCase().includes(filter.toLowerCase()) ||
                String(c.caseNumber || '').toLowerCase().includes(filter.toLowerCase());

            // Helper New Hire
            const isNewHire = (c) => {
                const subject = String(c.subject || '').toLowerCase();
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                let futureStart = false;
                if (c.startDate) {
                    const start = new Date(c.startDate);
                    if (!isNaN(start.getTime())) {
                        start.setHours(0, 0, 0, 0);
                        if (start > today) futureStart = true;
                    }
                }
                return subject.includes('new hire') || futureStart;
            };

            let matchesType = true;
            if (filterType === 'DELIVERY') {
                matchesType = !String(c.subject || '').toLowerCase().includes('collection') && !String(c.subject || '').toLowerCase().includes('offboarding') && !isNewHire(c);
            } else if (filterType === 'COLLECTION') {
                matchesType = String(c.subject || '').toLowerCase().includes('collection') || String(c.subject || '').toLowerCase().includes('offboarding');
            } else if (filterType === 'NEW_HIRE') {
                matchesType = isNewHire(c);
            }

            return matchesText && matchesType;
        });
    }, [sfdcCases, filter, countryFilter, filterType, tickets, logisticsTasks]);

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
                aValue = parseInt(String(aValue).replace(/\D/g, '')) || 0;
                bValue = parseInt(String(bValue).replace(/\D/g, '')) || 0;
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



    const handleOpenCreateService = async (sfdcCase) => {
        // Buscar si ya existe un ticket activo para el mismo usuario
        const normalize = (val) => (val || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
        const requesterNorm = normalize(sfdcCase.requestedFor);

        const existingTicket = tickets.find(t => {
            if (!isTicketActive(t)) return false;
            return normalize(t.requester) === requesterNorm;
        });

        if (existingTicket) {
            // Fusionar automáticamente
            showToast(`Asociando caso SFDC-${sfdcCase.caseNumber} al servicio activo ${existingTicket.id}...`, 'info');
            
            const newAssociated = {
                caseNumber: sfdcCase.caseNumber,
                subject: sfdcCase.subject,
                status: sfdcCase.status || 'Pendiente',
                priority: sfdcCase.priority,
                dateOpened: sfdcCase.dateOpened,
                logistics: {
                    address: sfdcCase.mailingStreet && sfdcCase.country ? `${sfdcCase.mailingStreet}, ${sfdcCase.country} ${sfdcCase.zipCode}` : '',
                    phone: sfdcCase.mobile || '',
                    email: sfdcCase.email || '',
                    method: '',
                    status: 'Para Coordinar'
                }
            };

            const updatedAssociatedCases = [...(existingTicket.associatedCases || []), newAssociated];
            const success = await updateTicket(existingTicket.id, { associatedCases: updatedAssociatedCases });

            if (success !== false) {
                showToast(`Caso SFDC-${sfdcCase.caseNumber} agrupado con éxito en ${existingTicket.id} (${existingTicket.requester})`, 'success');
                router.push(`/dashboard/tickets/${existingTicket.id}`);
            } else {
                showToast('Error al agregar el caso al servicio existente', 'error');
            }
            return;
        }

        // No existe ticket → abrir modal de creación normal
        setSelectedCase(sfdcCase);
        setNewTicket({
            subject: `[SFDC-${sfdcCase.caseNumber}] ${sfdcCase.subject}`,
            requester: sfdcCase.requestedFor,
            priority: sfdcCase.priority === 'High' ? 'Alta' : 'Media',
            status: 'Pendiente',
            logistics: {
                address: sfdcCase.mailingStreet && sfdcCase.country ? `${sfdcCase.mailingStreet}, ${sfdcCase.country} ${sfdcCase.zipCode}` : '',
                phone: sfdcCase.mobile || '',
                email: sfdcCase.email || '',
                type: 'Entrega'
            }
        });
        setIsModalOpen(true);
    };

    // Agregar SFDC case como caso asociado a un ticket existente
    const handleMergeIntoExisting = async () => {
        const { sfdcCase, existingTicket } = mergeModal;
        if (!sfdcCase || !existingTicket) return;

        const newAssociated = {
            caseNumber: sfdcCase.caseNumber,
            subject: sfdcCase.subject,
            status: sfdcCase.status || 'Pendiente',
            priority: sfdcCase.priority,
            dateOpened: sfdcCase.dateOpened,
            logistics: {
                address: sfdcCase.mailingStreet && sfdcCase.country ? `${sfdcCase.mailingStreet}, ${sfdcCase.country} ${sfdcCase.zipCode}` : '',
                phone: sfdcCase.mobile || '',
                email: sfdcCase.email || '',
                method: '',
                status: 'Para Coordinar'
            }
        };

        const updatedAssociatedCases = [...(existingTicket.associatedCases || []), newAssociated];
        const success = await updateTicket(existingTicket.id, { associatedCases: updatedAssociatedCases });

        if (success !== false) {
            showToast(`Caso SFDC-${sfdcCase.caseNumber} agregado a ${existingTicket.id} (${existingTicket.requester})`, 'success');
            setMergeModal({ open: false, sfdcCase: null, existingTicket: null });
            router.push(`/dashboard/tickets/${existingTicket.id}`);
        } else {
            showToast('Error al agregar el caso al servicio existente', 'error');
        }
    };

    const [isCreating, setIsCreating] = useState(false);

    const getCountryInitial = (country) => {
        if (!country) return '-';
        const c = country.toUpperCase();
        if (c.includes('ARGENTINA')) return 'AR';
        if (c.includes('CHILE')) return 'CH';
        if (c.includes('COLOMBIA')) return 'CO';
        if (c.includes('COSTA RICA')) return 'CR';
        if (c.includes('URUGUAY')) return 'UY';
        return country.substring(0, 2).toUpperCase();
    };

    const handleCreateService = async (e) => {
        console.log("handleCreateService called");
        if (e) {
            e.preventDefault();
            e.stopPropagation();
        }

        if (isCreating) return; // Prevent double clicks
        setIsCreating(true);

        try {
            console.log("Creating ticket with data:", newTicket);

            // 1. Automatización: Buscar casos hermanos si es ENTREGA/ENTREGAS
            // Helper para identificar entrega (misma lógica que el filtro)
            const isDelivery = (c) => !c.subject.toLowerCase().includes('collection') && !c.subject.toLowerCase().includes('offboarding');

            // Helper para normalizar nombres (Quitar acentos, lowercase, trim)
            const normalizeName = (name) => {
                return (name || '').normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
            };

            let finalTicket = { ...newTicket };
            let casesToRemove = [selectedCase.caseNumber];

            // 3. NUEVO: Siempre Guardar estructura de casos asociados para UI (Caso principal)
            finalTicket.associatedCases = [{
                caseNumber: selectedCase.caseNumber,
                subject: selectedCase.subject,
                status: selectedCase.status || 'Pendiente',
                priority: selectedCase.priority,
                dateOpened: selectedCase.dateOpened,
                logistics: {
                    address: finalTicket.logistics?.address || '',
                    phone: finalTicket.logistics?.phone || '',
                    email: finalTicket.logistics?.email || '',
                    method: '',
                    status: 'Para Coordinar'
                }
            }];

            // SIEMPRE buscar hermanos del mismo usuario, sin importar si es entrega o collection
            if (selectedCase) {
                const currentRequestedFor = normalizeName(selectedCase.requestedFor);

                // Buscar todos los casos del mismo usuario (entregas Y collections/offboardings)
                // LÓGICA FLEXIBLE: Coincidencia parcial o exacta normalizada
                const siblings = sfdcCases.filter(c => {
                    if (c.caseNumber === selectedCase.caseNumber) return false; // Skip self

                    const siblingName = normalizeName(c.requestedFor);

                    // 1. Coincidencia exacta normalizada
                    if (siblingName === currentRequestedFor) return true;

                    // 2. Coincidencia parcial segura (Solo si el nombre tiene cierta longitud para evitar falsos positivos con nombres cortos)
                    if (currentRequestedFor.length > 3 && siblingName.length > 3) {
                        return siblingName.includes(currentRequestedFor) || currentRequestedFor.includes(siblingName);
                    }

                    return false;
                });

                if (siblings.length > 0) {
                    console.log(`Found ${siblings.length} sibling cases for ${selectedCase.requestedFor}`);

                    // Consolidar
                    const siblingNotes = siblings.map(s => `• Caso Adicional: [SFDC-${s.caseNumber}] ${s.subject}`).join('\n');
                    const consolidationMsg = `=== AUTOMATIZACIÓN: CASOS AGRUPADOS ===\nSe han detectado y agrupado automáticamente otros casos pendientes para ${selectedCase.requestedFor}:\n${siblingNotes}`;

                    // 1. Agregar a internalNotes (Registro)
                    finalTicket.internalNotes = finalTicket.internalNotes || [];
                    finalTicket.internalNotes.push(consolidationMsg);

                    // 2. Agregar a la descripción o un campo visible "Item más"
                    finalTicket.subject += ` (+ ${siblings.length} casos agrupados)`;

                    // Si el ticket tiene un campo de descripción, lo adjuntamos ahí.
                    finalTicket.description = (finalTicket.description || '') + '\n\n' + consolidationMsg;

                    // Agregar siblings a la estructura de casos asociados
                    const mappedSiblings = siblings.map(s => ({
                        caseNumber: s.caseNumber,
                        subject: s.subject,
                        status: s.status,
                        priority: s.priority,
                        dateOpened: s.dateOpened
                    }));
                    finalTicket.associatedCases = [...finalTicket.associatedCases, ...mappedSiblings];

                    // Marcar para eliminar
                    siblings.forEach(s => casesToRemove.push(s.caseNumber));

                    const count = siblings.length + 1;
                    showToast(`Se agruparon ${count} casos para ${selectedCase.requestedFor}`, 'success');
                }
            }

            const createdTicket = await addTicket(finalTicket);

            if (createdTicket && createdTicket.id) {
                // MODIFICACIÓN: Ya no eliminamos el caso de SFDC para que persista en la tabla de trabajo.
                // Sin embargo, si el usuario explícitamente lo desea, se podría hacer opcional.
                // Por ahora, para cumplir con "que sigan apareciendo", lo dejamos en el store.
                
                setIsModalOpen(false);
                showToast(`Ticket ${createdTicket.id} generado correctamente.`, 'success');
                // Navegación automática al detalle del nuevo ticket
                router.push(`/dashboard/tickets/${createdTicket.id}`);
            } else {
                throw new Error("No se recibió confirmación del ticket creado.");
            }
        } catch (error) {
            console.error('Error creando servicio:', error);
            const msg = `Error: ${error.message || 'Ocurrió un error inesperado.'}`;
            showToast(msg, 'error');
            alert(msg); // Fallback alert ensures user sees the error
        } finally {
            setIsCreating(false);
        }
    };

    const [isSubmittingManual, setIsSubmittingManual] = useState(false);

    const handleCreateManual = async (e) => {
        if (e) e.preventDefault();
        
        if (!manualTicket.subject || !manualTicket.requester) {
            showToast("Por favor completa el Asunto y Solicitante", "error");
            alert("Por favor completa el Asunto y Solicitante");
            return;
        }
        
        if (isSubmittingManual) return;
        setIsSubmittingManual(true);
        console.log("handleCreateManual: Starting submission...");
        try {
            const clean = (str) => typeof str === 'string' ? str.trim().replace(/[\r\n\t\0]+/g, ' ') : String(str || '');
            
            const ticketData = {
                ...manualTicket,
                subject: clean(manualTicket.subject),
                requester: clean(manualTicket.requester),
                associatedCases: manualTicket.caseNumber && manualTicket.caseNumber.trim() !== '' ? [{
                    caseNumber: clean(manualTicket.caseNumber).replace(/\s/g, ''),
                    subject: clean(manualTicket.subject),
                    logistics: {
                        address: manualTicket.address || manualTicket.country ? `${clean(manualTicket.address)}, ${clean(manualTicket.country)} ${clean(manualTicket.zipCode)}`.trim() : '',
                        phone: clean(manualTicket.phone),
                        email: clean(manualTicket.email),
                        method: '',
                        status: 'Pendiente'
                    }
                }] : [],
                logistics: {
                    address: manualTicket.address || manualTicket.country ? `${clean(manualTicket.address)}, ${clean(manualTicket.country)} ${clean(manualTicket.zipCode)}`.trim() : '',
                    phone: clean(manualTicket.phone),
                    email: clean(manualTicket.email),
                    type: manualTicket.type,
                    method: '',
                    deliveryPerson: ''
                }
            };
            
            console.log("Submitting ticketData:", ticketData);
            const createdTicket = await addTicket(ticketData);
            console.log("Created ticket:", createdTicket);
            
            setIsManualModalOpen(false);
            setManualTicket({ caseNumber: '', subject: '', requester: '', priority: 'Media', status: 'Pendiente', country: '', address: '', zipCode: '', phone: '', email: '', type: 'Entrega' });
            
            if (createdTicket?.id) {
                showToast("Servicio creado correctamente", "success");
                router.push(`/dashboard/tickets/${createdTicket.id}`);
            }
        } catch (error) {
            console.error("Error creating manual ticket:", error);
            showToast("Error al crear el servicio: " + (error.message || "Error desconocido"), "error");
            alert("Error del sistema al guardar: " + (error.message || JSON.stringify(error)) + "\nPor favor avísale a soporte.");
        } finally {
            setIsSubmittingManual(false);
        }
    };


    // Bulk Actions Logic
    const handleSelectAll = (e) => {
        if (e.target.checked) {
            setSelectedCases(filteredCases.map(c => c.caseNumber));
        } else {
            setSelectedCases([]);
        }
    };

    const handleSelectCase = (caseNumber) => {
        if (selectedCases.includes(caseNumber)) {
            setSelectedCases(selectedCases.filter(id => id !== caseNumber));
        } else {
            setSelectedCases([...selectedCases, caseNumber]);
        }
    };

    const handleBulkDelete = async () => {
        if (selectedCases.length === 0) return;
        if (confirm(`¿Estás seguro de que deseas eliminar ${selectedCases.length} casos seleccionados?`)) {
            try {
                for (const caseNumber of selectedCases) {
                    await removeSfdcCase(caseNumber);
                }
                showToast(`${selectedCases.length} casos eliminados correctamente`, 'success');
                setSelectedCases([]);
            } catch (error) {
                console.error("Bulk delete error:", error);
                showToast("Error al eliminar los casos seleccionados", "error");
            }
        }
    };

    // Helpers del Motor Logístico ITAM
    const extractEmployeeName = (subject, requestedFor) => {
        if (!subject) return requestedFor || 'Desconocido';
        const cleanSubject = subject.replace(/\[[^\]]+\]/g, '').trim();
        
        // 1. Buscar después de "for " o "Case for "
        const forMatch = cleanSubject.match(/(?:case for|for)\s+([A-Z][a-z\u00c0-\u00ff]+(?:\s+[A-Z][a-z\u00c0-\u00ff]+)+)/i);
        if (forMatch && forMatch[1]) {
            return forMatch[1].trim();
        }
        
        // 2. Buscar después del último guión
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
        
        // 3. Respaldo (Fallback)
        return requestedFor || 'Desconocido';
    };

    const classifyAction = (subject) => {
        const sub = (subject || '').toLowerCase();
        
        // Excepción: "Swap Request Bundle" va junto a la recolección
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
        
        // Tomamos el ticket más reciente por ID (CAS-XXXX) ordenando descendente
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

    // Función centralizada para procesar casos y convertirlos a tickets (automatizada)
    const processCasesToTickets = async (casesToProcess) => {
        if (!casesToProcess || casesToProcess.length === 0) return;

        setIsCreating(true);
        let successCount = 0;
        let casesCreated = 0;

        try {
            const normalize = (val) => (val || '').normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();

            // 1. Motor Logístico: Agrupamiento inteligente
            const groups = {};
            casesToProcess.forEach(c => {
                const employeeName = extractEmployeeName(c.subject, c.requestedFor);
                const classification = classifyAction(c.subject);
                
                // Formatear dateOpened de Salesforce extrayendo solo la fecha de "DD/MM/YYYY" o "YYYY-MM-DD HH:mm:ss"
                const dateRaw = c.dateOpened ? c.dateOpened.split(/[ T]/)[0] : 'nodate';
                const groupKey = `${normalize(employeeName)}_${classification.action}_${dateRaw}`;
                
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
            console.log(`Motor Logístico: Procesando ${groupEntries.length} grupos de ${casesToProcess.length} casos importados.`);

            for (const groupData of groupEntries) {
                const { employeeName, action, needsWarning, hasSwapBundle, cases: group } = groupData;
                const mainCase = group[0];
                const siblings = group.slice(1);

                // 2. Historial de Contacto
                const historicalContact = findContactDetailsFromHistory(employeeName, tickets);
                let contactInfo = {
                    address: mainCase.mailingStreet && mainCase.country ? `${mainCase.mailingStreet}, ${mainCase.country} ${mainCase.zipCode}` : '',
                    floorDept: '',
                    phone: mainCase.mobile || '',
                    email: mainCase.email || ''
                };
                
                if (historicalContact && (historicalContact.address || historicalContact.phone || historicalContact.email)) {
                    // Solo sobrescribimos los campos del CSV si el histórico tiene un valor válido
                    if (historicalContact.address) {
                        contactInfo.address = historicalContact.address;
                        contactInfo.floorDept = historicalContact.floorDept || '';
                    }
                    if (historicalContact.phone) contactInfo.phone = historicalContact.phone;
                    if (historicalContact.email) contactInfo.email = historicalContact.email;
                    
                    console.log(`Historial recuperado para ${employeeName}:`, contactInfo);
                }

                // 3. Limpieza de Asunto y Formateo Final
                let cleanSubject = mainCase.subject.replace(/\[SFDC-[^\]]+\]\s*/g, '').trim();
                const ticketSubject = `${cleanSubject}${siblings.length > 0 ? ` (+ ${siblings.length} casos agrupados)` : ''}`;

                const ticketData = {
                    subject: ticketSubject,
                    salesforceCase: mainCase.caseNumber, // Caso Principal SFDC explícito
                    requester: employeeName,
                    priority: mainCase.priority === 'High' ? 'Alta' : 'Media',
                    status: hasSwapBundle ? 'Bloqueado / A la Espera' : 'Pendiente',
                    logistics: {
                        address: contactInfo.address,
                        floorDept: contactInfo.floorDept,
                        phone: contactInfo.phone,
                        email: contactInfo.email,
                        type: action === 'ENTREGA' ? 'Entrega' : (action === 'REEMPLAZO' ? 'Reemplazo' : 'Recolección')
                    },
                    associatedCases: group.map(c => ({
                        caseNumber: c.caseNumber,
                        subject: c.subject,
                        status: c.status,
                        priority: c.priority,
                        dateOpened: c.dateOpened,
                        logistics: {
                            address: contactInfo.address,
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

                const created = await addTicket(ticketData);
                if (created && created.id) {
                    successCount += group.length;
                    casesCreated++;
                }
            }

            showToast(`Automatización Logística: Se crearon ${casesCreated} servicios unificando ${successCount} casos importados.`, 'success');
        } catch (error) {
            console.error('Error in automated processing:', error);
            showToast(`Error en automatización: ${error.message}`, 'error');
        } finally {
            setIsCreating(false);
        }
    };

    const handleFileUpload = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (event) => {
            const buffer = event.target.result;
            const decoder = new TextDecoder('utf-8');
            let text = decoder.decode(buffer);

            // Si detectamos el carácter de reemplazo , re-decodificamos como Latin1
            if (text.includes('')) {
                console.log("Detectada codificación no UTF-8 en SFDC. Re-decodificando como ISO-8859-1...");
                const latinDecoder = new TextDecoder('iso-8859-1');
                text = latinDecoder.decode(buffer);
            }

            // --- SANITIZACIÓN DE HEADERS CORRUPTOS (Fix para reporte Chile/SFDC) ---
            // El reporte de Chile viene con un error conocido donde "Mailing Country" y "Case Owner Alias"
            // están fusionados sin coma: "Mailing Country"wner Alias"
            // Esto rompe el parser. Lo arreglamos reemplazando por la versión correcta.
            if (text.includes('"Mailing Country"wner Alias"')) {
                console.warn('Detectado header corrupto SFDC. Aplicando parche...');
                text = text.replace('"Mailing Country"wner Alias"', '"Mailing Country","Case Owner Alias"');
            }

            // Fix adicional para posibles saltos de línea excesivos en headers (campo "Start Date" a veces viene sucio)
            // Buscamos patrones de comillas que no cierran en la misma línea si parece ser el header
            // (Simplemente el parser lo manejará si las comillas están bien, pero el fix anterior es el crítico).

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
            // Limpieza agresiva: trim y quitar comillas envolventes de los headers si existen
            const headers = data[0].map(h => h.trim().replace(/^"|"$/g, ''));

            console.log('CSV Headers detectados:', headers); // DEBUG

            const rows = data.slice(1);

            const newCases = [];
            
            // --- NUEVO: Permitir Sobrescribir Región ---
            let overrideRegion = false;
            if (countryFilter !== 'Todos') {
                overrideRegion = confirm(`¿Deseas asignar todos los casos importados a la región "${countryFilter}"?\n\n(Aceptar = Usar "${countryFilter}" / Cancelar = Usar país del CSV)`);
            }

            // Helper to get value by header name
            const getVal = (rowValues, colName) => {
                const index = headers.indexOf(colName);
                // Intento alternativo (case insensitive)
                if (index === -1) {
                    const indexAlt = headers.findIndex(h => h.toLowerCase() === colName.toLowerCase());
                    return indexAlt !== -1 ? (rowValues[indexAlt] || '').trim() : '';
                }
                return (rowValues[index] || '').trim();
            };

            for (let i = 0; i < rows.length; i++) {
                const rowValues = rows[i];
                if (!rowValues || rowValues.length === 0) continue;

                // Validate valid row (must have Case Number)
                const caseNum = getVal(rowValues, 'Case Number');
                if (!caseNum) {
                    // Si falla en la primera fila, logueamos para entender por qué
                    if (i === 0) console.warn('Fila 1 ignorada. Headers disponibles:', headers, 'Valor buscado: Case Number');
                    continue;
                }

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

                const newCase = {
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
                    country: getClientName(overrideRegion ? countryFilter : (getVal(rowValues, 'Mailing Country') || ''))
                };

                // --- VALIDACIÓN ESTRICTA DE PAÍS ---
                // El usuario requiere que el campo "Mailing Country" sea OBLIGATORIO.
                // Si no está presente o está vacío, no se debe importar el archivo.
                if (!newCase.country) {
                    alert(`Error en fila ${i + 2}: El campo "Mailing Country" es obligatorio.\n\nEl archivo no se importará.`);
                    return; // Cancelamos TODA la importación
                }

                // Eliminamos la auto-asignación basada en filtro. El CSV es la fuente de la verdad.

                newCases.push(newCase);
            }

            // 1. Limpiar casos previos de los países/regiones que estamos importando en este archivo
            // para que los viejos desaparezcan y solo queden los nuevos de esta carga.
            const countriesToClear = [...new Set(newCases.map(c => c.country).filter(Boolean))];
            for (const country of countriesToClear) {
                await clearSfdcCases(country);
            }

            // 2. Deduplicar internamente el CSV por número de caso para evitar duplicados en el mismo archivo
            const seenCaseNumbers = new Set();
            const deduplicatedNewCases = newCases.filter(c => {
                if (seenCaseNumbers.has(c.caseNumber)) return false;
                seenCaseNumbers.add(c.caseNumber);
                return true;
            });

            // 3. Filtrar duplicados ya convertidos a SERVICIOS/TICKETS
            // Buscamos si el caseNumber está asociado a algún ticket existente en cualquiera de sus campos
            const existingConvertedCaseNumbers = new Set();

            tickets.forEach(t => {
                deduplicatedNewCases.forEach(nc => {
                    const caseNumStr = String(nc.caseNumber).trim();
                    if (!caseNumStr) return;

                    // 3.1 En el ID del ticket
                    const isIdMatch = t.id && String(t.id).trim().includes(caseNumStr);

                    // 3.2 En el asunto (subject)
                    const isSubjectMatch = t.subject && t.subject.includes(caseNumStr);

                    // 3.3 En el campo explícito de Salesforce Case
                    const isSfdcMatch = t.salesforceCase && String(t.salesforceCase).trim() === caseNumStr;

                    // 3.4 En la lista de casos agrupados/consolidados
                    const isAssociatedMatch = t.associatedCases && t.associatedCases.some(ac => 
                        ac.caseNumber && String(ac.caseNumber).trim() === caseNumStr
                    );

                    // 3.5 En la lista de casos excluidos
                    const isExcludedMatch = t.excludedCases && t.excludedCases.some(ec => 
                        String(ec).trim() === caseNumStr
                    );

                    if (isIdMatch || isSubjectMatch || isSfdcMatch || isAssociatedMatch || isExcludedMatch) {
                        existingConvertedCaseNumbers.add(nc.caseNumber);
                    }
                });
            });

            // Como acabamos de borrar el inbox de la base de datos para estos países,
            // no es necesario filtrar contra existingInboxCaseNumbers (que ya no existen).
            // Solo filtramos contra los que ya se convirtieron a tickets en el sistema.
            const uniqueCases = deduplicatedNewCases.filter(c => {
                const isConverted = existingConvertedCaseNumbers.has(c.caseNumber);

                // Debug log para ver qué estamos saltando
                if (isConverted) console.log(`Skipping Case ${c.caseNumber} (Already valid/associated Ticket)`);

                return !isConverted;
            });

            if (uniqueCases.length > 0) {
                // En lugar de solo importar, los procesamos para crear servicios de inmediato
                processCasesToTickets(uniqueCases);
                
                // Los guardamos en el store como respaldo. Como acabamos de vaciar la tabla para estos países,
                // esto insertará únicamente la nueva tanda de casos.
                importSfdcCases(uniqueCases);
                
                const skippedCount = newCases.length - uniqueCases.length;
                showToast(`Se detectaron ${uniqueCases.length} casos nuevos. Iniciando creación automática...`, 'info');
                alert(`Importación completada:\n- ${uniqueCases.length} casos nuevos agregados.\n- ${skippedCount} casos omitidos (ya existían como servicios).`);
                
                // Ordenar los casos nuevos arriba y los más viejos abajo (fecha descendente)
                setSortConfig({ key: 'dateOpened', direction: 'descending' });
            } else {
                showToast('No se encontraron casos nuevos.', 'info');
                alert('No se agregaron casos nuevos.\nTodos los casos en el archivo CSV ya existen en el sistema (como servicios).');
            }

            e.target.value = null; // Reset input
        };
        reader.readAsArrayBuffer(file);
    };



    // 3. Estadísticas

    const stats = useMemo(() => {
        const counts = {};
        countryFilteredCases.forEach(c => {
            const s = c.status || 'Desconocido';
            counts[s] = (counts[s] || 0) + 1;
        });
        return counts;
    }, [countryFilteredCases]);

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
            <div style={{ marginBottom: '2rem' }} className="flex-mobile-column">
                <div>
                    <h1 style={{ fontSize: '1.8rem', fontWeight: 700, color: 'var(--text-main)' }}>Casos Salesforce (SFDC)</h1>
                    <p style={{ color: 'var(--text-secondary)' }}>Importar y gestionar casos Salesforce de cliente {countryFilter}.</p>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', alignItems: 'stretch', marginTop: '1rem' }} className="show-mobile">
                    {/* Mobile optimized buttons if needed, or just let regular flex handle it */}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', alignItems: 'flex-end' }} className="hide-mobile">
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <Button icon={Plus} onClick={() => setIsManualModalOpen(true)} style={{ backgroundColor: '#8b5cf6', color: 'white' }}>
                            Nuevo Caso
                        </Button>
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
                    {(currentUser?.role === 'admin' || currentUser?.role === 'Gerencial') && countryFilter !== 'Todos' && (
                        <button
                            onClick={() => {
                                if (confirm(`¿Estás seguro de borrar todos los casos importados de ${countryFilter}?`)) {
                                    clearSfdcCases(countryFilter);
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
                            <Trash2 size={16} /> Limpiar {countryFilter}
                        </button>
                    )}
                </div>
            </div>

            {/* Dashboard / Metrics Section - Compacted Row */}
            {/* Dashboard / Metrics Section - Compacted Row */}
            {sfdcCases.length > 0 && (
                <div className="grid-responsive-6" style={{ marginBottom: '1.5rem' }}>
                    {/* Total Backlog Card */}
                    <Card style={{ minWidth: '140px', flex: 1, padding: '1rem' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', justifyContent: 'center' }}>
                            <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                TOTAL BACKLOG
                            </div>
                            <div style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--text-main)', marginTop: '0.25rem' }}>
                                {countryFilteredCases.length}
                            </div>
                            <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>Casos</div>
                        </div>
                    </Card>

                    {/* New Imported Card */}
                    <Card style={{ minWidth: '140px', flex: 1, padding: '1rem', borderLeft: '3px solid #8b5cf6', background: 'rgba(139, 92, 246, 0.03)' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', justifyContent: 'center' }}>
                            <div style={{ fontSize: '0.7rem', color: '#8b5cf6', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                Nuevos
                            </div>
                            <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#8b5cf6', marginTop: '0.25rem' }}>
                                +{lastImportedCases.filter(c => countryFilter === 'Todos' || (c.country && getClientName(c.country).toLowerCase() === getClientName(countryFilter).toLowerCase())).length}
                            </div>
                            <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>Última carga</div>
                        </div>
                    </Card>

                    {/* Dynamic Status Cards */}
                    {Object.entries(stats).map(([status, count]) => (
                        <Card key={status} style={{ minWidth: '140px', flex: 1, padding: '1rem' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', height: '100%', justifyContent: 'space-between' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                    <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-main)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{status}</div>
                                    <div style={{
                                        width: '8px',
                                        height: '8px',
                                        borderRadius: '50%',
                                        backgroundColor: getStatusColor(status),
                                        boxShadow: `0 0 5px ${getStatusColor(status)}`,
                                        flexShrink: 0
                                    }} />
                                </div>
                                <div style={{ marginTop: '0.5rem' }}>
                                    <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-main)' }}>{count}</div>
                                    <div style={{ width: '100%', height: '3px', background: 'var(--border)', borderRadius: '2px', marginTop: '0.25rem', overflow: 'hidden' }}>
                                        <div style={{
                                            width: `${(count / countryFilteredCases.length) * 100}%`,
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
                    {selectedCases.length > 0 ? (
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
                            <span style={{ fontWeight: 600, color: '#b91c1c' }}>{selectedCases.length} casos seleccionados</span>
                            <Button 
                                size="sm" 
                                onClick={handleBulkDelete} 
                                icon={Trash2}
                                style={{ backgroundColor: '#dc2626', borderColor: '#dc2626' }}
                            >
                                Borrar Seleccionados
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => setSelectedCases([])} style={{ marginLeft: 'auto', color: '#b91c1c' }}>
                                Cancelar
                            </Button>
                        </div>
                    ) : (
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
                    )}
                </div>

                <div className="table-responsive desktop-table">
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                        <thead>
                            <tr style={{ borderBottom: '1px solid var(--border)' }}>
                                <th style={{ padding: '1rem', width: '40px' }}>
                                    <input
                                        type="checkbox"
                                        onChange={handleSelectAll}
                                        checked={filteredCases.length > 0 && selectedCases.length === filteredCases.length}
                                        style={{ cursor: 'pointer', width: '16px', height: '16px' }}
                                    />
                                </th>
                                <Th id="caseNumber" width="100px">Case #</Th>
                                <th style={{ padding: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', fontSize: '0.8rem', width: '50px' }}>Cliente</th>
                                <Th id="status">Status</Th>
                                <Th id="age">Age</Th>
                                <Th id="dateOpened">Opened</Th>
                                <Th id="subject">Subject</Th>
                                <Th id="requestedFor">Requested For</Th>
                                <th style={{ padding: '1rem', width: '120px' }}>Acción</th>
                            </tr>
                        </thead>
                        <tbody>
                            {sortedCases.map((c) => (
                                <tr key={c.caseNumber} style={{ borderBottom: '1px solid var(--border)', background: selectedCases.includes(c.caseNumber) ? '#f0f9ff' : 'transparent' }}>
                                    <td style={{ padding: '1rem' }}>
                                        <input
                                            type="checkbox"
                                            checked={selectedCases.includes(c.caseNumber)}
                                            onChange={() => handleSelectCase(c.caseNumber)}
                                            style={{ cursor: 'pointer', width: '16px', height: '16px' }}
                                        />
                                    </td>
                                    <td style={{ padding: '1rem', fontWeight: 500 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                            {c.caseNumber}
                                            <CopyButton text={c.caseNumber} />
                                        </div>
                                    </td>
                                    <td style={{ padding: '0.75rem' }}>
                                        {c.country && (
                                            <span style={{
                                                display: 'inline-flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                width: '24px',
                                                height: '24px',
                                                borderRadius: '50%',
                                                background: '#f1f5f9',
                                                color: '#475569',
                                                fontSize: '0.7rem',
                                                fontWeight: 700,
                                                border: '1px solid #e2e8f0'
                                            }} title={c.country}>
                                                {getCountryInitial(c.country)}
                                            </span>
                                        )}
                                    </td>
                                    <td style={{ padding: '1rem' }}>
                                        <Badge variant="outline">{c.status}</Badge>
                                    </td>
                                    <td style={{ padding: '1rem', color: 'var(--text-secondary)' }}>{c.age}</td>
                                    <td style={{ padding: '1rem', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>{c.dateOpened}</td>
                                    <td style={{ padding: '1rem', fontWeight: 500 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                            <div style={{ maxWidth: '220px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={c.subject}>
                                                {c.subject}
                                            </div>
                                            <CopyButton text={c.subject} />
                                        </div>
                                    </td>
                                    <td style={{ padding: '1rem' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                            {c.requestedFor}
                                            {c.requestedFor && <CopyButton text={c.requestedFor} />}
                                        </div>
                                    </td>
                                    <td style={{ padding: '1rem' }}>
                                        {(() => {
                                            const linkedTicket = 
                                                (tickets?.find(t => 
                                                    String(t.id) === String(c.caseNumber) || 
                                                    (t.associatedCases && t.associatedCases.some(ac => String(ac.caseNumber) === String(c.caseNumber))) ||
                                                    (t.subject && t.subject.includes(c.caseNumber))
                                                )) || 
                                                (logisticsTasks?.find(tk => String(tk.case_number) === String(c.caseNumber)));

                                            if (linkedTicket) {
                                                const ticketId = linkedTicket.ticket_id || linkedTicket.id;
                                                return (
                                                    <Button 
                                                        size="sm" 
                                                        variant="outline" 
                                                        icon={ArrowRight}
                                                        onClick={() => router.push(`/dashboard/tickets/${ticketId}`)}
                                                        style={{ fontSize: '0.75rem', padding: '0.4rem 0.6rem' }}
                                                    >
                                                        Ver Ticket
                                                    </Button>
                                                );
                                            } else {
                                                return (
                                                    <Button 
                                                        size="sm" 
                                                        icon={ArrowRight}
                                                        onClick={() => handleOpenCreateService(c)}
                                                        style={{ fontSize: '0.75rem', padding: '0.4rem 0.6rem' }}
                                                    >
                                                        Atender
                                                    </Button>
                                                );
                                            }
                                        })()}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* Mobile Cards View */}
                <div className="mobile-only">
                    {filteredCases.map(c => (
                        <div key={c.caseNumber} className="ticket-card-mobile" style={{ borderLeft: `4px solid ${getPriorityColor(c.priority)}` }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                                <div>
                                    <div style={{ fontWeight: 800, color: 'var(--text-main)', fontSize: '1rem' }}>
                                        {c.caseNumber}
                                    </div>
                                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                                        {getClientName(c.country)}
                                    </div>
                                </div>
                                <div style={{ textAlign: 'right' }}>
                                    <Badge variant="outline" style={{ fontSize: '0.75rem', marginBottom: '4px' }}>
                                        {c.age} d
                                    </Badge>
                                </div>
                            </div>
                            <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: '0.5rem' }}>
                                {c.subject}
                            </div>
                            <div style={{ background: 'var(--background)', padding: '0.75rem', borderRadius: '6px', fontSize: '0.85rem', marginBottom: '0.75rem' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                                    <span style={{ color: 'var(--text-secondary)' }}>Status:</span>
                                    <span style={{ fontWeight: 600 }}>{c.status}</span>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <span style={{ color: 'var(--text-secondary)' }}>Solicitante:</span>
                                    <span style={{ fontWeight: 600 }}>{c.requestedFor}</span>
                                </div>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                                {(() => {
                                    const linkedTicket = 
                                        (tickets?.find(t => 
                                            String(t.id) === String(c.caseNumber) || 
                                            (t.associatedCases && t.associatedCases.some(ac => String(ac.caseNumber) === String(c.caseNumber))) ||
                                            (t.subject && t.subject.includes(c.caseNumber))
                                        )) || 
                                        (logisticsTasks?.find(tk => String(tk.case_number) === String(c.caseNumber)));

                                    if (linkedTicket) {
                                        const ticketId = linkedTicket.ticket_id || linkedTicket.id;
                                        return (
                                            <Button 
                                                size="sm" 
                                                variant="outline" 
                                                icon={ArrowRight}
                                                onClick={() => router.push(`/dashboard/tickets/${ticketId}`)}
                                                style={{ width: '100%' }}
                                            >
                                                Ver Ticket
                                            </Button>
                                        );
                                    } else {
                                        return (
                                            <Button 
                                                size="sm" 
                                                icon={ArrowRight}
                                                onClick={() => handleOpenCreateService(c)}
                                                style={{ width: '100%' }}
                                            >
                                                Atender
                                            </Button>
                                        );
                                    }
                                })()}
                            </div>
                        </div>
                    ))}
                </div>
            </Card>

            {/* Modal de fusión: agregar como caso asociado a ticket existente */}
            <Modal isOpen={mergeModal.open} onClose={() => setMergeModal({ open: false, sfdcCase: null, existingTicket: null })} title="Servicio existente detectado">
                {mergeModal.existingTicket && mergeModal.sfdcCase && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                        <div style={{ background: 'var(--background)', borderRadius: 'var(--radius-md)', padding: '1rem', border: '1px solid var(--border)' }}>
                            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.4rem', textTransform: 'uppercase', fontWeight: 700 }}>Caso SFDC a atender</p>
                            <p style={{ fontWeight: 700, fontSize: '1rem', marginBottom: '0.25rem' }}>SFDC-{mergeModal.sfdcCase.caseNumber}</p>
                            <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>{mergeModal.sfdcCase.subject}</p>
                        </div>

                        <div style={{ background: 'rgba(37,99,235,0.07)', borderRadius: 'var(--radius-md)', padding: '1rem', border: '1px solid rgba(37,99,235,0.2)' }}>
                            <p style={{ fontSize: '0.8rem', color: '#2563eb', marginBottom: '0.4rem', textTransform: 'uppercase', fontWeight: 700 }}>✓ Ya existe un servicio activo para {mergeModal.sfdcCase.requestedFor}</p>
                            <p style={{ fontWeight: 700, fontSize: '1rem', marginBottom: '0.25rem', color: '#2563eb' }}>{mergeModal.existingTicket.id}</p>
                            <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>{mergeModal.existingTicket.subject}</p>
                        </div>

                        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                            ¿Querés agregar este caso SFDC como <strong>caso asociado</strong> al servicio existente, o crear un <strong>nuevo servicio</strong> independiente?
                        </p>

                        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                            <button
                                onClick={handleMergeIntoExisting}
                                style={{
                                    flex: 1, padding: '0.75rem 1rem', background: '#2563eb', color: 'white',
                                    border: 'none', borderRadius: 'var(--radius-md)', fontWeight: 700,
                                    cursor: 'pointer', fontSize: '0.9rem'
                                }}
                            >
                                → Agregar al servicio existente ({mergeModal.existingTicket.id})
                            </button>
                            <button
                                onClick={() => {
                                    setMergeModal({ open: false, sfdcCase: null, existingTicket: null });
                                    const c = mergeModal.sfdcCase;
                                    setSelectedCase(c);
                                    setNewTicket({
                                        subject: `[SFDC-${c.caseNumber}] ${c.subject}`,
                                        requester: c.requestedFor,
                                        priority: c.priority === 'High' ? 'Alta' : 'Media',
                                        status: 'Pendiente',
                                        logistics: {
                                            address: c.mailingStreet && c.country ? `${c.mailingStreet}, ${c.country} ${c.zipCode}` : '',
                                            phone: c.mobile || '',
                                            email: c.email || '',
                                            type: 'Entrega'
                                        }
                                    });
                                    setIsModalOpen(true);
                                }}
                                style={{
                                    flex: 1, padding: '0.75rem 1rem', background: 'var(--surface)', color: 'var(--text-main)',
                                    border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', fontWeight: 600,
                                    cursor: 'pointer', fontSize: '0.9rem'
                                }}
                            >
                                + Crear nuevo servicio
                            </button>
                        </div>
                    </div>
                )}
            </Modal>

            <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Crear Caso desde SFDC">
                <div /* Changed from form to div to avoid validation issues */ >
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
                                className="form-input"
                                value={newTicket.subject}
                                onChange={e => setNewTicket({ ...newTicket, subject: e.target.value })}
                            />
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                            <div className="form-group">
                                <label className="form-label" style={{ marginBottom: '0.5rem', display: 'block' }}>Solicitante</label>
                                <input
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
                        <button
                            type="button"
                            onClick={() => setIsModalOpen(false)}
                            style={{
                                padding: '0.75rem 1.5rem',
                                border: '1px solid #ccc',
                                background: 'white',
                                borderRadius: '6px',
                                cursor: 'pointer',
                                fontSize: '0.9rem'
                            }}
                        >
                            Cancelar
                        </button>
                        <button
                            type="button"
                            onClick={handleCreateService}
                            disabled={isCreating}
                            style={{
                                padding: '0.75rem 1.5rem',
                                background: isCreating ? '#9ca3af' : '#dc2626', // Gray if processing, Red if active
                                color: 'white',
                                border: 'none',
                                borderRadius: '6px',
                                cursor: isCreating ? 'not-allowed' : 'pointer',
                                fontWeight: 'bold',
                                fontSize: '0.9rem',
                                boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                                zIndex: 10001, // Ensure it's on top
                                position: 'relative'
                            }}
                        >
                            {isCreating ? 'Procesando...' : 'Generar Ticket'}
                        </button>
                    </div>
                </div>
            </Modal>
            <Modal isOpen={isManualModalOpen} onClose={() => setIsManualModalOpen(false)} title="Crear Nuevo Caso">
                <form onSubmit={handleCreateManual} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                    <div className="form-group">
                        <label className="form-label">Número de Caso SFDC (Opcional)</label>
                        <input
                            className="form-input"
                            placeholder="Ej: 03102345"
                            value={manualTicket.caseNumber}
                            onChange={e => setManualTicket({ ...manualTicket, caseNumber: e.target.value })}
                        />
                    </div>
                    <div className="form-group">
                        <label className="form-label">Asunto</label>
                        <input
                            className="form-input"
                            placeholder="Ej: Problema con monitor"
                            value={manualTicket.subject}
                            onChange={e => setManualTicket({ ...manualTicket, subject: e.target.value })}
                        />
                    </div>
                    <div className="form-group">
                        <label className="form-label">Solicitante</label>
                        <input
                            className="form-input"
                            placeholder="Nombre del empleado"
                            value={manualTicket.requester}
                            onChange={e => setManualTicket({ ...manualTicket, requester: e.target.value })}
                        />
                    </div>
                    <div className="form-group">
                        <label className="form-label">Prioridad</label>
                        <select
                            className="form-select"
                            value={manualTicket.priority}
                            onChange={e => setManualTicket({ ...manualTicket, priority: e.target.value })}
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
                                    value={manualTicket.type}
                                    onChange={e => setManualTicket({ ...manualTicket, type: e.target.value })}
                                >
                                    <option value="Entrega">Entrega</option>
                                    <option value="Recolección">Recolección</option>
                                    <option value="Reemplazo">Reemplazo</option>
                                </select>
                            </div>
                            <div className="form-group">
                                <label className="form-label">Cliente</label>
                                <select
                                    className="form-select"
                                    value={manualTicket.country}
                                    onChange={e => setManualTicket({ ...manualTicket, country: e.target.value })}
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
                                value={manualTicket.address}
                                onChange={e => setManualTicket({ ...manualTicket, address: e.target.value })}
                            />
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '1rem' }}>
                            <div className="form-group">
                                <label className="form-label">Código Postal</label>
                                <input
                                    className="form-input"
                                    placeholder="Ej: 1414"
                                    value={manualTicket.zipCode}
                                    onChange={e => setManualTicket({ ...manualTicket, zipCode: e.target.value })}
                                />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Teléfono (Mobile)</label>
                                <input
                                    className="form-input"
                                    placeholder="Ej: +54 9 11..."
                                    value={manualTicket.phone}
                                    onChange={e => setManualTicket({ ...manualTicket, phone: e.target.value })}
                                />
                            </div>
                        </div>
                        <div className="form-group" style={{ marginTop: '1rem' }}>
                            <label className="form-label">Email</label>
                            <input
                                type="email"
                                className="form-input"
                                placeholder="Ej: usuario@empresa.com"
                                value={manualTicket.email}
                                onChange={e => setManualTicket({ ...manualTicket, email: e.target.value })}
                            />
                        </div>
                    </div>

                    <div className="flex-mobile-column" style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1rem' }}>
                        <Button type="button" variant="secondary" onClick={() => setIsManualModalOpen(false)} style={{ flex: 1 }} disabled={isSubmittingManual}>Cancelar</Button>
                        <Button type="button" onClick={handleCreateManual} style={{ flex: 1 }} disabled={isSubmittingManual}>
                            {isSubmittingManual ? 'Procesando...' : 'Crear Caso'}
                        </Button>
                    </div>
                </form>
            </Modal>
        </div>
    );
}
