/**
 * Utility to resolve service details and calculate financials for a ticket.
 * Centered logic for both Billing and Ticket views.
 */

export const resolveTicketServiceDetails = (ticket, globalAssets, logisticsTasks = []) => {
    if (!ticket) return { moveType: 'Servicio Técnico', assetType: 'Dispositivo', resolvedAsset: null };

    // 1. COLLECT ALL POSSIBLE HARDWARE
    // Check main ticket first
    let hardwareList = [...(ticket.assignedEquipments || []), ...(ticket.associatedAssets || [])];
    if (ticket.associatedAssetSerial) hardwareList.push(ticket.associatedAssetSerial);
    
    // Check associated cases
    if (ticket.associatedCases) {
        ticket.associatedCases.forEach(c => {
            if (c.assets) hardwareList.push(...c.assets);
            if (c.associatedEquipments) hardwareList.push(...c.associatedEquipments);
            if (c.associatedAssetSerial) hardwareList.push(c.associatedAssetSerial);
            if (c.serial) hardwareList.push(c.serial);
        });
    }

    // Clean list (remove nulls/undefined)
    hardwareList = hardwareList.filter(Boolean);

    // 1.1 LOOK IN LOGISTICS TASKS IF EMPTY
    if (hardwareList.length === 0 && Array.isArray(logisticsTasks) && logisticsTasks.length > 0) {
        const relatedTasks = logisticsTasks.filter(task => 
            String(task?.ticketId || task?.ticket_id) === String(ticket?.id)
        );
        relatedTasks.forEach(task => {
            if (task.items) hardwareList.push(task.items);
            if (task.asset_serial || task.assetSerial) hardwareList.push(task.asset_serial || task.assetSerial);
            if (task.serial) hardwareList.push(task.serial);
            if (task.hardware_info || task.hardwareInfo) hardwareList.push(task.hardware_info || task.hardwareInfo);
        });
        hardwareList = hardwareList.filter(Boolean);
    }

    const asset = hardwareList.length > 0 ? hardwareList[0] : null;

    let moveType = 'Servicio Técnico';
    let assetType = 'Dispositivo';
    let resolvedAsset = asset;

    // Use ticket logistics type first as the most reliable source
    if (ticket.logistics?.type) {
        const tType = ticket.logistics.type.toLowerCase();
        if (tType.includes('entrega') || tType.includes('alta')) moveType = 'Entrega';
        else if (tType.includes('recupero') || tType.includes('retiro') || tType.includes('baja') || tType.includes('recolección') || tType.includes('recoleccion')) moveType = 'Recupero';
    }

    // Try to find info in logisticsTasks if moveType is still generic
    if (moveType === 'Servicio Técnico' && Array.isArray(logisticsTasks) && logisticsTasks.length > 0) {
        const relatedTasks = logisticsTasks.filter(task => 
            String(task?.ticket_id || task?.ticketId) === String(ticket?.id)
        );
        const taskWithType = relatedTasks.find(task => task.type);
        if (taskWithType) {
            const tType = taskWithType.type.toLowerCase();
            if (tType.includes('entrega') || tType.includes('alta')) moveType = 'Entrega';
            else if (tType.includes('recupero') || tType.includes('retiro') || tType.includes('baja')) moveType = 'Recupero';
        }
    }

    if (asset && globalAssets) {
        const serial = (typeof asset === 'string') ? asset : asset.serial;
        if (serial) {
            const match = globalAssets.find(a => a.serial.toLowerCase() === serial.toLowerCase());
            if (match) {
                if (typeof asset === 'object') {
                    resolvedAsset = { ...match, ...asset, hardwareType: match.type || match.hardwareType || match.deviceType };
                } else {
                    resolvedAsset = match;
                }
            } else if (typeof asset === 'string') {
                // If serial found but no global asset match, create a placeholder
                resolvedAsset = { serial: serial, name: 'Dispositivo Desconocido' };
            }
        }
    }

    if (resolvedAsset && typeof resolvedAsset === 'object') {
        const isMoveWord = (str) => str && ['entrega', 'recupero', 'devolucion', 'alta', 'baja', 'movement', 'retiro'].some(k => str.toLowerCase().includes(k));

        if (moveType === 'Servicio Técnico') {
            if (resolvedAsset.movementType && isMoveWord(resolvedAsset.movementType)) {
                moveType = resolvedAsset.movementType;
            } else if (resolvedAsset.tipoMovimiento && isMoveWord(resolvedAsset.tipoMovimiento)) {
                moveType = resolvedAsset.tipoMovimiento;
            } else if (isMoveWord(resolvedAsset.type)) {
                moveType = resolvedAsset.type;
            }
        }

        const cleanType = (!isMoveWord(resolvedAsset.type) && resolvedAsset.type) ? resolvedAsset.type : null;
        assetType = resolvedAsset.hardware_type || resolvedAsset.hardwareType || resolvedAsset.deviceType || resolvedAsset.tipoDispositivo || cleanType || resolvedAsset.name || resolvedAsset.description || 'Dispositivo';
    } else if (resolvedAsset && typeof resolvedAsset === 'string') {
        assetType = resolvedAsset; // Use the string directly as type/name
    } 

    // Fallback if moveType is still generic
    if (moveType === 'Servicio Técnico') {
        const subj = String(ticket.subject || '').toLowerCase();
        const classif = String(ticket.classification || '').toLowerCase();
        if (subj.includes('entrega') || subj.includes('alta') || classif.includes('entrega')) moveType = 'Entrega';
        else if (subj.includes('recupero') || subj.includes('baja') || subj.includes('retiro') || classif.includes('recupero')) moveType = 'Recupero';
    }

    // fallback for generic names or empty names
    if (assetType === 'Dispositivo' || assetType === 'Sin Nombre' || assetType === 'N/A' || !assetType || assetType.length < 3) {
        const subj = (ticket.subject || '').toLowerCase() + ' ' + (ticket.classification || '').toLowerCase();
        if (subj.includes('laptop') || subj.includes('notebook') || subj.includes('macbook') || subj.includes('equipo') || subj.includes('pc') || subj.includes('mbp')) assetType = 'Laptop';
        else if (subj.includes('smartphone') || subj.includes('celular') || subj.includes('iphone') || subj.includes('samsung') || subj.includes('moto')) assetType = 'Smartphone';
        else if (subj.includes('key') || subj.includes('yubikey') || subj.includes('llave')) assetType = 'Yubikey';
    }

    // Secondary fallback using the asset names directly if they contain keywords
    if (assetType.toLowerCase() === 'dispositivo' && typeof resolvedAsset === 'string') {
        const lowerAsset = resolvedAsset.toLowerCase();
        if (lowerAsset.includes('laptop') || lowerAsset.includes('notebook') || lowerAsset.includes('macbook') || lowerAsset.includes('mbp') || lowerAsset.includes('mac')) assetType = 'Laptop';
        else if (lowerAsset.includes('phone') || lowerAsset.includes('celular') || lowerAsset.includes('iphone')) assetType = 'Smartphone';
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

    const { moveType, assetType, resolvedAsset } = resolveTicketServiceDetails(ticket, globalAssets, logisticsTasks);

    let serviceRevenue = 0;
    let logisticRevenue = 0;
    let logisticCost = 0;
    let operationalCost = 0;

    const isDelivery = moveType.toLowerCase().includes('entrega') || moveType.toLowerCase().includes('alta');
    const isRecovery = moveType.toLowerCase().includes('recupero') || moveType.toLowerCase().includes('retiro') || moveType.toLowerCase().includes('baja') || moveType.toLowerCase().includes('recolección');
    const isWarranty = ticket.subject?.toLowerCase().includes('garantía') || ticket.subject?.toLowerCase().includes('warranty') || ticket.classification === 'Garantía';

    const lowerDevice = (assetType || '').toLowerCase();
    const isLaptop = lowerDevice.includes('laptop') || lowerDevice.includes('notebook') || lowerDevice.includes('macbook') || lowerDevice.includes('mbp') || lowerDevice.includes('mac');
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
    let deliveryPerson = (ticket.logistics?.deliveryPerson || ticket.logistics?.delivery_person || ticket.delivery_person || '').trim();
    let moveTypeOverride = moveType;

    // If main ticket logistics are empty, try finding info in sub-tasks/cases
    if ((method === 'N/A' || !deliveryPerson) && (logisticsTasks.length > 0 || ticket.associatedCases)) {
        let relatedTasks = [];
        
        // Find in logisticsTasks store
        if (logisticsTasks.length > 0) {
            relatedTasks = logisticsTasks.filter(task => String(task.ticketId) === String(ticket.id) || String(task.ticket_id) === String(ticket.id));
            if (relatedTasks.length === 0 && ticket.associatedCases) {
                const caseNumbers = ticket.associatedCases.map(c => String(c.caseNumber));
                relatedTasks = logisticsTasks.filter(task => 
                    caseNumbers.includes(String(task.case_number)) || caseNumbers.includes(String(task.ticketId))
                );
            }
        }

        // Also check if info is embedded in associatedCases (local state)
        if (relatedTasks.length === 0 && ticket.associatedCases) {
            relatedTasks = ticket.associatedCases.filter(c => (c.method && c.method !== 'N/A') || c.delivery_person || c.deliveryPerson);
        }

        if (relatedTasks.length > 0) {
            // Find the first one with a person assigned, if any
            const taskWithPerson = relatedTasks.find(t => t.deliveryPerson || t.delivery_person || t.assigned_to || t.assignedTo);
            const firstTask = taskWithPerson || relatedTasks[0];
            
            if (method === 'N/A' && firstTask.method) method = firstTask.method;
            if (!deliveryPerson) deliveryPerson = (firstTask.deliveryPerson || firstTask.delivery_person || firstTask.assigned_to || firstTask.assignedTo || '').trim();
            
            // If movement type was generic in ticket, but found in task
            if (moveType === 'Servicio Técnico' && firstTask.type) {
                const tType = firstTask.type.toLowerCase();
                if (tType.includes('entrega') || tType.includes('alta')) moveTypeOverride = 'Entrega';
                else if (tType.includes('recupero') || tType.includes('retiro') || tType.includes('baja')) moveTypeOverride = 'Recupero';
            }
        }
    }

    // FINAL RE-VALUATION OF INCOME BASED ON RESOLVED DATA
    // (If we found a better moveType or assetType via tasks)
    const finalIsDelivery = moveTypeOverride.toLowerCase().includes('entrega') || moveTypeOverride.toLowerCase().includes('alta');
    const finalIsRecovery = moveTypeOverride.toLowerCase().includes('recupero') || moveTypeOverride.toLowerCase().includes('retiro') || moveTypeOverride.toLowerCase().includes('baja');
    
    // Refresh classification if needed
    const lowerDevice = (assetType || '').toLowerCase();
    const finalIsLaptop = lowerDevice.includes('laptop') || lowerDevice.includes('notebook') || lowerDevice.includes('macbook') || lowerDevice.includes('mbp');
    const finalIsPhone = lowerDevice.includes('smartphone') || lowerDevice.includes('celular') || lowerDevice.includes('iphone');
    const finalIsKey = lowerDevice.includes('key') || lowerDevice.includes('yubikey');

    if (isWarranty) {
        serviceRevenue = getRate(rates?.service_Warranty, rates?.warrantyService, 60);
    } else if (finalIsLaptop) {
        if (finalIsDelivery) serviceRevenue = getRate(rates?.service_Laptop_Delivery, rates?.laptopService, 25);
        else if (finalIsRecovery) serviceRevenue = getRate(rates?.service_Laptop_Recovery, rates?.laptopService, 25);
        else serviceRevenue = getRate(rates?.laptopService, null, 25);
    } else if (finalIsPhone) {
        if (finalIsDelivery) serviceRevenue = getRate(rates?.service_Smartphone_Delivery, rates?.smartphoneService, 5);
        else if (finalIsRecovery) serviceRevenue = getRate(rates?.service_Smartphone_Recovery, rates?.smartphoneService, 5);
        else serviceRevenue = getRate(rates?.smartphoneService, null, 5);
    } else if (finalIsKey) {
        if (finalIsDelivery) serviceRevenue = getRate(rates?.service_Key_Delivery, rates?.securityKeyService, 5);
        else if (finalIsRecovery) serviceRevenue = getRate(rates?.service_Key_Recovery, rates?.securityKeyService, 5);
        else serviceRevenue = getRate(rates?.securityKeyService, null, 5);
    }

    if (method === 'Repartidor Propio' || method === 'Envío Interno' || method.includes('Propio') || method.toLowerCase().includes('local')) {
        logisticRevenue = getRate(rates?.logistics_Internal_Revenue, rates?.internalDeliveryRevenue, 20);
        
        let baseCommission = getRate(rates?.cost_Driver_Commission, rates?.driverCommission, 15);
        let extra = 0;

        const dLower = deliveryPerson.toLowerCase();
        
        // Flexible matching: find user whose name is in the ticket field, or vice versa
        const matchedUser = users.find(u => {
            if (!u.name) return false;
            const uNameLower = u.name.toLowerCase().trim();
            const dpLower = deliveryPerson.toLowerCase().trim();
            return dpLower === uNameLower || dpLower.includes(uNameLower) || uNameLower.includes(dpLower);
        });
        
        if (matchedUser && matchedUser.name) {
            const moveKey = finalIsDelivery ? 'Delivery' : (finalIsRecovery ? 'Recovery' : null);
            // Ensure we use the standard keys: Laptop, Smartphone, Yubikey
            const deviceKey = finalIsLaptop ? 'Laptop' : (finalIsPhone ? 'Smartphone' : (finalIsKey ? 'Yubikey' : null));
            
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
        moveType: moveTypeOverride,
        assetType,
        method,
        deliveryPerson
    };
};
