'use client';

import React from 'react';
import { Card } from '@/app/components/ui/Card';
import { Button } from '@/app/components/ui/Button';
import { Trash2 } from 'lucide-react';

export default function DangerZoneCard({ currentUser, handleDelete }) {
    if (currentUser?.role !== 'admin' && currentUser?.role !== 'Gerencial') return null;

    return (
        <Card style={{ borderColor: 'rgba(239, 68, 68, 0.2)', backgroundColor: 'rgba(239, 68, 68, 0.05)' }}>
            <h4 style={{ color: '#ef4444', marginBottom: '1rem', fontSize: '0.9rem' }}>Zona de Peligro</h4>
            <Button variant="danger" size="sm" icon={Trash2} style={{ width: '100%', justifyContent: 'center' }} onClick={handleDelete}>
                Borrar Ticket
            </Button>
        </Card>
    );
}
