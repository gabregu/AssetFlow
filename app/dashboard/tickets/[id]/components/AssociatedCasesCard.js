import React from 'react';
import { Card } from '@/app/components/ui/Card';
import { Badge } from '@/app/components/ui/Badge';
import { Button } from '@/app/components/ui/Button';
import { ExternalLink, Check, Plus, Trash2, Lock, Package, RotateCcw } from 'lucide-react';

// --- Helpers: Staged Workflow Type Detection ---
export const isDeliveryCase = (subject = '') => {
    const s = subject.toLowerCase();
    return /provisioning|breakfix|new hire|entrega|swap|deploy|nueva asignaci/.test(s);
};
export const isCollectionCase = (subject = '') => {
    const s = subject.toLowerCase();
    return /collection|recupero|recovery|recolecci|return|retiro/.test(s);
};

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
    deleteLogisticsTask,
    showAutoCases,
    setShowAutoCases,
    handleUnlinkCase
}) {
    const hasAutomaticCases = 
        (editedData?.associatedCases && editedData.associatedCases.some(c => c.caseNumber && c.caseNumber !== 'Caso Principal' && /^\d+$/.test(String(c.caseNumber).trim()))) ||
        (ticketTasks && ticketTasks.some(t => {
            const caseNum = t.caseNumber || t.case_number;
            return caseNum && /^\d+$/.test(String(caseNum).trim()) && (!t.assets || t.assets.length === 0) && (!t.method || t.method === 'Sin método' || t.method === 'Pendiente');
        }));

    const toggleButton = hasAutomaticCases ? (
        <button
            onClick={() => setShowAutoCases(!showAutoCases)}
            style={{
                fontSize: '0.72rem',
                padding: '4px 8px',
                borderRadius: '4px',
                cursor: 'pointer',
                transition: 'all 0.2s',
                fontWeight: 600,
                border: `1px solid ${showAutoCases ? 'var(--primary-color)' : 'var(--border)'}`,
                background: showAutoCases ? 'rgba(37, 99, 235, 0.05)' : 'transparent',
                color: showAutoCases ? 'var(--primary-color)' : 'var(--text-secondary)'
            }}
        >
            {showAutoCases ? 'Ocultar Automáticos' : 'Ver Automáticos'}
        </button>
    ) : null;

    return (
        <Card title="Casos Asociados" action={toggleButton} style={{ height: 'auto' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>                {(unifiedTasks || []).map((task, index) => {
                    const caseAssets = task.assets || [];
                    const hasHardware = caseAssets.length > 0;
                    
                    const status = task.status || 'Pendiente';
                    let statusVariant = 'default';
                    
                    const isBlocked = status === 'Bloqueado';
                    const isCancelled = status === 'Cancelado';
                    if (isBlocked) statusVariant = 'secondary';
                    else if (isCancelled) statusVariant = 'danger';
                    else if (status === 'Para Coordinar') statusVariant = 'warning';
                    else if (status === 'En Transito') statusVariant = 'info';
                    else if (status === 'Entregado' || status === 'Finalizado' || status === 'Recuperado') statusVariant = 'success';
                    else if (status === 'No requiere accion') statusVariant = 'secondary';

                    // Determine visual case type (from stored field or auto-detect)
                    const storedCaseType = task.case_type || task.caseType || 'independiente';
                    const detectedIsDelivery = storedCaseType === 'entrega' || (storedCaseType === 'independiente' && isDeliveryCase(task.subject || ''));
                    const detectedIsCollection = storedCaseType === 'recoleccion' || (storedCaseType === 'independiente' && isCollectionCase(task.subject || ''));
                    const CaseTypeIcon = detectedIsCollection ? RotateCcw : Package;
                    
                    const isSFDC = /SFDC/i.test(ticket?.client || '');
                    const caseNumRaw = task.caseNumber || task.case_number || '';
                    const caseIdentifier = isSFDC && caseNumRaw && !String(caseNumRaw).toUpperCase().startsWith('SFDC-') && /^\d+$/.test(caseNumRaw)
                        ? `SFDC-${caseNumRaw}`
                        : caseNumRaw;
                    const isLinkedToMain = ticket.subject && ticket.subject.includes(`[${caseIdentifier}]`);
                    const isSelected = selectedCaseIndex === index;

                    return (
                        <div key={task.id || index} onClick={() => {
                            if (isBlocked) return; // Can't select blocked cases
                            setSelectedCaseIndex(isSelected ? null : index);
                            if (resetSearchStates) resetSearchStates();
                        }} style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between', 
                            padding: '0.875rem 1rem',
                            background: isBlocked
                                ? 'rgba(0,0,0,0.04)'
                                : isCancelled
                                    ? 'rgba(239,68,68,0.04)'
                                    : isSelected ? 'var(--primary-color)' : (status === 'No requiere accion' ? 'rgba(0,0,0,0.03)' : 'var(--background)'),
                            border: `2px solid ${isBlocked ? 'rgba(0,0,0,0.1)' : isCancelled ? 'rgba(239,68,68,0.2)' : isSelected ? 'var(--primary-color)' : 'var(--border)'}`,
                            borderRadius: 'var(--radius-md)',
                            cursor: isBlocked ? 'not-allowed' : 'pointer',
                            opacity: (isBlocked || (status === 'No requiere accion' && !isSelected)) ? 0.65 : 1,
                            transition: 'all 0.2s'
                        }}>
                            <div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                                    {isBlocked && (
                                        <span title="Esperando que el caso de Entrega esté Entregado" style={{ display: 'inline-flex', alignItems: 'center', gap: '2px', fontSize: '0.7rem', fontWeight: 700, color: '#64748b', background: 'rgba(100,116,139,0.1)', padding: '1px 5px', borderRadius: '4px', border: '1px solid rgba(100,116,139,0.2)' }}>
                                            <Lock size={9} strokeWidth={2.5} /> Bloqueado
                                        </span>
                                    )}
                                    {(detectedIsDelivery || detectedIsCollection) && (
                                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '2px', fontSize: '0.65rem', fontWeight: 600, color: isSelected ? 'rgba(255,255,255,0.7)' : detectedIsCollection ? '#7c3aed' : '#0369a1', background: isSelected ? 'rgba(255,255,255,0.1)' : detectedIsCollection ? 'rgba(124,58,237,0.08)' : '#e0f2fe', padding: '1px 5px', borderRadius: '4px' }}>
                                            <CaseTypeIcon size={9} />
                                            {detectedIsCollection ? 'Recolección' : 'Entrega'}
                                        </span>
                                    )}
                                    {task.caseNumber && (
                                        <span style={{ fontSize: '0.75rem', fontWeight: 700, color: isSelected ? 'rgba(255,255,255,0.8)' : '#0369a1', background: isSelected ? 'rgba(255,255,255,0.15)' : '#e0f2fe', padding: '1px 6px', borderRadius: '4px' }}>
                                            {task.caseNumber}
                                        </span>
                                    )}
                                    <h4 style={{ margin: 0, fontSize: '0.85rem', fontWeight: 600, color: isBlocked ? 'var(--text-secondary)' : isSelected ? 'white' : 'var(--text-main)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '220px' }}>
                                        {task.subject}
                                    </h4>
                                </div>
                                <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', alignItems: 'center' }}>
                                    <Badge variant={hasHardware ? 'info' : 'secondary'} style={{ fontSize: '0.65rem', opacity: isSelected ? 0.85 : 1 }}>
                                        {caseAssets.length} Equipos
                                    </Badge>
                                     <Badge variant={statusVariant} style={{ fontSize: '0.65rem', opacity: isSelected ? 0.85 : 1 }}>
                                         {isBlocked ? '🔒 Bloqueado' : status}{!isBlocked && `: ${task.method || 'Sin método'}`}
                                         {!isBlocked && task.method === 'Repartidor Propio' && task.delivery_person && ` - ${task.delivery_person}`}
                                         {!isBlocked && (task.method === 'Andreani' || task.method === 'Correo Argentino') && task.tracking_number && ` - ${task.tracking_number}`}
                                     </Badge>
                                     {task.tracking_number && (task.method === 'Andreani' || task.method === 'Correo Argentino') && (
                                         <TrackingBadge method={task.method} trackingNumber={task.tracking_number} isSelected={isSelected} />
                                     )}
                                </div>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.4rem', marginLeft: '0.5rem' }} onClick={e => e.stopPropagation()}>
                                <span style={{ fontSize: '0.72rem', color: isSelected ? 'rgba(255,255,255,0.7)' : isBlocked ? '#94a3b8' : 'var(--text-secondary)', whiteSpace: 'nowrap', marginBottom: 'auto' }}>
                                    {isBlocked ? '🔒 Pendiente de entrega previa' : isSelected ? '▲ Configurando' : 'Clic para configurar'}
                                </span>
                                <div style={{ display: 'flex', gap: '4px' }}>
                                    {ticket.subject && !isLinkedToMain && handleUnlinkCase && (
                                        <button 
                                            onClick={async (e) => {
                                                e.stopPropagation();
                                                await handleUnlinkCase(task);
                                            }}
                                            style={{ 
                                                background: 'transparent', border: 'none', color: isSelected ? 'rgba(255,255,255,0.8)' : '#ef4444', 
                                                cursor: 'pointer', padding: '4px', display: 'flex', alignItems: 'center',
                                                borderRadius: '4px'
                                            }}
                                            title="Desvincular y extraer a un nuevo servicio"
                                        >
                                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 14L21 3"></path><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"></path></svg>
                                        </button>
                                    )}
                                    <button 
                                         onClick={async (e) => {
                                             e.stopPropagation();
                                             if (window.confirm(`¿Seguro que deseas eliminar el caso ${task.caseNumber || 'asociado'}?`)) {
                                                 const caseNum = task.caseNumber || task.case_number;
                                                 
                                                 // 1. Si es una tarea de la base de datos, la eliminamos físicamente
                                                 if (task.id && deleteLogisticsTask) {
                                                     await deleteLogisticsTask(task.id);
                                                 }
                                                 
                                                 // 2. Siempre desasociamos del JSON del ticket y agregamos a excluidos para evitar re-vinculaciones automáticas
                                                 const updatedCases = (editedData?.associatedCases || []).filter(c => 
                                                     String(c.caseNumber).trim() !== String(caseNum).trim()
                                                 );
                                                 const currentExcluded = editedData?.excludedCases || [];
                                                 const updatedExcluded = caseNum 
                                                     ? [...new Set([...currentExcluded, caseNum])]
                                                     : currentExcluded;
                                                     
                                                 if (setEditedData) {
                                                     setEditedData(prev => ({ 
                                                         ...prev, 
                                                         associatedCases: updatedCases, 
                                                         excludedCases: updatedExcluded 
                                                     }));
                                                 }
                                                 if (updateTicket) {
                                                     await updateTicket(ticket.id, { 
                                                         associatedCases: updatedCases, 
                                                         excludedCases: updatedExcluded 
                                                     });
                                                 }
                                                 
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
                                </div>
                            </div>
                        </div>
                    );
                })}
                {(!unifiedTasks || unifiedTasks.length === 0) && (
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
                            country: ticket.client || ticket?.logistics?.country || 'Argentina',
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
