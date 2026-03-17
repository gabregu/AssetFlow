'use client';

import React from 'react';
import { CheckCircle2 } from 'lucide-react';
import { Modal } from '@/app/components/ui/Modal';
import { Button } from '@/app/components/ui/Button';

export default function DeliveryVerificationModal({
    isOpen,
    onClose,
    serial,
    onConfirm
}) {
    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title="❗ Revisión Obligatoria antes de Envío"
        >
            <div>
                <p style={{ marginBottom: '1rem', color: 'var(--text-secondary)' }}>
                    Estás por marcar un dispositivo para <strong>Entrega</strong>. Por favor confirma la siguiente revisión:
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '2rem' }}>
                    {[
                        '¿Está en buenas condiciones sin roturas?',
                        '¿Está borrado y activo en DEP?',
                        '¿Ha sido etiquetado?',
                        'Si es Windows, ¿fue realizado el proceso de asignación?',
                        '¿Está limpio y sin etiquetas anteriores?'
                    ].map((item, i) => (
                        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                            <CheckCircle2 size={18} style={{ color: 'var(--primary-color)' }} />
                            <span style={{ fontSize: '0.9rem' }}>{item}</span>
                        </div>
                    ))}
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
                    <Button variant="secondary" onClick={onClose}>
                        Cancelar
                    </Button>
                    <Button onClick={() => onConfirm(serial)}>
                        Confirmar y Asignar
                    </Button>
                </div>
            </div>
        </Modal>
    );
}
