import React, { useMemo } from 'react';
import { Card } from '@/app/components/ui/Card';
import { TrendingUp, DollarSign, Truck, Package, Info } from 'lucide-react';
import { calculateTicketFinancials } from '@/lib/billing';
import { useStore } from '@/lib/store';

export function FinancialsSummary({ ticket }) {
    const { rates, assets, users, currentUser, logisticsTasks } = useStore();

    // Only visible for management or admin
    if (currentUser?.role !== 'admin' && currentUser?.role !== 'Gerencial') {
        return null;
    }

    const financials = useMemo(() => {
        return calculateTicketFinancials(ticket, rates, assets, users, logisticsTasks);
    }, [ticket, rates, assets, users, logisticsTasks]);

    if (!financials) return null;

    const {
        serviceRevenue,
        logisticRevenue,
        logisticCost,
        operationalCost,
        totalRevenue,
        totalCost,
        profit,
        moveType,
        assetType,
        method
    } = financials;

    const formatUSD = (val) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val);

    return (
        <Card style={{ padding: '1.25rem', overflow: 'hidden', position: 'relative' }}>
            <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                marginBottom: '1rem',
                borderBottom: '1px solid var(--border)',
                paddingBottom: '0.75rem'
            }}>
                <div style={{
                    backgroundColor: 'rgba(59, 130, 246, 0.1)',
                    color: 'var(--primary-color)',
                    padding: '8px',
                    borderRadius: '8px'
                }}>
                    <TrendingUp size={18} />
                </div>
                <div>
                    <h3 style={{ fontSize: '0.95rem', fontWeight: 600, margin: 0 }}>Proyección Financiera</h3>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', margin: 0 }}>
                        Estimación automática de costos y utilidades
                    </p>
                </div>
            </div>

            {/* Detalle del Servicio para Administración */}
            <div style={{ 
                marginBottom: '1.25rem', 
                padding: '0.75rem', 
                background: 'rgba(59, 130, 246, 0.03)', 
                borderRadius: '8px', 
                border: '1px solid rgba(59, 130, 246, 0.1)',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.5rem'
            }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Solicitante:</span>
                    <span style={{ fontWeight: 600, color: 'var(--text-main)' }}>{ticket.requester || 'N/A'}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Movimiento:</span>
                    <span style={{ fontWeight: 600, color: 'var(--primary-color)' }}>{moveType}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Dispositivo:</span>
                    <span style={{ fontWeight: 600, color: 'var(--text-main)', textAlign: 'right' }}>{assetType}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Repartidor/Responsable:</span>
                    <span style={{ fontWeight: 600, color: '#166534' }}>{financials.deliveryPerson || 'No asignado'}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Método Logístico:</span>
                    <span style={{ fontWeight: 600, color: 'var(--text-main)' }}>{method}</span>
                </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <DollarSign size={14} /> Ingreso Servicio
                    </span>
                    <span style={{ fontWeight: 600 }}>{formatUSD(serviceRevenue)}</span>
                </div>
                
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Truck size={14} /> Ingreso Logística
                    </span>
                    <span style={{ fontWeight: 600 }}>{formatUSD(logisticRevenue)}</span>
                </div>

                <div style={{ 
                    height: '1px', 
                    background: 'var(--border)', 
                    margin: '0.25rem 0',
                    borderStyle: 'dashed',
                    borderWidth: '0 0 1px 0'
                }} />

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                         Costo Logístico {method !== 'N/A' && `(${method})`}
                    </span>
                    <span style={{ fontWeight: 600, color: '#ef4444' }}>- {formatUSD(logisticCost)}</span>
                </div>

                {operationalCost > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <Package size={14} /> Accesorios / Ops
                        </span>
                        <span style={{ fontWeight: 600, color: '#ef4444' }}>- {formatUSD(operationalCost)}</span>
                    </div>
                )}

                <div style={{
                    marginTop: '0.5rem',
                    padding: '1rem',
                    borderRadius: 'var(--radius-md)',
                    background: profit >= 0 ? 'rgba(34, 197, 94, 0.05)' : 'rgba(239, 68, 68, 0.05)',
                    border: profit >= 0 ? '1px solid rgba(34, 197, 94, 0.1)' : '1px solid rgba(239, 68, 68, 0.1)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                }}>
                    <span style={{ fontWeight: 700, fontSize: '0.875rem' }}>Utilidad Estimada</span>
                    <span style={{ 
                        fontWeight: 800, 
                        fontSize: '1.1rem', 
                        color: profit >= 0 ? '#22c55e' : '#ef4444' 
                    }}>
                        {formatUSD(profit)}
                    </span>
                </div>
            </div>

            <div style={{
                marginTop: '1rem',
                padding: '0.5rem',
                borderRadius: '6px',
                backgroundColor: 'rgba(0,0,0,0.02)',
                display: 'flex',
                gap: '8px',
                alignItems: 'flex-start'
            }}>
                <Info size={14} style={{ color: 'var(--text-secondary)', marginTop: '2px', flexShrink: 0 }} />
                <p style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', margin: 0, fontStyle: 'italic' }}>
                    Valores calculados automáticamente según tarifas vigentes y detalles del ticket. Sujetos a validación final en el módulo de Facturación.
                </p>
            </div>
        </Card>
    );
}
