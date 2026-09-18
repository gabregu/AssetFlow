-- Migration 50: Funciones seguras para Confirmación y Firma Digital de Entregas vía QR
-- Permite que receptores externos confirmen la recepción sin acceder al dashboard ni vulnerar RLS.

-- 1. Función para consultar información básica del remito a firmar (Pública y Segura)
CREATE OR REPLACE FUNCTION public.get_delivery_confirmation_info(p_ticket_id text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_ticket RECORD;
    v_result jsonb;
BEGIN
    SELECT 
        id,
        subject,
        client,
        status,
        date,
        logistics,
        associated_assets,
        accessories,
        delivery_details,
        delivery_completed_date
    INTO v_ticket
    FROM public.tickets
    WHERE id = p_ticket_id;

    IF NOT FOUND THEN
        RETURN NULL;
    END IF;

    -- Construir respuesta con datos estrictamente no confidenciales
    v_result := jsonb_build_object(
        'id', v_ticket.id,
        'caseNumber', COALESCE(v_ticket.logistics->>'additionalCase', v_ticket.id),
        'subject', COALESCE(v_ticket.subject, ''),
        'client', COALESCE(v_ticket.client, ''),
        'status', COALESCE(v_ticket.status, 'Pendiente'),
        'recipientName', COALESCE(
            v_ticket.delivery_details->>'receivedBy',
            v_ticket.logistics->>'contactName',
            v_ticket.logistics->>'name',
            ''
        ),
        'address', COALESCE(v_ticket.logistics->>'address', ''),
        'trackingNumber', COALESCE(v_ticket.logistics->>'trackingNumber', v_ticket.logistics->>'tracking_number', ''),
        'associatedAssets', COALESCE(v_ticket.associated_assets, '[]'::jsonb),
        'accessories', COALESCE(v_ticket.accessories, '{}'::jsonb),
        'deliveryDetails', COALESCE(v_ticket.delivery_details, '{}'::jsonb),
        'isConfirmed', (
            v_ticket.status = 'Entregado' AND 
            v_ticket.delivery_details IS NOT NULL AND 
            (v_ticket.delivery_details->>'signatureDataUrl' IS NOT NULL OR v_ticket.delivery_details->>'signature' IS NOT NULL)
        )
    );

    RETURN v_result;
END;
$$;

-- Permitir ejecución a usuarios anónimos y autenticados
GRANT EXECUTE ON FUNCTION public.get_delivery_confirmation_info(text) TO anon, authenticated;


-- 2. Función para registrar la firma y confirmación digital (Pública y Segura)
CREATE OR REPLACE FUNCTION public.confirm_delivery_receipt(
    p_ticket_id text,
    p_received_by text,
    p_dni text,
    p_signature_data_url text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_ticket RECORD;
    v_now_iso text := to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
    v_now_date text := to_char(now() AT TIME ZONE 'America/Argentina/Buenos_Aires', 'YYYY-MM-DD');
    v_now_formatted text := to_char(now() AT TIME ZONE 'America/Argentina/Buenos_Aires', 'DD/MM/YYYY HH24:MI');
    v_new_details jsonb;
    v_new_logistics jsonb;
    v_existing_notes jsonb;
    v_note_text text;
BEGIN
    -- Validar parámetros
    IF p_ticket_id IS NULL OR p_received_by IS NULL OR p_dni IS NULL OR p_signature_data_url IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Parámetros incompletos');
    END IF;

    SELECT * INTO v_ticket
    FROM public.tickets
    WHERE id = p_ticket_id;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Ticket no encontrado');
    END IF;

    -- Verificar si ya fue confirmado
    IF v_ticket.status = 'Entregado' AND (v_ticket.delivery_details->>'signatureDataUrl' IS NOT NULL OR v_ticket.delivery_details->>'signature' IS NOT NULL) THEN
        RETURN jsonb_build_object('success', true, 'alreadyConfirmed', true, 'message', 'La entrega ya había sido confirmada previamente');
    END IF;

    -- Armar nuevo objeto delivery_details
    v_new_details := COALESCE(v_ticket.delivery_details, '{}'::jsonb) || jsonb_build_object(
        'receivedBy', trim(p_received_by),
        'dni', trim(p_dni),
        'signatureDataUrl', p_signature_data_url,
        'deliveredDate', v_now_date,
        'deliveredAt', v_now_iso,
        'actualTime', to_char(now() AT TIME ZONE 'America/Argentina/Buenos_Aires', 'HH24:MI'),
        'confirmedOnline', true
    );

    -- Actualizar logistics con deliveryInfo
    v_new_logistics := COALESCE(v_ticket.logistics, '{}'::jsonb) || jsonb_build_object(
        'status', 'Entregado',
        'deliveryInfo', jsonb_build_object(
            'receivedBy', trim(p_received_by),
            'dni', trim(p_dni),
            'signatureDataUrl', p_signature_data_url,
            'deliveredDate', v_now_date,
            'actualTime', to_char(now() AT TIME ZONE 'America/Argentina/Buenos_Aires', 'HH24:MI')
        )
    );

    -- Agregar nota de auditoría
    v_note_text := format('[%s] ✅ ENTREGA CONFIRMADA DIGITALMENTE: %s (DNI: %s) firmó la recepción desde el celular.', v_now_formatted, trim(p_received_by), trim(p_dni));
    
    v_existing_notes := COALESCE(v_ticket.internal_notes, '[]'::jsonb);
    IF jsonb_typeof(v_existing_notes) = 'array' THEN
        v_existing_notes := v_existing_notes || jsonb_build_array(v_note_text);
    ELSE
        v_existing_notes := jsonb_build_array(v_note_text);
    END IF;

    -- Ejecutar UPDATE sobre el ticket
    UPDATE public.tickets
    SET 
        status = 'Entregado',
        delivery_completed_date = v_now_date,
        delivery_details = v_new_details,
        logistics = v_new_logistics,
        internal_notes = v_existing_notes
    WHERE id = p_ticket_id;

    -- Si existen logistics_tasks asociadas, marcarlas como Entregado
    BEGIN
        UPDATE public.logistics_tasks
        SET status = 'Entregado', updated_at = now()
        WHERE ticket_id = p_ticket_id;
    EXCEPTION WHEN OTHERS THEN
        -- Ignorar si la tabla no existe o tiene otra estructura
    END;

    RETURN jsonb_build_object('success', true, 'alreadyConfirmed', false);
END;
$$;

-- Permitir ejecución a usuarios anónimos y autenticados
GRANT EXECUTE ON FUNCTION public.confirm_delivery_receipt(text, text, text, text) TO anon, authenticated;
