import React from 'react';
import { Card } from '@/app/components/ui/Card';
import { Badge } from '@/app/components/ui/Badge';
import { Button } from '@/app/components/ui/Button';
import { ExternalLink, Check, Plus, Trash2 } from 'lucide-react';

const TrackingBadge = ({ method, trackingNumber, isSelected }) => {
    const [copied, setCopied] = React.useState(false);
    if (!method || !trackingNumber) return null;
    
    const isCorreoArgentino = String(method).toLowerCase().includes('correo argentino') || String(method).toLowerCase().trim() === 'correo';
    const isAndreani = String(method).toLowerCase().includes('andreani');
    
    if (!isCorreoArgentino && !isAndreani) return null;

    const handleTrack = (e) => {
        e.stopPropagation();
        
        // Clean tracking number (remove "TN:" or "TN" prefix if any)
        const cleanTN = String(trackingNumber).trim().replace(/^(tn:?\s*)/i, '').trim();
        
        // Copy to clipboard
        navigator.clipboard.writeText(cleanTN);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
        
        // Open URL
        const url = isCorreoArgentino 
            ? 'https://www.correoargentino.com.ar/formularios/e-commerce'
            : `https://seguimiento.andreani.com/envio/${cleanTN}`;
        
        window.open(url, '_blank');
    };

    const bg = isSelected
        ? (copied ? 'rgba(16, 185, 129, 0.25)' : 'rgba(255, 255, 255, 0.15)')
        : (copied ? 'rgba(16, 185, 129, 0.1)' : 'rgba(37, 99, 235, 0.08)');
    const border = isSelected
        ? (copied ? 'rgba(16, 185, 129, 0.5)' : 'rgba(255, 255, 255, 0.3)')
        : (copied ? 'rgba(16, 185, 129, 0.3)' : 'rgba(37, 99, 235, 0.2)');
    const color = isSelected
        ? 'white'
        : (copied ? '#10b981' : '#2563eb');

    return (
        <span 
            onClick={handleTrack}
            title={isCorreoArgentino ? `Copiar TN: ${trackingNumber} e ir a Correo Argentino` : `Ir a seguimiento de Andreani: ${trackingNumber}`}
            style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                padding: '2px 6px',
                background: bg,
                border: `1px solid ${border}`,
                color: color,
                borderRadius: '4px',
                fontSize: '0.7rem',
                fontWeight: 700,
                cursor: 'pointer',
                transition: 'all 0.2s',
                userSelect: 'none'
            }}
            className="tracking-badge-hover"
        >
            {copied ? (
                <>
                    <Check size={10} strokeWidth={3} />
                    <span>¡TN Copiado!</span>
                </>
            ) : (
                <>
                    <span>TN: {trackingNumber}</span>
                    <ExternalLink size={10} strokeWidth={2.5} />
                </>
            )}
        </span>
    );
};

export default function AssociatedCasesCard({
    ticket,
    editedData,
    setEditedData,
    updateTicket,
    sfdcCases,
    selectedCaseIndex,
    setSelectedCaseIndex,
    resetSearchStates,
    ticketTasks,
    unifiedTasks,
    addLogisticsTask,
    deleteLogisticsTask
}) {
    return (
        <Card title="Casos Asociados" style={{ height: 'auto' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {(unifiedTasks || ticketTasks || (editedData && editedData.associatedCases) || []).map((task, index) => {
                    const caseAssets = task.assets || [];
                    const hasHardware = caseAssets.length > 0;
                    
                    const status = task.status || 'Pendiente';
                    let statusVariant = 'default';
                    
                    if (status === 'Para Coordinar') statusVariant = 'warning';
                    else if (status === 'En Transito') statusVariant = 'info';
                    else if (status === 'Entregado' || status === 'Finalizado' || status === 'Recuperado') statusVariant = 'success';
                    else if (status === 'No requiere accion') statusVariant = 'secondary';
                    
                    const isSelected = selectedCaseIndex === index;

                    return (
                        <div key={task.id || index} onClick={() => {
                            setSelectedCaseIndex(isSelected ? null : index);
                            if (resetSearchStates) resetSearchStates();
                        }} style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between', 
                            padding: '0.875rem 1rem',
                            background: isSelected ? 'var(--primary-color)' : (status === 'No requiere accion' ? 'rgba(0,0,0,0.03)' : 'var(--background)'),
                            border: `2px solid ${isSelected ? 'var(--primary-color)' : 'var(--border)'}`,
                            borderRadius: 'var(--radius-md)',
                            cursor: 'pointer',
                            opacity: (status === 'No requiere accion' && !isSelected) ? 0.6 : 1,
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
                                <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', alignItems: 'center' }}>
                                    <Badge variant={hasHardware ? 'info' : 'secondary'} style={{ fontSize: '0.65rem', opacity: isSelected ? 0.85 : 1 }}>
                                        {caseAssets.length} Equipos
                                    </Badge>
                                     <Badge variant={statusVariant} style={{ fontSize: '0.65rem', opacity: isSelected ? 0.85 : 1 }}>
                                         {status}: {task.method || 'Sin método'}
                                         {task.method === 'Repartidor Propio' && task.delivery_person && ` - ${task.delivery_person}`}
                                         {(task.method === 'Andreani' || task.method === 'Correo Argentino') && task.tracking_number && ` - ${task.tracking_number}`}
                                     </Badge>
                                     {task.tracking_number && (task.method === 'Andreani' || task.method === 'Correo Argentino') && (
                                         <TrackingBadge method={task.method} trackingNumber={task.tracking_number} isSelected={isSelected} />
                                     )}
                                </div>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.4rem', marginLeft: '0.5rem' }} onClick={e => e.stopPropagation()}>
                                <span style={{ fontSize: '0.72rem', color: isSelected ? 'rgba(255,255,255,0.7)' : 'var(--text-secondary)', whiteSpace: 'nowrap', marginBottom: 'auto' }}>
                                    {isSelected ? '▲ Configurando' : 'Clic para configurar'}
                                </span>
                                {task.id && (
                                    <button 
                                        onClick={async (e) => {
                                            e.stopPropagation();
                                            if (window.confirm(`¿Seguro que deseas eliminar el caso ${task.caseNumber}?`)) {
                                                if (deleteLogisticsTask) await deleteLogisticsTask(task.id);
                                                if (selectedCaseIndex === index) setSelectedCaseIndex(null);
                                            }
                                        }}
                                        style={{ 
                                            background: 'transparent', border: 'none', color: isSelected ? 'rgba(255,255,255,0.8)' : 'var(--accent-red, #ef4444)', 
                                            cursor: 'pointer', padding: '4px', display: 'flex', alignItems: 'center',
                                            borderRadius: '4px'
                                        }}
                                        title="Eliminar caso"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                )}
                            </div>
                        </div>
                    );
                })}
                {(!ticketTasks || ticketTasks.length === 0) && (!editedData || !editedData.associatedCases || editedData.associatedCases.length === 0) && (
                    <div style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--text-secondary)', border: '1px dashed var(--border)', borderRadius: 'var(--radius-md)' }}>
                        <p style={{ fontSize: '0.85rem' }}>No hay otros casos asociados individualmente.</p>
                    </div>
                )}

                {/* La sección de "Otros casos" ha sido eliminada ya que ahora se vinculan automáticamente en el hook useTicketDetail */}
            </div>
            
            <div style={{ marginTop: '1rem', display: 'flex', justifyContent: 'center' }}>
                <Button 
                    variant="outline" 
                    size="sm" 
                    icon={Plus} 
                    onClick={async () => {
                        const randomId = `${ticket.id}-${Math.floor(Math.random() * 9000) + 1000}`;
                        const newTask = {
                            ticketId: ticket.id,
                            caseNumber: randomId,
                            subject: "Caso Consolidado",
                            status: "Para Coordinar",
                            method: "Pendiente",
                            assets: [],
                            accessories: { backpack: false, screenFilter: false, filterSize: '14"' }
                        };
                        
                        if (addLogisticsTask) {
                            const result = await addLogisticsTask(newTask);
                            if (result && !result.error) {
                                const newIndex = (ticketTasks?.length || 0);
                                setSelectedCaseIndex(newIndex);
                            }
                        }
                    }}
                >
                    Creación de caso asociado
                </Button>
            </div>
            
            <style jsx>{`
                .tracking-badge-hover:hover {
                    filter: brightness(0.95);
                    transform: scale(1.02);
                }
            `}</style>
        </Card>
    );
}
