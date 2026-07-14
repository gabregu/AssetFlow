'use client';

import React, { useState, useMemo } from 'react';
import { Package, Monitor, Smartphone, Keyboard, Headphones, BatteryCharging, Check, QrCode, Search, Trash2, AlertCircle, Key } from 'lucide-react';
import { Button } from '@/app/components/ui/Button';

const getClientBase = (name) => {
    if (!name) return '';
    return name.toLowerCase().trim().replace(/^sfdc-/, '').trim();
};

export default function AccessoriesSection({
    task,
    onUpdateTask,
    consumables = [],
    ticketCountry = 'Argentina',
    updateConsumableStock,
    yubikeys = []
}) {
    const [barcodeInput, setBarcodeInput] = useState('');
    const [selectedConsumableId, setSelectedConsumableId] = useState('');
    const [feedback, setFeedback] = useState({ type: '', message: '' });
    const [showYubiKeyLocal, setShowYubiKeyLocal] = useState(false);
    const [showFilterLocal, setShowFilterLocal] = useState(false);
    const [ykSearchQuery, setYkSearchQuery] = useState('');
    const [filterSearchQuery, setFilterSearchQuery] = useState('');
    const [backpackSearchQuery, setBackpackSearchQuery] = useState('');

    const accessories = task?.accessories || {};
    const caseYubikeys = task?.yubikeys || [];

    const showFeedback = (type, message) => {
        setFeedback({ type, message });
        setTimeout(() => {
            setFeedback({ type: '', message: '' });
        }, 5000);
    };

    // Filter consumables strictly by ticket client to isolate client data
    const localConsumables = useMemo(() => {
        const ticketClient = getClientBase(ticketCountry);
        return consumables.filter(c => {
            const cClient = getClientBase(c.country);
            return cClient === ticketClient;
        });
    }, [consumables, ticketCountry]);

    // Filtros de consumibles específicos
    const backpackConsumables = localConsumables.filter(c => 
        (c.category && c.category.toLowerCase() === 'mochila') ||
        c.name.toLowerCase().includes('mochila') || 
        c.name.toLowerCase().includes('backpack')
    );

    const filterConsumables = localConsumables.filter(c => 
        (c.category && c.category.toLowerCase() === 'filtro') ||
        c.name.toLowerCase().includes('filtro') || 
        c.name.toLowerCase().includes('filter')
    );

    // Identificar qué modelo de mochila o filtro está actualmente asignado en el objeto accessories
    const activeBackpackModel = backpackConsumables.find(c => accessories[c.name] === true);
    const activeFilterModel = filterConsumables.find(c => accessories[c.name] === true);

    const isBackpackActive = !!accessories.backpack;
    const isFilterActive = !!accessories.screenFilter || !!activeFilterModel || showFilterLocal;
    const isYubiKeyActive = caseYubikeys.length > 0 || showYubiKeyLocal;

    // Toggle legacy standard checkboxes
    const handleToggleBackpack = () => {
        const newAccessories = { ...accessories };
        const currentlyActive = !!accessories.backpack;
        const newTypes = { ...(task.accessories_types || {}) };
        
        if (currentlyActive) {
            newAccessories.backpack = false;
            // Desvincular modelo asignado si existía y devolver stock
            backpackConsumables.forEach(c => {
                if (newAccessories[c.name]) {
                    delete newAccessories[c.name];
                    delete newTypes[c.name];
                    if (updateConsumableStock) {
                        updateConsumableStock(c.id, Math.max(0, (c.stock || 0) + 1));
                    }
                }
            });
            showFeedback('success', 'Mochila quitada.');
        } else {
            newAccessories.backpack = true;
            showFeedback('success', 'Mochila agregada. Selecciona un modelo debajo.');
        }
        onUpdateTask({ accessories: newAccessories, accessories_types: newTypes });
    };

    const handleToggleFilter = () => {
        const newAccessories = { ...accessories };
        const currentlyActive = !!accessories.screenFilter || !!activeFilterModel || showFilterLocal;
        const newTypes = { ...(task.accessories_types || {}) };
        
        if (currentlyActive) {
            if (newAccessories.screenFilter) {
                delete newAccessories.screenFilter;
            }
            // Desvincular modelo asignado si existía y devolver stock
            filterConsumables.forEach(c => {
                if (newAccessories[c.name]) {
                    delete newAccessories[c.name];
                    delete newTypes[c.name];
                    if (updateConsumableStock) {
                        updateConsumableStock(c.id, Math.max(0, (c.stock || 0) + 1));
                    }
                }
            });
            setShowFilterLocal(false);
            showFeedback('success', 'Filtros/otros quitado.');
        } else {
            setShowFilterLocal(true);
            showFeedback('success', 'Filtros/otros habilitado. Selecciona un modelo debajo.');
        }
        onUpdateTask({ accessories: newAccessories, accessories_types: newTypes });
    };

    const handleToggleYubiKey = () => {
        const hasYKs = caseYubikeys.length > 0;
        if (hasYKs) {
            if (confirm('¿Estás seguro de que deseas desvincular todas las YubiKeys de este caso?')) {
                onUpdateTask({ yubikeys: [] });
                setShowYubiKeyLocal(false);
                showFeedback('success', 'YubiKeys desvinculadas.');
            }
        } else {
            setShowYubiKeyLocal(!showYubiKeyLocal);
        }
    };

    // Cambiar modelo de mochila y rebalancear stock
    const changeBackpackModel = (newModelId) => {
        const newAccessories = { ...accessories };
        const newTypes = { ...(task.accessories_types || {}) };
        
        // Devolver stock de mochila vieja
        backpackConsumables.forEach(c => {
            if (newAccessories[c.name]) {
                delete newAccessories[c.name];
                delete newTypes[c.name];
                if (updateConsumableStock) {
                    updateConsumableStock(c.id, Math.max(0, (c.stock || 0) + 1));
                }
            }
        });

        if (newModelId) {
            const match = localConsumables.find(c => String(c.id) === String(newModelId));
            if (match) {
                newAccessories[match.name] = true;
                newTypes[match.name] = 'Mochila';
                if (updateConsumableStock) {
                    updateConsumableStock(match.id, Math.max(0, (match.stock || 0) - 1));
                }
                showFeedback('success', `Modelo "${match.name}" seleccionado.`);
            }
        }
        
        onUpdateTask({ accessories: newAccessories, accessories_types: newTypes });
    };

    // Cambiar modelo de filtro y rebalancear stock
    const changeFilterModel = (newModelId) => {
        const newAccessories = { ...accessories };
        const newTypes = { ...(task.accessories_types || {}) };
        
        // Devolver stock de filtro viejo
        filterConsumables.forEach(c => {
            if (newAccessories[c.name]) {
                delete newAccessories[c.name];
                delete newTypes[c.name];
                if (updateConsumableStock) {
                    updateConsumableStock(c.id, Math.max(0, (c.stock || 0) + 1));
                }
            }
        });

        if (newModelId) {
            const match = localConsumables.find(c => String(c.id) === String(newModelId));
            if (match) {
                newAccessories[match.name] = true;
                newTypes[match.name] = 'Filtro';
                if (updateConsumableStock) {
                    updateConsumableStock(match.id, Math.max(0, (match.stock || 0) - 1));
                }
                showFeedback('success', `Filtro "${match.name}" seleccionado.`);
            }
        }
        
        onUpdateTask({ accessories: newAccessories, accessories_types: newTypes });
    };

    const handleFilterBarcode = (barcode) => {
        if (!barcode) return;
        const scannedLower = barcode.trim().toLowerCase();
        const match = filterConsumables.find(c => 
            (c.barcode && c.barcode.trim().toLowerCase() === scannedLower) ||
            (c.cod && c.cod.toLowerCase() === scannedLower)
        );
        if (match) {
            changeFilterModel(match.id);
            setFilterSearchQuery('');
        } else {
            showFeedback('error', `Filtro con código "${barcode}" no encontrado.`);
        }
    };

    const handleBackpackBarcode = (barcode) => {
        if (!barcode) return;
        const scannedLower = barcode.trim().toLowerCase();
        const match = backpackConsumables.find(c => 
            (c.barcode && c.barcode.trim().toLowerCase() === scannedLower) ||
            (c.cod && c.cod.toLowerCase() === scannedLower)
        );
        if (match) {
            changeBackpackModel(match.id);
            setBackpackSearchQuery('');
        } else {
            showFeedback('error', `Mochila con código "${barcode}" no encontrada.`);
        }
    };

    // Agregar YubiKey por serial
    const handleAddYubiKey = async (serial) => {
        if (!serial) return;
        const found = yubikeys.find(y => y.serial?.toLowerCase() === serial.toLowerCase());
        if (found) {
            if (!caseYubikeys.some(y => y.serial === found.serial)) {
                const newYKs = [...caseYubikeys, { serial: found.serial, type: 'Entrega' }];
                await onUpdateTask({ yubikeys: newYKs });
                showFeedback('success', `YubiKey S/N: ${found.serial} vinculada.`);
            } else {
                showFeedback('warning', 'Esta YubiKey ya está vinculada.');
            }
            setYkSearchQuery('');
        } else {
            alert('YubiKey no encontrada en el inventario con ese número de serie.');
        }
    };

    const handleRemoveYubiKey = async (idx) => {
        const newYKs = caseYubikeys.filter((_, i) => i !== idx);
        await onUpdateTask({ yubikeys: newYKs });
        showFeedback('success', 'YubiKey desvinculada.');
    };

    const handleUpdateYubiKeyType = async (idx, type) => {
        const newYKs = [...caseYubikeys];
        newYKs[idx] = { ...newYKs[idx], type };
        await onUpdateTask({ yubikeys: newYKs });
    };

    // Escaneo de código de barras general
    const handleBarcodeSubmit = (e) => {
        e.preventDefault();
        const scannedValue = barcodeInput.trim();
        if (!scannedValue) return;

        const scannedLower = scannedValue.toLowerCase();
        const match = localConsumables.find(c => 
            (c.barcode && c.barcode.trim().toLowerCase() === scannedLower) ||
            (c.id && c.id.toLowerCase() === scannedLower) ||
            (c.cod && c.cod.toLowerCase() === scannedLower) ||
            (c.name && c.name.toLowerCase() === scannedLower)
        );

        if (!match) {
            showFeedback('error', `Código "${scannedValue}" no encontrado en el depósito de ${ticketCountry}.`);
            setBarcodeInput('');
            return;
        }

        if ((match.stock || 0) <= 0) {
            showFeedback('error', `Sin stock disponible para "${match.name}".`);
            setBarcodeInput('');
            return;
        }

        if (accessories[match.name]) {
            showFeedback('warning', `"${match.name}" ya se encuentra agregado.`);
            setBarcodeInput('');
            return;
        }

        const newAccessories = {
            ...accessories,
            [match.name]: true
        };
        onUpdateTask({ accessories: newAccessories });

        if (updateConsumableStock) {
            updateConsumableStock(match.id, Math.max(0, (match.stock || 0) - 1));
        }

        showFeedback('success', `¡"${match.name}" vinculado!`);
        setBarcodeInput('');
    };

    // Agregar accesorio por dropdown general
    const handleAddSelected = () => {
        if (!selectedConsumableId) return;

        const match = localConsumables.find(c => String(c.id) === String(selectedConsumableId));
        if (!match) return;

        if ((match.stock || 0) <= 0) {
            showFeedback('error', `Sin stock disponible para "${match.name}".`);
            return;
        }

        if (accessories[match.name]) {
            showFeedback('warning', `"${match.name}" ya se encuentra agregado.`);
            return;
        }

        const newAccessories = {
            ...accessories,
            [match.name]: true
        };
        onUpdateTask({ accessories: newAccessories });

        if (updateConsumableStock) {
            updateConsumableStock(match.id, Math.max(0, (match.stock || 0) - 1));
        }

        showFeedback('success', `¡"${match.name}" vinculado!`);
        setSelectedConsumableId('');
    };

    const handleRemoveCustomAccessory = (name) => {
        const matchingConsumable = localConsumables.find(c => c.name === name);

        const newAccessories = { ...accessories };
        delete newAccessories[name];
        
        const newTypes = { ...(task?.accessories_types || {}) };
        delete newTypes[name];

        onUpdateTask({ 
            accessories: newAccessories, 
            accessories_types: newTypes 
        });

        if (matchingConsumable && updateConsumableStock) {
            updateConsumableStock(matchingConsumable.id, (matchingConsumable.stock || 0) + 1);
        }

        showFeedback('success', `"${name}" removido.`);
    };

    // Identificar TODOS los consumibles/accesorios vinculados
    const activeCustomAccessories = Object.keys(accessories).filter(key => 
        key !== 'backpack' && 
        key !== 'screenFilter' && 
        key !== 'filterSize' && 
        accessories[key] === true
    );

    // YubiKeys disponibles en stock filtradas estrictamente por cliente
    const availableYubiKeys = useMemo(() => {
        const ticketClient = getClientBase(ticketCountry);
        return yubikeys.filter(y => {
            const statusLower = (y.status || '').toLowerCase().trim();
            const isAvailable = ['disponible', 'stock'].includes(statusLower);
            if (!isAvailable) return false;
            
            const yClient = getClientBase(y.country);
            return yClient === ticketClient;
        });
    }, [yubikeys, ticketCountry]);

    const cardStyle = (isActive) => ({
        flex: 1,
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '0.4rem 0.6rem',
        borderRadius: '6px',
        border: `1px solid ${isActive ? '#7c3aed' : 'var(--border)'}`,
        background: isActive ? 'rgba(124, 58, 237, 0.08)' : 'var(--bg-card)',
        color: isActive ? '#7c3aed' : 'var(--text-main)',
        cursor: 'pointer',
        fontWeight: 500,
        fontSize: '0.75rem',
        transition: 'all 0.15s ease',
        gap: '0.4rem'
    });

    if (!task) return null;

    return (
        <div style={{ marginTop: '1.5rem', borderTop: '1px solid var(--border)', paddingTop: '1.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.25rem' }}>
                <Package size={18} style={{ color: 'var(--primary-color)' }} />
                <h4 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                    Accesorios Rápidos y Consumibles
                </h4>
                <span style={{ fontSize: '0.7rem', padding: '2px 6px', background: 'var(--border)', borderRadius: '4px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                    {ticketCountry}
                </span>
            </div>

            {/* BOTONES INTERACTIVOS DE ACCESORIOS RÁPIDOS */}
            <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.25rem' }}>
                <div style={cardStyle(isYubiKeyActive)} onClick={handleToggleYubiKey}>
                    <div style={{ 
                        width: '12px', 
                        height: '12px', 
                        border: `1px solid ${isYubiKeyActive ? '#7c3aed' : 'var(--border)'}`, 
                        borderRadius: '3px', 
                        background: isYubiKeyActive ? '#7c3aed' : 'white',
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'center',
                        marginRight: '2px'
                    }}>
                        {isYubiKeyActive && <Check size={8} style={{ color: 'white' }} />}
                    </div>
                    <span>🔑 Yubikey</span>
                </div>
                <div style={cardStyle(isFilterActive)} onClick={handleToggleFilter}>
                    <div style={{ 
                        width: '12px', 
                        height: '12px', 
                        border: `1px solid ${isFilterActive ? '#7c3aed' : 'var(--border)'}`, 
                        borderRadius: '3px', 
                        background: isFilterActive ? '#7c3aed' : 'white',
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'center',
                        marginRight: '2px'
                    }}>
                        {isFilterActive && <Check size={8} style={{ color: 'white' }} />}
                    </div>
                    <span>🖥️ Filtros/otros</span>
                </div>
                <div style={cardStyle(isBackpackActive)} onClick={handleToggleBackpack}>
                    <div style={{ 
                        width: '12px', 
                        height: '12px', 
                        border: `1px solid ${isBackpackActive ? '#7c3aed' : 'var(--border)'}`, 
                        borderRadius: '3px', 
                        background: isBackpackActive ? '#7c3aed' : 'white',
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'center',
                        marginRight: '2px'
                    }}>
                        {isBackpackActive && <Check size={8} style={{ color: 'white' }} />}
                    </div>
                    <span>🎒 Mochila</span>
                </div>
            </div>

            {/* SUB-MENUS DINÁMICOS CONDICIONALES */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '1.5rem' }}>
                
                {/* 1. Sub-menu de Yubikeys */}
                {isYubiKeyActive && (
                    <div style={{ padding: '1rem', background: '#f8fafc', border: '1px solid var(--border)', borderRadius: '10px' }}>
                        <h5 style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: '0.5rem' }}>Asignar Security Key (YubiKey)</h5>
                        
                        {caseYubikeys.length > 0 && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', marginBottom: '0.75rem' }}>
                                {caseYubikeys.map((yk, ykIdx) => (
                                    <div key={ykIdx} style={{ display: 'flex', alignItems: 'center', justifyStyle: 'space-between', padding: '0.4rem 0.6rem', background: 'white', border: '1px solid var(--border)', borderRadius: '6px', fontSize: '0.8rem', justifyContent: 'space-between' }}>
                                        <span>🔑 S/N: <strong>{yk.serial}</strong></span>
                                        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                                            <select
                                                className="form-select"
                                                style={{ fontSize: '0.7rem', padding: '1px 4px', height: '22px', width: 'auto' }}
                                                value={yk.type || 'Entrega'}
                                                onChange={(e) => handleUpdateYubiKeyType(ykIdx, e.target.value)}
                                            >
                                                <option value="Entrega">Entrega</option>
                                                <option value="Recupero">Recupero</option>
                                            </select>
                                            <button type="button" onClick={() => handleRemoveYubiKey(ykIdx)} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#ef4444' }}>
                                                <Trash2 size={14} />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                            <div style={{ position: 'relative', flex: 1 }}>
                                <Search size={14} style={{ position: 'absolute', left: '10px', top: '10px', color: 'var(--text-secondary)' }} />
                                <input
                                    className="form-input"
                                    placeholder="Buscar serial de YubiKey..."
                                    style={{ paddingLeft: '2rem', height: '34px', fontSize: '0.8rem' }}
                                    value={ykSearchQuery}
                                    onChange={e => setYkSearchQuery(e.target.value)}
                                    onKeyPress={e => e.key === 'Enter' && handleAddYubiKey(ykSearchQuery.trim())}
                                />
                            </div>
                            <Button size="sm" onClick={() => handleAddYubiKey(ykSearchQuery.trim())}>Vincular</Button>
                        </div>

                        {availableYubiKeys.length > 0 && (
                            <div style={{ marginTop: '0.5rem' }}>
                                <p style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>Disponibles en depósito:</p>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                                    {availableYubiKeys.map(y => (
                                        <button key={y.id} onClick={() => handleAddYubiKey(y.serial)} style={{
                                            padding: '2px 6px', fontSize: '0.65rem', borderRadius: '4px',
                                            border: '1px solid var(--border)', background: 'white', cursor: 'pointer',
                                            color: caseYubikeys.some(yk => yk.serial === y.serial) ? '#22c55e' : 'var(--text-main)'
                                        }}>
                                            {y.serial} ({y.type})
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* 2. Sub-menu de Filtros */}
                {isFilterActive && (
                    <div style={{ padding: '1rem', background: '#f8fafc', border: '1px solid var(--border)', borderRadius: '10px' }}>
                        <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-main)', display: 'block', marginBottom: '0.4rem' }}>
                            Modelo de Filtro de Privacidad
                        </label>
                        <select
                            className="form-select"
                            style={{ height: '36px', fontSize: '0.8rem' }}
                            value={activeFilterModel?.id || ''}
                            onChange={e => changeFilterModel(e.target.value)}
                        >
                            <option value="">— Seleccione Modelo de Filtro —</option>
                            {filterConsumables.map(c => (
                                <option key={c.id} value={c.id} disabled={(c.stock || 0) <= 0 && activeFilterModel?.id !== c.id}>
                                    {c.name} (Disponibles: {c.stock || 0})
                                </option>
                            ))}
                        </select>
                        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginTop: '0.75rem' }}>
                            <div style={{ position: 'relative', flex: 1 }}>
                                <Search size={14} style={{ position: 'absolute', left: '10px', top: '10px', color: 'var(--text-secondary)' }} />
                                <input
                                    className="form-input"
                                    placeholder="Buscar o escanear código..."
                                    style={{ paddingLeft: '2rem', height: '34px', fontSize: '0.8rem', width: '100%' }}
                                    value={filterSearchQuery}
                                    onChange={e => setFilterSearchQuery(e.target.value)}
                                    onKeyPress={e => e.key === 'Enter' && handleFilterBarcode(filterSearchQuery.trim())}
                                />
                            </div>
                            <Button size="sm" onClick={() => handleFilterBarcode(filterSearchQuery.trim())}>Vincular</Button>
                        </div>
                    </div>
                )}

                {/* 3. Sub-menu de Mochilas */}
                {isBackpackActive && (
                    <div style={{ padding: '1rem', background: '#f8fafc', border: '1px solid var(--border)', borderRadius: '10px' }}>
                        <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-main)', display: 'block', marginBottom: '0.4rem' }}>
                            Modelo de Mochila
                        </label>
                        <select
                            className="form-select"
                            style={{ height: '36px', fontSize: '0.8rem' }}
                            value={activeBackpackModel?.id || ''}
                            onChange={e => changeBackpackModel(e.target.value)}
                        >
                            <option value="">— Seleccione Modelo de Mochila —</option>
                            {backpackConsumables.map(c => (
                                <option key={c.id} value={c.id} disabled={(c.stock || 0) <= 0 && activeBackpackModel?.id !== c.id}>
                                    {c.name} (Disponibles: {c.stock || 0})
                                </option>
                            ))}
                        </select>
                        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginTop: '0.75rem' }}>
                            <div style={{ position: 'relative', flex: 1 }}>
                                <Search size={14} style={{ position: 'absolute', left: '10px', top: '10px', color: 'var(--text-secondary)' }} />
                                <input
                                    className="form-input"
                                    placeholder="Buscar o escanear código..."
                                    style={{ paddingLeft: '2rem', height: '34px', fontSize: '0.8rem', width: '100%' }}
                                    value={backpackSearchQuery}
                                    onChange={e => setBackpackSearchQuery(e.target.value)}
                                    onKeyPress={e => e.key === 'Enter' && handleBackpackBarcode(backpackSearchQuery.trim())}
                                />
                            </div>
                            <Button size="sm" onClick={() => handleBackpackBarcode(backpackSearchQuery.trim())}>Vincular</Button>
                        </div>
                    </div>
                )}
            </div>

            {/* BÚSQUEDA GENERAL / ESCANEO (Consumibles adicionales) */}
            <div style={{ background: 'rgba(255, 255, 255, 0.02)', border: '1px dashed var(--border)', borderRadius: '12px', padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '1.5rem' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Otros Accesorios y Consumibles
                </span>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1rem', alignItems: 'end' }} className="grid-mobile-single">
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                        <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Buscar en Inventario</label>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <select
                                className="form-select"
                                value={selectedConsumableId}
                                onChange={e => setSelectedConsumableId(e.target.value)}
                                style={{ fontSize: '0.8rem', height: '36px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg-card)', width: '100%' }}
                            >
                                <option value="">Seleccione accesorio...</option>
                                {localConsumables.map(c => (
                                    <option key={c.id} value={c.id} disabled={(c.stock || 0) <= 0 || !!accessories[c.name]}>
                                        {c.name} (Stock: {c.stock || 0})
                                    </option>
                                ))}
                            </select>
                            <button type="button" className="btn btn-outline" onClick={handleAddSelected} disabled={!selectedConsumableId} style={{ height: '36px', fontSize: '0.75rem', fontWeight: 700, borderRadius: '8px', padding: '0 1rem', background: selectedConsumableId ? 'var(--primary-color)' : 'transparent', color: selectedConsumableId ? '#fff' : 'var(--text-secondary)', border: selectedConsumableId ? 'none' : '1px solid var(--border)', cursor: selectedConsumableId ? 'pointer' : 'not-allowed' }}>Agregar</button>
                        </div>
                    </div>
                </div>

                {feedback.message && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.6rem 0.8rem', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 600, background: feedback.type === 'success' ? 'rgba(16, 185, 129, 0.1)' : feedback.type === 'error' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(245, 158, 11, 0.1)', color: feedback.type === 'success' ? '#10b981' : feedback.type === 'error' ? '#ef4444' : '#f59e0b', border: `1px solid ${feedback.type === 'success' ? 'rgba(16, 185, 129, 0.2)' : feedback.type === 'error' ? 'rgba(239, 68, 68, 0.2)' : 'rgba(245, 158, 11, 0.2)'}` }}>
                        {feedback.type === 'success' ? <Check size={14} /> : <AlertCircle size={14} />}
                        <span>{feedback.message}</span>
                    </div>
                )}
            </div>

            {/* LISTADO GENERAL DE ACCESORIOS ASOCIADOS */}
            {activeCustomAccessories.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)' }}>Accesorios Vinculados</span>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                        {activeCustomAccessories.map(name => (
                            <div key={name} style={{ display: 'flex', alignItems: 'center', justifyStyle: 'space-between', padding: '0.5rem 0.75rem', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)', borderRadius: '8px', justifyContent: 'space-between' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <Package size={14} style={{ color: 'var(--primary-color)' }} />
                                    <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>{name}</span>
                                </div>
                                <button type="button" onClick={() => handleRemoveCustomAccessory(name)} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--text-secondary)', padding: '4px' }}>
                                    <Trash2 size={14} />
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
