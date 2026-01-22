// Helper to consistently resolve Service Details (Movement & Device Type)
// Matches the logic used in the Service Summary modal
export const resolveTicketServiceDetails = (ticket, globalAssets) => {
    if (!ticket) return { moveType: 'Servicio Técnico', assetType: 'Dispositivo', resolvedAsset: null };

    const asset = (ticket.associatedAssets && ticket.associatedAssets.length > 0) ? ticket.associatedAssets[0] : null;
    let moveType = 'Servicio Técnico';
    let assetType = 'Dispositivo';

    let resolvedAsset = asset;
    if (asset && globalAssets) {
        const serial = (typeof asset === 'string') ? asset : asset.serial;
        if (serial) {
            const match = globalAssets.find(a => a.serial === serial);
            if (match) {
                // Careful Merge: Ticket data (movement) overrides Global (hardware), 
                // but we preserve Global 'type' as 'hardwareType' to not lose it.
                if (typeof asset === 'object') {
                    resolvedAsset = { ...match, ...asset, hardwareType: match.type };
                } else {
                    resolvedAsset = match;
                }
            }
        }
    }

    if (resolvedAsset && typeof resolvedAsset === 'object') {
        const isMoveWord = (str) => str && ['entrega', 'recupero', 'devolucion', 'alta', 'baja', 'movement', 'retiro'].some(k => str.toLowerCase().includes(k));

        // --- 1. DETERMINE MOVEMENT ---
        // Check explicit movement fields first, then fallback to 'type' if it looks like a movement
        if (resolvedAsset.movementType && isMoveWord(resolvedAsset.movementType)) {
            moveType = resolvedAsset.movementType;
        } else if (resolvedAsset.tipoMovimiento && isMoveWord(resolvedAsset.tipoMovimiento)) {
            moveType = resolvedAsset.tipoMovimiento;
        } else if (isMoveWord(resolvedAsset.type)) {
            moveType = resolvedAsset.type;
        } else {
            // Fallback to Ticket Subject/Logistics context
            const subDelivery = ticket.subject?.toLowerCase().includes('entrega') || ticket.classification?.toLowerCase().includes('entrega') || ticket.subject?.toLowerCase().includes('alta') || ticket.logistics?.type === 'Entrega';
            const subRecovery = ticket.subject?.toLowerCase().includes('recupero') || ticket.classification?.toLowerCase().includes('recupero') || ticket.subject?.toLowerCase().includes('baja') || ticket.subject?.toLowerCase().includes('retiro') || ticket.logistics?.type === 'Recupero';
            moveType = subDelivery ? 'Entrega' : (subRecovery ? 'Recupero' : 'Servicio Técnico');
        }

        // --- 2. DETERMINE DEVICE ---
        // Check explicit device fields first, then fallback to 'type' if it looks like a device (NOT a movement)
        const cleanType = (!isMoveWord(resolvedAsset.type) && resolvedAsset.type) ? resolvedAsset.type : null;

        assetType = resolvedAsset.deviceType ||
            resolvedAsset.tipoDispositivo ||
            resolvedAsset.hardwareType ||
            cleanType ||
            resolvedAsset.name ||
            resolvedAsset.description ||
            'Dispositivo';
    } else if (asset && typeof asset === 'string') {
        assetType = asset; // Fallback string
        // Try to resolve string asset against global too (though usually object)
        const match = globalAssets ? globalAssets.find(a => a.serial === asset) : null;
        if (match && match.type) assetType = match.type;

        if (ticket.subject?.toLowerCase().includes('entrega') || ticket.subject?.toLowerCase().includes('alta')) moveType = 'Entrega';
        else if (ticket.subject?.toLowerCase().includes('recupero') || ticket.subject?.toLowerCase().includes('baja') || ticket.subject?.toLowerCase().includes('retiro')) moveType = 'Recupero';
    } else {
        if (ticket.subject?.toLowerCase().includes('entrega') || ticket.subject?.toLowerCase().includes('alta')) moveType = 'Entrega';
        else if (ticket.subject?.toLowerCase().includes('recupero') || ticket.subject?.toLowerCase().includes('baja') || ticket.subject?.toLowerCase().includes('retiro')) moveType = 'Recupero';
    }

    // Fallback: If device is generic, check subject for clues
    if (assetType === 'Dispositivo' || assetType === 'N/A' || !assetType) {
        const subj = (ticket.subject || '').toLowerCase() + ' ' + (ticket.classification || '').toLowerCase();
        if (subj.includes('laptop') || subj.includes('notebook') || subj.includes('macbook') || subj.includes('equipo') || subj.includes('pc')) assetType = 'Laptop';
        else if (subj.includes('smartphone') || subj.includes('celular') || subj.includes('iphone') || subj.includes('samsung') || subj.includes('moto')) assetType = 'Smartphone';
        else if (subj.includes('key') || subj.includes('yubikey') || subj.includes('llave')) assetType = 'Key';
    }

    return { moveType, assetType, resolvedAsset };
};

// Helper to safely get rate
export const getRate = (primary, secondary, def) => {
    if (primary !== undefined && primary !== null && primary !== '') return parseFloat(primary);
    if (secondary !== undefined && secondary !== null && secondary !== '') return parseFloat(secondary);
    return def;
};
