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
        sfdcId = ticket.caseNumber || ticket.case_number || '';
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

    autoTable(doc, {
        startY: 15,
        margin: { left: pageWidth - 90 },
        tableWidth: 70,
        body: [
            ['Servicio número:', ticket.id || '-'],
            ['Caso:', sfdcId],
            ['Fecha Acordada:', ticket.logistics?.date || ticket.logistics?.datetime?.split('T')[0] || '-'],
            ['Turno:', ticket.logistics?.timeSlot || 'AM']
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
    autoTable(doc, {
        startY: currentY,
        head: [[
            { content: 'Información de Contacto', colSpan: 2, styles: { halign: 'center' } },
            { content: 'Información del Repartidor', colSpan: 2, styles: { halign: 'center' } }
        ]],
        body: [
            ['Solicitante:', cleanText(ticket.requester), 'Nombre del Repartidor:', cleanText(ticket.logistics?.deliveryPerson)],
            ['Teléfono:', ticket.logistics?.phone || '-', 'Numero de Rastreo:', ticket.logistics?.trackingNumber || '-'],
            ['Correo:', ticket.logistics?.email || '-', '', ''],
            ['Dirección:', { 
                content: cleanText(
                    (ticket.logistics?.address || '') + 
                    (ticket.logistics?.floorDept ? `, ${ticket.logistics.floorDept}` : '')
                ), 
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
    (ticket.associatedAssets || []).forEach(item => {
        const serial = typeof item === 'string' ? item : item.serial;
        const type = typeof item === 'string' ? (ticket.logistics?.type || '') : item.type; // Modificado para aceptar vacío
        // Si type está vacío, podríamos mostrar '-' o inferirlo, pero mantendré la logica visual anterior
        // aunque si es vacío, aquí mostrará 'ENTREGA' por defecto en el ternario de abajo, a menos que lo cambie.
        // El ternario original era: const typeLabel = type === 'Recupero' ? 'RETIRO' : 'ENTREGA';
        // Si type es '', mostrará 'ENTREGA'. Asumiremos que el remito final ya tiene datos definidos.
        const typeLabel = type === 'Recupero' ? 'RETIRO' : 'ENTREGA';
        const asset = assets.find(a => a.serial === serial);
        taskRows.push([typeLabel, cleanText(asset?.type || 'Hardware'), cleanText(asset?.name || '-'), serial]);
    });

    // Accessories
    const commonTypeLabel = (ticket.logistics?.type === 'Recupero' ? 'RETIRO' : 'ENTREGA');
    if (ticket.accessories?.backpack) taskRows.push([commonTypeLabel, 'Accesorio', 'Mochila Técnica', '-']);
    if (ticket.accessories?.screenFilter) taskRows.push([commonTypeLabel, 'Accesorio', `Filtro de Pantalla ${ticket.accessories.filterSize || ''}`, '-']);
    if (ticket.accessories?.mouse) taskRows.push([commonTypeLabel, 'Accesorio', 'Mouse Óptico', '-']);
    if (ticket.accessories?.keyboard) taskRows.push([commonTypeLabel, 'Accesorio', 'Teclado USB', '-']);
    if (ticket.accessories?.headset) taskRows.push([commonTypeLabel, 'Accesorio', 'Auriculares con Micrófono', '-']);
    if (ticket.accessories?.charger) taskRows.push([commonTypeLabel, 'Accesorio', 'Cargador Original', '-']);

    // Custom / Dynamically linked accessories from inventory (barcode/manual search)
    const legacyKeys = ['backpack', 'screenFilter', 'filterSize', 'mouse', 'keyboard', 'headset', 'charger'];
    Object.keys(ticket.accessories || {}).forEach(key => {
        if (!legacyKeys.includes(key) && ticket.accessories[key] === true) {
            taskRows.push([commonTypeLabel, 'Accesorio', cleanText(key), '-']);
        }
    });

    // YubiKeys
    if (ticket.yubikeys && ticket.yubikeys.length > 0) {
        ticket.yubikeys.forEach(yk => {
            const ykTypeLabel = yk.type === 'Recupero' ? 'RETIRO' : 'ENTREGA';
            taskRows.push([ykTypeLabel, 'Security Key', 'YubiKey (Hardware Key)', yk.serial]);
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
    if (deliveryData?.notes || ticket.deliveryDetails?.notes || ticket.logistics?.deliveryInfo?.notes) {
        doc.setFont('helvetica', 'normal');
        doc.text(cleanText(deliveryData?.notes || ticket.deliveryDetails?.notes || ticket.logistics?.deliveryInfo?.notes || ''), 20, currentY + 7, { maxWidth: pageWidth - 40 });
        notesHeight = 15;
    }

    // --- Footer Table (Signature) ---
    // If the table is very long, push the footer down relative to currentY, otherwise pin it to bottom
    const footerY = Math.max(225, currentY + notesHeight + 15);
    autoTable(doc, {
        startY: footerY,
        tableWidth: 90,
        body: [
            ['Persona que entregó o recibió:', { 
                content: cleanText(
                    deliveryData?.receivedBy || 
                    ticket.logistics?.deliveryInfo?.receivedBy || 
                    ticket.logistics?.delivery_info?.receivedBy || 
                    ticket.deliveryDetails?.receivedBy || ''
                ),
                styles: { fontStyle: 'bold', fontSize: 13, textColor: [0, 0, 0] }
            }],
            ['DNI:', { 
                content: deliveryData?.dni || 
                         ticket.logistics?.deliveryInfo?.dni || 
                         ticket.logistics?.delivery_info?.dni || 
                         ticket.deliveryDetails?.dni || '',
                styles: { fontStyle: 'bold', fontSize: 13, textColor: [0, 0, 0] }
            }],
            ['Dia:', (() => {
                const rawDate = 
                    deliveryData?.deliveredAt || 
                    ticket.logistics?.deliveryInfo?.deliveredAt || 
                    ticket.logistics?.delivery_info?.deliveredAt || 
                    ticket.deliveryDetails?.deliveredAt || 
                    ticket.deliveryCompletedDate;
                if (!rawDate) return '-';
                try {
                    const dateObj = rawDate.toDate ? rawDate.toDate() : new Date(rawDate);
                    return isNaN(dateObj.getTime()) ? rawDate : dateObj.toLocaleDateString();
                } catch (e) {
                    return String(rawDate).split('T')[0];
                }
            })()],
            ['Hora:', 
                deliveryData?.actualTime || 
                ticket.logistics?.deliveryInfo?.actualTime || 
                ticket.logistics?.delivery_info?.actualTime || 
                ticket.deliveryDetails?.actualTime || ''
            ]
        ],
        theme: 'grid',
        styles: { fontSize: 9, cellPadding: 3 },
        columnStyles: {
            0: { fillColor: [60, 60, 60], textColor: [255, 255, 255], fontStyle: 'bold', cellWidth: 45 }
        }
    });

    // Legal Footer
    doc.setFontSize(7);
    doc.setTextColor(100);

    if (action === 'view') {
        window.open(doc.output('bloburl'), '_blank');
    } else {
        doc.save(`Remito_${ticket.id}.pdf`);
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
