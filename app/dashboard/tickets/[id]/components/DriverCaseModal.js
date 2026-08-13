'use client';

import React, { useState } from 'react';
import { Modal } from '@/app/components/ui/Modal';
import { Button } from '@/app/components/ui/Button';
import { Badge } from '@/app/components/ui/Badge';
import { Package, Calendar, Clock, MapPin, CheckCircle, Truck, MessageCircle } from 'lucide-react';
import { getStatusVariant } from '../../constants';

/**
 * DriverCaseModal — Modal liviano para conductores.
 * Muestra los datos del caso/tarea de forma legible y permite 
 * reportar la entrega (cambiar estado a "Entregado").
 * NO usa supabase directamente ni lógica compleja de admin.
 */
export default function DriverCaseModal({
    isOpen,
    onClose,
    task,
    ticket,
    updateLogisticsTask,
    currentUser
}) {
    const [isSaving, setIsSaving] = useState(false);
    const [statusOverride, setStatusOverride] = useState(null);

    if (!task) return null;

    const status = statusOverride || task.status || 'Pendiente';
    const assets = Array.isArray(task.assets) ? task.assets : [];
    const yubikeys = Array.isArray(task.yubikeys) ? task.yubikeys : [];

    const handleReportDelivered = async () => {
        if (isSaving) return;
        if (!confirm('¿Confirmas que este caso fue entregado exitosamente?')) return;
        setIsSaving(true);
        try {
            if (task.id && updateLogisticsTask) {
                await updateLogisticsTask(task.id, {
                    status: 'Entregado',
                    delivery_info: {
                        deliveredAt: new Date().toISOString(),
                        deliveredBy: currentUser?.name || 'Conductor'
                    }
                });
            }
            setStatusOverride('Entregado');
        } catch (e) {
            console.error('Error reporting delivery:', e);
        } finally {
            setIsSaving(false);
        }
    };

    const handleReportInTransit = async () => {
        if (isSaving) return;
        setIsSaving(true);
        try {
            if (task.id && updateLogisticsTask) {
                await updateLogisticsTask(task.id, { status: 'En Transito' });
            }
            setStatusOverride('En Transito');
        } catch (e) {
            console.error('Error updating status:', e);
        } finally {
            setIsSaving(false);
        }
    };

    const handleNavigate = () => {
        const addr = task.address || ticket?.logistics?.address || '';
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
            title={`Caso: ${typeof task.subject === 'string' ? task.subject : 'Caso Asociado'}`}
            disableOutsideClick={false}
        >
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

                {/* Estado */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Estado actual</span>
                    <Badge variant={getStatusVariant(status)} style={{ fontSize: '0.9rem', padding: '0.4rem 0.9rem' }}>
                        {status}
                    </Badge>
                </div>

                {/* Fecha y hora */}
                {(task.date || task.time_slot) && (
                    <div style={{ display: 'flex', gap: '1rem', padding: '0.75rem', backgroundColor: 'var(--background-secondary)', borderRadius: '10px' }}>
                        {task.date && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem' }}>
                                <Calendar size={15} style={{ color: 'var(--primary-color)' }} />
                                <span>{typeof task.date === 'string' ? task.date : 'Sin fecha'}</span>
                            </div>
                        )}
                        {task.time_slot && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem' }}>
                                <Clock size={15} style={{ color: 'var(--primary-color)' }} />
                                <span>{typeof task.time_slot === 'string' ? task.time_slot : ''}</span>
                            </div>
                        )}
                    </div>
                )}

                {/* Dirección */}
                {(task.address || ticket?.logistics?.address) && (
                    <div style={{ padding: '0.75rem', backgroundColor: '#fef2f2', borderRadius: '10px', border: '1px solid rgba(239,68,68,0.15)' }}>
                        <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#ef4444', textTransform: 'uppercase', marginBottom: '4px' }}>Dirección</div>
                        <p style={{ fontSize: '0.9rem', margin: 0 }}>{task.address || ticket?.logistics?.address}</p>
                        {(task.floorDept || task.floor_dept || ticket?.logistics?.floorDept) && (
                            <p style={{ fontSize: '0.8rem', fontWeight: 700, marginTop: '4px', color: '#1e293b' }}>
                                Piso/Depto: {task.floorDept || task.floor_dept || ticket?.logistics?.floorDept}
                            </p>
                        )}
                    </div>
                )}

                {/* Activos del caso */}
                {(assets.length > 0 || yubikeys.length > 0) && (
                    <div>
                        <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '0.5rem' }}>
                            <Package size={12} style={{ display: 'inline', marginRight: 4 }} /> Equipos del caso
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                            {assets.map((a, i) => (
                                <div key={i} style={{ padding: '0.5rem 0.75rem', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '0.8rem', fontWeight: 600 }}>
                                    {typeof a === 'object' ? (a.serial || 'Sin serial') : String(a)}
                                    {typeof a === 'object' && a.type && <span style={{ color: 'var(--text-secondary)', fontWeight: 400 }}> · {a.type}</span>}
                                </div>
                            ))}
                            {yubikeys.map((y, i) => (
                                <div key={`yk-${i}`} style={{ padding: '0.5rem 0.75rem', background: '#fef3c7', border: '1px solid #fcd34d', borderRadius: '8px', fontSize: '0.8rem', fontWeight: 600, color: '#92400e' }}>
                                    🔑 Yubikey: {typeof y === 'object' ? (y.serial || 'Sin serial') : String(y)}
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Acciones de contacto */}
                <div style={{ display: 'flex', gap: '0.75rem' }}>
                    <Button variant="ghost" icon={MapPin} onClick={handleNavigate} style={{ flex: 1 }}>GPS</Button>
                    <Button variant="secondary" icon={MessageCircle} onClick={handleWhatsApp} style={{ flex: 1 }}>WhatsApp</Button>
                </div>

                {/* Botones de estado */}
                {status !== 'Entregado' && status !== 'Finalizado' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', borderTop: '1px solid var(--border)', paddingTop: '1rem' }}>
                        {status !== 'En Transito' && (
                            <Button
                                variant="secondary"
                                icon={Truck}
                                onClick={handleReportInTransit}
                                disabled={isSaving}
                                style={{ width: '100%', padding: '0.9rem', fontSize: '0.9rem', fontWeight: 700 }}
                            >
                                {isSaving ? 'Actualizando...' : 'MARCAR EN TRÁNSITO'}
                            </Button>
                        )}
                        <Button
                            variant="success"
                            icon={CheckCircle}
                            onClick={handleReportDelivered}
                            disabled={isSaving}
                            style={{ width: '100%', padding: '1rem', fontSize: '1rem', fontWeight: 800, borderRadius: '12px' }}
                        >
                            {isSaving ? 'Guardando...' : '✓ CONFIRMAR ENTREGA'}
                        </Button>
                    </div>
                )}

                {(status === 'Entregado' || status === 'Finalizado') && (
                    <div style={{ textAlign: 'center', padding: '1rem', backgroundColor: 'rgba(16, 185, 129, 0.1)', borderRadius: '10px', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
                        <CheckCircle size={24} style={{ color: '#10b981' }} />
                        <p style={{ fontWeight: 700, color: '#10b981', marginTop: '0.5rem' }}>¡Caso entregado!</p>
                    </div>
                )}

                <Button variant="ghost" onClick={onClose} style={{ width: '100%' }}>
                    Cerrar
                </Button>
            </div>
        </Modal>
    );
}
