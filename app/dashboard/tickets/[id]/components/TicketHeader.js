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
    isLoaded
}) {
    return (
        <Card>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <Badge variant="outline">{ticket.id}</Badge>
                    <Badge variant={getStatusVariant(editedData.status || ticket.status)}>
                        {editedData.status || ticket.status}
                    </Badge>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    {!editMode && !editContact ? (
                        <Button variant="ghost" size="sm" onClick={() => setEditContact(true)}>Editar Información</Button>
                    ) : editContact ? (
                        <Button size="sm" icon={Save} onClick={() => {
                            handleUpdate();
                            setEditContact(false);
                        }}>Guardar</Button>
                    ) : null}
                </div>
            </div>

            {editMode ? (
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
                    value={editedData.subject}
                    onChange={e => setEditedData({ ...editedData, subject: e.target.value })}
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
                    {ticket.subject}
                </h1>
            )}

            <TicketInfoGrid 
                ticket={ticket}
                editedData={editedData}
                setEditedData={setEditedData}
                editMode={editMode}
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
            />
        </Card>
    );
}