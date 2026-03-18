'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useStore } from '@/lib/store';
import { useJsApiLoader } from '@react-google-maps/api';

const libraries = ['geometry'];

export function useTicketDetail() {
    const params = useParams();
    const router = useRouter();
    const { 
        tickets, assets, consumables, users, sfdcCases, yubikeys, 
        updateTicket, deleteTicket, addAsset, updateAsset, 
        updateConsumableStock, currentUser 
    } = useStore();

    const [ticket, setTicket] = useState(null);
    const [editMode, setEditMode] = useState(false);
    const [editLogistics, setEditLogistics] = useState(false);
    const [editAssets, setEditAssets] = useState(false);
    const [editAccessories, setEditAccessories] = useState(false);
    const [editSchedule, setEditSchedule] = useState(false);
    const [editContact, setEditContact] = useState(false);
    const [editedData, setEditedData] = useState({});
    const [newNote, setNewNote] = useState('');
    const [addressStatus, setAddressStatus] = useState('idle');
    const [selectedCaseIndex, setSelectedCaseIndex] = useState(null);

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

    useEffect(() => {
        const foundTicket = tickets.find(t => t.id === params.id);
        if (foundTicket) {
            setTicket(foundTicket);

            // Solo inicializar editedData si es la primera vez o si NO estamos editando activamente.
            // Esto evita que actualizaciones de fondo (como la vinculación automática) 
            // pisen los cambios que el usuario está escribiendo en los inputs.
            const isUserEditing = editMode || editContact || selectedCaseIndex !== null;
            
            if (!isUserEditing || Object.keys(editedData).length === 0) {
                let normalizedCases = foundTicket.associatedCases || [];
                if (normalizedCases.length === 0) {
                    const oldAssets = foundTicket.associatedAssets || (foundTicket.associatedAssetSerial ? [{ serial: foundTicket.associatedAssetSerial, type: foundTicket.logistics?.type || 'Entrega' }] : []);
                    normalizedCases = [{
                        caseNumber: foundTicket.logistics?.additionalCase || foundTicket.id.split('-').pop(),
                        subject: foundTicket.subject || 'Gestion de Servicio',
                        assets: oldAssets.map(item => typeof item === 'string' ? { serial: item, type: foundTicket.logistics?.type || 'Entrega' } : item),
                        accessories: foundTicket.accessories || { backpack: false, screenFilter: false, filterSize: '14"' },
                        logistics: {
                            method: foundTicket.logistics?.method || '',
                            deliveryDate: foundTicket.logistics?.date || foundTicket.logistics?.datetime?.split('T')[0] || '',
                            timeWindow: foundTicket.logistics?.timeSlot || 'AM',
                            status: foundTicket.deliveryStatus || 'Pendiente'
                        }
                    }];
                } else {
                    normalizedCases = normalizedCases.map(c => ({
                        ...c,
                        assets: c.assets || [],
                        accessories: c.accessories || { backpack: false, screenFilter: false, filterSize: '14"' },
                        logistics: c.logistics || { method: '', deliveryDate: '', timeWindow: 'AM', status: 'Pendiente' }
                    }));
                }

                setEditedData({
                    ...foundTicket,
                    associatedCases: normalizedCases,
                    internalNotes: foundTicket.internalNotes || []
                });
            }
        }
    }, [params.id, tickets]); // Solo depende del ID o cambios externos en el store

    // Automatización: Vincular casos hermanos automáticamente al cargar o actualizar sfdcCases
    useEffect(() => {
        // Solo ejecutamos la vinculación automática si tenemos el ticket base y casos SFDC cargados
        if (!ticket || !sfdcCases || sfdcCases.length === 0) return;

        const normalize = (val) => (val || '').normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
        const requesterName = normalize(ticket.requester);
        
        // Usamos el ticket original del store para ver qué está ya vinculado, 
        // evitando depender de editedData que causaría bucle infinito
        const linkedCaseNumbers = (ticket.associatedCases || []).map(c => c.caseNumber).filter(Boolean);
        
        const siblings = sfdcCases.filter(sc => {
            const rf = normalize(sc.requestedFor);
            return rf === requesterName && !linkedCaseNumbers.includes(sc.caseNumber);
        });

        if (siblings.length > 0) {
            console.log(`Auto-linking ${siblings.length} sibling cases for ${ticket.requester}`);
            
            const newAssociatedCases = siblings.map(sc => ({
                caseNumber: sc.caseNumber,
                subject: sc.subject,
                assets: [],
                accessories: { backpack: false, screenFilter: false, filterSize: '14"' },
                logistics: { method: '', deliveryDate: '', timeWindow: 'AM', status: 'Pendiente' }
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

        return assets.filter(asset => {
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

    const handleUpdate = () => {
        let statusUpdate = editedData.status;
        if (editedData.status === 'Abierto' || editedData.status === 'Pendiente') {
            statusUpdate = 'En Progreso';
        }
        const dataToUpdate = { ...editedData, status: statusUpdate };
        updateTicket(ticket.id, dataToUpdate);
        setEditedData(dataToUpdate);
        setEditMode(false);
    };

    const handleDelete = () => {
        if (confirm('¿Estás seguro de que deseas eliminar este ticket? Esta acción no se puede deshacer.')) {
            deleteTicket(ticket.id);
            router.push('/dashboard/tickets');
        }
    };

    const handleAssetSearch = () => {
        if (!serialQuery.trim()) return;
        const found = assets.find(a => a.serial.toLowerCase() === serialQuery.toLowerCase());
        if (found) {
            setAssetSearchResult({ name: found.name, type: found.type, status: found.status, serial: found.serial });
        } else {
            setAssetSearchResult('not_found');
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
        if (assetSearchResult && assetSearchResult !== 'not_found') {
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
        const createdAsset = {
            ...newAsset,
            name: newAsset.model,
            serial: serialQuery,
            status: 'Asignado',
            assignee: editedData.requester || ticket.requester
        };
        addAsset(createdAsset);
        const currentAssets = editedData.associatedAssets || [];
        const newData = {
            ...editedData,
            associatedAssets: [...currentAssets, { serial: serialQuery, type: '' }]
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
        toggleAccessory,
        updateTicket,
        assets,
        yubikeys,
        users,
        currentUser,
        sfdcCases
    };
}
