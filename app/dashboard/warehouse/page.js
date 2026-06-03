"use client";
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
    Search, 
    Plus, 
    Box, 
    Map as MapIcon, 
    Maximize2, 
    ScanLine, 
    CheckCircle2, 
    AlertTriangle,
    Navigation,
    Info,
    History,
    Trash2,
    ShieldCheck,
    ClipboardCheck,
    XCircle,
    Scan,
    Printer,
    ExternalLink,
    Edit3,
    ChevronLeft,
    ChevronRight
} from 'lucide-react';
import QRCode from 'qrcode';
import JsBarcode from 'jsbarcode';
import { useStore } from '../../../lib/store';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Modal } from '../../components/ui/Modal';


export default function WarehousePage() {
    const { 
        warehouseLocations,
        assets, 
        mapAssetToLocation, 
        addWarehouseLocation,
        deleteWarehouseLocation,
        updateWarehouseLocation,
        renameWarehouseGroup,
        currentUser,
        countryFilter 
    } = useStore();

    const [searchQuery, setSearchQuery] = useState('');
    const [selectedLocation, setSelectedLocation] = useState(null);
    const [isMappingMode, setIsMappingMode] = useState(false);
    const [isAuditMode, setIsAuditMode] = useState(false);
    const [mappingStep, setMappingStep] = useState(1); // 1: Scan Asset, 2: Scan Location
    const [scannedAsset, setScannedAsset] = useState(null);
    
    // Audit State
    const [auditLocation, setAuditLocation] = useState(null);
    const [scannedAuditAssets, setScannedAuditAssets] = useState([]);
    const [auditSearchQuery, setAuditSearchQuery] = useState('');
    const [scannedLocation, setScannedLocation] = useState(null);
    
    const [isAddLocationModalOpen, setIsAddLocationModalOpen] = useState(false);
    const [isSavingLocation, setIsSavingLocation] = useState(false);
    const [newLoc, setNewLoc] = useState({ id: '', aisle: '', section: '', level: '' });
    const [isEditLocationModalOpen, setIsEditLocationModalOpen] = useState(false);
    const [isSavingEditLocation, setIsSavingEditLocation] = useState(false);
    const [editLoc, setEditLoc] = useState({ aisle: '', section: '', level: '' });

    // Helper to normalize IDs for comparison (ignore dashes, quotes, spaces)
    const normalizeId = (id) => {
        if (!id) return '';
        let normalized = id.toString().replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
        // Lenovo Fix: al escanear cajas de Lenovo se agrega una 'S' al principio.
        // Si el string empieza con 's' y es largo (como un serial), quitamos la 's'.
        if (normalized.startsWith('s') && normalized.length > 7) {
            return normalized.substring(1);
        }
        return normalized;
    };

    // Group locations by aisle for the grid, filtered by country
    const groupedLocations = useMemo(() => {
        const groups = {};
        const filtered = warehouseLocations.filter(loc => 
            countryFilter === 'Todos' || loc.country === countryFilter
        );
        filtered.forEach(loc => {
            if (!groups[loc.aisle]) groups[loc.aisle] = [];
            groups[loc.aisle].push(loc);
        });
        return groups;
    }, [warehouseLocations, countryFilter]);

    // Track visual sorting of group aisles in localStorage
    const [groupOrder, setGroupOrder] = useState([]);

    useEffect(() => {
        if (typeof window !== 'undefined') {
            const saved = localStorage.getItem(`warehouse_group_order_${countryFilter}`);
            const availableAisles = Object.keys(groupedLocations);
            if (saved) {
                try {
                    const parsed = JSON.parse(saved);
                    const existing = parsed.filter(a => availableAisles.includes(a));
                    const added = availableAisles.filter(a => !existing.includes(a));
                    setGroupOrder([...existing, ...added]);
                } catch (e) {
                    setGroupOrder(availableAisles.sort());
                }
            } else {
                setGroupOrder(availableAisles.sort());
            }
        }
    }, [groupedLocations, countryFilter]);

    const sortedGroupedLocations = useMemo(() => {
        const entries = Object.entries(groupedLocations);
        entries.sort(([aisleA], [aisleB]) => {
            const idxA = groupOrder.indexOf(aisleA);
            const idxB = groupOrder.indexOf(aisleB);
            if (idxA === -1 && idxB === -1) return aisleA.localeCompare(aisleB);
            if (idxA === -1) return 1;
            if (idxB === -1) return -1;
            return idxA - idxB;
        });
        return entries;
    }, [groupedLocations, groupOrder]);

    const moveGroup = (aisle, direction) => {
        const idx = groupOrder.indexOf(aisle);
        if (idx === -1) return;
        const newOrder = [...groupOrder];
        if (direction === 'left' && idx > 0) {
            newOrder[idx] = newOrder[idx - 1];
            newOrder[idx - 1] = aisle;
        } else if (direction === 'right' && idx < newOrder.length - 1) {
            newOrder[idx] = newOrder[idx + 1];
            newOrder[idx + 1] = aisle;
        }
        setGroupOrder(newOrder);
        localStorage.setItem(`warehouse_group_order_${countryFilter}`, JSON.stringify(newOrder));
    };

    const toggleScanMode = useCallback(() => {
        setIsMappingMode(prev => {
            const nextMode = !prev;
            if (nextMode) {
                setIsAuditMode(false);
                setMappingStep(1);
                setScannedAsset(null);
            }
            return nextMode;
        });
    }, []);

    useEffect(() => {
        let buffer = '';
        let lastKeyTime = Date.now();

        const handleGlobalKeyDown = (e) => {
            if (e.ctrlKey || e.altKey || e.metaKey) return;

            const now = Date.now();
            if (now - lastKeyTime > 2000) {
                buffer = '';
            }
            lastKeyTime = now;

            if (e.key.length === 1) {
                buffer += e.key;
            }

            if (buffer.length > 50) {
                buffer = buffer.slice(-50);
            }

            if (buffer.toUpperCase().endsWith('CMD-TOGGLE-SCAN')) {
                toggleScanMode();
                buffer = '';
                
                if (document.activeElement && (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA')) {
                    setTimeout(() => {
                        document.activeElement.value = '';
                        setSearchQuery('');
                        setAuditSearchQuery('');
                    }, 10);
                }
            }
        };

        window.addEventListener('keydown', handleGlobalKeyDown);
        return () => window.removeEventListener('keydown', handleGlobalKeyDown);
    }, [toggleScanMode]);

    const handlePrintControlBarcode = () => {
        try {
            const command = "CMD-TOGGLE-SCAN";
            const canvas = document.createElement('canvas');
            JsBarcode(canvas, command, {
                format: "CODE128",
                displayValue: false,
                margin: 5,
                height: 50,
                width: 2.0
            });
            const barcodeDataUrl = canvas.toDataURL("image/png");

            let iframe = document.getElementById('print-iframe');
            if (!iframe) {
                iframe = document.createElement('iframe');
                iframe.id = 'print-iframe';
                iframe.style.position = 'absolute';
                iframe.style.width = '0';
                iframe.style.height = '0';
                iframe.style.border = 'none';
                document.body.appendChild(iframe);
            }

            const content = `
                <html>
                    <head>
                        <style>
                            @page { size: 50mm 25mm; margin: 0; }
                            * { box-sizing: border-box; -webkit-print-color-adjust: exact; }
                            html, body { width: 50mm; height: 25mm; margin: 0; padding: 0; background: #fff; overflow: hidden; }
                            .label-container {
                                width: 50mm;
                                height: 25mm;
                                padding: 1.5mm 3mm;
                                display: flex;
                                flex-direction: column;
                                justify-content: space-between;
                                align-items: center;
                                font-family: sans-serif;
                            }
                            .cmd-title { 
                                font-size: 6pt; 
                                font-weight: 800; 
                                color: #2563eb; 
                                text-transform: uppercase; 
                                letter-spacing: 0.05em;
                                text-align: center;
                            }
                            .barcode-img { width: 95%; height: 11mm; object-fit: fill; margin: 0.5mm 0; }
                            .cmd-text {
                                font-size: 6pt;
                                font-weight: 700;
                                color: #000;
                                letter-spacing: 0.1em;
                            }
                            .cmd-footer { font-size: 4.5pt; opacity: 0.5; font-weight: 600; text-align: center; width: 100%; }
                        </style>
                    </head>
                    <body>
                        <div class="label-container">
                            <div class="cmd-title">CÓDIGO DE CONTROL: MODO ESCANEO</div>
                            <img src="${barcodeDataUrl}" class="barcode-img" />
                            <div class="cmd-text">${command}</div>
                            <div class="cmd-footer">AssetFlow WMS - Escanear para alternar modo</div>
                        </div>
                        <script>
                            window.onload = () => {
                                window.print();
                                setTimeout(() => window.close(), 500);
                            };
                        </script>
                    </body>
                </html>
            `;

            const doc = iframe.contentWindow.document;
            doc.open();
            doc.write(content);
            doc.close();
        } catch (err) {
            console.error('Print error:', err);
            alert('Error al generar etiqueta de control');
        }
    };

    // Handle Asset Scan simulation
    const handleScanAsset = (e) => {
        e.preventDefault();
        const val = searchQuery.trim().toUpperCase();
        if (val === 'CMD-TOGGLE-SCAN') {
            toggleScanMode();
            setSearchQuery('');
            return;
        }
        const searchNorm = normalizeId(searchQuery);
        const asset = assets.find(a => 
            normalizeId(a.id) === searchNorm || 
            normalizeId(a.serial) === searchNorm
        );
        if (asset) {
            setScannedAsset(asset);
            setMappingStep(2);
            setSearchQuery('');
        } else {
            alert("Activo no encontrado.");
        }
    };

    // Handle Location Scan simulation
    const handleScanLocation = (locationId) => {
        const searchNorm = normalizeId(locationId);
        const loc = warehouseLocations.find(l => 
            normalizeId(l.id) === searchNorm
        );

        if (!loc) {
            alert("Ubicación no encontrada: " + locationId);
            return;
        }

        if (isAuditMode) {
            setAuditLocation(loc);
            setScannedAuditAssets([]);
            return;
        }

        if (mappingStep === 2 && scannedAsset) {
            confirmMapping(scannedAsset.id, loc.id);
        } else {
            setSelectedLocation(loc);
        }
    };

    const handleLocationSearchSubmit = (e) => {
        e.preventDefault();
        const val = searchQuery.trim().toUpperCase();
        if (val === 'CMD-TOGGLE-SCAN') {
            toggleScanMode();
            setSearchQuery('');
            return;
        }
        handleScanLocation(searchQuery);
        setSearchQuery('');
    };

    const handleAuditScan = (e) => {
        e.preventDefault();
        const val = auditSearchQuery.trim().toUpperCase();
        if (val === 'CMD-TOGGLE-SCAN') {
            toggleScanMode();
            setAuditSearchQuery('');
            return;
        }
        const searchNorm = normalizeId(auditSearchQuery);
        const asset = assets.find(a => 
            normalizeId(a.id) === searchNorm || 
            normalizeId(a.serial) === searchNorm
        );
        
        if (asset) {
            if (!scannedAuditAssets.find(a => a.id === asset.id)) {
                setScannedAuditAssets(prev => [...prev, asset]);
            }
            setAuditSearchQuery('');
        } else {
            alert("Activo no encontrado.");
        }
    };

    const finishAudit = async () => {
        if (!auditLocation) return;
        
        const expected = assets.filter(a => a.locationId === auditLocation.id);
        const matches = scannedAuditAssets.filter(s => expected.find(e => e.id === s.id));
        const extras = scannedAuditAssets.filter(s => !expected.find(e => e.id === s.id));
        const missing = expected.filter(e => !scannedAuditAssets.find(s => s.id === e.id));

        if (extras.length > 0 || missing.length > 0) {
            if (!window.confirm(`La auditoría encontró discrepancias:\n- ${missing.length} Faltantes\n- ${extras.length} Sobrantes\n\n¿Desea finalizar de todos modos?`)) return;
        }

        // Update last check for found assets
        const now = new Date().toISOString();
        for (const asset of scannedAuditAssets) {
            // We assume mapAssetToLocation or a similar update would be needed here if we want to "fix" extras
            // For now, just a notification
        }

        alert(`Auditoría finalizada para ${auditLocation.id}.`);
        setAuditLocation(null);
        setScannedAuditAssets([]);
        setIsAuditMode(false);
    };

    const confirmMapping = async (assetId, locationId) => {
        const res = await mapAssetToLocation(assetId, locationId);
        if (!res.error) {
            setScannedAsset(null);
            setMappingStep(1);
            setIsMappingMode(false);
            alert(`¡Éxito! Activo vinculado a ${locationId}`);
        } else {
            alert("Error al vincular: " + res.error.message);
        }
    };

    const handleAddLocation = async (e) => {
        e.preventDefault();
        if (countryFilter === 'Todos') {
            alert("Por favor seleccione una región (País) específica antes de crear una ubicación.");
            return;
        }

        setIsSavingLocation(true);
        try {
            const fullId = `${newLoc.aisle}-${newLoc.section}-${newLoc.level}`;
            const res = await addWarehouseLocation({ ...newLoc, id: fullId, country: countryFilter });
            
            if (res.error) {
                if (res.error.code === '23505') {
                    alert(`La ubicación ${fullId} ya existe en el sistema.`);
                } else {
                    alert("Error al crear ubicación: " + res.error.message);
                }
            } else {
                setIsAddLocationModalOpen(false);
                setNewLoc({ id: '', aisle: '', section: '', level: '' });
            }
        } catch (err) {
            console.error(err);
            alert("Ocurrió un error inesperado.");
        } finally {
            setIsSavingLocation(false);
        }
    };

    const handleDeleteLocation = async (id) => {
        if (!window.confirm(`¿Está seguro de eliminar la ubicación ${id}? Esta acción no se puede deshacer.`)) return;
        const res = await deleteWarehouseLocation(id);
        if (!res.error) {
            setSelectedLocation(null);
        } else {
            alert("Error al eliminar: " + res.error.message);
        }
    };

    const handleEditLocation = async (e) => {
        e.preventDefault();
        setIsSavingEditLocation(true);
        try {
            const res = await updateWarehouseLocation(selectedLocation.id, {
                ...selectedLocation,
                aisle: editLoc.aisle,
                section: editLoc.section,
                level: editLoc.level
            });
            
            if (res.error) {
                alert("Error al actualizar la ubicación: " + res.error.message);
            } else {
                setIsEditLocationModalOpen(false);
                setSelectedLocation(res.data);
                alert("¡Ubicación actualizada correctamente!");
            }
        } catch (err) {
            console.error(err);
            alert("Ocurrió un error inesperado al actualizar.");
        } finally {
            setIsSavingEditLocation(false);
        }
    };

    const handlePrintLocationLabel = async (location) => {
        try {
            const qrDataUrl = await QRCode.toDataURL(location.id, {
                margin: 0,
                width: 200,
                color: { dark: '#000000', light: '#ffffff' }
            });

            const canvas = document.createElement('canvas');
            JsBarcode(canvas, location.id, {
                format: "CODE128",
                displayValue: false,
                margin: 10,
                height: 60,
                width: 3.0
            });
            const barcodeDataUrl = canvas.toDataURL("image/png");

            let iframe = document.getElementById('print-iframe');
            if (!iframe) {
                iframe = document.createElement('iframe');
                iframe.id = 'print-iframe';
                iframe.style.position = 'absolute';
                iframe.style.width = '0';
                iframe.style.height = '0';
                iframe.style.border = 'none';
                document.body.appendChild(iframe);
            }

            const content = `
                <html>
                    <head>
                        <style>
                            @page { size: 50mm 25mm; margin: 0; }
                            * { box-sizing: border-box; -webkit-print-color-adjust: exact; }
                            html, body { width: 50mm; height: 25mm; margin: 0; padding: 0; background: #fff; overflow: hidden; }
                            .label-container {
                                width: 50mm;
                                height: 25mm;
                                padding: 1.5mm 4mm;
                                display: flex;
                                flex-direction: column;
                                justify-content: flex-start;
                                font-family: sans-serif;
                            }
                            .loc-region { 
                                font-size: 6pt; 
                                font-weight: 800; 
                                color: #64748b; 
                                text-transform: uppercase; 
                                letter-spacing: 0.05em;
                                margin-bottom: 0.5mm;
                            }
                            .loc-aisle { 
                                font-size: 8pt; 
                                font-weight: 900; 
                                color: #000; 
                                text-transform: uppercase;
                                line-height: 1.2;
                                white-space: nowrap;
                                overflow: hidden;
                                text-overflow: ellipsis;
                            }
                            .loc-details { 
                                font-size: 8pt; 
                                font-weight: 700; 
                                color: #334155; 
                                margin-top: 1.5mm;
                                margin-bottom: 1.5mm;
                                line-height: 1.2;
                            }
                            .barcode-img { width: 100%; height: 11mm; object-fit: fill; }
                        </style>
                    </head>
                    <body>
                        <div class="label-container">
                            <div class="loc-region">${location.country}</div>
                            <div class="loc-aisle">GRUPO ${location.aisle}</div>
                            <div class="loc-details">${location.section} - ${location.level}</div>
                            <img src="${barcodeDataUrl}" class="barcode-img" />
                            <div style="font-size: 4.5pt; opacity: 0.4; margin-top: 0.5mm; font-weight: 600; text-align: right;">AssetFlow WMS</div>
                        </div>
                        <script>
                            window.onload = () => {
                                window.print();
                                setTimeout(() => window.close(), 500);
                            };
                        </script>
                    </body>
                </html>
            `;

            const doc = iframe.contentWindow.document;
            doc.open();
            doc.write(content);
            doc.close();
        } catch (err) {
            console.error('Print error:', err);
            alert('Error al generar etiqueta');
        }
    };

    // Find asset at a location
    const getAssetAtLocation = (locId) => {
        return assets.find(a => a.locationId === locId);
    };

    return (
        <div style={{ padding: '1rem' }}>
            {/* Header / Stats */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '2rem' }}>
                    <div>
                        <h1 style={{ fontSize: '1.8rem', fontWeight: 800, marginBottom: '0.5rem' }}>Mapeo de Depósito</h1>
                        <p style={{ color: 'var(--text-secondary)' }}>Control visual y físico de activos de cliente {countryFilter}.</p>
                    </div>
                </div>
                
                <div style={{ flex: 1, maxWidth: '400px', margin: '0 2rem' }}>
                    <form onSubmit={(e) => {
                        e.preventDefault();
                        const val = searchQuery.trim().toUpperCase();
                        if (val === 'CMD-TOGGLE-SCAN') {
                            toggleScanMode();
                            setSearchQuery('');
                            return;
                        }
                        const searchNorm = normalizeId(searchQuery);
                        // Global search: first try as location, then as asset
                        const loc = warehouseLocations.find(l => normalizeId(l.id) === searchNorm);
                        if (loc) {
                            handleScanLocation(loc.id);
                            setSearchQuery('');
                            return;
                        }
                        const asset = assets.find(a => normalizeId(a.serial) === searchNorm || normalizeId(a.id) === searchNorm);
                        if (asset) {
                            if (asset.locationId) {
                                handleScanLocation(asset.locationId);
                            } else {
                                alert(`Activo ${asset.serial} encontrado pero no tiene ubicación asignada.`);
                            }
                            setSearchQuery('');
                            return;
                        }
                        alert(`No se encontró ubicación ni activo con el código: ${searchQuery}`);
                    }}>
                        <div className="search-box">
                            <ScanLine className="search-icon" size={18} />
                            <input 
                                className="search-input"
                                placeholder="Escanear Ubicación o Activo..."
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                            />
                        </div>
                    </form>
                </div>
                <div style={{ display: 'flex', gap: '1rem' }}>
                    <Button 
                        variant={isAuditMode ? "primary" : "outline"} 
                        icon={ClipboardCheck}
                        onClick={() => {
                            setIsAuditMode(!isAuditMode);
                            setIsMappingMode(false);
                            setAuditLocation(null);
                        }}
                        style={{ borderColor: isAuditMode ? 'transparent' : '#8b5cf6', color: isAuditMode ? 'white' : '#8b5cf6' }}
                    >
                        {isAuditMode ? "Cancelar Auditoría" : "Modo Auditoría"}
                    </Button>
                    <div style={{ display: 'flex', alignItems: 'stretch' }}>
                        <Button 
                            variant={isMappingMode ? "primary" : "outline"} 
                            icon={ScanLine}
                            onClick={toggleScanMode}
                            style={{
                                borderTopRightRadius: 0,
                                borderBottomRightRadius: 0,
                                borderRight: 'none'
                            }}
                        >
                            {isMappingMode ? "Cancelar Mapeo" : "Modo Escaneo"}
                        </Button>
                        <Button
                            variant={isMappingMode ? "primary" : "outline"}
                            icon={Printer}
                            onClick={handlePrintControlBarcode}
                            title="Imprimir Código de Barra de Control"
                            style={{
                                borderTopLeftRadius: 0,
                                borderBottomLeftRadius: 0,
                                padding: '0 0.75rem',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                borderLeft: isMappingMode ? '1px solid rgba(255,255,255,0.2)' : '1px solid var(--border)'
                            }}
                        />
                    </div>
                    <Button icon={Plus} onClick={() => setIsAddLocationModalOpen(true)}>Nueva Ubicación</Button>
                </div>
            </div>

            {/* Dashboard Row */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 350px', gap: '2rem' }}>
                
                {/* Main Map Area */}
                <Card style={{ padding: '1.5rem', minHeight: '600px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '2rem' }}>
                        <div style={{ padding: '0.5rem', background: 'rgba(37, 99, 235, 0.1)', borderRadius: '8px' }}>
                            <MapIcon size={20} color="var(--primary-color)" />
                        </div>
                        <h2 style={{ fontSize: '1.2rem', fontWeight: 700 }}>Mapa de Estanterías</h2>
                    </div>

                    {Object.keys(groupedLocations).length === 0 ? (
                        <div style={{ height: '400px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)' }}>
                            <Navigation size={48} style={{ marginBottom: '1rem', opacity: 0.3 }} />
                            <p>No hay ubicaciones registradas.</p>
                            <Button variant="ghost" size="sm" style={{ marginTop: '1rem' }} onClick={() => setIsAddLocationModalOpen(true)}>Crear primer estante</Button>
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '3rem' }}>
                            {sortedGroupedLocations.map(([aisle, locations]) => (
                                <div key={aisle} style={{ flex: '1', minWidth: '220px' }}>
                                    <h3 style={{ fontSize: '0.9rem', fontWeight: 800, color: 'var(--text-secondary)', marginBottom: '1rem', textTransform: 'uppercase', letterSpacing: '0.1em', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                            <span>Grupo {aisle}</span>
                                            {sortedGroupedLocations.length > 1 && (
                                                <div style={{ display: 'flex', gap: '1px', alignItems: 'center', background: 'rgba(0,0,0,0.03)', borderRadius: '6px', padding: '2px' }}>
                                                    <Button
                                                        variant="ghost"
                                                        size="xs"
                                                        icon={ChevronLeft}
                                                        onClick={() => moveGroup(aisle, 'left')}
                                                        disabled={groupOrder.indexOf(aisle) === 0}
                                                        style={{ padding: '2px', height: '20px', width: '20px', opacity: groupOrder.indexOf(aisle) === 0 ? 0.25 : 0.6 }}
                                                        title="Mover Izquierda"
                                                    />
                                                    <Button
                                                        variant="ghost"
                                                        size="xs"
                                                        icon={ChevronRight}
                                                        onClick={() => moveGroup(aisle, 'right')}
                                                        disabled={groupOrder.indexOf(aisle) === sortedGroupedLocations.length - 1}
                                                        style={{ padding: '2px', height: '20px', width: '20px', opacity: groupOrder.indexOf(aisle) === sortedGroupedLocations.length - 1 ? 0.25 : 0.6 }}
                                                        title="Mover Derecha"
                                                    />
                                                </div>
                                            )}
                                            {(currentUser?.role === 'admin' || currentUser?.role === 'Gerencial') && (
                                                <Button 
                                                    variant="ghost" 
                                                    size="xs" 
                                                    icon={Edit3} 
                                                    onClick={() => {
                                                        const newName = prompt(`Ingrese el nuevo nombre para el grupo "${aisle}":`, aisle);
                                                        if (newName && newName !== aisle) {
                                                            renameWarehouseGroup(aisle, newName.toUpperCase());
                                                        }
                                                    }}
                                                    style={{ padding: '2px', height: '20px', width: '20px', opacity: 0.5 }}
                                                />
                                            )}
                                        </div>
                                        <span style={{ fontSize: '0.75rem', color: 'var(--primary-color)', background: 'rgba(37, 99, 235, 0.05)', padding: '2px 8px', borderRadius: '12px', fontWeight: 500 }}>
                                            {assets.filter(a => locations.some(loc => loc.id === a.locationId)).length} Equipos
                                        </span>
                                    </h3>
                                    <div style={{ 
                                        display: 'grid', 
                                        gridTemplateColumns: 'repeat(auto-fill, minmax(70px, 1fr))', 
                                        gap: '0.5rem',
                                        background: 'rgba(0,0,0,0.02)',
                                        padding: '1rem',
                                        borderRadius: '12px',
                                        border: '1px dashed var(--border)'
                                    }}>
                                        {locations.sort((a,b) => a.id.localeCompare(b.id)).map(loc => {
                                            const locationAssets = assets.filter(a => a.locationId === loc.id);
                                            const assetCount = locationAssets.length;
                                            const asset = locationAssets[0];
                                            const isSelected = selectedLocation?.id === loc.id || auditLocation?.id === loc.id;
                                            const isTarget = (mappingStep === 2 && isMappingMode) || isAuditMode;

                                            let bgColor = 'var(--surface)';
                                            let textColor = 'var(--text-main)';

                                            if (assetCount > 0) {
                                                bgColor = 'var(--primary-color)';
                                                textColor = 'white';
                                            }

                                            if (isAuditMode && auditLocation?.id === loc.id) {
                                                bgColor = '#8b5cf6';
                                                textColor = 'white';
                                            }

                                            return (
                                                <div 
                                                    key={loc.id}
                                                    onClick={() => handleScanLocation(loc.id)}
                                                    style={{
                                                        aspectRatio: '1.7/1',
                                                        display: 'flex',
                                                        flexDirection: 'column',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        background: bgColor,
                                                        color: textColor,
                                                        borderRadius: '6px',
                                                        border: isSelected ? `2px solid ${isAuditMode ? '#8b5cf6' : 'var(--primary-color)'}` : '1px solid var(--border)',
                                                        cursor: 'pointer',
                                                        transition: 'all 0.2s ease',
                                                        fontSize: '0.7rem',
                                                        fontWeight: 700,
                                                        position: 'relative',
                                                        boxShadow: isSelected ? `0 0 15px ${isAuditMode ? 'rgba(139, 92, 246, 0.3)' : 'rgba(37, 99, 235, 0.3)'}` : 'none',
                                                        opacity: isTarget && assetCount === 0 && !isSelected ? 0.7 : 1,
                                                        animation: isTarget && assetCount === 0 && !isSelected ? 'pulse 2s infinite' : 'none'
                                                    }}
                                                    title={`${loc.id} (${assetCount} activos)`}
                                                >
                                                    {loc.id.split('-').slice(1).join('-')}
                                                    {assetCount > 0 && (
                                                        <div style={{ 
                                                            display: 'flex', alignItems: 'center', gap: '2px', marginTop: '1px',
                                                            background: '#ef4444', color: 'white', padding: '1px 4px', borderRadius: '8px',
                                                            fontSize: '0.6rem', fontWeight: 900
                                                        }}>
                                                            <Box size={8} />
                                                            <span>{assetCount}</span>
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </Card>

                {/* Info Panel */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                    
                    {/* Scanner Console */}
                    {isMappingMode && (
                        <Card style={{ padding: '1.5rem', border: '2px solid var(--primary-color)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
                                <ScanLine size={18} color="var(--primary-color)" />
                                <h3 style={{ fontSize: '1rem', fontWeight: 700 }}>Consola de Mapping</h3>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                <div style={{ 
                                    padding: '1rem', 
                                    background: 'var(--background)', 
                                    borderRadius: '8px', 
                                    border: '1px solid var(--border)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '1rem'
                                }}>
                                    <div style={{ 
                                        width: '24px', height: '24px', 
                                        borderRadius: '50%', 
                                        background: mappingStep >= 1 ? 'var(--primary-color)' : 'var(--border)',
                                        color: 'white',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem'
                                    }}>1</div>
                                    <span style={{ fontSize: '0.85rem', fontWeight: 600, display: 'flex', flexDirection: 'column' }}>
                                        {scannedAsset ? (
                                            <>
                                                <span>Activo: {scannedAsset.id}</span>
                                                {scannedAsset.locationId && (
                                                    <span style={{ fontSize: '0.7rem', color: '#f59e0b', marginTop: '0.2rem' }}>
                                                        Actualmente en: {scannedAsset.locationId}
                                                    </span>
                                                )}
                                            </>
                                        ) : "Escanee el Activo"}
                                    </span>
                                    {scannedAsset && <CheckCircle2 size={16} color="#22c55e" style={{ marginLeft: 'auto' }} />}
                                </div>

                                <div style={{ 
                                    padding: '1rem', 
                                    background: 'var(--background)', 
                                    borderRadius: '8px', 
                                    border: mappingStep === 2 ? '1px solid var(--primary-color)' : '1px solid var(--border)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '1rem',
                                    opacity: mappingStep === 2 ? 1 : 0.5
                                }}>
                                    <div style={{ 
                                        width: '24px', height: '24px', 
                                        borderRadius: '50%', 
                                        background: mappingStep >= 2 ? 'var(--primary-color)' : 'var(--border)',
                                        color: 'white',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem'
                                    }}>2</div>
                                    <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Escanee la Ubicación</span>
                                </div>

                                <form onSubmit={mappingStep === 1 ? handleScanAsset : handleLocationSearchSubmit} style={{ marginTop: '0.5rem' }}>
                                    <div className="search-box">
                                        <Scan className="search-icon" size={18} color="var(--primary-color)" />
                                        <input 
                                            className="search-input"
                                            placeholder={mappingStep === 1 ? "Scan Activo..." : "Scan Ubicación..."}
                                            value={searchQuery}
                                            onChange={e => setSearchQuery(e.target.value)}
                                            autoFocus
                                            style={{ borderColor: 'var(--primary-color)' }}
                                        />
                                    </div>
                                </form>
                            </div>
                        </Card>
                    )}

                    {isAuditMode && (
                        <Card style={{ padding: '1.5rem', border: '2px solid #8b5cf6' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
                                <ShieldCheck size={18} color="#8b5cf6" />
                                <h3 style={{ fontSize: '1rem', fontWeight: 700 }}>Consola de Auditoría</h3>
                            </div>
                            
                            {!auditLocation ? (
                                <div style={{ textAlign: 'center', padding: '1rem', background: 'rgba(139, 92, 246, 0.05)', borderRadius: '12px', border: '1px dashed #8b5cf6' }}>
                                    <p style={{ fontSize: '0.85rem', color: '#6d28d9', fontWeight: 600 }}>Seleccione un estante en el mapa para iniciar la auditoría.</p>
                                </div>
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem 1rem', background: '#8b5cf6', color: 'white', borderRadius: '8px', fontWeight: 800 }}>
                                        <span>Auditando: {auditLocation.id}</span>
                                        <div style={{ background: '#ef4444', padding: '2px 8px', borderRadius: '12px', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                            <Box size={12} />
                                            <span>Total: {assets.filter(a => a.locationId === auditLocation.id).length}</span>
                                        </div>
                                    </div>
                                    
                                    <form onSubmit={handleAuditScan}>
                                        <div className="search-box">
                                            <Scan className="search-icon" size={18} />
                                            <input 
                                                className="search-input"
                                                placeholder="Escanee activo físicamente..."
                                                value={auditSearchQuery}
                                                onChange={e => setAuditSearchQuery(e.target.value)}
                                                autoFocus
                                                style={{ borderColor: '#8b5cf6' }}
                                            />
                                        </div>
                                    </form>

                                    <div style={{ maxHeight: '250px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                        {assets.filter(a => a.locationId === auditLocation.id).map(expected => {
                                            const isFound = scannedAuditAssets.find(s => s.id === expected.id);
                                            return (
                                                <div key={expected.id} style={{ 
                                                    padding: '0.6rem', 
                                                    borderRadius: '8px', 
                                                    background: isFound ? 'rgba(34, 197, 94, 0.1)' : 'rgba(0,0,0,0.03)',
                                                    border: `1px solid ${isFound ? '#22c55e' : 'var(--border)'}`,
                                                    display: 'flex',
                                                    justifyContent: 'space-between',
                                                    alignItems: 'center'
                                                }}>
                                                    <div style={{ fontSize: '0.75rem', fontWeight: 600 }}>{expected.name}</div>
                                                    {isFound ? <CheckCircle2 size={14} color="#22c55e" /> : <div style={{ width: '14px', height: '14px', borderRadius: '50%', border: '1px solid #ccc' }} />}
                                                </div>
                                            );
                                        })}
                                        {scannedAuditAssets.filter(s => s.locationId !== auditLocation.id).map(extra => (
                                            <div key={extra.id} style={{ 
                                                padding: '0.6rem', 
                                                borderRadius: '8px', 
                                                background: 'rgba(239, 68, 68, 0.1)',
                                                border: '1px solid #ef4444',
                                                display: 'flex',
                                                justifyContent: 'space-between',
                                                alignItems: 'center'
                                            }}>
                                                <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#ef4444' }}>Extra: {extra.name}</div>
                                                <XCircle size={14} color="#ef4444" />
                                            </div>
                                        ))}
                                    </div>

                                    <Button fullWidth variant="primary" style={{ background: '#8b5cf6' }} onClick={finishAudit}>
                                        Finalizar Auditoría
                                    </Button>
                                </div>
                            )}
                        </Card>
                    )}

                    {!isMappingMode && !isAuditMode && (
                        <Card style={{ padding: '1.5rem' }}>
                            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', textAlign: 'center', padding: '1rem' }}>
                                Seleccione una opción arriba para comenzar a operar en el depósito.
                            </p>
                        </Card>
                    )}

                    {/* Selected Location Detail */}
                    {(() => {
                        if (!selectedLocation) {
                            return (
                                <Card style={{ padding: '2rem', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', color: 'var(--text-secondary)' }}>
                                    <History size={40} style={{ opacity: 0.1, marginBottom: '1rem' }} />
                                    <p style={{ fontSize: '0.85rem' }}>Seleccione una ubicación en el mapa para ver sus detalles.</p>
                                </Card>
                            );
                        }
                        const locationAssets = assets.filter(a => a.locationId === selectedLocation.id);
                        return (
                            <Card style={{ padding: '1.5rem' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem' }}>
                                    <div>
                                        <span style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--primary-color)', textTransform: 'uppercase' }}>Ubicación</span>
                                        <h3 style={{ fontSize: '1.1rem', fontWeight: 800 }}>{selectedLocation.id}</h3>
                                    </div>
                                    <div style={{ 
                                        padding: '0.2rem 0.6rem', 
                                        borderRadius: '20px', 
                                        fontSize: '0.65rem', 
                                        fontWeight: 700,
                                        background: locationAssets.length > 0 ? 'rgba(37, 99, 235, 0.1)' : 'rgba(34, 197, 94, 0.1)',
                                        color: locationAssets.length > 0 ? 'var(--primary-color)' : '#22c55e'
                                    }}>
                                        {locationAssets.length > 0 ? 'Ocupado' : 'Disponible'}
                                    </div>
                                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginLeft: '0.5rem' }}>
                                        <Button 
                                            variant="outline" 
                                            size="sm" 
                                            icon={Edit3} 
                                            onClick={() => {
                                                setEditLoc({
                                                    aisle: selectedLocation.aisle,
                                                    section: selectedLocation.section,
                                                    level: selectedLocation.level
                                                });
                                                setIsEditLocationModalOpen(true);
                                            }}
                                            title="Editar Ubicación"
                                            style={{ color: 'var(--primary-color)', borderColor: 'var(--primary-color)', height: '28px' }}
                                        />
                                        <Button 
                                            variant="outline" 
                                            size="sm" 
                                            icon={Printer} 
                                            onClick={() => handlePrintLocationLabel(selectedLocation)}
                                            title="Imprimir Etiqueta Estantería"
                                            style={{ color: 'var(--primary-color)', borderColor: 'var(--primary-color)', height: '28px' }}
                                        />
                                    </div>
                                </div>

                                {locationAssets.length > 0 ? (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                        <div style={{ maxHeight: '450px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.5rem', paddingRight: '0.5rem' }}>
                                            {locationAssets.map(asset => (
                                                <div key={asset.id} style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', padding: '0.6rem 0.8rem', background: 'var(--background)', borderRadius: '10px', border: '1px solid var(--border)', transition: 'all 0.2s ease' }}>
                                                    <div style={{ flex: 1 }}>
                                                        <h4 style={{ fontSize: '0.78rem', fontWeight: 800, margin: 0, color: 'var(--text-main)', lineHeight: '1.2' }}>{asset.name}</h4>
                                                        {asset.hardwareSpec && (
                                                            <div style={{ fontSize: '0.68rem', color: 'var(--text-secondary)', fontWeight: 600, marginTop: '2px' }}>
                                                                {asset.hardwareSpec}
                                                            </div>
                                                        )}
                                                        <div style={{ display: 'flex', gap: '0.4rem', marginTop: '4px', opacity: 0.8 }}>
                                                            <span style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
                                                                #{asset.id?.toString().slice(-4)}
                                                            </span>
                                                            <span style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', borderLeft: '1px solid var(--border)', paddingLeft: '0.4rem' }}>
                                                                SN: {asset.serial || 'N/A'}
                                                            </span>
                                                        </div>
                                                    </div>
                                                    <Button 
                                                        variant="ghost" 
                                                        size="sm" 
                                                        icon={ExternalLink} 
                                                        onClick={() => window.open(`/dashboard/inventory?id=${asset.id}`, '_blank')}
                                                        title="Ver Detalle"
                                                        style={{ height: '28px', width: '28px', padding: 0 }}
                                                    />
                                                </div>
                                            ))}
                                        </div>
                                        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', background: 'var(--background)', padding: '1rem', borderRadius: '12px' }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                                                <span>Mapeado el:</span>
                                                <span style={{ fontWeight: 600 }}>{locationAssets[0].dateMapped ? new Date(locationAssets[0].dateMapped).toLocaleDateString() : 'N/A'}</span>
                                            </div>
                                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                                <span>Por:</span>
                                                <span style={{ fontWeight: 600 }}>{locationAssets[0].updatedBy || 'N/A'}</span>
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                        <div style={{ textAlign: 'center', padding: '1rem', color: 'var(--text-secondary)' }}>
                                            <Info size={32} style={{ opacity: 0.2, marginBottom: '0.5rem' }} />
                                            <p style={{ fontSize: '0.85rem' }}>Esta ubicación está vacía.</p>
                                        </div>
                                        {(currentUser?.role === 'admin' || currentUser?.role === 'Gerencial') && (
                                            <Button 
                                                variant="ghost" 
                                                size="sm" 
                                                icon={Trash2} 
                                                style={{ color: '#ef4444', marginTop: '1rem' }}
                                                onClick={() => handleDeleteLocation(selectedLocation.id)}
                                            >
                                                Eliminar Ubicación
                                            </Button>
                                        )}
                                    </div>
                                )}
                            </Card>
                        );
                    })()}
                </div>
            </div>

            {/* Modal Nueva Ubicación */}
            <Modal isOpen={isAddLocationModalOpen} onClose={() => setIsAddLocationModalOpen(false)} title="Agregar Ubicación">
                <form onSubmit={handleAddLocation}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
                        <div className="form-group">
                            <label className="form-label">Grupo (Categoría)</label>
                            <input 
                                className="form-input" 
                                placeholder="Ej: B" 
                                required
                                value={newLoc.aisle}
                                onChange={e => setNewLoc({ ...newLoc, aisle: e.target.value.toUpperCase() })}
                            />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Sección (Rack)</label>
                            <input 
                                className="form-input" 
                                placeholder="Ej: 03" 
                                required
                                value={newLoc.section}
                                onChange={e => setNewLoc({ ...newLoc, section: e.target.value })}
                            />
                        </div>
                    </div>
                    <div className="form-group" style={{ marginBottom: '2rem' }}>
                        <label className="form-label">Nivel (Level)</label>
                        <input 
                            className="form-input" 
                            placeholder="Ej: 2" 
                            required
                            value={newLoc.level}
                            onChange={e => setNewLoc({ ...newLoc, level: e.target.value })}
                        />
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
                        <Button type="button" variant="ghost" onClick={() => setIsAddLocationModalOpen(false)} disabled={isSavingLocation}>
                            Cancelar
                        </Button>
                        <Button type="submit" loading={isSavingLocation}>
                            {isSavingLocation ? 'Creando...' : 'Crear Ubicación'}
                        </Button>
                    </div>
                </form>
            </Modal>

            {/* Modal Editar Ubicación */}
            <Modal isOpen={isEditLocationModalOpen} onClose={() => setIsEditLocationModalOpen(false)} title="Editar Ubicación">
                <form onSubmit={handleEditLocation}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
                        <div className="form-group">
                            <label className="form-label">Grupo (Categoría)</label>
                            <input 
                                className="form-input" 
                                placeholder="Ej: B" 
                                required
                                value={editLoc.aisle}
                                onChange={e => setEditLoc({ ...editLoc, aisle: e.target.value.toUpperCase() })}
                            />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Sección (Rack)</label>
                            <input 
                                className="form-input" 
                                placeholder="Ej: 03" 
                                required
                                value={editLoc.section}
                                onChange={e => setEditLoc({ ...editLoc, section: e.target.value })}
                            />
                        </div>
                    </div>
                    <div className="form-group" style={{ marginBottom: '2rem' }}>
                        <label className="form-label">Nivel (Level)</label>
                        <input 
                            className="form-input" 
                            placeholder="Ej: 2" 
                            required
                            value={editLoc.level}
                            onChange={e => setEditLoc({ ...editLoc, level: e.target.value })}
                        />
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
                        <Button type="button" variant="ghost" onClick={() => setIsEditLocationModalOpen(false)} disabled={isSavingEditLocation}>
                            Cancelar
                        </Button>
                        <Button type="submit" loading={isSavingEditLocation}>
                            {isSavingEditLocation ? 'Guardando...' : 'Guardar Cambios'}
                        </Button>
                    </div>
                </form>
            </Modal>

            <style jsx>{`
                .search-box {
                    position: relative;
                    width: 100%;
                }
                .search-icon {
                    position: absolute;
                    left: 12px;
                    top: 50%;
                    transform: translateY(-50%);
                    color: var(--text-secondary);
                }
                .search-input {
                    width: 100%;
                    padding: 0.75rem 1rem 0.75rem 2.5rem;
                    border-radius: 10px;
                    border: 1px solid var(--border);
                    background: var(--background);
                    color: var(--text-main);
                    outline: none;
                    transition: all 0.2s;
                }
                .search-input:focus {
                    border-color: var(--primary-color);
                    box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.1);
                }
                @keyframes pulse {
                    0% { box-shadow: 0 0 0 0 rgba(37, 99, 235, 0.4); }
                    70% { box-shadow: 0 0 0 10px rgba(37, 99, 235, 0); }
                    100% { box-shadow: 0 0 0 0 rgba(37, 99, 235, 0); }
                }
            `}</style>
        </div>
    );
}
