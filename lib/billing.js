/**
 * Utility to resolve service details and calculate financials for a ticket.
 * Centered logic for both Billing and Ticket views.
 */

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

        if (resolvedAsset.movementType && isMoveWord(resolvedAsset.movementType)) {
            moveType = resolvedAsset.movementType;
        } else if (resolvedAsset.tipoMovimiento && isMoveWord(resolvedAsset.tipoMovimiento)) {
            moveType = resolvedAsset.tipoMovimiento;
        } else if (isMoveWord(resolvedAsset.type)) {
            moveType = resolvedAsset.type;
        } else {
            const subj = String(ticket.subject || '').toLowerCase();
            const classif = String(ticket.classification || '').toLowerCase();
            const logType = String(ticket.logistics?.type || '').toLowerCase();
            
            const subDelivery = subj.includes('entrega') || classif.includes('entrega') || subj.includes('alta') || logType === 'entrega';
            const subRecovery = subj.includes('recupero') || classif.includes('recupero') || subj.includes('baja') || subj.includes('retiro') || logType === 'recupero';
            moveType = subDelivery ? 'Entrega' : (subRecovery ? 'Recupero' : 'Servicio Técnico');
        }

        const cleanType = (!isMoveWord(resolvedAsset.type) && resolvedAsset.type) ? resolvedAsset.type : null;
        assetType = resolvedAsset.deviceType || resolvedAsset.tipoDispositivo || resolvedAsset.hardwareType || cleanType || resolvedAsset.name || resolvedAsset.description || 'Dispositivo';
    } else {
        const subj = String(ticket.subject || '').toLowerCase();
        if (subj.includes('entrega') || subj.includes('alta')) moveType = 'Entrega';
        else if (subj.includes('recupero') || subj.includes('baja') || subj.includes('retiro')) moveType = 'Recupero';
    }

    // fallback for generic names or empty names
    if (assetType === 'Dispositivo' || assetType === 'Sin Nombre' || assetType === 'N/A' || !assetType) {
        const subj = (ticket.subject || '').toLowerCase() + ' ' + (ticket.classification || '').toLowerCase();
        if (subj.includes('laptop') || subj.includes('notebook') || subj.includes('macbook') || subj.includes('equipo') || subj.includes('pc')) assetType = 'Laptop';
        else if (subj.includes('smartphone') || subj.includes('celular') || subj.includes('iphone') || subj.includes('samsung') || subj.includes('moto')) assetType = 'Smartphone';
        else if (subj.includes('key') || subj.includes('yubikey') || subj.includes('llave')) assetType = 'Yubikey';
    }

    return { moveType, assetType, resolvedAsset };
};

export const getRate = (primary, secondary, def) => {
    if (primary !== undefined && primary !== null && primary !== '') return parseFloat(primary);
    if (secondary !== undefined && secondary !== null && secondary !== '') return parseFloat(secondary);
    return def;
};

export const calculateTicketFinancials = (ticket, rates, globalAssets, users = [], logisticsTasks = []) => {
    if (!ticket) return null;

    const { moveType, assetType } = resolveTicketServiceDetails(ticket, globalAssets);

    let serviceRevenue = 0;
    let logisticRevenue = 0;
    let logisticCost = 0;
    let operationalCost = 0;

    const isDelivery = moveType.toLowerCase().includes('entrega') || moveType.toLowerCase().includes('alta');
    const isRecovery = moveType.toLowerCase().includes('recupero') || moveType.toLowerCase().includes('retiro') || moveType.toLowerCase().includes('baja');
    const isWarranty = ticket.subject?.toLowerCase().includes('garantía') || ticket.subject?.toLowerCase().includes('warranty') || ticket.classification === 'Garantía';

    const lowerDevice = (assetType || '').toLowerCase();
    const isLaptop = lowerDevice.includes('laptop') || lowerDevice.includes('notebook') || lowerDevice.includes('macbook');
    const isPhone = lowerDevice.includes('smartphone') || lowerDevice.includes('celular') || lowerDevice.includes('iphone');
    const isKey = lowerDevice.includes('key') || lowerDevice.includes('yubikey');

    // Service Rate Calculation
    if (isWarranty) {
        serviceRevenue = getRate(rates?.service_Warranty, rates?.warrantyService, 60);
    } else if (isLaptop) {
        if (isDelivery) serviceRevenue = getRate(rates?.service_Laptop_Delivery, rates?.laptopService, 25);
        else if (isRecovery) serviceRevenue = getRate(rates?.service_Laptop_Recovery, rates?.laptopService, 25);
        else serviceRevenue = getRate(rates?.laptopService, null, 25);
    } else if (isPhone) {
        if (isDelivery) serviceRevenue = getRate(rates?.service_Smartphone_Delivery, rates?.smartphoneService, 5);
        else if (isRecovery) serviceRevenue = getRate(rates?.service_Smartphone_Recovery, rates?.smartphoneService, 5);
        else serviceRevenue = getRate(rates?.smartphoneService, null, 5);
    } else if (isKey) {
        if (isDelivery) serviceRevenue = getRate(rates?.service_Key_Delivery, rates?.securityKeyService, 5);
        else if (isRecovery) serviceRevenue = getRate(rates?.service_Key_Recovery, rates?.securityKeyService, 5);
        else serviceRevenue = getRate(rates?.securityKeyService, null, 5);
    } else {
        serviceRevenue = 5; // Default base
    }

    // Logistics Logic
    let method = ticket.logistics?.method || 'N/A';
    let deliveryPerson = (ticket.logistics?.deliveryPerson || '').trim();

    // If main ticket logistics are empty, try finding info in sub-tasks
    if ((method === 'N/A' || !deliveryPerson) && logisticsTasks.length > 0) {
        const relatedTasks = logisticsTasks.filter(task => task.ticketId === ticket.id);
        if (relatedTasks.length > 0) {
            const firstTask = relatedTasks[0];
            if (method === 'N/A' && firstTask.method) method = firstTask.method;
            if (!deliveryPerson && firstTask.deliveryPerson) deliveryPerson = firstTask.deliveryPerson;
        }
    }

    if (method === 'Repartidor Propio' || method === 'Envío Interno' || method.includes('Propio')) {
        logisticRevenue = getRate(rates?.logistics_Internal_Revenue, rates?.internalDeliveryRevenue, 20);
        
        let baseCommission = getRate(rates?.cost_Driver_Commission, rates?.driverCommission, 15);
        let extra = 0;

        const dLower = deliveryPerson.toLowerCase();
        
        // Flexible matching: find user whose name is in the ticket field, or vice versa
        const matchedUser = users.find(u => {
            if (!u.name) return false;
            const uNameLower = u.name.toLowerCase().trim();
            return dLower === uNameLower || dLower.includes(uNameLower) || uNameLower.includes(dLower);
        });
        
        if (matchedUser && matchedUser.name) {
            const moveKey = isDelivery ? 'Delivery' : (isRecovery ? 'Recovery' : null);
            // Ensure we use the standard keys: Laptop, Smartphone, Yubikey
            const deviceKey = isLaptop ? 'Laptop' : (isPhone ? 'Smartphone' : (isKey ? 'Yubikey' : null));
            
            if (moveKey && deviceKey) {
                // Try the structured key first
                const rateKey = `driverExtra_${matchedUser.name.trim()}_${moveKey}_${deviceKey}`;
                extra = parseFloat(rates?.[rateKey] || 0);
            }
        }
        logisticCost = baseCommission + extra;
    } else if (method === 'Andreani' || method === 'Correo Argentino' || method.includes('Correo')) {
        const postalCost = parseFloat(ticket.logistics?.cost || 0);
        const baseCost = postalCost > 0 ? postalCost : getRate(rates?.cost_Postal_Base, rates?.postalBaseCost, 12);
        const markup = getRate(rates?.logistics_Postal_Markup, rates?.postalServiceMarkup, 5);
        logisticRevenue = baseCost + markup;
        logisticCost = baseCost;
    }

    // Accessories
    if (ticket.accessories) {
        const accCount = Object.values(ticket.accessories).filter(v => v === true).length;
        operationalCost = accCount * 1.5;
    }

    const totalRevenue = serviceRevenue + logisticRevenue;
    const totalCost = logisticCost + operationalCost;
    const profit = totalRevenue - totalCost;

    return {
        serviceRevenue,
        logisticRevenue,
        logisticCost,
        operationalCost,
        totalRevenue,
        totalCost,
        profit,
        moveType,
        assetType,
        method,
        deliveryPerson
    };
};
