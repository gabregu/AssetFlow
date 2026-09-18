-- Migration 50: Funciones seguras para Confirmación y Firma Digital de Entregas vía QR
-- Permite que receptores externos confirmen la recepción sin acceder al dashboard ni vulnerar RLS.

-- 1. Función para consultar información básica del remito a firmar (Pública y Segura)
CREATE OR REPLACE FUNCTION public.get_delivery_confirmation_info(
    p_ticket_id text,
    p_case_number text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_ticket RECORD;
    v_task RECORD;
    v_result jsonb;
    v_assets jsonb := '[]'::jsonb;
    v_accessories jsonb := '{}'::jsonb;
    v_yubikeys jsonb := '[]'::jsonb;
    v_items jsonb := '[]'::jsonb;
    v_recipient text := '';
    v_case_num text := '';
    v_tracking text := '';
    v_address text := '';
    v_elem jsonb;
    v_serial text;
    v_asset_name text;
    v_asset_type text;
    v_key text;
    v_val jsonb;
BEGIN
    -- 1. Buscar el ticket principal
    SELECT * INTO v_ticket
    FROM public.tickets
    WHERE id = p_ticket_id;

    -- Si no se encuentra por id, intentar buscar por caso en logistics_tasks
    IF NOT FOUND THEN
        SELECT t.* INTO v_ticket
        FROM public.tickets t
        JOIN public.logistics_tasks lt ON lt.ticket_id = t.id
        WHERE lt.case_number = p_ticket_id OR lt.id::text = p_ticket_id
        LIMIT 1;
    END IF;

    IF v_ticket.id IS NULL THEN
        RETURN NULL;
    END IF;

    -- 2. Buscar tarea específica en logistics_tasks si existe
    IF p_case_number IS NOT NULL AND trim(p_case_number) <> '' THEN
        SELECT * INTO v_task
        FROM public.logistics_tasks
        WHERE ticket_id = v_ticket.id 
          AND (case_number = p_case_number OR case_number ILIKE '%' || p_case_number || '%')
        ORDER BY updated_at DESC
        LIMIT 1;
    END IF;

    IF v_task.id IS NULL THEN
        SELECT * INTO v_task
        FROM public.logistics_tasks
        WHERE ticket_id = v_ticket.id
        ORDER BY updated_at DESC
        LIMIT 1;
    END IF;

    -- 3. Extraer activos, accesorios y yubikeys desde la tarea o desde el ticket
    IF v_task.id IS NOT NULL AND v_task.assets IS NOT NULL AND jsonb_array_length(v_task.assets) > 0 THEN
        v_assets := v_task.assets;
    ELSE
        v_assets := COALESCE(v_ticket.associated_assets, '[]'::jsonb);
    END IF;

    IF v_task.id IS NOT NULL AND v_task.accessories IS NOT NULL AND v_task.accessories <> '{}'::jsonb THEN
        v_accessories := v_task.accessories;
    ELSE
        v_accessories := COALESCE(v_ticket.accessories, '{}'::jsonb);
    END IF;

    IF v_task.id IS NOT NULL AND v_task.yubikeys IS NOT NULL AND jsonb_array_length(v_task.yubikeys) > 0 THEN
        v_yubikeys := v_task.yubikeys;
    ELSE
        -- Fallback a posible campo yubikeys en logistics o en ticket
        v_yubikeys := COALESCE(v_ticket.logistics->'yubikeys', '[]'::jsonb);
    END IF;

    -- Datos generales
    v_case_num := COALESCE(
        v_task.case_number,
        v_ticket.logistics->>'additionalCase',
        p_case_number,
        v_ticket.id
    );

    v_recipient := COALESCE(
        v_ticket.delivery_details->>'receivedBy',
        v_task.delivery_info->>'receivedBy',
        v_ticket.logistics->>'contactName',
        v_ticket.logistics->>'name',
        ''
    );

    v_tracking := COALESCE(
        v_task.tracking_number,
        v_ticket.logistics->>'trackingNumber',
        v_ticket.logistics->>'tracking_number',
        ''
    );

    v_address := COALESCE(
        v_task.address,
        v_ticket.logistics->>'address',
        ''
    );

    -- 4. Construir la lista consolidada de items (Hardware, Accesorios y YubiKeys)
    -- A) Activos de Hardware
    IF v_assets IS NOT NULL AND jsonb_typeof(v_assets) = 'array' THEN
        FOR v_elem IN SELECT * FROM jsonb_array_elements(v_assets) LOOP
            IF jsonb_typeof(v_elem) = 'object' THEN
                v_serial := COALESCE(v_elem->>'serial', v_elem->>'id', '');
                v_asset_name := COALESCE(v_elem->>'model', v_elem->>'name', v_elem->>'description', '');
                v_asset_type := COALESCE(v_elem->>'type', v_elem->>'deviceType', 'Equipo');
            ELSE
                v_serial := trim(both '"' from v_elem::text);
                v_asset_name := '';
                v_asset_type := 'Equipo';
            END IF;

            -- Si no tenemos el nombre o modelo, consultar la tabla de inventario public.assets
            IF (v_asset_name = '' OR v_asset_name = 'Dispositivo' OR v_asset_name = 'Hardware') AND v_serial <> '' THEN
                SELECT 
                    COALESCE(name, model, type, 'Equipo'),
                    COALESCE(type, 'Equipo')
                INTO v_asset_name, v_asset_type
                FROM public.assets
                WHERE serial = v_serial OR id::text = v_serial
                LIMIT 1;
            END IF;

            IF v_asset_name = '' THEN
                v_asset_name := 'Dispositivo (' || COALESCE(v_asset_type, 'Equipo') || ')';
            END IF;

            v_items := v_items || jsonb_build_array(jsonb_build_object(
                'type', COALESCE(v_asset_type, 'Equipo'),
                'name', v_asset_name,
                'serial', COALESCE(v_serial, '-')
            ));
        END LOOP;
    END IF;

    -- B) Accesorios
    IF v_accessories IS NOT NULL AND jsonb_typeof(v_accessories) = 'object' THEN
        FOR v_key, v_val IN SELECT * FROM jsonb_each(v_accessories) LOOP
            IF v_val = 'true'::jsonb OR (jsonb_typeof(v_val) = 'string' AND trim(both '"' from v_val::text) <> '' AND trim(both '"' from v_val::text) <> 'false') THEN
                v_asset_name := CASE v_key
                    WHEN 'backpack' THEN 'Mochila Técnica'
                    WHEN 'mouse' THEN 'Mouse Óptico'
                    WHEN 'keyboard' THEN 'Teclado USB'
                    WHEN 'headset' THEN 'Auriculares con Micrófono'
                    WHEN 'charger' THEN 'Cargador Original'
                    WHEN 'screenFilter' THEN 'Filtro de Pantalla'
                    ELSE v_key
                END;

                v_items := v_items || jsonb_build_array(jsonb_build_object(
                    'type', 'Accesorio',
                    'name', v_asset_name,
                    'serial', '-'
                ));
            END IF;
        END LOOP;
    END IF;

    -- C) YubiKeys
    IF v_yubikeys IS NOT NULL AND jsonb_typeof(v_yubikeys) = 'array' THEN
        FOR v_elem IN SELECT * FROM jsonb_array_elements(v_yubikeys) LOOP
            v_serial := COALESCE(v_elem->>'serial', '');
            v_items := v_items || jsonb_build_array(jsonb_build_object(
                'type', 'Security Key',
                'name', 'YubiKey (Hardware Key)',
                'serial', COALESCE(v_serial, '-')
            ));
        END LOOP;
    END IF;

    -- 5. Construir respuesta final segura
    v_result := jsonb_build_object(
        'id', v_ticket.id,
        'caseNumber', v_case_num,
        'subject', COALESCE(v_task.subject, v_ticket.subject, ''),
        'client', COALESCE(v_ticket.client, ''),
        'status', COALESCE(v_task.status, v_ticket.status, 'Pendiente'),
        'recipientName', v_recipient,
        'address', v_address,
        'trackingNumber', v_tracking,
        'associatedAssets', v_assets,
        'accessories', v_accessories,
        'yubikeys', v_yubikeys,
        'items', v_items,
        'deliveryDetails', COALESCE(v_ticket.delivery_details, '{}'::jsonb),
        'isConfirmed', (
            (v_ticket.status = 'Entregado' OR (v_task.status IS NOT NULL AND v_task.status = 'Entregado')) AND 
            v_ticket.delivery_details IS NOT NULL AND 
            (v_ticket.delivery_details->>'signatureDataUrl' IS NOT NULL OR v_ticket.delivery_details->>'signature' IS NOT NULL)
        )
    );

    RETURN v_result;
END;
$$;

-- Permitir ejecución a usuarios anónimos y autenticados (ambas sobrecargas por retrocompatibilidad)
GRANT EXECUTE ON FUNCTION public.get_delivery_confirmation_info(text, text) TO anon, authenticated;
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
        -- Buscar por logistics_tasks si fue pasado un caseNumber o subtask id
        SELECT t.* INTO v_ticket
        FROM public.tickets t
        JOIN public.logistics_tasks lt ON lt.ticket_id = t.id
        WHERE lt.case_number = p_ticket_id OR lt.id::text = p_ticket_id
        LIMIT 1;
    END IF;

    IF v_ticket.id IS NULL THEN
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
    WHERE id = v_ticket.id;

    -- Actualizar también todas las tareas asociadas en logistics_tasks
    BEGIN
        UPDATE public.logistics_tasks
        SET 
            status = 'Entregado', 
            delivery_info = COALESCE(delivery_info, '{}'::jsonb) || jsonb_build_object(
                'receivedBy', trim(p_received_by),
                'dni', trim(p_dni),
                'signatureDataUrl', p_signature_data_url,
                'deliveredDate', v_now_date,
                'actualTime', to_char(now() AT TIME ZONE 'America/Argentina/Buenos_Aires', 'HH24:MI')
            ),
            updated_at = now()
        WHERE ticket_id = v_ticket.id;
    EXCEPTION WHEN OTHERS THEN
        -- Ignorar si la tabla no existe o tiene otra estructura
    END;

    RETURN jsonb_build_object('success', true, 'alreadyConfirmed', false);
END;
$$;

-- Permitir ejecución a usuarios anónimos y autenticados
GRANT EXECUTE ON FUNCTION public.confirm_delivery_receipt(text, text, text, text) TO anon, authenticated;
