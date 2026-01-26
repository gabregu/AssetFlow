import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import QRCode from 'qrcode';

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
    const sfdcMatch = ticket.subject?.match(/SFDC-(\d+)/);
    const sfdcId = sfdcMatch ? sfdcMatch[1] : (ticket.caseNumber || '-');

    autoTable(doc, {
        startY: 15,
        margin: { left: pageWidth - 90 },
        tableWidth: 70,
        body: [
            ['Servicio número:', ticket.id || '-'],
            ['Caso SFDC:', sfdcId],
            ['Fecha Acordada:', ticket.logistics?.date || ticket.logistics?.datetime?.split('T')[0] || '-'],
            ['Turno:', ticket.logistics?.timeSlot || 'AM']
        ],
        theme: 'grid',
        styles: { fontSize: 8, cellPadding: 2 },
        columnStyles: { 0: { fontStyle: 'normal', halign: 'right', cellWidth: 35 } }
    });

    let currentY = 55;
    doc.setLineWidth(1);
    doc.line(20, 50, pageWidth - 20, 50);

    // --- Information Tables ---
    autoTable(doc, {
        startY: 60,
        head: [[
            { content: 'Información de Contacto', colSpan: 2, styles: { halign: 'center' } },
            { content: 'Información del Repartidor', colSpan: 2, styles: { halign: 'center' } }
        ]],
        body: [
            ['Solicitante:', ticket.requester || '-', 'Nombre del Repartidor:', ticket.logistics?.deliveryPerson || '-'],
            ['Teléfono:', ticket.logistics?.phone || '-', 'Numero de Rastreo:', ticket.logistics?.trackingNumber || '-'],
            ['Correo:', ticket.logistics?.email || '-', '', ''],
            ['Dirección:', { content: ticket.logistics?.address || '-', colSpan: 3 }]
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

    currentY = doc.lastAutoTable.finalY + 10;
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('Descripción del Caso:', 20, currentY);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text(ticket.subject || '-', 20, currentY + 7, { maxWidth: pageWidth - 40 });

    // --- Assets List Table ---
    currentY += 20;
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
        taskRows.push([typeLabel, asset?.type || 'Hardware', asset?.name || '-', serial]);
    });

    // Accessories
    const commonTypeLabel = (ticket.logistics?.type === 'Recupero' ? 'RETIRO' : 'ENTREGA');
    if (ticket.accessories?.backpack) taskRows.push([commonTypeLabel, 'Accesorio', 'Mochila Técnica', '-']);
    if (ticket.accessories?.screenFilter) taskRows.push([commonTypeLabel, 'Accesorio', `Filtro de Pantalla ${ticket.accessories.filterSize || ''}`, '-']);
    if (ticket.accessories?.mouse) taskRows.push([commonTypeLabel, 'Accesorio', 'Mouse Óptico', '-']);
    if (ticket.accessories?.keyboard) taskRows.push([commonTypeLabel, 'Accesorio', 'Teclado USB', '-']);
    if (ticket.accessories?.headset) taskRows.push([commonTypeLabel, 'Accesorio', 'Auriculares con Micrófono', '-']);
    if (ticket.accessories?.charger) taskRows.push([commonTypeLabel, 'Accesorio', 'Cargador Original', '-']);

    autoTable(doc, {
        startY: currentY,
        head: [[{ content: 'LISTA DE ACTIVOS ASOCIADOS AL SERVICIO', colSpan: 4, styles: { halign: 'left', fillColor: [60, 60, 60] } }], ['Tipo de Movimiento', 'Tipo de Dispositivo', 'Descripción', 'Serie']],
        body: taskRows.length > 0 ? taskRows : [['-', '-', 'No hay activos registrados', '-']],
        theme: 'grid',
        headStyles: { fillColor: [80, 80, 80], textColor: [255, 255, 255] },
        styles: { fontSize: 8.5 },
        columnStyles: {
            0: { cellWidth: 40 },
            1: { cellWidth: 40 },
            3: { cellWidth: 40 }
        }
    });

    // --- Notes ---
    currentY = doc.lastAutoTable.finalY + 15;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('NOTAS Adicionales :', 20, currentY);
    doc.line(20, currentY + 10, pageWidth - 20, currentY + 10);

    if (deliveryData?.notes || ticket.deliveryDetails?.notes) {
        doc.setFont('helvetica', 'normal');
        doc.text(deliveryData?.notes || ticket.deliveryDetails?.notes || '', 20, currentY + 7, { maxWidth: pageWidth - 40 });
    }

    // --- Footer Table (Signature) ---
    const footerY = 230;
    autoTable(doc, {
        startY: footerY,
        tableWidth: 90,
        body: [
            ['Persona que entregó o recibió:', deliveryData?.receivedBy || ticket.deliveryDetails?.receivedBy || ''],
            ['DNI:', deliveryData?.dni || ticket.deliveryDetails?.dni || ''],
            ['Dia:', deliveryData ? new Date().toLocaleDateString() : (ticket.deliveryCompletedDate?.split('T')[0] || '')],
            ['Hora:', deliveryData?.actualTime || ticket.deliveryDetails?.actualTime || '']
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
    doc.text(`Caso SFDC: ${ticket.subject?.match(/SFDC-(\d+)/)?.[1] || '-'}`, 65, 22);

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

    addLine('Nombre', ticket.requester);
    addLine('Dirección', ticket.logistics?.address);
    addLine('Teléfono', ticket.logistics?.phone);
    addLine('Nota', 'Entregar en mano o recepción.');

    doc.save(`Etiqueta_${ticket.id}.pdf`);
};
