import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function POST(request) {
    try {
        const body = await request.json();
        const { task, ticket } = body;

        if (!task) {
            return NextResponse.json({ error: 'Falta información de la tarea' }, { status: 400 });
        }

        const apiKey = process.env.RESEND_API_KEY;
        const sender = process.env.SENDER_EMAIL || 'onboarding@resend.dev';

        if (!apiKey) {
            console.error('Falta la variable de entorno RESEND_API_KEY');
            return NextResponse.json({ error: 'Configuración de correo incompleta' }, { status: 500 });
        }

        // Obtener todos los correos de los usuarios con rol Administrativo o Administrador
        const { data: adminUsers, error } = await supabase
            .from('users')
            .select('email')
            .in('role', ['Administrativo', 'Administrador']);

        if (error) {
            console.error("Error buscando admins:", error);
            return NextResponse.json({ error: 'Error al buscar administradores' }, { status: 500 });
        }

        const adminEmails = adminUsers.map(u => u.email).filter(Boolean);
        
        if (adminEmails.length === 0) {
            return NextResponse.json({ message: 'No hay usuarios administrativos para notificar' });
        }

        const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <title>Nuevo caso en preparación</title>
            <style>
                body { font-family: sans-serif; background-color: #f4f5f7; color: #1f2937; margin: 0; padding: 20px; }
                .container { max-width: 600px; margin: 0 auto; background: #fff; border-radius: 8px; padding: 20px; border: 1px solid #e5e7eb; }
                h2 { color: #2563eb; margin-top: 0; }
                .details { background: #f9fafb; padding: 15px; border-radius: 8px; margin: 20px 0; border: 1px solid #f3f4f6; }
                .footer { color: #6b7280; font-size: 12px; margin-top: 20px; text-align: center; }
            </style>
        </head>
        <body>
            <div class="container">
                <h2>📦 Nuevo Servicio a Preparar</h2>
                <p>El caso <strong>${task.caseNumber || 'S/N'}</strong> ha pasado al estado "En Preparación".</p>
                <p>Por favor, revisa la sección de Logística para armar el paquete y confirmar los equipos a enviar.</p>
                
                <div class="details">
                    <p><strong>Asunto:</strong> ${task.subject || 'Sin asunto'}</p>
                    <p><strong>Ticket Original:</strong> ${ticket?.case_number || 'N/A'}</p>
                </div>
                
                <p>Ingresa a AssetFlow Logística para más detalles.</p>
                <div class="footer">
                    Este es un aviso automático de AssetFlow.
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
                to: adminEmails,
                subject: `NUEVO PAQUETE: Preparar caso ${task.caseNumber || ''}`,
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
        console.error('Error en API notify-admin:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
