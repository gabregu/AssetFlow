'use client';
import React, { useState, useRef, useCallback } from 'react';
import { Modal } from '@/app/components/ui/Modal';
import { Button } from '@/app/components/ui/Button';
import {
    CheckCircle2, XCircle, Camera, Upload, Trash2,
    Package, AlertTriangle, Zap, Loader2, Check, ScanLine
} from 'lucide-react';
import { uploadDevicePhoto } from '@/lib/upload';

// ─── Condition options ────────────────────────────────────────────────────────
const CONDITIONS = [
    {
        key: 'Disponible',
        label: 'Buen Estado',
        icon: CheckCircle2,
        color: '#16a34a',
        bg: 'rgba(22,163,74,0.08)',
        border: 'rgba(22,163,74,0.35)',
    },
    {
        key: 'Dañado',
        label: 'Dañado',
        icon: AlertTriangle,
        color: '#f59e0b',
        bg: 'rgba(245,158,11,0.08)',
        border: 'rgba(245,158,11,0.35)',
    },
    {
        key: 'EOL',
        label: 'EOL',
        icon: XCircle,
        color: '#dc2626',
        bg: 'rgba(220,38,38,0.08)',
        border: 'rgba(220,38,38,0.35)',
    },
];

// ─── Applies to laptops and phones ───────────────────────────────────────────
const needsCharger = (type = '') => {
    const t = type.toLowerCase();
    return t.includes('laptop') || t.includes('celular') || t.includes('smartphone') || t.includes('phone') || t.includes('mobile');
};

// ─── Single asset row ─────────────────────────────────────────────────────────
function AssetRow({ asset, fullAsset, assetState, onChange }) {
    const fileInputRef = useRef(null);
    const [uploading, setUploading] = useState(false);
    const [scanInput, setScanInput] = useState('');
    const [scanError, setScanError] = useState('');

    const condition = CONDITIONS.find(c => c.key === assetState.condition) || CONDITIONS[0];
    const requiresPhoto = assetState.condition === 'Dañado' || assetState.condition === 'EOL';
    const showCharger = needsCharger(asset.type || fullAsset?.type || '');

    // Serial scan/confirm
    const handleScanConfirm = () => {
        const entered = scanInput.trim().toLowerCase();
        const expected = String(asset.serial || '').trim().toLowerCase();
        if (!entered) return;
        if (entered === expected) {
            onChange({ serialConfirmed: true });
            setScanError('');
        } else {
            setScanError(`S/N no coincide. Esperado: ${asset.serial}`);
        }
    };

    // Photo upload
    const handleFileSelect = async (e) => {
        const files = Array.from(e.target.files || []);
        if (!files.length) return;
        setUploading(true);
        try {
            const urls = await Promise.all(
                files.map(f => uploadDevicePhoto(f, `recovery_${asset.serial || 'asset'}`)
            ));
            onChange({ photos: [...(assetState.photos || []), ...urls] });
        } catch (err) {
            console.error('Error al subir foto:', err);
            alert('Error al subir la foto. Intente de nuevo.');
        } finally {
            setUploading(false);
            e.target.value = '';
        }
    };

    const removePhoto = (idx) => {
        const updated = (assetState.photos || []).filter((_, i) => i !== idx);
        onChange({ photos: updated });
    };

    return (
        <div style={{
            border: `2px solid ${condition.border}`,
            borderRadius: '12px',
            padding: '1rem',
            background: condition.bg,
            transition: 'border-color 0.2s, background 0.2s',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.9rem',
        }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem' }}>
                <div>
                    <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-main)' }}>
                        {fullAsset?.type || asset.type || 'Activo'}{' '}
                        <span style={{ fontWeight: 400, color: 'var(--text-secondary)' }}>
                            {fullAsset?.modelNumber || fullAsset?.hardwareSpec || asset.model || ''}
                        </span>
                    </div>
                    {asset.serial && (
                        <div style={{ fontSize: '0.78rem', fontFamily: 'monospace', color: 'var(--text-secondary)', marginTop: '2px' }}>
                            S/N: {asset.serial}
                        </div>
                    )}
                    {fullAsset?.assignee && (
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                            Asignado a: <strong>{fullAsset.assignee}</strong>
                        </div>
                    )}
                </div>
                {/* Condition badge */}
                <div style={{
                    padding: '3px 10px',
                    borderRadius: '20px',
                    background: condition.color,
                    color: '#fff',
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    whiteSpace: 'nowrap',
                    flexShrink: 0,
                }}>
                    <condition.icon size={12} />
                    {condition.label}
                </div>
            </div>

            {/* Serial confirmation */}
            {asset.serial && !assetState.serialConfirmed && (
                <div>
                    <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                        Confirmar S/N (escanear o tipear)
                    </label>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <input
                            className="form-input"
                            style={{ fontSize: '0.85rem', height: '34px', fontFamily: 'monospace' }}
                            placeholder={`S/N esperado: ${asset.serial}`}
                            value={scanInput}
                            onChange={e => { setScanInput(e.target.value); setScanError(''); }}
                            onKeyDown={e => e.key === 'Enter' && handleScanConfirm()}
                        />
                        <Button size="sm" variant="secondary" icon={ScanLine} onClick={handleScanConfirm}>OK</Button>
                    </div>
                    {scanError && <p style={{ color: '#dc2626', fontSize: '0.75rem', marginTop: '4px' }}>{scanError}</p>}
                </div>
            )}
            {asset.serial && assetState.serialConfirmed && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#16a34a', fontSize: '0.82rem', fontWeight: 600 }}>
                    <CheckCircle2 size={15} /> S/N confirmado
                </div>
            )}

            {/* Condition selector */}
            <div>
                <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
                    Estado del equipo
                </label>
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                    {CONDITIONS.map(c => {
                        const selected = assetState.condition === c.key;
                        return (
                            <button
                                key={c.key}
                                type="button"
                                onClick={() => onChange({ condition: c.key })}
                                style={{
                                    display: 'flex', alignItems: 'center', gap: '5px',
                                    padding: '5px 12px', borderRadius: '20px',
                                    border: `2px solid ${selected ? c.color : 'var(--border)'}`,
                                    background: selected ? c.color : 'transparent',
                                    color: selected ? '#fff' : 'var(--text-secondary)',
                                    fontWeight: selected ? 700 : 400,
                                    fontSize: '0.8rem', cursor: 'pointer',
                                    transition: 'all 0.15s',
                                }}
                            >
                                <c.icon size={13} />
                                {c.label}
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Charger toggle */}
            {showCharger && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', fontWeight: 500 }}>
                        <Zap size={13} style={{ display: 'inline', marginRight: '4px', color: '#f59e0b' }} />
                        ¿Devolvió el cargador?
                    </span>
                    <div style={{ display: 'flex', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '8px', overflow: 'hidden' }}>
                        {[true, false].map(val => (
                            <button
                                key={String(val)}
                                type="button"
                                onClick={() => onChange({ chargerReturned: val })}
                                style={{
                                    padding: '4px 14px', border: 'none', cursor: 'pointer',
                                    background: assetState.chargerReturned === val
                                        ? (val ? '#16a34a' : '#dc2626')
                                        : 'transparent',
                                    color: assetState.chargerReturned === val ? '#fff' : 'var(--text-secondary)',
                                    fontWeight: 600, fontSize: '0.78rem', transition: 'all 0.15s',
                                }}
                            >
                                {val ? 'Sí' : 'No'}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* Photo upload */}
            <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '6px' }}>
                    <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                        <Camera size={13} style={{ display: 'inline', marginRight: '4px' }} />
                        Fotos del estado físico
                        {requiresPhoto && <span style={{ color: '#dc2626', marginLeft: '4px' }}>*requerida</span>}
                    </label>
                </div>
                {/* Photo previews */}
                {(assetState.photos || []).length > 0 && (
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '8px' }}>
                        {(assetState.photos || []).map((url, idx) => (
                            <div key={idx} style={{ position: 'relative', width: '72px', height: '72px' }}>
                                <img
                                    src={url}
                                    alt={`Foto ${idx + 1}`}
                                    style={{ width: '72px', height: '72px', objectFit: 'cover', borderRadius: '8px', border: '1px solid var(--border)' }}
                                />
                                <button
                                    type="button"
                                    onClick={() => removePhoto(idx)}
                                    style={{
                                        position: 'absolute', top: '-6px', right: '-6px',
                                        background: '#dc2626', border: 'none', borderRadius: '50%',
                                        width: '20px', height: '20px', cursor: 'pointer',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        padding: 0,
                                    }}
                                >
                                    <Trash2 size={11} color="#fff" />
                                </button>
                            </div>
                        ))}
                    </div>
                )}
                <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    capture="environment"
                    style={{ display: 'none' }}
                    onChange={handleFileSelect}
                />
                <Button
                    size="sm"
                    variant="outline"
                    icon={uploading ? Loader2 : Upload}
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                    style={{ fontSize: '0.78rem' }}
                >
                    {uploading ? 'Subiendo...' : 'Agregar foto'}
                </Button>
            </div>
        </div>
    );
}

// ─── Main Modal ───────────────────────────────────────────────────────────────
export default function RecoveryConfirmationModal({ isOpen, onClose, task, assets, updateLogisticsTask, updateAsset }) {
    // Per-asset state: { condition, serialConfirmed, chargerReturned, photos }
    const [assetStates, setAssetStates] = useState({});
    const [confirming, setConfirming] = useState(false);

    const taskAssets = task?.assets || [];

    // Reset on open
    React.useEffect(() => {
        if (isOpen) {
            const initial = {};
            taskAssets.forEach((a, i) => {
                const key = a.serial || `noSerial-${i}`;
                initial[key] = {
                    condition: 'Disponible',
                    serialConfirmed: !a.serial, // no-serial items are auto-confirmed
                    chargerReturned: null,
                    photos: [],
                };
            });
            setAssetStates(initial);
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen]);

    const getAssetKey = (asset, i) => asset.serial || `noSerial-${i}`;

    const handleChange = useCallback((key, updates) => {
        setAssetStates(prev => ({
            ...prev,
            [key]: { ...prev[key], ...updates },
        }));
    }, []);

    // Validation
    const allSerialsConfirmed = taskAssets.every((a, i) => {
        const key = getAssetKey(a, i);
        return assetStates[key]?.serialConfirmed;
    });

    const photosMissingFor = taskAssets.filter((a, i) => {
        const key = getAssetKey(a, i);
        const s = assetStates[key];
        if (!s) return false;
        const requiresPhoto = s.condition === 'Dañado' || s.condition === 'EOL';
        return requiresPhoto && (!s.photos || s.photos.length === 0);
    });

    const canConfirm = allSerialsConfirmed && photosMissingFor.length === 0;

    const handleConfirm = async () => {
        if (!canConfirm || confirming) return;
        setConfirming(true);
        try {
            // Update each asset individually
            for (let i = 0; i < taskAssets.length; i++) {
                const taskAsset = taskAssets[i];
                if (!taskAsset.serial) continue;
                const key = getAssetKey(taskAsset, i);
                const state = assetStates[key];
                if (!state) continue;

                // Find the inventory asset by serial
                const inventoryAsset = assets?.find(a =>
                    String(a.serial || '').trim().toLowerCase() === String(taskAsset.serial).trim().toLowerCase()
                );
                if (!inventoryAsset) continue;

                await updateAsset(inventoryAsset.id, {
                    status: state.condition,           // 'Disponible' | 'Dañado' | 'EOL'
                    photoUrl: state.photos?.[0] || inventoryAsset.photoUrl || null,
                    assignee: state.condition === 'Disponible' ? 'Almacén' : inventoryAsset.assignee,
                });
            }

            // Build summary for delivery_info
            const summary = taskAssets.map((a, i) => {
                const key = getAssetKey(a, i);
                const s = assetStates[key] || {};
                return {
                    serial: a.serial || '(sin S/N)',
                    condition: s.condition,
                    chargerReturned: s.chargerReturned,
                    photos: s.photos || [],
                };
            });

            // Mark task as Recuperado
            await updateLogisticsTask(task.id, {
                status: 'Recuperado',
                delivery_info: {
                    ...task.delivery_info,
                    receivedCondition: summary,
                    receivedDate: new Date().toISOString().split('T')[0],
                },
            });

            onClose();
        } catch (err) {
            console.error('Error al confirmar recepción:', err);
            alert('Ocurrió un error al confirmar la recepción. Intente de nuevo.');
        } finally {
            setConfirming(false);
        }
    };

    if (!task) return null;

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title="Confirmar Recepción — Recupero"
        >
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

                {/* Intro card */}
                <div style={{
                    background: 'rgba(37,99,235,0.05)',
                    border: '1px solid rgba(37,99,235,0.2)',
                    borderRadius: '10px',
                    padding: '0.85rem 1rem',
                    display: 'flex', alignItems: 'flex-start', gap: '0.75rem',
                }}>
                    <Package size={20} style={{ color: '#2563eb', flexShrink: 0, marginTop: '2px' }} />
                    <div>
                        <div style={{ fontWeight: 600, color: 'var(--text-main)', fontSize: '0.9rem' }}>
                            {task.subject || 'Recupero de Activos'}
                        </div>
                        <div style={{ color: 'var(--text-secondary)', fontSize: '0.78rem', marginTop: '2px' }}>
                            Para cada activo: confirmá el serial, el estado físico, el cargador y opcionalmente sacá una foto.
                        </div>
                    </div>
                </div>

                {/* Asset rows */}
                {taskAssets.length === 0 ? (
                    <p style={{ color: 'var(--text-secondary)', fontStyle: 'italic', textAlign: 'center' }}>
                        No hay activos específicos en esta tarea.
                    </p>
                ) : (
                    taskAssets.map((asset, i) => {
                        const key = getAssetKey(asset, i);
                        const fullAsset = asset.serial
                            ? assets?.find(a => String(a.serial || '').trim().toLowerCase() === String(asset.serial).trim().toLowerCase())
                            : null;
                        return (
                            <AssetRow
                                key={key}
                                asset={asset}
                                fullAsset={fullAsset}
                                assetState={assetStates[key] || { condition: 'Disponible', serialConfirmed: !asset.serial, chargerReturned: null, photos: [] }}
                                onChange={updates => handleChange(key, updates)}
                            />
                        );
                    })
                )}

                {/* Validation hints */}
                {!allSerialsConfirmed && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#f59e0b', fontSize: '0.8rem' }}>
                        <AlertTriangle size={14} />
                        Confirmá todos los números de serie antes de continuar.
                    </div>
                )}
                {photosMissingFor.length > 0 && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#dc2626', fontSize: '0.8rem' }}>
                        <Camera size={14} />
                        Los activos marcados como Dañado o EOL requieren al menos una foto.
                    </div>
                )}

                {/* Action buttons */}
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', paddingTop: '0.5rem', borderTop: '1px solid var(--border)' }}>
                    <Button variant="outline" onClick={onClose} disabled={confirming}>
                        Cancelar
                    </Button>
                    <Button
                        variant="primary"
                        icon={confirming ? Loader2 : Check}
                        onClick={handleConfirm}
                        disabled={!canConfirm || confirming}
                        style={{ background: canConfirm ? '#16a34a' : undefined, borderColor: canConfirm ? '#16a34a' : undefined }}
                    >
                        {confirming ? 'Guardando...' : 'Confirmar Recepción'}
                    </Button>
                </div>
            </div>
        </Modal>
    );
}
