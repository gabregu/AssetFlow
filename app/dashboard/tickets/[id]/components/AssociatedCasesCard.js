'use client';

import { Card } from '@/app/components/ui/Card';
import { Badge } from '@/app/components/ui/Badge';
import { Button } from '@/app/components/ui/Button';

export default function AssociatedCasesCard({
    ticket,
    editedData,
    setEditedData,
    updateTicket,
    sfdcCases,
    selectedCaseIndex,
    setSelectedCaseIndex,
    resetSearchStates
}) {
    return (
        <Card title="Casos Asociados">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {/* Casos del ticket (configurados) */}
                {(editedData.associatedCases || []).map((caso, index) => {
                    const caseAssets = caso.assets || [];
                    const hasHardware = caseAssets.length > 0;
                    const isReady = ['Entregado', 'Recuperado'].includes(caso.logistics?.status) || caso.logistics?.userContacted;
                    const isSelected = selectedCaseIndex === index;

                    return (
                        <div key={index} onClick={() => {
                            setSelectedCaseIndex(isSelected ? null : index);
                            if (resetSearchStates) resetSearchStates();
                        }} style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between', 
                            padding: '0.875rem 1rem',
                            background: isSelected ? 'var(--primary-color)' : 'var(--background)',
                            border: `2px solid ${isSelected ? 'var(--primary-color)' : 'var(--border)'}`,
                            borderRadius: 'var(--radius-md)',
                            cursor: 'pointer',
                            transition: 'all 0.2s'
                        }}>
                            <div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                                    {caso.caseNumber && caso.caseNumber !== 'Caso Principal' && (
                                        <span style={{ fontSize: '0.75rem', fontWeight: 700, color: isSelected ? 'rgba(255,255,255,0.8)' : '#0369a1', background: isSelected ? 'rgba(255,255,255,0.15)' : '#e0f2fe', padding: '1px 6px', borderRadius: '4px' }}>
                                            {caso.caseNumber}
                                        </span>
                                    )}
                                    <h4 style={{ margin: 0, fontSize: '0.85rem', fontWeight: 600, color: isSelected ? 'white' : 'var(--text-main)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '250px' }}>
                                        {caso.subject}
                                    </h4>
                                </div>
                                <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                                    <Badge variant={hasHardware ? 'info' : 'secondary'} style={{ fontSize: '0.65rem', opacity: isSelected ? 0.85 : 1 }}>
                                        {caseAssets.length} Equipos
                                    </Badge>
                                    <Badge variant={isReady ? 'success' : 'warning'} style={{ fontSize: '0.65rem', opacity: isSelected ? 0.85 : 1 }}>
                                        {caso.logistics?.status || 'Pendiente'}: {caso.logistics?.method || 'Sin método'}
                                    </Badge>
                                </div>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.4rem', marginLeft: '0.5rem' }} onClick={e => e.stopPropagation()}>
                                <span style={{ fontSize: '0.72rem', color: isSelected ? 'rgba(255,255,255,0.7)' : 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                                    {isSelected ? '▲ Configurando' : 'Clic para configurar'}
                                </span>
                                {caso.caseNumber && caso.caseNumber !== 'Caso Principal' && (
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            const updated = {
                                                ...editedData,
                                                associatedCases: editedData.associatedCases.filter((_, i) => i !== index)
                                            };
                                            setEditedData(updated);
                                            if (isSelected) setSelectedCaseIndex(null);
                                            updateTicket(ticket.id, updated);
                                        }}
                                        style={{
                                            padding: '2px 8px', fontSize: '0.7rem', borderRadius: '4px',
                                            border: '1px solid', cursor: 'pointer', fontWeight: 600,
                                            background: 'transparent', whiteSpace: 'nowrap',
                                            borderColor: isSelected ? 'rgba(255,255,255,0.4)' : '#ef4444',
                                            color: isSelected ? 'rgba(255,255,255,0.8)' : '#ef4444',
                                        }}
                                    >
                                        — Quitar
                                    </button>
                                )}
                            </div>
                        </div>
                    );
                })}

                {/* Otros casos SFDC del mismo solicitante (no incluidos en este ticket) */}
                {(() => {
                    const requesterName = (ticket.requester || '').toLowerCase().trim();
                    const linkedCaseNumbers = (editedData.associatedCases || []).map(c => c.caseNumber).filter(Boolean);
                    const otherCases = (sfdcCases || []).filter(sc => {
                        const rf = (sc.requestedFor || '').toLowerCase().trim();
                        return rf === requesterName && !linkedCaseNumbers.includes(sc.caseNumber);
                    });
                    if (otherCases.length === 0) return null;
                    return (
                        <>
                            <div style={{ fontSize: '0.7rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-secondary)', marginTop: '0.5rem', borderTop: '1px solid var(--border)', paddingTop: '0.75rem' }}>
                                Otros casos SFDC de {ticket.requester}
                            </div>
                            {otherCases.map((sc, i) => (
                                <div key={i} style={{
                                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                    padding: '0.75rem 1rem',
                                    background: '#f8fafc',
                                    border: '1px dashed var(--border)',
                                    borderRadius: 'var(--radius-md)'
                                }}>
                                    <div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.2rem' }}>
                                            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#0369a1', background: '#e0f2fe', padding: '1px 6px', borderRadius: '4px' }}>
                                                {sc.caseNumber}
                                            </span>
                                            <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-main)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '220px' }}>
                                                {sc.subject}
                                            </span>
                                        </div>
                                        <Badge variant="secondary" style={{ fontSize: '0.65rem' }}>{sc.status || 'Pendiente'}</Badge>
                                    </div>
                                    <Button size="sm" variant="ghost" style={{ fontSize: '0.75rem', whiteSpace: 'nowrap' }} onClick={() => {
                                        const newCase = {
                                            caseNumber: sc.caseNumber,
                                            subject: sc.subject,
                                            assets: [],
                                            accessories: { backpack: false, screenFilter: false, filterSize: '14"' },
                                            logistics: { method: '', deliveryDate: '', timeWindow: 'AM', status: 'Pendiente' }
                                        };
                                        const updated = { ...editedData, associatedCases: [...(editedData.associatedCases || []), newCase] };
                                        setEditedData(updated);
                                        updateTicket(ticket.id, updated);
                                    }}>
                                        + Agregar
                                    </Button>
                                </div>
                            ))}
                        </>
                    );
                })()}
            </div>
        </Card>
    );
}
