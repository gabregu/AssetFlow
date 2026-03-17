'use client';

import React from 'react';
import { Key, Trash2 } from 'lucide-react';
import { Button } from '@/app/components/ui/Button';

export default function YubiKeySection({
    editedData,
    setEditedData,
    selectedCaseIndex,
    yubikeys
}) {
    if (selectedCaseIndex === null) return null;
    
    const currentCase = editedData.associatedCases[selectedCaseIndex];
    const caseYubikeys = currentCase.yubikeys || [];

    const handleAddYubiKey = (serial) => {
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
            return true;
        } else {
            alert('YubiKey no encontrado con ese serial.');
            return false;
        }
    };

    const handleRemoveYubiKey = (idx) => {
        setEditedData(prev => {
            const newCases = [...prev.associatedCases];
            newCases[selectedCaseIndex].yubikeys = (newCases[selectedCaseIndex].yubikeys || []).filter((_, i) => i !== idx);
            return { ...prev, associatedCases: newCases };
        });
    };

    const handleUpdateYubiKeyType = (idx, type) => {
        setEditedData(prev => {
            const newCases = [...prev.associatedCases];
            const newYKs = [...(newCases[selectedCaseIndex].yubikeys || [])];
            newYKs[idx] = { ...newYKs[idx], type };
            newCases[selectedCaseIndex] = { ...newCases[selectedCaseIndex], yubikeys: newYKs };
            return { ...prev, associatedCases: newCases };
        });
    };

    return (
        <div style={{ marginTop: '1.5rem', borderTop: '1px solid var(--border)', paddingTop: '1rem' }}>
            <h4 style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <Key size={14} /> Security Keys (YubiKey)
            </h4>

            {/* YubiKeys asignados al caso */}
            {caseYubikeys.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '0.75rem' }}>
                    {caseYubikeys.map((yk, ykIdx) => {
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
                                        onChange={(e) => handleUpdateYubiKeyType(ykIdx, e.target.value)}
                                    >
                                        <option value="">Selecciona Acción</option>
                                        <option value="Entrega">Entrega</option>
                                        <option value="Recupero">Recupero</option>
                                    </select>
                                </div>
                                <Button variant="ghost" size="sm" onClick={() => handleRemoveYubiKey(ykIdx)} style={{ color: '#ef4444', padding: '4px' }}>
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
                                if (handleAddYubiKey(e.target.value.trim())) {
                                    e.target.value = '';
                                }
                            }
                        }}
                    />
                </div>
                <Button size="sm" onClick={() => {
                    const input = document.getElementById('yubikey-serial-input');
                    if (handleAddYubiKey(input?.value?.trim())) {
                        if (input) input.value = '';
                    }
                }}>Agregar</Button>
            </div>

            {/* Lista disponibles en inventario */}
            {yubikeys.filter(y => y.status === 'disponible' || y.status === 'Disponible' || y.status === 'stock').length > 0 && (
                <div style={{ marginTop: '0.5rem' }}>
                    <p style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>Disponibles en stock:</p>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                        {yubikeys.filter(y => y.status === 'disponible' || y.status === 'Disponible' || y.status === 'stock').map(y => (
                            <button key={y.id} onClick={() => handleAddYubiKey(y.serial)} style={{
                                padding: '3px 8px', fontSize: '0.7rem', borderRadius: '4px',
                                border: '1px solid var(--border)', background: '#f8fafc',
                                cursor: 'pointer', fontWeight: 500,
                                color: caseYubikeys.some(yk => yk.serial === y.serial) ? '#22c55e' : 'var(--text-main)'
                            }}>
                                {caseYubikeys.some(yk => yk.serial === y.serial) ? '✓ ' : ''}{y.serial} ({y.type})
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
