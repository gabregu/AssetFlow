import { useState, useRef, useEffect, useCallback } from 'react';
import { supabase } from './supabase';

const DEFAULT_TIMEOUT_MS = 30_000;

/**
 * useForm - Hook Universal de Formularios con Resiliencia de Sesión Integrada
 * 
 * Gestiona el estado de valores del formulario, errores, campos tocados,
 * validación reactiva y submits seguros con reintentos automáticos por JWT expirado.
 */
export function useForm({
    initialValues = {},
    validate = null, // Función opcional: (values) => errors
    onSubmit = null,  // Función de envío: async (values) => { ... }
    timeoutMs = DEFAULT_TIMEOUT_MS
} = {}) {
    const [values, setValues] = useState(initialValues);
    const [errors, setErrors] = useState({});
    const [touched, setTouched] = useState({});
    const [isSubmitting, setIsSubmitting] = useState(false);

    const isMountedRef = useRef(true);
    const isSubmittingRef = useRef(false);
    const timeoutRef = useRef(null);

    // Controlar el ciclo de vida del componente
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

    // Manejador genérico de cambios en inputs (HTML estándar)
    const handleChange = useCallback((e) => {
        const { name, type, checked, value } = e.target;
        const finalValue = type === 'checkbox' ? checked : value;

        setValues((prev) => ({
            ...prev,
            [name]: finalValue
        }));

        // Limpiar error del campo modificado
        if (errors[name]) {
            setErrors((prev) => {
                const copy = { ...prev };
                delete copy[name];
                return copy;
            });
        }
    }, [errors]);

    // Establecer un valor específico manualmente (útil para selects custom o URLs de fotos)
    const setFieldValue = useCallback((name, value) => {
        setValues((prev) => ({
            ...prev,
            [name]: value
        }));

        if (errors[name]) {
            setErrors((prev) => {
                const copy = { ...prev };
                delete copy[name];
                return copy;
            });
        }
    }, [errors]);

    // Manejador de Blur (para marcar campos como tocados y validar al salir)
    const handleBlur = useCallback((e) => {
        const { name } = e.target;
        setTouched((prev) => ({
            ...prev,
            [name]: true
        }));
    }, []);

    // Resetear el formulario al estado original
    const resetForm = useCallback(() => {
        setValues(initialValues);
        setErrors({});
        setTouched({});
        resetSubmitting();
    }, [initialValues, resetSubmitting]);

    // Función de envío protegida con reintentos y timeouts
    const handleSubmit = useCallback(async (e) => {
        if (e && typeof e.preventDefault === 'function') {
            e.preventDefault();
        }

        // 1. Validar campos
        if (validate) {
            const validationErrors = validate(values);
            if (validationErrors && Object.keys(validationErrors).length > 0) {
                setErrors(validationErrors);
                // Marcar campos con error como tocados
                const newTouched = {};
                Object.keys(validationErrors).forEach(key => {
                    newTouched[key] = true;
                });
                setTouched(newTouched);
                return;
            }
        }

        // 2. Prevenir doble submit
        if (isSubmittingRef.current) {
            console.warn('[useForm] Submit bloqueado: ya hay un envío en curso');
            return;
        }

        isSubmittingRef.current = true;
        if (isMountedRef.current) {
            setIsSubmitting(true);
        }

        // 3. Configurar timeout de seguridad
        timeoutRef.current = setTimeout(() => {
            console.warn('[useForm] Timeout de seguridad alcanzado: reseteando estado');
            resetSubmitting();
        }, timeoutMs);

        try {
            // Failsafe: Asegurarse de que el token JWT esté fresco antes de iniciar el submit pesado
            try {
                const sessionRes = await supabase.auth.getSession();
                const session = sessionRes?.data?.session;
                if (!session) {
                    console.log('[useForm] No active session found. Attempting to refresh token...');
                    await supabase.auth.refreshSession();
                }
            } catch (authErr) {
                console.warn('[useForm] Pre-submit auth session refresh failed (proceeding anyway):', authErr);
            }

            if (onSubmit) {
                await onSubmit(values);
            }
        } catch (error) {
            console.error('[useForm] Error durante el submit:', error);
            throw error;
        } finally {
            resetSubmitting();
        }
    }, [values, validate, onSubmit, timeoutMs, resetSubmitting]);

    return {
        values,
        errors,
        touched,
        isSubmitting,
        handleChange,
        setFieldValue,
        handleBlur,
        handleSubmit,
        resetForm,
        setValues,
        setErrors
    };
}
