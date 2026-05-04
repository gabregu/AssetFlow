import React, { useState, useEffect, useRef } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { Modal } from './Modal';
import { Button } from './Button';
import { Package, User, Smartphone, Hash, Camera, Upload } from 'lucide-react';
import jsQR from 'jsqr';

export const QRScannerModal = ({ isOpen, onClose, onScanSuccess, validationError, resetValidationError }) => {
    // ... (rest of component)
    // I need to be careful with the context matching. passing the updated import line first.

    // ... inside startScanner ...
    const [scanResult, setScanResult] = useState(null);
    const [cameraError, setCameraError] = useState(false);
    const [technicalError, setTechnicalError] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const fileInputRef = useRef(null);
    const scannerRef = useRef(null); // To store Html5Qrcode instance

    const [hasCameraSupport, setHasCameraSupport] = useState(false);
    const [hasCheckedSupport, setHasCheckedSupport] = useState(false);

    // Initial Support Check
    useEffect(() => {
        if (isOpen) {
            setScanResult(null);
            setCameraError(false);
            setHasCheckedSupport(false);
            if (resetValidationError) resetValidationError();

            // Check if environment supports mediaDevices (HTTPS or localhost required)
            if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
                console.warn("Camera API not available. Likely due to insecure context (HTTP).");
                setHasCameraSupport(false);
                setCameraError(true);
                setHasCheckedSupport(true);
            } else {
                setHasCameraSupport(true);
                setHasCheckedSupport(true);
            }
        }
    }, [isOpen]);

    // Scanner Lifecycle
    useEffect(() => {
        if (isOpen && hasCameraSupport && !cameraError && !scanResult) {
            // Need a small delay to ensure DOM element 'reader' exists
            const timer = setTimeout(() => {
                startScanner();
            }, 100);

            return () => {
                clearTimeout(timer);
                stopScanner();
            };
        }

        return () => {
            stopScanner();
        };
    }, [isOpen, hasCameraSupport, cameraError, scanResult]);

    const startScanner = async () => {
        setCameraError(false);
        
        try {
            // Intentar detener cualquier instancia previa antes de empezar
            if (scannerRef.current) {
                try { 
                    if (scannerRef.current.isScanning) await scannerRef.current.stop(); 
                } catch(e) { console.warn("Error stop pre-scan:", e); }
            }

            const scanner = new Html5Qrcode("reader");
            scannerRef.current = scanner;

            const config = { 
                fps: 15, 
                qrbox: { width: 250, height: 250 },
                aspectRatio: 1.0
            };

            // ESTRATEGIA: Intentar primero facingMode environment (Estándar)
            try {
                await scanner.start(
                    { facingMode: "environment" }, 
                    config, 
                    (decodedText) => handleScan(decodedText)
                );
                console.log("Scanner iniciado con facingMode: environment");
            } catch (err) {
                console.warn("Fallo environment mode, intentando enumerar cámaras...", err);
                
                // FALLBACK: Enumerar cámaras y elegir la última (generalmente la trasera principal)
                const devices = await Html5Qrcode.getCameras();
                if (devices && devices.length > 0) {
                    const cameraId = devices[devices.length - 1].id;
                    await scanner.start(
                        cameraId,
                        config,
                        (decodedText) => handleScan(decodedText)
                    );
                    console.log("Scanner iniciado con CameraID:", cameraId);
                } else {
                    throw new Error("No se encontraron cámaras disponibles.");
                }
            }
        } catch (err) {
            console.error("Error crítico de cámara:", err);
            handleError(err);
        }
    };

    const stopScanner = async () => {
        if (scannerRef.current) {
            try {
                if (scannerRef.current.isScanning) {
                    await scannerRef.current.stop();
                }
                scannerRef.current.clear();
            } catch (err) {
                console.warn("Failed to stop scanner", err);
            }
            scannerRef.current = null;
        }
    };

    const handleScan = (decodedText) => {
        if (decodedText) {
            console.log("Scanned via Camera:", decodedText);
            stopScanner(); // Stop immediately on success
            processResult(decodedText);
        }
    };

    const handleError = (err) => {
        console.error("Camera Error:", err);
        setCameraError(true);
        // Guardar el mensaje técnico para diagnóstico
        setTechnicalError(`${err.name}: ${err.message}`);
        
        if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
            console.warn("Permiso denegado por el usuario.");
        }
    };

    const requestPermissionsAgain = async () => {
        setCameraError(false);
        setHasCheckedSupport(false);
        try {
            // Intentar pedir permiso manualmente antes de iniciar el scanner
            const stream = await navigator.mediaDevices.getUserMedia({ video: true });
            stream.getTracks().forEach(track => track.stop()); // Cerrar inmediatamente
            setHasCameraSupport(true);
            setHasCheckedSupport(true);
            startScanner();
        } catch (err) {
            console.error("Error al re-solicitar permisos:", err);
            setCameraError(true);
            setHasCheckedSupport(true);
        }
    };

    const processResult = (rawText) => {
        if (!rawText) return;
        try {
            const parsed = JSON.parse(rawText);
            setScanResult(parsed);
            if (onScanSuccess) onScanSuccess(parsed);
        } catch (e) {
            // Si no es JSON, mostrar texto plano
            setScanResult({ raw: rawText });
            // Intentar usarlo como ID directamente si parece uno
            if (onScanSuccess) onScanSuccess({ id: rawText, raw: rawText });
        }
    };

    const handleFileUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        setIsLoading(true);
        try {
            const html5QrCode = new Html5Qrcode("reader");
            // scanFile es mucho más potente que jsQR para fotos de cámara
            const decodedText = await html5QrCode.scanFile(file, true);
            if (decodedText) {
                processResult(decodedText);
            }
        } catch (err) {
            console.error("Error al leer archivo QR:", err);
            alert('No se detectó un código QR legible en la imagen. Intenta tomar la foto más de cerca y con buena luz.');
        } finally {
            setIsLoading(false);
            e.target.value = null; // Reset para poder subir la misma foto si falla
        }
    };

    const handleClose = () => {
        stopScanner().then(() => {
            setScanResult(null);
            onClose();
        });
    };

    const handleRetry = () => {
        setScanResult(null);
        if (resetValidationError) resetValidationError();
        // Effect will restart scanner when scanResult becomes null
    };

    return (
        <Modal isOpen={isOpen} onClose={handleClose} title="Escanear Etiqueta QR">
            {!scanResult ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.5rem' }}>

                    {hasCheckedSupport ? (
                        (!cameraError && hasCameraSupport) ? (
                            <div style={{
                                width: '100%',
                                maxWidth: '300px',
                                height: '300px', // Adjusted for Html5Qrcode
                                background: '#000',
                                borderRadius: '12px',
                                overflow: 'hidden',
                                position: 'relative'
                            }}>
                                <div id="reader" style={{ width: '100%', height: '100%' }}></div>
                            </div>
                        ) : (
                            <div style={{
                                width: '100%',
                                padding: '1.5rem',
                                textAlign: 'center',
                                background: '#fef2f2',
                                borderRadius: '12px',
                                color: '#b91c1c',
                                border: '1px solid #fecaca'
                            }}>
                                <Camera size={32} style={{ marginBottom: '0.75rem', opacity: 0.6 }} />
                                <p style={{ fontWeight: 700, marginBottom: '0.25rem' }}>Cámara no disponible</p>
                                <p style={{ fontSize: '0.85rem', lineHeight: '1.4', marginBottom: '1rem' }}>
                                    {hasCameraSupport
                                        ? "No pudimos acceder a la cámara. Haz clic en el icono del CANDADO arriba y permite el acceso."
                                        : "El navegador bloquea la cámara por seguridad (sin HTTPS)."}
                                </p>

                                {technicalError && (
                                    <div style={{ margin: '0.5rem 0 1rem 0', padding: '0.5rem', background: '#fee2e2', borderRadius: '6px', fontSize: '0.65rem', fontFamily: 'monospace', textAlign: 'left', border: '1px solid #f87171' }}>
                                        <b>Error Técnico:</b> {technicalError}
                                    </div>
                                )}
                                
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                    <Button 
                                        variant="primary" 
                                        size="sm" 
                                        onClick={requestPermissionsAgain}
                                        style={{ fontSize: '0.8rem' }}
                                    >
                                        Intentar Pedir Permiso de Nuevo
                                    </Button>
                                    
                                    <div style={{ textAlign: 'left', marginTop: '0.5rem', padding: '0.75rem', background: 'white', borderRadius: '8px', fontSize: '0.75rem' }}>
                                        <p style={{ fontWeight: 700, marginBottom: '0.25rem' }}>Si no aparece el cartel:</p>
                                        <p>• <b>Android:</b> Toca los 3 puntos (⋮) > Configuración > Configuración de sitios > Cámara > Permitir.</p>
                                        <p>• <b>iPhone:</b> Ajustes > Safari > Cámara > Permitir.</p>
                                    </div>
                                </div>
                            </div>
                        )
                    ) : (
                        <div style={{ width: '100%', height: '225px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8fafc', borderRadius: '12px' }}>
                            <p style={{ color: 'var(--text-secondary)' }}>Verificando cámara...</p>
                        </div>
                    )}

                    <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                        <p style={{ textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                            ¿Problemas con la cámara? Sube una foto o tómala directamente:
                        </p>

                        <input
                            type="file"
                            accept="image/*"
                            capture="environment"
                            ref={fileInputRef}
                            style={{ display: 'none' }}
                            onChange={handleFileUpload}
                        />

                        <Button
                            variant="outline"
                            onClick={() => fileInputRef.current?.click()}
                            style={{ width: '100%', justifyContent: 'center', padding: '1rem' }}
                        >
                            <Camera size={20} style={{ marginRight: '8px' }} />
                            Tomar / Subir Foto
                        </Button>
                    </div>

                </div>
            ) : (
                <div style={{ animation: 'fadeIn 0.3s ease-out' }}>
                    <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
                        <div style={{ width: '50px', height: '50px', background: validationError ? '#ef4444' : '#22c55e', borderRadius: '50%', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem auto' }}>
                            {validationError ? <Hash size={28} /> : <Package size={28} />}
                        </div>
                        <h3 style={{ fontSize: '1.2rem', fontWeight: 700 }}>
                            {validationError ? '¡Atención!' : '¡Lectura Exitosa!'}
                        </h3>
                    </div>

                    <div style={{ background: 'var(--background-secondary)', padding: '1.5rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
                        {validationError && (
                            <div style={{
                                marginBottom: '1rem',
                                padding: '1rem',
                                background: '#fef2f2',
                                border: '1px solid #fecaca',
                                borderRadius: '8px',
                                color: '#b91c1c',
                                fontSize: '0.9rem',
                                fontWeight: 500,
                                textAlign: 'center'
                            }}>
                                {validationError}
                            </div>
                        )}

                        {scanResult.id ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', opacity: validationError ? 0.5 : 1 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border)', paddingBottom: '0.5rem' }}>
                                    <span style={{ color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}><Hash size={16} /> ID Servicio</span>
                                    <span style={{ fontWeight: 700 }}>{scanResult.id}</span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border)', paddingBottom: '0.5rem' }}>
                                    <span style={{ color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}><User size={16} /> Solicitante</span>
                                    <span style={{ fontWeight: 600 }}>{scanResult.requester}</span>
                                </div>
                                <div>
                                    <span style={{ color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}><Smartphone size={16} /> Activos</span>
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                                        {scanResult.assets && scanResult.assets.length > 0 ? (
                                            scanResult.assets.map((assetSerial, idx) => (
                                                <span key={idx} style={{ padding: '0.25rem 0.5rem', background: 'var(--primary-color)', color: 'white', borderRadius: '4px', fontSize: '0.85rem' }}>
                                                    {assetSerial}
                                                </span>
                                            ))
                                        ) : (
                                            <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Sin activos detallados</span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div>
                                <h4 style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>Contenido Raw:</h4>
                                <p style={{ wordBreak: 'break-all', fontFamily: 'monospace' }}>{scanResult.raw || JSON.stringify(scanResult)}</p>
                            </div>
                        )}
                    </div>

                    <div style={{ marginTop: '2rem', display: 'flex', justifyContent: 'center' }}>
                        <Button onClick={handleRetry} style={{ width: '100%' }}>
                            {validationError ? 'Intentar Nuevamente' : 'Escanear Otro'}
                        </Button>
                    </div>
                </div>
            )}
        </Modal>
    );
};
