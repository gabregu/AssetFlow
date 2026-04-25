"use client";
import React from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useStore } from '../../../../lib/store';
import { Card } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';
import { Badge } from '../../../components/ui/Badge';
import {
    ArrowLeft, Laptop, Smartphone, Monitor, HardDrive,
    Calendar, User, History, Tag, ExternalLink,
    AlertCircle, CheckCircle, Clock, Trash2, Edit3,
    ShoppingCart, Info, FileText, Smartphone as ImeiIcon,
    ArrowRight, Key, Box
} from 'lucide-react';
import Link from 'next/link';

export default function AssetDetailPage() {
    const params = useParams();
    const router = useRouter();
    const { assets, tickets, deleteAsset, currentUser } = useStore();

    const asset = assets.find(a => a.id === params.id || a.serial === params.id);

    if (!asset) {
        return (
            <div style={{ padding: '4rem', textAlign: 'center' }}>
                <AlertCircle size={48} style={{ color: '#ef4444', marginBottom: '1rem' }} />
                <h2>Activo no encontrado</h2>
                <p>El ID o número de serie especificado no existe en el inventario.</p>
                <Button onClick={() => router.push('/dashboard/inventory')} style={{ marginTop: '1rem' }}>
                    Volver al Inventario
                </Button>
            </div>
        );
    }

    // Related tickets
    const relatedTickets = tickets.filter(t =>
        t.associatedAssets?.includes(asset.serial) ||
        t.associatedAssetSerial === asset.serial
    );

    const getTypeIcon = (type) => {
        switch (type) {
            case 'Laptop': return Laptop;
            case 'Smartphone': return Smartphone;
            case 'Tablet': return Smartphone;
            case 'Security keys': return Key;
            default: return Laptop;
        }
    };

    const getStatusVariant = (status) => {
        switch (status) {
            case 'Nuevo': return 'success';
            case 'Asignado': return 'info';
            case 'Recuperado': return 'info';
            case 'En Reparación': return 'warning';
            case 'Dañado':
            case 'EOL': return 'danger';
            default: return 'default';
        }
    };

    const handleDelete = () => {
        if (window.confirm('¿Estás seguro de que deseas eliminar este activo permanentemente?')) {
            deleteAsset(asset.id);
            router.push('/dashboard/inventory');
        }
    };

    const Icon = getTypeIcon(asset.type);

    return (
        <div style={{ paddingBottom: '4rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '2rem' }}>
                <Button variant="ghost" onClick={() => router.back()} icon={ArrowLeft}>Atrás</Button>
                <div>
                    <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-main)', margin: 0 }}>
                        {asset.name}
                    </h1>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                        <Tag size={14} /> {asset.serial} • {asset.id}
                    </div>
                </div>
                <div style={{ marginLeft: 'auto', display: 'flex', gap: '0.5rem' }}>
                    <Button variant="outline" icon={Edit3}>Editar Datos</Button>
                    {currentUser?.role === 'admin' && (
                        <Button variant="danger" icon={Trash2} onClick={handleDelete}>Dar de Baja</Button>
                    )}
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 2fr) minmax(0, 1fr)', gap: '1.5rem' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                    {/* Main Info */}
                    <Card>
                        <div style={{ display: 'flex', gap: '2rem', padding: '1rem' }}>
                            <div style={{
                                width: '120px',
                                height: '120px',
                                backgroundColor: 'var(--background)',
                                borderRadius: '16px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: 'var(--primary-color)',
                                border: '1px solid var(--border)'
                            }}>
                                <Icon size={64} />
                            </div>
                            <div style={{ flex: 1 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                    <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.5rem' }}>Especificaciones Generales</h2>
                                    <Badge variant={getStatusVariant(asset.status)}>{asset.status}</Badge>
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1.5rem', marginTop: '1rem' }}>
                                    <div>
                                        <p style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 700, margin: 0 }}>Tipo</p>
                                        <p style={{ fontSize: '0.95rem', fontWeight: 500, margin: '0.2rem 0' }}>{asset.type}</p>
                                    </div>
                                    <div>
                                        <p style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 700, margin: 0 }}>Modelo Técnico</p>
                                        <p style={{ fontSize: '0.95rem', fontWeight: 500, margin: '0.2rem 0' }}>{asset.modelNumber || '-'}</p>
                                    </div>
                                    <div>
                                        <p style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 700, margin: 0 }}>Número de Serie</p>
                                        <p style={{ fontSize: '0.95rem', fontWeight: 500, fontFamily: 'monospace', margin: '0.2rem 0' }}>{asset.serial}</p>
                                    </div>
                                    <div>
                                        <p style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 700, margin: 0 }}>Proveedor</p>
                                        <p style={{ fontSize: '0.95rem', fontWeight: 500, margin: '0.2rem 0' }}>{asset.vendor || '-'}</p>
                                    </div>
                                    <div>
                                        <p style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 700, margin: 0 }}>Fecha Ingreso</p>
                                        <p style={{ fontSize: '0.95rem', fontWeight: 500, margin: '0.2rem 0' }}>{asset.date || '-'}</p>
                                    </div>
                                    <div>
                                        <p style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 700, margin: 0 }}>Fabricante (OEM)</p>
                                        <p style={{ fontSize: '0.95rem', fontWeight: 500, margin: '0.2rem 0' }}>{asset.oem || '-'}</p>
                                    </div>
                                    <div>
                                        <p style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 700, margin: 0 }}>Orden de Compra</p>
                                        <p style={{ fontSize: '0.95rem', fontWeight: 500, margin: '0.2rem 0' }}>{asset.purchaseOrder || '-'}</p>
                                    </div>
                                    <div>
                                        <p style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 700, margin: 0 }}>SFDC Case</p>
                                        <p style={{ fontSize: '0.95rem', fontWeight: 500, margin: '0.2rem 0' }}>
                                            {asset.sfdcCase ? (
                                                <Link href={`/dashboard/tickets/${asset.sfdcCase}`} style={{ color: 'var(--primary-color)', fontWeight: 600 }}>
                                                    {asset.sfdcCase}
                                                </Link>
                                            ) : '-'}
                                        </p>
                                    </div>
                                    <div>
                                        <p style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 700, margin: 0 }}>Caja / Box</p>
                                        <p style={{ fontSize: '0.95rem', fontWeight: 500, margin: '0.2rem 0', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                            {asset.boxNumber ? <><Box size={14} /> {asset.boxNumber}</> : '-'}
                                        </p>
                                    </div>
                                    <div>
                                        <p style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 700, margin: 0 }}>Certificado (COD)</p>
                                        <p style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--danger-color)', margin: '0.2rem 0' }}>{asset.cod || '-'}</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </Card>

                    {/* Technical and Identifiers */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                        <Card title="Hardware & Specs" icon={Info}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                <div>
                                    <p style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 700, margin: 0 }}>Configuración</p>
                                    <p style={{ fontSize: '0.9rem', fontWeight: 500, margin: '0.25rem 0' }}>{asset.hardwareSpec || 'Sin especificar'}</p>
                                </div>
                                <div>
                                    <p style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 700, margin: 0 }}>Part Number</p>
                                    <p style={{ fontSize: '0.9rem', fontWeight: 500, margin: '0.25rem 0' }}>{asset.partNumber || '-'}</p>
                                </div>
                                <div>
                                    <p style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 700, margin: 0 }}>IMEI (Smartphones)</p>
                                    <p style={{ fontSize: '0.9rem', fontWeight: 500, margin: '0.25rem 0' }}>{asset.imei || '-'}</p>
                                </div>
                            </div>
                        </Card>
                        <Card title="Auditoría" icon={History}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                <div>
                                    <p style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 700, margin: 0 }}>Última Actualización</p>
                                    <p style={{ fontSize: '0.9rem', fontWeight: 500, margin: '0.25rem 0' }}>
                                        {asset.dateLastUpdate ? new Date(asset.dateLastUpdate).toLocaleString() : 'No registrada'}
                                    </p>
                                </div>
                                <div>
                                    <p style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 700, margin: 0 }}>Modificado por</p>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.25rem' }}>
                                        <div style={{ width: '20px', height: '20px', borderRadius: '50%', background: 'var(--primary-color)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.65rem', fontWeight: 700 }}>
                                            {asset.updatedBy ? asset.updatedBy.charAt(0) : '?'}
                                        </div>
                                        <span style={{ fontSize: '0.9rem', fontWeight: 500 }}>{asset.updatedBy || 'Sistema'}</span>
                                    </div>
                                </div>
                            </div>
                        </Card>
                    </div>
                    <Card title="Notas del Activo" icon={FileText}>
                        <p style={{ fontSize: '0.9rem', color: 'var(--text-main)', margin: 0, whiteSpace: 'pre-wrap' }}>
                            {asset.notes || 'No hay notas adicionales para este activo.'}
                        </p>
                    </Card>

                    {/* Assignment History */}
                    <Card title="Historial de Asignaciones" icon={History}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                            {/* Current Status */}
                            <div style={{ display: 'flex', gap: '1rem', padding: '1rem', backgroundColor: 'var(--background)', borderRadius: '12px', border: '1px solid var(--border)', position: 'relative' }}>
                                <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'var(--primary-color)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '1.1rem' }}>
                                    {asset.assignee.charAt(0)}
                                </div>
                                <div style={{ flex: 1 }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <span style={{ fontWeight: 700, fontSize: '1rem' }}>Asignación Actual: {asset.assignee}</span>
                                        <Badge variant="success">ACTIVO</Badge>
                                    </div>
                                    <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: '0.25rem 0' }}>
                                        Estado: <strong>{asset.status}</strong> 
                                        {asset.sfdcCase && <span> • Ticket: <strong>{asset.sfdcCase}</strong></span>}
                                    </p>
                                </div>
                            </div>

                            {/* Timeline of past events parsed from notes */}
                            <div style={{ marginLeft: '1.25rem', paddingLeft: '1.5rem', borderLeft: '2px dashed var(--border)', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                                {(() => {
                                    if (!asset.notes) return null;
                                    const lines = asset.notes.split('\n');
                                    const historyItems = lines
                                        .filter(line => line.trim().startsWith('[') && line.includes(']'))
                                        .map((line, idx) => {
                                            const bracketEnd = line.indexOf(']');
                                            const dateStr = line.substring(1, bracketEnd);
                                            const content = line.substring(bracketEnd + 1).trim();
                                            return (
                                                <div key={idx} style={{ position: 'relative' }}>
                                                    <div style={{ 
                                                        position: 'absolute', 
                                                        left: '-1.95rem', 
                                                        top: '0.25rem', 
                                                        width: '10px', 
                                                        height: '10px', 
                                                        borderRadius: '50%', 
                                                        background: 'var(--border)',
                                                        border: '2px solid white'
                                                    }}></div>
                                                    <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '0.25rem' }}>
                                                        {dateStr}
                                                    </div>
                                                    <div style={{ fontSize: '0.875rem', color: 'var(--text-main)', lineHeight: '1.4' }}>
                                                        {content}
                                                    </div>
                                                </div>
                                            );
                                        })
                                        .reverse(); // Newest first
                                    
                                    return historyItems.length > 0 ? historyItems : null;
                                })()}

                                {/* Original Entry */}
                                <div style={{ position: 'relative' }}>
                                    <div style={{ 
                                        position: 'absolute', 
                                        left: '-1.95rem', 
                                        top: '0.25rem', 
                                        width: '10px', 
                                        height: '10px', 
                                        borderRadius: '50%', 
                                        background: 'var(--border)',
                                        border: '2px solid white'
                                    }}></div>
                                    <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '0.25rem' }}>
                                        {asset.date || 'Desconocida'}
                                    </div>
                                    <div style={{ fontSize: '0.875rem', color: 'var(--text-main)' }}>
                                        Ingreso inicial al inventario.
                                    </div>
                                </div>
                            </div>
                        </div>
                    </Card>

                    {/* Related Tickets */}
                    <Card title="Tickets Relacionados" icon={ExternalLink}>
                        {relatedTickets.length > 0 ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                {relatedTickets.map(ticket => (
                                    <Link key={ticket.id} href={`/dashboard/tickets/${ticket.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                                        <div style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'space-between',
                                            padding: '0.75rem 1rem',
                                            borderRadius: 'var(--radius-md)',
                                            border: '1px solid var(--border)',
                                            transition: 'all 0.2s ease'
                                        }} className="table-row">
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                                <Badge variant={ticket.status === 'Resuelto' ? 'success' : 'warning'}>{ticket.id}</Badge>
                                                <div>
                                                    <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{ticket.subject}</div>
                                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{ticket.date} • {ticket.requester}</div>
                                                </div>
                                            </div>
                                            <ArrowRight size={16} style={{ color: 'var(--text-secondary)' }} />
                                        </div>
                                    </Link>
                                ))}
                            </div>
                        ) : (
                            <p style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: '2rem' }}>
                                No hay tickets asociados a este activo.
                            </p>
                        )}
                    </Card>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                    {/* Lifecycle Card */}
                    <Card title="Ciclo de Vida">
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                            <div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
                                    <Calendar size={18} style={{ color: 'var(--primary-color)' }} />
                                    <p style={{ margin: 0, fontWeight: 700, fontSize: '0.85rem', textTransform: 'uppercase' }}>Fin de Vida Útil (EOL)</p>
                                </div>
                                <div style={{ padding: '0.75rem', background: 'var(--background)', borderRadius: '8px', border: '1px solid var(--border)', textAlign: 'center' }}>
                                    <span style={{ fontSize: '1.1rem', fontWeight: 700, color: asset.status === 'EOL' ? '#ef4444' : 'inherit' }}>
                                        {asset.eolDate || 'No definida'}
                                    </span>
                                </div>
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                <CheckCircle size={20} style={{ color: asset.status === 'Rota' || asset.status === 'De Baja' ? '#ef4444' : '#16a34a' }} />
                                <div>
                                    <p style={{ margin: 0, fontWeight: 600, fontSize: '0.9rem' }}>Estado Operativo</p>
                                    <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                                        {asset.status === 'Rota' ? 'Equipo dañado.' : asset.status === 'En Reparación' ? 'En servicio técnico.' : 'Funcional.'}
                                    </p>
                                </div>
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                <ShoppingCart size={20} style={{ color: 'var(--text-secondary)' }} />
                                <div>
                                    <p style={{ margin: 0, fontWeight: 600, fontSize: '0.9rem' }}>Adquisición</p>
                                    <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Comprado en {asset.vendor || 'N/A'}</p>
                                </div>
                            </div>
                        </div>
                    </Card>

                    {/* QR Code Placeholder */}
                    <Card>
                        <div style={{ textAlign: 'center', padding: '1rem' }}>
                            <div style={{ background: 'white', padding: '1rem', display: 'inline-block', borderRadius: '8px', border: '1px solid #ddd' }}>
                                <div style={{ width: '100px', height: '100px', backgroundColor: '#000', display: 'grid', gridTemplateColumns: 'repeat(10, 1fr)', gap: '1px' }}>
                                    {Array.from({ length: 100 }).map((_, i) => (
                                        <div key={i} style={{ backgroundColor: Math.random() > 0.5 ? '#fff' : '#000' }} />
                                    ))}
                                </div>
                            </div>
                            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.8rem', fontWeight: 600 }}>CÓDIGO DE ACTIVO</p>
                            <p style={{ fontSize: '0.9rem', fontWeight: 700, margin: 0 }}>{asset.id}</p>
                        </div>
                    </Card>
                </div>
            </div>
        </div>
    );
}
