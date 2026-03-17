'use client';

import React from 'react';
import { Package, Monitor } from 'lucide-react';

export default function AccessoriesSection({
    editedData,
    setEditedData,
    selectedCaseIndex
}) {
    if (selectedCaseIndex === null) return null;

    const currentCase = editedData.associatedCases[selectedCaseIndex];
    const accessories = currentCase.accessories || { backpack: false, screenFilter: false, filterSize: '14"' };

    const toggleAccessory = (type) => {
        setEditedData(prev => {
            const newCases = [...prev.associatedCases];
            newCases[selectedCaseIndex].accessories = { 
                ...accessories, 
                [type]: !accessories[type] 
            };
            return { ...prev, associatedCases: newCases };
        });
    };

    const updateFilterSize = (size) => {
        setEditedData(prev => {
            const newCases = [...prev.associatedCases];
            newCases[selectedCaseIndex].accessories = { 
                ...accessories, 
                filterSize: size 
            };
            return { ...prev, associatedCases: newCases };
        });
    };

    return (
        <div style={{ marginTop: '1.5rem', borderTop: '1px solid var(--border)', paddingTop: '1rem' }}>
            <h4 style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.75rem' }}>Accesorios Adicionales (Sin Serial)</h4>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem' }}>
                {/* Backpack */}
                <div
                    onClick={() => toggleAccessory('backpack')}
                    style={{ 
                        display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.5rem', 
                        border: '1px solid var(--border)', borderRadius: '6px', cursor: 'pointer', 
                        background: accessories.backpack ? 'rgba(37, 99, 235, 0.05)' : 'transparent', 
                        borderColor: accessories.backpack ? 'var(--primary-color)' : 'var(--border)' 
                    }}
                >
                    <div style={{ padding: '0.3rem', background: 'rgba(0,0,0,0.05)', borderRadius: '4px' }}><Package size={14} /></div>
                    <span style={{ fontSize: '0.8rem', fontWeight: 600, flex: 1 }}>Mochila</span>
                    <input type="checkbox" checked={!!accessories.backpack} readOnly />
                </div>

                {/* Screen Filter */}
                <div
                    onClick={() => toggleAccessory('screenFilter')}
                    style={{ 
                        display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.5rem', 
                        border: '1px solid var(--border)', borderRadius: '6px', cursor: 'pointer', 
                        background: accessories.screenFilter ? 'rgba(37, 99, 235, 0.05)' : 'transparent', 
                        borderColor: accessories.screenFilter ? 'var(--primary-color)' : 'var(--border)' 
                    }}
                >
                    <div style={{ padding: '0.3rem', background: 'rgba(0,0,0,0.05)', borderRadius: '4px' }}><Monitor size={14} /></div>
                    <div style={{ flex: 1 }}>
                        <span style={{ fontSize: '0.8rem', fontWeight: 600, display: 'block' }}>Filtro de Pantalla</span>
                        {accessories.screenFilter && (
                            <select
                                className="form-select" style={{ fontSize: '0.7rem', padding: '2px', height: '22px', marginTop: '2px', width: '80px' }}
                                value={accessories.filterSize || '14"'}
                                onClick={(e) => e.stopPropagation()}
                                onChange={e => updateFilterSize(e.target.value)}
                            >
                                <option value='13"'>13"</option>
                                <option value='14"'>14"</option>
                                <option value='15"'>15"</option>
                                <option value='16"'>16"</option>
                            </select>
                        )}
                    </div>
                    <input type="checkbox" checked={!!accessories.screenFilter} readOnly />
                </div>
            </div>
        </div>
    );
}
