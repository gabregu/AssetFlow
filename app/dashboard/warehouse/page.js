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
    ChevronRight,
    ChevronUp,
    ChevronDown,
    ArrowUpDown,
    Laptop,
    SlidersHorizontal,
    Download
} from 'lucide-react';
import QRCode from 'qrcode';
import JsBarcode from 'jsbarcode';
import * as XLSX from 'xlsx';
import { useStore } from '../../../lib/store';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Modal } from '../../components/ui/Modal';

// Helper to classify aisles between Location W and Location H
const isLocH = (aisleName) => {
    const upper = (aisleName || '').toUpperCase();
    if (upper.endsWith('-H') || upper.startsWith('H-')) return true;
    if (upper.endsWith('-W') || upper.startsWith('W-')) return false;

    // Exact legacy matches that exist in the DB without -H but belong to H
    const legacyH = [
        'USADOS', 'COD ABRIL26', 'DELL PRO 14 U7', 'DELL PRO MAX 16 PREMIUM', 
        'HP-ZBOOK-FURY 16 G11', 'MBA 16 M2 PRO', 'SERIES'
    ];
    return legacyH.includes(upper);
};

const getDisplayAisle = (aisleName) => {
    return (aisleName || '').replace(/-H$/i, '').replace(/^H-/i, '').replace(/-W$/i, '').replace(/^W-/i, '').trim();
};

const combineAisleName = (manufacturer, aisle) => {
    const m = (manufacturer || '').trim().toUpperCase();
    const a = (aisle || '').trim().toUpperCase();
    if (!m || m === 'NINGUNO') return a;
    if (a.startsWith(m)) return a;
    return `${m} ${a}`;
};

const detectManufacturer = (aisleName, manufacturersList = []) => {
    const upper = (aisleName || '').toUpperCase().replace(/-H$/, '');
    
    // Hardcoded aliases for known brands
    if (upper.startsWith('MBA ') || upper.startsWith('MBA-') || upper.startsWith('MBP ') || upper.startsWith('MBP-') || upper.startsWith('MACBOOK') || upper.startsWith('IMAC') || upper.startsWith('MAC ')) {
        if (manufacturersList.map(m => m.toUpperCase()).includes('APPLE')) {
            return 'APPLE';
        }
    }

    for (const m of manufacturersList) {
        const upperM = m.toUpperCase();
        if (upper === upperM || upper.startsWith(upperM + ' ') || upper.startsWith(upperM + '-')) return upperM;
    }
    return 'NINGUNO';
};

const getGroupedByBrand = (locations, manufacturersList = []) => {
    const grouped = {};
    manufacturersList.forEach(m => {
        grouped[m.toUpperCase()] = [];
    });
    grouped['NINGUNO'] = [];

    locations.forEach(([aisle, locs]) => {
        const m = detectManufacturer(aisle, manufacturersList);
        grouped[m].push([aisle, locs]);
    });
    return grouped;
};

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

    // Mapping and Audit States
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedLocation, setSelectedLocation] = useState(null);
    const [selectedGroup, setSelectedGroup] = useState(null);
    const [selectedAssetId, setSelectedAssetId] = useState(null);
    const [isMappingMode, setIsMappingMode] = useState(false);
    const [isAuditMode, setIsAuditMode] = useState(false);
    const [mappingStep, setMappingStep] = useState(1); // 1: Scan Asset, 2: Scan Location
    const [scannedAsset, setScannedAsset] = useState(null);

    // Move Asset States
    const [isMoveAssetModalOpen, setIsMoveAssetModalOpen] = useState(false);
    const [movingAsset, setMovingAsset] = useState(null);
    const [targetLocationId, setTargetLocationId] = useState('');

    // Move All Assets States
    const [isMoveAllModalOpen, setIsMoveAllModalOpen] = useState(false);
    const [movingAllSourceLocation, setMovingAllSourceLocation] = useState(null);
    const [targetAllLocationId, setTargetAllLocationId] = useState('');
    
    // Audit State
    const [auditLocation, setAuditLocation] = useState(null);
    const [scannedAuditAssets, setScannedAuditAssets] = useState([]);
    const [auditSearchQuery, setAuditSearchQuery] = useState('');
    
    // Modals
    const [isAddLocationModalOpen, setIsAddLocationModalOpen] = useState(false);
    const [isSavingLocation, setIsSavingLocation] = useState(false);
    const [newLoc, setNewLoc] = useState({ id: '', aisle: '', section: '', level: '' });
    const [isEditLocationModalOpen, setIsEditLocationModalOpen] = useState(false);
    const [isSavingEditLocation, setIsSavingEditLocation] = useState(false);
    const [editLoc, setEditLoc] = useState({ aisle: '', section: '', level: '' });
    const [newLocationType, setNewLocationType] = useState('W');
    const [editLocationType, setEditLocationType] = useState('W');
    const [newLocManufacturer, setNewLocManufacturer] = useState('NINGUNO');
    const [editLocManufacturer, setEditLocManufacturer] = useState('NINGUNO');
    
    // Rename Group States
    const [isRenameGroupModalOpen, setIsRenameGroupModalOpen] = useState(false);
    const [renameGroupOldName, setRenameGroupOldName] = useState('');
    const [renameGroupType, setRenameGroupType] = useState('W');
    const [renameGroupManufacturer, setRenameGroupManufacturer] = useState('NINGUNO');
    const [renameGroupCategory, setRenameGroupCategory] = useState('');
    const [manufacturers, setManufacturers] = useState(() => {
        if (typeof window !== 'undefined') {
            const saved = localStorage.getItem('warehouse_manufacturers');
            return saved ? JSON.parse(saved) : ['APPLE', 'DELL', 'HP', 'SAMSUNG'];
        }
        return ['APPLE', 'DELL', 'HP', 'SAMSUNG'];
    });
    const [groupByBrand, setGroupByBrand] = useState(false);
    const [isManageManufacturersOpen, setIsManageManufacturersOpen] = useState(false);
    const [newManufacturerName, setNewManufacturerName] = useState('');

    useEffect(() => {
        if (typeof window !== 'undefined') {
            localStorage.setItem('warehouse_manufacturers', JSON.stringify(manufacturers));
        }
    }, [manufacturers]);

    // Premium Dashboard Filters
    const [selectedBrand, setSelectedBrand] = useState('ALL');
    const [cpuFilter, setCpuFilter] = useState('ALL');
    const [ramFilter, setRamFilter] = useState('ALL');
    const [statusFilter, setStatusFilter] = useState('ALL');
    const [locationSearch, setLocationSearch] = useState('');

    // Helper to normalize IDs for comparison
    const normalizeId = (id) => {
        if (!id) return '';
        let normalized = id.toString().replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
        if (normalized.startsWith('s') && normalized.length > 7) {
            return normalized.substring(1);
        }
        return normalized;
    };

    // Filter assets based on search/filters
    const filteredAssets = useMemo(() => {
        return assets.filter(asset => {
            if (countryFilter !== 'Todos' && asset.country !== countryFilter) return false;
            
            // Brand filters
            if (selectedBrand !== 'ALL') {
                const oem = (asset.oem || '').toUpperCase();
                if (selectedBrand === 'WINDOWS') {
                    if (oem === 'APPLE') return false;
                } else if (selectedBrand === 'MANTENIMIENTO') {
                    if (!['Mantenimiento', 'Dañado'].includes(asset.status)) return false;
                } else {
                    if (oem !== selectedBrand.toUpperCase()) return false;
                }
            }

            // CPU Filter
            if (cpuFilter !== 'ALL') {
                const searchTxt = (asset.name || '') + ' ' + (asset.hardwareSpec || '');
                if (!searchTxt.toLowerCase().includes(cpuFilter.toLowerCase())) return false;
            }

            // RAM Filter
            if (ramFilter !== 'ALL') {
                const searchTxt = (asset.name || '') + ' ' + (asset.hardwareSpec || '');
                if (!searchTxt.toLowerCase().includes(ramFilter.toLowerCase())) return false;
            }

            // Status Filter
            if (statusFilter !== 'ALL') {
                if (statusFilter === 'Disponible' && !['Disponible', 'Nuevo', 'En Stock'].includes(asset.status)) return false;
                if (statusFilter === 'Asignado' && asset.status !== 'Asignado') return false;
                if (statusFilter === 'Mantenimiento' && !['Mantenimiento', 'Dañado'].includes(asset.status)) return false;
            }

            // Text Search
            if (locationSearch) {
                const searchLower = locationSearch.toLowerCase();
                const nameMatch = (asset.name || '').toLowerCase().includes(searchLower);
                const serialMatch = (asset.serial || '').toLowerCase().includes(searchLower);
                const idMatch = (asset.id || '').toLowerCase().includes(searchLower);
                const locMatch = (asset.locationId || '').toLowerCase().includes(searchLower);
                if (!nameMatch && !serialMatch && !idMatch && !locMatch) return false;
            }

            return true;
        });
    }, [assets, countryFilter, selectedBrand, cpuFilter, ramFilter, statusFilter, locationSearch]);

    // Group locations by aisle, filtered by country
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

    // Track visual sorting of group aisles
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

    // Sorted Grouped Locations, filtered by active filters
    const sortedGroupedLocations = useMemo(() => {
        const entries = Object.entries(groupedLocations);
        const hasActiveFilter = selectedBrand !== 'ALL' || cpuFilter !== 'ALL' || ramFilter !== 'ALL' || statusFilter !== 'ALL' || locationSearch !== '';

        const filteredEntries = entries.map(([aisle, locations]) => {
            const matchingLocs = locations.filter(loc => {
                const locAssets = assets.filter(a => a.locationId === loc.id);
                if (locationSearch) {
                    const searchLower = locationSearch.toLowerCase();
                    const locIdMatch = loc.id.toLowerCase().includes(searchLower);
                    const hasMatchingAsset = locAssets.some(a => filteredAssets.some(fa => fa.id === a.id));
                    return locIdMatch || hasMatchingAsset;
                }
                if (!hasActiveFilter) return true;
                return locAssets.some(a => filteredAssets.some(fa => fa.id === a.id));
            });
            return [aisle, matchingLocs];
        }).filter(([_, locations]) => locations.length > 0);

        filteredEntries.sort(([aisleA], [aisleB]) => {
            const idxA = groupOrder.indexOf(aisleA);
            const idxB = groupOrder.indexOf(aisleB);
            if (idxA === -1 && idxB === -1) return aisleA.localeCompare(aisleB);
            if (idxA === -1) return 1;
            if (idxB === -1) return -1;
            return idxA - idxB;
        });
        return filteredEntries;
    }, [groupedLocations, groupOrder, filteredAssets, selectedBrand, cpuFilter, ramFilter, statusFilter, locationSearch, assets]);

    // Split between Location W and Location H
    const locationsW = useMemo(() => {
        return sortedGroupedLocations.filter(([aisle]) => !isLocH(aisle));
    }, [sortedGroupedLocations]);

    const locationsH = useMemo(() => {
        return sortedGroupedLocations.filter(([aisle]) => isLocH(aisle));
    }, [sortedGroupedLocations]);

    // Stats calculations
    const totalAssetsW = useMemo(() => {
        return assets.filter(a => {
            if (countryFilter !== 'Todos' && a.country !== countryFilter) return false;
            if (!a.locationId) return false;
            const loc = warehouseLocations.find(l => l.id === a.locationId);
            return loc && !isLocH(loc.aisle);
        }).length;
    }, [assets, warehouseLocations, countryFilter]);

    const totalAssetsH = useMemo(() => {
        return assets.filter(a => {
            if (countryFilter !== 'Todos' && a.country !== countryFilter) return false;
            if (!a.locationId) return false;
            const loc = warehouseLocations.find(l => l.id === a.locationId);
            return loc && isLocH(loc.aisle);
        }).length;
    }, [assets, warehouseLocations, countryFilter]);

    const statusCounts = useMemo(() => {
        const filtered = assets.filter(a => {
            if (countryFilter !== 'Todos' && a.country !== countryFilter) return false;
            return !!a.locationId;
        });
        const enStock = filtered.filter(a => ['Disponible', 'Nuevo', 'En Stock', 'Recuperado'].includes(a.status)).length;
        const asignado = filtered.filter(a => a.status === 'Asignado').length;
        const mantenimiento = filtered.filter(a => ['Mantenimiento', 'Dañado'].includes(a.status)).length;
        const actualTotal = filtered.length;
        return { enStock, asignado, mantenimiento, total: actualTotal || 1, actualTotal };
    }, [assets, countryFilter]);

    const targetLocationsGrouped = useMemo(() => {
        const groups = {};
        const filtered = warehouseLocations.filter(loc => 
            countryFilter === 'Todos' || loc.country === countryFilter
        );
        filtered.forEach(loc => {
            if (!groups[loc.aisle]) groups[loc.aisle] = [];
            groups[loc.aisle].push(loc);
        });
        Object.keys(groups).forEach(aisle => {
            groups[aisle].sort((a, b) => {
                if (a.section !== b.section) return String(a.section).localeCompare(String(b.section));
                return String(a.level).localeCompare(String(b.level));
            });
        });
        return groups;
    }, [warehouseLocations, countryFilter]);

    const moveGroup = (aisle, direction) => {
        const isH = isLocH(aisle);
        const sameTypeAisles = groupOrder.filter(a => isLocH(a) === isH);
        const idxInType = sameTypeAisles.indexOf(aisle);
        if (idxInType === -1) return;
        
        let swapWithAisle = null;
        if (direction === 'up' && idxInType > 0) {
            swapWithAisle = sameTypeAisles[idxInType - 1];
        } else if (direction === 'down' && idxInType < sameTypeAisles.length - 1) {
            swapWithAisle = sameTypeAisles[idxInType + 1];
        }
        
        if (!swapWithAisle) return;
        
        const newOrder = [...groupOrder];
        const idxA = newOrder.indexOf(aisle);
        const idxB = newOrder.indexOf(swapWithAisle);
        if (idxA !== -1 && idxB !== -1) {
            newOrder[idxA] = swapWithAisle;
            newOrder[idxB] = aisle;
            setGroupOrder(newOrder);
            localStorage.setItem(`warehouse_group_order_${countryFilter}`, JSON.stringify(newOrder));
        }
    };

    const sortGroupsAlphabetically = (isH) => {
        const sameTypeAisles = groupOrder.filter(a => isLocH(a) === isH);
        const sorted = [...sameTypeAisles].sort((a, b) => a.localeCompare(b));
        
        const newOrder = [...groupOrder];
        let sortedIdx = 0;
        for (let i = 0; i < newOrder.length; i++) {
            if (isLocH(newOrder[i]) === isH) {
                newOrder[i] = sorted[sortedIdx];
                sortedIdx++;
            }
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

            const normalizedBuffer = buffer.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
            if (normalizedBuffer.endsWith('CMDTOGGLESCAN')) {
                toggleScanMode();
                buffer = '';
                
                if (document.activeElement && (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA')) {
                    setTimeout(() => {
                        const valNorm = document.activeElement.value.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
                        if (valNorm.includes('CMDTOGGLESCAN')) {
                            document.activeElement.value = '';
                        }
                        setSearchQuery('');
                    }, 10);
                }
            }
        };

        window.addEventListener('keydown', handleGlobalKeyDown);
        return () => window.removeEventListener('keydown', handleGlobalKeyDown);
    }, [toggleScanMode]);

    const handlePrintControlBarcode = () => {
        try {
            const command = "CMDTOGGLESCAN";
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

    const handleScanAsset = (e) => {
        e.preventDefault();
        const val = searchQuery.trim().toUpperCase();
        if (val.replace(/[^A-Z0-9]/g, '') === 'CMDTOGGLESCAN') {
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

    const handleScanLocation = (locationId) => {
        const searchNorm = normalizeId(locationId);
        const loc = warehouseLocations.find(l => 
            normalizeId(l.id) === searchNorm
        );

        if (!loc) {
            alert("Ubicación no encontrada: " + locationId);
            return;
        }

        setSelectedGroup(null);

        if (isAuditMode) {
            setAuditLocation(loc);
            setScannedAuditAssets([]);
            return;
        }

        if (mappingStep === 2 && scannedAsset) {
            confirmMapping(scannedAsset.id, loc.id);
        } else {
            setSelectedLocation(loc);
            const locAssets = assets.filter(a => a.locationId === loc.id);
            if (locAssets.length === 1) {
                setSelectedAssetId(locAssets[0].id);
            } else {
                setSelectedAssetId(null);
            }
        }
    };

    const handleLocationSearchSubmit = (e) => {
        e.preventDefault();
        const val = searchQuery.trim().toUpperCase();
        if (val.replace(/[^A-Z0-9]/g, '') === 'CMDTOGGLESCAN') {
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
        if (val.replace(/[^A-Z0-9]/g, '') === 'CMDTOGGLESCAN') {
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

    const handleMoveAsset = async (e) => {
        if (e) e.preventDefault();
        if (!movingAsset || !targetLocationId) return;

        const targetAssets = assets.filter(a => a.locationId === targetLocationId);
        
        try {
            if (targetAssets.length > 0) {
                const confirmMove = window.confirm(
                    `La ubicación destino (${targetLocationId}) ya está ocupada por el activo:\n` +
                    `"${targetAssets[0].name}" (SN: ${targetAssets[0].serial || 'N/A'}).\n\n` +
                    `¿Desea agregar este activo a dicha ubicación?`
                );
                if (!confirmMove) return;
            }

            const res = await mapAssetToLocation(movingAsset.id, targetLocationId);
            if (res.error) {
                alert("Error al mover el activo: " + (res.error.message || res.error));
                return;
            }
            alert("Activo movido con éxito.");

            setIsMoveAssetModalOpen(false);
            setMovingAsset(null);
            setTargetLocationId('');
            setSelectedLocation(null);
            setSelectedAssetId(null);
        } catch (err) {
            console.error(err);
            alert("Ocurrió un error inesperado al mover el activo.");
        }
    };

    const handleMoveAllAssets = async (e) => {
        if (e) e.preventDefault();
        if (!movingAllSourceLocation || !targetAllLocationId) return;

        const sourceLocId = movingAllSourceLocation.id;
        const sourceAssets = assets.filter(a => a.locationId === sourceLocId);
        if (sourceAssets.length === 0) return;

        const targetAssets = assets.filter(a => a.locationId === targetAllLocationId);

        try {
            if (targetAssets.length > 0) {
                const confirmMove = window.confirm(
                    `La ubicación destino (${targetAllLocationId}) ya está ocupada por ${targetAssets.length} activo(s).\n\n` +
                    `¿Desea mover todos los activos (${sourceAssets.length} equipos) a dicha ubicación?`
                );
                if (!confirmMove) return;
            }

            // Move all source assets to target location
            for (const sa of sourceAssets) {
                const res = await mapAssetToLocation(sa.id, targetAllLocationId);
                if (res.error) {
                    alert("Error al mover activos: " + (res.error.message || res.error));
                    return;
                }
            }
            alert("¡Éxito! Todos los activos han sido movidos.");

            setIsMoveAllModalOpen(false);
            setMovingAllSourceLocation(null);
            setTargetAllLocationId('');
            setSelectedLocation(null);
            setSelectedAssetId(null);
        } catch (err) {
            console.error(err);
            alert("Ocurrió un error inesperado al mover los activos.");
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
            let aisleName = newLoc.aisle.trim().toUpperCase();
            aisleName = combineAisleName(newLocManufacturer, aisleName);
            
            if (newLocationType === 'H') {
                if (!aisleName.endsWith('-H')) aisleName = `${aisleName}-H`;
            } else if (newLocationType === 'W') {
                if (aisleName.endsWith('-H')) {
                    aisleName = aisleName.slice(0, -2);
                } else if (aisleName.startsWith('H-')) {
                    aisleName = aisleName.slice(2);
                }
                if (isLocH(aisleName)) {
                    // Prevent clash with legacy H names
                    aisleName = `${aisleName}-W`;
                }
            }

            const adjustedLoc = { ...newLoc, aisle: aisleName };
            const fullId = `${aisleName}-${adjustedLoc.section}-${adjustedLoc.level}`;
            const res = await addWarehouseLocation({ ...adjustedLoc, id: fullId, country: countryFilter });
            
            if (res.error) {
                if (res.error.code === '23505') {
                    alert(`La ubicación ${fullId} ya existe en el sistema.`);
                } else {
                    alert("Error al crear ubicación: " + res.error.message);
                }
            } else {
                setIsAddLocationModalOpen(false);
                setNewLoc({ id: '', aisle: '', section: '', level: '' });
                setNewLocationType('W');
                setNewLocManufacturer(manufacturers[0] || 'NINGUNO');
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
            let aisleName = editLoc.aisle.trim().toUpperCase();
            aisleName = combineAisleName(editLocManufacturer, aisleName);
            
            if (editLocationType === 'H' && !isLocH(aisleName)) {
                aisleName = `${aisleName}-H`;
            } else if (editLocationType === 'W' && isLocH(aisleName)) {
                if (aisleName.endsWith('-H')) {
                    aisleName = aisleName.slice(0, -2);
                } else if (aisleName.startsWith('H-')) {
                    aisleName = aisleName.slice(2);
                }
            }

            const res = await updateWarehouseLocation(selectedLocation.id, {
                ...selectedLocation,
                aisle: aisleName,
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

    const handleRenameGroup = async (e) => {
        e.preventDefault();
        
        let newAisle = renameGroupCategory.trim().toUpperCase();
        newAisle = combineAisleName(renameGroupManufacturer, newAisle);
        
        if (renameGroupType === 'H') {
            if (!newAisle.endsWith('-H')) newAisle = `${newAisle}-H`;
        } else if (renameGroupType === 'W') {
            if (newAisle.endsWith('-H')) {
                newAisle = newAisle.slice(0, -2);
            } else if (newAisle.startsWith('H-')) {
                newAisle = newAisle.slice(2);
            }
            if (isLocH(newAisle)) {
                newAisle = `${newAisle}-W`;
            }
        }

        if (newAisle && newAisle !== renameGroupOldName) {
            const res = await renameWarehouseGroup(renameGroupOldName, newAisle);
            if (res?.error) {
                alert("Error al renombrar: " + res.error.message);
            } else {
                setIsRenameGroupModalOpen(false);
            }
        } else {
            setIsRenameGroupModalOpen(false);
        }
    };

    const handlePrintLocationLabel = async (location) => {
        try {
            const canvas = document.createElement('canvas');
            JsBarcode(canvas, location.id, {
                format: "CODE128",
                displayValue: false,
                margin: 10,
                height: 80,
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
                                font-size: 5pt; 
                                font-weight: 800; 
                                color: #64748b; 
                                text-transform: uppercase; 
                                letter-spacing: 0.05em;
                                margin-bottom: 0.3mm;
                            }
                            .loc-aisle { 
                                font-size: 6pt; 
                                font-weight: 900; 
                                color: #000; 
                                text-transform: uppercase;
                                line-height: 1.2;
                            }
                            .loc-details { 
                                font-size: 6pt; 
                                font-weight: 700; 
                                color: #334155; 
                                margin-top: 1mm;
                                margin-bottom: 1mm;
                                line-height: 1.2;
                            }
                            .barcode-img { width: 100%; height: 14mm; object-fit: fill; }
                        </style>
                    </head>
                    <body>
                        <div class="label-container">
                            <div class="loc-region">${location.country} - LOCACIÓN ${isLocH(location.aisle) ? 'H' : 'W'}</div>
                            <div class="loc-aisle">GRUPO ${getDisplayAisle(location.aisle)}</div>
                            <div class="loc-details">${location.section} - ${location.level}</div>
                            <img src="${barcodeDataUrl}" class="barcode-img" />
                            <div style="font-size: 4pt; opacity: 0.4; font-weight: 600; text-align: right; margin-top: 0;">AssetFlow WMS</div>
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

    const renderAisle = (aisle, locations, totalAislesCount, listAislesArray, isHZone = false) => {
        const aisleAssetsCount = assets.filter(a => 
            (countryFilter === 'Todos' || a.country === countryFilter) &&
            locations.some(loc => loc.id === a.locationId)
        ).length;
        
        const badgeColor = isHZone ? '#64748b' : '#2563eb';
        
        return (
            <div key={aisle} style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h3 onClick={() => { setSelectedGroup(aisle); setSelectedLocation(null); }} style={{ fontSize: '0.78rem', fontWeight: 800, color: selectedGroup === aisle ? 'var(--primary-color)' : 'var(--text-secondary)', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0, cursor: 'pointer' }}>
                        <span style={{ borderBottom: selectedGroup === aisle ? '2px solid var(--primary-color)' : 'none' }}>{getDisplayAisle(aisle)}</span>
                        {currentUser?.role === 'admin' && (
                            <Button 
                                variant="ghost" 
                                size="xs" 
                                icon={Edit3} 
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setRenameGroupOldName(aisle);
                                    
                                    let type = isLocH(aisle) ? 'H' : 'W';
                                    let mfg = detectManufacturer(aisle, manufacturers);
                                    let cat = getDisplayAisle(aisle);
                                    
                                    if (mfg !== 'NINGUNO') {
                                        // Handle known Apple prefixes
                                        const aliases = ['MBA ', 'MBA-', 'MBP ', 'MBP-', 'MACBOOK', 'IMAC', 'MAC '];
                                        let matchedAlias = '';
                                        if (mfg === 'APPLE') {
                                            for (let alias of aliases) {
                                                if (cat.toUpperCase().startsWith(alias)) {
                                                    matchedAlias = alias;
                                                    break;
                                                }
                                            }
                                        }
                                        
                                        if (matchedAlias) {
                                            // Don't strip the alias from the category name for Apple products
                                            // The category is just the whole thing (e.g., "MBA 13 M4")
                                        } else if (cat.toUpperCase().startsWith(mfg.toUpperCase())) {
                                            let substr = cat.substring(mfg.length).trim();
                                            if (substr.startsWith('-')) substr = substr.substring(1).trim();
                                            cat = substr;
                                        }
                                    }

                                    setRenameGroupType(type);
                                    setRenameGroupManufacturer(mfg);
                                    setRenameGroupCategory(cat);
                                    
                                    setIsRenameGroupModalOpen(true);
                                }}
                                style={{ padding: '2px', height: '16px', width: '16px', opacity: 0.5 }}
                            />
                        )}
                        {!groupByBrand && totalAislesCount > 1 && (
                            <div style={{ display: 'flex', gap: '1px', alignItems: 'center', background: 'rgba(0,0,0,0.03)', borderRadius: '4px', padding: '1px' }} onClick={e => e.stopPropagation()}>
                                <Button
                                    variant="ghost"
                                    size="xs"
                                    icon={ChevronUp}
                                    onClick={() => moveGroup(aisle, 'up')}
                                    disabled={listAislesArray.findIndex(([a]) => a === aisle) === 0}
                                    style={{ padding: '2px', height: '16px', width: '16px', opacity: listAislesArray.findIndex(([a]) => a === aisle) === 0 ? 0.25 : 0.6 }}
                                    title="Mover Arriba"
                                />
                                <Button
                                    variant="ghost"
                                    size="xs"
                                    icon={ChevronDown}
                                    onClick={() => moveGroup(aisle, 'down')}
                                    disabled={listAislesArray.findIndex(([a]) => a === aisle) === listAislesArray.length - 1}
                                    style={{ padding: '2px', height: '16px', width: '16px', opacity: listAislesArray.findIndex(([a]) => a === aisle) === listAislesArray.length - 1 ? 0.25 : 0.6 }}
                                    title="Mover Abajo"
                                />
                            </div>
                        )}
                    </h3>
                    <span style={{ fontSize: '0.7rem', color: badgeColor, fontWeight: 700 }}>
                        {aisleAssetsCount} EQUIPOS
                    </span>
                </div>
                
                {/* Cell grid box */}
                <div style={{ 
                    display: 'grid', 
                    gridTemplateColumns: 'repeat(auto-fill, minmax(72px, 1fr))', 
                    gap: '6px',
                    background: 'var(--background-secondary)',
                    padding: '8px',
                    borderRadius: '8px',
                    border: '1px dashed var(--border)'
                }}>
                    {locations.sort((a,b) => a.id.localeCompare(b.id)).map(loc => {
                        const locationAssets = assets.filter(a => 
                            (countryFilter === 'Todos' || a.country === countryFilter) &&
                            a.locationId === loc.id
                        );
                        const assetCount = locationAssets.length;
                        const isSelected = selectedLocation?.id === loc.id || auditLocation?.id === loc.id;
                        
                        let bgColor = 'var(--surface)';
                        let textColor = 'var(--text-main)';
                        let borderColor = 'var(--border)';
                        let borderStyle = 'solid';

                        if (assetCount > 0) {
                            textColor = 'white';
                            const status = locationAssets[0]?.status;
                            if (['Mantenimiento', 'Dañado'].includes(status)) {
                                bgColor = '#f97316';
                            } else if (status === 'Asignado') {
                                bgColor = '#84cc16';
                            } else {
                                bgColor = '#2563eb';
                            }
                            borderColor = 'transparent';
                        } else {
                            borderStyle = 'dashed';
                        }

                        if (isAuditMode && auditLocation?.id === loc.id) {
                            bgColor = '#8b5cf6';
                            textColor = 'white';
                            borderColor = 'transparent';
                        }

                        return (
                            <div 
                                key={loc.id}
                                onClick={() => handleScanLocation(loc.id)}
                                style={{
                                    aspectRatio: '1.4/1',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    background: bgColor,
                                    color: textColor,
                                    borderRadius: '6px',
                                    border: isSelected ? `2px solid ${isAuditMode ? '#8b5cf6' : 'var(--primary-color)'}` : `1px ${borderStyle} ${borderColor}`,
                                    cursor: 'pointer',
                                    transition: 'all 0.15s ease',
                                    boxShadow: isSelected ? '0 0 8px rgba(37,99,235,0.25)' : 'none',
                                    position: 'relative'
                                }}
                                title={`${loc.id} (${assetCount} equipos)`}
                            >
                                {renderCellContent(loc, assetCount, locationAssets)}
                            </div>
                        );
                    })}
                </div>
            </div>
        );
    };

    // Donut chart angles calculation
    const total = statusCounts.total;
    const percentEnStock = (statusCounts.enStock / total) * 100;
    const percentAsignado = (statusCounts.asignado / total) * 100;

    // Helper to render customized text lines in grid cells
    const renderCellContent = (loc, assetCount, locationAssets) => {
        if (assetCount > 0) {
            const words = (loc.section || '').split(' ');
            return (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', width: '100%', padding: '2px', textAlign: 'center' }}>
                    {words.slice(0, 3).map((w, idx) => {
                        const size = w.length > 6 ? '0.58rem' : (w.length > 4 ? '0.64rem' : '0.76rem');
                        return (
                            <div key={idx} style={{ fontSize: size, fontWeight: '600', lineHeight: '1.2', letterSpacing: '0.02em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', width: '100%' }}>{w}</div>
                        );
                    })}
                    {(() => {
                        const levelStr = String(loc.level || '');
                        const size = levelStr.length > 6 ? '0.55rem' : (levelStr.length > 4 ? '0.6rem' : '0.68rem');
                        return (
                            <div style={{ fontSize: size, fontWeight: '600', lineHeight: '1.2', letterSpacing: '0.02em', marginTop: '1.2px', opacity: 0.9, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', width: '100%' }}>{levelStr}</div>
                        );
                    })()}
                </div>
            );
        } else {
            // Available
            const label = loc.id.split('-').slice(1).join('-');
            const part1 = loc.aisle.includes('COD') ? loc.section : label.split(' ')[0] || loc.level;
            const part2 = label.split(' ')[1];

            const size1 = part1.length > 6 ? '0.6rem' : (part1.length > 4 ? '0.66rem' : '0.78rem');
            
            return (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', width: '100%', padding: '2px', color: 'var(--text-secondary)' }}>
                    <div style={{ fontSize: size1, fontWeight: '600', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', width: '100%', textAlign: 'center', lineHeight: '1.2', letterSpacing: '0.02em' }}>
                        {part1}
                    </div>
                    {part2 && (() => {
                        const size2 = part2.length > 6 ? '0.55rem' : (part2.length > 4 ? '0.6rem' : '0.68rem');
                        return (
                            <div style={{ fontSize: size2, fontWeight: '600', opacity: 0.85, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', width: '100%', textAlign: 'center', marginTop: '1.2px', lineHeight: '1.2', letterSpacing: '0.02em' }}>
                                {part2}
                            </div>
                        );
                    })()}
                </div>
            );
        }
    };

    return (
        <div style={{ padding: '1rem', maxWidth: '1600px', margin: '0 auto' }}>
            {/* Header / Search Top Bar */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
                <div>
                    <h1 style={{ fontSize: '1.8rem', fontWeight: 900, marginBottom: '0.25rem', color: 'var(--text-main)' }}>Mapeo de Depósito - Inventario Consolidado</h1>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Control visual y físico de activos de cliente {countryFilter}.</p>
                </div>
                
                {/* WMS Scanners Command inputs */}
                <div style={{ flex: 1, maxWidth: '380px', minWidth: '260px' }}>
                    <form onSubmit={mappingStep === 1 && isMappingMode ? handleScanAsset : (isMappingMode ? handleLocationSearchSubmit : (e) => {
                        e.preventDefault();
                        const val = searchQuery.trim().toUpperCase();
                        if (val.replace(/[^A-Z0-9]/g, '') === 'CMDTOGGLESCAN') {
                            toggleScanMode();
                            setSearchQuery('');
                            return;
                        }
                        const searchNorm = normalizeId(searchQuery);
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
                    })}>
                        <div className="search-box">
                            <ScanLine className="search-icon" size={18} />
                            <input 
                                className="search-input"
                                placeholder="Escanear Código de Barras / Serial / Estante..."
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                            />
                        </div>
                    </form>
                </div>

                <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
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
                            style={{ borderTopRightRadius: 0, borderBottomRightRadius: 0, borderRight: 'none' }}
                        >
                            {isMappingMode ? "Cancelar Mapeo" : "Modo Escaneo"}
                        </Button>
                        <Button
                            variant={isMappingMode ? "primary" : "outline"}
                            icon={Printer}
                            onClick={handlePrintControlBarcode}
                            title="Imprimir Código de Control"
                            style={{
                                borderTopLeftRadius: 0,
                                borderBottomLeftRadius: 0,
                                padding: '0 0.75rem',
                                borderLeft: isMappingMode ? '1px solid rgba(255,255,255,0.2)' : '1px solid var(--border)'
                            }}
                        />
                    </div>
                    <Button 
                        variant={groupByBrand ? "primary" : "outline"} 
                        icon={SlidersHorizontal}
                        onClick={() => setGroupByBrand(!groupByBrand)}
                        style={{ borderColor: groupByBrand ? 'transparent' : '#3b82f6', color: groupByBrand ? 'white' : '#3b82f6' }}
                    >
                        {groupByBrand ? "Vista Plana" : "Agrupar Fabricantes"}
                    </Button>
                    <Button icon={Plus} onClick={() => {
                        setNewLoc({ id: '', aisle: '', section: '', level: '' });
                        setNewLocationType('W');
                        setNewLocManufacturer(manufacturers[0] || 'NINGUNO');
                        setIsAddLocationModalOpen(true);
                    }}>Nueva Ubicación</Button>
                </div>
            </div>

            {/* Dashboard grid structure */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: '1.5rem', alignItems: 'start' }} className="flex-mobile-column">
                
                {/* Main Mapping Columns (Locación W and Locación H) */}
                <div style={{ display: 'flex', gap: '1.5rem', minHeight: '600px' }} className="flex-mobile-column">
                    
                    {/* LOCACIÓN W */}
                    <Card style={{ flex: 1, padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                        <div style={{ borderBottom: '2px solid var(--border)', paddingBottom: '0.75rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                <h2 style={{ fontSize: '1.4rem', fontWeight: 900, letterSpacing: '0.05em', margin: 0, color: 'var(--text-main)' }}>LOCACIÓN W</h2>
                                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#2563eb', backgroundColor: '#eff6ff', padding: '3px 8px', borderRadius: '12px' }}>
                                    {locationsW.length} Grupos
                                </span>
                            </div>
                            <Button
                                variant="outline"
                                size="xs"
                                icon={ArrowUpDown}
                                onClick={() => sortGroupsAlphabetically(false)}
                                title="Ordenar Grupos W (A-Z)"
                                style={{ fontSize: '0.7rem', padding: '3px 8px', height: '24px' }}
                            >
                                Ordenar A-Z
                            </Button>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                            {locationsW.length === 0 ? (
                                <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--text-secondary)' }}>
                                    <Navigation size={36} style={{ margin: '0 auto 0.75rem', opacity: 0.2 }} />
                                    <p style={{ fontSize: '0.85rem' }}>No hay grupos coincidentes.</p>
                                </div>
                            ) : (
                                groupByBrand ? (
                                    (() => {
                                        const groupedW = getGroupedByBrand(locationsW, manufacturers);
                                        return Object.entries(groupedW).filter(([_, items]) => items.length > 0).map(([brandName, items]) => {
                                            const brandAssetsCount = items.reduce((acc, [_, locations]) => {
                                                const locIds = locations.map(l => l.id);
                                                return acc + assets.filter(a => (countryFilter === 'Todos' || a.country === countryFilter) && locIds.includes(a.locationId)).length;
                                            }, 0);
                                            return (
                                                <div key={brandName} style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', border: '1px solid var(--border)', borderRadius: '10px', padding: '0.85rem', background: 'var(--background-secondary)' }}>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border)', paddingBottom: '0.4rem', marginBottom: '0.25rem' }}>
                                                        <h3 style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--text-main)', margin: 0, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{brandName}</h3>
                                                        <span style={{ fontSize: '0.65rem', fontWeight: 700, color: '#2563eb', backgroundColor: '#eff6ff', padding: '2px 8px', borderRadius: '10px' }}>
                                                            {items.length} grupos • {brandAssetsCount} equipos
                                                        </span>
                                                    </div>
                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', padding: '0.25rem 0' }}>
                                                        {items.map(([aisle, locations]) => renderAisle(aisle, locations, locationsW.length, locationsW, false))}
                                                    </div>
                                                </div>
                                            );
                                        });
                                    })()
                                ) : (
                                    locationsW.map(([aisle, locations]) => renderAisle(aisle, locations, locationsW.length, locationsW, false))
                                )
                            )}
                        </div>
                    </Card>

                    {/* LOCACIÓN H */}
                    <Card style={{ flex: 1, padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                        <div style={{ borderBottom: '2px solid var(--border)', paddingBottom: '0.75rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                <h2 style={{ fontSize: '1.4rem', fontWeight: 900, letterSpacing: '0.05em', margin: 0, color: 'var(--text-main)' }}>LOCACIÓN H</h2>
                                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', backgroundColor: 'var(--background-secondary)', padding: '3px 8px', borderRadius: '12px' }}>
                                    {locationsH.length} Grupos
                                </span>
                            </div>
                            <Button
                                variant="outline"
                                size="xs"
                                icon={ArrowUpDown}
                                onClick={() => sortGroupsAlphabetically(true)}
                                title="Ordenar Grupos H (A-Z)"
                                style={{ fontSize: '0.7rem', padding: '3px 8px', height: '24px' }}
                            >
                                Ordenar A-Z
                            </Button>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                            {locationsH.length === 0 ? (
                                <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--text-secondary)' }}>
                                    <Navigation size={36} style={{ margin: '0 auto 0.75rem', opacity: 0.2 }} />
                                    <p style={{ fontSize: '0.85rem' }}>No hay grupos coincidentes.</p>
                                </div>
                            ) : (
                                groupByBrand ? (
                                    (() => {
                                        const groupedH = getGroupedByBrand(locationsH, manufacturers);
                                        return Object.entries(groupedH).filter(([_, items]) => items.length > 0).map(([brandName, items]) => {
                                            const brandAssetsCount = items.reduce((acc, [_, locations]) => {
                                                const locIds = locations.map(l => l.id);
                                                return acc + assets.filter(a => (countryFilter === 'Todos' || a.country === countryFilter) && locIds.includes(a.locationId)).length;
                                            }, 0);
                                            return (
                                                <div key={brandName} style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', border: '1px solid var(--border)', borderRadius: '10px', padding: '0.85rem', background: 'var(--background-secondary)' }}>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border)', paddingBottom: '0.4rem', marginBottom: '0.25rem' }}>
                                                        <h3 style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--text-main)', margin: 0, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{brandName}</h3>
                                                        <span style={{ fontSize: '0.65rem', fontWeight: 700, color: '#64748b', backgroundColor: '#e2e8f0', padding: '2px 8px', borderRadius: '10px' }}>
                                                            {items.length} grupos • {brandAssetsCount} equipos
                                                        </span>
                                                    </div>
                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', padding: '0.25rem 0' }}>
                                                        {items.map(([aisle, locations]) => renderAisle(aisle, locations, locationsH.length, locationsH, true))}
                                                    </div>
                                                </div>
                                            );
                                        });
                                    })()
                                ) : (
                                    locationsH.map(([aisle, locations]) => renderAisle(aisle, locations, locationsH.length, locationsH, true))
                                )
                            )}
                        </div>
                    </Card>
                </div>

                {/* Right Sidebar - Stats, brand filters, details */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                    
                    {/* WMS Scanners Consoles */}
                    {isMappingMode && (
                        <Card style={{ padding: '1.25rem', border: '2px solid var(--primary-color)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
                                <ScanLine size={18} color="var(--primary-color)" />
                                <h3 style={{ fontSize: '0.95rem', fontWeight: 800 }}>Consola de Mapping</h3>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                <div style={{ padding: '0.75rem', background: 'var(--background)', borderRadius: '8px', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                    <div style={{ width: '22px', height: '22px', borderRadius: '50%', background: mappingStep >= 1 ? 'var(--primary-color)' : 'var(--border)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.65rem', fontWeight: 800 }}>1</div>
                                    <span style={{ fontSize: '0.8rem', fontWeight: 700, display: 'flex', flexDirection: 'column' }}>
                                        {scannedAsset ? `Activo: ${scannedAsset.id}` : "Escanee el Activo"}
                                        {scannedAsset?.locationId && <span style={{ fontSize: '0.65rem', color: '#f59e0b' }}>En: {scannedAsset.locationId}</span>}
                                    </span>
                                    {scannedAsset && <CheckCircle2 size={14} color="#22c55e" style={{ marginLeft: 'auto' }} />}
                                </div>
                                <div style={{ padding: '0.75rem', background: 'var(--background)', borderRadius: '8px', border: mappingStep === 2 ? '1px solid var(--primary-color)' : '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '0.75rem', opacity: mappingStep === 2 ? 1 : 0.5 }}>
                                    <div style={{ width: '22px', height: '22px', borderRadius: '50%', background: mappingStep >= 2 ? 'var(--primary-color)' : 'var(--border)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.65rem', fontWeight: 800 }}>2</div>
                                    <span style={{ fontSize: '0.8rem', fontWeight: 700 }}>Escanee la Ubicación</span>
                                </div>
                                <form onSubmit={mappingStep === 1 ? handleScanAsset : handleLocationSearchSubmit}>
                                    <div className="search-box">
                                        <Scan className="search-icon" size={16} />
                                        <input 
                                            className="search-input"
                                            placeholder={mappingStep === 1 ? "Scan Activo..." : "Scan Ubicación..."}
                                            value={searchQuery}
                                            onChange={e => setSearchQuery(e.target.value)}
                                            autoFocus
                                        />
                                    </div>
                                </form>
                            </div>
                        </Card>
                    )}

                    {isAuditMode && (
                        <Card style={{ padding: '1.25rem', border: '2px solid #8b5cf6' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
                                <ShieldCheck size={18} color="#8b5cf6" />
                                <h3 style={{ fontSize: '0.95rem', fontWeight: 800 }}>Consola de Auditoría</h3>
                            </div>
                            {!auditLocation ? (
                                <div style={{ textAlign: 'center', padding: '1.25rem', background: 'rgba(139, 92, 246, 0.04)', borderRadius: '10px', border: '1px dashed #8b5cf6' }}>
                                    <p style={{ fontSize: '0.8rem', color: '#6d28d9', fontWeight: 700 }}>Seleccione un estante en el mapa para iniciar la auditoría.</p>
                                </div>
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem 0.75rem', background: '#8b5cf6', color: 'white', borderRadius: '8px', fontWeight: 800, fontSize: '0.8rem' }}>
                                        <span>Auditando: {auditLocation.id}</span>
                                        <span>{assets.filter(a => a.locationId === auditLocation.id).length} items</span>
                                    </div>
                                    <form onSubmit={handleAuditScan}>
                                        <div className="search-box">
                                            <Scan className="search-icon" size={16} />
                                            <input 
                                                className="search-input"
                                                placeholder="Escanee activo físicamente..."
                                                value={auditSearchQuery}
                                                onChange={e => setAuditSearchQuery(e.target.value)}
                                                autoFocus
                                            />
                                        </div>
                                    </form>
                                    <div style={{ maxHeight: '180px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                        {assets.filter(a => a.locationId === auditLocation.id).map(expected => {
                                            const isFound = scannedAuditAssets.find(s => s.id === expected.id);
                                            return (
                                                <div key={expected.id} style={{ padding: '0.5rem', borderRadius: '6px', background: isFound ? 'rgba(34, 197, 94, 0.08)' : 'rgba(0,0,0,0.02)', border: `1px solid ${isFound ? '#22c55e' : 'var(--border)'}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.75rem' }}>
                                                    <span style={{ fontWeight: 600 }}>{expected.name}</span>
                                                    {isFound ? <CheckCircle2 size={12} color="#22c55e" /> : <div style={{ width: '12px', height: '12px', borderRadius: '50%', border: '1px solid #ccc' }} />}
                                                </div>
                                            );
                                        })}
                                        {scannedAuditAssets.filter(s => s.locationId !== auditLocation.id).map(extra => (
                                            <div key={extra.id} style={{ padding: '0.5rem', borderRadius: '6px', background: 'rgba(239, 68, 68, 0.08)', border: '1px solid #ef4444', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.75rem', color: '#ef4444' }}>
                                                <span style={{ fontWeight: 600 }}>Extra: {extra.name}</span>
                                                <XCircle size={12} color="#ef4444" />
                                            </div>
                                        ))}
                                    </div>
                                    <Button fullWidth style={{ background: '#8b5cf6', color: 'white' }} onClick={finishAudit}>
                                        Finalizar Auditoría
                                    </Button>
                                </div>
                            )}
                        </Card>
                    )}

                    {/* Resumen y Filtros Rápidos */}
                    <Card style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                        <h3 style={{ fontSize: '1.05rem', fontWeight: 900, margin: 0, borderBottom: '1px solid var(--border)', paddingBottom: '0.5rem' }}>Resumen y Filtros Rápidos</h3>
                        
                        {/* Vista Rápida de Stock */}
                        <div>
                            <h4 style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--text-secondary)', marginBottom: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Vista Rápida de Stock</h4>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                <div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', fontWeight: 700, marginBottom: '0.2rem' }}>
                                        <span>Stock Total W</span>
                                        <span>{totalAssetsW}</span>
                                    </div>
                                    <div style={{ width: '100%', height: '12px', background: 'var(--background-secondary)', borderRadius: '6px', overflow: 'hidden' }}>
                                        <div style={{ 
                                            width: `${(totalAssetsW / Math.max(totalAssetsW + totalAssetsH, 1)) * 100}%`, 
                                            height: '100%', 
                                            background: '#2563eb', 
                                            borderRadius: '6px', 
                                            transition: 'width 0.4s ease' 
                                        }}></div>
                                    </div>
                                </div>
                                <div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', fontWeight: 700, marginBottom: '0.2rem' }}>
                                        <span>Stock Total H</span>
                                        <span>{totalAssetsH}</span>
                                    </div>
                                    <div style={{ width: '100%', height: '12px', background: 'var(--background-secondary)', borderRadius: '6px', overflow: 'hidden' }}>
                                        <div style={{ 
                                            width: `${(totalAssetsH / Math.max(totalAssetsW + totalAssetsH, 1)) * 100}%`, 
                                            height: '100%', 
                                            background: '#64748b', 
                                            borderRadius: '6px', 
                                            transition: 'width 0.4s ease' 
                                        }}></div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Estado Global (Donut Chart) */}
                        <div>
                            <h4 style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--text-secondary)', marginBottom: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Estado Global</h4>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
                                {/* Custom CSS Conic-Gradient Donut */}
                                <div style={{
                                    width: '100px',
                                    height: '100px',
                                    borderRadius: '50%',
                                    background: `conic-gradient(
                                        #2563eb 0% ${percentEnStock}%, 
                                        #84cc16 ${percentEnStock}% ${percentEnStock + percentAsignado}%, 
                                        #f97316 ${percentEnStock + percentAsignado}% 100%
                                    )`,
                                    position: 'relative',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    boxShadow: 'inset 0 0 1px rgba(0,0,0,0.1)'
                                }}>
                                    <div style={{
                                        width: '64px',
                                        height: '64px',
                                        borderRadius: '50%',
                                        backgroundColor: 'var(--surface)',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        fontSize: '0.7rem',
                                        fontWeight: 800
                                    }}>
                                        <span style={{ color: 'var(--text-secondary)', fontSize: '0.55rem', textTransform: 'uppercase' }}>Total</span>
                                        <span style={{ fontSize: '1.1rem', color: 'var(--text-main)' }}>{statusCounts.actualTotal}</span>
                                    </div>
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', flex: 1 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', fontWeight: 700 }}>
                                        <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#2563eb' }}></div>
                                        <span style={{ flex: 1 }}>En Stock</span>
                                        <span style={{ color: 'var(--text-secondary)' }}>{statusCounts.enStock}</span>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', fontWeight: 700 }}>
                                        <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#84cc16' }}></div>
                                        <span style={{ flex: 1 }}>Asignado</span>
                                        <span style={{ color: 'var(--text-secondary)' }}>{statusCounts.asignado}</span>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', fontWeight: 700 }}>
                                        <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#f97316' }}></div>
                                        <span style={{ flex: 1 }}>Mantenim.</span>
                                        <span style={{ color: 'var(--text-secondary)' }}>{statusCounts.mantenimiento}</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Filtros de Marca */}
                        <div>
                            <h4 style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--text-secondary)', marginBottom: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Filtros de Marca</h4>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem' }}>
                                <button
                                    onClick={() => setSelectedBrand('ALL')}
                                    style={{
                                        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', padding: '6px',
                                        background: selectedBrand === 'ALL' ? 'var(--primary-color)' : 'var(--background-secondary)',
                                        color: selectedBrand === 'ALL' ? 'white' : 'var(--text-main)',
                                        border: '1px solid var(--border)',
                                        borderRadius: '8px', cursor: 'pointer', outline: 'none',
                                        transition: 'all 0.15s ease'
                                    }}
                                >
                                    <div style={{ width: '28px', height: '28px', borderRadius: '50%', backgroundColor: selectedBrand === 'ALL' ? 'rgba(255,255,255,0.2)' : '#e2e8f0', color: selectedBrand === 'ALL' ? 'white' : '#64748b', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 800 }}>★</div>
                                    <span style={{ fontSize: '0.65rem', fontWeight: 700 }}>Todos</span>
                                </button>

                                {manufacturers.map(m => {
                                    const isSel = selectedBrand === m;
                                    return (
                                        <button
                                            key={m}
                                            onClick={() => setSelectedBrand(m)}
                                            style={{
                                                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', padding: '6px',
                                                background: isSel ? 'var(--primary-color)' : 'var(--background-secondary)',
                                                color: isSel ? 'white' : 'var(--text-main)',
                                                border: '1px solid var(--border)',
                                                borderRadius: '8px', cursor: 'pointer', outline: 'none',
                                                transition: 'all 0.15s ease'
                                            }}
                                        >
                                            <div style={{ width: '28px', height: '28px', borderRadius: '50%', backgroundColor: isSel ? 'rgba(255,255,255,0.2)' : '#e2e8f0', color: isSel ? 'white' : '#64748b', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 800 }}>
                                                {m.substring(0, 2)}
                                            </div>
                                            <span style={{ fontSize: '0.65rem', fontWeight: 700 }}>{m}</span>
                                        </button>
                                    );
                                })}

                                <button 
                                    onClick={() => setIsManageManufacturersOpen(true)}
                                    style={{
                                        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', padding: '6px',
                                        background: 'var(--background-secondary)', border: '1px solid var(--border)',
                                        borderRadius: '8px', cursor: 'pointer', outline: 'none'
                                    }}
                                >
                                    <div style={{ width: '28px', height: '28px', borderRadius: '50%', backgroundColor: '#e2e8f0', color: '#64748b', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem', fontWeight: 800 }}>+</div>
                                    <span style={{ fontSize: '0.65rem', fontWeight: 700 }}>Gestionar</span>
                                </button>
                            </div>
                        </div>
                    </Card>

                    {/* Búsqueda Avanzada */}
                    <Card style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.5rem' }}>
                            <SlidersHorizontal size={16} />
                            <h3 style={{ fontSize: '0.95rem', fontWeight: 800, margin: 0 }}>Búsqueda Avanzada</h3>
                        </div>

                        <div className="search-box">
                            <Search className="search-icon" size={16} />
                            <input 
                                className="search-input"
                                placeholder="Buscar Ubicación o Serial..."
                                value={locationSearch}
                                onChange={e => setLocationSearch(e.target.value)}
                                style={{ padding: '0.5rem 1rem 0.5rem 2.25rem', fontSize: '0.8rem' }}
                            />
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                            <div>
                                <label style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', display: 'block', marginBottom: '0.25rem' }}>CPU</label>
                                <select 
                                    value={cpuFilter} 
                                    onChange={e => setCpuFilter(e.target.value)}
                                    style={{ width: '100%', padding: '0.4rem 0.5rem', borderRadius: '6px', border: '1px solid var(--border)', backgroundColor: 'var(--background)', color: 'var(--text-main)', fontSize: '0.8rem', outline: 'none' }}
                                >
                                    <option value="ALL">Cualquier CPU</option>
                                    <option value="M4">Apple M4</option>
                                    <option value="M3">Apple M3</option>
                                    <option value="M2">Apple M2</option>
                                    <option value="M1">Apple M1</option>
                                    <option value="Ultra">Intel Ultra</option>
                                    <option value="Core">Intel Core</option>
                                    <option value="i7">Core i7</option>
                                    <option value="i5">Core i5</option>
                                </select>
                            </div>

                            <div>
                                <label style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', display: 'block', marginBottom: '0.25rem' }}>Memoria RAM</label>
                                <select 
                                    value={ramFilter} 
                                    onChange={e => setRamFilter(e.target.value)}
                                    style={{ width: '100%', padding: '0.4rem 0.5rem', borderRadius: '6px', border: '1px solid var(--border)', backgroundColor: 'var(--background)', color: 'var(--text-main)', fontSize: '0.8rem', outline: 'none' }}
                                >
                                    <option value="ALL">Cualquier RAM</option>
                                    <option value="64GB">64 GB</option>
                                    <option value="48GB">48 GB</option>
                                    <option value="36GB">36 GB</option>
                                    <option value="32GB">32 GB</option>
                                    <option value="24GB">24 GB</option>
                                    <option value="16GB">16 GB</option>
                                    <option value="8GB">8 GB</option>
                                </select>
                            </div>

                            <div>
                                <label style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', display: 'block', marginBottom: '0.25rem' }}>Estado</label>
                                <select 
                                    value={statusFilter} 
                                    onChange={e => setStatusFilter(e.target.value)}
                                    style={{ width: '100%', padding: '0.4rem 0.5rem', borderRadius: '6px', border: '1px solid var(--border)', backgroundColor: 'var(--background)', color: 'var(--text-main)', fontSize: '0.8rem', outline: 'none' }}
                                >
                                    <option value="ALL">Cualquier Estado</option>
                                    <option value="Disponible">En Stock / Disponible</option>
                                    <option value="Asignado">Asignado</option>
                                    <option value="Mantenimiento">Mantenimiento / Dañado</option>
                                </select>
                            </div>
                        </div>
                    </Card>

                    {/* Información de Selección */}
                    {(() => {
                        if (selectedGroup) {
                            const groupLocs = warehouseLocations.filter(l => l.aisle === selectedGroup && (countryFilter === 'Todos' || l.country === countryFilter));
                            const groupLocIds = groupLocs.map(l => l.id);
                            const groupAssets = assets.filter(a => groupLocIds.includes(a.locationId));
                            
                            return (
                                <Card style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.75rem', maxHeight: '500px', overflowY: 'auto' }}>
                                    <div style={{ borderBottom: '1px solid var(--border)', paddingBottom: '0.5rem', position: 'sticky', top: '-1.25rem', backgroundColor: 'var(--surface)', zIndex: 10 }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                            <div>
                                                <span style={{ fontSize: '0.65rem', fontWeight: 800, color: 'var(--primary-color)', textTransform: 'uppercase' }}>Información de Grupo</span>
                                                <h3 style={{ fontSize: '1.05rem', fontWeight: 900, margin: 0, marginTop: '2px' }}>Grupo: {selectedGroup}</h3>
                                                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '2px' }}>Total: {groupAssets.length} equipos</div>
                                            </div>
                                            {groupAssets.length > 0 && (
                                                <Button 
                                                    variant="outline" 
                                                    size="sm" 
                                                    icon={Download} 
                                                    onClick={() => {
                                                        const wb = XLSX.utils.book_new();
                                                        const dataToExport = groupAssets.map(a => ({
                                                            'ID': a.id,
                                                            'Nombre': a.name,
                                                            'Modelo': a.modelNumber || a.hardwareSpec || 'N/A',
                                                            'Número de Serie': a.serial || 'N/A',
                                                            'Estado': a.status,
                                                            'Ubicación': a.locationId || 'N/A',
                                                            'Asignado a': a.assignee || 'Almacén',
                                                            'Última Actualización': a.date_last_update ? new Date(a.date_last_update).toLocaleDateString() : 'N/A',
                                                            'Notas': a.notes || ''
                                                        }));
                                                        const ws = XLSX.utils.json_to_sheet(dataToExport);
                                                        XLSX.utils.book_append_sheet(wb, ws, "Equipos");
                                                        XLSX.writeFile(wb, `Equipos_Grupo_${selectedGroup}_${new Date().toISOString().split('T')[0]}.xlsx`);
                                                    }}
                                                    style={{ height: '28px', fontSize: '0.75rem', padding: '0 8px' }}
                                                >
                                                    Exportar
                                                </Button>
                                            )}
                                        </div>
                                    </div>

                                    {groupAssets.length > 0 ? (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                            {groupAssets.map(asset => (
                                                <div 
                                                    key={asset.id} 
                                                    onClick={() => {
                                                        const loc = warehouseLocations.find(l => l.id === asset.locationId);
                                                        if (loc) setSelectedLocation(loc);
                                                        setSelectedGroup(null);
                                                        setSelectedAssetId(asset.id);
                                                    }}
                                                    style={{ fontSize: '0.8rem', padding: '0.6rem', background: 'var(--background-secondary)', borderRadius: '6px', border: '1px solid var(--border)', cursor: 'pointer' }}
                                                >
                                                    <div style={{ fontWeight: 700, marginBottom: '2px' }}>{asset.name}</div>
                                                    {asset.hardwareSpec && <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>{asset.hardwareSpec}</div>}
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                        <span style={{ fontFamily: 'monospace', fontWeight: 700, color: 'var(--text-main)' }}>{asset.serial || 'N/A'}</span>
                                                        <span style={{ 
                                                            padding: '2px 6px', borderRadius: '4px', fontSize: '0.65rem', fontWeight: 800,
                                                            backgroundColor: ['Mantenimiento', 'Dañado'].includes(asset.status) ? '#fff7ed' : (asset.status === 'Asignado' ? '#f0fdf4' : '#eff6ff'),
                                                            color: ['Mantenimiento', 'Dañado'].includes(asset.status) ? '#ea580c' : (asset.status === 'Asignado' ? '#16a34a' : '#2563eb'),
                                                            border: '1px solid currentColor'
                                                        }}>
                                                            {asset.status}
                                                        </span>
                                                    </div>
                                                    <div style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                                                        Ubicación: <span style={{ fontWeight: 600 }}>{asset.locationId}</span>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <div style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: '1rem', fontSize: '0.8rem' }}>No hay equipos en este grupo.</div>
                                    )}
                                </Card>
                            );
                        }

                        if (!selectedLocation) {
                            return (
                                <Card style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', color: 'var(--text-secondary)', minHeight: '180px' }}>
                                    <History size={32} style={{ opacity: 0.15, marginBottom: '0.75rem' }} />
                                    <p style={{ fontSize: '0.8rem', margin: 0 }}>Seleccione una ubicación en el mapa para ver sus detalles.</p>
                                </Card>
                            );
                        }
                        const locationAssets = assets.filter(a => a.locationId === selectedLocation.id);
                        const asset = selectedAssetId ? locationAssets.find(a => a.id === selectedAssetId) : null;

                        if (locationAssets.length > 0 && !asset) {
                            return (
                                <Card style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.75rem', maxHeight: '500px', overflowY: 'auto' }}>
                                    <div style={{ borderBottom: '1px solid var(--border)', paddingBottom: '0.5rem', position: 'sticky', top: '-1.25rem', backgroundColor: 'var(--surface)', zIndex: 10 }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                            <div>
                                                <span style={{ fontSize: '0.65rem', fontWeight: 800, color: 'var(--primary-color)', textTransform: 'uppercase' }}>Equipos en Ubicación</span>
                                                <h3 style={{ fontSize: '1.05rem', fontWeight: 900, margin: 0, marginTop: '2px' }}>Ubicación: {selectedLocation.id}</h3>
                                                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '2px' }}>Total: {locationAssets.length} equipos</div>
                                            </div>
                                            {locationAssets.length > 0 && (
                                                <Button 
                                                    variant="outline" 
                                                    size="sm" 
                                                    icon={Download} 
                                                    onClick={() => {
                                                        const wb = XLSX.utils.book_new();
                                                        // Prepare data for export
                                                        const dataToExport = locationAssets.map(a => ({
                                                            'ID': a.id,
                                                            'Nombre': a.name,
                                                            'Modelo': a.modelNumber || a.hardwareSpec || 'N/A',
                                                            'Número de Serie': a.serial || 'N/A',
                                                            'Estado': a.status,
                                                            'Ubicación': a.locationId || 'N/A',
                                                            'Asignado a': a.assignee || 'Almacén',
                                                            'Última Actualización': a.date_last_update ? new Date(a.date_last_update).toLocaleDateString() : 'N/A',
                                                            'Notas': a.notes || ''
                                                        }));
                                                        const ws = XLSX.utils.json_to_sheet(dataToExport);
                                                        XLSX.utils.book_append_sheet(wb, ws, "Equipos");
                                                        XLSX.writeFile(wb, `Equipos_${selectedLocation.id}_${new Date().toISOString().split('T')[0]}.xlsx`);
                                                    }}
                                                    style={{ height: '28px', fontSize: '0.75rem', padding: '0 8px' }}
                                                >
                                                    Exportar
                                                </Button>
                                            )}
                                        </div>
                                    </div>
                                    
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                        {locationAssets.map(a => (
                                            <div 
                                                key={a.id} 
                                                onClick={() => setSelectedAssetId(a.id)}
                                                style={{ fontSize: '0.8rem', padding: '0.6rem', background: 'var(--background-secondary)', borderRadius: '6px', border: '1px solid var(--border)', cursor: 'pointer' }}
                                            >
                                                <div style={{ fontWeight: 700, marginBottom: '2px' }}>{a.name}</div>
                                                {a.hardwareSpec && <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>{a.hardwareSpec}</div>}
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                    <span style={{ fontFamily: 'monospace', fontWeight: 700, color: 'var(--text-main)' }}>{a.serial || 'N/A'}</span>
                                                    <span style={{ 
                                                        padding: '2px 6px', borderRadius: '4px', fontSize: '0.65rem', fontWeight: 800,
                                                        backgroundColor: ['Mantenimiento', 'Dañado'].includes(a.status) ? '#fff7ed' : (a.status === 'Asignado' ? '#f0fdf4' : '#eff6ff'),
                                                        color: ['Mantenimiento', 'Dañado'].includes(a.status) ? '#ea580c' : (a.status === 'Asignado' ? '#16a34a' : '#2563eb'),
                                                        border: '1px solid currentColor'
                                                    }}>
                                                        {a.status}
                                                    </span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                    
                                    <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
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
                                                setEditLocationType(isLocH(selectedLocation.aisle) ? 'H' : 'W');
                                                setEditLocManufacturer(detectManufacturer(selectedLocation.aisle, manufacturers));
                                                setIsEditLocationModalOpen(true);
                                            }}
                                            style={{ flex: 1, height: '32px', fontSize: '0.75rem' }}
                                        >Editar</Button>
                                        <Button 
                                            variant="outline" 
                                            size="sm" 
                                            icon={Printer} 
                                            onClick={() => handlePrintLocationLabel(selectedLocation)}
                                            style={{ flex: 1, height: '32px', fontSize: '0.75rem' }}
                                        >Etiqueta</Button>
                                    </div>
                                    <Button 
                                        variant="primary" 
                                        size="sm" 
                                        icon={Navigation} 
                                        onClick={() => {
                                            setMovingAllSourceLocation(selectedLocation);
                                            setTargetAllLocationId('');
                                            setIsMoveAllModalOpen(true);
                                        }}
                                        style={{ height: '32px', fontSize: '0.75rem', marginTop: '0.25rem', width: '100%' }}
                                    >Mover Todos los Activos ({locationAssets.length})</Button>
                                </Card>
                            );
                        }

                        return (
                            <Card style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                <div style={{ borderBottom: '1px solid var(--border)', paddingBottom: '0.5rem' }}>
                                    <span style={{ fontSize: '0.65rem', fontWeight: 800, color: 'var(--primary-color)', textTransform: 'uppercase' }}>Información de Selección</span>
                                    <h3 style={{ fontSize: '1.05rem', fontWeight: 900, margin: 0, marginTop: '2px' }}>Ubicación: {selectedLocation.id}</h3>
                                </div>

                                <div style={{ fontSize: '0.8rem', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                                    {asset ? (
                                        <>
                                            <div><strong>Modelo:</strong> {asset.name}</div>
                                            <div><strong>Serie:</strong> {asset.model_number || asset.part_number || 'Latitude 5520'}</div>
                                            <div><strong>SN:</strong> <span style={{ fontFamily: 'monospace', fontWeight: 700 }}>{asset.serial || 'N/A'}</span></div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                <strong>Estado:</strong> 
                                                <span style={{ 
                                                    padding: '2px 8px', borderRadius: '12px', fontSize: '0.65rem', fontWeight: 800,
                                                    backgroundColor: ['Mantenimiento', 'Dañado'].includes(asset.status) ? '#fff7ed' : (asset.status === 'Asignado' ? '#f0fdf4' : '#eff6ff'),
                                                    color: ['Mantenimiento', 'Dañado'].includes(asset.status) ? '#ea580c' : (asset.status === 'Asignado' ? '#16a34a' : '#2563eb'),
                                                    border: `1px solid currentColor`
                                                }}>
                                                    {asset.status} (Verificado)
                                                </span>
                                            </div>
                                            {asset.hardwareSpec && <div><strong>Specs:</strong> {asset.hardwareSpec}</div>}
                                            <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', background: 'var(--background-secondary)', padding: '0.6rem', borderRadius: '6px', marginTop: '0.25rem' }}>
                                                <div>Mapeado el: {asset.dateMapped ? new Date(asset.dateMapped).toLocaleDateString() : 'N/A'}</div>
                                                <div>Por: {asset.updatedBy || 'N/A'}</div>
                                            </div>
                                        </>
                                    ) : (
                                        <div style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: '0.75rem' }}>Esta ubicación está vacía / disponible.</div>
                                    )}
                                </div>

                                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
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
                                            setEditLocationType(isLocH(selectedLocation.aisle) ? 'H' : 'W');
                                            setEditLocManufacturer(detectManufacturer(selectedLocation.aisle, manufacturers));
                                            setIsEditLocationModalOpen(true);
                                        }}
                                        style={{ flex: 1, height: '32px', fontSize: '0.75rem' }}
                                    >Editar</Button>
                                    <Button 
                                        variant="outline" 
                                        size="sm" 
                                        icon={Printer} 
                                        onClick={() => handlePrintLocationLabel(selectedLocation)}
                                        style={{ flex: 1, height: '32px', fontSize: '0.75rem' }}
                                    >Etiqueta</Button>
                                </div>
                                {asset && (
                                    <Button 
                                        variant="primary" 
                                        size="sm" 
                                        icon={Navigation} 
                                        onClick={() => {
                                            setMovingAsset(asset);
                                            setTargetLocationId('');
                                            setIsMoveAssetModalOpen(true);
                                        }}
                                        style={{ height: '32px', fontSize: '0.75rem', marginTop: '0.25rem', width: '100%' }}
                                    >Mover de Grupo / Ubicación</Button>
                                )}
                                {(!asset && (currentUser?.role === 'admin' || currentUser?.role === 'Gerencial')) && (
                                    <Button 
                                        variant="ghost" 
                                        size="sm" 
                                        icon={Trash2} 
                                        onClick={() => handleDeleteLocation(selectedLocation.id)}
                                        style={{ color: '#ef4444', height: '32px', fontSize: '0.75rem', marginTop: '0.25rem' }}
                                    >Eliminar Ubicación</Button>
                                )}
                                {locationAssets.length > 1 && (
                                    <Button 
                                        variant="ghost" 
                                        size="sm" 
                                        onClick={() => setSelectedAssetId(null)}
                                        style={{ height: '32px', fontSize: '0.75rem', marginTop: '0.25rem' }}
                                    >&larr; Ver los otros {locationAssets.length - 1} equipos</Button>
                                )}
                            </Card>
                        );
                    })()}
                </div>
            </div>

            {/* Modal Mover Activo */}
            <Modal 
                isOpen={isMoveAssetModalOpen} 
                onClose={() => {
                    setIsMoveAssetModalOpen(false);
                    setMovingAsset(null);
                    setTargetLocationId('');
                }} 
                title="Mover Activo de Grupo / Ubicación"
            >
                <form onSubmit={handleMoveAsset}>
                    <div style={{ marginBottom: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                        <div style={{ fontSize: '0.85rem' }}>
                            <strong>Activo a mover:</strong> {movingAsset?.name}
                        </div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                            <strong>Ubicación actual:</strong> {movingAsset?.locationId || 'Ninguna'}
                        </div>
                        {movingAsset?.serial && (
                            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                                <strong>N/S:</strong> {movingAsset.serial}
                            </div>
                        )}
                    </div>

                    <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                        <label className="form-label">Destino (Grupo y Ubicación)</label>
                        <select
                            className="form-input"
                            required
                            value={targetLocationId}
                            onChange={e => setTargetLocationId(e.target.value)}
                            style={{ 
                                width: '100%', 
                                padding: '0.5rem', 
                                borderRadius: '6px', 
                                border: '1px solid var(--border)', 
                                backgroundColor: 'var(--background)', 
                                color: 'var(--text-main)', 
                                fontSize: '0.9rem', 
                                outline: 'none' 
                            }}
                        >
                            <option value="">-- Seleccionar Ubicación Destino --</option>
                            {Object.keys(targetLocationsGrouped).sort().map(aisle => (
                                <optgroup key={aisle} label={`GRUPO: ${getDisplayAisle(aisle)}`}>
                                    {targetLocationsGrouped[aisle].map(loc => {
                                        const locAssetsCount = assets.filter(a => a.locationId === loc.id).length;
                                        const label = `${loc.id} ${locAssetsCount > 0 ? '(Ocupado)' : '(Disponible)'}`;
                                        const isCurrent = loc.id === movingAsset?.locationId;
                                        
                                        return (
                                            <option 
                                                key={loc.id} 
                                                value={loc.id}
                                                disabled={isCurrent}
                                            >
                                                {label} {isCurrent ? '(Actual)' : ''}
                                            </option>
                                        );
                                    })}
                                </optgroup>
                            ))}
                        </select>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
                        <Button 
                            type="button" 
                            variant="ghost" 
                            onClick={() => {
                                setIsMoveAssetModalOpen(false);
                                setMovingAsset(null);
                                setTargetLocationId('');
                            }}
                        >
                            Cancelar
                        </Button>
                        <Button 
                            type="submit" 
                            variant="primary"
                            disabled={!targetLocationId}
                        >
                            Confirmar Movimiento
                        </Button>
                    </div>
                </form>
            </Modal>

            {/* Modal Mover Todos los Activos */}
            <Modal 
                isOpen={isMoveAllModalOpen} 
                onClose={() => {
                    setIsMoveAllModalOpen(false);
                    setMovingAllSourceLocation(null);
                    setTargetAllLocationId('');
                }} 
                title="Mover Todos los Activos a otra Ubicación"
            >
                <form onSubmit={handleMoveAllAssets}>
                    <div style={{ marginBottom: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                        <div style={{ fontSize: '0.85rem' }}>
                            <strong>Origen:</strong> Ubicación {movingAllSourceLocation?.id}
                        </div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                            <strong>Cantidad de activos a mover:</strong> {assets.filter(a => a.locationId === movingAllSourceLocation?.id).length} equipos
                        </div>
                    </div>

                    <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                        <label className="form-label">Ubicación Destino</label>
                        <select
                            className="form-input"
                            required
                            value={targetAllLocationId}
                            onChange={e => setTargetAllLocationId(e.target.value)}
                            style={{ 
                                width: '100%', 
                                padding: '0.5rem', 
                                borderRadius: '6px', 
                                border: '1px solid var(--border)', 
                                backgroundColor: 'var(--background)', 
                                color: 'var(--text-main)', 
                                fontSize: '0.9rem', 
                                outline: 'none' 
                            }}
                        >
                            <option value="">-- Seleccionar Ubicación Destino --</option>
                            {Object.keys(targetLocationsGrouped).sort().map(aisle => (
                                <optgroup key={aisle} label={`GRUPO: ${getDisplayAisle(aisle)}`}>
                                    {targetLocationsGrouped[aisle].map(loc => {
                                        const locAssetsCount = assets.filter(a => a.locationId === loc.id).length;
                                        const label = `${loc.id} ${locAssetsCount > 0 ? `(${locAssetsCount} equipos - Ocupado)` : '(Disponible)'}`;
                                        const isCurrent = loc.id === movingAllSourceLocation?.id;
                                        
                                        return (
                                            <option 
                                                key={loc.id} 
                                                value={loc.id}
                                                disabled={isCurrent}
                                            >
                                                {label} {isCurrent ? '(Actual)' : ''}
                                            </option>
                                        );
                                    })}
                                </optgroup>
                            ))}
                        </select>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
                        <Button 
                            type="button" 
                            variant="ghost" 
                            onClick={() => {
                                setIsMoveAllModalOpen(false);
                                setMovingAllSourceLocation(null);
                                setTargetAllLocationId('');
                            }}
                        >
                            Cancelar
                        </Button>
                        <Button 
                            type="submit" 
                            variant="primary"
                            disabled={!targetAllLocationId}
                        >
                            Confirmar Movimiento Masivo
                        </Button>
                    </div>
                </form>
            </Modal>

            {/* Modal Nueva Ubicación */}
            <Modal isOpen={isAddLocationModalOpen} onClose={() => setIsAddLocationModalOpen(false)} title="Agregar Ubicación">
                <form onSubmit={handleAddLocation}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
                        <div className="form-group" style={{ gridColumn: 'span 2' }}>
                            <label className="form-label">Ubicación Destino (Zona)</label>
                            <select 
                                value={newLocationType} 
                                onChange={e => setNewLocationType(e.target.value)}
                                className="form-input"
                                style={{ width: '100%', padding: '0.5rem 0.75rem', borderRadius: '8px', border: '1px solid var(--border)', backgroundColor: 'var(--background)', color: 'var(--text-main)', fontSize: '0.9rem', outline: 'none' }}
                            >
                                <option value="W">LOCACIÓN W (Estándar)</option>
                                <option value="H">LOCACIÓN H (Especiales / Histórico)</option>
                            </select>
                        </div>
                        {/* Fabricante dropdown */}
                        <div className="form-group" style={{ gridColumn: 'span 2' }}>
                            <label className="form-label">Fabricante (Pre-agrupación)</label>
                            <select 
                                value={newLocManufacturer} 
                                onChange={e => setNewLocManufacturer(e.target.value)}
                                className="form-input"
                                style={{ width: '100%', padding: '0.5rem 0.75rem', borderRadius: '8px', border: '1px solid var(--border)', backgroundColor: 'var(--background)', color: 'var(--text-main)', fontSize: '0.9rem', outline: 'none' }}
                            >
                                <option value="NINGUNO">Ninguno (Usar solo Grupo)</option>
                                {manufacturers.map(m => (
                                    <option key={m} value={m}>{m}</option>
                                ))}
                            </select>
                        </div>
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

            {/* Modal Renombrar Grupo */}
            <Modal isOpen={isRenameGroupModalOpen} onClose={() => setIsRenameGroupModalOpen(false)} title="Renombrar Grupo">
                <form onSubmit={handleRenameGroup}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
                        <div className="form-group" style={{ gridColumn: 'span 2' }}>
                            <label className="form-label">Ubicación Destino (Zona)</label>
                            <select 
                                value={renameGroupType} 
                                onChange={e => setRenameGroupType(e.target.value)}
                                className="form-input"
                                style={{ width: '100%', padding: '0.5rem 0.75rem', borderRadius: '8px', border: '1px solid var(--border)', backgroundColor: 'var(--background)', color: 'var(--text-main)', fontSize: '0.9rem', outline: 'none' }}
                            >
                                <option value="W">LOCACIÓN W (Estándar)</option>
                                <option value="H">LOCACIÓN H (Especiales / Histórico)</option>
                            </select>
                        </div>
                        {/* Fabricante dropdown */}
                        <div className="form-group" style={{ gridColumn: 'span 2' }}>
                            <label className="form-label">Fabricante (Pre-agrupación)</label>
                            <select 
                                value={renameGroupManufacturer} 
                                onChange={e => setRenameGroupManufacturer(e.target.value)}
                                className="form-input"
                                style={{ width: '100%', padding: '0.5rem 0.75rem', borderRadius: '8px', border: '1px solid var(--border)', backgroundColor: 'var(--background)', color: 'var(--text-main)', fontSize: '0.9rem', outline: 'none' }}
                            >
                                <option value="NINGUNO">Ninguno (Usar solo Grupo)</option>
                                {manufacturers.map(m => (
                                    <option key={m} value={m}>{m}</option>
                                ))}
                            </select>
                        </div>
                        <div className="form-group" style={{ gridColumn: 'span 2' }}>
                            <label className="form-label">Grupo (Categoría)</label>
                            <input
                                type="text"
                                value={renameGroupCategory}
                                onChange={e => setRenameGroupCategory(e.target.value)}
                                className="form-input"
                                placeholder="Ej: B, PRECISION 3490"
                                required
                                autoFocus
                                style={{ width: '100%', padding: '0.5rem 0.75rem', borderRadius: '8px', border: '1px solid var(--border)', backgroundColor: 'var(--background)', color: 'var(--text-main)', fontSize: '0.9rem', outline: 'none' }}
                            />
                        </div>
                    </div>
                    <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
                        <Button type="button" variant="ghost" onClick={() => setIsRenameGroupModalOpen(false)}>
                            Cancelar
                        </Button>
                        <Button type="submit" variant="primary">
                            Guardar Cambios
                        </Button>
                    </div>
                </form>
            </Modal>

            {/* Modal Editar Ubicación */}
            <Modal isOpen={isEditLocationModalOpen} onClose={() => setIsEditLocationModalOpen(false)} title="Editar Ubicación">
                <form onSubmit={handleEditLocation}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
                        <div className="form-group" style={{ gridColumn: 'span 2' }}>
                            <label className="form-label">Ubicación Destino (Zona)</label>
                            <select 
                                value={editLocationType} 
                                onChange={e => setEditLocationType(e.target.value)}
                                className="form-input"
                                style={{ width: '100%', padding: '0.5rem 0.75rem', borderRadius: '8px', border: '1px solid var(--border)', backgroundColor: 'var(--background)', color: 'var(--text-main)', fontSize: '0.9rem', outline: 'none' }}
                            >
                                <option value="W">LOCACIÓN W (Estándar)</option>
                                <option value="H">LOCACIÓN H (Especiales / Histórico)</option>
                            </select>
                        </div>
                        {/* Fabricante dropdown */}
                        <div className="form-group" style={{ gridColumn: 'span 2' }}>
                            <label className="form-label">Fabricante (Pre-agrupación)</label>
                            <select 
                                value={editLocManufacturer} 
                                onChange={e => setEditLocManufacturer(e.target.value)}
                                className="form-input"
                                style={{ width: '100%', padding: '0.5rem 0.75rem', borderRadius: '8px', border: '1px solid var(--border)', backgroundColor: 'var(--background)', color: 'var(--text-main)', fontSize: '0.9rem', outline: 'none' }}
                            >
                                <option value="NINGUNO">Ninguno (Usar solo Grupo)</option>
                                {manufacturers.map(m => (
                                    <option key={m} value={m}>{m}</option>
                                ))}
                            </select>
                        </div>
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
 
            {/* Modal Gestionar Fabricantes */}
            <Modal isOpen={isManageManufacturersOpen} onClose={() => setIsManageManufacturersOpen(false)} title="Gestionar Fabricantes">
                <div>
                    <form onSubmit={(e) => {
                        e.preventDefault();
                        const name = newManufacturerName.trim().toUpperCase();
                        if (!name) return;
                        if (manufacturers.includes(name)) {
                            alert("Este fabricante ya existe.");
                            return;
                        }
                        const updated = [...manufacturers, name];
                        setManufacturers(updated);
                        setNewManufacturerName('');
                    }} style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem' }}>
                        <input
                            className="form-input"
                            placeholder="Nuevo Fabricante (Ej: ASUS, LENOVO)"
                            value={newManufacturerName}
                            onChange={e => setNewManufacturerName(e.target.value)}
                            style={{ flex: 1, textTransform: 'uppercase', padding: '0.5rem 0.75rem', borderRadius: '8px', border: '1px solid var(--border)', backgroundColor: 'var(--background)', color: 'var(--text-main)', fontSize: '0.9rem', outline: 'none' }}
                            required
                        />
                        <Button type="submit">Agregar</Button>
                    </form>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '300px', overflowY: 'auto' }}>
                        {manufacturers.length === 0 ? (
                            <div style={{ textAlign: 'center', padding: '1rem', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                                No hay fabricantes registrados.
                            </div>
                        ) : (
                            manufacturers.map((m, idx) => (
                                <div key={m} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem 0.75rem', background: 'var(--background-secondary)', borderRadius: '8px', border: '1px solid var(--border)' }}>
                                    <span style={{ fontWeight: 700, fontSize: '0.85rem' }}>{m}</span>
                                    <div style={{ display: 'flex', gap: '0.25rem' }}>
                                        <Button
                                            variant="ghost"
                                            size="xs"
                                            icon={Edit3}
                                            onClick={() => {
                                                const newName = prompt(`Editar fabricante "${m}":`, m);
                                                if (newName && newName.trim().toUpperCase() !== m) {
                                                    const updatedName = newName.trim().toUpperCase();
                                                    if (manufacturers.includes(updatedName)) {
                                                        alert("Ese fabricante ya existe.");
                                                        return;
                                                    }
                                                    const updated = [...manufacturers];
                                                    updated[idx] = updatedName;
                                                    setManufacturers(updated);
                                                }
                                            }}
                                            style={{ padding: '4px' }}
                                        />
                                        <Button
                                            variant="ghost"
                                            size="xs"
                                            icon={Trash2}
                                            onClick={() => {
                                                if (window.confirm(`¿Está seguro de eliminar el fabricante "${m}"?`)) {
                                                    const updated = manufacturers.filter(item => item !== m);
                                                    setManufacturers(updated);
                                                    if (selectedBrand === m) {
                                                        setSelectedBrand('ALL');
                                                    }
                                                }
                                            }}
                                            style={{ padding: '4px', color: '#ef4444' }}
                                        />
                                    </div>
                                </div>
                            ))
                        )}
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1.5rem' }}>
                        <Button onClick={() => setIsManageManufacturersOpen(false)}>Cerrar</Button>
                    </div>
                </div>
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
            `}</style>
        </div>
    );
}
