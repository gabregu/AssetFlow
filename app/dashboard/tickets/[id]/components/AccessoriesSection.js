'use client';

import React, { useState } from 'react';
import { Package, Monitor, Smartphone, Keyboard, Headphones, BatteryCharging, Check, QrCode, Search, Trash2, AlertCircle, Mouse } from 'lucide-react';

export default function AccessoriesSection({
    task,
    onUpdateTask,
    consumables = [],
    ticketCountry = 'Argentina',
    updateConsumableStock
}) {
    const [barcodeInput, setBarcodeInput] = useState('');
    const [selectedConsumableId, setSelectedConsumableId] = useState('');
    const [feedback, setFeedback] = useState({ type: '', message: '' });

    if (!task) return null;

    const accessories = task.accessories || {};

    const showFeedback = (type, message) => {
        setFeedback({ type, message });
        setTimeout(() => {
            setFeedback({ type: '', message: '' });
        }, 5000);
    };

    // Toggle legacy standard checkboxes
    const toggleAccessory = (type, label) => {
        const isCurrentlyActive = !!accessories[type];
        
        // Find if there's a corresponding consumable in inventory to keep stock in sync
        const matchingConsumable = consumables.find(c => 
            c.country === ticketCountry && 
            c.name.toLowerCase().includes(label.toLowerCase())
        );

        const newAccessories = { 
            ...accessories, 
            [type]: !isCurrentlyActive
        };
        
        onUpdateTask({ accessories: newAccessories });

        // Update stock if matching consumable is found
        if (matchingConsumable && updateConsumableStock) {
            const stockChange = isCurrentlyActive ? 1 : -1;
            const targetStock = Math.max(0, (matchingConsumable.stock || 0) + stockChange);
            updateConsumableStock(matchingConsumable.id, targetStock);
            
            const actionText = isCurrentlyActive ? 'devuelto 1 unidad de' : 'descontado 1 unidad de';
            const locationText = isCurrentlyActive ? 'al' : 'del';
            window.alert(`MOVIMIENTO DE INVENTARIO\n\nSe ha ${actionText} "${matchingConsumable.name}" ${locationText} stock general.\n\nQuedan disponibles: ${targetStock} unidades.`);
        }

        showFeedback('success', `${label} ${!isCurrentlyActive ? 'agregado' : 'quitado'} correctamente.`);
    };

    const updateFilterSize = (size) => {
        const newAccessories = { 
            ...accessories, 
            filterSize: size 
        };
        onUpdateTask({ accessories: newAccessories });
    };

    // Filter consumables by ticket country to isolate client data
    const safeTicketCountry = (ticketCountry || 'Argentina').trim().toLowerCase();
    const localConsumables = consumables.filter(c => {
        const cCountry = (c.country || 'Argentina').trim().toLowerCase();
        return cCountry === safeTicketCountry;
    });

    // Handle adding custom accessory via barcode scanning
    const handleBarcodeSubmit = (e) => {
        e.preventDefault();
        const scannedValue = barcodeInput.trim();
        if (!scannedValue) return;

        // Search in consumables list for matching barcode (case-insensitive) or ID
        const scannedLower = scannedValue.toLowerCase();
        const match = localConsumables.find(c => 
            (c.barcode && c.barcode.trim().toLowerCase() === scannedLower) ||
            (c.id && c.id.toLowerCase() === scannedLower) ||
            (c.cod && c.cod.toLowerCase() === scannedLower) ||
            (c.name && c.name.toLowerCase() === scannedLower)
        );

        if (!match) {
            showFeedback('error', `Código de barra "${scannedValue}" no encontrado en el inventario de ${ticketCountry}.`);
            setBarcodeInput('');
            return;
        }

        // Check if stock is available
        if ((match.stock || 0) <= 0) {
            showFeedback('error', `Sin stock disponible para "${match.name}". (Stock: 0)`);
            setBarcodeInput('');
            return;
        }

        // Check if already added
        if (accessories[match.name]) {
            showFeedback('warning', `"${match.name}" ya se encuentra agregado a este servicio.`);
            setBarcodeInput('');
            return;
        }

        // Add to task accessories
        const newAccessories = {
            ...accessories,
            [match.name]: true
        };
        onUpdateTask({ accessories: newAccessories });

        // Update database stock
        if (updateConsumableStock) {
            const remainingStock = Math.max(0, (match.stock || 0) - 1);
            updateConsumableStock(match.id, remainingStock);
            window.alert(`MOVIMIENTO DE INVENTARIO\n\nSe ha descontado 1 unidad de "${match.name}" del stock general.\n\nQuedan disponibles: ${remainingStock} unidades.`);
        }

        showFeedback('success', `¡"${match.name}" agregado con éxito!`);
        setBarcodeInput('');
    };

    // Handle adding custom accessory via dropdown select
    const handleAddSelected = () => {
        if (!selectedConsumableId) return;

        const match = localConsumables.find(c => String(c.id) === String(selectedConsumableId));
        if (!match) return;

        // Check if stock is available
        if ((match.stock || 0) <= 0) {
            showFeedback('error', `Sin stock disponible para "${match.name}".`);
            return;
        }

        // Check if already added
        if (accessories[match.name]) {
            showFeedback('warning', `"${match.name}" ya se encuentra agregado a este servicio.`);
            return;
        }

        // Add to task accessories
        const newAccessories = {
            ...accessories,
            [match.name]: true
        };
        onUpdateTask({ accessories: newAccessories });

        // Update database stock
        if (updateConsumableStock) {
            const remainingStock = Math.max(0, (match.stock || 0) - 1);
            updateConsumableStock(match.id, remainingStock);
            window.alert(`MOVIMIENTO DE INVENTARIO\n\nSe ha descontado 1 unidad de "${match.name}" del stock general.\n\nQuedan disponibles: ${remainingStock} unidades.`);
        }

        showFeedback('success', `¡"${match.name}" agregado con éxito!`);
        setSelectedConsumableId('');
    };

    // Remove accessory and return stock
    const handleRemoveCustomAccessory = (name) => {
        const matchingConsumable = localConsumables.find(c => c.name === name);

        // Remove from task accessories object
        const newAccessories = { ...accessories };
        delete newAccessories[name];
        onUpdateTask({ accessories: newAccessories });

        // Restore stock to database
        if (matchingConsumable && updateConsumableStock) {
            const remainingStock = (matchingConsumable.stock || 0) + 1;
            updateConsumableStock(matchingConsumable.id, remainingStock);
            window.alert(`MOVIMIENTO DE INVENTARIO\n\nSe ha devuelto 1 unidad de "${name}" al stock general.\n\nQuedan disponibles: ${remainingStock} unidades.`);
        }

        showFeedback('success', `"${name}" removido correctamente.`);
    };

    // Identify active legacy and custom accessories keys in the task accessories object
    const legacyKeys = ['backpack', 'screenFilter', 'mouse', 'keyboard', 'headset', 'charger'];
    const activeLegacyAccessories = legacyKeys.filter(key => accessories[key] === true);
    
    const legacyNamesMap = {
        backpack: 'Mochila Técnica',
        screenFilter: `Filtro de Pantalla ${accessories.filterSize || ''}`,
        mouse: 'Mouse Óptico',
        keyboard: 'Teclado USB',
        headset: 'Auriculares con Micrófono',
        charger: 'Cargador Original'
    };

    const customAccessories = Object.keys(accessories).filter(key => 
        !legacyKeys.includes(key) && key !== 'filterSize' && accessories[key] === true
    );

    const allActiveAccessories = [
        ...activeLegacyAccessories.map(key => ({
            key,
            name: legacyNamesMap[key],
            isLegacy: true
        })),
        ...customAccessories.map(name => ({
            key: name,
            name,
            isLegacy: false
        }))
    ];

    return (
        <div style={{ marginTop: '1.5rem', borderTop: '1px solid var(--border)', paddingTop: '1.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
                <Package size={18} style={{ color: 'var(--primary-color)' }} />
                <h4 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                    Accesorios y Consumibles
                </h4>
                <span style={{ 
                    fontSize: '0.7rem', 
                    padding: '2px 6px', 
                    background: 'var(--border)', 
                    borderRadius: '4px', 
                    fontWeight: 600,
                    color: 'var(--text-secondary)'
                }}>
                    {ticketCountry}
                </span>
            </div>


            {/* Smart Add Accessories & Barcode Scan Panel */}
            <div style={{ 
                background: 'rgba(255, 255, 255, 0.02)', 
                border: '1px dashed var(--border)', 
                borderRadius: '12px', 
                padding: '1.25rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '1rem',
                marginBottom: '1.5rem'
            }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Vincular Accesorio por Escaneo o Búsqueda
                </span>

                <div style={{ 
                    display: 'grid', 
                    gridTemplateColumns: '1fr 1fr', 
                    gap: '1rem',
                    alignItems: 'end'
                }} className="grid-mobile-single">
                    
                    {/* Barcode scan input */}
                    <form onSubmit={handleBarcodeSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                        <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                            Escanear Código de Barras (Accesorio)
                        </label>
                        <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                            <QrCode size={16} style={{ position: 'absolute', left: '10px', color: 'var(--text-secondary)' }} />
                            <input
                                type="text"
                                className="form-control"
                                placeholder="Escanear o ingresar código..."
                                value={barcodeInput}
                                onChange={e => setBarcodeInput(e.target.value)}
                                style={{ 
                                    paddingLeft: '2.2rem', 
                                    fontSize: '0.8rem', 
                                    height: '36px',
                                    borderRadius: '8px',
                                    border: '1px solid var(--border)',
                                    background: 'var(--bg-card)'
                                }}
                            />
                            <button 
                                type="submit" 
                                className="btn btn-primary"
                                style={{ 
                                    marginLeft: '0.5rem', 
                                    height: '36px', 
                                    fontSize: '0.75rem',
                                    fontWeight: 700,
                                    borderRadius: '8px',
                                    padding: '0 0.8rem',
                                    whiteSpace: 'nowrap'
                                }}
                            >
                                Vincular
                            </button>
                        </div>
                    </form>

                    {/* Selector Search dropdown */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                        <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                            Buscar manualmente en Inventario
                        </label>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <div style={{ position: 'relative', flex: 1 }}>
                                <select
                                    className="form-select"
                                    value={selectedConsumableId}
                                    onChange={e => setSelectedConsumableId(e.target.value)}
                                    style={{ 
                                        fontSize: '0.8rem', 
                                        height: '36px', 
                                        borderRadius: '8px',
                                        border: '1px solid var(--border)',
                                        background: 'var(--bg-card)',
                                        width: '100%'
                                    }}
                                >
                                    <option value="">Seleccione accesorio...</option>
                                    {localConsumables.map(c => (
                                        <option 
                                            key={c.id} 
                                            value={c.id} 
                                            disabled={(c.stock || 0) <= 0 || !!accessories[c.name]}
                                        >
                                            {c.name} {c.barcode ? `[${c.barcode}]` : ''} (Stock: {c.stock || 0})
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <button
                                type="button"
                                className="btn btn-outline"
                                onClick={handleAddSelected}
                                disabled={!selectedConsumableId}
                                style={{ 
                                    height: '36px', 
                                    fontSize: '0.75rem',
                                    fontWeight: 700,
                                    borderRadius: '8px',
                                    padding: '0 1rem',
                                    background: selectedConsumableId ? 'var(--primary-color)' : 'transparent',
                                    color: selectedConsumableId ? '#fff' : 'var(--text-secondary)',
                                    border: selectedConsumableId ? 'none' : '1px solid var(--border)',
                                    cursor: selectedConsumableId ? 'pointer' : 'not-allowed',
                                    transition: 'all 0.2s ease'
                                }}
                            >
                                Agregar
                            </button>
                        </div>
                    </div>
                </div>

                {/* Status Feedback Toasts / alerts */}
                {feedback.message && (
                    <div style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: '0.5rem', 
                        padding: '0.6rem 0.8rem', 
                        borderRadius: '6px',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        background: feedback.type === 'success' ? 'rgba(16, 185, 129, 0.1)' : 
                                    feedback.type === 'error' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(245, 158, 11, 0.1)',
                        color: feedback.type === 'success' ? '#10b981' : 
                               feedback.type === 'error' ? '#ef4444' : '#f59e0b',
                        border: `1px solid ${feedback.type === 'success' ? 'rgba(16, 185, 129, 0.2)' : 
                                               feedback.type === 'error' ? 'rgba(239, 68, 68, 0.2)' : 'rgba(245, 158, 11, 0.2)'}`,
                        transition: 'all 0.3s ease'
                    }}>
                        {feedback.type === 'success' ? <Check size={14} /> : <AlertCircle size={14} />}
                        <span>{feedback.message}</span>
                    </div>
                )}
            </div>

            {/* List of Added Custom / Legacy Accessories */}
            {allActiveAccessories.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
                        Accesorios Vinculados ({allActiveAccessories.length})
                    </span>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                        {allActiveAccessories.map(item => {
                            const matchingConsumable = !item.isLegacy ? localConsumables.find(c => c.name === item.name) : null;
                            return (
                                <div
                                    key={item.key}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                        padding: '0.5rem 0.75rem',
                                        background: 'rgba(255,255,255,0.03)',
                                        border: '1px solid var(--border)',
                                        borderRadius: '8px'
                                    }}
                                >
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                        <Package size={14} style={{ color: 'var(--primary-color)' }} />
                                        <div>
                                            <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>{item.name}</span>
                                            {item.isLegacy && (
                                                <span style={{ 
                                                    fontSize: '0.65rem', 
                                                    color: 'var(--primary-color)', 
                                                    marginLeft: '0.5rem',
                                                    background: 'rgba(37, 99, 235, 0.08)',
                                                    padding: '1px 6px',
                                                    borderRadius: '4px',
                                                    fontWeight: 600
                                                }}>
                                                    Estándar
                                                </span>
                                            )}
                                            {matchingConsumable?.barcode && (
                                                <span style={{ 
                                                    fontSize: '0.65rem', 
                                                    color: 'var(--text-secondary)', 
                                                    marginLeft: '0.5rem',
                                                    background: 'rgba(0,0,0,0.05)',
                                                    padding: '1px 4px',
                                                    borderRadius: '4px',
                                                    fontFamily: 'monospace'
                                                }}>
                                                    {matchingConsumable.barcode}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            if (item.isLegacy) {
                                                toggleAccessory(item.key, item.name);
                                            } else {
                                                handleRemoveCustomAccessory(item.name);
                                            }
                                        }}
                                        style={{
                                            border: 'none',
                                            background: 'transparent',
                                            cursor: 'pointer',
                                            color: 'var(--text-secondary)',
                                            padding: '4px',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            borderRadius: '4px',
                                            transition: 'color 0.2s'
                                        }}
                                        onMouseEnter={(e) => e.currentTarget.style.color = 'var(--accent-red)'}
                                        onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-secondary)'}
                                    >
                                        <Trash2 size={14} />
                                    </button>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
}
