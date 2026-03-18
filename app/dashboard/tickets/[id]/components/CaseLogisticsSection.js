'use client';

import React from 'react';

export default function CaseLogisticsSection({
    editedData,
    setEditedData,
    selectedCaseIndex,
    users
}) {
    if (selectedCaseIndex === null) return null;

    const currentCase = editedData.associatedCases[selectedCaseIndex];
    const logistics = currentCase.logistics || { status: 'Pendiente', method: '', date: '', timeSlot: 'AM' };

    const updateLogistics = (field, value) => {
        setEditedData(prev => {
            const newCases = [...prev.associatedCases];
            const currentLogistics = newCases[selectedCaseIndex].logistics || {};
            let newStatus = currentLogistics.status || 'Pendiente';
            let assignedTo = currentLogistics.assignedTo || null;

            // Automación de estados
            if (field === 'method' && value === 'Repartidor Propio') {
                newStatus = 'Para Coordinar';
            } else if (field === 'date' && value && (newStatus === 'Pendiente' || newStatus === 'Para Coordinar')) {
                newStatus = 'En Transito';
            } else if (field === 'status') {
                newStatus = value;
            }

            // Si cambiamos el repartidor, buscamos su UID (assignedTo)
            if (field === 'deliveryPerson' && value) {
                const matchedUser = [...users].find(u => u.name === value);
                if (matchedUser) {
                    assignedTo = matchedUser.id || matchedUser.uid;
                }
            } else if (field === 'deliveryPerson' && !value) {
                assignedTo = null;
            }

            newCases[selectedCaseIndex].logistics = { 
                ...currentLogistics, 
                [field]: value,
                status: newStatus,
                assignedTo: assignedTo
            };
            return { ...prev, associatedCases: newCases };
        });
    };

    return (
        <div style={{ marginTop: '2rem' }}>
            <h4 style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--primary-color)', marginBottom: '1rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.5rem' }}>
                Logística del Caso
            </h4>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1rem' }}>
                <div className="form-group">
                    <label className="form-label">Estado de la Logística / Envío</label>
                    <select
                        className="form-select"
                        value={logistics.status || 'Pendiente'}
                        onChange={e => updateLogistics('status', e.target.value)}
                    >
                        <option value="Pendiente">Pendiente</option>
                        <option value="Para Coordinar">Para Coordinar</option>
                        <option value="En Transito">En Transito</option>
                        <option value="Entregado">Entregado/Finalizado</option>
                    </select>
                </div>

                <div className="form-group">
                    <label className="form-label">Medio Proveedor</label>
                    <select
                        className="form-select"
                        value={logistics.method || ''}
                        onChange={e => updateLogistics('method', e.target.value)}
                    >
                        <option value="">Seleccionar...</option>
                        <option value="Andreani">Andreani</option>
                        <option value="Correo Argentino">Correo Argentino</option>
                        <option value="Repartidor Propio">Repartidor Propio</option>
                    </select>
                </div>

                {(logistics.method === 'Andreani' || logistics.method === 'Correo Argentino') && (
                    <div className="form-group">
                        <label className="form-label">Número de Seguimiento</label>
                        <input
                            className="form-input"
                            placeholder="Ej: AR123456789"
                            value={logistics.trackingNumber || ''}
                            onChange={e => updateLogistics('trackingNumber', e.target.value)}
                        />
                    </div>
                )}

                {logistics.method === 'Repartidor Propio' && (
                    <div className="form-group">
                        <label className="form-label">Nombre del Repartidor</label>
                        <select
                            className="form-select"
                            value={logistics.deliveryPerson || ''}
                            onChange={e => updateLogistics('deliveryPerson', e.target.value)}
                        >
                            <option value="">Seleccionar repartidor...</option>
                            {users.filter(u => u.role !== 'admin').map(u => (
                                <option key={u.id} value={u.name}>
                                    {u.name} {u.role === 'Conductor' ? '(Conductor)' : ''}
                                </option>
                            ))}
                        </select>
                    </div>
                )}

                {/* Fecha y Turno eliminados de aquí para manejarse globalmente */}
            </div>
        </div>
    );
}
