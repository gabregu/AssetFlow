'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useParams } from 'next/navigation';
import {
    Package,
    ShieldCheck,
    CheckCircle2,
    Clock,
    User,
    CreditCard,
    PenTool,
    RotateCcw,
    AlertCircle,
    Laptop,
    Smartphone,
    Key,
    HelpCircle,
    Building2,
    Calendar
} from 'lucide-react';

export default function ConfirmacionEntregaPage() {
    const params = useParams();
    const token = params?.token;

    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [deliveryInfo, setDeliveryInfo] = useState(null);
    const [error, setError] = useState(null);
    const [success, setSuccess] = useState(false);

    // Form states
    const [recipientName, setRecipientName] = useState('');
    const [recipientDni, setRecipientDni] = useState('');
    const [hasSignature, setHasSignature] = useState(false);
    const [termsAccepted, setTermsAccepted] = useState(true);

    // Canvas Signature Pad
    const canvasRef = useRef(null);
    const isDrawingRef = useRef(false);
    const lastPointRef = useRef({ x: 0, y: 0 });

    useEffect(() => {
        if (!token) return;

        const fetchInfo = async () => {
            try {
                setLoading(true);
                setError(null);
                const res = await fetch(`/api/confirm-delivery?token=${encodeURIComponent(token)}`);
                const data = await res.json();

                if (!res.ok || data.error) {
                    setError(data.error || 'Enlace de confirmación no válido o expirado.');
                    return;
                }

                setDeliveryInfo(data);
                if (data.recipientName) {
                    setRecipientName(data.recipientName);
                }
                if (data.isConfirmed) {
                    setSuccess(true);
                }
            } catch (err) {
                console.error('Error cargando información de entrega:', err);
                setError('No pudimos conectar con el servidor. Por favor verificá tu conexión a internet.');
            } finally {
                setLoading(false);
            }
        };

        fetchInfo();
    }, [token]);

    // Canvas setup with Hi-DPI scaling
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        const ratio = window.devicePixelRatio || 1;
        const rect = canvas.getBoundingClientRect();

        canvas.width = rect.width * ratio;
        canvas.height = rect.height * ratio;
        ctx.scale(ratio, ratio);

        ctx.strokeStyle = '#0f172a';
        ctx.lineWidth = 2.5;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
    }, [loading, success]);

    const getCanvasCoordinates = (e) => {
        const canvas = canvasRef.current;
        if (!canvas) return { x: 0, y: 0 };
        const rect = canvas.getBoundingClientRect();

        if (e.touches && e.touches.length > 0) {
            return {
                x: e.touches[0].clientX - rect.left,
                y: e.touches[0].clientY - rect.top
            };
        }
        return {
            x: e.clientX - rect.left,
            y: e.clientY - rect.top
        };
    };

    const handlePointerStart = (e) => {
        if (e.cancelable && e.type.startsWith('touch')) {
            e.preventDefault();
        }
        const coords = getCanvasCoordinates(e);
        isDrawingRef.current = true;
        lastPointRef.current = coords;

        const canvas = canvasRef.current;
        const ctx = canvas?.getContext('2d');
        if (ctx) {
            ctx.beginPath();
            ctx.moveTo(coords.x, coords.y);
        }
    };

    const handlePointerMove = (e) => {
        if (!isDrawingRef.current) return;
        if (e.cancelable && e.type.startsWith('touch')) {
            e.preventDefault();
        }

        const coords = getCanvasCoordinates(e);
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext('2d');

        if (ctx) {
            ctx.lineTo(coords.x, coords.y);
            ctx.stroke();
            lastPointRef.current = coords;
            if (!hasSignature) setHasSignature(true);
        }
    };

    const handlePointerEnd = () => {
        isDrawingRef.current = false;
    };

    const handleClearSignature = () => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        setHasSignature(false);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!recipientName.trim()) {
            alert('Por favor completá tu Nombre y Apellido.');
            return;
        }

        if (!recipientDni.trim()) {
            alert('Por favor completá tu número de DNI o documento.');
            return;
        }

        if (!hasSignature || !canvasRef.current) {
            alert('Por favor realizá tu firma en el recuadro antes de confirmar.');
            return;
        }

        if (!termsAccepted) {
            alert('Debes tildar la casilla de conformidad de recepción.');
            return;
        }

        try {
            setSubmitting(true);
            const signatureDataUrl = canvasRef.current.toDataURL('image/png');

            const res = await fetch('/api/confirm-delivery', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    token,
                    recipientName: recipientName.trim(),
                    recipientDni: recipientDni.trim(),
                    signatureDataUrl
                })
            });

            const data = await res.json();
            if (!res.ok || data.error) {
                alert(data.error || 'Ocurrió un error al registrar la firma.');
                return;
            }

            setSuccess(true);
        } catch (err) {
            console.error('Error al enviar confirmación:', err);
            alert('Error de conexión al enviar tu firma. Por favor intentá nuevamente.');
        } finally {
            setSubmitting(false);
        }
    };

    const getItemIcon = (type) => {
        const lower = String(type || '').toLowerCase();
        if (lower.includes('laptop') || lower.includes('notebook') || lower.includes('macbook')) {
            return <Laptop size={18} color="#2563eb" />;
        }
        if (lower.includes('smart') || lower.includes('cel') || lower.includes('phone')) {
            return <Smartphone size={18} color="#7c3aed" />;
        }
        if (lower.includes('key') || lower.includes('yubi') || lower.includes('security')) {
            return <Key size={18} color="#d97706" />;
        }
        return <Package size={18} color="#059669" />;
    };

    // Extraer lista de items para mostrar
    const renderItemsList = () => {
        // 1. Si el backend ya devolvió la lista unificada y limpia de items
        const rawItems = Array.isArray(deliveryInfo?.items) ? deliveryInfo.items : [];
        const cleanItems = rawItems.filter(it => 
            it && 
            it.name && 
            !['filtersize', 'filter_size', 'screenfiltersize'].includes(String(it.name).toLowerCase().trim())
        );

        if (cleanItems.length > 0) {
            return cleanItems.map((it, idx) => (
                <div
                    key={`item-${idx}`}
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.75rem',
                        padding: '0.75rem 1rem',
                        background: '#ffffff',
                        border: '1px solid #e2e8f0',
                        borderRadius: '10px',
                        marginBottom: '0.5rem'
                    }}
                >
                    <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        {getItemIcon(it.type)}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: '0.9rem', fontWeight: 600, color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {it.name}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                            {it.type} {it.serial && it.serial !== '-' && <span>· S/N: <strong style={{ color: '#1e293b' }}>{it.serial}</strong></span>}
                        </div>
                    </div>
                </div>
            ));
        }

        // 2. Fallback de extracción cliente
        const items = [];

        // Activos asociados (objetos o strings)
        if (Array.isArray(deliveryInfo?.associatedAssets)) {
            deliveryInfo.associatedAssets.forEach((a, i) => {
                if (typeof a === 'object' && a !== null) {
                    items.push({
                        key: `asset-${i}`,
                        type: a.type || a.deviceType || 'Equipo',
                        name: a.model || a.name || a.description || 'Dispositivo',
                        serial: a.serial || a.id || '-'
                    });
                } else if (typeof a === 'string' && a.trim()) {
                    items.push({
                        key: `asset-${i}`,
                        type: 'Equipo',
                        name: 'Dispositivo Registrado',
                        serial: a.trim()
                    });
                }
            });
        }

        // Accesorios (estándar y personalizados)
        if (deliveryInfo?.accessories && typeof deliveryInfo.accessories === 'object') {
            const acc = deliveryInfo.accessories;
            const standardKeys = ['mouse', 'keyboard', 'headset', 'charger', 'backpack', 'screenFilter', 'filterSize', 'filter_size'];

            if (acc.backpack) items.push({ key: 'acc-backpack', type: 'Accesorio', name: 'Mochila Técnica', serial: '-' });
            if (acc.screenFilter) items.push({ key: 'acc-filter', type: 'Accesorio', name: `Filtro de Pantalla ${acc.filterSize || ''}`.trim(), serial: '-' });
            if (acc.mouse) items.push({ key: 'acc-mouse', type: 'Accesorio', name: 'Mouse Óptico', serial: '-' });
            if (acc.keyboard) items.push({ key: 'acc-keyboard', type: 'Accesorio', name: 'Teclado USB', serial: '-' });
            if (acc.headset) items.push({ key: 'acc-headset', type: 'Accesorio', name: 'Auriculares con Micrófono', serial: '-' });
            if (acc.charger) items.push({ key: 'acc-charger', type: 'Accesorio', name: 'Cargador Original', serial: '-' });

            Object.entries(acc).forEach(([key, val]) => {
                if (!standardKeys.includes(key) && (val === true || val === 'true')) {
                    items.push({ key: `acc-custom-${key}`, type: 'Accesorio', name: key, serial: '-' });
                }
            });
        }

        // YubiKeys
        if (Array.isArray(deliveryInfo?.yubikeys)) {
            deliveryInfo.yubikeys.forEach((yk, i) => {
                items.push({
                    key: `yk-${i}`,
                    type: 'Security Key',
                    name: 'YubiKey (Hardware Key)',
                    serial: yk.serial || '-'
                });
            });
        }

        if (items.length === 0) {
            return (
                <div style={{ padding: '1rem', background: '#f8fafc', borderRadius: '8px', textAlign: 'center', color: '#64748b', fontSize: '0.85rem' }}>
                    Equipamiento registrado para este servicio.
                </div>
            );
        }

        return items.map((it) => (
            <div
                key={it.key}
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.75rem',
                    padding: '0.75rem 1rem',
                    background: '#ffffff',
                    border: '1px solid #e2e8f0',
                    borderRadius: '10px',
                    marginBottom: '0.5rem'
                }}
            >
                <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {getItemIcon(it.type)}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '0.9rem', fontWeight: 600, color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {it.name}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                        {it.type} {it.serial !== '-' && <span>· S/N: <strong style={{ color: '#1e293b' }}>{it.serial}</strong></span>}
                    </div>
                </div>
            </div>
        ));
    };

    if (loading) {
        return (
            <div style={{ minHeight: '100vh', background: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
                <div style={{ textAlign: 'center' }}>
                    <div style={{ width: '40px', height: '40px', border: '3px solid #e2e8f0', borderTopColor: '#2563eb', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 1rem auto' }} />
                    <p style={{ fontSize: '0.9rem', color: '#64748b', fontWeight: 500 }}>Cargando comprobante de entrega...</p>
                </div>
                <style jsx>{`
                    @keyframes spin {
                        from { transform: rotate(0deg); }
                        to { transform: rotate(360deg); }
                    }
                `}</style>
            </div>
        );
    }

    if (error) {
        return (
            <div style={{ minHeight: '100vh', background: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
                <div style={{ maxWidth: '440px', width: '100%', background: '#ffffff', borderRadius: '16px', padding: '2rem', textAlign: 'center', boxShadow: '0 4px 20px rgba(0,0,0,0.06)', border: '1px solid #fee2e2' }}>
                    <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: '#fee2e2', color: '#dc2626', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem auto' }}>
                        <AlertCircle size={32} />
                    </div>
                    <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#991b1b', marginBottom: '0.5rem' }}>Enlace no disponible</h2>
                    <p style={{ fontSize: '0.9rem', color: '#64748b', lineHeight: 1.5, marginBottom: '1.5rem' }}>{error}</p>
                    <p style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Si recibiste un paquete, por favor comunicate con el remitente o el equipo de soporte técnico.</p>
                </div>
            </div>
        );
    }

    if (success) {
        return (
            <div style={{ minHeight: '100vh', background: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
                <div style={{ maxWidth: '460px', width: '100%', background: '#ffffff', borderRadius: '16px', padding: '2.5rem 2rem', textAlign: 'center', boxShadow: '0 4px 24px rgba(0,0,0,0.06)', border: '1px solid #d1fae5' }}>
                    <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1.25rem' }}>
                        <img 
                            src="/assetflow-yaw-logo.png" 
                            alt="AssetFlow by YAW Informatica" 
                            style={{ 
                                width: '100%',
                                maxWidth: '280px',
                                height: 'auto',
                                maxHeight: '80px',
                                objectFit: 'contain',
                                mixBlendMode: 'multiply'
                            }} 
                        />
                    </div>
                    <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: '#d1fae5', color: '#059669', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.25rem auto' }}>
                        <CheckCircle2 size={36} />
                    </div>
                    <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#065f46', marginBottom: '0.5rem' }}>
                        ¡Recepción Confirmada!
                    </h2>
                    <p style={{ fontSize: '0.95rem', color: '#475569', lineHeight: 1.5, marginBottom: '1.5rem' }}>
                        Gracias <strong style={{ color: '#0f172a' }}>{recipientName || 'por tu confirmación'}</strong>. El comprobante de entrega y tu firma digital han sido registrados exitosamente en el sistema.
                    </p>

                    <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '1rem', textAlign: 'left', marginBottom: '1.5rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', fontSize: '0.8rem', color: '#64748b' }}>
                            <span>Servicio:</span>
                            <strong style={{ color: '#0f172a' }}>{deliveryInfo?.caseNumber || `#${deliveryInfo?.id}`}</strong>
                        </div>
                        {deliveryInfo?.client && (
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', fontSize: '0.8rem', color: '#64748b' }}>
                                <span>Cliente:</span>
                                <strong style={{ color: '#0f172a' }}>{deliveryInfo.client}</strong>
                            </div>
                        )}
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: '#64748b' }}>
                            <span>Estado:</span>
                            <span style={{ background: '#dcfce7', color: '#15803d', padding: '2px 8px', borderRadius: '6px', fontWeight: 700, fontSize: '0.75rem' }}>
                                Entregado ✓
                            </span>
                        </div>
                    </div>

                    <p style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                        🔒 Comprobante firmado digitalmente y cerrado. Ya podés cerrar esta pestaña.
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div style={{ minHeight: '100vh', background: '#f8fafc', padding: '1.5rem 1rem 3rem 1rem', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
            <div style={{ maxWidth: '480px', margin: '0 auto' }}>

                {/* Brand Header */}
                <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
                    <div style={{ 
                        display: 'flex', 
                        justifyContent: 'center', 
                        alignItems: 'center',
                        marginBottom: '1rem',
                        padding: '0 0.5rem'
                    }}>
                        <img 
                            src="/assetflow-yaw-logo.png" 
                            alt="AssetFlow by YAW Informatica" 
                            style={{ 
                                width: '100%', 
                                maxWidth: '380px',
                                height: 'auto',
                                maxHeight: '120px',
                                objectFit: 'contain',
                                display: 'block',
                                mixBlendMode: 'multiply'
                            }} 
                        />
                    </div>
                    <h1 style={{ fontSize: '1.45rem', fontWeight: 800, color: '#0f172a', margin: '0 0 0.35rem 0' }}>
                        Confirmación de Recepción
                    </h1>
                    <p style={{ fontSize: '0.85rem', color: '#64748b', margin: 0 }}>
                        Servicio <strong>{deliveryInfo?.caseNumber || `#${deliveryInfo?.id}`}</strong> {deliveryInfo?.client && `· ${deliveryInfo.client}`}
                    </p>
                </div>

                {/* Items Summary Card */}
                <div style={{ background: '#ffffff', borderRadius: '16px', border: '1px solid #e2e8f0', padding: '1.25rem', marginBottom: '1.25rem', boxShadow: '0 2px 10px rgba(0,0,0,0.03)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
                        <Package size={16} color="#475569" />
                        <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                            Equipos en este envío
                        </span>
                    </div>
                    {renderItemsList()}
                </div>

                {/* Signing Form */}
                <form onSubmit={handleSubmit} style={{ background: '#ffffff', borderRadius: '16px', border: '1px solid #e2e8f0', padding: '1.25rem', boxShadow: '0 2px 10px rgba(0,0,0,0.03)' }}>
                    <div style={{ marginBottom: '1.25rem' }}>
                        <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                            Datos del Receptor
                        </span>
                    </div>

                    <div style={{ marginBottom: '1rem' }}>
                        <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#1e293b', marginBottom: '0.35rem' }}>
                            Nombre y Apellido completo *
                        </label>
                        <div style={{ position: 'relative' }}>
                            <User size={16} color="#94a3b8" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
                            <input
                                type="text"
                                required
                                value={recipientName}
                                onChange={e => setRecipientName(e.target.value)}
                                placeholder="Ej: Martina Agata Panetta"
                                style={{
                                    width: '100%',
                                    padding: '0.65rem 0.75rem 0.65rem 2.25rem',
                                    borderRadius: '10px',
                                    border: '1px solid #cbd5e1',
                                    fontSize: '0.9rem',
                                    outline: 'none',
                                    color: '#0f172a',
                                    boxSizing: 'border-box'
                                }}
                            />
                        </div>
                    </div>

                    <div style={{ marginBottom: '1.25rem' }}>
                        <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#1e293b', marginBottom: '0.35rem' }}>
                            DNI / Documento de Identidad *
                        </label>
                        <div style={{ position: 'relative' }}>
                            <CreditCard size={16} color="#94a3b8" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
                            <input
                                type="text"
                                inputMode="numeric"
                                required
                                value={recipientDni}
                                onChange={e => setRecipientDni(e.target.value)}
                                placeholder="Ej: 38450123"
                                style={{
                                    width: '100%',
                                    padding: '0.65rem 0.75rem 0.65rem 2.25rem',
                                    borderRadius: '10px',
                                    border: '1px solid #cbd5e1',
                                    fontSize: '0.9rem',
                                    outline: 'none',
                                    color: '#0f172a',
                                    boxSizing: 'border-box'
                                }}
                            />
                        </div>
                    </div>

                    {/* Signature Canvas Pad */}
                    <div style={{ marginBottom: '1.25rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                            <label style={{ fontSize: '0.85rem', fontWeight: 600, color: '#1e293b' }}>
                                Firma Digital (Dibujá en el recuadro) *
                            </label>
                            {hasSignature && (
                                <button
                                    type="button"
                                    onClick={handleClearSignature}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '4px',
                                        background: 'transparent',
                                        border: 'none',
                                        color: '#ef4444',
                                        fontSize: '0.75rem',
                                        fontWeight: 600,
                                        cursor: 'pointer',
                                        padding: '2px 4px'
                                    }}
                                >
                                    <RotateCcw size={12} /> Borrar firma
                                </button>
                            )}
                        </div>

                        <div
                            style={{
                                border: `2px solid ${hasSignature ? '#10b981' : '#cbd5e1'}`,
                                borderRadius: '12px',
                                overflow: 'hidden',
                                background: '#ffffff',
                                touchAction: 'none',
                                position: 'relative'
                            }}
                        >
                            <canvas
                                ref={canvasRef}
                                style={{
                                    width: '100%',
                                    height: '140px',
                                    display: 'block',
                                    cursor: 'crosshair',
                                    background: '#ffffff'
                                }}
                                onMouseDown={handlePointerStart}
                                onMouseMove={handlePointerMove}
                                onMouseUp={handlePointerEnd}
                                onMouseLeave={handlePointerEnd}
                                onTouchStart={handlePointerStart}
                                onTouchMove={handlePointerMove}
                                onTouchEnd={handlePointerEnd}
                            />
                            {!hasSignature && (
                                <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', pointerEvents: 'none', color: '#94a3b8', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <PenTool size={14} /> Firmá aquí con el dedo
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Conformity Checkbox */}
                    <div style={{ marginBottom: '1.5rem', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '0.75rem' }}>
                        <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.6rem', fontSize: '0.8rem', color: '#475569', cursor: 'pointer', lineHeight: 1.4 }}>
                            <input
                                type="checkbox"
                                checked={termsAccepted}
                                onChange={e => setTermsAccepted(e.target.checked)}
                                style={{ marginTop: '2px', accentColor: '#2563eb' }}
                            />
                            <span>
                                Declaro haber recibido en conformidad los activos indicados precedentemente en buen estado y funcionamiento.
                            </span>
                        </label>
                    </div>

                    {/* Submit Button */}
                    <button
                        type="submit"
                        disabled={submitting}
                        style={{
                            width: '100%',
                            padding: '0.85rem',
                            borderRadius: '10px',
                            background: submitting ? '#94a3b8' : '#2563eb',
                            color: '#ffffff',
                            fontWeight: 700,
                            fontSize: '0.95rem',
                            border: 'none',
                            cursor: submitting ? 'not-allowed' : 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '0.5rem',
                            boxShadow: '0 4px 12px rgba(37,99,235,0.25)',
                            transition: 'all 0.2s'
                        }}
                    >
                        {submitting ? (
                            <>Guardando firma digital...</>
                        ) : (
                            <>
                                <CheckCircle2 size={18} /> Confirmar Recepción
                            </>
                        )}
                    </button>
                </form>

                {/* Footer Assurance */}
                <div style={{ textAlign: 'center', marginTop: '1.5rem', color: '#94a3b8', fontSize: '0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                    <ShieldCheck size={14} /> Transmisión cifrada punto a punto · AssetFlow
                </div>

            </div>
        </div>
    );
}
