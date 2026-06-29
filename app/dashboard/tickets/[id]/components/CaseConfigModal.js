'use client';

import React, { useRef, useState, useEffect } from 'react';
import { Modal } from '@/app/components/ui/Modal';
import AssetListSection from './AssetListSection';
import AccessoriesSection from './AccessoriesSection';
import YubiKeySection from './YubiKeySection';
import CaseLogisticsSection from './CaseLogisticsSection';
import ManualAssetModal from './ManualAssetModal';
import DeliveryVerificationModal from './DeliveryVerificationModal';
import { isDeliveryCase, isCollectionCase } from './AssociatedCasesCard';
import { FileText, Package, RotateCcw, Boxes } from 'lucide-react';
import { generateTicketPDF } from '@/lib/pdf-generator';
import { Button } from '@/app/components/ui/Button';
import { useSafeSubmit } from '@/lib/useSafeSubmit';

export default function CaseConfigModal({
    ticket,
    editedData,
    setEditedData,
    handleUpdate,
    selectedCaseIndex,
    setSelectedCaseIndex,
    handleAssetSearch,
    assetSearchResult,
    isSmartSearchOpen,
    setIsSmartSearchOpen,
    serialQuery,
    setSerialQuery,
    setAssetSearchResult,
    assets,
    yubikeys,
    consumables,
    users,
    setIsInventorySelectorOpen,
    isAssetModalOpen,
    setIsAssetModalOpen,
    handleCreateAsset,
    newAsset,
    setNewAsset,
    verifyDeliveryModal,
    setVerifyDeliveryModal,
    unifiedTasks,
    updateLogisticsTask,
    addLogisticsTask,
    deleteLogisticsTask,
    handleUpdateTask, // <--- Use from props now
    updateAsset,
    updateConsumableStock,
    currentUser
}) {
    const currentTasks = unifiedTasks || [];
    const currentTask = (selectedCaseIndex !== null && currentTasks) ? currentTasks[selectedCaseIndex] : null;

    // Ref para poder llamar saveAll() desde CaseLogisticsSection antes de cerrar
    const logisticsSaveRef = useRef(null);
    const { isSubmitting: isSavingModal, safeSubmit: safeSaveModal } = useSafeSubmit();

    const [subjectInput, setSubjectInput] = useState('');
    const [caseTypeInput, setCaseTypeInput] = useState('independiente');
    const [pendingTaskUpdates, setPendingTaskUpdates] = useState({});
    const [localTask, setLocalTask] = useState(null);

    const pendingUpdatesRef = useRef({});
    useEffect(() => {
        pendingUpdatesRef.current = pendingTaskUpdates;
    }, [pendingTaskUpdates]);

    // Init localTask when switching to a different task
    useEffect(() => {
        setPendingTaskUpdates({});
        if (currentTask) {
            setLocalTask({ ...currentTask });
        } else {
            setLocalTask(null);
        }
    }, [currentTask?.id]);

    // Smart merge: when currentTask changes (Supabase realtime), merge DB fields
    // that we DON'T buffer locally (assets written via InventorySelectorModal or
    // handleUpdateTask directly) back into localTask so they appear in the UI.
    useEffect(() => {
        if (!currentTask) return;

        setLocalTask(prev => {
            if (!prev) return prev;
            // Only merge if it's the same task (same ID)
            if (currentTask.id !== prev.id) return prev;
            
            const merged = { ...prev };

            // Always merge assets from DB unless the user has a local pending override
            if (!pendingUpdatesRef.current.hasOwnProperty('assets')) {
                merged.assets = currentTask.assets || prev.assets || [];
            }
            // Merge status changes (e.g. auto-unlock from store triggers)
            if (!pendingUpdatesRef.current.hasOwnProperty('status')) {
                merged.status = currentTask.status || prev.status;
            }

            return merged;
        });
    }, [currentTask]);

    // Use localTask as the source of truth for the UI
    const activeTask = localTask || currentTask;

    const handleBufferedUpdate = (updates) => {
        setLocalTask(prev => prev ? { ...prev, ...updates } : null);
        setPendingTaskUpdates(prev => ({ ...prev, ...updates }));
    };

    // Auto-detect case type from subject when task changes
    useEffect(() => {
        if (activeTask) {
            setSubjectInput(activeTask.subject || '');
            // Use stored case_type first, then auto-detect from subject
            const stored = activeTask.case_type || activeTask.caseType || 'independiente';
            if (stored !== 'independiente') {
                setCaseTypeInput(stored);
            } else if (isDeliveryCase(activeTask.subject || '')) {
                setCaseTypeInput('entrega');
            } else if (isCollectionCase(activeTask.subject || '')) {
                setCaseTypeInput('recoleccion');
            } else {
                setCaseTypeInput('independiente');
            }
        }
    }, [activeTask?.id, activeTask?.subject, activeTask?.case_type]);
    // handleUpdateTask was moved to hook for centralization
    const handleGenerateRemito = (action = 'download') => {
        if (!currentTask) return;
        
        let allAssets = currentTask.assets || [];
        let allYubikeys = currentTask.yubikeys || [];
        let allAccessories = { ...currentTask.accessories };

        // Deduplicate
        const uniqueAssets = Array.from(new Map(allAssets.map(item => [item.serial || item, item])).values());
        const uniqueYubikeys = Array.from(new Map(allYubikeys.map(item => [item.serial || item, item])).values());

        // Crear un objeto de ticket "virtual" que sea compatible con generateTicketPDF
        const virtualTicket = {
            ...ticket,
            subject: `${currentTask.subject || ticket.subject}`,
            associatedAssets: uniqueAssets,
            accessories: allAccessories,
            yubikeys: uniqueYubikeys,
            logistics: {
                ...(ticket.logistics || {}),
                method: currentTask.method,
                date: currentTask.date,
                timeSlot: currentTask.timeSlot,
                status: currentTask.status,
                phone: ticket.logistics?.phone || '',
                email: ticket.logistics?.email || '',
                address: currentTask.address || ticket.logistics?.address || '',
                deliveryPerson: currentTask.deliveryPerson || currentTask.delivery_person || '',
                type: currentTask.method === 'Recupero' ? 'Recupero' : 'Entrega',
                deliveryInfo: currentTask.deliveryInfo || currentTask.delivery_info || null
            },
            caseNumber: currentTask.caseNumber
        };

        // setTimeout(0) evita que jsPDF bloquee el hilo principal de React,
        // lo que causaba que el botón LISTO/GUARDAR CAMBIOS quedara sin respuesta
        // después de hacer click en "Descargar" en dispositivos móviles.
        setTimeout(() => {
            generateTicketPDF(virtualTicket, assets, null, action);
        }, 0);
    };

    return (
        <>
            {/* Case Config Modal */}
            <Modal
                isOpen={selectedCaseIndex !== null}
                onClose={() => {
                    setSelectedCaseIndex(null);
                }}
                title={currentTask ? `Configuración: ${currentTask.subject}` : 'Configurar Caso'}
                disableOutsideClick={true}
            >
                {selectedCaseIndex !== null && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                        {currentTask && (
                            <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', borderBottom: '1px solid var(--border)', paddingBottom: '1.5rem' }}>
                                <label className="form-label" style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
                                    Título / Asunto del Caso Asociado
                                </label>
                                <input
                                    type="text"
                                    className="form-input"
                                    value={subjectInput}
                                    onChange={(e) => setSubjectInput(e.target.value)}
                                    onBlur={() => {
                                        if (subjectInput.trim() !== '' && subjectInput !== activeTask?.subject) {
                                            handleBufferedUpdate({ subject: subjectInput.trim() });
                                        }
                                    }}
                                    placeholder="Ej: Entrega de Laptop, Recupero de Monitor..."
                                    style={{
                                        padding: '0.6rem 0.8rem',
                                        borderRadius: 'var(--radius-md)',
                                        border: '1px solid var(--border)',
                                        width: '100%',
                                        background: 'var(--surface)',
                                        color: 'var(--text-main)',
                                        fontSize: '0.9rem'
                                    }}
                                />


                                {/* Case Type Selector for Staged Workflow */}
                                <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid var(--border)' }}>
                                    <label className="form-label" style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.025em', display: 'block', marginBottom: '0.5rem' }}>
                                        Tipo de caso
                                    </label>
                                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                                        {[
                                            { value: 'entrega', label: 'Entrega', Icon: Package, color: '#0369a1', bg: '#e0f2fe' },
                                            { value: 'recoleccion', label: 'Recolección', Icon: RotateCcw, color: '#7c3aed', bg: 'rgba(124,58,237,0.08)' },
                                            { value: 'independiente', label: 'Independiente', Icon: Boxes, color: 'var(--text-secondary)', bg: 'transparent' }
                                        ].map(({ value, label, Icon, color, bg }) => {
                                            const isActive = caseTypeInput === value;
                                            return (
                                                <button
                                                    key={value}
                                                    type="button"
                                                    onClick={() => {
                                                        setCaseTypeInput(value);
                                                        let dependsOn = [];
                                                        if (value === 'recoleccion' && currentTasks.length > 0) {
                                                            // Auto-link to all delivery sibling tasks
                                                            dependsOn = currentTasks
                                                                .filter(t => t.id !== activeTask?.id && (
                                                                    (t.case_type || t.caseType) === 'entrega' ||
                                                                    isDeliveryCase(t.subject || '')
                                                                ))
                                                                .map(t => t.id)
                                                                .filter(Boolean);
                                                        }
                                                        handleBufferedUpdate({ case_type: value, depends_on: dependsOn });
                                                    }}
                                                    style={{
                                                        display: 'inline-flex',
                                                        alignItems: 'center',
                                                        gap: '4px',
                                                        fontSize: '0.72rem',
                                                        padding: '5px 10px',
                                                        borderRadius: '6px',
                                                        border: `1px solid ${isActive ? color : 'var(--border)'}`,
                                                        background: isActive ? bg : 'transparent',
                                                        color: isActive ? color : 'var(--text-secondary)',
                                                        cursor: 'pointer',
                                                        fontWeight: isActive ? 700 : 500,
                                                        transition: 'all 0.15s'
                                                    }}
                                                >
                                                    <Icon size={11} />
                                                    {label}
                                                </button>
                                            );
                                        })}
                                    </div>
                                    {caseTypeInput === 'recoleccion' && (
                                        <p style={{ margin: '0.4rem 0 0', fontSize: '0.7rem', color: '#7c3aed', fontStyle: 'italic' }}>
                                            🔒 Este caso quedará Bloqueado hasta que el caso de Entrega sea marcado como Entregado.
                                        </p>
                                    )}
                                </div>
                            </div>
                        )}
                        <AssetListSection
                            task={activeTask}
                            onUpdateTask={handleBufferedUpdate}
                            assets={assets}
                            serialQuery={serialQuery}
                            setSerialQuery={setSerialQuery}
                            handleAssetSearch={handleAssetSearch}
                            setIsInventorySelectorOpen={setIsInventorySelectorOpen}
                            assetSearchResult={assetSearchResult}
                            setAssetSearchResult={setAssetSearchResult}
                            setIsAssetModalOpen={setIsAssetModalOpen}
                            updateAsset={updateAsset}
                            currentUser={currentUser}
                            allTasks={currentTasks}
                            associatedCases={editedData?.associatedCases || ticket?.associatedCases || []}
                        />

                        <AccessoriesSection
                            task={activeTask}
                            onUpdateTask={handleBufferedUpdate}
                            consumables={consumables}
                            ticketCountry={activeTask?.country || ticket?.logistics?.country || 'Argentina'}
                            updateConsumableStock={updateConsumableStock}
                        />

                        <YubiKeySection
                            task={activeTask}
                            onUpdateTask={handleBufferedUpdate}
                            yubikeys={yubikeys}
                        />

                        <CaseLogisticsSection
                            task={activeTask}
                            onUpdateTask={handleUpdateTask}
                            users={users}
                            currentUser={currentUser}
                            saveRef={logisticsSaveRef}
                        />

                        <div style={{ 
                            marginTop: '0.5rem',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '1rem'
                        }}>

                            <div style={{ 
                                display: 'flex',
                                justifyContent: 'center',
                                gap: '1rem',
                                alignItems: 'center',
                                paddingTop: '1rem',
                                borderTop: '1px solid var(--border)'
                            }}>
                                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Remito:</span>
                                <div style={{ display: 'flex', gap: '0.5rem' }}>
                                    <Button 
                                        variant="ghost" 
                                        size="sm"
                                        icon={FileText}
                                        onClick={() => handleGenerateRemito('view')}
                                        style={{ fontSize: '0.75rem', height: '28px', padding: '0 10px' }}
                                    >
                                        Ver
                                    </Button>
                                    <Button 
                                        variant="outline" 
                                        size="sm"
                                        onClick={() => handleGenerateRemito('download')}
                                        style={{ fontSize: '0.75rem', height: '28px', padding: '0 10px' }}
                                    >
                                        Descargar
                                    </Button>
                                </div>
                            </div>
                        </div>

                        {/* Botón de cierre más grande para móvil */}
                        <div style={{ marginTop: '1rem', paddingTop: '1.5rem', borderTop: '2px solid var(--border)' }}>
                            <Button 
                                variant="primary" 
                                style={{ width: '100%', padding: '1.2rem', fontSize: '1.1rem', fontWeight: 800, borderRadius: '12px', opacity: isSavingModal ? 0.7 : 1 }}
                                disabled={isSavingModal}
                                onClick={() => safeSaveModal(async () => {
                                    // Save pending task updates (Subject, Case Type)
                                    if (Object.keys(pendingTaskUpdates).length > 0) {
                                        await handleUpdateTask(pendingTaskUpdates);
                                        setPendingTaskUpdates({}); // clear
                                    }

                                    // Save logistics info
                                    if (logisticsSaveRef.current) {
                                        const result = await logisticsSaveRef.current();
                                        if (result?.error) return; // No cerrar si hubo error
                                    }
                                    setSelectedCaseIndex(null);
                                })}
                            >
                                {isSavingModal ? 'Guardando...' : 'LISTO / GUARDAR CAMBIOS'}
                            </Button>
                        </div>
                    </div>
                )}
            </Modal>

            {/* Modal for New Asset */}
            <ManualAssetModal
                isOpen={isAssetModalOpen}
                onClose={() => setIsAssetModalOpen(false)}
                serialQuery={serialQuery}
                newAsset={newAsset}
                setNewAsset={setNewAsset}
                handleCreateAsset={handleCreateAsset}
            />

            {/* Verification Modal for Delivery */}
            <DeliveryVerificationModal
                isOpen={verifyDeliveryModal.isOpen}
                onClose={() => setVerifyDeliveryModal({ isOpen: false, serial: null })}
                serial={verifyDeliveryModal.serial}
                onConfirm={(serial) => {
                    // Logic preserved from original CaseConfigModal
                    const currentAssets = editedData.associatedAssets || [];
                    const newAssets = currentAssets.map(a =>
                        (typeof a === 'string' ? a : a.serial) === serial
                            ? { serial, type: 'Entrega' }
                            : a
                    );
                    setEditedData({ ...editedData, associatedAssets: newAssets });
                    setVerifyDeliveryModal({ isOpen: false, serial: null });
                }}
            />
        </>
    );
}