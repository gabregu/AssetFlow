'use client';

import React from 'react';

export default function CaseLogisticsSection({
    task,
    onUpdateTask,
    users
}) {
    if (!task) return null;

    const isRelational = !!task.id;

    const updateLogistics = (field, value) => {
        const updates = {};
        let newStatus = task.status || 'Pendiente';

        // Automación de estados: Al asignar método o repartidor -> "Para Coordinar"
        if ((field === 'method' && value) || (field === 'deliveryPerson' && value)) {
            if (newStatus === 'Pendiente') {
                newStatus = 'Para Coordinar';
            }
        } else if (field === 'status') {
            newStatus = value;
        }

        // Mapeo de campos según el modelo
        const propMap = isRelational ? {
            status: 'status',
            method: 'method',
            deliveryPerson: 'delivery_person',
            assignedTo: 'assigned_to',
            trackingNumber: 'tracking_number',
            deliveryInfo: 'delivery_info'
        } : {
            status: 'status',
            method: 'method',
            deliveryPerson: 'deliveryPerson',
            assignedTo: 'assignedTo',
            trackingNumber: 'trackingNumber',
            deliveryInfo: 'deliveryInfo'
        };

        // Si cambiamos el repartidor, buscamos su UID (assignedTo/assigned_to)
        if (field === 'deliveryPerson') {
            const matchedUser = users.find(u => u.name === value);
            updates[propMap.assignedTo] = matchedUser ? (matchedUser.id || matchedUser.uid) : null;
        }

        // Aplicamos el cambio solicitado
        const targetField = propMap[field] || field;
        updates[targetField] = value;
        
        // Aplicamos el estado automatizado
        updates[propMap.status] = newStatus;

        onUpdateTask(updates);
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
                        value={task.status || 'Pendiente'}
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
                        value={task.method || ''}
                        onChange={e => updateLogistics('method', e.target.value)}
                    >
                        <option value="">Seleccionar...</option>
                        <option value="Andreani">Andreani</option>
                        <option value="Correo Argentino">Correo Argentino</option>
                        <option value="Repartidor Propio">Repartidor Propio</option>
                    </select>
                </div>

                {(task.method === 'Andreani' || task.method === 'Correo Argentino') && (
                    <div className="form-group">
                        <label className="form-label">Número de Seguimiento</label>
                        <input
                            className="form-input"
                            placeholder="Ej: AR123456789"
                            value={task.trackingNumber || ''}
                            onChange={e => updateLogistics('trackingNumber', e.target.value)}
                        />
                    </div>
                )}

                {task.method === 'Repartidor Propio' && (
                    <div className="form-group">
                        <label className="form-label">Nombre del Repartidor</label>
                        <select
                            className="form-select"
                            value={task.deliveryPerson || ''}
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

                {(task.status === 'Entregado' || task.status === 'Finalizado') && (
                    <div style={{ marginTop: '1rem', padding: '1rem', background: 'rgba(34, 197, 94, 0.05)', borderRadius: '8px', border: '1px solid rgba(34, 197, 94, 0.2)' }}>
                        <h5 style={{ fontSize: '0.8rem', fontWeight: 700, color: '#166534', marginBottom: '0.75rem', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <div style={{ width: '6px', height: '6px', background: '#22c55e', borderRadius: '50%' }}></div>
                            Información de Entrega
                        </h5>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                            <div className="form-group">
                                <label className="form-label" style={{ fontSize: '0.75rem', opacity: 0.8 }}>Recibido por</label>
                                <input
                                    className="form-input"
                                    style={{ padding: '0.4rem 0.75rem', fontSize: '0.85rem' }}
                                    value={task.deliveryInfo?.receivedBy || ''}
                                    onChange={e => updateLogistics('deliveryInfo', { ...(task.deliveryInfo || {}), receivedBy: e.target.value })}
                                    placeholder="Nombre completo"
                                />
                            </div>
                            <div className="form-group">
                                <label className="form-label" style={{ fontSize: '0.75rem', opacity: 0.8 }}>DNI</label>
                                <input
                                    className="form-input"
                                    style={{ padding: '0.4rem 0.75rem', fontSize: '0.85rem' }}
                                    value={task.deliveryInfo?.dni || ''}
                                    onChange={e => updateLogistics('deliveryInfo', { ...(task.deliveryInfo || {}), dni: e.target.value })}
                                    placeholder="DNI"
                                />
                            </div>
                        </div>
                        <div className="form-group" style={{ marginTop: '0.75rem' }}>
                            <label className="form-label" style={{ fontSize: '0.75rem', opacity: 0.8 }}>Notas de Entrega</label>
                            <textarea
                                className="form-input"
                                style={{ padding: '0.4rem 0.75rem', minHeight: '60px', resize: 'vertical', fontSize: '0.85rem' }}
                                value={task.deliveryInfo?.notes || ''}
                                onChange={e => updateLogistics('deliveryInfo', { ...(task.deliveryInfo || {}), notes: e.target.value })}
                                placeholder="Observaciones del repartidor..."
                            />
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
