'use client';

import React from 'react';
import { ArrowLeft, Save, Tag } from 'lucide-react';
import { Button } from '@/app/components/ui/Button';
import { useRouter } from 'next/navigation';

export default function TicketActionButtons({
    editMode,
    setEditMode,
    editedData,
    setEditedData,
    handleUpdate,
    ticket,
    unifiedTasks
}) {
    const router = useRouter();

    return (
        <div className="flex-mobile-column" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', gap: '1rem' }}>
            <Button variant="secondary" icon={ArrowLeft} onClick={() => router.back()}>
                Volver a la lista
            </Button>
            <div style={{ display: 'flex', gap: '1rem' }}>
                {editMode ? (
                    <>
                        <Button variant="ghost" onClick={() => {
                            setEditMode(false);
                            setEditedData(ticket); // Reset
                        }}>Cancelar</Button>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                            <Button icon={Save} onClick={async () => {
                                const result = await handleUpdate();
                                if (result && result.error) {
                                    const errSpan = document.getElementById('save-error-msg-main');
                                    if (errSpan) {
                                        errSpan.textContent = result.error;
                                        errSpan.style.display = 'block';
                                        setTimeout(() => { if(errSpan) errSpan.style.display = 'none'; }, 5000);
                                    } else {
                                        alert("Error al guardar: " + result.error);
                                    }
                                }
                            }}>Guardar Cambios</Button>
                            <span id="save-error-msg-main" style={{ display: 'none', color: 'var(--danger)', fontSize: '0.8rem', fontWeight: 500, maxWidth: '200px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}></span>
                        </div>
                    </>
                ) : (
                    <>
                        <Button 
                            variant="primary" 
                            style={{ background: '#0369a1', color: 'white', borderColor: '#0369a1' }}
                            onClick={() => {
                                const subject = ticket.subject || 'Soporte SFDC';
                                let caseNumDisplay = ticket.id;
                                const match = subject.match(/SFDC-\d+/);
                                if (match) caseNumDisplay = match[0];

                                const requester = ticket.requester || '';
                                const phone = editedData.logistics?.phone || '';
                                const address = editedData.logistics?.address || '';
                                const email = editedData.logistics?.email || '';
                                const creationDate = ticket.date || editedData.logistics?.entryDate || '';

                                const deliveryAssets = [];
                                const recoveryAssets = [];
                                let hasMobile = false;
                                let hasLaptop = false;

                                if (unifiedTasks) {
                                    unifiedTasks.forEach(task => {
                                        const assets = task.assets || [];
                                        assets.forEach(asset => {
                                            const type = asset.type || '';
                                            if (type.toLowerCase() === 'smartphone' || type.toLowerCase() === 'celular') hasMobile = true;
                                            if (type.toLowerCase() === 'laptop') hasLaptop = true;
                                            
                                            const taskSubject = task.subject?.toLowerCase() || '';
                                            if (taskSubject.includes('recovery') || taskSubject.includes('recupero') || taskSubject.includes('baja') || task.assignee === 'Baja de Equipo') {
                                                recoveryAssets.push(asset);
                                            } else {
                                                deliveryAssets.push(asset);
                                            }
                                        });
                                    });
                                }

                                const formatAsset = (a) => {
                                    if (a.type === 'Laptop') return `LAPTOP: ${a.modelNumber || a.hardwareSpec || ''} / Serial: ${a.serial || ''}`;
                                    if (a.type === 'Smartphone' || a.type === 'Celular') return `MOBILE: ${a.modelNumber || a.hardwareSpec || ''} / Serial: ${a.serial || ''}`;
                                    if (a.type === 'Yubikey') return `YUBIKEY_Serial: ${a.serial || ''}`;
                                    return `${a.type?.toUpperCase() || 'OTHER'}: ${a.modelNumber || ''} / Serial: ${a.serial || ''}`;
                                };

                                const generateList = (list) => {
                                    if (list.length === 0) return "LAPTOP: / Serial:\nMOBILE: / Serial:\nYUBIKEY_Serial:";
                                    return list.map(formatAsset).join('\n');
                                };

                                const body = `Hello,Dear SFDC Support,\n\nCase information:\nDescription: ${subject}\nSFDC Case Number: ${caseNumDisplay}\nName: ${requester}\nPhone: ${phone}\nShipping address: ${address}\nEmail: ${email}\nCase Creation Date: ${creationDate}\n\n--------------------\nDELIVERY DEVICES :\n${generateList(deliveryAssets)}\nBACKPACK :false\nSCREENPROTECT :false\n--------------------\nRECOVERY DEVICES :\n${generateList(recoveryAssets)}\n--------------------`;

                                let toEmail = 'sfdc_lsupport@sycomp.com';
                                if (hasMobile && !hasLaptop) {
                                    toEmail = 'sfdcmobsupport@sycomp.com';
                                } else if (hasLaptop) {
                                    toEmail = 'sfdc_lsupport@sycomp.com';
                                }

                                const mailtoUrl = `mailto:${toEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
                                // Usar location.href es más compatible en Mac/Safari que window.open
                                window.location.href = mailtoUrl;
                            }}
                        >
                            Email SYCOMP
                        </Button>
                        <Button variant="ghost" icon={Tag} onClick={() => setEditMode(true)}>Editar Detalles</Button>
                    </>
                )}
            </div>
        </div>
    );
}
