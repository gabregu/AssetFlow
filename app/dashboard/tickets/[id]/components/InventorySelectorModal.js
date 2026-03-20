'use client';

import React from 'react';
import { Search } from 'lucide-react';
import { Modal } from '@/app/components/ui/Modal';
import { Button } from '@/app/components/ui/Button';
import { Badge } from '@/app/components/ui/Badge';

export default function InventorySelectorModal({
    isOpen,
    onClose,
    inventorySearchQuery,
    setInventorySearchQuery,
    assets,
    selectedCaseIndex,
    setEditedData
}) {
    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
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
                                                        const updatedAssets = [...currentAssets, { serial: asset.serial, type: 'Entrega' }];
                                                        
                                                        // Automación: Si agregamos hardware, el estado pasa a "Para Coordinar" si estaba Pendiente
                                                        let updatedLogistics = currentCase.logistics || { status: 'Pendiente', method: '', date: '', timeSlot: 'AM' };
                                                        if (updatedLogistics.status === 'Pendiente') {
                                                            updatedLogistics = {
                                                                ...updatedLogistics,
                                                                status: 'Para Coordinar',
                                                                lastUpdated: new Date().toISOString()
                                                            };
                                                        }

                                                        newCases[selectedCaseIndex] = {
                                                            ...currentCase,
                                                            assets: updatedAssets,
                                                            logistics: updatedLogistics
                                                        };
                                                    }
                                                    return { ...prev, associatedCases: newCases };
                                                });
                                                onClose();
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
                    <Button variant="secondary" onClick={onClose}>Cancelar</Button>
                </div>
            </div>
        </Modal>
    );
}
