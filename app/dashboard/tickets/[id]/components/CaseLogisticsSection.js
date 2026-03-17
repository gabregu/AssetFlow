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
    const logistics = currentCase.logistics || { status: 'Pendiente', method: '', deliveryDate: '', timeWindow: 'AM' };

    const updateLogistics = (field, value) => {
        setEditedData(prev => {
            const newCases = [...prev.associatedCases];
            newCases[selectedCaseIndex].logistics = { 
                ...(newCases[selectedCaseIndex].logistics || {}), 
                [field]: value 
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

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                    <div className="form-group">
                        <label className="form-label">Fecha Programada</label>
                        <input
                            type="date"
                            className="form-input"
                            value={logistics.deliveryDate || ''}
                            onChange={e => updateLogistics('deliveryDate', e.target.value)}
                        />
                    </div>

                    <div className="form-group">
                        <label className="form-label">Turno Cita (AM/PM)</label>
                        <div style={{ display: 'flex', gap: '0.25rem' }}>
                            {['AM', 'PM'].map(slot => (
                                <button
                                    key={slot}
                                    type="button"
                                    onClick={() => updateLogistics('timeWindow', slot)}
                                    style={{
                                        flex: 1, padding: '0.4rem', borderRadius: '6px', fontSize: '0.8rem', fontWeight: 600,
                                        border: '1px solid var(--border)', cursor: 'pointer',
                                        background: logistics.timeWindow === slot ? 'var(--primary-color)' : 'var(--background)',
                                        color: logistics.timeWindow === slot ? 'white' : 'var(--text-main)',
                                    }}
                                >
                                    {slot}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
