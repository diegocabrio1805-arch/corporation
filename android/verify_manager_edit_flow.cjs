const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const envLocal = fs.readFileSync(path.join(__dirname, '../.env.local'), 'utf-8');
const lines = envLocal.split('\n');
let supabaseUrl = '';
let supabaseKeyAnon = '';

for (const line of lines) {
    if (line.startsWith('VITE_SUPABASE_URL=')) supabaseUrl = line.split('=')[1].trim().replace(/^"|"$/g, '');
    if (line.startsWith('VITE_SUPABASE_ANON_KEY=')) supabaseKeyAnon = line.split('=')[1].trim().replace(/^"|"$/g, '');
}

// Emulate exactly what the React App does (using Anon Key)
const supabase = createClient(supabaseUrl, supabaseKeyAnon);

async function verifyFlow() {
    console.log("=== PASO 1: Iniciar Sesión como Gerente ===");
    const { data: managerData, error: managerError } = await supabase.auth.signInWithPassword({
        email: 'alterfin@anexocobro.com',
        password: '20252026'
    });

    if (managerError) {
        console.error("❌ Falló login Gerente:", managerError.message);
        return;
    }
    console.log("✅ Gerente logueado (ID: " + managerData.user.id + ")");

    console.log("\n=== PASO 2: Gerente 'Edita' a su Cobrador ===");
    // Vamos a poner de usuario: cobradorprueba y clave: pruebanueva
    const newUsername = "cobradorprueba" + Math.floor(Math.random() * 1000);
    const newPassword = "pruebanueva" + Math.floor(Math.random() * 1000);
    const collectorId = "550e8400-e29b-41d4-a716-446655440000";

    // A) Ejecutar el Edge Function para actualizar auth.users
    const payload = { userId: collectorId, newUsername: newUsername, newPassword: newPassword };
    console.log("Llamando a Edge Function 'update-auth-user'...");
    const { data: edgeData, error: edgeError } = await supabase.functions.invoke('update-auth-user', {
        body: payload
    });

    if (edgeError) {
        console.error("❌ Falló Edge Function:", edgeError.message || edgeError);
    } else {
        console.log("✅ Edge Function respondió ÉXITO");
    }

    // B) Sincronizar el perfil (Upsert que antes daba fallos por strings vacíos y UUID)
    const profilePayload = {
        id: collectorId,
        name: "ALTERFINZONA01",
        username: newUsername,
        password: newPassword,
        role: "Cobrador",
        managed_by: managerData.user.id,
        expiry_date: null, // Corrección de string vacío
        requires_location: false
    };

    console.log("Guardando en tabla perfiles...");
    const { data: upsertData, error: upsertError } = await supabase.from('profiles').upsert([profilePayload]);
    if (upsertError) {
        console.error("❌ Falló actualización de Perfil:", upsertError.message);
    } else {
        console.log("✅ Perfil guardado sin errores (sin error de UUID = texto)");
    }

    console.log("\n=== PASO 3: Intentar Entrar como el Cobrador Editado ===");
    // Cerrar sesión del gerente primero
    await supabase.auth.signOut();

    console.log(`Intentando login con -> Usuario: ${newUsername} | Clave: ${newPassword}`);
    const { data: collectorData, error: collectorError } = await supabase.auth.signInWithPassword({
        email: newUsername + '@anexocobro.com',
        password: newPassword
    });

    if (collectorError) {
        console.error("❌ NO SE PUDO ENTRAR AL COBRADOR:", collectorError.message);
    } else {
        console.log("🎉🎉 ¡ÉXITO! ¡EL COBRADOR LOGRÓ ENTRAR CON SU NUEVA CLAVE! 🎉🎉");
        console.log("User ID Autenticado:", collectorData.user.id);
    }
}

verifyFlow();
