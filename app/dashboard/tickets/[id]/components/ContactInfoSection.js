'use client';

import React from 'react';
import { Mail, Phone, MapPin, Hash, Calendar, CheckCircle2, CheckCircle, Loader2 } from 'lucide-react';
import { Badge } from '@/app/components/ui/Badge';

const Slack = ({ size = 24 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
        <path d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zM6.313 15.165a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313zM8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zM8.834 6.313a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312zM18.956 8.834a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834zM17.688 8.834a2.528 2.528 0 0 1-2.523 2.521 2.527 2.527 0 0 1-2.52-2.521V2.522A2.527 2.527 0 0 1 15.165 0a2.528 2.528 0 0 1 2.523 2.522v6.312zM15.165 18.956a2.528 2.528 0 0 1 2.523 2.522A2.528 2.528 0 0 1 15.165 24a2.527 2.527 0 0 1-2.523-2.522v-2.522h2.523zM15.165 17.688a2.527 2.527 0 0 1-2.523-2.523 2.526 2.526 0 0 1 2.523-2.52h6.313A2.527 2.527 0 0 1 24 15.165a2.528 2.528 0 0 1-2.522 2.523h-6.313z"/>
    </svg>
);

export default function ContactInfoSection({
    ticket,
    editedData,
    setEditedData,
    editMode,
    editContact,
    addressStatus,
    setAddressStatus,
    validateAddress,
    isLoaded
}) {
    const isEditing = editMode || editContact;

    return (
        <div className="grid-mobile-single" style={{ marginTop: '1.25rem', paddingTop: '1rem', borderTop: '1px solid var(--border)', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem 1.5rem' }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
                {ticket.associatedCases && ticket.associatedCases.length > 0 ? (
                    <div style={{ padding: '0.5rem', background: '#f8fafc', borderRadius: '6px', border: '1px solid var(--border)' }}>
                        <label className="form-label" style={{ fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <Hash size={12} /> Casos Asociados ({ticket.associatedCases.length})
                        </label>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            {ticket.associatedCases.map((ac, idx) => (
                                <div key={idx} style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '6px',
                                    fontSize: '0.8rem',
                                    padding: '4px',
                                    background: 'white',
                                    borderRadius: '4px',
                                    border: '1px solid var(--border)'
                                }}>
                                    <span style={{ fontWeight: 600, color: '#0369a1' }}>#{ac.caseNumber}</span>
                                    <span style={{ color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '200px' }}>
                                        {ac.subject}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                ) : (
                    <>
                        <label className="form-label" style={{ fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>Segundo Caso SFDC (Opcional)</label>
                        <div style={{ position: 'relative' }}>
                            <Hash size={12} style={{ position: 'absolute', left: '10px', top: '10px', color: 'var(--text-secondary)' }} />
                            <input
                                className="form-input"
                                style={{ paddingLeft: '2.2rem', height: '32px', fontSize: '0.85rem' }}
                                disabled={!isEditing}
                                value={editedData.logistics?.additionalCase || ''}
                                onChange={e => setEditedData({
                                    ...editedData,
                                    logistics: { ...(editedData.logistics || {}), additionalCase: e.target.value }
                                })}
                            />
                        </div>
                    </>
                )}
            </div>
            
            <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" style={{ fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>Fecha de Ingreso</label>
                <div style={{ position: 'relative' }}>
                    <Calendar size={12} style={{ position: 'absolute', left: '10px', top: '10px', color: 'var(--text-secondary)' }} />
                    <input
                        type="date"
                        className="form-input"
                        style={{ paddingLeft: '2.2rem', height: '32px', fontSize: '0.85rem' }}
                        disabled={!isEditing}
                        value={editedData.logistics?.entryDate || ''}
                        onChange={e => setEditedData({
                            ...editedData,
                            logistics: { ...(editedData.logistics || {}), entryDate: e.target.value }
                        })}
                    />
                </div>
            </div>

            <div className="form-group" style={{ gridColumn: 'span 2', marginBottom: 0 }}>
                <label className="form-label" style={{ fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>Dirección Completa</label>
                <div style={{ position: 'relative' }}>
                    {addressStatus === 'valid' ? (
                        <CheckCircle2 size={12} style={{ position: 'absolute', left: '10px', top: '10px', color: '#22c55e' }} />
                    ) : (
                        <MapPin size={12} style={{ position: 'absolute', left: '10px', top: '10px', color: 'var(--text-secondary)' }} />
                    )}
                    <input
                        className="form-input"
                        style={{
                            paddingLeft: '2.2rem',
                            paddingRight: isEditing ? '80px' : '10px',
                            height: '32px',
                            fontSize: '0.85rem',
                            borderColor: addressStatus === 'valid' ? '#22c55e' : (addressStatus === 'invalid' ? '#ef4444' : 'var(--border)')
                        }}
                        disabled={!isEditing}
                        value={editedData.logistics?.address || ''}
                        onChange={e => {
                            setAddressStatus('idle');
                            setEditedData({
                                ...editedData,
                                logistics: { ...(editedData.logistics || {}), address: e.target.value }
                            });
                        }}
                    />
                    {isEditing && isLoaded && (
                        <button
                            type="button"
                            onClick={validateAddress}
                            style={{
                                position: 'absolute',
                                right: '4px',
                                top: '4px',
                                bottom: '4px',
                                border: 'none',
                                background: addressStatus === 'valid' ? '#dcfce7' : '#eff6ff',
                                color: addressStatus === 'valid' ? '#166534' : '#1d4ed8',
                                borderRadius: '4px',
                                padding: '0 8px',
                                fontSize: '0.7rem',
                                fontWeight: 600,
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '4px'
                            }}
                        >
                            {addressStatus === 'validating' ? (
                                <Loader2 size={12} className="animate-spin" />
                            ) : addressStatus === 'valid' ? (
                                <><CheckCircle size={12} /> OK</>
                            ) : addressStatus === 'invalid' ? (
                                <span style={{ color: '#ef4444' }}>No válida</span>
                            ) : (
                                'Validar'
                            )}
                        </button>
                    )}
                </div>
                {addressStatus === 'invalid' && (
                    <p style={{ color: '#ef4444', fontSize: '0.7rem', marginTop: '4px', margin: 0 }}>
                        ⚠️ Dirección no encontrada en Google Maps.
                    </p>
                )}
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" style={{ fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>Correo Electrónico</label>
                <div style={{ position: 'relative' }}>
                    <Mail size={12} style={{ position: 'absolute', left: '10px', top: '10px', color: 'var(--text-secondary)' }} />
                    <input
                        className="form-input"
                        style={{ paddingLeft: '2.2rem', height: '32px', fontSize: '0.85rem' }}
                        disabled={!isEditing}
                        value={editedData.logistics?.email || ''}
                        onChange={e => setEditedData({
                            ...editedData,
                            logistics: { ...(editedData.logistics || {}), email: e.target.value }
                        })}
                    />
                </div>
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" style={{ fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>Teléfono de Contacto</label>
                <div style={{ position: 'relative' }}>
                    <Phone size={12} style={{ position: 'absolute', left: '10px', top: '10px', color: 'var(--text-secondary)' }} />
                    <input
                        className="form-input"
                        style={{ paddingLeft: '2.2rem', height: '32px', fontSize: '0.85rem' }}
                        disabled={!isEditing}
                        value={editedData.logistics?.phone || ''}
                        onChange={e => setEditedData({
                            ...editedData,
                            logistics: { ...(editedData.logistics || {}), phone: e.target.value }
                        })}
                    />
                </div>
            </div>

            {/* Contact Actions Row */}
            {!isEditing && (editedData.logistics?.email || editedData.logistics?.phone) && (
                <div style={{ gridColumn: 'span 2', display: 'flex', gap: '0.5rem', marginTop: '4px' }}>
                    {editedData.logistics?.email && (
                        <button
                            onClick={() => window.open(`https://slack.com/app_redirect?channel=${encodeURIComponent(editedData.logistics.email)}`, '_blank')}
                            style={{
                                display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '4px 10px', borderRadius: '6px',
                                background: '#4A154B', color: 'white', fontSize: '0.7rem', fontWeight: 600, border: 'none', cursor: 'pointer'
                            }}
                        >
                            <Slack size={12} /> Slack
                        </button>
                    )}
                    {editedData.logistics?.phone && (
                        <button
                            onClick={() => {
                                const phone = editedData.logistics?.phone || '';
                                if (phone) window.open(`https://wa.me/${phone.replace(/\D/g, '')}`, '_blank');
                            }}
                            style={{
                                display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '4px 10px', borderRadius: '6px',
                                background: '#25D366', color: 'white', fontSize: '0.7rem', fontWeight: 600, border: 'none', cursor: 'pointer'
                            }}
                        >
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L0 24l6.335-1.662c1.72.937 3.659 1.432 5.626 1.433h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" /></svg> WhatsApp
                        </button>
                    )}
                </div>
            )}
        </div>
    );
}
