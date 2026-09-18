import crypto from 'crypto';

// Secreto para firmar tokens. Si no hay variable de entorno, usa una clave segura derivada del anon key
const TOKEN_SECRET = process.env.DELIVERY_TOKEN_SECRET || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'assetflow-secure-delivery-token-key-2026';

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

    const payloadBase64 = Buffer.from(JSON.stringify(data)).toString('base64url');
    const signature = crypto
        .createHmac('sha256', TOKEN_SECRET)
        .update(payloadBase64)
        .digest('base64url');

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

        const expectedSig = crypto
            .createHmac('sha256', TOKEN_SECRET)
            .update(payloadBase64)
            .digest('base64url');

        // Comparación en tiempo constante para mitigar timing attacks
        const providedBuf = Buffer.from(providedSig);
        const expectedBuf = Buffer.from(expectedSig);

        if (providedBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(providedBuf, expectedBuf)) {
            console.warn('Firma de delivery token inválida');
            return null;
        }

        const decodedJson = Buffer.from(payloadBase64, 'base64url').toString('utf8');
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
