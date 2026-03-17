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
    ticket
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
                        <Button icon={Save} onClick={handleUpdate}>Guardar Cambios</Button>
                    </>
                ) : (
                    <Button variant="ghost" icon={Tag} onClick={() => setEditMode(true)}>Editar Detalles</Button>
                )}
            </div>
        </div>
    );
}
