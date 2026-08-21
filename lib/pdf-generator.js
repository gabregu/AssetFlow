import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import QRCode from 'qrcode';

const cleanText = (text) => {
    if (!text) return '';
    // Mapa de reemplazos explícitos para mayor confiabilidad en reportes/PDF
    const map = {
        'á': 'a', 'é': 'e', 'í': 'i', 'ó': 'o', 'ú': 'u',
        'Á': 'A', 'É': 'E', 'Í': 'I', 'Ó': 'O', 'Ú': 'U',
        'ñ': 'n', 'Ñ': 'N',
        'ü': 'u', 'Ü': 'U'
    };
    return text.split('').map(char => map[char] || char).join('')
        .normalize('NFD') // Por si queda alguno raro
        .replace(/[\u0300-\u036f]/g, '');
};

export const generateTicketPDF = (ticket, assets, deliveryData = null, action = 'download') => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();

    // ... (rest of the content remains the same until save) ...

    // --- Header ---
    doc.setFontSize(22);
    doc.setFont('helvetica', 'bold');
    doc.text('ENTREGA / RECUPERO', 20, 25);
    doc.text('de activos', 20, 35);

    // --- Top Right Service Box ---
    const isSFDC = /SFDC/i.test(ticket?.client || '');
    let sfdcId = '';
    
    // Extract Case ID from subject
    const subjectMatch = isSFDC 
        ? (ticket.subject?.match(/SFDC-[A-Z0-9]+/i) || ticket.subject?.match(/SFDC-\d+/i))
        : ticket.subject?.match(/^\[([^\]]+)\]/);
        
    if (subjectMatch) {
        sfdcId = isSFDC ? subjectMatch[0] : subjectMatch[1];
    } else {
        sfdcId = ticket.caseNumber || ticket.case_number || ticket.id_sf || ticket.logistics?.additionalCase || '';
    }

    if (!sfdcId && ticket.associatedCases && ticket.associatedCases.length > 0) {
        const firstCase = ticket.associatedCases.find(c => c.caseNumber && c.caseNumber !== 'Caso Principal');
        if (firstCase) {
            sfdcId = firstCase.caseNumber;
        }
    }

    if (!sfdcId) {
        sfdcId = '-';
    } else if (sfdcId !== '-' && isSFDC && !sfdcId.toUpperCase().startsWith('SFDC-') && /^\d+$/.test(sfdcId)) {
        sfdcId = `SFDC-${sfdcId}`;
    }

    const agreedDate = ticket.logistics?.date || ticket.logistics?.datetime?.split('T')[0] || deliveryData?.date || (ticket.deliveryCompletedDate ? String(ticket.deliveryCompletedDate).split('T')[0] : '-');
    const agreedTimeSlot = ticket.logistics?.timeSlot || ticket.logistics?.time_slot || deliveryData?.timeSlot || 'AM';

    autoTable(doc, {
        startY: 15,
        margin: { left: pageWidth - 90 },
        tableWidth: 70,
        body: [
            ['Servicio número:', ticket.id || '-'],
            ['Caso:', sfdcId],
            ['Fecha Acordada:', agreedDate],
            ['Turno:', agreedTimeSlot]
        ],
        theme: 'grid',
        styles: { fontSize: 8, cellPadding: 2 },
        columnStyles: { 0: { fontStyle: 'normal', halign: 'right', cellWidth: 35 } }
    });

    // --- Case Description (Moved below Header) ---
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('Descripción del Caso:', 20, 48);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    
    let subjectText = ticket.subject || '';
    if (sfdcId && sfdcId !== '-' && !subjectText.toUpperCase().includes(sfdcId.toUpperCase())) {
        subjectText = `[${sfdcId}] ${subjectText}`;
    }
    subjectText = cleanText(subjectText);
    
    const splitSubject = doc.splitTextToSize(subjectText, pageWidth - 40);
    doc.text(splitSubject, 20, 54);

    let currentY = 54 + (splitSubject.length * 5) + 5;
    doc.setLineWidth(0.5);
    doc.line(20, currentY - 2, pageWidth - 20, currentY - 2);

    // --- Information Tables ---
    const driverName = cleanText(
        deliveryData?.deliveryPerson || 
        deliveryData?.delivery_person || 
        ticket.logistics?.deliveryPerson || 
        ticket.logistics?.delivery_person || 
        ticket.delivery_person || 
        ticket.deliveryDetails?.deliveryPerson || 
        ticket.deliveryPerson || 
        '-'
    );
    const requesterName = cleanText(ticket.requester || deliveryData?.requester || '-');
    const contactPhone = ticket.logistics?.phone || deliveryData?.phone || ticket.deliveryDetails?.contactPhone || '-';
    const trackingNum = ticket.logistics?.trackingNumber || ticket.logistics?.tracking_number || deliveryData?.trackingNumber || deliveryData?.tracking_number || '-';
    const contactEmail = ticket.logistics?.email || deliveryData?.email || '-';
    const contactAddress = cleanText(
        (ticket.logistics?.address || deliveryData?.address || '') + 
        (ticket.logistics?.floorDept || deliveryData?.floorDept ? `, ${ticket.logistics?.floorDept || deliveryData?.floorDept}` : '')
    ) || '-';

    autoTable(doc, {
        startY: currentY,
        head: [[
            { content: 'Información de Contacto', colSpan: 2, styles: { halign: 'center' } },
            { content: 'Información del Repartidor', colSpan: 2, styles: { halign: 'center' } }
        ]],
        body: [
            ['Solicitante:', requesterName, 'Nombre del Repartidor:', driverName],
            ['Teléfono:', contactPhone, 'Numero de Rastreo:', trackingNum],
            ['Correo:', contactEmail, '', ''],
            ['Dirección:', { 
                content: contactAddress, 
                colSpan: 3 
            }]
        ],
        theme: 'grid',
        headStyles: { fillColor: [80, 80, 80], textColor: [255, 255, 255], halign: 'center' },
        styles: { fontSize: 9, cellPadding: 3 },
        columnStyles: {
            0: { fontStyle: 'bold', cellWidth: 30 },
            1: { cellWidth: (pageWidth - 40 - 60) / 2 },
            2: { fontStyle: 'bold', cellWidth: 40 },
            3: { cellWidth: (pageWidth - 40 - 60) / 2 }
        }
    });

    currentY = doc.lastAutoTable.finalY + 5;

    // --- Assets List Table ---
    const taskRows = [];
    const rawAssetList = [
        ...(ticket.associatedAssets || []),
        ...(ticket.associated_assets || []),
        ...(ticket.assets || []),
        ...(deliveryData?.assets || [])
    ];
    
    // Deduplicate assets
    const seenSerials = new Set();
    const consolidatedAssets = [];
    rawAssetList.forEach(item => {
        if (!item) return;
        const s = typeof item === 'string' ? item : (item.serial || item.id);
        if (s && !seenSerials.has(s)) {
            seenSerials.add(s);
            consolidatedAssets.push(item);
        } else if (!s) {
            consolidatedAssets.push(item);
        }
    });

    consolidatedAssets.forEach(item => {
        const serial = typeof item === 'string' ? item : (item.serial || '-');
        const type = typeof item === 'string' ? (ticket.logistics?.type || '') : (item.type || ticket.logistics?.type || '');
        const typeLabel = (type === 'Recupero' || type === 'collection' || type === 'retiro') ? 'RETIRO' : 'ENTREGA';
        const foundAsset = assets?.find(a => a.serial === serial || a.id === serial);
        const deviceType = cleanText(foundAsset?.type || (typeof item === 'object' ? item.deviceType || item.model : null) || 'Hardware');
        const desc = cleanText(foundAsset?.name || (typeof item === 'object' ? item.name || item.description : null) || '-');
        taskRows.push([typeLabel, deviceType, desc, serial]);
    });

    // Accessories
    const commonTypeLabel = (ticket.logistics?.type === 'Recupero' ? 'RETIRO' : 'ENTREGA');
    const legacyKeys = ['backpack', 'screenFilter', 'filterSize', 'mouse', 'keyboard', 'headset', 'charger'];
    const accObj = { ...(ticket.accessories || {}), ...(deliveryData?.accessories || {}) };
    const customKeys = Object.keys(accObj).filter(k => !legacyKeys.includes(k) && accObj[k] === true);
    const hasSpecificBackpack = customKeys.some(k => k.toLowerCase().includes('mochila') || k.toLowerCase().includes('backpack') || k.toLowerCase().includes('targus') || k.toLowerCase().includes('samsonite'));
    const hasSpecificFilter = customKeys.some(k => k.toLowerCase().includes('filtro') || k.toLowerCase().includes('filter') || k.toLowerCase().includes('bp140') || k.toLowerCase().includes('privacidad'));

    if (accObj.backpack && !hasSpecificBackpack) taskRows.push([commonTypeLabel, 'Accesorio', 'Mochila Técnica', '-']);
    if (accObj.screenFilter && !hasSpecificFilter) taskRows.push([commonTypeLabel, 'Accesorio', `Filtro de Pantalla ${accObj.filterSize || ''}`.trim(), '-']);
    if (accObj.mouse) taskRows.push([commonTypeLabel, 'Accesorio', 'Mouse Óptico', '-']);
    if (accObj.keyboard) taskRows.push([commonTypeLabel, 'Accesorio', 'Teclado USB', '-']);
    if (accObj.headset) taskRows.push([commonTypeLabel, 'Accesorio', 'Auriculares con Micrófono', '-']);
    if (accObj.charger) taskRows.push([commonTypeLabel, 'Accesorio', 'Cargador Original', '-']);

    customKeys.forEach(key => {
        taskRows.push([commonTypeLabel, 'Accesorio', cleanText(key), '-']);
    });

    // YubiKeys
    const ykList = [...(ticket.yubikeys || []), ...(deliveryData?.yubikeys || [])];
    if (ykList.length > 0) {
        ykList.forEach(yk => {
            const ykTypeLabel = yk.type === 'Recupero' ? 'RETIRO' : 'ENTREGA';
            taskRows.push([ykTypeLabel, 'Security Key', 'YubiKey (Hardware Key)', yk.serial || '-']);
        });
    }

    autoTable(doc, {
        startY: currentY,
        head: [[{ content: 'LISTA DE ACTIVOS ASOCIADOS AL SERVICIO', colSpan: 4, styles: { halign: 'left', fillColor: [60, 60, 60] } }], ['Tipo de Movimiento', 'Tipo de Dispositivo', 'Descripción', 'Serie']],
        body: taskRows.length > 0 ? taskRows : [['-', '-', 'No hay activos registrados', '-']],
        theme: 'grid',
        headStyles: { fillColor: [80, 80, 80], textColor: [255, 255, 255] },
        styles: { fontSize: 7, cellPadding: 1 },
        columnStyles: {
            0: { cellWidth: 40 },
            1: { cellWidth: 40 },
            3: { cellWidth: 40 }
        }
    });

    // --- Notes ---
    currentY = doc.lastAutoTable.finalY + 10;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('NOTAS Adicionales :', 20, currentY);
    doc.line(20, currentY + 10, pageWidth - 20, currentY + 10);

    let notesHeight = 0;
    const notesText = deliveryData?.notes || ticket.deliveryDetails?.notes || ticket.logistics?.deliveryInfo?.notes || ticket.logistics?.delivery_info?.notes || '';
    if (notesText) {
        doc.setFont('helvetica', 'normal');
        doc.text(cleanText(notesText), 20, currentY + 7, { maxWidth: pageWidth - 40 });
        notesHeight = 15;
    }

    // --- Footer Table (Signature) ---
    const recipientName = cleanText(
        deliveryData?.receivedBy || 
        deliveryData?.received_by || 
        ticket.logistics?.deliveryInfo?.receivedBy || 
        ticket.logistics?.deliveryInfo?.received_by || 
        ticket.logistics?.delivery_info?.receivedBy || 
        ticket.logistics?.delivery_info?.received_by || 
        ticket.deliveryDetails?.receivedBy || 
        ticket.deliveryDetails?.received_by || 
        ''
    );

    const recipientDni = cleanText(
        deliveryData?.dni || 
        ticket.logistics?.deliveryInfo?.dni || 
        ticket.logistics?.delivery_info?.dni || 
        ticket.deliveryDetails?.dni || 
        ''
    );

    const deliveredDateStr = (() => {
        const rawDate = 
            deliveryData?.deliveredDate || 
            deliveryData?.deliveredAt || 
            ticket.logistics?.deliveryInfo?.deliveredDate || 
            ticket.logistics?.deliveryInfo?.deliveredAt || 
            ticket.logistics?.delivery_info?.deliveredDate || 
            ticket.logistics?.delivery_info?.deliveredAt || 
            ticket.deliveryDetails?.deliveredDate || 
            ticket.deliveryDetails?.deliveredAt || 
            ticket.deliveryCompletedDate;
        if (!rawDate) return '-';
        try {
            if (typeof rawDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(rawDate.trim())) {
                const [yyyy, mm, dd] = rawDate.trim().split('-');
                return `${parseInt(dd)}/${parseInt(mm)}/${yyyy}`;
            }
            const dateObj = rawDate.toDate ? rawDate.toDate() : new Date(rawDate);
            if (isNaN(dateObj.getTime())) return String(rawDate).split('T')[0];
            const d = String(dateObj.getDate());
            const m = String(dateObj.getMonth() + 1);
            const y = dateObj.getFullYear();
            return `${d}/${m}/${y}`;
        } catch (e) {
            return String(rawDate).split('T')[0];
        }
    })();

    const deliveredTimeStr = cleanText(
        deliveryData?.actualTime || 
        deliveryData?.time || 
        ticket.logistics?.deliveryInfo?.actualTime || 
        ticket.logistics?.deliveryInfo?.time || 
        ticket.logistics?.delivery_info?.actualTime || 
        ticket.logistics?.delivery_info?.time || 
        ticket.deliveryDetails?.actualTime || 
        ticket.deliveryDetails?.time || 
        ''
    );

    const footerY = Math.max(225, currentY + notesHeight + 15);
    autoTable(doc, {
        startY: footerY,
        tableWidth: 90,
        body: [
            ['Persona que entregó o recibió:', { 
                content: recipientName,
                styles: { fontStyle: 'bold', fontSize: 11, textColor: [0, 0, 0] }
            }],
            ['DNI:', { 
                content: recipientDni,
                styles: { fontStyle: 'bold', fontSize: 11, textColor: [0, 0, 0] }
            }],
            ['Dia:', deliveredDateStr],
            ['Hora:', deliveredTimeStr]
        ],
        theme: 'grid',
        styles: { fontSize: 9, cellPadding: 3 },
        columnStyles: {
            0: { fillColor: [60, 60, 60], textColor: [255, 255, 255], fontStyle: 'bold', cellWidth: 45 }
        }
    });

    // --- Signature Box (Right Side of Footer Table - SOLO SI HAY FIRMA DIGITAL) ---
    const signatureDataUrl = 
        deliveryData?.signatureDataUrl || 
        deliveryData?.signature || 
        ticket.logistics?.deliveryInfo?.signatureDataUrl || 
        ticket.logistics?.deliveryInfo?.signature || 
        ticket.logistics?.delivery_info?.signatureDataUrl || 
        ticket.logistics?.delivery_info?.signature || 
        ticket.deliveryDetails?.signatureDataUrl || 
        ticket.deliveryDetails?.signature || 
        null;

    if (signatureDataUrl) {
        try {
            const sigX = 118;
            const sigY = footerY;
            const sigWidth = pageWidth - 20 - sigX; // ~72mm
            const sigHeight = 36;
            doc.setDrawColor(180, 180, 180);
            doc.setFillColor(255, 255, 255);
            doc.rect(sigX, sigY, sigWidth, sigHeight);
            doc.addImage(signatureDataUrl, 'PNG', sigX + 2, sigY + 2, sigWidth - 4, sigHeight - 4);
            doc.setFontSize(8);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(60, 60, 60);
            doc.text('Firma Digital Capturada', sigX, sigY + sigHeight + 4);
        } catch (err) {
            console.error('Signature embed in POD error:', err);
        }
    }

    // Legal Footer
    doc.setFontSize(7);
    doc.setTextColor(100);

    // Formato de nombre de archivo solicitado: "MES DIA - NOMBRE DEL CLIENTE.pdf"
    // Ejemplo: "AGOSTO 19 - CLARA BIANCHETTI DEVOL.pdf"
    const monthNames = [
        'ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO',
        'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE'
    ];

    let fileDate = new Date();
    const rawFileDate = 
        deliveryData?.deliveredDate || 
        deliveryData?.deliveredAt || 
        ticket.logistics?.deliveryInfo?.deliveredDate || 
        ticket.logistics?.deliveryInfo?.deliveredAt || 
        ticket.deliveryCompletedDate || 
        ticket.logistics?.date ||
        ticket.created_at || 
        ticket.createdAt;

    if (rawFileDate) {
        if (typeof rawFileDate === 'string' && /^\d{4}-\d{2}-\d{2}/.test(rawFileDate.trim())) {
            const [yyyy, mm, dd] = rawFileDate.trim().split('T')[0].split('-').map(Number);
            fileDate = new Date(yyyy, mm - 1, dd);
        } else {
            const d = new Date(rawFileDate);
            if (!isNaN(d.getTime())) fileDate = d;
        }
    }

    const monthName = monthNames[fileDate.getMonth()] || 'MES';
    const dayNumber = fileDate.getDate();

    const isCollection = (
        (ticket.logistics?.type || '').toLowerCase().includes('recupero') || 
        (ticket.logistics?.type || '').toLowerCase().includes('collection') || 
        (ticket.logistics?.type || '').toLowerCase().includes('retiro') ||
        (ticket.subject || '').toLowerCase().includes('recupero') ||
        (ticket.subject || '').toLowerCase().includes('collection') ||
        (ticket.subject || '').toLowerCase().includes('offboarding') ||
        (ticket.subject || '').toLowerCase().includes('devol')
    );

    let clientPart = (ticket.requester || recipientName || ticket.client || ticket.id || 'CLIENTE').trim().toUpperCase();
    if (isCollection && !clientPart.includes('DEVOL') && !clientPart.includes('RECUPERO')) {
        clientPart = `${clientPart} DEVOL`;
    }

    const cleanClientPart = clientPart.replace(/[\\/:*?"<>|]/g, '').trim();
    const fileName = `${monthName} ${dayNumber} - ${cleanClientPart}.pdf`;

    doc.setProperties({ title: fileName });

    if (action === 'view') {
        window.open(doc.output('bloburl'), '_blank');
    } else if (action === 'share') {
        try {
            const blob = doc.output('blob');
            const file = new File([blob], fileName, { type: 'application/pdf' });
            if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
                navigator.share({
                    files: [file],
                    title: fileName.replace('.pdf', ''),
                    text: `Adjunto el remito PDF: ${fileName}`
                }).catch(err => {
                    console.error('Error sharing', err);
                    doc.save(fileName); // Fallback on cancel/error
                });
            } else {
                doc.save(fileName);
            }
        } catch (err) {
            console.error('Error creating shareable file', err);
            doc.save(fileName);
        }
    } else {
        doc.save(fileName);
    }
};

const getBase64ImageFromURL = (url) => {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.setAttribute('crossOrigin', 'anonymous');
        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0);
            const dataURL = canvas.toDataURL('image/png');
            resolve(dataURL);
        };
        img.onerror = error => reject(error);
        img.src = url;
    });
};

export const generateLabelPDF = async (ticket, assets) => {
    // 10cm x 15cm = 100mm x 150mm
    const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: [100, 150]
    });

    // --- Sender Header ---
    doc.setLineWidth(0.5);
    doc.rect(2, 2, 96, 25); // Header box

    // Logo
    try {
        const logoData = await getBase64ImageFromURL('/logo-label.png');
        doc.addImage(logoData, 'PNG', 4, 4, 21, 21); // Ajustado para encajar en el box
    } catch (err) {
        console.error("Error loading logo", err);
        // Fallback circle
        doc.setFillColor(240, 240, 240);
        doc.circle(14, 14, 8, 'F');
    }

    doc.setTextColor(0);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10); // Un poco mas grande el titulo principal
    // "ENTREGA / RECUPERO de activos"
    doc.text('ENTREGA / RECUPERO', 30, 10);
    doc.text('de activos', 30, 15);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    // Removed Address Lines ("quita CABA, Argentina" and generic address)
    // Keep IDs
    doc.text(`Ref. Interna: ${ticket.id}`, 30, 22);

    const isLabelSFDC = /SFDC/i.test(ticket?.client || '');
    const labelCaseMatch = isLabelSFDC 
        ? (ticket.subject?.match(/SFDC-[A-Z0-9]+/i) || ticket.subject?.match(/SFDC-\d+/i))
        : ticket.subject?.match(/^\[([^\]]+)\]/);
    const labelCaseNum = labelCaseMatch 
        ? (isLabelSFDC ? labelCaseMatch[0] : labelCaseMatch[1]) 
        : (ticket.caseNumber || ticket.case_number || '-');

    doc.text(`Caso: ${labelCaseNum}`, 65, 22);

    // --- Service Type Bar ---
    doc.setFillColor(255, 255, 255); // White bg
    doc.rect(2, 27, 96, 8);
    doc.line(2, 35, 98, 35);

    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('Envío Corporativo', 50, 33, { align: 'center' });

    // --- Delivery Date Bar ---
    doc.setFontSize(10);
    doc.text('Fecha:', 5, 42);
    doc.setFontSize(14);
    const dateStr = ticket.logistics?.date ? new Date(ticket.logistics.date).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' }) : 'A Coordinar';
    doc.text(dateStr, 95, 42, { align: 'right' });
    doc.line(2, 45, 98, 45);

    // --- QR Code Area ---
    const qrData = JSON.stringify({
        id: ticket.id,
        requester: ticket.requester,
        assets: ticket.associatedAssets?.map(a => typeof a === 'string' ? a : a.serial)
    });

    try {
        const qrUrl = await QRCode.toDataURL(qrData, { margin: 1 });
        doc.addImage(qrUrl, 'PNG', 5, 50, 45, 45);
    } catch (err) {
        console.error("Error generating QR", err);
        doc.text("Error QR", 10, 70);
    }

    // --- Zone / CP Info ---
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text(`CP: ${ticket.logistics?.zipCode || '-'}`, 60, 60);
    doc.setFontSize(14);
    // Extraer Ciudad o usar default
    const city = ticket.logistics?.city || 'CABA';
    doc.text(city, 60, 70);

    doc.line(2, 98, 98, 98);

    // --- Footer (Destinatario) ---
    doc.setFontSize(12);
    doc.text('DESTINATARIO', 50, 105, { align: 'center' });
    doc.line(2, 108, 98, 108);

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');

    let yPos = 115;
    const addLine = (label, value) => {
        doc.setFont('helvetica', 'bold');
        doc.text(`${label}:`, 5, yPos);
        doc.setFont('helvetica', 'normal');
        // Wrap text
        const splitText = doc.splitTextToSize(value || '-', 70);
        doc.text(splitText, 25, yPos);
        yPos += (splitText.length * 4) + 2;
    };

    addLine('Nombre', cleanText(ticket.requester));
    const fullAddress = (ticket.logistics?.address || '') + (ticket.logistics?.floorDept ? `, ${ticket.logistics.floorDept}` : '');
    addLine('Dirección', cleanText(fullAddress));
    addLine('Teléfono', ticket.logistics?.phone);
    addLine('Nota', 'Entregar en mano o recepcion.');

    doc.save(`Etiqueta_${ticket.id}.pdf`);
};

/**
 * Genera un PDF de Remito de Recupero Adicional para conductores.
 * @param {Object} data - { ticketId, driverName, deliveredByName, deviceType, serial, notes, date, time, clientName, signatureDataUrl }
 */
export const generateReturnRemitoPDF = async (data) => {
    const {
        ticketId = '-',
        driverName = '',
        deliveredByName = '',
        deviceType = '',
        serial = '',
        notes = '',
        date = '',
        time = '',
        clientName = '',
        signatureDataUrl = null
    } = data;

    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();

    // ─── Header ──────────────────────────────────────────────────────────────
    doc.setFontSize(20);
    doc.setFont('helvetica', 'bold');
    doc.text('REMITO DE RECUPERO', 20, 22);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    doc.text('Recepcion de activo adicional por conductor', 20, 30);

    autoTable(doc, {
        startY: 14,
        margin: { left: pageWidth - 80 },
        tableWidth: 60,
        body: [
            ['Ticket N°:', ticketId],
            ['Fecha:', date],
            ['Hora:', time],
            ['Cliente:', cleanText(clientName)]
        ],
        theme: 'grid',
        styles: { fontSize: 8, cellPadding: 2 },
        columnStyles: { 0: { fontStyle: 'bold', halign: 'right', cellWidth: 28 } }
    });

    let currentY = 40;
    doc.setLineWidth(0.5);
    doc.line(20, currentY, pageWidth - 20, currentY);
    currentY += 6;

    // ─── Tabla de datos ───────────────────────────────────────────────────────
    autoTable(doc, {
        startY: currentY,
        head: [[{ content: 'DATOS DEL ACTIVO RECIBIDO', colSpan: 2, styles: { halign: 'center', fillColor: [50, 50, 50] } }]],
        body: [
            ['Tipo de Dispositivo:', cleanText(deviceType)],
            ['Numero de Serie (S/N):', serial],
            ['Recibido por Conductor:', cleanText(driverName)],
            ['Entregado por:', cleanText(deliveredByName)],
            ['Observaciones:', cleanText(notes) || '-']
        ],
        theme: 'grid',
        headStyles: { textColor: [255, 255, 255] },
        styles: { fontSize: 10, cellPadding: 4 },
        columnStyles: {
            0: { fontStyle: 'bold', cellWidth: 65, fillColor: [240, 240, 240] }
        }
    });

    currentY = doc.lastAutoTable.finalY + 10;

    // ─── QR Code con serial ───────────────────────────────────────────────────
    try {
        const qrValue = `Serial: ${serial} | Ticket: ${ticketId} | Conductor: ${driverName}`;
        const qrUrl = await QRCode.toDataURL(qrValue, { margin: 1 });
        doc.addImage(qrUrl, 'PNG', 20, currentY, 40, 40);
        doc.setFontSize(8);
        doc.setFont('helvetica', 'normal');
        doc.text('Codigo QR del dispositivo', 20, currentY + 43);
    } catch (err) {
        console.error('QR generation error:', err);
    }

    // ─── Firma Digital ────────────────────────────────────────────────────────
    if (signatureDataUrl) {
        try {
            const sigX = 75;
            const sigY = currentY;
            doc.setDrawColor(180);
            doc.rect(sigX, sigY, 115, 40);
            doc.addImage(signatureDataUrl, 'PNG', sigX + 2, sigY + 2, 111, 36);
            doc.setFontSize(8);
            doc.setFont('helvetica', 'normal');
            doc.text('Firma de quien entrega el dispositivo', sigX, sigY + 43);
        } catch (err) {
            console.error('Signature embed error:', err);
        }
    }

    currentY += 55;

    // ─── Footer legal ─────────────────────────────────────────────────────────
    doc.setFontSize(7);
    doc.setTextColor(130);
    const legalText = `Este documento es un comprobante de recepcion interna. El activo fue recibido por el conductor en la fecha indicada y sera procesado por el equipo de operaciones. Ticket: ${ticketId}`;
    const splitLegal = doc.splitTextToSize(legalText, pageWidth - 40);
    doc.text(splitLegal, 20, currentY);

    doc.save(`Remito_Recupero_${serial || ticketId}_${date}.pdf`);
};

