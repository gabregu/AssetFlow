'use client';

import React from 'react';
import { Modal } from '@/app/components/ui/Modal';
import { Button } from '@/app/components/ui/Button';

export default function ManualAssetModal({
    isOpen,
    onClose,
    serialQuery,
    newAsset,
    setNewAsset,
    handleCreateAsset
}) {
    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title="Dar de Alta en Inventario"
        >
            <form onSubmit={handleCreateAsset}>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
                    El serial <strong>{serialQuery}</strong> no existe. Completa los datos para registrarlo.
                </p>
                <div className="form-group">
                    <label className="form-label">Modelo / Descripción</label>
                    <input
                        required
                        className="form-input"
                        placeholder="Ej: MacBook Pro 16 M3"
                        value={newAsset.model}
                        onChange={e => setNewAsset({ ...newAsset, model: e.target.value })}
                    />
                </div>
                <div className="form-group">
                    <label className="form-label">Tipo de Activo</label>
                    <select
                        className="form-select"
                        value={newAsset.type}
                        onChange={e => setNewAsset({ ...newAsset, type: e.target.value })}
                    >
                        <option value="Laptop">Laptop</option>
                        <option value="Smartphone">Smartphone</option>
                        <option value="Security keys">Security keys</option>
                        <option value="Tablet">Tablet</option>
                    </select>
                </div>
                <div className="form-group">
                    <label className="form-label">Estado Inicial</label>
                    <select
                        className="form-select"
                        value={newAsset.status}
                        onChange={e => setNewAsset({ ...newAsset, status: e.target.value })}
                    >
                        <option value="Nuevo">Nuevo</option>
                        <option value="Asignado">Asignado</option>
                        <option value="Recuperado">Recuperado</option>
                        <option value="En Reparación">En Reparación</option>
                        <option value="EOL">EOL</option>
                        <option value="En transito de ingreso">En transito de ingreso</option>
                    </select>
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '2rem' }}>
                    <Button type="button" variant="secondary" onClick={onClose}>Cancelar</Button>
                    <Button type="submit">Registrar y Vincular</Button>
                </div>
            </form>
        </Modal>
    );
}
