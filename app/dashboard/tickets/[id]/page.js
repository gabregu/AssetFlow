"use client";
import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useStore } from '../../../../lib/store';
import { Card } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';
import { Badge } from '../../../components/ui/Badge';
import {
    ArrowLeft,
    Calendar,
    User,
    Tag,
    MessageSquare,
    Clock,
    CheckCircle,
    CheckCircle2,
    AlertCircle,
    Save,
    Trash2,
    Truck,
    Smartphone,
    Search,
    PlusCircle,
    MapPin,
    Phone,
    Mail,
    Monitor,
    Package,
    FileText,
    Key,
    Laptop,
    Slack,
    Check,
    DollarSign,
    Hash,
    QrCode,
    X,
    Loader2
} from 'lucide-react';
import { Modal } from '../../../components/ui/Modal';
import { generateTicketPDF, generateLabelPDF } from '../../../../lib/pdf-generator';
import { useJsApiLoader } from '@react-google-maps/api';

const libraries = ['geometry'];

export default function TicketDetailPage() {
    const params = useParams();
    const router = useRouter();
    const { tickets, assets, consumables, users, sfdcCases, yubikeys, updateTicket, deleteTicket, addAsset, updateAsset, updateConsumableStock, currentUser } = useStore();

    const [ticket, setTicket] = useState(null);
    const [editMode, setEditMode] = useState(false);
    const [editLogistics, setEditLogistics] = useState(false);
    const [editAssets, setEditAssets] = useState(false);
    const [editAccessories, setEditAccessories] = useState(false);
    const [editSchedule, setEditSchedule] = useState(false);
    const [editContact, setEditContact] = useState(false);
    const [editedData, setEditedData] = useState({});
    const [newNote, setNewNote] = useState('');
    const [addressStatus, setAddressStatus] = useState('idle'); // idle, validating, valid, invalid
    const [selectedCaseIndex, setSelectedCaseIndex] = useState(null); // Index of the case being configured


    const { isLoaded } = useJsApiLoader({
        id: 'google-map-script',
        googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY,
        libraries
    });

    const validateAddress = () => {
        if (!isLoaded) return;
        const address = editedData.logistics?.address;
        if (!address) return;

        setAddressStatus('validating');
        const geocoder = new window.google.maps.Geocoder();
        geocoder.geocode({ address: address }, (results, status) => {
            if (status === 'OK' && results && results[0]) {
                setAddressStatus('valid');
                // Auto-update with formatted address silently as per request for "just validate"
                setEditedData(prev => ({
                    ...prev,
                    logistics: { ...(prev.logistics || {}), address: results[0].formatted_address }
                }));
            } else {
                setAddressStatus('invalid');
                console.error('Geocoding failed:', status);
            }
        });
    };

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

    // Provisioning Recommendation Logic - Updated with User Rules
    const provisioningSuggestions = React.useMemo(() => {
        if (!ticket || !ticket.subject) return [];

        const subject = (ticket.subject || "").toLowerCase();

        // 1. Identify Intent (Status Rule)
        // If "Provisioning" (New employee) -> Suggest NEW
        // If "Replacement" or "Break/Fix" -> Suggest USED (Disponible/Recuperado)
        let targetStatuses = ['Nuevo', 'Disponible', 'Recuperado']; // Default fallback
        if (subject.includes('provisioning') || subject.includes('nuevo ingreso') || subject.includes('new hire')) {
            // Expanded to include 'Disponible' in case 'Nuevo' stock is empty or mislabeled
            targetStatuses = ['Nuevo', 'Disponible'];
        } else if (subject.includes('replacement') || subject.includes('reemplazo') || subject.includes('break') || subject.includes('fix') || subject.includes('rotura')) {
            targetStatuses = ['Disponible', 'Recuperado'];
        }

        // 2. Identify OS/Brand
        const isWindows = subject.includes('windows') || subject.includes('dell') || subject.includes('hp');
        const isMac = subject.includes('mac') || subject.includes('apple') || subject.includes('macbook');

        // 3. Identify Profile (Ram/Power)
        // Standard: < 64GB
        // Development/Max: >= 64GB or "Max" model
        const isStandard = subject.includes('standard');
        const isDeveloper = subject.includes('development') || subject.includes('developer') || subject.includes('max') || subject.includes('pro max');

        return assets.filter(asset => {
            // Basic Availability Check
            if (asset.assignee !== 'Almacén') return false;
            if (!targetStatuses.includes(asset.status)) return false;

            // Brand/OS Match
            if (isWindows) {
                // Priority 1: Dell, Priority 2: HP
                // We filter for both here, sorting will handle priority
                const isDell = (asset.limitations || asset.name || "").toLowerCase().includes('dell');
                const isHP = (asset.limitations || asset.name || "").toLowerCase().includes('hp');
                if (!isDell && !isHP) return false;
            } else {
                // Default to Mac/Apple if not explicitly Windows, or if Mac is specified
                if (asset.type !== 'Laptop') return false;
                // Exclude Dell/HP if looking for Mac
                if ((asset.name || "").toLowerCase().includes('dell') || (asset.name || "").toLowerCase().includes('hp')) return false;
            }

            // Profile Match (Mainly for Mac)
            if (!isWindows) { // Apply specific RAM rules mainly for Macs as per request
                const ramMatch = (asset.hardwareSpec || asset.name || "").match(/(\d+)\s*gb/i);
                const ramValue = ramMatch ? parseInt(ramMatch[1]) : 0;

                if (isStandard) {
                    // Rule: < 64GB
                    if (ramValue >= 64) return false;
                } else if (isDeveloper) {
                    // Rule: >= 64GB
                    if (ramValue < 64) return false;
                }
            }

            return true;
        })
            .sort((a, b) => {
                // Sorting Logic

                // 0. Status Priority: Nuevo > Disponible > Recuperado
                const statusOrder = { 'Nuevo': 1, 'Disponible': 2, 'Recuperado': 3 };
                const scoreA = statusOrder[a.status] || 99;
                const scoreB = statusOrder[b.status] || 99;
                if (scoreA !== scoreB) return scoreA - scoreB;

                // 1. Windows Priority: Dell > HP
                if (isWindows) {
                    const aIsDell = (a.name || "").toLowerCase().includes('dell');
                    const bIsDell = (b.name || "").toLowerCase().includes('dell');
                    if (aIsDell && !bIsDell) return -1;
                    if (!aIsDell && bIsDell) return 1;
                }

                return 0;
            })
            .slice(0, 4); // Top 4 recommendations
    }, [ticket, assets]);

    useEffect(() => {
        const foundTicket = tickets.find(t => t.id === params.id);
        if (foundTicket) {
            setTicket(foundTicket);

            // Normalizar associatedCases para el nuevo paradigma Case-Centric
            let normalizedCases = foundTicket.associatedCases || [];
            
            // Si no hay casos asociados (tickte manual o viejo), creamos un "Caso Virtual" con la data global anterior
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
                // Asegurarnos que cada caso existente tenga su estructura interna inicializada
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
    }, [params.id, tickets]);

    if (!ticket) {
        return (
            <div style={{ padding: '2rem', textAlign: 'center' }}>
                <p style={{ color: 'var(--text-secondary)' }}>Cargando ticket...</p>
            </div>
        );
    }

    const handleUpdate = () => {
        // Automatización: Si el ticket estaba Abierto o Pendiente, pasarlo a En Progreso al editar cualquier dato
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

    const getStatusVariant = (status) => {
        switch (status) {
            case 'Abierto': return 'danger-soft';
            case 'En Progreso': return 'info';
            case 'Resuelto': return 'success';
            case 'Pendiente': return 'warning';
            case 'Caso SFDC Cerrado': return 'success';
            case 'Servicio Facturado': return 'info';
            default: return 'default';
        }
    };

    const getTypeIcon = (type) => {
        switch (type) {
            case 'Laptop': return Laptop;
            case 'Smartphone': return Smartphone;
            case 'Tablet': return Smartphone;
            case 'Security keys': return Key;
            default: return Laptop;
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

    const handleReplacementSearch = (serial, filters = smartFilters) => {
        const searchSerial = serial !== undefined ? serial : replacementSerial;
        setReplacementSerial(searchSerial);

        if (searchSerial.length < 3) {
            setAssetToReplace(null);
            setSmartRecommendations([]);
            return;
        }

        const target = assets.find(a => a.serial.toLowerCase() === searchSerial.toLowerCase());
        if (target) {
            setAssetToReplace(target);
            // Buscar equipos disponibles que se parezcan
            const available = assets.filter(a =>
                a.serial.toLowerCase() !== searchSerial.toLowerCase() &&
                ['Nuevo', 'Disponible', 'Recuperado'].includes(a.status) &&
                a.assignee === 'Almacén'
            );

            const filteredAvailable = available.filter(a => {
                if (filters.eng) {
                    // Expanded ENG check: ENG, US, USA, ANSI, English
                    const lowerName = (a.name || '').toLowerCase();
                    const lowerSpec = (a.hardwareSpec || '').toLowerCase();
                    const hasEng = lowerName.includes('eng') || lowerName.includes(' us ') || lowerName.includes('usa') || lowerName.includes('ansi') ||
                        lowerSpec.includes('eng') || lowerSpec.includes(' us ') || lowerSpec.includes('usa') || lowerSpec.includes('ansi');
                    if (!hasEng) return false;
                }
                if (filters.size !== 'All') {
                    if (filters.size === 'Otro') {
                        const knownSizes = ['13', '14', '15', '16'];
                        const hasKnownSize = knownSizes.some(s => a.name.includes(s) || (a.hardwareSpec && a.hardwareSpec.includes(s)));
                        if (hasKnownSize) return false;
                    } else {
                        const hasSize = a.name.includes(filters.size) || (a.hardwareSpec && a.hardwareSpec.includes(filters.size));
                        if (!hasSize) return false;
                    }
                }
                return true;
            });

            const scored = filteredAvailable.map(a => {
                let score = 0;
                if (a.type === target.type) score += 40;
                if (a.oem === target.oem) score += 30;
                if (a.hardwareSpec === target.hardwareSpec) score += 20;
                if (a.name === target.name) score += 10;
                return { ...a, score };
            }).filter(a => a.score >= 0).sort((a, b) => b.score - a.score);

            // Deduplicar recomendaciones por modelo
            const uniqueModels = [];
            const result = [];
            for (const item of scored) {
                if (!uniqueModels.includes(item.name)) {
                    uniqueModels.push(item.name);
                    result.push(item);
                }
                if (result.length >= 4) break;
            }

            setSmartRecommendations(result);
        } else {
            setAssetToReplace(null);
            setSmartRecommendations([]);
        }
    };

    // --- AUTOMATION HELPERS ---
    const automateDeliveryStatus = (updatedData) => {
        // Si hay logística activa (logistics object exists)
        // Y el estado del envío es Pendiente o no existe
        // Y ahora tenemos assets vinculados...
        // -> Pasar a 'Para Coordinar'
        const currentDeliveryStatus = updatedData.deliveryStatus;

        if (
            (!currentDeliveryStatus || currentDeliveryStatus === 'Pendiente') &&
            (updatedData.associatedAssets && updatedData.associatedAssets.length > 0)
        ) {
            return {
                ...updatedData,
                deliveryStatus: 'Para Coordinar'
            };
        }
        return updatedData;
    };

    const handleReplaceAsset = (newAsset) => {
        if (!assetToReplace) return;

        // 1. Unlink old asset
        handleUnlinkAsset(assetToReplace.serial);

        // 2. Link new asset
        const currentAssets = editedData.associatedAssets || [];
        const serialToLink = newAsset.serial;

        setEditedData(prev => {
            const newData = {
                ...prev,
                associatedAssets: [...prev.associatedAssets.filter(a => (typeof a === 'string' ? a : a.serial) !== assetToReplace.serial), { serial: serialToLink, type: '' }]
            };
            // Apply Automation
            const automatedData = automateDeliveryStatus(newData);
            // If we automated, we should probably persist it immediately or ensure the user saves.
            // Since this runs inside an edit flow, updating local state `editedData` is correct, 
            // but for 'Replace' which feels like an immediate action, we might want to save ticket.
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

                // Apply Automation
                const automatedData = automateDeliveryStatus(newData);

                // Update Local State (and persist if not in pure edit mode, but here we are usually in edit mode effectively)
                // Actually, handleLinkAsset updates `editedData`. We should update ticket if we are NOT in full edit mode,
                // but usually this action happens inside a modal or inline.
                // To be safe and persistent:
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
            // Optionally revert status if empty? No, better keep it manually managed to avoid confusion.
            updateTicket(ticket.id, newData);
            return newData;
        });

        // Automatización inversa: Devolver al almacén
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

        // Apply Automation
        const automatedData = automateDeliveryStatus(newData);
        updateTicket(ticket.id, automatedData);
        setEditedData(automatedData);

        setIsAssetModalOpen(false);
        setAssetSearchResult(null);
        setSerialQuery('');
    };

    const toggleAccessory = (type) => {
        const isCurrentlyActive = editedData.accessories?.[type] || false;

        // Determinar qué item de inventario descontar/devolver
        let consumableId = null;
        if (type === 'backpack') consumableId = 'CON-005';
        if (type === 'screenFilter') {
            const sizeMap = { '13"': 'CON-001', '14"': 'CON-002', '15"': 'CON-003', '16"': 'CON-004' };
            consumableId = sizeMap[editedData.accessories.filterSize || '14"'];
        }

        if (consumableId) {
            updateConsumableStock(consumableId, isCurrentlyActive ? 1 : -1);
        }

        setEditedData({
            ...editedData,
            accessories: { ...editedData.accessories, [type]: !isCurrentlyActive }
        });
    };

    return (
        <div style={{ maxWidth: '1000px', margin: '0 auto', paddingBottom: '4rem' }}>
            {/* Header Actions */}
            <div className="flex-mobile-column" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', gap: '1rem' }}>
                <Button variant="secondary" icon={ArrowLeft} onClick={() => router.back()}>
                    Volver a la lista
                </Button>
                <div style={{ display: 'flex', gap: '1rem' }}>
                    {editMode ? (
                        <>
                            <Button variant="ghost" onClick={() => {
                                setEditMode(false);
                                setEditedData(ticket); // Reset
                            }}>Cancelar</Button>
                            <Button icon={Save} onClick={handleUpdate}>Guardar Cambios</Button>
                        </>
                    ) : (
                        <Button variant="ghost" icon={Tag} onClick={() => setEditMode(true)}>Editar Detalles</Button>
                    )}
                </div>
            </div>

            <div className="grid-mobile-single" style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '2rem' }}>
                {/* Main Detail area */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                    <Card>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                <Badge variant="outline">{ticket.id}</Badge>
                                <Badge variant={getStatusVariant(editedData.status || ticket.status)}>
                                    {editedData.status || ticket.status}
                                </Badge>
                            </div>
                            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                                {!editMode && !editContact ? (
                                    <Button variant="ghost" size="sm" onClick={() => setEditContact(true)}>Editar Información</Button>
                                ) : editContact ? (
                                    <Button size="sm" icon={Save} onClick={() => {
                                        handleUpdate();
                                        setEditContact(false);
                                    }}>Guardar</Button>
                                ) : null}
                            </div>
                        </div>

                        {editMode ? (
                            <input
                                style={{
                                    fontSize: '1.75rem',
                                    fontWeight: 700,
                                    width: '100%',
                                    background: 'transparent',
                                    border: 'none',
                                    borderBottom: '2px solid var(--primary-color)',
                                    marginBottom: '1.5rem',
                                    color: 'var(--text-main)',
                                    outline: 'none',
                                    padding: '0.5rem 0'
                                }}
                                value={editedData.subject}
                                onChange={e => setEditedData({ ...editedData, subject: e.target.value })}
                            />
                        ) : (
                            <h1 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '1.5rem', color: 'var(--text-main)', lineHeight: 1.3 }}>
                                {ticket.associatedCases && ticket.associatedCases.length > 0 && ticket.associatedCases.some(c => c.caseNumber && c.caseNumber !== 'Caso Principal') && (
                                    <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '0.3rem', letterSpacing: '0.03em' }}>
                                        {ticket.associatedCases.filter(c => c.caseNumber && c.caseNumber !== 'Caso Principal').map(c => c.caseNumber).join(' · ')}
                                    </span>
                                )}
                                {ticket.subject}
                            </h1>
                        )}

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1.5rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                <div style={{ color: 'var(--text-secondary)' }}><User size={18} /></div>
                                <div>
                                    <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', margin: 0 }}>Solicitante</p>
                                    {editMode ? (
                                        <input
                                            className="form-input"
                                            style={{ padding: '0.2rem', marginTop: '2px', fontSize: '1rem', fontWeight: 600, width: '100%' }}
                                            value={editedData.requester}
                                            onChange={e => setEditedData({ ...editedData, requester: e.target.value })}
                                        />
                                    ) : (
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <p style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0, color: 'var(--text-main)' }}>{ticket.requester}</p>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                style={{ padding: '0 4px', height: 'auto', opacity: 0.5 }}
                                                onClick={() => setEditMode(true)}
                                            >
                                                <small style={{ fontSize: '0.7rem' }}>Editar</small>
                                            </Button>
                                        </div>
                                    )}
                                </div>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                <div style={{ color: 'var(--text-secondary)' }}><Calendar size={18} /></div>
                                <div>
                                    <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', margin: 0 }}>Fecha de creación</p>
                                    <p style={{ fontWeight: 500, margin: 0 }}>{ticket.date}</p>
                                </div>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                <div style={{ color: 'var(--text-secondary)' }}><Tag size={18} /></div>
                                <div>
                                    <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', margin: 0 }}>Prioridad</p>
                                    {editMode ? (
                                        <select
                                            className="form-select"
                                            style={{ padding: '0.2rem', marginTop: '2px' }}
                                            value={editedData.priority}
                                            onChange={e => setEditedData({ ...editedData, priority: e.target.value })}
                                        >
                                            <option value="Baja">Baja</option>
                                            <option value="Media">Media</option>
                                            <option value="Alta">Alta</option>
                                            <option value="Crítica">Crítica</option>
                                        </select>
                                    ) : (
                                        <p style={{ fontWeight: 500, margin: 0 }}>{ticket.priority}</p>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Additional User Info in Header */}
                        <div className="grid-mobile-single" style={{ marginTop: '1.25rem', paddingTop: '1rem', borderTop: '1px solid var(--border)', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem 1.5rem' }}>
                            <div className="form-group" style={{ marginBottom: 0 }}>
                                {ticket.associatedCases && ticket.associatedCases.length > 0 ? (
                                    <div style={{ padding: '0.5rem', background: '#f8fafc', borderRadius: '6px', border: '1px solid var(--border)' }}>
                                        <label className="form-label" style={{ fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                            <Hash size={12} /> Casos Asociados ({ticket.associatedCases.length})
                                        </label>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                            {ticket.associatedCases.map((ac, idx) => (
                                                <div key={idx} style={{
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '6px',
                                                    fontSize: '0.8rem',
                                                    padding: '4px',
                                                    background: 'white',
                                                    borderRadius: '4px',
                                                    border: '1px solid var(--border)'
                                                }}>
                                                    <span style={{ fontWeight: 600, color: '#0369a1' }}>#{ac.caseNumber}</span>
                                                    <span style={{ color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '200px' }}>
                                                        {ac.subject}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ) : (
                                    <>
                                        <label className="form-label" style={{ fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>Segundo Caso SFDC (Opcional)</label>
                                        <div style={{ position: 'relative' }}>
                                            <Hash size={12} style={{ position: 'absolute', left: '10px', top: '10px', color: 'var(--text-secondary)' }} />
                                            <input
                                                className="form-input"
                                                style={{ paddingLeft: '2.2rem', height: '32px', fontSize: '0.85rem' }}
                                                disabled={!editMode && !editContact}
                                                value={editedData.logistics?.additionalCase || ''}
                                                onChange={e => setEditedData({
                                                    ...editedData,
                                                    logistics: { ...(editedData.logistics || {}), additionalCase: e.target.value }
                                                })}
                                            />
                                        </div>
                                    </>
                                )}
                            </div>
                            <div className="form-group" style={{ marginBottom: 0 }}>
                                <label className="form-label" style={{ fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>Fecha de Ingreso</label>
                                <div style={{ position: 'relative' }}>
                                    <Calendar size={12} style={{ position: 'absolute', left: '10px', top: '10px', color: 'var(--text-secondary)' }} />
                                    <input
                                        type="date"
                                        className="form-input"
                                        style={{ paddingLeft: '2.2rem', height: '32px', fontSize: '0.85rem' }}
                                        disabled={!editMode && !editContact}
                                        value={editedData.logistics?.entryDate || ''}
                                        onChange={e => setEditedData({
                                            ...editedData,
                                            logistics: { ...(editedData.logistics || {}), entryDate: e.target.value }
                                        })}
                                    />
                                </div>
                            </div>
                            <div className="form-group" style={{ gridColumn: 'span 2', marginBottom: 0 }}>
                                <label className="form-label" style={{ fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>Dirección Completa</label>
                                <div style={{ position: 'relative' }}>
                                    {addressStatus === 'valid' ? (
                                        <CheckCircle2 size={12} style={{ position: 'absolute', left: '10px', top: '10px', color: '#22c55e' }} />
                                    ) : (
                                        <MapPin size={12} style={{ position: 'absolute', left: '10px', top: '10px', color: 'var(--text-secondary)' }} />
                                    )}
                                    <input
                                        className="form-input"
                                        style={{
                                            paddingLeft: '2.2rem',
                                            paddingRight: (editMode || editContact) ? '80px' : '10px',
                                            height: '32px',
                                            fontSize: '0.85rem',
                                            borderColor: addressStatus === 'valid' ? '#22c55e' : (addressStatus === 'invalid' ? '#ef4444' : 'var(--border)')
                                        }}
                                        disabled={!editMode && !editContact}
                                        value={editedData.logistics?.address || ''}
                                        onChange={e => {
                                            setAddressStatus('idle'); // Reset validation on change
                                            setEditedData({
                                                ...editedData,
                                                logistics: { ...(editedData.logistics || {}), address: e.target.value }
                                            });
                                        }}
                                        onBlur={() => {
                                            // Optional: Auto-validate on blur if needed, currently manual via button is safer to avoid annoyance
                                        }}
                                    />
                                    {(editMode || editContact) && isLoaded && (
                                        <button
                                            type="button"
                                            onClick={validateAddress}
                                            style={{
                                                position: 'absolute',
                                                right: '4px',
                                                top: '4px',
                                                bottom: '4px',
                                                border: 'none',
                                                background: addressStatus === 'valid' ? '#dcfce7' : '#eff6ff',
                                                color: addressStatus === 'valid' ? '#166534' : '#1d4ed8',
                                                borderRadius: '4px',
                                                padding: '0 8px',
                                                fontSize: '0.7rem',
                                                fontWeight: 600,
                                                cursor: 'pointer',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '4px'
                                            }}
                                        >
                                            {addressStatus === 'validating' ? (
                                                <Loader2 size={12} className="animate-spin" />
                                            ) : addressStatus === 'valid' ? (
                                                <><CheckCircle size={12} /> OK</>
                                            ) : addressStatus === 'invalid' ? (
                                                <span style={{ color: '#ef4444' }}>Dirección no válida</span>
                                            ) : (
                                                'Validar'
                                            )}
                                        </button>
                                    )}
                                </div>
                                {addressStatus === 'invalid' && (
                                    <p style={{ color: '#ef4444', fontSize: '0.7rem', marginTop: '4px', margin: 0 }}>
                                        ⚠️ Dirección no encontrada en Google Maps.
                                    </p>
                                )}
                            </div>
                            <div className="form-group" style={{ marginBottom: 0 }}>
                                <label className="form-label" style={{ fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>Correo Electrónico</label>
                                <div style={{ position: 'relative' }}>
                                    <Mail size={12} style={{ position: 'absolute', left: '10px', top: '10px', color: 'var(--text-secondary)' }} />
                                    <input
                                        className="form-input"
                                        style={{ paddingLeft: '2.2rem', height: '32px', fontSize: '0.85rem' }}
                                        disabled={!editMode && !editContact}
                                        value={editedData.logistics?.email || ''}
                                        onChange={e => setEditedData({
                                            ...editedData,
                                            logistics: { ...(editedData.logistics || {}), email: e.target.value }
                                        })}
                                    />
                                </div>
                            </div>
                            <div className="form-group" style={{ marginBottom: 0 }}>
                                <label className="form-label" style={{ fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>Teléfono de Contacto</label>
                                <div style={{ position: 'relative' }}>
                                    <Phone size={12} style={{ position: 'absolute', left: '10px', top: '10px', color: 'var(--text-secondary)' }} />
                                    <input
                                        className="form-input"
                                        style={{ paddingLeft: '2.2rem', height: '32px', fontSize: '0.85rem' }}
                                        disabled={!editMode && !editContact}
                                        value={editedData.logistics?.phone || ''}
                                        onChange={e => setEditedData({
                                            ...editedData,
                                            logistics: { ...(editedData.logistics || {}), phone: e.target.value }
                                        })}
                                    />
                                </div>
                            </div>

                            {/* Contact Actions Row */}
                            {!editMode && !editContact && (editedData.logistics?.email || editedData.logistics?.phone) && (
                                <div style={{ gridColumn: 'span 2', display: 'flex', gap: '0.5rem', marginTop: '4px' }}>
                                    {editedData.logistics?.email && (
                                        <button
                                            onClick={() => window.open(`https://slack.com/app_redirect?channel=${encodeURIComponent(editedData.logistics.email)}`, '_blank')}
                                            style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '0.4rem',
                                                padding: '4px 10px',
                                                borderRadius: '6px',
                                                background: '#4A154B',
                                                color: 'white',
                                                fontSize: '0.7rem',
                                                fontWeight: 600,
                                                border: 'none',
                                                cursor: 'pointer',
                                                transition: 'all 0.2s'
                                            }}
                                            onMouseOver={e => e.currentTarget.style.opacity = '0.9'}
                                            onMouseOut={e => e.currentTarget.style.opacity = '1'}
                                        >
                                            <Slack size={12} /> Slack
                                        </button>
                                    )}
                                    {editedData.logistics?.phone && (
                                        <button
                                            onClick={() => {
                                                const phone = editedData.logistics?.phone || '';
                                                if (phone) window.open(`https://wa.me/${phone.replace(/\D/g, '')}`, '_blank');
                                            }}
                                            style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '0.4rem',
                                                padding: '4px 10px',
                                                borderRadius: '6px',
                                                background: '#25D366',
                                                color: 'white',
                                                fontSize: '0.7rem',
                                                fontWeight: 600,
                                                border: 'none',
                                                cursor: (editedData.logistics?.phone) ? 'pointer' : 'default',
                                                opacity: (editedData.logistics?.phone) ? 1 : 0.5,
                                                transition: 'all 0.2s'
                                            }}
                                            onMouseOver={e => { if (editedData.logistics?.phone) e.currentTarget.style.opacity = '0.9' }}
                                            onMouseOut={e => { if (editedData.logistics?.phone) e.currentTarget.style.opacity = '1' }}
                                        >
                                            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L0 24l6.335-1.662c1.72.937 3.659 1.432 5.626 1.433h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" /></svg> WhatsApp
                                        </button>
                                    )}
                                </div>
                            )}
                        </div>
                    </Card>

                    <Card title="Casos Asociados">
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                            {/* Casos del ticket (configurados) */}
                            {(editedData.associatedCases || []).map((caso, index) => {
                                const caseAssets = caso.assets || [];
                                const hasHardware = caseAssets.length > 0;
                                const isReady = ['Entregado', 'Recuperado'].includes(caso.logistics?.status) || caso.logistics?.userContacted;
                                const isSelected = selectedCaseIndex === index;

                                return (
                                    <div key={index} onClick={() => {
                                        setSelectedCaseIndex(isSelected ? null : index);
                                        setIsSmartSearchOpen(false);
                                        setAssetSearchResult(null);
                                        setSerialQuery('');
                                    }} style={{
                                        display: 'flex', alignItems: 'center', justifyContent: 'space-between', 
                                        padding: '0.875rem 1rem',
                                        background: isSelected ? 'var(--primary-color)' : 'var(--background)',
                                        border: `2px solid ${isSelected ? 'var(--primary-color)' : 'var(--border)'}`,
                                        borderRadius: 'var(--radius-md)',
                                        cursor: 'pointer',
                                        transition: 'all 0.2s'
                                    }}>
                                        <div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                                                {caso.caseNumber && caso.caseNumber !== 'Caso Principal' && (
                                                    <span style={{ fontSize: '0.75rem', fontWeight: 700, color: isSelected ? 'rgba(255,255,255,0.8)' : '#0369a1', background: isSelected ? 'rgba(255,255,255,0.15)' : '#e0f2fe', padding: '1px 6px', borderRadius: '4px' }}>
                                                        {caso.caseNumber}
                                                    </span>
                                                )}
                                                <h4 style={{ margin: 0, fontSize: '0.85rem', fontWeight: 600, color: isSelected ? 'white' : 'var(--text-main)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '250px' }}>
                                                    {caso.subject}
                                                </h4>
                                            </div>
                                            <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                                                <Badge variant={hasHardware ? 'info' : 'secondary'} style={{ fontSize: '0.65rem', opacity: isSelected ? 0.85 : 1 }}>
                                                    {caseAssets.length} Equipos
                                                </Badge>
                                                <Badge variant={isReady ? 'success' : 'warning'} style={{ fontSize: '0.65rem', opacity: isSelected ? 0.85 : 1 }}>
                                                    {caso.logistics?.status || 'Pendiente'}: {caso.logistics?.method || 'Sin método'}
                                                </Badge>
                                            </div>
                                        </div>
                                        <div style={{ fontSize: '0.75rem', color: isSelected ? 'rgba(255,255,255,0.7)' : 'var(--text-secondary)', marginLeft: '0.5rem', textAlign: 'right' }}>
                                            {isSelected ? '▲ Configurando' : 'Clic para configurar'}
                                        </div>
                                    </div>
                                );
                            })}

                            {/* Otros casos SFDC del mismo solicitante (no incluidos en este ticket) */}
                            {(() => {
                                const requesterName = (ticket.requester || '').toLowerCase().trim();
                                const linkedCaseNumbers = (editedData.associatedCases || []).map(c => c.caseNumber).filter(Boolean);
                                const otherCases = sfdcCases.filter(sc => {
                                    const rf = (sc.requestedFor || '').toLowerCase().trim();
                                    return rf === requesterName && !linkedCaseNumbers.includes(sc.caseNumber);
                                });
                                if (otherCases.length === 0) return null;
                                return (
                                    <>
                                        <div style={{ fontSize: '0.7rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-secondary)', marginTop: '0.5rem', borderTop: '1px solid var(--border)', paddingTop: '0.75rem' }}>
                                            Otros casos SFDC de {ticket.requester}
                                        </div>
                                        {otherCases.map((sc, i) => (
                                            <div key={i} style={{
                                                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                                padding: '0.75rem 1rem',
                                                background: '#f8fafc',
                                                border: '1px dashed var(--border)',
                                                borderRadius: 'var(--radius-md)'
                                            }}>
                                                <div>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.2rem' }}>
                                                        <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#0369a1', background: '#e0f2fe', padding: '1px 6px', borderRadius: '4px' }}>
                                                            {sc.caseNumber}
                                                        </span>
                                                        <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-main)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '220px' }}>
                                                            {sc.subject}
                                                        </span>
                                                    </div>
                                                    <Badge variant="secondary" style={{ fontSize: '0.65rem' }}>{sc.status || 'Pendiente'}</Badge>
                                                </div>
                                                <Button size="sm" variant="ghost" style={{ fontSize: '0.75rem', whiteSpace: 'nowrap' }} onClick={() => {
                                                    const newCase = {
                                                        caseNumber: sc.caseNumber,
                                                        subject: sc.subject,
                                                        assets: [],
                                                        accessories: { backpack: false, screenFilter: false, filterSize: '14"' },
                                                        logistics: { method: '', deliveryDate: '', timeWindow: 'AM', status: 'Pendiente' }
                                                    };
                                                    const updated = { ...editedData, associatedCases: [...(editedData.associatedCases || []), newCase] };
                                                    setEditedData(updated);
                                                    updateTicket(ticket.id, updated);
                                                }}>
                                                    + Agregar
                                                </Button>
                                            </div>
                                        ))}
                                    </>
                                );
                            })()}
                        </div>
                    </Card>

                    {/* History & Internal Notes */}
                    < Card title="Historial y Notas" action={< MessageSquare size={20} style={{ opacity: 0.6 }} />}>
                        <div style={{ borderLeft: '2px solid var(--border)', paddingLeft: '1.5rem', marginLeft: '0.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                            {/* Static initial action */}
                            <div style={{ position: 'relative' }}>
                                <div style={{ position: 'absolute', left: '-1.85rem', top: '0', width: '10px', height: '10px', borderRadius: '50%', background: 'var(--accent-color)' }} />
                                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>Sistema • {ticket.date}</div>
                                <div style={{ padding: '0.75rem', background: 'var(--background)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', fontSize: '0.9rem' }}>
                                    Ticket creado: {ticket.subject}
                                </div>
                            </div>

                            {/* Dynamic Notes */}
                            {(editedData.internalNotes || []).map((note, idx) => (
                                <div key={idx} style={{ position: 'relative' }}>
                                    <div style={{ position: 'absolute', left: '-1.85rem', top: '0', width: '10px', height: '10px', borderRadius: '50%', background: 'var(--primary-color)' }} />
                                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>
                                        {note.user} • {new Date(note.date).toLocaleString()}
                                    </div>
                                    <div style={{ padding: '0.75rem', background: 'var(--background)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', fontSize: '0.9rem', color: 'var(--text-main)' }}>
                                        {note.content}
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div style={{ marginTop: '2rem' }}>
                            <textarea
                                placeholder="Escribe una nota interna..."
                                className="form-textarea"
                                style={{ minHeight: '100px', resize: 'none' }}
                                value={newNote}
                                onChange={e => setNewNote(e.target.value)}
                            />
                            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1rem' }}>
                                <Button size="sm" onClick={() => {
                                    if (newNote.trim()) {
                                        const noteObj = {
                                            content: newNote,
                                            user: currentUser?.name || 'Sistema',
                                            date: new Date().toISOString()
                                        };
                                        const updatedNotes = [...(editedData.internalNotes || []), noteObj];
                                        const updatedTicket = { ...editedData, internalNotes: updatedNotes };

                                        setEditedData(updatedTicket);
                                        updateTicket(ticket.id, updatedTicket);
                                        setNewNote('');
                                    }
                                }}>Añadir Nota</Button>
                            </div>
                        </div>
                    </Card >
                </div >

                {/* Sidebar area */}
                < div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }
                }>
                    <Card title="Estado de Gestión">
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Cambiar el estado actual:</p>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                {['Abierto', 'En Progreso', 'Pendiente', 'Resuelto', 'Caso SFDC Cerrado', 'Servicio Facturado'].map(s => (
                                    <Button
                                        key={s}
                                        variant={(editedData.status || ticket.status) === s ? getStatusVariant(s) : 'outline'}
                                        size="sm"
                                        style={{ justifyContent: 'flex-start', fontWeight: (editedData.status || ticket.status) === s ? 700 : 400 }}
                                        onClick={() => {
                                            if (editMode) {
                                                setEditedData({ ...editedData, status: s });
                                            } else {
                                                updateTicket(ticket.id, { status: s });
                                            }
                                        }}
                                    >
                                        {s === 'Abierto' && <AlertCircle size={16} style={{ marginRight: '8px' }} />}
                                        {s === 'En Progreso' && <Clock size={16} style={{ marginRight: '8px' }} />}
                                        {s === 'Resuelto' && <CheckCircle size={16} style={{ marginRight: '8px' }} />}
                                        {s === 'Caso SFDC Cerrado' && <Check size={16} style={{ marginRight: '8px' }} />}
                                        {s === 'Servicio Facturado' && <DollarSign size={16} style={{ marginRight: '8px' }} />}
                                        {s}
                                    </Button>
                                ))}
                            </div>
                        </div>
                    </Card>


                    <Card title="Coordinación de Fecha y Hora" action={
                        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                            {!editSchedule ? (
                                <Button variant="ghost" size="sm" onClick={() => setEditSchedule(true)}>Editar</Button>
                            ) : (
                                <Button size="sm" icon={Save} onClick={() => {
                                    handleUpdate();
                                    setEditSchedule(false);
                                }}>Guardar</Button>
                            )}
                            <Calendar size={18} style={{ opacity: 0.6 }} />
                        </div>
                    }>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            {editSchedule && (
                                <div style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.5rem',
                                    padding: '0.6rem 0.8rem',
                                    background: 'rgba(245, 158, 11, 0.08)',
                                    borderRadius: '10px',
                                    border: '1px solid rgba(245, 158, 11, 0.2)',
                                    marginBottom: '0.25rem',
                                    animation: 'slideDown 0.3s ease-out'
                                }}>
                                    <AlertCircle size={14} style={{ color: '#d97706' }} />
                                    <span style={{ fontSize: '0.75rem', color: '#92400e', fontWeight: 600 }}>
                                        ⚠️ No te olvides de confirmar BIEN la dirección de entrega.
                                    </span>
                                </div>
                            )}
                            <div className="form-group">
                                <label className="form-label">Fecha Acordada</label>
                                <div style={{ position: 'relative' }}>
                                    <Calendar size={16} style={{ position: 'absolute', left: '12px', top: '12px', color: 'var(--text-secondary)' }} />
                                    <input
                                        type="date"
                                        className="form-input"
                                        style={{ paddingLeft: '2.5rem' }}
                                        disabled={!editMode && !editLogistics && !editSchedule}
                                        value={editedData.logistics?.date || editedData.logistics?.datetime?.split('T')[0] || ''}
                                        onChange={e => setEditedData({
                                            ...editedData,
                                            logistics: { ...(editedData.logistics || {}), date: e.target.value }
                                        })}
                                    />
                                </div>
                            </div>

                            <div className="form-group">
                                <label className="form-label">Turno</label>
                                <div style={{ display: 'flex', gap: '0.5rem', height: '42px' }}>
                                    <button
                                        type="button"
                                        disabled={!editMode && !editLogistics && !editSchedule}
                                        onClick={() => setEditedData({
                                            ...editedData,
                                            logistics: { ...(editedData.logistics || {}), timeSlot: 'AM' }
                                        })}
                                        style={{
                                            flex: 1,
                                            borderRadius: 'var(--radius-md)',
                                            border: '1px solid var(--border)',
                                            background: (editedData.logistics?.timeSlot || 'AM') === 'AM' ? 'var(--primary-color)' : 'var(--background)',
                                            color: (editedData.logistics?.timeSlot || 'AM') === 'AM' ? 'white' : 'var(--text-main)',
                                            fontWeight: 600,
                                            cursor: 'pointer',
                                            transition: 'all 0.2s'
                                        }}
                                    >AM</button>
                                    <button
                                        type="button"
                                        disabled={!editMode && !editLogistics && !editSchedule}
                                        onClick={() => setEditedData({
                                            ...editedData,
                                            logistics: { ...(editedData.logistics || {}), timeSlot: 'PM' }
                                        })}
                                        style={{
                                            flex: 1,
                                            borderRadius: 'var(--radius-md)',
                                            border: '1px solid var(--border)',
                                            background: editedData.logistics?.timeSlot === 'PM' ? 'var(--primary-color)' : 'var(--background)',
                                            color: editedData.logistics?.timeSlot === 'PM' ? 'white' : 'var(--text-main)',
                                            fontWeight: 600,
                                            cursor: 'pointer',
                                            transition: 'all 0.2s'
                                        }}
                                    >PM</button>
                                </div>
                            </div>

                            <div className="form-group" style={{ marginTop: '1rem', borderTop: '1px solid var(--border)', paddingTop: '1.25rem' }}>
                                <label style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: (editMode || editLogistics || editSchedule) ? 'pointer' : 'default' }}>
                                    <input
                                        type="checkbox"
                                        disabled={!editMode && !editLogistics && !editSchedule}
                                        checked={!!editedData.logistics?.userContacted}
                                        onChange={e => {
                                            const isChecked = e.target.checked;
                                            const newData = {
                                                ...editedData,
                                                logistics: {
                                                    ...(editedData.logistics || {}),
                                                    userContacted: isChecked,
                                                    coordinatedBy: isChecked ? (currentUser?.name || 'Sistema') : '',
                                                    enabled: isChecked
                                                },
                                                deliveryStatus: isChecked ? 'En Transito' : 'Para Coordinar'
                                            };
                                            setEditedData(newData);
                                            // Guardado automático al marcar
                                            if (isChecked) {
                                                updateTicket(ticket.id, newData);
                                            }
                                        }}
                                        style={{ width: '18px', height: '18px', cursor: 'inherit' }}
                                    />
                                    <span style={{ fontSize: '0.85rem', fontWeight: 500, color: 'var(--text-main)' }}>Usuario contactado y visita coordinada</span>
                                </label>

                                {editedData.logistics?.userContacted && editedData.logistics?.coordinatedBy && (
                                    <div style={{
                                        marginTop: '0.75rem',
                                        padding: '0.5rem 0.75rem',
                                        background: 'rgba(37, 99, 235, 0.05)',
                                        borderRadius: '8px',
                                        fontSize: '0.8rem',
                                        color: 'var(--text-secondary)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '0.5rem'
                                    }}>
                                        <div style={{ width: '8px', height: '8px', background: '#22c55e', borderRadius: '50%' }}></div>
                                        <span>Coordinado por: <strong>{editedData.logistics.coordinatedBy}</strong></span>
                                    </div>
                                )}
                            </div>
                        </div>
                    </Card>

                    {/* Proceso Checklist - Phase 6 Enhancement */}
                    <Card title="Checklist de Proceso">
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
                            {[
                                {
                                    label: 'Confirma información del Usuario',
                                    done: !!(editedData.logistics?.address && editedData.logistics?.phone)
                                },
                                {
                                    label: 'Coordina Fecha y Hora',
                                    done: !!(editedData.logistics?.date || editedData.logistics?.datetime)
                                },
                                {
                                    label: 'Confirma que dispositivo enviar',
                                    done: (editedData.associatedAssets?.length > 0)
                                },
                                {
                                    label: 'Confirma método de envío',
                                    done: !!editedData.logistics?.method
                                },
                                {
                                    label: 'Paquete Coordinado en Transito',
                                    done: (editedData.deliveryStatus === 'En Transito' || !!editedData.logistics?.userContacted)
                                },
                                {
                                    label: 'Confirmación que fue entregado',
                                    done: ['Resuelto', 'Caso SFDC Cerrado', 'Servicio Facturado'].includes(editedData.status || ticket.status)
                                },
                                {
                                    label: 'Revision y cierre en SFDC',
                                    done: ['Caso SFDC Cerrado', 'Servicio Facturado'].includes(editedData.status || ticket.status)
                                },
                                {
                                    label: 'Facturado',
                                    done: (editedData.status || ticket.status) === 'Servicio Facturado'
                                }
                            ].map((item, idx) => (
                                <div key={idx} style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.75rem',
                                    transition: 'all 0.3s ease',
                                    opacity: item.done ? 1 : 0.5
                                }}>
                                    {item.done ? (
                                        <CheckCircle2 size={18} style={{ color: '#22c55e' }} />
                                    ) : (
                                        <div style={{
                                            width: '18px',
                                            height: '18px',
                                            borderRadius: '50%',
                                            border: '2px solid var(--border)',
                                            background: 'transparent'
                                        }} />
                                    )}
                                    <span style={{
                                        fontSize: '0.85rem',
                                        fontWeight: item.done ? 600 : 400,
                                        color: item.done ? 'var(--text-main)' : 'var(--text-secondary)',
                                        textDecoration: item.done ? 'none' : 'none'
                                    }}>
                                        {item.label}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </Card>

                    {
                        (currentUser?.role === 'admin' || currentUser?.role === 'Gerencial') && (
                            <Card style={{ borderColor: 'rgba(239, 68, 68, 0.2)', backgroundColor: 'rgba(239, 68, 68, 0.05)' }}>
                                <h4 style={{ color: '#ef4444', marginBottom: '1rem', fontSize: '0.9rem' }}>Zona de Peligro</h4>
                                <Button variant="danger" size="sm" icon={Trash2} style={{ width: '100%', justifyContent: 'center' }} onClick={handleDelete}>
                                    Borrar Ticket
                                </Button>
                            </Card>
                        )
                    }
                </div >
            </div >

            
            {/* Case Config Modal */}
            <Modal
                isOpen={selectedCaseIndex !== null}
                onClose={() => {
                    setSelectedCaseIndex(null);
                    // Automatic save on close
                    handleUpdate(); 
                }}
                title={selectedCaseIndex !== null ? `Configuración: ${editedData.associatedCases[selectedCaseIndex]?.subject}` : 'Configurar Caso'}
            >
                {selectedCaseIndex !== null && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                        {/* EQUIPAMIENTO */}
                        <div>
                            <h4 style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--primary-color)', marginBottom: '1rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.5rem' }}>
                                Equipamiento (Hardware Asignado)
                            </h4>
                            
                            {/* Asset List */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1rem' }}>
                                {(editedData.associatedCases[selectedCaseIndex].assets || []).length === 0 ? (
                                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>No hay equipos asignados a este caso.</p>
                                ) : (
                                    editedData.associatedCases[selectedCaseIndex].assets.map((item, idxx) => {
                                        const assetInfo = assets.find(a => a.serial === item.serial);
                                        return (
                                            <div key={idxx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.5rem', background: 'rgba(0,0,0,0.02)', borderRadius: '6px', border: '1px solid var(--border)' }}>
                                                <div>
                                                    <p style={{ fontWeight: 600, fontSize: '0.85rem', margin: 0 }}>{assetInfo?.name || 'Hardware'} (S/N: {item.serial})</p>
                                                    <select
                                                        className="form-select"
                                                        style={{ fontSize: '0.75rem', padding: '2px 6px', height: '26px', marginTop: '4px', width: 'auto' }}
                                                        value={item.type || ''}
                                                        onChange={(e) => {
                                                            const newType = e.target.value;
                                                            setEditedData(prev => {
                                                                const newCases = [...prev.associatedCases];
                                                                const newAssets = [...newCases[selectedCaseIndex].assets];
                                                                newAssets[idxx] = { ...newAssets[idxx], type: newType };
                                                                newCases[selectedCaseIndex] = { ...newCases[selectedCaseIndex], assets: newAssets };
                                                                return { ...prev, associatedCases: newCases };
                                                            });
                                                        }}
                                                    >
                                                        <option value="">Selecciona Acción</option>
                                                        <option value="Entrega">Entrega</option>
                                                        <option value="Recupero">Recupero</option>
                                                    </select>
                                                </div>
                                                <Button variant="ghost" size="sm" onClick={() => {
                                                    // Handle unlink
                                                    setEditedData(prev => {
                                                        const newCases = [...prev.associatedCases];
                                                        newCases[selectedCaseIndex].assets = newCases[selectedCaseIndex].assets.filter((a, i) => i !== idxx);
                                                        return { ...prev, associatedCases: newCases };
                                                    });
                                                }} style={{ color: '#ef4444', padding: '4px' }}>
                                                    <Trash2 size={16} />
                                                </Button>
                                            </div>
                                        )
                                    })
                                )}
                            </div>

                            {/* Add New Asset */}
                            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                                <div style={{ position: 'relative', flex: 1 }}>
                                    <Search size={14} style={{ position: 'absolute', left: '10px', top: '10px', color: 'var(--text-secondary)' }} />
                                    <input 
                                        className="form-input" 
                                        placeholder="Vincular serial..." 
                                        style={{ paddingLeft: '2rem', height: '34px', fontSize: '0.85rem' }}
                                        value={serialQuery}
                                        onChange={e => setSerialQuery(e.target.value)}
                                        onKeyPress={e => e.key === 'Enter' && handleAssetSearch()}
                                    />
                                </div>
                                <Button size="sm" onClick={handleAssetSearch}>Buscar</Button>
                            </div>
                            
                            <div style={{ marginTop: '0.75rem', display: 'flex', justifyContent: 'center' }}>
                                <Button 
                                    size="sm" 
                                    variant="outline" 
                                    onClick={() => setIsInventorySelectorOpen(true)}
                                    style={{ width: '100%', color: 'var(--primary-color)', borderColor: 'var(--primary-color)' }}
                                >
                                    <Package size={16} style={{ marginRight: '0.5rem' }} />
                                    Explorar Inventario para Asignar
                                </Button>
                            </div>
                            
                            {assetSearchResult === 'not_found' && (
                                <div style={{ marginTop: '0.5rem', padding: '0.5rem', border: '1px dashed #ef4444', borderRadius: '6px' }}>
                                    <p style={{ color: '#ef4444', fontSize: '0.8rem', margin: '0 0 0.5rem 0' }}>Serial no encontrado en Inventario.</p>
                                    <Button size="sm" variant="secondary" onClick={() => setIsAssetModalOpen(true)}>Dar de Alta Manual</Button>
                                </div>
                            )}

                            {assetSearchResult && assetSearchResult !== 'not_found' && (
                                <div style={{ marginTop: '0.5rem', padding: '0.5rem', background: '#f8fafc', border: '1px solid var(--border)', borderRadius: '6px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <div>
                                        <p style={{ fontWeight: 600, fontSize: '0.8rem', margin: 0 }}>{assetSearchResult.name}</p>
                                        <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', margin: 0 }}>{assetSearchResult.type} • {assetSearchResult.status}</p>
                                    </div>
                                    <Button size="sm" variant="outline" onClick={() => {
                                        const serialToLink = assetSearchResult.serial;
                                        setEditedData(prev => {
                                            const newCases = [...prev.associatedCases];
                                            const currentAssets = newCases[selectedCaseIndex].assets || [];
                                            if(!currentAssets.some(a => a.serial === serialToLink)) {
                                                newCases[selectedCaseIndex].assets = [...currentAssets, { serial: serialToLink, type: '' }];
                                            }
                                            return { ...prev, associatedCases: newCases };
                                        });
                                        setAssetSearchResult(null);
                                        setSerialQuery('');
                                    }}>Vincular al Caso</Button>
                                </div>
                            )}

                            {/* Accesorios - Siempre visible */}
                            <div style={{ marginTop: '1.5rem', borderTop: '1px solid var(--border)', paddingTop: '1rem' }}>
                                <h4 style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.75rem' }}>Accesorios Adicionales (Sin Serial)</h4>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem' }}>
                                    {/* Backpack */}
                                    <div
                                        onClick={() => {
                                            setEditedData(prev => {
                                                const newCases = [...prev.associatedCases];
                                                const accessories = newCases[selectedCaseIndex].accessories || { backpack: false, screenFilter: false, filterSize: '14"' };
                                                newCases[selectedCaseIndex].accessories = { ...accessories, backpack: !accessories.backpack };
                                                return { ...prev, associatedCases: newCases };
                                            });
                                        }}
                                        style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.5rem', border: '1px solid var(--border)', borderRadius: '6px', cursor: 'pointer', background: editedData.associatedCases[selectedCaseIndex].accessories?.backpack ? 'rgba(37, 99, 235, 0.05)' : 'transparent', borderColor: editedData.associatedCases[selectedCaseIndex].accessories?.backpack ? 'var(--primary-color)' : 'var(--border)' }}
                                    >
                                        <div style={{ padding: '0.3rem', background: 'rgba(0,0,0,0.05)', borderRadius: '4px' }}><Package size={14} /></div>
                                        <span style={{ fontSize: '0.8rem', fontWeight: 600, flex: 1 }}>Mochila</span>
                                        <input type="checkbox" checked={!!editedData.associatedCases[selectedCaseIndex].accessories?.backpack} readOnly />
                                    </div>

                                    {/* Screen Filter */}
                                    <div
                                        onClick={() => {
                                            setEditedData(prev => {
                                                const newCases = [...prev.associatedCases];
                                                const accessories = newCases[selectedCaseIndex].accessories || { backpack: false, screenFilter: false, filterSize: '14"' };
                                                newCases[selectedCaseIndex].accessories = { ...accessories, screenFilter: !accessories.screenFilter };
                                                return { ...prev, associatedCases: newCases };
                                            });
                                        }}
                                        style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.5rem', border: '1px solid var(--border)', borderRadius: '6px', cursor: 'pointer', background: editedData.associatedCases[selectedCaseIndex].accessories?.screenFilter ? 'rgba(37, 99, 235, 0.05)' : 'transparent', borderColor: editedData.associatedCases[selectedCaseIndex].accessories?.screenFilter ? 'var(--primary-color)' : 'var(--border)' }}
                                    >
                                        <div style={{ padding: '0.3rem', background: 'rgba(0,0,0,0.05)', borderRadius: '4px' }}><Monitor size={14} /></div>
                                        <div style={{ flex: 1 }}>
                                            <span style={{ fontSize: '0.8rem', fontWeight: 600, display: 'block' }}>Filtro de Pantalla</span>
                                            {editedData.associatedCases[selectedCaseIndex].accessories?.screenFilter && (
                                                <select
                                                    className="form-select" style={{ fontSize: '0.7rem', padding: '2px', height: '22px', marginTop: '2px', width: '80px' }}
                                                    value={editedData.associatedCases[selectedCaseIndex].accessories?.filterSize || '14"'}
                                                    onClick={(e) => e.stopPropagation()}
                                                    onChange={e => {
                                                        setEditedData(prev => {
                                                            const newCases = [...prev.associatedCases];
                                                            const accessories = newCases[selectedCaseIndex].accessories || {};
                                                            newCases[selectedCaseIndex].accessories = { ...accessories, filterSize: e.target.value };
                                                            return { ...prev, associatedCases: newCases };
                                                        });
                                                    }}
                                                >
                                                    <option value='13"'>13"</option>
                                                    <option value='14"'>14"</option>
                                                    <option value='15"'>15"</option>
                                                    <option value='16"'>16"</option>
                                                </select>
                                            )}
                                        </div>
                                        <input type="checkbox" checked={!!editedData.associatedCases[selectedCaseIndex].accessories?.screenFilter} readOnly />
                                    </div>
                                </div>
                            </div>

                            {/* Security Keys (YubiKeys) */}
                            <div style={{ marginTop: '1.5rem', borderTop: '1px solid var(--border)', paddingTop: '1rem' }}>
                                <h4 style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                    <Key size={14} /> Security Keys (YubiKey)
                                </h4>

                                {/* YubiKeys asignados al caso */}
                                {(editedData.associatedCases[selectedCaseIndex].yubikeys || []).length > 0 && (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '0.75rem' }}>
                                        {editedData.associatedCases[selectedCaseIndex].yubikeys.map((yk, ykIdx) => {
                                            const ykInfo = yubikeys.find(y => y.serial === yk.serial);
                                            return (
                                                <div key={ykIdx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.5rem 0.75rem', background: 'rgba(0,0,0,0.02)', borderRadius: '6px', border: '1px solid var(--border)' }}>
                                                    <div>
                                                        <p style={{ fontWeight: 600, fontSize: '0.8rem', margin: 0 }}>
                                                            <Key size={12} style={{ marginRight: '4px', display: 'inline' }} />
                                                            {ykInfo?.type || 'YubiKey'} — S/N: {yk.serial}
                                                        </p>
                                                        <select
                                                            className="form-select"
                                                            style={{ fontSize: '0.75rem', padding: '2px 6px', height: '26px', marginTop: '4px', width: 'auto' }}
                                                            value={yk.type || ''}
                                                            onChange={(e) => {
                                                                const newType = e.target.value;
                                                                setEditedData(prev => {
                                                                    const newCases = [...prev.associatedCases];
                                                                    const newYKs = [...(newCases[selectedCaseIndex].yubikeys || [])];
                                                                    newYKs[ykIdx] = { ...newYKs[ykIdx], type: newType };
                                                                    newCases[selectedCaseIndex] = { ...newCases[selectedCaseIndex], yubikeys: newYKs };
                                                                    return { ...prev, associatedCases: newCases };
                                                                });
                                                            }}
                                                        >
                                                            <option value="">Selecciona Acción</option>
                                                            <option value="Entrega">Entrega</option>
                                                            <option value="Recupero">Recupero</option>
                                                        </select>
                                                    </div>
                                                    <Button variant="ghost" size="sm" onClick={() => {
                                                        setEditedData(prev => {
                                                            const newCases = [...prev.associatedCases];
                                                            newCases[selectedCaseIndex].yubikeys = (newCases[selectedCaseIndex].yubikeys || []).filter((_, i) => i !== ykIdx);
                                                            return { ...prev, associatedCases: newCases };
                                                        });
                                                    }} style={{ color: '#ef4444', padding: '4px' }}>
                                                        <Trash2 size={16} />
                                                    </Button>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}

                                {/* Buscar YubiKey por serial */}
                                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                                    <div style={{ position: 'relative', flex: 1 }}>
                                        <Key size={14} style={{ position: 'absolute', left: '10px', top: '10px', color: 'var(--text-secondary)' }} />
                                        <input
                                            className="form-input"
                                            placeholder="Serial YubiKey..."
                                            style={{ paddingLeft: '2rem', height: '34px', fontSize: '0.85rem' }}
                                            id="yubikey-serial-input"
                                            onKeyPress={e => {
                                                if (e.key === 'Enter') {
                                                    const serial = e.target.value.trim();
                                                    if (!serial) return;
                                                    const found = yubikeys.find(y => y.serial?.toLowerCase() === serial.toLowerCase());
                                                    if (found) {
                                                        setEditedData(prev => {
                                                            const newCases = [...prev.associatedCases];
                                                            const currentYKs = newCases[selectedCaseIndex].yubikeys || [];
                                                            if (!currentYKs.some(y => y.serial === found.serial)) {
                                                                newCases[selectedCaseIndex] = { ...newCases[selectedCaseIndex], yubikeys: [...currentYKs, { serial: found.serial, type: 'Entrega' }] };
                                                            }
                                                            return { ...prev, associatedCases: newCases };
                                                        });
                                                        e.target.value = '';
                                                    } else {
                                                        alert('YubiKey no encontrado con ese serial.');
                                                    }
                                                }
                                            }}
                                        />
                                    </div>
                                    <Button size="sm" onClick={() => {
                                        const input = document.getElementById('yubikey-serial-input');
                                        const serial = input?.value?.trim();
                                        if (!serial) return;
                                        const found = yubikeys.find(y => y.serial?.toLowerCase() === serial.toLowerCase());
                                        if (found) {
                                            setEditedData(prev => {
                                                const newCases = [...prev.associatedCases];
                                                const currentYKs = newCases[selectedCaseIndex].yubikeys || [];
                                                if (!currentYKs.some(y => y.serial === found.serial)) {
                                                    newCases[selectedCaseIndex] = { ...newCases[selectedCaseIndex], yubikeys: [...currentYKs, { serial: found.serial, type: 'Entrega' }] };
                                                }
                                                return { ...prev, associatedCases: newCases };
                                            });
                                            if (input) input.value = '';
                                        } else {
                                            alert('YubiKey no encontrado con ese serial.');
                                        }
                                    }}>Agregar</Button>
                                </div>

                                {/* Lista disponibles en inventario */}
                                {yubikeys.filter(y => y.status === 'disponible' || y.status === 'Disponible' || y.status === 'stock').length > 0 && (
                                    <div style={{ marginTop: '0.5rem' }}>
                                        <p style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>Disponibles en stock:</p>
                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                                            {yubikeys.filter(y => y.status === 'disponible' || y.status === 'Disponible' || y.status === 'stock').map(y => (
                                                <button key={y.id} onClick={() => {
                                                    setEditedData(prev => {
                                                        const newCases = [...prev.associatedCases];
                                                        const currentYKs = newCases[selectedCaseIndex].yubikeys || [];
                                                        if (!currentYKs.some(yk => yk.serial === y.serial)) {
                                                            newCases[selectedCaseIndex] = { ...newCases[selectedCaseIndex], yubikeys: [...currentYKs, { serial: y.serial, type: 'Entrega' }] };
                                                        }
                                                        return { ...prev, associatedCases: newCases };
                                                    });
                                                }} style={{
                                                    padding: '3px 8px', fontSize: '0.7rem', borderRadius: '4px',
                                                    border: '1px solid var(--border)', background: '#f8fafc',
                                                    cursor: 'pointer', fontWeight: 500,
                                                    color: (editedData.associatedCases[selectedCaseIndex].yubikeys || []).some(yk => yk.serial === y.serial) ? '#22c55e' : 'var(--text-main)'
                                                }}>
                                                    {(editedData.associatedCases[selectedCaseIndex].yubikeys || []).some(yk => yk.serial === y.serial) ? '✓ ' : ''}{y.serial} ({y.type})
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>


                        </div>

                        {/* LOGISTICA */}
                        <div>
                            <h4 style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--primary-color)', marginBottom: '1rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.5rem' }}>
                                Logística del Caso
                            </h4>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1rem' }}>
                                <div className="form-group">
                                    <label className="form-label">Estado de la Logística / Envío</label>
                                    <select
                                        className="form-select"
                                        value={editedData.associatedCases[selectedCaseIndex].logistics?.status || 'Pendiente'}
                                        onChange={e => setEditedData(prev => {
                                            const newCases = [...prev.associatedCases];
                                            newCases[selectedCaseIndex].logistics = { ...newCases[selectedCaseIndex].logistics, status: e.target.value };
                                            return { ...prev, associatedCases: newCases };
                                        })}
                                    >
                                        <option value="Pendiente">Pendiente</option>
                                        <option value="Para Coordinar">Para Coordinar</option>
                                        <option value="En Transito">En Transito</option>
                                        <option value="Entregado">Entregado/Finalizado</option>
                                    </select>
                                </div>

                                <div className="form-group">
                                    <label className="form-label">Medio Proveedor</label>
                                    <select
                                        className="form-select"
                                        value={editedData.associatedCases[selectedCaseIndex].logistics?.method || ''}
                                        onChange={e => setEditedData(prev => {
                                            const newCases = [...prev.associatedCases];
                                            newCases[selectedCaseIndex].logistics = { ...newCases[selectedCaseIndex].logistics, method: e.target.value };
                                            return { ...prev, associatedCases: newCases };
                                        })}
                                    >
                                        <option value="">Seleccionar...</option>
                                        <option value="Andreani">Andreani</option>
                                        <option value="Correo Argentino">Correo Argentino</option>
                                        <option value="Repartidor Propio">Repartidor Propio</option>
                                    </select>
                                </div>

                                {(editedData.associatedCases[selectedCaseIndex].logistics?.method === 'Andreani' ||
                                    editedData.associatedCases[selectedCaseIndex].logistics?.method === 'Correo Argentino') && (
                                        <div className="form-group">
                                            <label className="form-label">Número de Seguimiento</label>
                                            <input
                                                className="form-input"
                                                placeholder="Ej: AR123456789"
                                                value={editedData.associatedCases[selectedCaseIndex].logistics?.trackingNumber || ''}
                                                onChange={e => setEditedData(prev => {
                                                    const newCases = [...prev.associatedCases];
                                                    newCases[selectedCaseIndex].logistics = { ...newCases[selectedCaseIndex].logistics, trackingNumber: e.target.value };
                                                    return { ...prev, associatedCases: newCases };
                                                })}
                                            />
                                        </div>
                                    )}

                                {editedData.associatedCases[selectedCaseIndex].logistics?.method === 'Repartidor Propio' && (
                                    <div className="form-group">
                                        <label className="form-label">Nombre del Repartidor</label>
                                        <select
                                            className="form-select"
                                            value={editedData.associatedCases[selectedCaseIndex].logistics?.deliveryPerson || ''}
                                            onChange={e => setEditedData(prev => {
                                                const newCases = [...prev.associatedCases];
                                                newCases[selectedCaseIndex].logistics = { ...newCases[selectedCaseIndex].logistics, deliveryPerson: e.target.value };
                                                return { ...prev, associatedCases: newCases };
                                            })}
                                        >
                                            <option value="">Seleccionar repartidor...</option>
                                            {users.filter(u => u.role !== 'admin').map(u => (
                                                <option key={u.id} value={u.name}>
                                                    {u.name} {u.role === 'Conductor' ? '(Conductor)' : ''}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                )}

                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                    <div className="form-group">
                                        <label className="form-label">Fecha Programada</label>
                                        <input
                                            type="date"
                                            className="form-input"
                                            value={editedData.associatedCases[selectedCaseIndex].logistics?.deliveryDate || ''}
                                            onChange={e => setEditedData(prev => {
                                                const newCases = [...prev.associatedCases];
                                                newCases[selectedCaseIndex].logistics = { ...newCases[selectedCaseIndex].logistics, deliveryDate: e.target.value };
                                                return { ...prev, associatedCases: newCases };
                                            })}
                                        />
                                    </div>

                                    <div className="form-group">
                                        <label className="form-label">Turno Cita (AM/PM)</label>
                                        <div style={{ display: 'flex', gap: '0.25rem' }}>
                                            {['AM', 'PM'].map(slot => (
                                                <button
                                                    key={slot}
                                                    type="button"
                                                    onClick={() => setEditedData(prev => {
                                                        const newCases = [...prev.associatedCases];
                                                        newCases[selectedCaseIndex].logistics = { ...newCases[selectedCaseIndex].logistics, timeWindow: slot };
                                                        return { ...prev, associatedCases: newCases };
                                                    })}
                                                    style={{
                                                        flex: 1, padding: '0.4rem', borderRadius: '6px', fontSize: '0.8rem', fontWeight: 600,
                                                        border: '1px solid var(--border)', cursor: 'pointer',
                                                        background: editedData.associatedCases[selectedCaseIndex].logistics?.timeWindow === slot ? 'var(--primary-color)' : 'var(--background)',
                                                        color: editedData.associatedCases[selectedCaseIndex].logistics?.timeWindow === slot ? 'white' : 'var(--text-main)',
                                                    }}
                                                >
                                                    {slot}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </Modal>
            
{/* Modal for New Asset */}
            < Modal
                isOpen={isAssetModalOpen}
                onClose={() => setIsAssetModalOpen(false)
                }
                title="Dar de Alta en Inventario"
            >
                <form onSubmit={handleCreateAsset}>
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
                        El serial <strong>{serialQuery}</strong> no existe. Completa los datos para registrarlo.
                    </p>
                    <div className="form-group">
                        <label className="form-label">Modelo / Descripción</label>
                        <input
                            required
                            className="form-input"
                            placeholder="Ej: MacBook Pro 16 M3"
                            value={newAsset.model}
                            onChange={e => setNewAsset({ ...newAsset, model: e.target.value })}
                        />
                    </div>
                    <div className="form-group">
                        <label className="form-label">Tipo de Activo</label>
                        <select
                            className="form-select"
                            value={newAsset.type}
                            onChange={e => setNewAsset({ ...newAsset, type: e.target.value })}
                        >
                            <option value="Laptop">Laptop</option>
                            <option value="Smartphone">Smartphone</option>
                            <option value="Security keys">Security keys</option>
                            <option value="Tablet">Tablet</option>
                        </select>
                    </div>
                    <div className="form-group">
                        <label className="form-label">Estado Inicial</label>
                        <select
                            className="form-select"
                            value={newAsset.status}
                            onChange={e => setNewAsset({ ...newAsset, status: e.target.value })}
                        >
                            <option value="Nuevo">Nuevo</option>
                            <option value="Asignado">Asignado</option>
                            <option value="Recuperado">Recuperado</option>
                            <option value="En Reparación">En Reparación</option>
                            <option value="EOL">EOL</option>
                            <option value="En transito de ingreso">En transito de ingreso</option>
                        </select>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '2rem' }}>
                        <Button type="button" variant="secondary" onClick={() => setIsAssetModalOpen(false)}>Cancelar</Button>
                        <Button type="submit">Registrar y Vincular</Button>
                    </div>
                </form>
            </Modal >
            {/* Verification Modal for Delivery */}
            < Modal
                isOpen={verifyDeliveryModal.isOpen}
                onClose={() => setVerifyDeliveryModal({ isOpen: false, serial: null })}
                title="❗ Revisión Obligatoria antes de Envío"
            >
                <div>
                    <p style={{ marginBottom: '1rem', color: 'var(--text-secondary)' }}>
                        Estás por marcar un dispositivo para <strong>Entrega</strong>. Por favor confirma la siguiente revisión:
                    </p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '2rem' }}>
                        {[
                            '¿Está en buenas condiciones sin roturas?',
                            '¿Está borrado y activo en DEP?',
                            '¿Ha sido etiquetado?',
                            'Si es Windows, ¿fue realizado el proceso de asignación?',
                            '¿Está limpio y sin etiquetas anteriores?'
                        ].map((item, i) => (
                            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                <CheckCircle2 size={18} style={{ color: 'var(--primary-color)' }} />
                                <span style={{ fontSize: '0.9rem' }}>{item}</span>
                            </div>
                        ))}
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
                        <Button variant="secondary" onClick={() => setVerifyDeliveryModal({ isOpen: false, serial: null })}>
                            Cancelar
                        </Button>
                        <Button
                            onClick={() => {
                                const serial = verifyDeliveryModal.serial;
                                const newAssets = editedData.associatedAssets.map(a =>
                                    (typeof a === 'string' ? a : a.serial) === serial
                                        ? { serial, type: 'Entrega' }
                                        : a
                                );
                                setEditedData({ ...editedData, associatedAssets: newAssets });
                                setVerifyDeliveryModal({ isOpen: false, serial: null });
                            }}
                        >
                            Confirmar y Asignar
                        </Button>
                    </div>
                </div>
            </Modal>
            
            {/* Inventory Selector Modal */}
            <Modal
                isOpen={isInventorySelectorOpen}
                onClose={() => {
                    setIsInventorySelectorOpen(false);
                    setInventorySearchQuery('');
                }}
                title="Seleccionar Dispositivo de Inventario"
            >
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <div style={{ position: 'relative' }}>
                        <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
                        <input
                            type="text"
                            placeholder="Buscar por serial, tipo o modelo..."
                            value={inventorySearchQuery}
                            onChange={(e) => setInventorySearchQuery(e.target.value)}
                            style={{
                                width: '100%',
                                padding: '0.6rem 1rem 0.6rem 2.5rem',
                                borderRadius: 'var(--radius-md)',
                                border: '1px solid var(--border)',
                                outline: 'none',
                                fontSize: '0.85rem'
                            }}
                        />
                    </div>
                    
                    <div style={{ maxHeight: '400px', overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
                            <thead style={{ position: 'sticky', top: 0, background: 'var(--background)', zIndex: 10 }}>
                                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                                    <th style={{ padding: '0.75rem 1rem', fontWeight: 600 }}>Tipo / Modelo</th>
                                    <th style={{ padding: '0.75rem 1rem', fontWeight: 600 }}>Serial</th>
                                    <th style={{ padding: '0.75rem 1rem', fontWeight: 600 }}>Estado</th>
                                    <th style={{ padding: '0.75rem 1rem', fontWeight: 600 }}></th>
                                </tr>
                            </thead>
                            <tbody>
                                {assets.filter(a => {
                                    if (a.status !== 'Disponible' && a.status !== 'Nuevo' && a.status !== 'Recuperado') return false;
                                    if (!inventorySearchQuery) return true;
                                    const q = inventorySearchQuery.toLowerCase();
                                    return (
                                        (a.serial && a.serial.toLowerCase().includes(q)) || 
                                        (a.name && a.name.toLowerCase().includes(q)) || 
                                        (a.type && a.type.toLowerCase().includes(q))
                                    );
                                }).length === 0 ? (
                                    <tr>
                                        <td colSpan="4" style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                                            No se encontraron equipos disponibles
                                        </td>
                                    </tr>
                                ) : (
                                    assets.filter(a => {
                                        if (a.status !== 'Disponible' && a.status !== 'Nuevo' && a.status !== 'Recuperado') return false;
                                        if (!inventorySearchQuery) return true;
                                        const q = inventorySearchQuery.toLowerCase();
                                        return (
                                            (a.serial && a.serial.toLowerCase().includes(q)) || 
                                            (a.name && a.name.toLowerCase().includes(q)) || 
                                            (a.type && a.type.toLowerCase().includes(q))
                                        );
                                    }).map(asset => (
                                        <tr key={asset.id} style={{ borderBottom: '1px solid var(--border)', transition: 'background-color 0.2s' }} className="table-row-hover">
                                            <td style={{ padding: '0.75rem 1rem' }}>
                                                <div style={{ fontWeight: 500 }}>{asset.type}</div>
                                                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{asset.name}</div>
                                            </td>
                                            <td style={{ padding: '0.75rem 1rem', color: 'var(--text-secondary)' }}>{asset.serial}</td>
                                            <td style={{ padding: '0.75rem 1rem' }}>
                                                <Badge style={{ 
                                                    backgroundColor: asset.status === 'Nuevo' ? '#dcfce7' : asset.status === 'Disponible' ? '#e0f2fe' : '#fef3c7', 
                                                    color: asset.status === 'Nuevo' ? '#166534' : asset.status === 'Disponible' ? '#075985' : '#92400e' 
                                                }}>
                                                    {asset.status}
                                                </Badge>
                                            </td>
                                            <td style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>
                                                <Button size="sm" onClick={() => {
                                                    setEditedData(prev => {
                                                        if (selectedCaseIndex === null) return prev;
                                                        const newCases = [...(prev.associatedCases || [])];
                                                        const currentCase = newCases[selectedCaseIndex];
                                                        if (!currentCase) return prev;
                                                        const currentAssets = currentCase.assets || [];
                                                        if (!currentAssets.some(a => a.serial === asset.serial)) {
                                                            newCases[selectedCaseIndex] = {
                                                                ...currentCase,
                                                                assets: [...currentAssets, { serial: asset.serial, type: 'Entrega' }]
                                                            };
                                                        }
                                                        return { ...prev, associatedCases: newCases };
                                                    });
                                                    setIsInventorySelectorOpen(false);
                                                    setInventorySearchQuery('');
                                                }}>
                                                    Seleccionar
                                                </Button>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1rem' }}>
                        <Button variant="secondary" onClick={() => setIsInventorySelectorOpen(false)}>Cancelar</Button>
                    </div>
                </div>
            </Modal>
        </div>
    );
}
