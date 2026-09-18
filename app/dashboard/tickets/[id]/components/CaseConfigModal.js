'use client';

import React, { useRef, useState, useEffect } from 'react';
import { Modal } from '@/app/components/ui/Modal';
import AssetListSection from './AssetListSection';
import AccessoriesSection from './AccessoriesSection';
import CaseLogisticsSection from './CaseLogisticsSection';
import ManualAssetModal from './ManualAssetModal';
import DeliveryVerificationModal from './DeliveryVerificationModal';
import { isDeliveryCase, isCollectionCase } from './AssociatedCasesCard';
import { FileText, Package, RotateCcw, Boxes, QrCode, CheckCircle2, Loader2 } from 'lucide-react';
import { generateTicketPDF } from '@/lib/pdf-generator';
import { generateDeliveryToken } from '@/lib/delivery-token';
import { Button } from '@/app/components/ui/Button';
import { useSafeSubmit } from '@/lib/useSafeSubmit';
import { supabase } from '@/lib/supabase';

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
    const [copyState, setCopyState] = useState('idle'); // 'idle' | 'copying' | 'copied'

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
    }, [currentTask?.id, currentTask?.caseNumber, currentTask?.case_number]);

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
        const newUpdates = { ...updates };
        
        // Auto-change status to "En Preparación" (or "Para Coordinar" if collection) when adding devices/accessories
        const modifiesAssets = newUpdates.assets || newUpdates.accessories || newUpdates.yubikeys;
        if (modifiesAssets && (!activeTask.status || activeTask.status === 'Pendiente')) {
            const isCollection = caseTypeInput === 'recoleccion' || (activeTask && isCollectionCase(activeTask.subject || ''));
            newUpdates.status = isCollection ? 'Para Coordinar' : 'En Preparación';
        }

        setLocalTask(prev => prev ? { ...prev, ...newUpdates } : null);
        setPendingTaskUpdates(prev => ({ ...prev, ...newUpdates }));
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
                deliveryInfo: currentTask.deliveryInfo || currentTask.delivery_info || null,
                trackingNumber: currentTask.tracking_number || currentTask.trackingNumber || ticket.logistics?.trackingNumber || ticket.logistics?.tracking_number || ''
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

    const handleCopySignLink = async () => {
        const ticketId = ticket?.id;
        if (!ticketId) {
            alert('No se encontró el ID del caso.');
            return;
        }

        setCopyState('copying');
        try {
            const caseNum = currentTask?.caseNumber || ticket.caseNumber || ticketId;
            const recipient = currentTask?.deliveryPerson || ticket.logistics?.contactName || ticket.requester || '';

            let finalUrl = '';
            try {
                const res = await fetch(`/api/confirm-delivery?action=get-token&ticketId=${encodeURIComponent(ticketId)}&caseNumber=${encodeURIComponent(caseNum)}&recipient=${encodeURIComponent(recipient)}`);
                if (res.ok) {
                    const data = await res.json();
                    if (data?.url) finalUrl = data.url;
                }
            } catch (apiErr) {
                console.warn('API get-token fallback:', apiErr);
            }

            if (!finalUrl) {
                const token = generateDeliveryToken({ ticketId, caseNumber: caseNum, recipient });
                const origin = typeof window !== 'undefined' ? window.location.origin : 'https://assetflow-yawi.vercel.app';
                finalUrl = `${origin}/entrega/${token}`;
            }

            // Copiado robusto con fallback múltiple
            let copied = false;
            if (navigator?.clipboard?.writeText) {
                try {
                    await navigator.clipboard.writeText(finalUrl);
                    copied = true;
                } catch (clipErr) {
                    console.warn('navigator.clipboard error:', clipErr);
                }
            }

            if (!copied) {
                try {
                    const textArea = document.createElement('textarea');
                    textArea.value = finalUrl;
                    textArea.style.position = 'fixed';
                    textArea.style.left = '-9999px';
                    textArea.style.top = '0';
                    document.body.appendChild(textArea);
                    textArea.focus();
                    textArea.select();
                    copied = document.execCommand('copy');
                    document.body.removeChild(textArea);
                } catch (cmdErr) {
                    console.error('execCommand copy error:', cmdErr);
                }
            }

            if (copied) {
                setCopyState('copied');
                setTimeout(() => setCopyState('idle'), 3000);
            } else {
                setCopyState('idle');
                prompt('Copiá este enlace para enviar al destinatario:', finalUrl);
            }
        } catch (err) {
            console.error('Error al generar enlace de firma:', err);
            setCopyState('idle');
            alert('Ocurrió un error al generar el enlace de firma.');
        }
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
                                    {(() => {
                                        const methodStr = String(currentTask?.method || ticket?.logistics?.method || '').toLowerCase();
                                        const driverStr = String(currentTask?.deliveryPerson || currentTask?.delivery_person || ticket?.logistics?.deliveryPerson || '').toLowerCase();
                                        const trackingStr = String(currentTask?.tracking_number || currentTask?.trackingNumber || ticket?.logistics?.trackingNumber || ticket?.logistics?.tracking_number || '').trim();
                                        const isPostalCase = 
                                            methodStr.includes('correo') || 
                                            methodStr.includes('andreani') || 
                                            methodStr.includes('postal') || 
                                            methodStr.includes('dhl') || 
                                            methodStr.includes('fedex') || 
                                            driverStr.includes('correo') || 
                                            driverStr.includes('andreani') || 
                                            (trackingStr.length > 3 && trackingStr !== '-');

                                        if (!isPostalCase) return null;

                                        return (
                                            <Button 
                                                variant="secondary" 
                                                size="sm"
                                                icon={copyState === 'copied' ? CheckCircle2 : copyState === 'copying' ? Loader2 : QrCode}
                                                onClick={handleCopySignLink}
                                                disabled={copyState === 'copying'}
                                                title="Copiar enlace para enviar por WhatsApp o Email"
                                                style={{ 
                                                    fontSize: '0.75rem', 
                                                    height: '28px', 
                                                    padding: '0 10px', 
                                                    borderColor: copyState === 'copied' ? '#86efac' : '#bfdbfe', 
                                                    background: copyState === 'copied' ? '#f0fdf4' : '#eff6ff', 
                                                    color: copyState === 'copied' ? '#15803d' : '#1d4ed8',
                                                    transition: 'all 0.2s ease',
                                                    fontWeight: 600
                                                }}
                                            >
                                                {copyState === 'copying' ? 'Generando...' : copyState === 'copied' ? '¡Link Copiado! ✓' : 'Link de Firma'}
                                            </Button>
                                        );
                                    })()}
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
                                    // Mergear las actualizaciones pendientes de la tarea (como assets) con la logística
                                    // Forzar el estado a "En Preparación" o "Para Coordinar" (si es recolección) siempre que se guarde el caso
                                    const isCollection = caseTypeInput === 'recoleccion' || (activeTask && isCollectionCase(activeTask.subject || ''));
                                    const targetStatus = isCollection ? 'Para Coordinar' : 'En Preparación';
                                    const updatesToSave = { ...pendingTaskUpdates };
                                    
                                    // Solo forzar salir de Pendiente si aún está en ese estado y no se ha modificado manualmente
                                    if (!activeTask?.status || activeTask.status === 'Pendiente') {
                                        if (!updatesToSave.status) {
                                            updatesToSave.status = targetStatus;
                                        }
                                    }
                                    if (logisticsSaveRef.current) {
                                        const result = await logisticsSaveRef.current(updatesToSave);
                                        if (result?.error) return; // No cerrar si hubo error
                                        setPendingTaskUpdates({}); // clear
                                    } else if (Object.keys(updatesToSave).length > 0) {
                                        const result = await handleUpdateTask(updatesToSave);
                                        if (result?.error) return;
                                        setPendingTaskUpdates({});
                                    }

                                    // Add Notification Logic if transitioned to 'En Preparación'
                                    if (!isCollection && activeTask.status !== 'En Preparación') {
                                        supabase.auth.getSession().then(({ data: { session } }) => {
                                            const token = session?.access_token;
                                            fetch('/api/notify-admin', {
                                                method: 'POST',
                                                headers: { 
                                                    'Content-Type': 'application/json',
                                                    'Authorization': token ? `Bearer ${token}` : ''
                                                },
                                                body: JSON.stringify({ task: activeTask, ticket: ticket })
                                            }).catch(err => console.error("Error sending admin notification", err));
                                        });
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