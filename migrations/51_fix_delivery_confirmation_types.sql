-- Migration 51: Corrección de tipos de fecha y sobrecarga de funciones de confirmación de entrega
-- Corrige el error 42804: "column delivery_completed_date is of type timestamp with time zone but expression is of type text"
-- Agrega soporte para p_case_number en confirm_delivery_receipt para actualizar correctamente el sub-caso / sub-tarea correspondiente.

-- 1. Eliminar sobrecargas previas para evitar conflictos PGRST203
DROP FUNCTION IF EXISTS public.confirm_delivery_receipt(text, text, text, text);
DROP FUNCTION IF EXISTS public.confirm_delivery_receipt(text, text, text, text, text);
DROP FUNCTION IF EXISTS public.get_delivery_confirmation_info(text);
DROP FUNCTION IF EXISTS public.get_delivery_confirmation_info(text, text);

-- 2. Recrear get_delivery_confirmation_info
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
        v_task.delivery_person,
        v_ticket.requester,
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

    -- Procesar activos serializados
    IF v_assets IS NOT NULL AND jsonb_array_length(v_assets) > 0 THEN
        FOR v_elem IN SELECT * FROM jsonb_array_elements(v_assets) LOOP
            IF jsonb_typeof(v_elem) = 'string' THEN
                v_serial := trim(both '"' from v_elem::text);
                v_asset_name := 'Dispositivo';
                v_asset_type := 'Equipo';
            ELSE
                v_serial := COALESCE(v_elem->>'serial', v_elem->>'serialNumber', '');
                v_asset_name := COALESCE(v_elem->>'model', v_elem->>'name', 'Dispositivo');
                v_asset_type := COALESCE(v_elem->>'type', 'Equipo');
            END IF;

            IF v_serial <> '' THEN
                SELECT model, type INTO v_asset_name, v_asset_type
                FROM public.assets
                WHERE serial = v_serial
                LIMIT 1;

                v_items := v_items || jsonb_build_array(jsonb_build_object(
                    'type', COALESCE(v_asset_type, 'Equipo'),
                    'name', COALESCE(v_asset_name, 'Dispositivo'),
                    'serial', v_serial,
                    'isSerialized', true
                ));
            END IF;
        END LOOP;
    END IF;

    -- Procesar Yubikeys
    IF v_yubikeys IS NOT NULL AND jsonb_array_length(v_yubikeys) > 0 THEN
        FOR v_elem IN SELECT * FROM jsonb_array_elements(v_yubikeys) LOOP
            IF jsonb_typeof(v_elem) = 'string' THEN
                v_serial := trim(both '"' from v_elem::text);
            ELSE
                v_serial := COALESCE(v_elem->>'serial', v_elem->>'serialNumber', '');
            END IF;

            IF v_serial <> '' THEN
                v_items := v_items || jsonb_build_array(jsonb_build_object(
                    'type', 'Yubikey',
                    'name', 'Llave de Seguridad Yubikey',
                    'serial', v_serial,
                    'isSerialized', true
                ));
            END IF;
        END LOOP;
    END IF;

    -- Procesar accesorios
    IF v_accessories IS NOT NULL AND v_accessories <> '{}'::jsonb THEN
        FOR v_key, v_val IN SELECT * FROM jsonb_each(v_accessories) LOOP
            IF lower(trim(v_key)) NOT IN ('filtersize', 'filter_size', 'screenfiltersize') THEN
                IF v_val::text = 'true' OR v_val::text = '"true"' THEN
                    v_items := v_items || jsonb_build_array(jsonb_build_object(
                        'type', 'Accesorio',
                        'name', CASE 
                            WHEN lower(v_key) = 'backpack' THEN 'Mochila Corporativa'
                            WHEN lower(v_key) IN ('screenfilter', 'filter') THEN 'Filtro de Privacidad'
                            WHEN lower(v_key) = 'mouse' THEN 'Mouse USB/Inalámbrico'
                            WHEN lower(v_key) = 'headset' THEN 'Auriculares / Headset'
                            WHEN lower(v_key) = 'cable' THEN 'Cable de Red / Adaptador'
                            ELSE v_key
                        END,
                        'serial', NULL,
                        'isSerialized', false
                    ));
                END IF;
            END IF;
        END LOOP;
    END IF;

    RETURN jsonb_build_object(
        'id', v_ticket.id,
        'caseNumber', v_case_num,
        'subject', COALESCE(v_task.subject, v_ticket.subject),
        'client', v_ticket.client,
        'status', COALESCE(v_task.status, v_ticket.status),
        'recipientName', v_recipient,
        'address', v_address,
        'trackingNumber', v_tracking,
        'items', v_items,
        'isConfirmed', (
            (v_task.status = 'Entregado' AND (v_task.delivery_info->>'signatureDataUrl' IS NOT NULL OR v_task.delivery_info->>'signature' IS NOT NULL))
            OR
            (v_ticket.status = 'Entregado' AND (v_ticket.delivery_details->>'signatureDataUrl' IS NOT NULL OR v_ticket.delivery_details->>'signature' IS NOT NULL))
        ),
        'deliveryDetails', COALESCE(v_task.delivery_info, v_ticket.delivery_details, '{}'::jsonb)
    );
END;
$$;

-- 3. Recrear confirm_delivery_receipt con cast correcto de timestamp y soporte p_case_number
CREATE OR REPLACE FUNCTION public.confirm_delivery_receipt(
    p_ticket_id text,
    p_received_by text,
    p_dni text,
    p_signature_data_url text,
    p_case_number text DEFAULT NULL
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
    v_now_time text := to_char(now() AT TIME ZONE 'America/Argentina/Buenos_Aires', 'HH24:MI');
    v_now_formatted text := to_char(now() AT TIME ZONE 'America/Argentina/Buenos_Aires', 'DD/MM/YYYY HH24:MI');
    v_new_details jsonb;
    v_new_logistics jsonb;
    v_existing_notes jsonb;
    v_note_text text;
    v_tasks_updated int := 0;
BEGIN
    -- Validar parámetros obligatorios
    IF p_ticket_id IS NULL OR trim(p_ticket_id) = '' OR 
       p_received_by IS NULL OR trim(p_received_by) = '' OR 
       p_dni IS NULL OR trim(p_dni) = '' OR 
       p_signature_data_url IS NULL OR trim(p_signature_data_url) = '' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Parámetros incompletos');
    END IF;

    -- 1. Buscar el ticket principal
    SELECT * INTO v_ticket
    FROM public.tickets
    WHERE id = p_ticket_id;

    IF NOT FOUND THEN
        -- Intentar encontrar por logistics_tasks si fue pasado un caseNumber o subtask id
        SELECT t.* INTO v_ticket
        FROM public.tickets t
        JOIN public.logistics_tasks lt ON lt.ticket_id = t.id
        WHERE lt.case_number = p_ticket_id OR lt.id::text = p_ticket_id
        LIMIT 1;
    END IF;

    IF v_ticket.id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Ticket no encontrado');
    END IF;

    -- 2. Armar nuevo objeto delivery_details
    v_new_details := COALESCE(v_ticket.delivery_details, '{}'::jsonb) || jsonb_build_object(
        'receivedBy', trim(p_received_by),
        'dni', trim(p_dni),
        'signatureDataUrl', p_signature_data_url,
        'deliveredDate', v_now_date,
        'deliveredAt', v_now_iso,
        'actualTime', v_now_time,
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
            'actualTime', v_now_time
        )
    );

    -- Agregar nota de auditoría interna
    v_note_text := format('[%s] ✅ ENTREGA CONFIRMADA DIGITALMENTE: %s (DNI: %s) firmó la recepción desde el celular.', v_now_formatted, trim(p_received_by), trim(p_dni));
    
    v_existing_notes := COALESCE(v_ticket.internal_notes, '[]'::jsonb);
    IF jsonb_typeof(v_existing_notes) = 'array' THEN
        v_existing_notes := v_existing_notes || jsonb_build_array(v_note_text);
    ELSE
        v_existing_notes := jsonb_build_array(v_note_text);
    END IF;

    -- 3. Ejecutar UPDATE sobre el ticket (usar now() para delivery_completed_date que es timestamptz)
    UPDATE public.tickets
    SET 
        status = 'Entregado',
        delivery_completed_date = now(),
        delivery_details = v_new_details,
        logistics = v_new_logistics,
        internal_notes = v_existing_notes
    WHERE id = v_ticket.id;

    -- 4. Actualizar sub-tareas en logistics_tasks
    BEGIN
        IF p_case_number IS NOT NULL AND trim(p_case_number) <> '' THEN
            UPDATE public.logistics_tasks
            SET 
                status = 'Entregado', 
                delivery_info = COALESCE(delivery_info, '{}'::jsonb) || jsonb_build_object(
                    'receivedBy', trim(p_received_by),
                    'dni', trim(p_dni),
                    'signatureDataUrl', p_signature_data_url,
                    'deliveredDate', v_now_date,
                    'actualTime', v_now_time,
                    'confirmedOnline', true
                ),
                updated_at = now()
            WHERE ticket_id = v_ticket.id
              AND (
                  case_number = trim(p_case_number) 
                  OR case_number ILIKE '%' || trim(p_case_number) || '%'
              );
            GET DIAGNOSTICS v_tasks_updated = ROW_COUNT;
        END IF;

        -- Si no se pasó case_number o no coincidió ninguna subtarea específica, actualizar todas las del ticket
        IF v_tasks_updated = 0 THEN
            UPDATE public.logistics_tasks
            SET 
                status = 'Entregado', 
                delivery_info = COALESCE(delivery_info, '{}'::jsonb) || jsonb_build_object(
                    'receivedBy', trim(p_received_by),
                    'dni', trim(p_dni),
                    'signatureDataUrl', p_signature_data_url,
                    'deliveredDate', v_now_date,
                    'actualTime', v_now_time,
                    'confirmedOnline', true
                ),
                updated_at = now()
            WHERE ticket_id = v_ticket.id;
        END IF;
    EXCEPTION WHEN OTHERS THEN
        -- Continuar si logistics_tasks tuviese estructura variable
    END;

    RETURN jsonb_build_object('success', true, 'alreadyConfirmed', false);
END;
$$;

-- 4. Permisos de ejecución para usuarios anónimos y autenticados
GRANT EXECUTE ON FUNCTION public.get_delivery_confirmation_info(text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.confirm_delivery_receipt(text, text, text, text, text) TO anon, authenticated;
