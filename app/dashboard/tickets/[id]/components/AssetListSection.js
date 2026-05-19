'use client';

import React from 'react';
import { Search, Package, Trash2 } from 'lucide-react';
import { Button } from '@/app/components/ui/Button';

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
    allTasks = []
}) {
    if (!task) return null;

    const caseAssets = task.assets || [];

    const handleUnlink = async (idx) => {
        const item = caseAssets[idx];
        const newAssets = caseAssets.filter((_, i) => i !== idx);
        
        try {
            await onUpdateTask({ assets: newAssets });
            
            // Si tenemos el asset en local, desvincularlo también en la tabla Assets
            const fullAsset = assets.find(a => a.serial === item.serial);
            if (fullAsset && updateAsset) {
                await updateAsset(fullAsset.id, {
                    status: 'Disponible',
                    assignee: 'Almacén',
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
        if (!caseAssets.some(a => a.serial === serial)) {
            const newAssets = [...caseAssets, { serial: serial, type: '' }];
            const updates = { assets: newAssets };
            
            // Automación: Si agregamos hardware, el estado pasa a "Para Coordinar" si estaba Pendiente
            if (task.status === 'Pendiente') {
                updates.status = 'Para Coordinar';
            }
            
            try {
                await onUpdateTask(updates);

                // Actualizar el activo en la tabla de inventario
                const fullAsset = assets.find(a => a.serial.toLowerCase() === serial.toLowerCase());
                if (fullAsset && updateAsset) {
                    const parentTicketId = task.ticket_id;
                    const assignee = task.subject?.toLowerCase().includes('recupero') ? 'Almacén' : (currentUser?.name || 'Usuario Final');
                    
                    await updateAsset(fullAsset.id, {
                        status: 'Asignado',
                        assignee: assignee,
                        sfdcCase: parentTicketId,
                        notes: (fullAsset.notes ? fullAsset.notes + '\n' : '') + 
                               `[${new Date().toLocaleDateString()}] Vinculado a Caso #${task.case_number || task.id} vía Ticket #${parentTicketId || 'N/A'}`
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
                        // Soporte para formato legacy (string) y nuevo (objeto)
                        const itemSerial = typeof item === 'string' ? item : item.serial;
                        const assetInfo = assets.find(a => a.serial === itemSerial);
                        
                        return (
                            <div key={`${idxx}-${itemSerial}`} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.5rem', background: 'rgba(0,0,0,0.02)', borderRadius: '6px', border: '1px solid var(--border)' }}>
                                <div>
                                    <p style={{ fontWeight: 600, fontSize: '0.85rem', margin: 0 }}>{assetInfo?.name || 'Hardware'} (S/N: {itemSerial})</p>
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
                                            {allTasks.map((t, tIdx) => {
                                                const caseNum = t.caseNumber || t.case_number;
                                                // Excluir el caso actual si es posible
                                                if (caseNum && caseNum !== (task.caseNumber || task.case_number)) {
                                                    return <option key={tIdx} value={caseNum}>{t.subject || ''}</option>;
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

            {assetSearchResult && assetSearchResult !== 'not_found' && (
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
