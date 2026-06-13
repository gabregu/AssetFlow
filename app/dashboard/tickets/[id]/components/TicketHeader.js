'use client';

import React from 'react';
import { Card } from '@/app/components/ui/Card';
import { Badge } from '@/app/components/ui/Badge';
import { Button } from '@/app/components/ui/Button';
import { Save } from 'lucide-react';
import { getStatusVariant } from '@/app/dashboard/tickets/constants';
import TicketInfoGrid from './TicketInfoGrid';
import ContactInfoSection from './ContactInfoSection';

export default function TicketHeader({
    ticket,
    editedData,
    setEditedData,
    editMode,
    setEditMode,
    editContact,
    setEditContact,
    handleUpdate,
    addressStatus,
    setAddressStatus,
    validateAddress,
    isLoaded,
    unifiedTasks,
    handleUnlinkCase
}) {
    const [isSaving, setIsSaving] = React.useState(false);

    return (
        <Card style={{ height: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <Badge variant="outline">{ticket.id}</Badge>
                    {editMode || editContact ? (
                        <select 
                            className="form-select"
                            style={{ height: '24px', fontSize: '0.75rem', padding: '0 4px' }}
                            value={editedData.status || ticket.status}
                            onChange={e => setEditedData({ ...editedData, status: e.target.value })}
                        >
                            <option value="Abierto">Abierto</option>
                            <option value="Pendiente">Pendiente</option>
                            <option value="Bloqueado / A la Espera">Bloqueado / A la Espera</option>
                            <option value="En Progreso">En Progreso</option>
                            <option value="Resuelto">Resuelto</option>
                            <option value="Cerrado">Cerrado</option>
                        </select>
                    ) : (
                        <Badge variant={getStatusVariant(editedData.status || ticket.status)}>
                            {editedData.status || ticket.status}
                        </Badge>
                    )}
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    {!editMode && !editContact ? (
                        <Button variant="ghost" size="sm" onClick={() => setEditContact(true)}>Editar Información</Button>
                    ) : editContact ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                            <Button size="sm" icon={Save} disabled={isSaving} onClick={async () => {
                                setIsSaving(true);
                                const errSpan = document.getElementById('save-error-msg');
                                if (errSpan) {
                                    errSpan.textContent = "1. Iniciando...";
                                    errSpan.style.display = 'block';
                                    errSpan.style.color = 'var(--text-secondary)';
                                }
                                
                                try {
                                    if (errSpan) errSpan.textContent = "2. Ejecutando handleUpdate...";
                                    const result = await handleUpdate();
                                    
                                    if (errSpan) errSpan.textContent = "3. Finalizado handleUpdate.";
                                    setIsSaving(false);
                                    
                                    if (result && result.success) {
                                        if (errSpan) errSpan.style.display = 'none';
                                        setEditContact(false);
                                    } else if (result && result.error) {
                                        if (errSpan) {
                                            errSpan.textContent = result.error;
                                            errSpan.style.color = 'var(--danger)';
                                            setTimeout(() => { if(errSpan) errSpan.style.display = 'none'; }, 8000);
                                        } else {
                                            alert("Error al guardar: " + result.error);
                                        }
                                    }
                                } catch (err) {
                                    setIsSaving(false);
                                    if (errSpan) {
                                        errSpan.textContent = "Error CRÍTICO: " + err.message;
                                        errSpan.style.color = 'var(--danger)';
                                    }
                                }
                            }}>{isSaving ? 'Guardando...' : 'Guardar'}</Button>
                            <span id="save-error-msg" style={{ display: 'none', fontSize: '0.8rem', fontWeight: 500, maxWidth: '300px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}></span>
                        </div>
                    ) : null}
                </div>
            </div>

            {(() => {
                const sfdcMatch = (editedData.subject || '').match(/\[(SFDC-[^\]]+)\]/i);
                const sfdcPrefix = sfdcMatch ? sfdcMatch[1] : '';
                const cleanSubject = sfdcMatch ? (editedData.subject || '').replace(sfdcMatch[0], '').trim() : (editedData.subject || '');

                return editMode || editContact ? (
                    <input
                        style={{
                            fontSize: '1.75rem',
                            fontWeight: 700,
                            width: '100%',
                            background: 'transparent',
                            border: 'none',
                            borderBottom: '2px solid var(--primary-color)',
                            marginBottom: '1.5rem',
                            color: 'var(--text-main)',
                            outline: 'none',
                            padding: '0.5rem 0'
                        }}
                        value={cleanSubject}
                        onChange={e => setEditedData({ ...editedData, subject: sfdcPrefix ? `[${sfdcPrefix}] ${e.target.value}` : e.target.value })}
                        placeholder="Título del servicio..."
                    />
                ) : (
                <h1 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '1.5rem', color: 'var(--text-main)', lineHeight: 1.3 }}>
                    {ticket.associatedCases && ticket.associatedCases.length > 0 && ticket.associatedCases.some(c => {
                        const ticketIdNum = ticket.id?.split('-').pop();
                        return c.caseNumber && c.caseNumber !== 'Caso Principal' && c.caseNumber !== ticketIdNum;
                    }) && (
                        <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '0.3rem', letterSpacing: '0.03em' }}>
                            {ticket.associatedCases
                                .filter(c => {
                                    const ticketIdNum = ticket.id?.split('-').pop();
                                    return c.caseNumber && c.caseNumber !== 'Caso Principal' && c.caseNumber !== ticketIdNum;
                                })
                                .map(c => c.caseNumber)
                                .join(' · ')}
                        </span>
                    )}
                    {(() => {
                        const displayMatch = (ticket.subject || '').match(/\[SFDC-[^\]]+\]/i);
                        return displayMatch ? (ticket.subject || '').replace(displayMatch[0], '').trim() : ticket.subject;
                    })()}
                </h1>
            );
            })()}

            <TicketInfoGrid 
                ticket={ticket}
                editedData={editedData}
                setEditedData={setEditedData}
                editMode={editMode || editContact}
                setEditMode={setEditMode}
            />

            <ContactInfoSection 
                ticket={ticket}
                editedData={editedData}
                setEditedData={setEditedData}
                editMode={editMode}
                editContact={editContact}
                addressStatus={addressStatus}
                setAddressStatus={setAddressStatus}
                validateAddress={validateAddress}
                isLoaded={isLoaded}
                unifiedTasks={unifiedTasks}
                handleUnlinkCase={handleUnlinkCase}
            />
        </Card>
    );
}