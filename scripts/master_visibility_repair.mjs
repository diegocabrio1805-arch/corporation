import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
    await supabase.auth.signInWithPassword({
        email: 'DDANTE1983@anexocobro.com',
        password: 'Cobros2026'
    });

    const ADMIN_ID = 'b3716a78-fb4f-4918-8c0b-92004e3d63ec';

    console.log("=== REPARACIÓN MAESTRA DE VISIBILIDAD (DANTE) ===");

    // 1. Unificar Clientes
    console.log("🛠️  Corrigiendo Clientes...");
    const { count: cCount, error: cErr } = await supabase
        .from('clients')
        .update({
            branch_id: ADMIN_ID,
            is_active: true,
            is_hidden: false,
            deleted_at: null
        })
        .or(`branch_id.neq.${ADMIN_ID},branch_id.is.null,is_active.eq.false,is_hidden.eq.true,deleted_at.not.is.null`);

    if (cErr) console.error("Error Clientes:", cErr);
    else console.log(`✅ Clientes actualizados/verificados.`);

    // 2. Unificar Préstamos
    console.log("🛠️  Corrigiendo Préstamos...");
    const { count: lCount, error: lErr } = await supabase
        .from('loans')
        .update({
            branch_id: ADMIN_ID,
            deleted_at: null
            // No tocamos 'status' masivamente yet, pero aseguramos branch y deleted_at
        })
        .or(`branch_id.neq.${ADMIN_ID},branch_id.is.null,deleted_at.not.is.null`);
        
    if (lErr) console.error("Error Préstamos:", lErr);
    else console.log(`✅ Préstamos actualizados/verificados.`);

    // 3. Forzar status 'Activo' para préstamos que no están pagados
    console.log("🛠️  Reactivando préstamos no pagados...");
    const { error: sErr } = await supabase
        .from('loans')
        .update({ status: 'Activo' })
        .is('deleted_at', null)
        .neq('status', 'Pagado');
        
    if (sErr) console.error("Error Status:", sErr);
    else console.log(`✅ Estados de préstamo reactivados.`);

    console.log("\n🚀 ¡REPARACIÓN COMPLETADA! Ahora todos los datos deberían ser visibles para Dante.");
}

main();
