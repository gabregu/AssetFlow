"use client";
import React, { useState, useEffect, useMemo } from 'react';
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
    Trash2
} from 'lucide-react';
import { useStore } from '../../../lib/store';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Modal } from '../../components/ui/Modal';
import { CountryFilter } from '../../components/layout/CountryFilter';

export default function WarehousePage() {
    const { 
        warehouseLocations,
        assets, 
        mapAssetToLocation, 
        addWarehouseLocation,
        deleteWarehouseLocation,
        currentUser,
        countryFilter 
    } = useStore();

    const [searchQuery, setSearchQuery] = useState('');
    const [selectedLocation, setSelectedLocation] = useState(null);
    const [isMappingMode, setIsMappingMode] = useState(false);
    const [mappingStep, setMappingStep] = useState(1); // 1: Scan Asset, 2: Scan Location
    const [scannedAsset, setScannedAsset] = useState(null);
    const [scannedLocation, setScannedLocation] = useState(null);
    
    const [isAddLocationModalOpen, setIsAddLocationModalOpen] = useState(false);
    const [newLoc, setNewLoc] = useState({ id: '', aisle: '', section: '', level: '' });

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

    // Handle Asset Scan simulation
    const handleScanAsset = (e) => {
        e.preventDefault();
        const asset = assets.find(a => 
            a.id.toLowerCase() === searchQuery.toLowerCase() || 
            a.serial.toLowerCase() === searchQuery.toLowerCase()
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
        if (mappingStep === 2 && scannedAsset) {
            confirmMapping(scannedAsset.id, locationId);
        } else {
            const loc = warehouseLocations.find(l => l.id === locationId);
            setSelectedLocation(loc);
        }
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
            alert("Por favor seleccione una región específica primero.");
            return;
        }
        const fullId = `${newLoc.aisle}-${newLoc.section}-${newLoc.level}`;
        const res = await addWarehouseLocation({ ...newLoc, id: fullId, country: countryFilter });
        if (!res.error) {
            setIsAddLocationModalOpen(false);
            setNewLoc({ id: '', aisle: '', section: '', level: '' });
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
                        <p style={{ color: 'var(--text-secondary)' }}>Control visual y físico de ubicaciones de activos.</p>
                    </div>
                    <div style={{ transform: 'scale(0.9)', transformOrigin: 'left' }}>
                        <CountryFilter />
                    </div>
                </div>
                <div style={{ display: 'flex', gap: '1rem' }}>
                    <Button 
                        variant={isMappingMode ? "primary" : "outline"} 
                        icon={ScanLine}
                        onClick={() => {
                            setIsMappingMode(!isMappingMode);
                            setMappingStep(1);
                            setScannedAsset(null);
                        }}
                    >
                        {isMappingMode ? "Cancelar Mapeo" : "Modo Escaneo"}
                    </Button>
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
                            {Object.entries(groupedLocations).map(([aisle, locations]) => (
                                <div key={aisle} style={{ flex: '1', minWidth: '200px' }}>
                                    <h3 style={{ fontSize: '0.9rem', fontWeight: 800, color: 'var(--text-secondary)', marginBottom: '1rem', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                                        Pasillo {aisle}
                                    </h3>
                                    <div style={{ 
                                        display: 'grid', 
                                        gridTemplateColumns: 'repeat(auto-fill, minmax(60px, 1fr))', 
                                        gap: '0.5rem',
                                        background: 'rgba(0,0,0,0.02)',
                                        padding: '1rem',
                                        borderRadius: '12px',
                                        border: '1px dashed var(--border)'
                                    }}>
                                        {locations.sort((a,b) => a.id.localeCompare(b.id)).map(loc => {
                                            const asset = getAssetAtLocation(loc.id);
                                            const isSelected = selectedLocation?.id === loc.id;
                                            const isTarget = mappingStep === 2 && isMappingMode;

                                            return (
                                                <div 
                                                    key={loc.id}
                                                    onClick={() => handleScanLocation(loc.id)}
                                                    style={{
                                                        aspectRatio: '1/1',
                                                        display: 'flex',
                                                        flexDirection: 'column',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        background: asset ? 'var(--primary-color)' : 'var(--surface)',
                                                        color: asset ? 'white' : 'var(--text-main)',
                                                        borderRadius: '8px',
                                                        border: isSelected ? '2px solid var(--primary-color)' : '1px solid var(--border)',
                                                        cursor: 'pointer',
                                                        transition: 'all 0.2s ease',
                                                        fontSize: '0.7rem',
                                                        fontWeight: 700,
                                                        position: 'relative',
                                                        boxShadow: isSelected ? '0 0 15px rgba(37, 99, 235, 0.3)' : 'none',
                                                        opacity: isTarget && !asset ? 1 : (isTarget ? 0.5 : 1),
                                                        animation: isTarget && !asset ? 'pulse 2s infinite' : 'none'
                                                    }}
                                                    title={`${loc.id} ${asset ? `(${asset.name})` : '(Libre)'}`}
                                                >
                                                    {loc.id.split('-').slice(1).join('-')}
                                                    {asset && <Box size={12} style={{ marginTop: '2px' }} />}
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
                    <Card style={{ padding: '1.5rem', border: isMappingMode ? '2px solid var(--primary-color)' : '1px solid var(--border)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
                            <ScanLine size={18} color={isMappingMode ? "var(--primary-color)" : "inherit"} />
                            <h3 style={{ fontSize: '1rem', fontWeight: 700 }}>Consola de Escaneo</h3>
                        </div>

                        {isMappingMode ? (
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
                                    <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>
                                        {scannedAsset ? `Activo: ${scannedAsset.id}` : "Escanee el Activo"}
                                    </span>
                                    {scannedAsset && <CheckCircle2 size={16} color="#22c55e" />}
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

                                {mappingStep === 1 && (
                                    <form onSubmit={handleScanAsset} style={{ marginTop: '0.5rem' }}>
                                        <div className="search-box">
                                            <Search className="search-icon" size={18} />
                                            <input 
                                                className="search-input"
                                                placeholder="ID o Serial del Activo..."
                                                value={searchQuery}
                                                onChange={e => setSearchQuery(e.target.value)}
                                                autoFocus
                                            />
                                        </div>
                                        <p style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginTop: '0.5rem' }}>
                                            Simulación: Ingrese ID y presione Enter.
                                        </p>
                                    </form>
                                )}
                            </div>
                        ) : (
                            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', textAlign: 'center', padding: '1rem' }}>
                                Active el modo escaneo para vincular activos a ubicaciones físicas.
                            </p>
                        )}
                    </Card>

                    {/* Selected Location Detail */}
                    {selectedLocation ? (
                        <Card style={{ padding: '1.5rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem' }}>
                                <div>
                                    <span style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--primary-color)', textTransform: 'uppercase' }}>Ubicación</span>
                                    <h3 style={{ fontSize: '1.4rem', fontWeight: 800 }}>{selectedLocation.id}</h3>
                                </div>
                                <div style={{ 
                                    padding: '0.25rem 0.75rem', 
                                    borderRadius: '20px', 
                                    fontSize: '0.7rem', 
                                    fontWeight: 700,
                                    background: getAssetAtLocation(selectedLocation.id) ? 'rgba(37, 99, 235, 0.1)' : 'rgba(34, 197, 94, 0.1)',
                                    color: getAssetAtLocation(selectedLocation.id) ? 'var(--primary-color)' : '#22c55e'
                                }}>
                                    {getAssetAtLocation(selectedLocation.id) ? 'Ocupado' : 'Disponible'}
                                </div>
                            </div>

                            {getAssetAtLocation(selectedLocation.id) ? (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                    <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', padding: '1rem', background: 'var(--background)', borderRadius: '12px' }}>
                                        <div style={{ width: '40px', height: '40px', background: 'rgba(37, 99, 235, 0.1)', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                            <Box size={24} color="var(--primary-color)" />
                                        </div>
                                        <div>
                                            <p style={{ fontSize: '0.85rem', fontWeight: 700, margin: 0 }}>{getAssetAtLocation(selectedLocation.id).name}</p>
                                            <p style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', margin: 0 }}>ID: {getAssetAtLocation(selectedLocation.id).id}</p>
                                        </div>
                                    </div>
                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                                            <span>Mapeado el:</span>
                                            <span>{new Date(getAssetAtLocation(selectedLocation.id).dateMapped).toLocaleDateString()}</span>
                                        </div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                            <span>Por:</span>
                                            <span>{getAssetAtLocation(selectedLocation.id).updatedBy}</span>
                                        </div>
                                    </div>
                                    <Button variant="outline" size="sm" icon={Maximize2} style={{ marginTop: '0.5rem' }}>Ver Detalle Activo</Button>
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
                    ) : (
                        <Card style={{ padding: '2rem', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', color: 'var(--text-secondary)' }}>
                            <History size={40} style={{ opacity: 0.1, marginBottom: '1rem' }} />
                            <p style={{ fontSize: '0.85rem' }}>Seleccione una ubicación en el mapa para ver sus detalles.</p>
                        </Card>
                    )}
                </div>
            </div>

            {/* Modal Nueva Ubicación */}
            <Modal isOpen={isAddLocationModalOpen} onClose={() => setIsAddLocationModalOpen(false)} title="Agregar Ubicación">
                <form onSubmit={handleAddLocation}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
                        <div className="form-group">
                            <label className="form-label">Pasillo (Aisle)</label>
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
                        <Button type="button" variant="ghost" onClick={() => setIsAddLocationModalOpen(false)}>Cancelar</Button>
                        <Button type="submit">Crear Ubicación</Button>
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
