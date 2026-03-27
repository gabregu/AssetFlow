'use client';

import React from 'react';

export default function CaseLogisticsSection({
    task,
    onUpdateTask,
    users,
    currentUser
}) {
    if (!task) return null;

    const [localValues, setLocalValues] = React.useState({});
    const [isSaving, setIsSaving] = React.useState(false);

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

    const updateLogistics = async (updatesOrField, valueIfSingle) => {
        setIsSaving(true);
        let incomingUpdates = {};
        if (typeof updatesOrField === 'string') {
            incomingUpdates[updatesOrField] = valueIfSingle;
        } else {
            incomingUpdates = { ...updatesOrField };
        }

        // 1. Actualización visual inmediata (Optimista)
        setLocalValues(prev => ({ ...prev, ...incomingUpdates }));

        // 2. Lógica de Negocio y Automación
        const finalUpdates = { ...incomingUpdates };
        
        // Leemos el estado REAL actual del task (el grabado en DB), no el local state.
        // Si el usuario acaba de cambiar el status en este mismo update, lo tomamos de ahí.
        let currentStatus = incomingUpdates.status !== undefined ? incomingUpdates.status : (task.status || 'Pendiente');

        // --- AUTOMATIZACIÓN A: Pendiente -> Para Coordinar ---
        // Se dispara cuando se asigna información logística relevante (excluyendo time_slot
        // ya que tiene un default de 'AM' y no cuenta como elección explícita del usuario).
        const hasExplicitLogisticsInfo = !!(incomingUpdates.method || incomingUpdates.delivery_person || incomingUpdates.date);
        
        if (hasExplicitLogisticsInfo && currentStatus === 'Pendiente') {
            currentStatus = 'Para Coordinar';
            finalUpdates.status = 'Para Coordinar';
            setLocalValues(prev => ({ ...prev, status: 'Para Coordinar' }));
        }

        // --- AUTOMATIZACIÓN B: Para Coordinar -> En Transito ---
        // Se dispara SÓLO cuando el caso ya está en 'Para Coordinar' (en DB o en este update)
        // y se confirma fecha + turno explícito.
        const effectiveDate = incomingUpdates.date || task.date;
        const effectiveTimeSlot = incomingUpdates.time_slot; // Solo cuenta si el usuario lo cambió AHORA
        
        const readyForTransit = effectiveDate && effectiveTimeSlot && currentStatus === 'Para Coordinar';
        if (readyForTransit) {
            currentStatus = 'En Transito';
            finalUpdates.status = 'En Transito';
            setLocalValues(prev => ({ ...prev, status: 'En Transito' }));
        }

        // Si cambiamos el repartidor, buscamos su UID (assigned_to)
        if (incomingUpdates.delivery_person) {
            const matchedUser = users.find(u => u.name === incomingUpdates.delivery_person);
            finalUpdates.assigned_to = matchedUser ? (matchedUser.id || matchedUser.uid) : null;
        }

        // Siempre grabamos el status final calculado
        finalUpdates.status = currentStatus;

        try {
            await onUpdateTask(finalUpdates);
        } finally {
            setTimeout(() => setIsSaving(false), 500);
        }
    };

    return (
        <div style={{ marginTop: '2rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.5rem' }}>
                <h4 style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--primary-color)', margin: 0 }}>
                    Logística del Caso
                </h4>
                {isSaving && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--primary-color)', fontSize: '0.75rem', fontWeight: 600 }}>
                        <div className="spinner-mini" style={{ width: '12px', height: '12px', border: '2px solid rgba(37, 99, 235, 0.2)', borderTopColor: 'var(--primary-color)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }}></div>
                        Guardando...
                    </div>
                )}
            </div>

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
                        <option value="No requiere accion">No requiere acción (Sin intervención)</option>
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
                                e.preventDefault();
                                const newDate = e.target.value;
                                const updates = { date: newDate };
                                
                                // Autocompletar "Coordinado por" si hay una fecha
                                if (newDate && currentUser?.name) {
                                    updates.coordinated_by = currentUser.name;
                                }

                                updateLogistics(updates);
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
                                            const updates = { time_slot: slot };
                                            
                                            // Autocompletar "Coordinado por" también al elegir turno
                                            if (currentUser?.name) {
                                                updates.coordinated_by = currentUser.name;
                                            }

                                            updateLogistics(updates);
                                        }}
                                        style={{
                                            flex: 1,
                                            borderRadius: '6px',
                                            border: '1px solid var(--border)',
                                            background: (localValues.time_slot || 'AM') === slot ? 'var(--primary-color)' : 'var(--surface)',
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
