'use client';

import React from 'react';

export default function CaseLogisticsSection({
    task,
    onUpdateTask,
    users,
    currentUser,
    saveRef  // <-- ref externo para poder llamar saveAll() desde el padre
}) {
    if (!task) return null;

    const [localValues, setLocalValues] = React.useState({});
    const localStateRef = React.useRef({});
    const [isSaving, setIsSaving] = React.useState(false);

    React.useEffect(() => {
        const initialState = {
            status: task.status || 'Pendiente',
            method: task.method || '',
            delivery_person: task.delivery_person || '',
            coordinated_by: task.coordinated_by || '',
            tracking_number: task.tracking_number || '',
            date: task.date || '',
            time_slot: task.time_slot || 'AM'
        };
        setLocalValues(initialState);
        localStateRef.current = initialState;
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

        // Combinar instantáneamente con el historial exacto local para evadir race-conditions (clickeos rápidos)
        const absoluteState = { ...localStateRef.current, ...incomingUpdates };
        localStateRef.current = absoluteState; // Persistir para la próxima iteración instantánea

        const finalUpdates = { ...incomingUpdates };
        let currentStatus = incomingUpdates.status !== undefined ? incomingUpdates.status : absoluteState.status;

        // --- AUTOMATIZACIÓN A: Pendiente -> Para Coordinar ---
        const hasExplicitLogisticsInfo = !!(absoluteState.method || absoluteState.delivery_person || absoluteState.date);
        
        if (hasExplicitLogisticsInfo && currentStatus === 'Pendiente') {
            currentStatus = 'Para Coordinar';
            finalUpdates.status = 'Para Coordinar';
        }

        // --- AUTOMATIZACIÓN B: Para Coordinar -> En Transito ---
        // Evaluar con el estado unificado, asumiendo 'time_slot' (que tiene AM default) y 'date'
        const readyForTransit = !!(absoluteState.date && absoluteState.time_slot && currentStatus === 'Para Coordinar');
        if (readyForTransit) {
            currentStatus = 'En Transito';
            finalUpdates.status = 'En Transito';
        }

        // Si cambiamos el repartidor, buscamos su UID (assigned_to)
        if (incomingUpdates.delivery_person) {
            const matchedUser = users.find(u => u.name === incomingUpdates.delivery_person);
            finalUpdates.assigned_to = matchedUser ? (matchedUser.id || matchedUser.uid) : null;
        }

        // 1. Actualización visual inmediata, sincronizando el status calculado
        absoluteState.status = currentStatus;
        localStateRef.current = absoluteState;
        setLocalValues(absoluteState);

        // Siempre grabamos el status final calculado
        finalUpdates.status = currentStatus;

        try {
            await onUpdateTask(finalUpdates);
        } finally {
            setTimeout(() => setIsSaving(false), 500);
        }
    };

    // Función de guardado COMPLETO: envía el estado local total a la DB de una vez
    // Ideal para usarse al cerrar el modal (para no perder cambios)
    const saveAll = async () => {
        const state = localStateRef.current;
        if (!state || Object.keys(state).length === 0) return;

        setIsSaving(true);
        let currentStatus = state.status || task.status || 'Pendiente';

        // Aplicar lógica de negocio también en el guardado final
        const hasLogisticsInfo = !!(state.method || state.delivery_person || state.date);
        if (hasLogisticsInfo && currentStatus === 'Pendiente') currentStatus = 'Para Coordinar';
        const readyForTransit = !!(state.date && state.time_slot && currentStatus === 'Para Coordinar');
        if (readyForTransit) currentStatus = 'En Transito';

        const payload = {
            status: currentStatus,
            method: state.method,
            delivery_person: state.delivery_person,
            assigned_to: state.assigned_to,
            date: state.date,
            time_slot: state.time_slot,
            coordinated_by: state.coordinated_by,
            tracking_number: state.tracking_number,
        };

        try {
            await onUpdateTask(payload);
        } finally {
            setTimeout(() => setIsSaving(false), 500);
        }
    };

    // Exponer saveAll al padre vía ref
    if (saveRef) saveRef.current = saveAll;

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

                {(localValues.method === 'Andreani' || localValues.method === 'Correo Argentino') && (
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

                {localValues.method === 'Repartidor Propio' && (
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
                            id={`delivery-date-${task.id || 'legacy'}`}
                            name="delivery_date"
                            type="date"
                            className="form-input"
                            value={localValues.date || ''}
                            onChange={e => {
                                const newDate = e.target.value;
                                const updates = { date: newDate };
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
