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

    // Encontrar ID de Juve Villalba
    const { data: juve } = await supabase.from('profiles').select('id').eq('username', 'JUVE VILLALBA').single();
    if (!juve) {
        console.log("No encontré a Juve");
        return;
    }

    console.log(`=== ANALIZANDO RUTA DE JUVE VILLALBA (${juve.id}) ===`);

    const { data: loans, error: lErr } = await supabase
        .from('loans')
        .select(`
            id,
            status,
            client_id,
            collector_id,
            deleted_at,
            clients:client_id (id, name, is_active, is_hidden, deleted_at, branch_id)
        `)
        .eq('collector_id', juve.id)
        .eq('status', 'Activo')
        .is('deleted_at', null);

    console.log(`Total Préstamos Activos en DB para Juve: ${loans.length}`);

    loans.forEach(l => {
        const c = l.clients;
        if (!c) {
            console.log(`❌ Préstamo ${l.id} no tiene cliente asociado.`);
            return;
        }
        if (!c.is_active || c.is_hidden || c.deleted_at !== null) {
            console.log(`⚠️ Cliente ${c.name} (${c.id}) oculto/inactivo: is_active=${c.is_active}, is_hidden=${c.is_hidden}, deleted_at=${c.deleted_at}`);
        }
    });

    // También revisar branch_id de los clientes vs branch_id esperado
    // Dante es el manager.
}

main();
