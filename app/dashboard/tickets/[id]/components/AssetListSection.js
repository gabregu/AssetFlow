'use client';

import React from 'react';
import { Search, Package, Trash2 } from 'lucide-react';
import { Button } from '@/app/components/ui/Button';

export default function AssetListSection({
    editedData,
    setEditedData,
    selectedCaseIndex,
    assets,
    serialQuery,
    setSerialQuery,
    handleAssetSearch,
    setIsInventorySelectorOpen,
    assetSearchResult,
    setAssetSearchResult,
    setIsAssetModalOpen
}) {
    if (selectedCaseIndex === null) return null;

    const currentCase = editedData.associatedCases[selectedCaseIndex];
    const caseAssets = currentCase.assets || [];

    const handleUnlink = (idx) => {
        setEditedData(prev => {
            const newCases = [...prev.associatedCases];
            newCases[selectedCaseIndex].assets = newCases[selectedCaseIndex].assets.filter((_, i) => i !== idx);
            return { ...prev, associatedCases: newCases };
        });
    };

    const handleUpdateType = (idx, type) => {
        setEditedData(prev => {
            const newCases = [...prev.associatedCases];
            const newAssets = [...newCases[selectedCaseIndex].assets];
            newAssets[idx] = { ...newAssets[idx], type };
            newCases[selectedCaseIndex] = { ...newCases[selectedCaseIndex], assets: newAssets };
            return { ...prev, associatedCases: newCases };
        });
    };

    const handleLinkToCase = (serial) => {
        setEditedData(prev => {
            const newCases = [...prev.associatedCases];
            const currentAssets = newCases[selectedCaseIndex].assets || [];
            if (!currentAssets.some(a => a.serial === serial)) {
                newCases[selectedCaseIndex].assets = [...currentAssets, { serial: serial, type: '' }];
                
                // Automación: Si agregamos hardware, el estado pasa a "Para Coordinar" si estaba Pendiente
                const currentStatus = newCases[selectedCaseIndex].logistics?.status || 'Pendiente';
                if (currentStatus === 'Pendiente') {
                    newCases[selectedCaseIndex].logistics = {
                        ...(newCases[selectedCaseIndex].logistics || {}),
                        status: 'Para Coordinar',
                        lastUpdated: new Date().toISOString()
                    };
                }
            }
            return { ...prev, associatedCases: newCases };
        });
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
                        const assetInfo = assets.find(a => a.serial === item.serial);
                        return (
                            <div key={idxx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.5rem', background: 'rgba(0,0,0,0.02)', borderRadius: '6px', border: '1px solid var(--border)' }}>
                                <div>
                                    <p style={{ fontWeight: 600, fontSize: '0.85rem', margin: 0 }}>{assetInfo?.name || 'Hardware'} (S/N: {item.serial})</p>
                                    <select
                                        className="form-select"
                                        style={{ fontSize: '0.75rem', padding: '2px 6px', height: '26px', marginTop: '4px', width: 'auto' }}
                                        value={item.type || ''}
                                        onChange={(e) => handleUpdateType(idxx, e.target.value)}
                                    >
                                        <option value="">Selecciona Acción</option>
                                        <option value="Entrega">Entrega</option>
                                        <option value="Recupero">Recupero</option>
                                    </select>
                                </div>
                                <Button variant="ghost" size="sm" onClick={() => handleUnlink(idxx)} style={{ color: '#ef4444', padding: '4px' }}>
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
                    <Button size="sm" variant="outline" onClick={() => handleLinkToCase(assetSearchResult.serial)}>Vincular al Caso</Button>
                </div>
            )}
        </div>
    );
}
