'use client';

import React from 'react';
import TicketActionButtons from './components/TicketActionButtons';
import TicketHeader from './components/TicketHeader';
import AssociatedCasesCard from './components/AssociatedCasesCard';
import HistoryPanel from './components/HistoryPanel';
import ManagementStatusCard from './components/ManagementStatusCard';
import ScheduleCoordinationCard from './components/ScheduleCoordinationCard';
import ProcessChecklistCard from './components/ProcessChecklistCard';
import DangerZoneCard from './components/DangerZoneCard';
import CaseConfigModal from './components/CaseConfigModal';
import InventorySelectorModal from './components/InventorySelectorModal';
import InstructionsCard from './components/InstructionsCard';
import DriverDetailView from './components/DriverDetailView';
import { useTicketDetail } from './hooks/useTicketDetail';
import { getStatusVariant } from '../constants';

export default function TicketDetailPage() {
    const {
        ticket, editedData, setEditedData,
        editMode, setEditMode,
        editLogistics,
        editSchedule, setEditSchedule,
        editContact, setEditContact,
        addressStatus, setAddressStatus,
        selectedCaseIndex, setSelectedCaseIndex,
        isLoaded,
        serialQuery, setSerialQuery,
        assetSearchResult, setAssetSearchResult,
        isAssetModalOpen, setIsAssetModalOpen,
        isInventorySelectorOpen, setIsInventorySelectorOpen,
        inventorySearchQuery, setInventorySearchQuery,
        newAsset, setNewAsset,
        verifyDeliveryModal, setVerifyDeliveryModal,
        isSmartSearchOpen, setIsSmartSearchOpen,
        validateAddress,
        handleUpdate,
        handleUpdateTask,
        handleDelete,
        handleAssetSearch,
        handleCreateAsset,
        updateTicket,
        assets,
        yubikeys,
        users,
        currentUser,
        sfdcCases,
        ticketTasks,
        unifiedTasks,
        addLogisticsTask,
        updateLogisticsTask,
        deleteLogisticsTask
    } = useTicketDetail();

    const resetSearchStates = () => {
        setIsSmartSearchOpen(false);
        setAssetSearchResult(null);
        setSerialQuery('');
    };

    if (!ticket) {
        return (
            <div style={{ padding: '2rem', textAlign: 'center' }}>
                <p style={{ color: 'var(--text-secondary)' }}>Cargando ticket...</p>
            </div>
        );
    }

    return (
        <div style={{ maxWidth: '1000px', margin: '0 auto', paddingBottom: '4rem', padding: '1rem' }}>
            
            {/* VISTA CONDICIONAL SEGUN ROL */}
            {currentUser?.role === 'Conductor' ? (
                /* VISTA CONDUCTOR (Simplificada y Mobile-first) */
                <DriverDetailView 
                    ticket={ticket}
                    editedData={editedData}
                    setEditedData={setEditedData}
                    updateTicket={updateTicket}
                    currentUser={currentUser}
                    unifiedTasks={unifiedTasks}
                    setSelectedCaseIndex={setSelectedCaseIndex}
                />
            ) : (
                /* VISTA ADMINISTRADOR (Completa) */
                <>
                    <TicketActionButtons
                        editMode={editMode}
                        setEditMode={setEditMode}
                        editedData={editedData}
                        setEditedData={setEditedData}
                        handleUpdate={handleUpdate}
                        ticket={ticket}
                    />

                    <div className="grid-mobile-single" style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '2rem' }}>
                        {/* Main Detail area */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                            <TicketHeader 
                                ticket={ticket}
                                editedData={editedData}
                                setEditedData={setEditedData}
                                editMode={editMode}
                                setEditMode={setEditMode}
                                editContact={editContact}
                                setEditContact={setEditContact}
                                handleUpdate={handleUpdate}
                                addressStatus={addressStatus}
                                setAddressStatus={setAddressStatus}
                                validateAddress={validateAddress}
                                isLoaded={isLoaded}
                            />

                            <AssociatedCasesCard 
                                ticket={ticket}
                                editedData={editedData}
                                setEditedData={setEditedData}
                                updateTicket={updateTicket}
                                sfdcCases={sfdcCases}
                                selectedCaseIndex={selectedCaseIndex}
                                setSelectedCaseIndex={setSelectedCaseIndex}
                                resetSearchStates={resetSearchStates}
                                ticketTasks={ticketTasks}
                                unifiedTasks={unifiedTasks}
                            />

                            <InstructionsCard
                                ticket={ticket}
                                editedData={editedData}
                                setEditedData={setEditedData}
                                updateTicket={updateTicket}
                                currentUser={currentUser}
                            />

                            <HistoryPanel 
                                ticket={ticket} 
                                editedData={editedData} 
                                setEditedData={setEditedData} 
                                updateTicket={updateTicket} 
                                currentUser={currentUser} 
                            />
                        </div>

                        {/* Sidebar area */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                            <ManagementStatusCard
                                editedData={editedData}
                                ticket={ticket}
                                editMode={editMode}
                                setEditedData={setEditedData}
                                updateTicket={updateTicket}
                            />

                            <ProcessChecklistCard
                                editedData={editedData}
                                ticket={ticket}
                            />

                            <DangerZoneCard
                                currentUser={currentUser}
                                handleDelete={handleDelete}
                            />
                        </div>
                    </div>
                </>
            )}

            {/* MODALS (Comunes para ambas vistas) */}
            <CaseConfigModal 
                ticket={ticket}
                editedData={editedData}
                setEditedData={setEditedData}
                handleUpdate={handleUpdate}
                selectedCaseIndex={selectedCaseIndex}
                setSelectedCaseIndex={setSelectedCaseIndex}
                handleAssetSearch={handleAssetSearch}
                assetSearchResult={assetSearchResult}
                isSmartSearchOpen={isSmartSearchOpen}
                setIsSmartSearchOpen={setIsSmartSearchOpen}
                serialQuery={serialQuery}
                setSerialQuery={setSerialQuery}
                setAssetSearchResult={setAssetSearchResult}
                assets={assets}
                yubikeys={yubikeys}
                users={users}
                setIsInventorySelectorOpen={setIsInventorySelectorOpen}
                isAssetModalOpen={isAssetModalOpen}
                setIsAssetModalOpen={setIsAssetModalOpen}
                handleCreateAsset={handleCreateAsset}
                newAsset={newAsset}
                setNewAsset={setNewAsset}
                verifyDeliveryModal={verifyDeliveryModal}
                setVerifyDeliveryModal={setVerifyDeliveryModal}
                ticketTasks={ticketTasks}
                deleteLogisticsTask={deleteLogisticsTask}
                handleUpdateTask={handleUpdateTask}
                currentUser={currentUser}
            />
            
            <InventorySelectorModal
                isOpen={isInventorySelectorOpen}
                onClose={() => {
                    setIsInventorySelectorOpen(false);
                    setInventorySearchQuery('');
                }}
                inventorySearchQuery={inventorySearchQuery}
                setInventorySearchQuery={setInventorySearchQuery}
                assets={assets}
                task={(selectedCaseIndex !== null && (ticketTasks && ticketTasks.length > 0 ? ticketTasks : (editedData?.associatedCases || []))[selectedCaseIndex]) || null}
                onUpdateTask={handleUpdateTask}
            />
        </div>
    );
}
