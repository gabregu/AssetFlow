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
    resetSearchStates,
    ticketTasks
}) {
    return (
        <Card title="Casos Asociados">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {(ticketTasks || []).map((task, index) => {
                    const caseAssets = task.assets || [];
                    const hasHardware = caseAssets.length > 0;
                    
                    const status = task.status || 'Pendiente';
                    let statusVariant = 'default';
                    
                    if (status === 'Para Coordinar') statusVariant = 'warning';
                    else if (status === 'En Transito') statusVariant = 'info';
                    else if (status === 'Entregado' || status === 'Finalizado' || status === 'Recuperado') statusVariant = 'success';
                    
                    const isSelected = selectedCaseIndex === index;

                    return (
                        <div key={task.id || index} onClick={() => {
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
                                    {task.caseNumber && (
                                        <span style={{ fontSize: '0.75rem', fontWeight: 700, color: isSelected ? 'rgba(255,255,255,0.8)' : '#0369a1', background: isSelected ? 'rgba(255,255,255,0.15)' : '#e0f2fe', padding: '1px 6px', borderRadius: '4px' }}>
                                            {task.caseNumber}
                                        </span>
                                    )}
                                    <h4 style={{ margin: 0, fontSize: '0.85rem', fontWeight: 600, color: isSelected ? 'white' : 'var(--text-main)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '250px' }}>
                                        {task.subject}
                                    </h4>
                                </div>
                                <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                                    <Badge variant={hasHardware ? 'info' : 'secondary'} style={{ fontSize: '0.65rem', opacity: isSelected ? 0.85 : 1 }}>
                                        {caseAssets.length} Equipos
                                    </Badge>
                                     <Badge variant={statusVariant} style={{ fontSize: '0.65rem', opacity: isSelected ? 0.85 : 1 }}>
                                         {status}: {task.method || 'Sin método'}
                                         {task.method === 'Repartidor Propio' && task.deliveryPerson && ` - ${task.deliveryPerson}`}
                                         {(task.method === 'Andreani' || task.method === 'Correo Argentino') && task.trackingNumber && ` - ${task.trackingNumber}`}
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
                {ticketTasks.length === 0 && (
                    <div style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--text-secondary)', border: '1px dashed var(--border)', borderRadius: 'var(--radius-md)' }}>
                        <p style={{ fontSize: '0.85rem' }}>No hay otros casos asociados individualmente.</p>
                    </div>
                )}

                {/* La sección de "Otros casos" ha sido eliminada ya que ahora se vinculan automáticamente en el hook useTicketDetail */}
            </div>
        </Card>
    );
}
