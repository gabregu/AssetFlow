'use client';

import React from 'react';
import { Card } from '@/app/components/ui/Card';
import { Button } from '@/app/components/ui/Button';
import { Badge } from '@/app/components/ui/Badge';
import { 
    Phone, 
    MessageCircle, 
    MapPin, 
    Navigation, 
    Package, 
    ClipboardCheck, 
    ChevronLeft,
    Clock,
    User
} from 'lucide-react';
import Link from 'next/link';
import InstructionsCard from './InstructionsCard';

export default function DriverDetailView({ 
    ticket, 
    editedData, 
    setEditedData, 
    updateTicket, 
    currentUser,
    unifiedTasks 
}) {
    // Extraer datos del contacto
    const contactName = ticket.requester || 'Destinatario';
    const contactPhone = ticket.deliveryDetails?.contactPhone || '';
    const address = ticket.logistics?.address || 'Dirección no especificada';
    const status = ticket.logistics?.status || 'Pendiente';

    const handleWhatsApp = () => {
        if (!contactPhone) return;
        const cleanPhone = contactPhone.replace(/\D/g, '');
        window.open(`https://wa.me/${cleanPhone}`, '_blank');
    };

    const handleCall = () => {
        if (!contactPhone) return;
        window.location.href = `tel:${contactPhone}`;
    };

    const handleNavigate = () => {
        window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`, '_blank');
    };

    const getStatusColor = (s) => {
        switch (s) {
            case 'En Transito': return '#0ea5e9';
            case 'Entregado': return '#22c55e';
            case 'Para Coordinar': return '#f59e0b';
            default: return '#64748b';
        }
    };

    return (
        <div style={{ padding: '0.5rem', display: 'flex', flexDirection: 'column', gap: '1rem', paddingBottom: '3rem' }}>
            
            {/* Header / Botón Volver */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <Link href="/dashboard/my-tickets">
                    <Button variant="ghost" size="sm" icon={ChevronLeft}>Volver</Button>
                </Link>
                <div style={{ flex: 1 }}>
                    <h2 style={{ fontSize: '1.25rem', fontWeight: 800 }}>VISTA CONDUCTOR</h2>
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Caso #{ticket.id.toString().substring(0, 8)}</p>
                </div>
                <Badge style={{ backgroundColor: getStatusColor(status), color: 'white', padding: '0.5rem 1rem', fontSize: '0.9rem' }}>
                    {status}
                </Badge>
            </div>

            {/* CONTACT CARD */}
            <Card style={{ padding: '1.25rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
                    <div style={{ width: '48px', height: '48px', borderRadius: '50%', backgroundColor: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#3b82f6' }}>
                        <User size={24} />
                    </div>
                    <div>
                        <h3 style={{ fontSize: '1.1rem', fontWeight: 700 }}>{contactName}</h3>
                        <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Cliente / Recibe</p>
                    </div>
                </div>

                <div style={{ display: 'flex', gap: '0.75rem' }}>
                    <Button 
                        variant="secondary" 
                        icon={Phone} 
                        onClick={handleCall} 
                        style={{ flex: 1, padding: '1rem', height: 'auto', flexDirection: 'column', gap: '0.5rem' }}
                        disabled={!contactPhone}
                    >
                        Llamar
                    </Button>
                    <Button 
                        variant="success" 
                        icon={MessageCircle} 
                        onClick={handleWhatsApp} 
                        style={{ flex: 1, padding: '1rem', height: 'auto', flexDirection: 'column', gap: '0.5rem' }}
                        disabled={!contactPhone}
                    >
                        WhatsApp
                    </Button>
                </div>
            </Card>

            {/* LOCATION CARD */}
            <Card style={{ padding: '1.25rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
                    <div style={{ width: '48px', height: '48px', borderRadius: '50%', backgroundColor: '#fef2f2', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ef4444' }}>
                        <MapPin size={24} />
                    </div>
                    <div style={{ flex: 1 }}>
                        <h4 style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 700, textTransform: 'uppercase' }}>Dirección de Entrega</h4>
                        <p style={{ fontSize: '0.95rem', fontWeight: 500, lineHeight: '1.3' }}>{address}</p>
                    </div>
                </div>
                <Button 
                    variant="primary" 
                    icon={Navigation} 
                    onClick={handleNavigate} 
                    style={{ width: '100%', padding: '1rem', fontSize: '1rem', borderRadius: '12px' }}
                >
                    COMO LLEGAR (GPS)
                </Button>
            </Card>

            {/* TASKS / ITEMS CARD */}
            <Card title="Ítems del Caso" padding="1rem">
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    {unifiedTasks.map((task, idx) => (
                        <div key={idx} style={{ padding: '0.75rem', border: '1px solid var(--border)', borderRadius: '8px', backgroundColor: 'var(--background-secondary)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                                <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>{task.caseNumber || `Sub-Caso ${idx+1}`}</span>
                                <Badge variant={task.status === 'Entregado' ? 'success' : 'warning'}>{task.status || 'Pendiente'}</Badge>
                            </div>
                            <p style={{ fontSize: '0.85rem', marginBottom: '0.5rem' }}>{task.subject}</p>
                            
                            {/* Activos vinculados */}
                            {task.assets && task.assets.length > 0 && (
                                <div style={{ borderTop: '1px solid var(--border)', paddingTop: '0.5rem', display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                                    {task.assets.map((asset, aIdx) => (
                                        <div key={aIdx} style={{ fontSize: '0.7rem', background: 'white', padding: '2px 6px', borderRadius: '4px', border: '1px solid var(--border)' }}>
                                            📦 {asset.serial || asset}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    ))}
                    {unifiedTasks.length === 0 && (
                        <p style={{ textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>No hay ítems específicos cargados.</p>
                    )}
                </div>
            </Card>

            {/* CHAT / INSTRUCTIONS (Same component but full width) */}
            <InstructionsCard 
                ticket={ticket}
                editedData={editedData}
                setEditedData={setEditedData}
                updateTicket={updateTicket}
                currentUser={currentUser}
            />

            {/* QUICK ACTIONS FOOTER (Optional, for easy thumb reach) */}
            <div style={{ padding: '1rem', textAlign: 'center' }}>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Operado por {currentUser?.name}</p>
            </div>
            
        </div>
    );
}
