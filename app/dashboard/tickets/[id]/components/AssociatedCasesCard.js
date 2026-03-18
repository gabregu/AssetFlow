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
                {(editedData.associatedCases || []).map((caso, index) => {
                    // El caso principal suele tener 'Caso Principal' o el ID numérico del ticket (ej: '1001')
                    const ticketIdNum = ticket?.id?.split('-').pop();
                    const isOriginCase = String(caso.caseNumber) === 'Caso Principal' || String(caso.caseNumber) === String(ticketIdNum);
                    
                    if (isOriginCase) return null;

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
                                        {caso.logistics?.method === 'Repartidor Propio' && caso.logistics?.deliveryPerson && ` - ${caso.logistics.deliveryPerson}`}
                                        {(caso.logistics?.method === 'Andreani' || caso.logistics?.method === 'Correo Argentino') && caso.logistics?.trackingNumber && ` - ${caso.logistics.trackingNumber}`}
                                    </Badge>
                                </div>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.4rem', marginLeft: '0.5rem' }} onClick={e => e.stopPropagation()}>
                                <span style={{ fontSize: '0.72rem', color: isSelected ? 'rgba(255,255,255,0.7)' : 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                                    {isSelected ? '▲ Configurando' : 'Clic para configurar'}
                                </span>
                            </div>
                        </div>
                    );
                })}

                {/* La sección de "Otros casos" ha sido eliminada ya que ahora se vinculan automáticamente en el hook useTicketDetail */}
            </div>
        </Card>
    );
}
