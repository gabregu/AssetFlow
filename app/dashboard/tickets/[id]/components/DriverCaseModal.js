'use client';

import React, { useState, useEffect } from 'react';
import { Modal } from '@/app/components/ui/Modal';
import { Button } from '@/app/components/ui/Button';
import { Badge } from '@/app/components/ui/Badge';
import { Package, Calendar, Clock, MapPin, CheckCircle, Truck, MessageCircle, Save, Edit3, RotateCcw } from 'lucide-react';
import { getStatusVariant } from '../../constants';

/**
 * DriverCaseModal — Modal interactivo para conductores.
 * Permite al conductor:
 * 1. Coordinar fecha y turno (AM / PM).
 * 2. Editar la dirección de entrega y piso/depto.
 * 3. Marcar el caso "En Tránsito" o "Entregado".
 */
export default function DriverCaseModal({
    isOpen,
    onClose,
    task,
    ticket,
    updateLogisticsTask,
    addLogisticsTask,
    updateTicket,
    currentUser
}) {
    const [isSaving, setIsSaving] = useState(false);
    const [statusOverride, setStatusOverride] = useState(null);

    // Campos editables por el conductor
    const [editDate, setEditDate] = useState('');
    const [editTimeSlot, setEditTimeSlot] = useState('AM');
    const [editAddress, setEditAddress] = useState('');
    const [editFloorDept, setEditFloorDept] = useState('');
    const [isEditingAddress, setIsEditingAddress] = useState(false);

    // Sincronizar estado cuando cambia el task o se abre el modal
    useEffect(() => {
        if (task && isOpen) {
            setEditDate(task.date || '');
            const rawSlot = (task.time_slot || task.timeSlot || 'AM').toUpperCase();
            setEditTimeSlot(rawSlot.includes('PM') ? 'PM' : 'AM');
            setEditAddress(task.address || ticket?.logistics?.address || '');
            setEditFloorDept(task.floorDept || task.floor_dept || ticket?.logistics?.floorDept || '');
            setStatusOverride(null);
            setIsEditingAddress(false);
        }
    }, [task, ticket, isOpen]);

    if (!task) return null;

    const status = statusOverride || task.status || 'Pendiente';
    const assets = Array.isArray(task.assets) ? task.assets : [];
    const yubikeys = Array.isArray(task.yubikeys) ? task.yubikeys : [];

    // Detectar si hubo cambios respecto a la tarea original
    const initialDate = task.date || '';
    const initialSlot = (task.time_slot || task.timeSlot || 'AM').toUpperCase().includes('PM') ? 'PM' : 'AM';
    const initialAddr = task.address || ticket?.logistics?.address || '';
    const initialFloor = task.floorDept || task.floor_dept || ticket?.logistics?.floorDept || '';

    const hasChanges = (
        editDate !== initialDate ||
        editTimeSlot !== initialSlot ||
        editAddress !== initialAddr ||
        editFloorDept !== initialFloor
    );

    // Guardar cambios de coordinación y/o dirección
    const handleSaveCoordination = async (newStatus = null) => {
        if (isSaving) return;
        setIsSaving(true);
        try {
            const updates = {
                date: editDate || null,
                time_slot: editTimeSlot || 'AM',
                timeSlot: editTimeSlot || 'AM',
                address: editAddress
            };

            if (newStatus) {
                updates.status = newStatus;
            } else if ((status === 'Para Coordinar' || status === 'Pendiente') && editDate) {
                updates.status = 'Coordinado';
            }

            // 1. Si la tarea ya tiene un ID en la tabla logistics_tasks
            if (task.id && updateLogisticsTask) {
                await updateLogisticsTask(task.id, updates);
            } 
            // 2. Si la tarea es un caso no promovido aún (legacy o auto-linkeado sin fila en logistics_tasks)
            else if (addLogisticsTask && ticket) {
                const newTask = {
                    ticketId: ticket.id,
                    caseNumber: task.caseNumber || task.case_number || 'Caso Principal',
                    subject: task.subject || ticket.subject || '',
                    status: updates.status || task.status || 'Coordinado',
                    method: task.method || '',
                    deliveryPerson: task.deliveryPerson || task.delivery_person || currentUser?.name || '',
                    assignedTo: task.assignedTo || task.assigned_to || '',
                    date: updates.date,
                    timeSlot: updates.time_slot,
                    address: updates.address,
                    assets: task.assets || [],
                    accessories: task.accessories || {},
                    yubikeys: task.yubikeys || []
                };
                await addLogisticsTask(newTask);
            }

            // 3. Sincronizar también con el ticket principal si corresponde
            if (updateTicket && ticket) {
                const updatedLogistics = {
                    ...(ticket.logistics || {}),
                    date: updates.date || ticket.logistics?.date,
                    timeSlot: updates.time_slot || ticket.logistics?.timeSlot || 'AM',
                    address: editAddress || ticket.logistics?.address,
                    floorDept: editFloorDept || ticket.logistics?.floorDept,
                    status: updates.status || ticket.logistics?.status || 'Coordinado'
                };
                await updateTicket(ticket.id, { logistics: updatedLogistics });
            }

            if (newStatus) {
                setStatusOverride(newStatus);
            } else if (updates.status) {
                setStatusOverride(updates.status);
            }

            setIsEditingAddress(false);
        } catch (e) {
            console.error('Error saving task coordination:', e);
            alert('Error al guardar la coordinación: ' + (e.message || 'Error desconocido'));
        } finally {
            setIsSaving(false);
        }
    };

    // Cambiar estado a "En Tránsito" guardando cualquier cambio pendiente
    const handleReportInTransit = async () => {
        await handleSaveCoordination('En Transito');
    };

    // Restablecer el estado a "Para Coordinar" si el cliente pide reprogramar
    const handleResetToToCoordinate = async () => {
        if (isSaving) return;
        if (!confirm('¿Deseas restablecer este caso a "Para Coordinar" para reprogramar fecha y turno?')) return;
        setIsSaving(true);
        try {
            const updates = {
                date: null,
                time_slot: 'AM',
                timeSlot: 'AM',
                address: editAddress,
                status: 'Para Coordinar'
            };

            setEditDate('');
            setEditTimeSlot('AM');

            if (task.id && updateLogisticsTask) {
                await updateLogisticsTask(task.id, updates);
            } else if (addLogisticsTask && ticket) {
                await addLogisticsTask({
                    ticketId: ticket.id,
                    caseNumber: task.caseNumber || task.case_number || 'Caso Principal',
                    subject: task.subject || ticket.subject || '',
                    ...updates
                });
            }

            if (updateTicket && ticket) {
                const updatedLogistics = {
                    ...(ticket.logistics || {}),
                    date: null,
                    timeSlot: 'AM',
                    status: 'Para Coordinar',
                    address: editAddress || ticket.logistics?.address,
                    floorDept: editFloorDept || ticket.logistics?.floorDept
                };
                await updateTicket(ticket.id, { logistics: updatedLogistics });
            }

            setStatusOverride('Para Coordinar');
        } catch (e) {
            console.error('Error resetting status to Para Coordinar:', e);
            alert('Error al actualizar estado: ' + (e.message || ''));
        } finally {
            setIsSaving(false);
        }
    };

    // Confirmar entrega final
    const handleReportDelivered = async () => {
        if (isSaving) return;
        if (!confirm('¿Confirmas que este caso fue completado/entregado exitosamente?')) return;
        setIsSaving(true);
        try {
            const deliveredUpdates = {
                date: editDate || task.date || null,
                time_slot: editTimeSlot || 'AM',
                timeSlot: editTimeSlot || 'AM',
                address: editAddress,
                status: 'Entregado',
                delivery_info: {
                    deliveredAt: new Date().toISOString(),
                    deliveredBy: currentUser?.name || 'Conductor',
                    receivedBy: ticket?.requester || ''
                }
            };

            if (task.id && updateLogisticsTask) {
                await updateLogisticsTask(task.id, deliveredUpdates);
            } else if (addLogisticsTask && ticket) {
                await addLogisticsTask({
                    ticketId: ticket.id,
                    caseNumber: task.caseNumber || task.case_number || 'Caso Principal',
                    subject: task.subject || ticket.subject || '',
                    ...deliveredUpdates
                });
            }

            if (updateTicket && ticket) {
                const updatedLogistics = {
                    ...(ticket.logistics || {}),
                    status: 'Entregado',
                    address: editAddress || ticket.logistics?.address,
                    floorDept: editFloorDept || ticket.logistics?.floorDept
                };
                await updateTicket(ticket.id, { logistics: updatedLogistics });
            }

            setStatusOverride('Entregado');
        } catch (e) {
            console.error('Error reporting delivery:', e);
        } finally {
            setIsSaving(false);
        }
    };

    const handleNavigate = () => {
        const addr = editAddress || task.address || ticket?.logistics?.address || '';
        if (addr) window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(addr)}`, '_blank');
    };

    const handleWhatsApp = () => {
        const phone = String(ticket?.logistics?.phone || ticket?.deliveryDetails?.contactPhone || '').replace(/\D/g, '');
        if (phone) window.open(`https://wa.me/${phone}`, '_blank');
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={`Caso: ${typeof task.subject === 'string' ? task.subject : (task.caseNumber || 'Caso Asociado')}`}
            disableOutsideClick={false}
        >
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.15rem' }}>

                {/* Estado Actual */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'var(--background-secondary)', padding: '0.6rem 0.85rem', borderRadius: '10px' }}>
                    <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Estado actual</span>
                    <Badge variant={getStatusVariant(status)} style={{ fontSize: '0.85rem', padding: '0.35rem 0.85rem' }}>
                        {status}
                    </Badge>
                </div>

                {/* COORDINACIÓN (FECHA Y TURNO AM/PM) */}
                <div style={{ backgroundColor: 'var(--background-secondary)', borderRadius: '12px', padding: '0.85rem', border: '1px solid var(--border)' }}>
                    <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '0.6rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Calendar size={14} style={{ color: 'var(--primary-color)' }} />
                        Coordinar Fecha y Turno
                    </div>
                    
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                        {/* Selector Fecha */}
                        <div>
                            <label style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                                Fecha de Visita
                            </label>
                            <input 
                                type="date"
                                value={editDate}
                                onChange={(e) => setEditDate(e.target.value)}
                                style={{
                                    width: '100%',
                                    padding: '0.45rem 0.5rem',
                                    borderRadius: '8px',
                                    border: '1px solid var(--border)',
                                    backgroundColor: 'var(--background)',
                                    color: 'var(--text-main)',
                                    fontSize: '0.82rem',
                                    outline: 'none'
                                }}
                            />
                        </div>

                        {/* Selector Turno AM / PM */}
                        <div>
                            <label style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                                Turno (Horario)
                            </label>
                            <div style={{ display: 'flex', gap: '0.35rem' }}>
                                <button
                                    type="button"
                                    onClick={() => setEditTimeSlot('AM')}
                                    style={{
                                        flex: 1,
                                        padding: '0.45rem 0.2rem',
                                        borderRadius: '8px',
                                        border: editTimeSlot === 'AM' ? '2px solid var(--primary-color)' : '1px solid var(--border)',
                                        backgroundColor: editTimeSlot === 'AM' ? 'rgba(59, 130, 246, 0.15)' : 'var(--background)',
                                        color: editTimeSlot === 'AM' ? 'var(--primary-color)' : 'var(--text-main)',
                                        fontWeight: editTimeSlot === 'AM' ? 800 : 500,
                                        fontSize: '0.82rem',
                                        cursor: 'pointer',
                                        transition: 'all 0.15s ease'
                                    }}
                                >
                                    ☀️ AM
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setEditTimeSlot('PM')}
                                    style={{
                                        flex: 1,
                                        padding: '0.45rem 0.2rem',
                                        borderRadius: '8px',
                                        border: editTimeSlot === 'PM' ? '2px solid var(--primary-color)' : '1px solid var(--border)',
                                        backgroundColor: editTimeSlot === 'PM' ? 'rgba(59, 130, 246, 0.15)' : 'var(--background)',
                                        color: editTimeSlot === 'PM' ? 'var(--primary-color)' : 'var(--text-main)',
                                        fontWeight: editTimeSlot === 'PM' ? 800 : 500,
                                        fontSize: '0.82rem',
                                        cursor: 'pointer',
                                        transition: 'all 0.15s ease'
                                    }}
                                >
                                    🌙 PM
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                {/* DIRECCIÓN DE ENTREGA (EDITABLE) */}
                <div style={{ padding: '0.85rem', backgroundColor: '#fef2f2', borderRadius: '12px', border: '1px solid rgba(239,68,68,0.2)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                        <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#ef4444', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <MapPin size={14} /> Dirección de Entrega
                        </div>
                        <button
                            type="button"
                            onClick={() => setIsEditingAddress(!isEditingAddress)}
                            style={{
                                background: 'none',
                                border: 'none',
                                color: '#ef4444',
                                fontSize: '0.75rem',
                                fontWeight: 700,
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '3px'
                            }}
                        >
                            <Edit3 size={12} /> {isEditingAddress ? 'Listo' : 'Editar'}
                        </button>
                    </div>

                    {isEditingAddress ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', marginTop: '0.4rem' }}>
                            <input
                                type="text"
                                placeholder="Calle, Número, Ciudad, CP..."
                                value={editAddress}
                                onChange={(e) => setEditAddress(e.target.value)}
                                style={{
                                    width: '100%',
                                    padding: '0.5rem',
                                    borderRadius: '8px',
                                    border: '1px solid #fca5a5',
                                    backgroundColor: '#fff',
                                    color: '#1e293b',
                                    fontSize: '0.85rem',
                                    outline: 'none'
                                }}
                            />
                            <input
                                type="text"
                                placeholder="Piso / Depto (ej: 8B)"
                                value={editFloorDept}
                                onChange={(e) => setEditFloorDept(e.target.value)}
                                style={{
                                    width: '100%',
                                    padding: '0.5rem',
                                    borderRadius: '8px',
                                    border: '1px solid #fca5a5',
                                    backgroundColor: '#fff',
                                    color: '#1e293b',
                                    fontSize: '0.85rem',
                                    outline: 'none'
                                }}
                            />
                        </div>
                    ) : (
                        <div>
                            <p style={{ fontSize: '0.88rem', margin: 0, fontWeight: 500, color: '#1e293b' }}>
                                {editAddress || 'Sin dirección especificada'}
                            </p>
                            {editFloorDept && (
                                <p style={{ fontSize: '0.8rem', fontWeight: 700, marginTop: '3px', color: '#1e293b' }}>
                                    Piso/Depto: {editFloorDept}
                                </p>
                            )}
                        </div>
                    )}
                </div>

                {/* Activos del caso */}
                {(assets.length > 0 || yubikeys.length > 0) && (
                    <div>
                        <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '0.4rem' }}>
                            <Package size={12} style={{ display: 'inline', marginRight: 4 }} /> Equipos del caso
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                            {assets.map((a, i) => (
                                <div key={i} style={{ padding: '0.45rem 0.65rem', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '0.8rem', fontWeight: 600 }}>
                                    {typeof a === 'object' ? (a.serial || 'Sin serial') : String(a)}
                                    {typeof a === 'object' && a.type && <span style={{ color: 'var(--text-secondary)', fontWeight: 400 }}> · {a.type}</span>}
                                </div>
                            ))}
                            {yubikeys.map((y, i) => (
                                <div key={`yk-${i}`} style={{ padding: '0.45rem 0.65rem', background: '#fef3c7', border: '1px solid #fcd34d', borderRadius: '8px', fontSize: '0.8rem', fontWeight: 600, color: '#92400e' }}>
                                    🔑 Yubikey: {typeof y === 'object' ? (y.serial || 'Sin serial') : String(y)}
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Acciones de contacto (GPS & WhatsApp) */}
                <div style={{ display: 'flex', gap: '0.65rem' }}>
                    <Button variant="ghost" icon={MapPin} onClick={handleNavigate} style={{ flex: 1, padding: '0.6rem' }}>GPS</Button>
                    <Button variant="secondary" icon={MessageCircle} onClick={handleWhatsApp} style={{ flex: 1, padding: '0.6rem' }}>WhatsApp</Button>
                </div>

                {/* Botones de acción / Estados */}
                {status !== 'Entregado' && status !== 'Finalizado' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem', borderTop: '1px solid var(--border)', paddingTop: '0.85rem' }}>
                        
                        {/* Botón Guardar Coordinación / Cambios si hubo modificaciones */}
                        {hasChanges && (
                            <Button
                                variant="primary"
                                icon={Save}
                                onClick={() => handleSaveCoordination()}
                                disabled={isSaving}
                                style={{ width: '100%', padding: '0.75rem', fontSize: '0.88rem', fontWeight: 700 }}
                            >
                                {isSaving ? 'Guardando...' : '💾 GUARDAR COORDINACIÓN'}
                            </Button>
                        )}

                        {/* Botón Marcar En Tránsito */}
                        {status !== 'En Transito' && (
                            <Button
                                variant="secondary"
                                icon={Truck}
                                onClick={handleReportInTransit}
                                disabled={isSaving}
                                style={{ width: '100%', padding: '0.85rem', fontSize: '0.9rem', fontWeight: 700, backgroundColor: '#eff6ff', color: '#2563eb', borderColor: '#bfdbfe' }}
                            >
                                {isSaving ? 'Actualizando...' : '🚚 MARCAR EN TRÁNSITO'}
                            </Button>
                        )}

                        {/* Botón Volver a Para Coordinar (si no está ya en Para Coordinar) */}
                        {status !== 'Para Coordinar' && (
                            <Button
                                variant="ghost"
                                icon={RotateCcw}
                                onClick={handleResetToToCoordinate}
                                disabled={isSaving}
                                style={{ 
                                    width: '100%', 
                                    padding: '0.65rem', 
                                    fontSize: '0.82rem', 
                                    fontWeight: 700, 
                                    color: '#b45309', 
                                    backgroundColor: '#fffbeb', 
                                    border: '1px dashed #fcd34d', 
                                    borderRadius: '8px' 
                                }}
                            >
                                {isSaving ? 'Actualizando...' : '↩️ REPROGRAMAR (VOLVER A "PARA COORDINAR")'}
                            </Button>
                        )}

                        {/* Botón Confirmar Entrega */}
                        <Button
                            variant="success"
                            icon={CheckCircle}
                            onClick={handleReportDelivered}
                            disabled={isSaving}
                            style={{ width: '100%', padding: '0.9rem', fontSize: '0.95rem', fontWeight: 800, borderRadius: '12px' }}
                        >
                            {isSaving ? 'Guardando...' : '✓ CONFIRMAR ENTREGA'}
                        </Button>
                    </div>
                )}

                {(status === 'Entregado' || status === 'Finalizado') && (
                    <div style={{ textAlign: 'center', padding: '0.85rem', backgroundColor: 'rgba(16, 185, 129, 0.1)', borderRadius: '10px', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
                        <CheckCircle size={22} style={{ color: '#10b981' }} />
                        <p style={{ fontWeight: 700, color: '#10b981', margin: '0.25rem 0 0 0', fontSize: '0.9rem' }}>¡Caso entregado!</p>
                    </div>
                )}

                <Button variant="ghost" onClick={onClose} style={{ width: '100%', padding: '0.5rem' }}>
                    Cerrar
                </Button>
            </div>
        </Modal>
    );
}
