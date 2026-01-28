const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

// --- UTILS: Cargar .env.local manualmente (Sin dependencias externas) ---
function loadEnvConfig() {
    try {
        const envPath = path.resolve(__dirname, '../.env.local');
        if (!fs.existsSync(envPath)) return {};
        const envContent = fs.readFileSync(envPath, 'utf-8');
        const config = {};
        envContent.split('\n').forEach(line => {
            const [key, ...valueParts] = line.split('=');
            if (key && valueParts.length > 0) {
                config[key.trim()] = valueParts.join('=').trim().replace(/(^"|"$)/g, ''); // Quitar comillas
            }
        });
        return config;
    } catch (e) {
        console.warn('Advertencia: No se pudo leer .env.local');
        return {};
    }
}

// 1. Configuración
const env = loadEnvConfig();
// Prioridad: Variables de Entorno del sistema > .env.local
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Error Crítico: No se encontraron las credenciales de Supabase (URL/KEY).');
    console.error('Asegúrate de tener un archivo .env.local en la raíz del proyecto.');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// 2. Interfaz Interactiva
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

const ask = (query) => new Promise(resolve => rl.question(query, resolve));

// 3. Lógica Principal
async function createAdminSecure() {
    console.log('\n🔐 --- GESTOR DE USUARIOS SEGURO (AssetFlow) ---');
    console.log('Este script permite crear o validar un usuario sin exponer contraseñas en código.\n');

    try {
        const email = await ask('📧 Ingresa el Email del Admin: ');
        if (!email) throw new Error('El email es requerido.');

        const password = await ask('🔑 Ingresa la Contraseña: ');
        if (!password || password.length < 6) throw new Error('La contraseña debe tener al menos 6 caracteres.');

        console.log(`\n⏳ Conectando a Supabase [${supabaseUrl}]...`);

        // Intento de Login
        const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
            email,
            password
        });

        if (signInData?.user) {
            console.log('\n✅ ÉXITO: El usuario ya existe y las credenciales son válidas.');
            console.log(`   ID: ${signInData.user.id}`);
            console.log(`   Rol Actual (Auth): ${signInData.user.role}`);
        } else {
            console.log('\n⚠️  Login fallido o usuario inexistente.');
            console.log('   Intentando registrar nuevo usuario...');

            // Intento de Registro
            const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
                email,
                password,
                options: {
                    data: { full_name: 'Admin Manual', role: 'pending' } // Se crea como pending por seguridad
                }
            });

            if (signUpError) {
                console.error(`\n❌ ERROR AL CREAR USUARIO: ${signUpError.message}`);
                if (signUpError.message.includes('already registered')) {
                    console.log('-> El usuario existe pero la contraseña no coincide. Usa "Reset Password" en la web.');
                }
            } else {
                console.log('\n✨ USUARIO CREADO CORRECTAMENTE ✨');
                console.log('NOTA: El usuario se ha creado con estado "pending" o por defecto.');
                console.log('      Un Administrador existente debe aprobarlo en la base de datos.');
            }
        }

    } catch (error) {
        console.error(`\n❌ Error: ${error.message}`);
    } finally {
        rl.close();
        process.exit(0);
    }
}

createAdminSecure();
