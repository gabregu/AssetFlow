import { supabase } from './supabase';

/**
 * Compresses an image file on the client side using canvas.
 * @param {File} file - The image file to compress.
 * @param {number} maxWidth - Maximum width of the output image.
 * @param {number} maxHeight - Maximum height of the output image.
 * @param {number} quality - JPEG compression quality (0 to 1).
 * @returns {Promise<Blob>} A promise that resolves to the compressed JPEG Blob.
 */
export function compressImage(file, maxWidth = 1024, maxHeight = 1024, quality = 0.7) {
    return new Promise((resolve, reject) => {
        // Safe check for server-side rendering
        if (typeof window === 'undefined') {
            resolve(file);
            return;
        }

        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target.result;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;

                // Maintain aspect ratio
                if (width > height) {
                    if (width > maxWidth) {
                        height = Math.round((height * maxWidth) / width);
                        width = maxWidth;
                    }
                } else {
                    if (height > maxHeight) {
                        width = Math.round((width * maxHeight) / height);
                        height = maxHeight;
                    }
                }

                canvas.width = width;
                canvas.height = height;

                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);

                canvas.toBlob(
                    (blob) => {
                        if (blob) {
                            resolve(blob);
                        } else {
                            resolve(file); // Fallback to original if blob generation fails
                        }
                    },
                    'image/jpeg',
                    quality
                );
            };
            img.onerror = () => resolve(file); // Fallback to original
        };
        reader.onerror = () => resolve(file); // Fallback to original
    });
}

/**
 * Uploads a file (blob or file object) to the 'device-photos' Supabase Storage bucket.
 * Automatically compresses the image on the client side first.
 * @param {File} file - The file to upload.
 * @param {string} fileName - The desired name prefix.
 * @returns {Promise<string>} The public URL of the uploaded image.
 */
export async function uploadDevicePhoto(file, fileName = 'photo') {
    if (!file) throw new Error('No se proporcionó ningún archivo para subir.');

    let uploadData = file;
    // Compilar e intentar comprimir solo si es una imagen válida
    if (file.type && file.type.startsWith('image/')) {
        try {
            uploadData = await compressImage(file);
        } catch (compressErr) {
            console.warn('Fallo al comprimir imagen, subiendo original:', compressErr);
        }
    }
    
    // Generar un nombre de archivo único para evitar colisiones
    const timestamp = Date.now();
    const extension = file.name ? file.name.split('.').pop() : 'jpg';
    const cleanPrefix = fileName.replace(/[^a-zA-Z0-9.-]/g, '_');
    const uniquePath = `${cleanPrefix}_${timestamp}.${extension}`;

    const { data, error } = await supabase.storage
        .from('device-photos')
        .upload(uniquePath, uploadData, {
            cacheControl: '3600',
            upsert: true
        });

    if (error) {
        console.error('Error uploading photo to Supabase storage:', error);
        throw error;
    }

    // Obtener la URL pública del archivo subido
    const { data: publicUrlData } = supabase.storage
        .from('device-photos')
        .getPublicUrl(data.path);

    if (!publicUrlData || !publicUrlData.publicUrl) {
        throw new Error('No se pudo obtener la URL pública de la imagen subida.');
    }

    return publicUrlData.publicUrl;
}
