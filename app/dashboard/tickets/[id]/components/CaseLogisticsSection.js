'use client';

import React from 'react';

export default function CaseLogisticsSection({
    task,
    onUpdateTask,
    users
}) {
    if (!task) return null;

    const [localValues, setLocalValues] = React.useState({});

    React.useEffect(() => {
        setLocalValues({
            status: task.status || 'Pendiente',
            method: task.method || '',
            delivery_person: task.delivery_person || '',
            coordinated_by: task.coordinated_by || '',
            tracking_number: task.tracking_number || '',
            date: task.date || '',
            time_slot: task.time_slot || 'AM'
        });
    }, [task]);

    const isRelational = !!task.id;

    const updateLogistics = async (field, value) => {
        // Actualización visual inmediata
        setLocalValues(prev => ({ ...prev, [field]: value }));

        const updates = {};
        let newStatus = localValues.status || 'Pendiente';

        // Automación de estados: Al asignar método o repartidor -> "Para Coordinar"
        if ((field === 'method' && value) || (field === 'delivery_person' && value)) {
            if (newStatus === 'Pendiente') {
                newStatus = 'Para Coordinar';
                setLocalValues(prev => ({ ...prev, status: 'Para Coordinar' }));
            }
        } else if (field === 'status') {
            newStatus = value;
        }

        // Si cambiamos el repartidor, buscamos su UID (assigned_to)
        if (field === 'delivery_person') {
            const matchedUser = users.find(u => u.name === value);
            updates.assigned_to = matchedUser ? (matchedUser.id || matchedUser.uid) : null;
        }

        // Aplicamos el cambio solicitado y el estado automatizado (TODO en snake_case)
        updates[field] = value;
        updates.status = newStatus;

        await onUpdateTask(updates);
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
                        value={localValues.status || 'Pendiente'}
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
                        value={localValues.method || ''}
                        onChange={e => updateLogistics('method', e.target.value)}
                    >
                        <option value="">Seleccionar...</option>
                        <option value="Andreani">Andreani</option>
                        <option value="Correo Argentino">Correo Argentino</option>
                        <option value="Repartidor Propio">Repartidor Propio</option>
                    </select>
                </div>

                {( (task.method === 'Andreani' || task.method === 'Correo Argentino') || (task.logistics?.method === 'Andreani' || task.logistics?.method === 'Correo Argentino') ) && (
                    <div className="form-group">
                        <label className="form-label">Número de Seguimiento</label>
                        <input
                            className="form-input"
                            placeholder="Ej: AR123456789"
                            value={localValues.tracking_number || ''}
                            onChange={e => updateLogistics('tracking_number', e.target.value)}
                        />
                    </div>
                )}

                {(task.method === 'Repartidor Propio' || task.logistics?.method === 'Repartidor Propio') && (
                    <div className="form-group">
                        <label className="form-label">Nombre del Repartidor</label>
                        <select
                            className="form-select"
                            value={localValues.delivery_person || ''}
                            onChange={e => updateLogistics('delivery_person', e.target.value)}
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

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                    <div className="form-group">
                        <label className="form-label">Fecha de Entrega/Retiro</label>
                        <input
                            type="date"
                            className="form-input"
                            value={localValues.date || ''}
                            onChange={e => {
                                const newDate = e.target.value;
                                if (newDate && localValues.time_slot && (localValues.status === 'Para Coordinar')) {
                                    updateLogistics('status', 'En Transito');
                                }
                                updateLogistics('date', newDate);
                            }}
                        />
                    </div>
                    <div className="form-group">
                        <label className="form-label">Turno (AM / PM)</label>
                        <div style={{ display: 'flex', gap: '0.4rem', height: '42px' }}>
                            {['AM', 'PM'].map(slot => {
                                return (
                                    <button
                                        key={slot}
                                        type="button"
                                        onClick={() => {
                                            if (localValues.date && (localValues.status === 'Para Coordinar')) {
                                                updateLogistics('status', 'En Transito');
                                            }
                                            updateLogistics('time_slot', slot);
                                        }}
                                        style={{
                                            flex: 1,
                                            borderRadius: '6px',
                                            border: '1px solid var(--border)',
                                            background: (localValues.time_slot || 'AM') === slot ? 'var(--primary-color)' : 'white',
                                            color: (localValues.time_slot || 'AM') === slot ? 'white' : 'var(--text-main)',
                                            fontWeight: 600,
                                            cursor: 'pointer'
                                        }}
                                    >
                                        {slot}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                </div>

                <div className="form-group">
                    <label className="form-label">Coordinado por</label>
                    <select
                        className="form-select"
                        value={localValues.coordinated_by || ''}
                        onChange={e => updateLogistics('coordinated_by', e.target.value)}
                    >
                        <option value="">Seleccionar responsable...</option>
                        {users.map(u => (
                            <option key={u.id} value={u.name}>
                                {u.name} {u.role ? `(${u.role})` : ''}
                            </option>
                        ))}
                    </select>
                </div>

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
