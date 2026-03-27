'use client';

import React from 'react';
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
    users,
    setIsInventorySelectorOpen,
    isAssetModalOpen,
    setIsAssetModalOpen,
    handleCreateAsset,
    newAsset,
    setNewAsset,
    verifyDeliveryModal,
    setVerifyDeliveryModal,
    ticketTasks,
    updateLogisticsTask,
    addLogisticsTask,
    deleteLogisticsTask,
    handleUpdateTask, // <--- Use from props now
    currentUser
}) {
    const currentTasks = (ticketTasks && ticketTasks.length > 0) ? ticketTasks : (editedData?.associatedCases || []);
    const currentTask = (selectedCaseIndex !== null && currentTasks) ? currentTasks[selectedCaseIndex] : null;

    // handleUpdateTask was moved to hook for centralization
    const handleGenerateRemito = (action = 'download') => {
        if (!currentTask) return;
        
        // Crear un objeto de ticket "virtual" que sea compatible con generateTicketPDF
        const virtualTicket = {
            ...ticket,
            subject: currentTask.subject,
            associatedAssets: currentTask.assets || [],
            accessories: currentTask.accessories || {},
            yubikeys: currentTask.yubikeys || [],
            logistics: {
                ...(ticket.logistics || {}),
                method: currentTask.method,
                date: currentTask.date,
                timeSlot: currentTask.timeSlot,
                status: currentTask.status,
                phone: ticket.logistics?.phone || '',
                email: ticket.logistics?.email || '',
                address: currentTask.address || ticket.logistics?.address || '',
                type: currentTask.method === 'Recupero' ? 'Recupero' : 'Entrega',
                deliveryInfo: currentTask.deliveryInfo || null
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
            >
                {selectedCaseIndex !== null && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
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
                        />

                        <AccessoriesSection
                            task={currentTask}
                            onUpdateTask={handleUpdateTask}
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
                        />

                        <div style={{ 
                            marginTop: '0.5rem',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '1rem'
                        }}>
                             <Button 
                                variant="primary" 
                                style={{ width: '100%', padding: '0.75rem', fontWeight: 700, fontSize: '0.95rem' }}
                                onClick={async () => {
                                    // REFORZAR GUARDADO: Al cerrar la ventana, guardamos explicitly todos los cambios pendientes
                                    await handleUpdate();
                                    setSelectedCaseIndex(null);
                                }}
                            >
                                Guardar y Cerrar Configuración
                            </Button>

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