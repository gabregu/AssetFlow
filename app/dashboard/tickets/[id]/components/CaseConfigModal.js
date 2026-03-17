'use client';

import React from 'react';
import { Modal } from '@/app/components/ui/Modal';
import AssetListSection from './AssetListSection';
import AccessoriesSection from './AccessoriesSection';
import YubiKeySection from './YubiKeySection';
import CaseLogisticsSection from './CaseLogisticsSection';
import ManualAssetModal from './ManualAssetModal';
import DeliveryVerificationModal from './DeliveryVerificationModal';

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
    setVerifyDeliveryModal
}) {
    return (
        <>
            {/* Case Config Modal */}
            <Modal
                isOpen={selectedCaseIndex !== null}
                onClose={() => {
                    setSelectedCaseIndex(null);
                    // Automatic save on close
                    handleUpdate();
                }}
                title={selectedCaseIndex !== null ? `Configuración: ${editedData.associatedCases[selectedCaseIndex]?.subject}` : 'Configurar Caso'}
            >
                {selectedCaseIndex !== null && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                        <AssetListSection
                            editedData={editedData}
                            setEditedData={setEditedData}
                            selectedCaseIndex={selectedCaseIndex}
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
                            editedData={editedData}
                            setEditedData={setEditedData}
                            selectedCaseIndex={selectedCaseIndex}
                        />

                        <YubiKeySection
                            editedData={editedData}
                            setEditedData={setEditedData}
                            selectedCaseIndex={selectedCaseIndex}
                            yubikeys={yubikeys}
                        />

                        <CaseLogisticsSection
                            editedData={editedData}
                            setEditedData={setEditedData}
                            selectedCaseIndex={selectedCaseIndex}
                            users={users}
                        />
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