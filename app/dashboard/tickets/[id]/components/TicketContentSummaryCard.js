'use client';

import React from 'react';

// Ayudante para identificar el tipo de operación (igual que en Mis Envíos)
export const getOperationType = (ticket) => {
    const text = `${ticket?.subject || ''} ${ticket?.type || ''} ${ticket?.logistics?.type || ''}`.toLowerCase();
    if (text.includes('swap') || text.includes('intercambio') || text.includes('bundle')) {
        return { label: 'INTERCAMBIO', color: '#0284c7', icon: '🔄' };
    }
    if (text.includes('collection') || text.includes('recupero') || text.includes('proceso de baja') || text.includes('retiro') || text.includes('baja') || text.includes('recuperar')) {
        return { label: 'RECUPERO', color: '#f59e0b', icon: '📥' };
    }
    return { label: 'ENTREGA', color: '#10b981', icon: '📤' };
};

// Ayudante para recopilar todos los activos y equipos a entregar/recuperar
export const getDevicesList = (ticket, unifiedTasks = [], inventoryAssets = []) => {
    const list = [];
    const seenSerials = new Set();

    // 1. Tareas de la nueva arquitectura (unifiedTasks / logisticsTasks)
    if (Array.isArray(unifiedTasks) && unifiedTasks.length > 0) {
        unifiedTasks.forEach(task => {
            if (!task) return;
            const assets = Array.isArray(task.assets) ? task.assets : [];
            assets.forEach(asset => {
                const serial = typeof asset === 'string' ? asset : asset?.serial;
                if (serial && !seenSerials.has(serial)) {
                    seenSerials.add(serial);
                    const inv = inventoryAssets?.find(a => a.serial?.toLowerCase() === serial.toLowerCase());
                    const model = (typeof asset === 'object' && asset?.model) || inv?.name || inv?.model || 'Equipo';
                    list.push(`${model}: ${serial}`);
                }
            });

            // Accesorios en la tarea
            const accessories = Array.isArray(task.accessories) ? task.accessories : [];
            if (accessories.length > 0) {
                const accNames = accessories.map(a => a.name || a.model || 'Accesorio').join(', ');
                list.push(`${accessories.length} Accesorios: ${accNames}`);
            } else if (typeof task.accessories === 'object' && task.accessories !== null) {
                const active = Object.entries(task.accessories)
                    .filter(([_, val]) => val === true || val === 'true')
                    .map(([key]) => {
                        if (key === 'backpack') return 'Mochila';
                        if (key === 'screenFilter') return 'Filtro de pantalla';
                        return key.replace(/([A-Z])/g, ' $1').toLowerCase();
                    });
                if (active.length > 0) {
                    list.push(`Accesorios: ${active.join(', ')}`);
                }
            }

            // YubiKeys en la tarea
            const yubikeys = Array.isArray(task.yubikeys) ? task.yubikeys : [];
            if (yubikeys.length > 0) {
                const yubiSerials = yubikeys.map(y => y.serial || 'S/N').join(', ');
                list.push(`${yubikeys.length} YubiKey(s): ${yubiSerials}`);
            }
        });
    }

    // 2. Activos asociados directos en el ticket
    const directAssets = Array.isArray(ticket?.associatedAssets) ? ticket.associatedAssets : [];
    directAssets.forEach(asset => {
        const serial = typeof asset === 'string' ? asset : asset?.serial;
        if (serial && !seenSerials.has(serial)) {
            seenSerials.add(serial);
            const inv = inventoryAssets?.find(a => a.serial?.toLowerCase() === serial.toLowerCase());
            const model = (typeof asset === 'object' && asset?.model) || inv?.name || inv?.model || 'Equipo';
            list.push(`${model}: ${serial}`);
        }
    });

    // 3. Serial único legacy en ticket.associatedAssetSerial
    if (ticket?.associatedAssetSerial && !seenSerials.has(ticket.associatedAssetSerial)) {
        seenSerials.add(ticket.associatedAssetSerial);
        const inv = inventoryAssets?.find(a => a.serial?.toLowerCase() === ticket.associatedAssetSerial.toLowerCase());
        const model = inv?.name || inv?.model || 'Equipo';
        list.push(`${model}: ${ticket.associatedAssetSerial}`);
    }

    // 4. Casos asociados legacy (ticket.associatedCases)
    const cases = Array.isArray(ticket?.associatedCases) ? ticket.associatedCases : [];
    cases.forEach(c => {
        const cAssets = Array.isArray(c?.assets) ? c.assets : [];
        cAssets.forEach(asset => {
            const serial = typeof asset === 'string' ? asset : asset?.serial;
            if (serial && !seenSerials.has(serial)) {
                seenSerials.add(serial);
                const inv = inventoryAssets?.find(a => a.serial?.toLowerCase() === serial.toLowerCase());
                const model = (typeof asset === 'object' && asset?.model) || inv?.name || inv?.model || 'Equipo';
                list.push(`${model}: ${serial}`);
            }
        });
    });

    // 5. Accesorios directos del ticket
    if (!list.some(l => l.toLowerCase().includes('accesorio')) && ticket?.accessories) {
        if (typeof ticket.accessories === 'object') {
            const active = Object.entries(ticket.accessories)
                .filter(([_, val]) => val === true || val === 'true')
                .map(([key]) => {
                    if (key === 'backpack') return 'Mochila';
                    if (key === 'screenFilter') return 'Filtro de pantalla';
                    return key.replace(/([A-Z])/g, ' $1').toLowerCase();
                });
            if (active.length > 0) {
                list.push(`Accesorios: ${active.join(', ')}`);
            }
        }
    }

    return list.length > 0 ? list : ['Sin equipos o activos asignados por el momento'];
};

export default function TicketContentSummaryCard({ ticket, unifiedTasks = [], assets = [] }) {
    if (!ticket) return null;

    const opType = getOperationType(ticket);
    const devices = getDevicesList(ticket, unifiedTasks, assets);

    return (
        <div style={{ 
            padding: '0.85rem 1.25rem', 
            background: 'var(--surface)', 
            borderRadius: '10px',
            border: '1px solid var(--border)',
            borderLeft: '4px solid #3b82f6',
            boxShadow: 'var(--shadow-sm)'
        }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <div style={{ 
                    fontSize: '0.75rem', 
                    fontWeight: 800, 
                    color: 'var(--text-secondary)', 
                    textTransform: 'uppercase', 
                    letterSpacing: '0.05em' 
                }}>
                    Contenido
                </div>
                <div style={{ 
                    fontSize: '0.75rem', 
                    fontWeight: 900, 
                    color: opType.color,
                    backgroundColor: `${opType.color}18`,
                    padding: '2px 8px',
                    borderRadius: '4px',
                    border: `1px solid ${opType.color}44`,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px'
                }}>
                    <span>{opType.icon}</span>
                    <span>{opType.label}</span>
                </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                {devices.map((item, idx) => (
                    <div key={idx} style={{ 
                        fontSize: '0.85rem', 
                        fontWeight: 600, 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: '0.5rem',
                        color: 'var(--text-main)'
                    }}>
                        <div style={{ 
                            width: '4px', 
                            height: '4px', 
                            backgroundColor: '#3b82f6', 
                            borderRadius: '50%', 
                            flexShrink: 0 
                        }} />
                        <span>{item}</span>
                    </div>
                ))}
            </div>
        </div>
    );
}
