'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useStore } from '@/lib/store';
import { useJsApiLoader } from '@react-google-maps/api';

const libraries = ['geometry'];

// Helper to identify unconfigured automatic SFDC cases
const isAutoUnconfiguredCase = (task) => {
    const caseNum = task.caseNumber || task.case_number;
    if (!caseNum) return false;
    
    // Check if it's an 8-digit SFDC case number
    const isSFDCCase = /^\d{8}$/.test(String(caseNum).trim());
    if (!isSFDCCase) return false;
    
    // Check if it has no assets and is not configured
    const hasNoAssets = !task.assets || task.assets.length === 0;
    const isUnconfigured = !task.method || task.method === 'Sin método' || task.method === 'Pendiente' || !task.status || task.status === 'No requiere accion' || task.status === 'Pendiente';
    
    return hasNoAssets && isUnconfigured;
};

export function useTicketDetail() {
    const params = useParams();
    const router = useRouter();
    const { 
        tickets, assets, consumables, users, sfdcCases, yubikeys, 
        addTicket, updateTicket, deleteTicket, addAsset, updateAsset, 
        updateConsumableStock, currentUser,
        logisticsTasks, addLogisticsTask, updateLogisticsTask, deleteLogisticsTask
    } = useStore();

    const [editedData, setEditedData] = useState({});
    const [selectedCaseIndex, setSelectedCaseIndex] = useState(null);
    const ticket = useMemo(() => tickets.find(t => t.id === params.id), [tickets, params.id]);
    const ticketTasks = useMemo(() => {
        const tasks = logisticsTasks.filter(t => t.ticket_id === params.id);
        const ticketClient = ticket?.client || ticket?.logistics?.country || 'Argentina';
        return tasks.map(t => ({
            ...t,
            country: t.country || ticketClient
        }));
    }, [logisticsTasks, params.id, ticket]);

    const [showAutoCases, setShowAutoCases] = useState(false);

    // Lista unificada: Mostrar únicamente las tareas reales de la base de datos (Casos Consolidados/Manuales) 
    // en la sección inferior de Casos Asociados por defecto. Si el usuario activa "showAutoCases",
    // se fusionan también los asociados automáticos heredados de la columna JSONB.
    const unifiedTasks = useMemo(() => {
        const baseTasks = ticketTasks || [];
        if (!showAutoCases) {
            return baseTasks
                .filter(t => !isAutoUnconfiguredCase(t))
                .map(t => ({
                    ...t,
                    country: t.country || (ticket?.client || ticket?.logistics?.country || 'Argentina')
                }));
        }

        const legacyCases = (editedData && editedData.associatedCases) || [];
        
        // Deduplicar por caseNumber (evitar duplicar si ya existe en ticketTasks)
        const filteredLegacy = legacyCases.filter(lc => 
            lc.caseNumber && lc.caseNumber !== 'Caso Principal' && 
            !baseTasks.some(rt => String(rt.caseNumber || rt.case_number).trim() === String(lc.caseNumber).trim())
        );

        const tasks = [...baseTasks, ...filteredLegacy];
        const ticketClient = ticket?.client || ticket?.logistics?.country || 'Argentina';
        return tasks.map(t => ({
            ...t,
            country: t.country || ticketClient
        }));
    }, [ticketTasks, ticket, showAutoCases, editedData]);

    const [editMode, setEditMode] = useState(false);
    const [editLogistics, setEditLogistics] = useState(false);
    const [editAssets, setEditAssets] = useState(false);
    const [editAccessories, setEditAccessories] = useState(false);
    const [editSchedule, setEditSchedule] = useState(false);
    const [editContact, setEditContact] = useState(false);
    const [newNote, setNewNote] = useState('');
    const [addressStatus, setAddressStatus] = useState('idle');
    const autoLinkedRef = useRef({});

    const { isLoaded } = useJsApiLoader({
        id: 'google-map-script',
        googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY,
        libraries
    });

    // State for Asset Search
    const [serialQuery, setSerialQuery] = useState('');
    const [assetSearchResult, setAssetSearchResult] = useState(null);
    const [isAssetModalOpen, setIsAssetModalOpen] = useState(false);
    const [isInventorySelectorOpen, setIsInventorySelectorOpen] = useState(false);
    const [inventorySearchQuery, setInventorySearchQuery] = useState('');
    const [newAsset, setNewAsset] = useState({ model: '', type: 'Laptop', serial: '', status: 'Nuevo' });
    const [verifyDeliveryModal, setVerifyDeliveryModal] = useState({ isOpen: false, serial: null });

    // Smart Replacement state
    const [replacementSerial, setReplacementSerial] = useState('');
    const [smartRecommendations, setSmartRecommendations] = useState([]);
    const [assetToReplace, setAssetToReplace] = useState(null);
    const [isSmartSearchOpen, setIsSmartSearchOpen] = useState(false);
    const [smartFilters, setSmartFilters] = useState({ eng: false, size: 'All' });

    // Sincronizar editedData con el ticket del store cuando cambia externamente
    useEffect(() => {
        if (!ticket) return;

        // Si editedData está vacío, o hay una sincronización pendiente (nuevos casos asociados en el store),
        // o el ticketID cambió, procedemos a actualizar/sincronizar.
        const storeCases = ticket.associatedCases || [];
        const localCases = (editedData && editedData.associatedCases) || [];
        const storeChat = ticket.chatLog || [];
        const localChat = (editedData && editedData.chatLog) || [];
        
        const needsInitialSync = !editedData || Object.keys(editedData).length === 0 || editedData.id !== ticket.id;
        const needsBackgroundSync = storeCases.length > localCases.length;
        const needsChatSync = storeChat.length !== localChat.length || ticket.instructionsUpdatedBy !== editedData?.instructionsUpdatedBy || ticket.instructions !== editedData?.instructions;

        // Solo bloqueamos la sincronización si el usuario está editando activamente campos de texto 
        // (editMode o editContact). El simple hecho de tener un caso seleccionado para ver 
        // (selectedCaseIndex !== null) no debería bloquear la carga inicial de los casos.
        const isActivelyEditing = editMode || editContact || editLogistics || editAssets || editAccessories || editSchedule;
        
        // CRITICAL: If we have real DB tasks (New Architecture), we should NOT overwrite 
        // the UI cases with the legacy 'associatedCases' column from the ticket,
        // as this causes the "disappearing assets" bug during the background sync.
        const hasRealTasks = ticketTasks && ticketTasks.length > 0;

        if (needsInitialSync || ((needsBackgroundSync || needsChatSync) && !isActivelyEditing)) {
            console.log("Synchronizing editedData with store ticket:", ticket.id);
            
            let normalizedCases = hasRealTasks ? (editedData.associatedCases || []) : [...storeCases];
            
            if (!hasRealTasks && normalizedCases.length === 0) {
                const oldAssets = ticket.associatedAssets || (ticket.associatedAssetSerial ? [{ serial: ticket.associatedAssetSerial, type: ticket.logistics?.type || 'Entrega' }] : []);
                normalizedCases = [{
                    caseNumber: 'Caso Principal',
                    subject: ticket.subject || 'Gestion de Servicio',
                    assets: oldAssets.map(item => typeof item === 'string' ? { serial: item, type: ticket.logistics?.type || 'Entrega' } : item),
                    accessories: ticket.accessories || { backpack: false, screenFilter: false, filterSize: '14"' },
                    logistics: {
                        method: ticket.logistics?.method || '',
                        date: ticket.logistics?.date || ticket.logistics?.datetime?.split('T')[0] || '',
                        timeSlot: ticket.logistics?.timeSlot || 'AM',
                        status: ticket.deliveryStatus || 'Pendiente',
                        deliveryInfo: ticket.logistics?.deliveryInfo || null,
                        lastUpdated: ticket.logistics?.lastUpdated || new Date().toISOString()
                    }
                }];
            } else if (!hasRealTasks) {
                normalizedCases = normalizedCases.map(c => ({
                    ...c,
                    assets: c.assets || [],
                    accessories: c.accessories || { backpack: false, screenFilter: false, filterSize: '14"' },
                    // Unificación total a snake_case
                    status: c.status || c.logistics?.status || 'Pendiente',
                    method: c.method || c.logistics?.method || '',
                    delivery_person: c.delivery_person || c.deliveryPerson || c.logistics?.deliveryPerson || c.logistics?.delivery_person || '',
                    assigned_to: c.assigned_to || c.assignedTo || c.logistics?.assigned_to || c.logistics?.assignedTo || '',
                    date: c.date || c.logistics?.date || '',
                    time_slot: c.time_slot || c.timeSlot || c.logistics?.timeSlot || 'AM',
                    coordinated_by: c.coordinated_by || c.coordinatedBy || c.logistics?.coordinatedBy || '',
                    tracking_number: c.tracking_number || c.trackingNumber || c.logistics?.trackingNumber || c.logistics?.tracking_number || '',
                    logistics: c.logistics || { status: 'Pendiente' } // Mantener logistics solo para retrocompatibilidad profunda si es necesario
                }));
            }

            setEditedData(prev => ({
                ...prev,
                ...ticket,
                associatedCases: normalizedCases,
                internalNotes: ticket.internalNotes || [],
                chatLog: ticket.chatLog || [],
                instructionsUpdatedBy: ticket.instructionsUpdatedBy
            }));
        }
    }, [ticket, editMode, editContact, editLogistics, editAssets, editAccessories, editSchedule, ticketTasks]);

    // Automatización: Vincular casos hermanos automáticamente al cargar o actualizar sfdcCases
    useEffect(() => {
        // Solo ejecutamos la vinculación automática si tenemos el ticket base y casos SFDC cargados
        if (!ticket || !sfdcCases || sfdcCases.length === 0) return;

        // Evitar bucle infinito y vinculación repetida en la misma sesión
        if (autoLinkedRef.current[ticket.id]) return;

        const normalize = (val) => (val || '').normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
        const requesterName = normalize(ticket.requester);
        
        // Sincronización robusta dse duplicados: revisar tanto el campo legacy como la tabla real de base de datos
        const linkedLegacy = (ticket.associatedCases || []).map(c => c.caseNumber).filter(Boolean);
        const linkedReal = (ticketTasks || []).map(c => c.caseNumber).filter(Boolean);
        // Casos excluidos manualmente por el usuario (borrados desde la UI)
        const excludedCases = (ticket.excludedCases || []);
        const allLinked = [...new Set([...linkedLegacy, ...linkedReal, ...excludedCases])];
        
        // También incluimos el número de caso principal si está en el subject para no re-vincularlo a sí mismo
        const mainCaseMatch = (ticket.subject || '').match(/SFDC-(\d+)/);
        if (mainCaseMatch) allLinked.push(mainCaseMatch[1]);

        const siblings = sfdcCases.filter(sc => {
            const rf = normalize(sc.requestedFor);
            return rf === requesterName && !allLinked.includes(sc.caseNumber);
        });

        if (siblings.length > 0) {
            console.log(`Auto-linking ${siblings.length} sibling cases for ${ticket.requester}`);
            
            // Registrar que ya se procedió a la vinculación de este ticket para no repetirlo
            autoLinkedRef.current[ticket.id] = true;

            const newAssociatedCases = siblings.map(sc => ({
                caseNumber: sc.caseNumber,
                subject: sc.subject,
                assets: [],
                accessories: { backpack: false, screenFilter: false, filterSize: '14"' },
                logistics: { method: '', date: '', timeSlot: 'AM', status: 'Pendiente' }
            }));

            const updatedTicketData = {
                ...ticket,
                associatedCases: [...(ticket.associatedCases || []), ...newAssociatedCases]
            };

            // Notar que NO llamamos a setEditedData aquí directamente para no interrumpir al usuario.
            // El primer useEffect sincronizará editedData si el usuario NO está editando.
            updateTicket(ticket.id, updatedTicketData);
        }
    }, [ticket?.id, ticket?.requester, sfdcCases]); // Dependencias estables

    const provisioningSuggestions = useMemo(() => {
        if (!ticket || !ticket.subject) return [];
        const subject = (ticket.subject || "").toLowerCase();
        let targetStatuses = ['Nuevo', 'Disponible', 'Recuperado'];
        if (subject.includes('provisioning') || subject.includes('nuevo ingreso') || subject.includes('new hire')) {
            targetStatuses = ['Nuevo', 'Disponible'];
        } else if (subject.includes('replacement') || subject.includes('reemplazo') || subject.includes('break') || subject.includes('fix') || subject.includes('rotura')) {
            targetStatuses = ['Disponible', 'Recuperado'];
        }

        const isWindows = subject.includes('windows') || subject.includes('dell') || subject.includes('hp');
        const isStandard = subject.includes('standard');
        const isDeveloper = subject.includes('development') || subject.includes('developer') || subject.includes('max') || subject.includes('pro max');

        const ticketCountry = ticket?.logistics?.country;

        return assets.filter(asset => {
            if (ticketCountry && asset.country !== ticketCountry) return false;
            if (asset.assignee !== 'Almacén') return false;
            if (!targetStatuses.includes(asset.status)) return false;
            if (isWindows) {
                const isDell = (asset.limitations || asset.name || "").toLowerCase().includes('dell');
                const isHP = (asset.limitations || asset.name || "").toLowerCase().includes('hp');
                if (!isDell && !isHP) return false;
            } else {
                if (asset.type !== 'Laptop') return false;
                if ((asset.name || "").toLowerCase().includes('dell') || (asset.name || "").toLowerCase().includes('hp')) return false;
            }
            if (!isWindows) {
                const ramMatch = (asset.hardwareSpec || asset.name || "").match(/(\d+)\s*gb/i);
                const ramValue = ramMatch ? parseInt(ramMatch[1]) : 0;
                if (isStandard && ramValue >= 64) return false;
                else if (isDeveloper && ramValue < 64) return false;
            }
            return true;
        })
        .sort((a, b) => {
            const statusOrder = { 'Nuevo': 1, 'Disponible': 2, 'Recuperado': 3 };
            const scoreA = statusOrder[a.status] || 99;
            const scoreB = statusOrder[b.status] || 99;
            if (scoreA !== scoreB) return scoreA - scoreB;
            if (isWindows) {
                const aIsDell = (a.name || "").toLowerCase().includes('dell');
                const bIsDell = (b.name || "").toLowerCase().includes('dell');
                if (aIsDell && !bIsDell) return -1;
                if (!aIsDell && bIsDell) return 1;
            }
            return 0;
        })
        .slice(0, 4);
    }, [ticket, assets]);

    const validateAddress = () => {
        if (!isLoaded) return;
        const address = editedData.logistics?.address;
        if (!address) return;

        setAddressStatus('validating');
        const geocoder = new window.google.maps.Geocoder();
        geocoder.geocode({ address: address }, (results, status) => {
            if (status === 'OK' && results && results[0]) {
                setAddressStatus('valid');
                setEditedData(prev => ({
                    ...prev,
                    logistics: { ...(prev.logistics || {}), address: results[0].formatted_address }
                }));
            } else {
                setAddressStatus('invalid');
            }
        });
    };

    const handleUpdate = async () => {
        const errSpan = document.getElementById('save-error-msg');
        try {
            let statusUpdate = editedData.status;
            if (editedData.status === 'Abierto' || editedData.status === 'Pendiente') {
                statusUpdate = 'En Progreso';
            }
            const dataToUpdate = { ...editedData, status: statusUpdate };
            
            if (errSpan) errSpan.textContent = "2.1 Preparando actualización...";
            console.log("handleUpdate calling updateTicket with:", dataToUpdate);
            const success = await updateTicket(ticket.id, dataToUpdate);
            
            if (errSpan) errSpan.textContent = "2.2 Actualización respondida.";
            if (success !== false) { // updateTicket returns false on error
                setEditedData(dataToUpdate);
                setEditMode(false);
                return { success: true };
            }
            return { success: false, error: "El servidor rechazó la actualización o la sesión expiró." };
        } catch (error) {
            console.error("Error in handleUpdate:", error);
            return { success: false, error: error.message || String(error) };
        }
    };

    const handleDelete = () => {
        if (confirm('¿Estás seguro de que deseas eliminar este ticket? Esta acción no se puede deshacer.')) {
            deleteTicket(ticket.id);
            router.push('/dashboard/tickets');
        }
    };

    const handleAssetSearch = () => {
        if (!serialQuery.trim()) return;
        
        // Get ticket region from logistics
        const ticketCountry = ticket?.logistics?.country;
        const normalizedQuery = serialQuery.trim().toLowerCase();
        
        // Lenovo Fix: permitimos buscar por el serial sin la 'S' inicial si se escanea la caja
        const queryWithoutS = (normalizedQuery.startsWith('s') && normalizedQuery.length > 7) 
            ? normalizedQuery.substring(1) 
            : normalizedQuery;

        // Search for the asset in the specific region
        const found = assets.find(a => {
            const assetSerialLower = a.serial.toLowerCase();
            return (assetSerialLower === normalizedQuery || assetSerialLower === queryWithoutS) && 
                   (!ticketCountry || a.country === ticketCountry);
        });

        if (found) {
            setAssetSearchResult({ 
                name: found.name, 
                type: found.type, 
                status: found.status, 
                serial: found.serial,
                region: found.country
            });
        } else {
            // Check if it exists in another region for better UX feedback
            const inOtherRegion = assets.find(a => {
                const assetSerialLower = a.serial.toLowerCase();
                return assetSerialLower === normalizedQuery || assetSerialLower === queryWithoutS;
            });
            if (inOtherRegion) {
                setAssetSearchResult({
                    status: 'wrong_region',
                    region: inOtherRegion.country,
                    serial: inOtherRegion.serial
                });
            } else {
                setAssetSearchResult('not_found');
            }
        }
    };

    const automateDeliveryStatus = (updatedData) => {
        const currentDeliveryStatus = updatedData.deliveryStatus;
        if (
            (!currentDeliveryStatus || currentDeliveryStatus === 'Pendiente') &&
            (updatedData.associatedAssets && updatedData.associatedAssets.length > 0)
        ) {
            return { ...updatedData, deliveryStatus: 'Para Coordinar' };
        }
        return updatedData;
    };

    const handleReplaceAsset = (newAsset) => {
        if (!assetToReplace) return;
        handleUnlinkAsset(assetToReplace.serial);
        const currentAssets = editedData.associatedAssets || [];
        const serialToLink = newAsset.serial;

        setEditedData(prev => {
            const newData = {
                ...prev,
                associatedAssets: [...prev.associatedAssets.filter(a => (typeof a === 'string' ? a : a.serial) !== assetToReplace.serial), { serial: serialToLink, type: '' }]
            };
            const automatedData = automateDeliveryStatus(newData);
            updateTicket(ticket.id, automatedData);
            return automatedData;
        });

        const requesterName = editedData.requester || ticket.requester;
        updateAsset(newAsset.id, {
            status: 'Asignado',
            assignee: requesterName,
            notes: (newAsset.notes ? newAsset.notes + '\n' : '') +
                `[${new Date().toLocaleDateString()}] Reemplazo Smart del equipo ${assetToReplace.serial} vía Ticket #${ticket.id} (${requesterName})`
        });

        alert(`Equipo reemplazado con éxito. Se ha vinculado el serial ${serialToLink}.`);
        setIsSmartSearchOpen(false);
        setReplacementSerial('');
        setSmartRecommendations([]);
        setAssetToReplace(null);
    };

    const handleLinkAsset = () => {
        if (assetSearchResult && assetSearchResult !== 'not_found' && assetSearchResult.status !== 'wrong_region') {
            const currentAssets = editedData.associatedAssets || [];
            const serialToLink = assetSearchResult.serial;
            const isAlreadyLinked = currentAssets.some(item => (typeof item === 'string' ? item : item.serial) === serialToLink);

            if (!isAlreadyLinked) {
                const newData = {
                    ...editedData,
                    associatedAssets: [...currentAssets, { serial: serialToLink, type: '' }]
                };
                const automatedData = automateDeliveryStatus(newData);
                updateTicket(ticket.id, automatedData);
                setEditedData(automatedData);
                const fullAsset = assets.find(a => a.serial.toLowerCase() === serialToLink.toLowerCase());
                if (fullAsset) {
                    const requesterName = editedData.requester || ticket.requester;
                    updateAsset(fullAsset.id, {
                        status: 'Asignado',
                        assignee: requesterName,
                        notes: (fullAsset.notes ? fullAsset.notes + '\n' : '') +
                            `[${new Date().toLocaleDateString()}] Auto-asignado vía Ticket #${ticket.id} (${requesterName})`
                    });
                }
            }
            setAssetSearchResult(null);
            setSerialQuery('');
        }
    };

    const handleUnlinkAsset = (serial) => {
        setEditedData(prev => {
            const newData = {
                ...prev,
                associatedAssets: (prev.associatedAssets || []).filter(item => (typeof item === 'string' ? item : item.serial) !== serial)
            };
            updateTicket(ticket.id, newData);
            return newData;
        });

        const fullAsset = assets.find(a => a.serial.toLowerCase() === serial.toLowerCase());
        if (fullAsset) {
            updateAsset(fullAsset.id, {
                status: 'Disponible',
                assignee: 'Almacén',
                notes: (fullAsset.notes ? fullAsset.notes + '\n' : '') +
                    `[${new Date().toLocaleDateString()}] Desvinculado de Ticket #${ticket.id}. Vuelve a Almacén.`
            });
        }
    };

    const handleCreateAsset = (e) => {
        e.preventDefault();
        
        // Determinar el país/cliente del caso actual de forma robusta
        const currentTask = (selectedCaseIndex !== null && unifiedTasks) ? unifiedTasks[selectedCaseIndex] : null;
        const taskCountry = currentTask?.country || ticket?.client || ticket?.logistics?.country || 'Argentina';

        // Lenovo Fix: al escanear la caja el serial viene con una 'S' extra
        const trimmedSerial = serialQuery.trim();
        const cleanedSerial = (trimmedSerial.toUpperCase().startsWith('S') && trimmedSerial.length > 7)
            ? trimmedSerial.substring(1)
            : trimmedSerial;

        const createdAsset = {
            ...newAsset,
            name: newAsset.model,
            serial: cleanedSerial,
            status: 'Asignado',
            assignee: editedData.requester || ticket.requester,
            country: taskCountry,
            sfdcCase: ticket.id
        };
        
        // 1. Guardar en el inventario global de base de datos
        addAsset(createdAsset);

        // 2. Vincular directamente al caso/tarea seleccionada si existe
        if (currentTask) {
            const currentTaskAssets = currentTask.assets || [];
            handleUpdateTask({
                assets: [...currentTaskAssets, { serial: cleanedSerial, type: 'Entrega', hardware_type: newAsset.type }]
            });
        }

        // 3. Mantener retrocompatibilidad con la lista general del ticket
        const currentAssets = editedData.associatedAssets || [];
        const newData = {
            ...editedData,
            associatedAssets: [...currentAssets, { serial: cleanedSerial, type: '' }]
        };
        const automatedData = automateDeliveryStatus(newData);
        updateTicket(ticket.id, automatedData);
        setEditedData(automatedData);
        
        setIsAssetModalOpen(false);
        setAssetSearchResult(null);
        setSerialQuery('');
    };

    const toggleAccessory = (type) => {
        const isCurrentlyActive = editedData.accessories?.[type] || false;
        const consumableMap = { backpack: 'backpack-id-placeholder', screenFilter: 'filter-id-placeholder' };
        const consumableId = consumableMap[type];
        if (consumableId) {
            updateConsumableStock(consumableId, isCurrentlyActive ? 1 : -1);
        }
        setEditedData({
            ...editedData,
            accessories: { ...editedData.accessories, [type]: !isCurrentlyActive }
        });
    };

    const handleUpdateTask = async (partialData) => {
        const currentTask = (selectedCaseIndex !== null && unifiedTasks) ? unifiedTasks[selectedCaseIndex] : null;
        if (!currentTask) return { error: { message: "No task selected" } };
        
        console.log("handleUpdateTask called with:", partialData, "for task:", currentTask.id || currentTask.caseNumber);

        try {
            if (currentTask.id) {
                // Nueva arquitectura: actualización directa en DB
                if (ticket.status === 'Abierto' || ticket.status === 'Pendiente') {
                    await updateTicket(ticket.id, { status: 'En Progreso' });
                }
                return await updateLogisticsTask(currentTask.id, partialData);
            } else {
                // Legacy
                if (ticket.status === 'Abierto' || ticket.status === 'Pendiente') {
                    await updateTicket(ticket.id, { status: 'En Progreso' });
                }

                const updatedCases = editedData.associatedCases.map((c, idx) => {
                    if (idx === selectedCaseIndex) {
                        const newLogistics = { ...(c.logistics || {}) };
                        const updatedCase = { ...c, ...partialData };

                        Object.keys(partialData).forEach(key => {
                            newLogistics[key] = partialData[key];
                        });

                        return { ...updatedCase, logistics: newLogistics };
                    }
                    return c;
                });
                
                setEditedData(prev => ({ ...prev, associatedCases: updatedCases }));
                const success = await updateTicket(ticket.id, { associatedCases: updatedCases });
                return success ? { data: true } : { error: { message: "Error al actualizar ticket" } };
            }
        } catch (err) {
            console.error("handleUpdateTask exception:", err);
            return { error: err };
        }
    };

    const handleUpdate = async () => {
        try {
            await updateTicket(ticket.id, editedData);
            setEditMode(false);
            setEditContact(false);
            setEditSchedule(false);
        } catch (error) {
            console.error('Error actualizando ticket:', error);
            alert('Hubo un error al actualizar el ticket');
        }
    };

    const handleUnlinkCase = async (caseToUnlink) => {
        if (!confirm(`¿Estás seguro de que deseas desvincular el caso ${caseToUnlink.caseNumber} y convertirlo en un servicio independiente?`)) {
            return;
        }

        try {
            const newTicketData = {
                subject: `[SFDC-${caseToUnlink.caseNumber}] ${caseToUnlink.subject}`,
                requester: ticket.requester,
                priority: caseToUnlink.priority === 'High' ? 'Alta' : 'Media',
                status: 'Abierto',
                client: ticket.client,
                internalNotes: [`=== DESVINCULADO ===\nEste caso fue desvinculado del servicio original ${ticket.id} el ${new Date().toLocaleString()}`],
                logistics: { ...ticket.logistics, address: caseToUnlink.logistics?.address || ticket.logistics?.address || '' },
                associatedCases: [{
                    caseNumber: caseToUnlink.caseNumber,
                    subject: caseToUnlink.subject,
                    status: caseToUnlink.status,
                    priority: caseToUnlink.priority,
                    dateOpened: caseToUnlink.dateOpened,
                    logistics: { ...caseToUnlink.logistics }
                }]
            };

            await addTicket(newTicketData);

            let newAssociatedCases = ticket.associatedCases.filter(ac => ac.caseNumber !== caseToUnlink.caseNumber);
            let newSubject = ticket.subject;
            
            if (newAssociatedCases.length <= 1) {
                newSubject = newSubject.replace(/\s*\(\+\s*\d+\s*casos agrupados\)/i, '');
            } else {
                newSubject = newSubject.replace(/\(\+\s*\d+\s*casos agrupados\)/i, `(+ ${newAssociatedCases.length - 1} casos agrupados)`);
            }

            await updateTicket(ticket.id, {
                associatedCases: newAssociatedCases,
                subject: newSubject,
                internalNotes: [...(ticket.internalNotes || []), `=== CASO DESVINCULADO ===\nEl caso ${caseToUnlink.caseNumber} fue extraído a un nuevo servicio independiente el ${new Date().toLocaleString()}`]
            });

            alert('Caso desvinculado exitosamente.');
        } catch (error) {
            console.error('Error desvinculando caso:', error);
            alert('Error al desvincular el caso: ' + error.message);
        }
    };

    return {
        ticket, editedData, setEditedData,
        editMode, setEditMode,
        editLogistics, setEditLogistics,
        editAssets, setEditAssets,
        editAccessories, setEditAccessories,
        editSchedule, setEditSchedule,
        editContact, setEditContact,
        newNote, setNewNote,
        addressStatus, setAddressStatus,
        selectedCaseIndex, setSelectedCaseIndex,
        isLoaded,
        serialQuery, setSerialQuery,
        assetSearchResult, setAssetSearchResult,
        isAssetModalOpen, setIsAssetModalOpen,
        isInventorySelectorOpen, setIsInventorySelectorOpen,
        inventorySearchQuery, setInventorySearchQuery,
        newAsset, setNewAsset,
        verifyDeliveryModal, setVerifyDeliveryModal,
        handleUnlinkCase,
        smartRecommendations, setSmartRecommendations,
        assetToReplace, setAssetToReplace,
        isSmartSearchOpen, setIsSmartSearchOpen,
        smartFilters, setSmartFilters,
        provisioningSuggestions,
        validateAddress,
        handleUpdate,
        handleDelete,
        handleAssetSearch,
        handleReplaceAsset,
        handleLinkAsset,
        handleUnlinkAsset,
        handleCreateAsset,
        handleUpdateTask,
        toggleAccessory,
        updateTicket,
        assets,
        consumables,
        yubikeys,
        users,
        currentUser,
        sfdcCases,
        logisticsTasks,
        ticketTasks,
        unifiedTasks,
        showAutoCases,
        setShowAutoCases,
        addLogisticsTask,
        updateLogisticsTask,
        deleteLogisticsTask,
        updateAsset,
        updateConsumableStock
    };
}
