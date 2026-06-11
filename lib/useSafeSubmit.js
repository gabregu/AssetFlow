/**
 * useSafeSubmit - Hook universal para formularios
 *
 * Resuelve el problema de "Procesando..." bloqueado cuando el usuario:
 * - Sale a otra pestaña/app mientras el form está guardando
 * - Copia texto de otro lado y vuelve
 * - El componente se desmonta/remonta durante el submit
 *
 * Características:
 * - Timeout automático de 30 segundos (resetea el estado si tarda demasiado)
 * - Ref-based: sobrevive re-renders sin quedarse bloqueado
 * - Previene doble submit
 * - Siempre resetea el estado, sin importar si hay error, éxito o timeout
 */

import { useState, useRef, useEffect, useCallback } from 'react';

const SUBMIT_TIMEOUT_MS = 30_000; // 30 segundos máximo por submit

export function useSafeSubmit() {
    const [isSubmitting, setIsSubmitting] = useState(false);
    const isMountedRef = useRef(true);
    const timeoutRef = useRef(null);
    const isSubmittingRef = useRef(false);

    // Limpiar al desmontar
    useEffect(() => {
        isMountedRef.current = true;
        return () => {
            isMountedRef.current = false;
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
            }
        };
    }, []);

    // Reiniciar el estado de submit de forma segura
    const resetSubmitting = useCallback(() => {
        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
            timeoutRef.current = null;
        }
        isSubmittingRef.current = false;
        if (isMountedRef.current) {
            setIsSubmitting(false);
        }
    }, []);

    /**
     * Wrappea una función async de submit con protección completa.
     * Uso: const { isSubmitting, safeSubmit } = useSafeSubmit();
     *      await safeSubmit(async () => { ... tu lógica de guardado ... });
     */
    const safeSubmit = useCallback(async (asyncFn) => {
        // Prevenir doble submit
        if (isSubmittingRef.current) {
            console.warn('[useSafeSubmit] Submit ignorado - ya hay uno en curso');
            return;
        }

        isSubmittingRef.current = true;
        if (isMountedRef.current) {
            setIsSubmitting(true);
        }

        // Timeout de seguridad: si tarda más de 30s, resetear automáticamente
        timeoutRef.current = setTimeout(() => {
            console.warn('[useSafeSubmit] Timeout de seguridad alcanzado - reseteando estado');
            resetSubmitting();
        }, SUBMIT_TIMEOUT_MS);

        try {
            const result = await asyncFn();
            return result;
        } catch (error) {
            console.error('[useSafeSubmit] Error en submit:', error);
            throw error;
        } finally {
            resetSubmitting();
        }
    }, [resetSubmitting]);

    return { isSubmitting, safeSubmit, resetSubmitting };
}
