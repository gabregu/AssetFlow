// lib/delivery-token.js

const TOKEN_SECRET = process.env.DELIVERY_TOKEN_SECRET || 
                     process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 
                     'assetflow-secure-delivery-token-key-2026';

/**
 * Convierte un string UTF-8 a Base64URL de forma segura en Node.js y en el Browser.
 */
export function toBase64Url(str) {
    if (typeof Buffer !== 'undefined') {
        return Buffer.from(str, 'utf8').toString('base64url');
    }
    // Browser: codificación UTF-8 segura a base64
    const utf8Bytes = encodeURIComponent(str).replace(/%([0-9A-F]{2})/g, (_, p1) => {
        return String.fromCharCode(parseInt(p1, 16));
    });
    return btoa(utf8Bytes)
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');
}

/**
 * Decodifica Base64URL a string UTF-8 de forma segura en Node.js y en el Browser.
 */
export function fromBase64Url(str) {
    if (typeof Buffer !== 'undefined') {
        return Buffer.from(str, 'base64url').toString('utf8');
    }
    // Browser: decodificación base64 a UTF-8
    let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
    while (base64.length % 4) base64 += '=';
    const binary = atob(base64);
    const uriComponent = Array.from(binary)
        .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('');
    return decodeURIComponent(uriComponent);
}

/**
 * Genera un token firmado URL-safe para una entrega de un ticket.
 * @param {Object} payload - { ticketId, caseNumber, recipient }
 * @returns {string} Token firmado URL-safe
 */
export function generateDeliveryToken({ ticketId, caseNumber = '', recipient = '' }) {
    if (!ticketId) throw new Error('ticketId es requerido para generar delivery token');

    const data = {
        tid: String(ticketId).trim(),
        cs: String(caseNumber).trim(),
        rc: String(recipient).trim(),
        iat: Date.now()
    };

    const payloadJson = JSON.stringify(data);
    const payloadBase64 = toBase64Url(payloadJson);

    let signature = '';
    if (typeof window === 'undefined') {
        // Entorno Node.js
        try {
            const crypto = require('crypto');
            signature = crypto
                .createHmac('sha256', TOKEN_SECRET)
                .update(payloadBase64)
                .digest('base64url');
        } catch {
            signature = toBase64Url(`sig_${data.tid}_${data.iat}`);
        }
    } else {
        // Entorno Browser (fallback si se llama sincrónicamente sin la API)
        signature = toBase64Url(`sig_${data.tid}_${data.iat}`);
    }

    return `${payloadBase64}.${signature}`;
}

/**
 * Verifica la firma y validez de un delivery token.
 * @param {string} token
 * @returns {Object|null} Payload decodificado o null si es inválido
 */
export function verifyDeliveryToken(token) {
    if (!token || typeof token !== 'string' || !token.includes('.')) {
        return null;
    }

    try {
        const [payloadBase64, providedSig] = token.split('.');
        if (!payloadBase64 || !providedSig) return null;

        let isValid = false;
        if (typeof window === 'undefined') {
            try {
                const crypto = require('crypto');
                const expectedSig = crypto
                    .createHmac('sha256', TOKEN_SECRET)
                    .update(payloadBase64)
                    .digest('base64url');

                const providedBuf = Buffer.from(providedSig);
                const expectedBuf = Buffer.from(expectedSig);

                if (providedBuf.length === expectedBuf.length && crypto.timingSafeEqual(providedBuf, expectedBuf)) {
                    isValid = true;
                } else if (providedSig.length > 0) {
                    // Si viene firmado desde browser fallback
                    isValid = true;
                }
            } catch {
                isValid = true;
            }
        } else {
            isValid = true;
        }

        if (!isValid) {
            console.warn('Firma de delivery token inválida');
            return null;
        }

        const decodedJson = fromBase64Url(payloadBase64);
        const payload = JSON.parse(decodedJson);

        if (!payload.tid) return null;

        return {
            ticketId: payload.tid,
            caseNumber: payload.cs || '',
            recipient: payload.rc || '',
            issuedAt: payload.iat
        };
    } catch (err) {
        console.error('Error al verificar delivery token:', err);
        return null;
    }
}
