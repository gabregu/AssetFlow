'use client';
import React, { useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';
import { Badge } from '../../../components/ui/Badge';
import { useStore } from '../../../../lib/store';
import {
    ArrowLeft,
    Printer,
    FileText,
    User,
    Hash,
    Calendar,
    ChevronRight,
    Package,
    Laptop,
    Smartphone,
    Monitor,
    MousePointer2,
    CheckCircle2
} from 'lucide-react';

export default function ReportDetailPage() {
    const { id } = useParams();
    const router = useRouter();
    const { tickets, assets } = useStore();

    const ticket = useMemo(() => tickets.find(t => t.id === id), [tickets, id]);

    if (!ticket) {
        return (
            <div style={{ padding: '2rem', textAlign: 'center' }}>
                <p>No se encontró el reporte solicitado.</p>
                <Button onClick={() => router.back()}>Volver</Button>
            </div>
        );
    }

    // Determine Type
    const isCollection = ticket.subject.toLowerCase().includes('recupero') ||
        ticket.subject.toLowerCase().includes('retiro') ||
        ticket.logistics?.type === 'Recupero';

    return (
        <div style={{ animation: 'fadeIn 0.5s ease-out', maxWidth: '900px', margin: '0 auto' }}>
            {/* Header Actions */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <Button variant="ghost" icon={ArrowLeft} onClick={() => router.back()}>
                    Volver a Informes
                </Button>
                <Button variant="outline" icon={Printer} onClick={() => window.print()}>
                    Imprimir Informe
                </Button>
            </div>

            <Card style={{ padding: '2.5rem' }}>
                {/* Report Header */}
                <div style={{ textAlign: 'center', marginBottom: '3rem', borderBottom: '2px solid var(--border)', paddingBottom: '2rem' }}>
                    <div style={{
                        width: '60px',
                        height: '60px',
                        background: 'rgba(59, 130, 246, 0.1)',
                        color: '#3b82f6',
                        borderRadius: '16px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        margin: '0 auto 1rem'
                    }}>
                        <FileText size={32} />
                    </div>
                    <h1 style={{ fontSize: '1.5rem', fontWeight: 800, margin: 0, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        Informe de Servicio
                    </h1>
                    <Badge variant="outline" style={{ marginTop: '0.5rem', fontSize: '1rem', padding: '0.4rem 1rem' }}>
                        #{ticket.id}
                    </Badge>
                </div>

                {/* Main Content Grid */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '2.5rem' }}>

                    {/* Basic Info */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                        <div>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '0.5rem' }}>
                                <FileText size={14} /> Descripción del Servicio
                            </label>
                            <p style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--text-main)', margin: 0 }}>
                                {ticket.subject}
                            </p>
                        </div>

                        <div>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '0.5rem' }}>
                                <User size={14} /> Nombre del Empleado
                            </label>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'var(--primary-color)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '0.9rem' }}>
                                    {ticket.requester.charAt(0)}
                                </div>
                                <p style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--text-main)', margin: 0 }}>
                                    {ticket.requester}
                                </p>
                            </div>
                        </div>

                        <div>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '0.5rem' }}>
                                <Package size={14} /> Tipo de Operación
                            </label>
                            <Badge variant={isCollection ? 'warning' : 'success'} style={{ fontSize: '0.9rem', padding: '0.5rem 1.25rem' }}>
                                {isCollection ? 'RECOLECCIÓN / RECUPERO' : 'ENTREGA DE EQUIPAMIENTO'}
                            </Badge>
                        </div>
                    </div>

                    {/* Secondary Info */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                        <div>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '0.5rem' }}>
                                <Hash size={14} /> Número de Caso Sycomp
                            </label>
                            <p style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--primary-color)', margin: 0, fontFamily: 'monospace' }}>
                                {ticket.logistics?.additionalCase || ticket.id_sf || 'NO ASIGNADO'}
                            </p>
                        </div>

                        <div>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '0.5rem' }}>
                                <Calendar size={14} /> Día Realizado
                            </label>
                            <p style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--text-main)', margin: 0 }}>
                                {ticket.closedDate || ticket.deliveryCompletedDate || ticket.date}
                            </p>
                        </div>
                    </div>

                    {/* Full Width: Equipment Detail */}
                    <div style={{ gridColumn: 'span 2', marginTop: '1rem', paddingTop: '2rem', borderTop: '1px solid var(--border)' }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem', fontWeight: 800, color: 'var(--text-main)', textTransform: 'uppercase', marginBottom: '1.5rem', letterSpacing: '0.05em' }}>
                            <Package size={16} /> Detalles del Equipamiento {isCollection ? 'Recuperado' : 'Entregado'}
                        </label>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                            {/* Hardware List */}
                            <div style={{ background: 'var(--background-secondary)', padding: '1.5rem', borderRadius: '16px' }}>
                                <h4 style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '1rem' }}>Hardware con Serial</h4>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                    {(ticket.associatedAssets || []).length === 0 ? (
                                        <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontStyle: 'italic' }}>Ningún activo serializado registrado.</p>
                                    ) : (
                                        ticket.associatedAssets.map((assetItem, i) => {
                                            const serial = typeof assetItem === 'string' ? assetItem : assetItem.serial;
                                            const assetData = assets.find(a => a.serial === serial);
                                            return (
                                                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem', background: 'white', borderRadius: '12px', border: '1px solid var(--border)' }}>
                                                    <div style={{ padding: '0.5rem', background: 'var(--primary-color)', color: 'white', borderRadius: '8px' }}>
                                                        <Laptop size={14} />
                                                    </div>
                                                    <div>
                                                        <p style={{ fontSize: '0.85rem', fontWeight: 600, margin: 0 }}>{assetData?.name || 'Hardware'}</p>
                                                        <p style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', margin: 0 }}>S/N: {serial}</p>
                                                    </div>
                                                </div>
                                            );
                                        })
                                    )}
                                </div>
                            </div>

                            {/* Accessories List */}
                            <div style={{ background: 'var(--background-secondary)', padding: '1.5rem', borderRadius: '16px' }}>
                                <h4 style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '1rem' }}>Accesorios</h4>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                                    {[
                                        { key: 'backpack', label: 'Mochila', icon: Package },
                                        { key: 'screenFilter', label: 'Filtro Privacidad', icon: Monitor },
                                        { key: 'mouse', label: 'Mouse USB', icon: MousePointer2 },
                                        { key: 'padlock', label: 'Candado Seguridad', icon: Hash }
                                    ].map(acc => {
                                        const isPresent = ticket.accessories?.[acc.key];
                                        return (
                                            <div key={acc.key} style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '0.5rem',
                                                padding: '0.6rem',
                                                background: isPresent ? 'white' : 'transparent',
                                                border: isPresent ? '1px solid var(--primary-color)' : '1px solid var(--border)',
                                                borderRadius: '10px',
                                                opacity: isPresent ? 1 : 0.4
                                            }}>
                                                <acc.icon size={12} color={isPresent ? 'var(--primary-color)' : 'var(--text-secondary)'} />
                                                <span style={{ fontSize: '0.75rem', fontWeight: isPresent ? 600 : 400 }}>{acc.label}</span>
                                                {isPresent && <CheckCircle2 size={12} color="var(--success-color)" style={{ marginLeft: 'auto' }} />}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Footer Signature Area (for printing) */}
                <div className="show-on-print" style={{ display: 'none', marginTop: '5rem', gridTemplateColumns: '1fr 1fr', gap: '4rem' }}>
                    <div style={{ borderTop: '1px solid black', textAlign: 'center', paddingTop: '1rem' }}>
                        <p style={{ fontSize: '0.9rem', fontWeight: 600 }}>Firma del Empleado</p>
                        <p style={{ fontSize: '0.75rem' }}>{ticket.requester}</p>
                    </div>
                    <div style={{ borderTop: '1px solid black', textAlign: 'center', paddingTop: '1rem' }}>
                        <p style={{ fontSize: '0.9rem', fontWeight: 600 }}>Firma Responsable TI</p>
                        <p style={{ fontSize: '0.75rem' }}>AssetFlow Support</p>
                    </div>
                </div>
            </Card>

            <style jsx>{`
                @media print {
                    .show-on-print {
                        display: grid !important;
                    }
                    button, .no-print {
                        display: none !important;
                    }
                    body {
                        background: white !important;
                    }
                }
            `}</style>
        </div>
    );
}
