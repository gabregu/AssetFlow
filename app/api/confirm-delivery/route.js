import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { verifyDeliveryToken, generateDeliveryToken } from '@/lib/delivery-token';

export async function GET(request) {
    try {
        const { searchParams } = new URL(request.url);
        const action = searchParams.get('action');

        // Generar token firmado de entrega desde el servidor
        if (action === 'get-token') {
            const ticketId = searchParams.get('ticketId');
            const caseNumber = searchParams.get('caseNumber') || '';
            const recipient = searchParams.get('recipient') || '';

            if (!ticketId) {
                return NextResponse.json({ error: 'Falta ticketId' }, { status: 400 });
            }

            const token = generateDeliveryToken({ ticketId, caseNumber, recipient });
            const host = request.headers.get('host');
            const protocol = request.headers.get('x-forwarded-proto') || 'https';
            const origin = host ? `${protocol}://${host}` : 'https://assetflow-yawi.vercel.app';
            const url = `${origin}/entrega/${token}`;

            return NextResponse.json({ token, url });
        }

        const token = searchParams.get('token');

        if (!token) {
            return NextResponse.json({ error: 'Falta el token de confirmación' }, { status: 400 });
        }

        const payload = verifyDeliveryToken(token);
        if (!payload || !payload.ticketId) {
            return NextResponse.json({ error: 'El enlace de confirmación es inválido o ha expirado' }, { status: 400 });
        }

        // 1. Intentar obtener datos mediante la función RPC segura
        const { data: rpcData, error: rpcError } = await supabase.rpc('get_delivery_confirmation_info', {
            p_ticket_id: payload.ticketId
        });

        if (!rpcError && rpcData) {
            return NextResponse.json(rpcData);
        }

        // 2. Fallback: Consulta directa en caso de que la migración RPC aún no se haya ejecutado
        const { data: ticket, error: dbError } = await supabase
            .from('tickets')
            .select('id, subject, client, status, date, logistics, associated_assets, accessories, delivery_details, delivery_completed_date')
            .eq('id', payload.ticketId)
            .single();

        if (dbError || !ticket) {
            // Si hay error de RLS o no encontrado, retornar al menos los datos contenidos en el token firmado
            return NextResponse.json({
                id: payload.ticketId,
                caseNumber: payload.caseNumber || payload.ticketId,
                subject: `Servicio #${payload.ticketId}`,
                client: 'Cliente',
                status: 'Pendiente',
                recipientName: payload.recipient || '',
                associatedAssets: [],
                accessories: {},
                isConfirmed: false
            });
        }

        const isConfirmed = ticket.status === 'Entregado' &&
            ticket.delivery_details &&
            (ticket.delivery_details.signatureDataUrl || ticket.delivery_details.signature);

        return NextResponse.json({
            id: ticket.id,
            caseNumber: ticket.logistics?.additionalCase || payload.caseNumber || ticket.id,
            subject: ticket.subject || '',
            client: ticket.client || '',
            status: ticket.status || 'Pendiente',
            recipientName: ticket.delivery_details?.receivedBy || ticket.logistics?.contactName || ticket.logistics?.name || payload.recipient || '',
            address: ticket.logistics?.address || '',
            trackingNumber: ticket.logistics?.trackingNumber || ticket.logistics?.tracking_number || '',
            associatedAssets: ticket.associated_assets || [],
            accessories: ticket.accessories || {},
            deliveryDetails: ticket.delivery_details || {},
            isConfirmed: Boolean(isConfirmed)
        });
    } catch (err) {
        console.error('Error en GET /api/confirm-delivery:', err);
        return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
    }
}

export async function POST(request) {
    try {
        const body = await request.json();
        const { token, recipientName, recipientDni, signatureDataUrl } = body;

        if (!token) {
            return NextResponse.json({ error: 'Falta el token de confirmación' }, { status: 400 });
        }

        const payload = verifyDeliveryToken(token);
        if (!payload || !payload.ticketId) {
            return NextResponse.json({ error: 'El enlace de confirmación es inválido o ha expirado' }, { status: 400 });
        }

        if (!recipientName || !recipientName.trim()) {
            return NextResponse.json({ error: 'Por favor ingresá el nombre y apellido de quien recibe' }, { status: 400 });
        }

        if (!recipientDni || !recipientDni.trim()) {
            return NextResponse.json({ error: 'Por favor ingresá el DNI de quien recibe' }, { status: 400 });
        }

        if (!signatureDataUrl || !signatureDataUrl.startsWith('data:image')) {
            return NextResponse.json({ error: 'Falta la firma digital o el formato es inválido' }, { status: 400 });
        }

        // 1. Intentar actualizar mediante la función RPC segura
        const { data: rpcResult, error: rpcError } = await supabase.rpc('confirm_delivery_receipt', {
            p_ticket_id: payload.ticketId,
            p_received_by: recipientName.trim(),
            p_dni: recipientDni.trim(),
            p_signature_data_url: signatureDataUrl
        });

        if (!rpcError && rpcResult?.success) {
            return NextResponse.json(rpcResult);
        }

        // 2. Fallback: Actualización directa si la función RPC aún no está creada
        const nowIso = new Date().toISOString();
        const todayDate = nowIso.split('T')[0];
        const nowFormatted = new Date().toLocaleString();

        const { data: currentTicket } = await supabase
            .from('tickets')
            .select('internal_notes, logistics, delivery_details')
            .eq('id', payload.ticketId)
            .single();

        const currentNotes = Array.isArray(currentTicket?.internal_notes) ? currentTicket.internal_notes : [];
        const newNote = `[${nowFormatted}] ✅ ENTREGA CONFIRMADA DIGITALMENTE: ${recipientName.trim()} (DNI: ${recipientDni.trim()}) firmó la recepción desde el celular.`;

        const newDeliveryDetails = {
            ...(currentTicket?.delivery_details || {}),
            receivedBy: recipientName.trim(),
            dni: recipientDni.trim(),
            signatureDataUrl: signatureDataUrl,
            deliveredDate: todayDate,
            deliveredAt: nowIso,
            confirmedOnline: true
        };

        const newLogistics = {
            ...(currentTicket?.logistics || {}),
            status: 'Entregado',
            deliveryInfo: {
                receivedBy: recipientName.trim(),
                dni: recipientDni.trim(),
                signatureDataUrl: signatureDataUrl,
                deliveredDate: todayDate,
                actualTime: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            }
        };

        const { error: updateError } = await supabase
            .from('tickets')
            .update({
                status: 'Entregado',
                delivery_completed_date: todayDate,
                delivery_details: newDeliveryDetails,
                logistics: newLogistics,
                internal_notes: [...currentNotes, newNote]
            })
            .eq('id', payload.ticketId);

        if (updateError) {
            console.error('Error al actualizar ticket directamente:', updateError);
            return NextResponse.json({ error: 'No se pudo registrar la confirmación en la base de datos' }, { status: 500 });
        }

        return NextResponse.json({ success: true, alreadyConfirmed: false });
    } catch (err) {
        console.error('Error en POST /api/confirm-delivery:', err);
        return NextResponse.json({ error: 'Error al procesar la confirmación' }, { status: 500 });
    }
}
