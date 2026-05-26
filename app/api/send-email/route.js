import { NextResponse } from 'next/server';

export async function POST(request) {
    try {
        const body = await request.json();
        const { 
            to, 
            deliveryId, 
            recipientName, 
            dni, 
            notes, 
            actualTime, 
            requester, 
            address, 
            type, 
            items 
        } = body;

        if (!to) {
            return NextResponse.json({ error: 'Falta el destinatario (email)' }, { status: 400 });
        }

        const apiKey = process.env.RESEND_API_KEY;
        const sender = process.env.SENDER_EMAIL || 'onboarding@resend.dev'; // onboarding@resend.dev es el remitente de prueba por defecto de Resend

        if (!apiKey) {
            console.error('Falta la variable de entorno RESEND_API_KEY');
            return NextResponse.json({ error: 'Configuración de correo incompleta' }, { status: 500 });
        }

        // Generación de la plantilla HTML premium para el comprobante
        const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Comprobante de Servicio - AssetFlow</title>
            <style>
                body {
                    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
                    background-color: #f4f5f7;
                    color: #1f2937;
                    margin: 0;
                    padding: 0;
                }
                .container {
                    max-width: 600px;
                    margin: 20px auto;
                    background: #ffffff;
                    border-radius: 12px;
                    box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.05), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
                    overflow: hidden;
                    border: 1px solid #e5e7eb;
                }
                .header {
                    background: linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%);
                    color: #ffffff;
                    padding: 35px 25px;
                    text-align: center;
                }
                .header h1 {
                    margin: 0;
                    font-size: 26px;
                    font-weight: 800;
                    letter-spacing: -0.03em;
                }
                .header p {
                    margin: 8px 0 0 0;
                    opacity: 0.9;
                    font-size: 14px;
                    font-weight: 500;
                }
                .content {
                    padding: 30px 25px;
                }
                .badge {
                    display: inline-block;
                    padding: 5px 14px;
                    border-radius: 9999px;
                    font-size: 11px;
                    font-weight: 800;
                    text-transform: uppercase;
                    letter-spacing: 0.05em;
                    margin-bottom: 20px;
                }
                .badge-entrega {
                    background-color: #d1fae5;
                    color: #065f46;
                }
                .badge-recupero {
                    background-color: #fef3c7;
                    color: #92400e;
                }
                .info-grid {
                    display: table;
                    width: 100%;
                    border-collapse: collapse;
                    margin-bottom: 25px;
                }
                .info-row {
                    display: table-row;
                }
                .info-cell {
                    display: table-cell;
                    width: 50%;
                    padding: 8px;
                    vertical-align: top;
                }
                .info-item {
                    background: #f9fafb;
                    padding: 14px;
                    border-radius: 10px;
                    border: 1px solid #f3f4f6;
                    min-height: 50px;
                }
                .info-label {
                    font-size: 11px;
                    color: #6b7280;
                    text-transform: uppercase;
                    font-weight: 700;
                    margin-bottom: 4px;
                    letter-spacing: 0.02em;
                }
                .info-value {
                    font-size: 14px;
                    font-weight: 600;
                    color: #111827;
                }
                .address-box {
                    background: #f9fafb;
                    padding: 14px;
                    border-radius: 10px;
                    border: 1px solid #f3f4f6;
                    margin-bottom: 25px;
                }
                .items-section {
                    margin-top: 25px;
                    border-top: 1px solid #f3f4f6;
                    padding-top: 20px;
                }
                .items-title {
                    font-size: 13px;
                    font-weight: 800;
                    color: #4b5563;
                    margin-bottom: 12px;
                    text-transform: uppercase;
                    letter-spacing: 0.05em;
                }
                .item-row {
                    padding: 10px 0;
                    border-bottom: 1px dashed #f3f4f6;
                }
                .item-text {
                    font-size: 13.5px;
                    color: #1f2937;
                    font-weight: 500;
                }
                .notes-section {
                    margin-top: 25px;
                    background: #f0fdf4;
                    border-left: 4px solid #22c55e;
                    padding: 15px;
                    border-radius: 0 8px 8px 0;
                }
                .notes-title {
                    font-size: 11px;
                    font-weight: 800;
                    color: #166534;
                    text-transform: uppercase;
                    margin-bottom: 4px;
                    letter-spacing: 0.02em;
                }
                .notes-content {
                    font-size: 13.5px;
                    color: #14532d;
                    font-style: italic;
                    line-height: 1.4;
                }
                .footer {
                    background-color: #f9fafb;
                    padding: 25px 20px;
                    text-align: center;
                    font-size: 12px;
                    color: #9ca3af;
                    border-top: 1px solid #f3f4f6;
                }
                .footer p {
                    margin: 0 0 5px 0;
                }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>AssetFlow</h1>
                    <p>Comprobante de Servicio Logístico</p>
                </div>
                <div class="content">
                    <span class="badge ${type === 'RECUPERO' ? 'badge-recupero' : 'badge-entrega'}">
                        ${type || 'ENTREGA'} COMPLETADA
                    </span>
                    
                    <div style="font-size: 22px; font-weight: 800; color: #111827; margin-bottom: 20px; letter-spacing: -0.02em;">
                        Servicio #${deliveryId}
                    </div>

                    <div class="info-grid">
                        <div class="info-row">
                            <div class="info-cell">
                                <div class="info-item">
                                    <div class="info-label">Destinatario / Requester</div>
                                    <div class="info-value">${requester || 'N/A'}</div>
                                </div>
                            </div>
                            <div class="info-cell">
                                <div class="info-item">
                                    <div class="info-label">Recibido Por</div>
                                    <div class="info-value">${recipientName || 'N/A'}</div>
                                </div>
                            </div>
                        </div>
                        <div class="info-row">
                            <div class="info-cell">
                                <div class="info-item">
                                    <div class="info-label">DNI / Cédula</div>
                                    <div class="info-value">${dni || 'N/A'}</div>
                                </div>
                            </div>
                            <div class="info-cell">
                                <div class="info-item">
                                    <div class="info-label">Fecha y Hora Turno</div>
                                    <div class="info-value">${actualTime || 'N/A'}</div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div class="address-box">
                        <div class="info-label">Dirección del Servicio</div>
                        <div class="info-value" style="font-weight: 500; color: #374151;">${address || 'Sin Dirección'}</div>
                    </div>

                    <div class="items-section">
                        <div class="items-title">Equipos y Accesorios</div>
                        ${items && items.length > 0 ? 
                            items.map(item => `
                                <div class="item-row">
                                    <div class="item-text">• ${item}</div>
                                </div>
                            `).join('') 
                            : '<div style="font-size: 13px; color: #9ca3af;">Ningún item especificado</div>'
                        }
                    </div>

                    ${notes ? `
                        <div class="notes-section">
                            <div class="notes-title">Observaciones de la Entrega</div>
                            <div class="notes-content">"${notes}"</div>
                        </div>
                    ` : ''}
                </div>
                <div class="footer">
                    <p>Este es un comprobante automático generado por la plataforma AssetFlow Logistics.</p>
                    <p style="margin-top: 5px;">© ${new Date().getFullYear()} AssetFlow. Todos los derechos reservados.</p>
                </div>
            </div>
        </body>
        </html>
        `;

        const resendResponse = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                from: sender,
                to: [to],
                subject: `Comprobante de ${type === 'RECUPERO' ? 'Recupero' : 'Entrega'} #${deliveryId} - AssetFlow`,
                html: htmlContent
            })
        });

        const resData = await resendResponse.json();

        if (!resendResponse.ok) {
            console.error('Error de Resend API:', resData);
            return NextResponse.json({ error: resData.message || 'Error en Resend' }, { status: resendResponse.status });
        }

        return NextResponse.json({ success: true, id: resData.id });

    } catch (error) {
        console.error('Error en API send-email:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
