'use client';

import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Search, Package, Trash2, QrCode, Check } from 'lucide-react';
import { Button } from '@/app/components/ui/Button';
import { CopyButton } from '@/app/components/ui/CopyButton';

const getClientBase = (name) => {
    if (!name) return '';
    return name.toLowerCase().trim().replace(/^sfdc-/, '').trim();
};

export default function AssetListSection({
    task,
    onUpdateTask,
    assets,
    serialQuery,
    setSerialQuery,
    handleAssetSearch,
    setIsInventorySelectorOpen,
    assetSearchResult,
    setAssetSearchResult,
    setIsAssetModalOpen,
    updateAsset,
    currentUser,
    allTasks = [],
    associatedCases = []
}) {
    const [activeAssetType, setActiveAssetType] = useState(''); // 'Laptop' or 'Celular'
    const [selectedModel, setSelectedModel] = useState('');
    const [selectedSerial, setSelectedSerial] = useState('');

    const caseAssets = task?.assets || [];
    const ticketCountry = task?.country || 'Argentina';

    // Auto-sincronizar activos vinculados en inventario a la tarea
    const lastSyncedCaseRef = useRef(null);
    useEffect(() => {
        if (!task || !task.caseNumber) return;
        
        // Skip auto-sync for tasks that live in the DB (have a real UUID id).
        // Those tasks are managed via handleUpdateTask and the local draft.
        // Running this sync would overwrite the buffered draft with stale data.
        if (task.id) return;
        
        const caseKey = `${task.id || task.caseNumber}`;
        if (lastSyncedCaseRef.current === caseKey) return;
        
        const caseSerials = caseAssets.map(item => (typeof item === 'string' ? item : item.serial || '').toLowerCase());
        
        const dbLinkedAssets = assets.filter(a => 
            a.sfdcCase && 
            String(a.sfdcCase).toLowerCase() === String(task.caseNumber).toLowerCase()
        );
        
        const missingAssets = dbLinkedAssets.filter(dbAsset => 
            dbAsset.serial && !caseSerials.includes(dbAsset.serial.toLowerCase())
        );
        
        if (missingAssets.length > 0) {
            lastSyncedCaseRef.current = caseKey;
            const assetsToAdd = missingAssets.map(dbAsset => ({
                serial: dbAsset.serial,
                type: 'Entrega',
                hardware_type: dbAsset.type || ''
            }));
            
            const updatedAssets = [...caseAssets, ...assetsToAdd];
            onUpdateTask({ assets: updatedAssets });
        }
    }, [task, assets, caseAssets, onUpdateTask]);

    // 1. Filtrar activos disponibles del cliente estricto
    const availableAssetsStrict = useMemo(() => {
        const ticketClient = getClientBase(ticketCountry);
        return assets.filter(a => {
            const statusLower = (a.status || '').toLowerCase().trim();
            const isAvailable = ['disponible', 'nuevo', 'recuperado', 'stock'].includes(statusLower);
            if (!isAvailable) return false;
            
            const assetClient = getClientBase(a.country);
            return assetClient === ticketClient;
        });
    }, [assets, ticketCountry]);

    // 2. Filtrar por Tipo de Dispositivo (Laptop o Celular)
    const filteredAssets = useMemo(() => {
        if (!activeAssetType) return [];
        return availableAssetsStrict.filter(a => {
            const typeLower = (a.type || '').toLowerCase().trim();
            if (activeAssetType === 'Laptop') {
                return typeLower === 'laptop';
            } else {
                return typeLower === 'smartphone' || typeLower === 'celular' || typeLower === 'phone';
            }
        });
    }, [availableAssetsStrict, activeAssetType]);

    // Extraer modelos únicos con stock disponible
    const availableModels = useMemo(() => {
        const modelsMap = {};
        filteredAssets.forEach(a => {
            if (!a.name) return;
            if (!modelsMap[a.name]) {
                modelsMap[a.name] = {
                    name: a.name,
                    count: 0,
                    serials: []
                };
            }
            modelsMap[a.name].count++;
            if (a.serial) {
                modelsMap[a.name].serials.push({
                    serial: a.serial,
                    status: a.status || 'Disponible'
                });
            }
        });
        return Object.values(modelsMap).sort((a, b) => a.name.localeCompare(b.name));
    }, [filteredAssets]);

    const handleUnlink = async (idx) => {
        const item = caseAssets[idx];
        const newAssets = caseAssets.filter((_, i) => i !== idx);
        
        try {
            await onUpdateTask({ assets: newAssets });
            
            // Si tenemos el asset en local, desvincularlo también en la tabla Assets
            const itemSerial = typeof item === 'string' ? item : item.serial;
            const fullAsset = assets.find(a => a.serial && itemSerial && a.serial.toLowerCase() === itemSerial.toLowerCase());
            if (fullAsset && updateAsset) {
                await updateAsset(fullAsset.id, {
                    status: 'Disponible',
                    assignee: 'Almacén',
                    sfdcCase: null,
                    notes: (fullAsset.notes ? fullAsset.notes + '\n' : '') + 
                           `[${new Date().toLocaleDateString()}] Desvinculado de Ticket #${task.ticket_id || 'N/A'}. Regresa a Almacén.`
                });
            }
        } catch (err) {
            console.error("Unlink error:", err);
            alert("Error al desvincular el equipo.");
        }
    };

    const handleUpdateType = async (idx, type) => {
        const newAssets = [...caseAssets];
        newAssets[idx] = { ...newAssets[idx], type };
        await onUpdateTask({ assets: newAssets });
    };

    const handleUpdateHardwareType = async (idx, hardware_type) => {
        const newAssets = [...caseAssets];
        newAssets[idx] = { ...newAssets[idx], hardware_type };
        await onUpdateTask({ assets: newAssets });
    };

    const handleLinkToCase = async (serial) => {
        const alreadyLinked = caseAssets.some(a => {
            const s = typeof a === 'string' ? a : a.serial;
            return s && s.toLowerCase() === serial.toLowerCase();
        });

        if (!alreadyLinked) {
            const newAssets = [...caseAssets, { serial: serial, type: 'Entrega' }];
            const updates = { assets: newAssets };
            
            // Automación: Si agregamos hardware, el estado pasa a "En Preparación"
            if (task.status === 'Pendiente' || !task.status) {
                updates.status = 'En Preparación';
            }
            
            try {
                await onUpdateTask(updates);

                // Actualizar el activo en la tabla de inventario
                const fullAsset = assets.find(a => a.serial && a.serial.toLowerCase() === serial.toLowerCase());
                if (fullAsset && updateAsset) {
                    const parentTicketId = task.ticket_id;
                    const taskCaseNumber = task.case_number || task.caseNumber;
                    const targetSfdcCase = taskCaseNumber || parentTicketId;
                    
                    // Automación para detectar destinatario (Almacén para recolecciones/retitros, etc.)
                    const subjectNormalized = (task.subject || '').toLowerCase();
                    const isCollection = subjectNormalized.includes('recupero') || 
                                         subjectNormalized.includes('collection') || 
                                         subjectNormalized.includes('recoleccion') || 
                                         subjectNormalized.includes('retiro');
                    const assignee = isCollection ? 'Almacén' : (currentUser?.name || 'Usuario Final');
                    
                    await updateAsset(fullAsset.id, {
                        status: 'Asignado',
                        assignee: assignee,
                        sfdcCase: targetSfdcCase,
                        notes: (fullAsset.notes ? fullAsset.notes + '\n' : '') + 
                               `[${new Date().toLocaleDateString()}] Vinculado a Caso #${taskCaseNumber || task.id} vía Ticket #${parentTicketId || 'N/A'}`
                    });
                }
            } catch (err) {
                console.error("Link error:", err);
                alert("Error al vincular el equipo al caso.");
            }
        }
        setAssetSearchResult(null);
        setSerialQuery('');
    };

    if (!task) return null;

    return (
        <div>
            <h4 style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--primary-color)', marginBottom: '1rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.5rem' }}>
                Equipamiento (Hardware Asignado)
            </h4>

            {/* Asset List */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1rem' }}>
                {caseAssets.length === 0 ? (
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>No hay equipos asignados a este caso.</p>
                ) : (
                    caseAssets.map((item, idxx) => {
                        const itemSerial = typeof item === 'string' ? item : item.serial;
                        const assetInfo = assets.find(a => a.serial && itemSerial && a.serial.toLowerCase() === itemSerial.toLowerCase());
                        
                        return (
                            <div key={`${idxx}-${itemSerial}`} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.5rem', background: 'rgba(0,0,0,0.02)', borderRadius: '6px', border: '1px solid var(--border)' }}>
                                <div>
                                    <p style={{ fontWeight: 600, fontSize: '0.85rem', margin: 0, display: 'flex', alignItems: 'center', gap: '4px' }}>
                                        <span>{assetInfo?.name || 'Hardware'} (S/N: {itemSerial})</span>
                                        {itemSerial && <CopyButton text={itemSerial} iconSize={11} />}
                                    </p>
                                    <div style={{ display: 'flex', gap: '0.5rem', marginTop: '4px' }}>
                                        <select
                                            className="form-select"
                                            style={{ fontSize: '0.75rem', padding: '2px 6px', height: '26px', width: 'auto' }}
                                            value={item.type || ''}
                                            onChange={(e) => handleUpdateType(idxx, e.target.value)}
                                        >
                                            <option value="">Acción</option>
                                            <option value="Entrega">Entrega</option>
                                            <option value="Recupero">Recupero</option>
                                        </select>
                                        <select
                                            className="form-select"
                                            style={{ fontSize: '0.75rem', padding: '2px 6px', height: '26px', width: 'auto' }}
                                            value={item.hardware_type || assetInfo?.type || ''}
                                            onChange={(e) => handleUpdateHardwareType(idxx, e.target.value)}
                                        >
                                            <option value="">Tipo Activo (Auto)</option>
                                            <option value="Laptop">Laptop</option>
                                            <option value="Smartphone">Smartphone</option>
                                            <option value="Tablet">Tablet</option>
                                            <option value="Security Key">Security Key</option>
                                        </select>
                                    </div>
                                    <div style={{ marginTop: '4px' }}>
                                        <input
                                            type="text"
                                            list={`related-cases-list-${idxx}`}
                                            className="form-input"
                                            placeholder="N° Caso Relacionado (Opcional)"
                                            style={{ fontSize: '0.75rem', padding: '2px 6px', height: '26px', width: '100%', maxWidth: '200px' }}
                                            value={item.related_case || ''}
                                            onChange={async (e) => {
                                                const newAssets = [...caseAssets];
                                                newAssets[idxx] = { ...newAssets[idxx], related_case: e.target.value };
                                                await onUpdateTask({ assets: newAssets });
                                            }}
                                        />
                                        <datalist id={`related-cases-list-${idxx}`}>
                                            {(associatedCases || []).map((ac, acIdx) => {
                                                const caseNum = ac.caseNumber;
                                                if (caseNum && caseNum !== 'Caso Principal') {
                                                    return (
                                                        <option key={`auto-${acIdx}`} value={caseNum}>
                                                            {ac.subject || 'Caso Asociado'}
                                                        </option>
                                                    );
                                                }
                                                return null;
                                            })}
                                            {allTasks.map((t, tIdx) => {
                                                const caseNum = t.caseNumber || t.case_number;
                                                if (caseNum && caseNum !== (task.caseNumber || task.case_number)) {
                                                    const alreadyListed = (associatedCases || []).some(ac => ac.caseNumber === caseNum);
                                                    if (!alreadyListed) {
                                                        return <option key={`task-${tIdx}`} value={caseNum}>{t.subject || ''}</option>;
                                                    }
                                                }
                                                return null;
                                            })}
                                        </datalist>
                                    </div>
                                </div>
                                <Button 
                                    variant="ghost" 
                                    size="sm" 
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleUnlink(idxx);
                                    }} 
                                    style={{ color: '#ef4444', padding: '4px', cursor: 'pointer' }}
                                >
                                    <Trash2 size={16} />
                                </Button>
                            </div>
                        );
                    })
                )}
            </div>

            {/* MODEL-FIRST SELECTOR */}
            <div style={{ 
                background: '#f8fafc', 
                border: '1px solid var(--border)', 
                borderRadius: '10px', 
                padding: '1rem', 
                display: 'flex', 
                flexDirection: 'column', 
                gap: '0.75rem',
                marginBottom: '1.25rem'
            }}>
                {/* Paso 1: Selección de Tipo de Dispositivo */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                    <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                        Paso 1: Seleccione Tipo de Hardware
                    </label>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button
                            type="button"
                            onClick={() => {
                                setActiveAssetType('Laptop');
                                setSelectedModel('');
                                setSelectedSerial('');
                            }}
                            style={{
                                flex: 1,
                                display: 'flex',
                                flexDirection: 'row',
                                alignItems: 'center',
                                justifyContent: 'center',
                                padding: '0.4rem 0.6rem',
                                borderRadius: '6px',
                                border: `1px solid ${activeAssetType === 'Laptop' ? 'var(--primary-color)' : 'var(--border)'}`,
                                background: activeAssetType === 'Laptop' ? 'rgba(37, 99, 235, 0.08)' : 'white',
                                color: activeAssetType === 'Laptop' ? 'var(--primary-color)' : 'var(--text-main)',
                                fontWeight: 500,
                                fontSize: '0.75rem',
                                cursor: 'pointer',
                                transition: 'all 0.15s ease',
                                gap: '0.4rem'
                            }}
                        >
                            <div style={{ 
                                width: '12px', 
                                height: '12px', 
                                border: `1px solid ${activeAssetType === 'Laptop' ? 'var(--primary-color)' : 'var(--border)'}`, 
                                borderRadius: '3px', 
                                background: activeAssetType === 'Laptop' ? 'var(--primary-color)' : 'white',
                                display: 'flex', 
                                alignItems: 'center', 
                                justifyContent: 'center',
                                marginRight: '2px'
                            }}>
                                {activeAssetType === 'Laptop' && <Check size={8} style={{ color: 'white' }} />}
                            </div>
                            <span>💻 Laptop</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => {
                                setActiveAssetType('Celular');
                                setSelectedModel('');
                                setSelectedSerial('');
                            }}
                            style={{
                                flex: 1,
                                display: 'flex',
                                flexDirection: 'row',
                                alignItems: 'center',
                                justifyContent: 'center',
                                padding: '0.4rem 0.6rem',
                                borderRadius: '6px',
                                border: `1px solid ${activeAssetType === 'Celular' ? 'var(--primary-color)' : 'var(--border)'}`,
                                background: activeAssetType === 'Celular' ? 'rgba(37, 99, 235, 0.08)' : 'white',
                                color: activeAssetType === 'Celular' ? 'var(--primary-color)' : 'var(--text-main)',
                                fontWeight: 500,
                                fontSize: '0.75rem',
                                cursor: 'pointer',
                                transition: 'all 0.15s ease',
                                gap: '0.4rem'
                            }}
                        >
                            <div style={{ 
                                width: '12px', 
                                height: '12px', 
                                border: `1px solid ${activeAssetType === 'Celular' ? 'var(--primary-color)' : 'var(--border)'}`, 
                                borderRadius: '3px', 
                                background: activeAssetType === 'Celular' ? 'var(--primary-color)' : 'white',
                                display: 'flex', 
                                alignItems: 'center', 
                                justifyContent: 'center',
                                marginRight: '2px'
                            }}>
                                {activeAssetType === 'Celular' && <Check size={8} style={{ color: 'white' }} />}
                            </div>
                            <span>📱 Celular</span>
                        </button>
                    </div>
                </div>

                {/* Paso 2: Selección de Modelo (sólo visible si se seleccionó tipo) */}
                {activeAssetType && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', marginTop: '0.25rem' }}>
                        <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-main)' }}>
                            Paso 2: Modelo de {activeAssetType}
                        </label>
                        <select
                            className="form-select"
                            style={{ height: '36px', fontSize: '0.85rem' }}
                            value={selectedModel}
                            onChange={e => {
                                setSelectedModel(e.target.value);
                                setSelectedSerial('');
                            }}
                        >
                            <option value="">— Seleccionar Modelo —</option>
                            {availableModels.map(m => (
                                <option key={m.name} value={m.name}>
                                    {m.name} ({m.count} disp.)
                                </option>
                            ))}
                        </select>
                    </div>
                )}

                {/* Paso 3: Selección de Serie */}
                {selectedModel && (
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'end', marginTop: '0.25rem' }}>
                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                            <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                                Paso 3: Número de Serie
                            </label>
                            <select
                                className="form-select"
                                style={{ height: '36px', fontSize: '0.85rem' }}
                                value={selectedSerial}
                                onChange={e => setSelectedSerial(e.target.value)}
                            >
                                <option value="">— Elegir Serie —</option>
                                {availableModels.find(m => m.name === selectedModel)?.serials.map(sObj => (
                                    <option key={sObj.serial} value={sObj.serial}>
                                        {sObj.serial} ({sObj.status})
                                    </option>
                                ))}
                            </select>
                        </div>
                        <Button 
                            size="sm" 
                            disabled={!selectedSerial} 
                            style={{ height: '36px', whiteSpace: 'nowrap' }}
                            onClick={async () => {
                                await handleLinkToCase(selectedSerial);
                                setSelectedModel('');
                                setSelectedSerial('');
                                setActiveAssetType('');
                            }}
                        >
                            Asignar
                        </Button>
                    </div>
                )}
            </div>

            {/* MANUAL OR BARCODE SEARCH BAR */}
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginBottom: '1rem' }}>
                <div style={{ position: 'relative', flex: 1 }}>
                    <Search size={14} style={{ position: 'absolute', left: '10px', top: '10px', color: 'var(--text-secondary)' }} />
                    <input
                        className="form-input"
                        placeholder="O buscar/escanear serial manualmente..."
                        style={{ paddingLeft: '2rem', height: '34px', fontSize: '0.85rem' }}
                        value={serialQuery}
                        onChange={e => setSerialQuery(e.target.value)}
                        onKeyPress={e => e.key === 'Enter' && handleAssetSearch()}
                    />
                </div>
                <Button size="sm" onClick={handleAssetSearch}>Buscar</Button>
            </div>



            {/* ERROR AND RESULTS FEEDBACK */}
            {assetSearchResult === 'not_found' && (
                <div style={{ marginTop: '0.5rem', padding: '0.5rem', border: '1px dashed #ef4444', borderRadius: '6px' }}>
                    <p style={{ color: '#ef4444', fontSize: '0.8rem', margin: '0 0 0.5rem 0' }}>Serial no encontrado en Inventario.</p>
                    <Button size="sm" variant="secondary" onClick={() => setIsAssetModalOpen(true)}>Dar de Alta Manual</Button>
                </div>
            )}
            
            {assetSearchResult && assetSearchResult.status === 'wrong_region' && (
                <div style={{ marginTop: '0.5rem', padding: '0.8rem', border: '1px dashed #f59e0b', borderRadius: '8px', background: '#fffbeb' }}>
                    <p style={{ color: '#b45309', fontSize: '0.85rem', margin: '0', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span>⚠️</span> 
                        <span>
                            El equipo <strong>{assetSearchResult.serial}</strong> pertenece a la región <strong>{assetSearchResult.region}</strong>. 
                            Solo puedes vincular equipos de la región actual.
                        </span>
                    </p>
                </div>
            )}

            {assetSearchResult && assetSearchResult !== 'not_found' && assetSearchResult.status !== 'wrong_region' && (
                <div style={{ marginTop: '0.5rem', padding: '0.5rem', background: '#f8fafc', border: '1px solid var(--border)', borderRadius: '6px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                        <p style={{ fontWeight: 600, fontSize: '0.8rem', margin: 0 }}>{assetSearchResult.name}</p>
                        <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', margin: 0 }}>{assetSearchResult.type} • {assetSearchResult.status}</p>
                    </div>
                    <Button size="sm" variant="outline" onClick={() => handleLinkToCase(assetSearchResult.serial)}>Vincular al Caso</Button>
                </div>
            )}
        </div>
    );
}
