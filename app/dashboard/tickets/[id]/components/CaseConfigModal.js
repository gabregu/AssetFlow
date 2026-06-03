'use client';

import React, { useRef, useState, useEffect } from 'react';
import { Modal } from '@/app/components/ui/Modal';
import AssetListSection from './AssetListSection';
import AccessoriesSection from './AccessoriesSection';
import YubiKeySection from './YubiKeySection';
import CaseLogisticsSection from './CaseLogisticsSection';
import ManualAssetModal from './ManualAssetModal';
import DeliveryVerificationModal from './DeliveryVerificationModal';
import { FileText } from 'lucide-react';
import { generateTicketPDF } from '@/lib/pdf-generator';
import { Button } from '@/app/components/ui/Button';

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

    const [subjectInput, setSubjectInput] = useState('');

    useEffect(() => {
        if (currentTask) {
            setSubjectInput(currentTask.subject || '');
        }
    }, [currentTask?.id, currentTask?.subject]);
    // handleUpdateTask was moved to hook for centralization
    const handleGenerateRemito = (action = 'download') => {
        if (!currentTask) return;
        
        let allAssets = [];
        let allYubikeys = [];
        let allAccessories = {};
        
        currentTasks.forEach(t => {
            if (t.assets) allAssets = [...allAssets, ...t.assets];
            if (t.yubikeys) allYubikeys = [...allYubikeys, ...t.yubikeys];
            if (t.accessories) {
                Object.keys(t.accessories).forEach(key => {
                    if (t.accessories[key]) {
                        allAccessories[key] = true;
                    }
                });
            }
        });

        // Deduplicate
        const uniqueAssets = Array.from(new Map(allAssets.map(item => [item.serial || item, item])).values());
        const uniqueYubikeys = Array.from(new Map(allYubikeys.map(item => [item.serial || item, item])).values());

        // Crear un objeto de ticket "virtual" que sea compatible con generateTicketPDF
        const virtualTicket = {
            ...ticket,
            subject: `${ticket.subject || currentTask.subject} (Consolidado: ${currentTasks.length} casos)`,
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

        generateTicketPDF(virtualTicket, assets, null, action);
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
                                        if (subjectInput.trim() !== '' && subjectInput !== currentTask.subject) {
                                            handleUpdateTask({ subject: subjectInput.trim() });
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
                                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.25rem' }}>
                                    {['Entrega', 'Recupero', 'Entrega y Recupero', 'Servicio Técnico'].map(opt => (
                                        <button
                                            key={opt}
                                            type="button"
                                            onClick={() => {
                                                setSubjectInput(opt);
                                                handleUpdateTask({ subject: opt });
                                            }}
                                            style={{
                                                fontSize: '0.7rem',
                                                padding: '4px 8px',
                                                borderRadius: '4px',
                                                border: `1px solid ${currentTask.subject === opt ? 'var(--primary-color)' : 'var(--border)'}`,
                                                background: currentTask.subject === opt ? 'rgba(37, 99, 235, 0.1)' : 'var(--background)',
                                                color: currentTask.subject === opt ? 'var(--primary-color)' : 'var(--text-secondary)',
                                                cursor: 'pointer',
                                                fontWeight: 600,
                                                transition: 'all 0.15s'
                                            }}
                                        >
                                            {opt}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                        <AssetListSection
                            task={currentTask}
                            onUpdateTask={handleUpdateTask}
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
                            task={currentTask}
                            onUpdateTask={handleUpdateTask}
                            consumables={consumables}
                            ticketCountry={currentTask.country || ticket?.logistics?.country || 'Argentina'}
                            updateConsumableStock={updateConsumableStock}
                        />

                        <YubiKeySection
                            task={currentTask}
                            onUpdateTask={handleUpdateTask}
                            yubikeys={yubikeys}
                        />

                        <CaseLogisticsSection
                            task={currentTask}
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
                                style={{ width: '100%', padding: '1.2rem', fontSize: '1.1rem', fontWeight: 800, borderRadius: '12px' }}
                                onClick={async () => {
                                    if (logisticsSaveRef.current) {
                                        const result = await logisticsSaveRef.current();
                                        if (result?.error) return; // No cerrar si hubo error
                                    }
                                    setSelectedCaseIndex(null);
                                }}
                            >
                                LISTO / GUARDAR CAMBIOS
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