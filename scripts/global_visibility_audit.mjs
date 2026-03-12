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

    console.log("=== ANÁLISIS GLOBAL DE VISIBILIDAD DE PRÉSTAMOS ACTIVOS ===");

    const { data: loans, error: lErr } = await supabase
        .from('loans')
        .select(`
            id,
            status,
            client_id,
            collector_id,
            branch_id,
            clients:client_id (id, name, is_active, is_hidden, deleted_at, branch_id)
        `)
        .eq('status', 'Activo')
        .is('deleted_at', null);

    if (lErr) {
        console.error("Error:", lErr);
        return;
    }

    let invisibleCount = 0;
    let mismatchedBranch = 0;
    let collectorMissing = 0;

    loans.forEach(l => {
        const c = l.clients;
        if (!c) {
            console.log(`❌ Loan ${l.id} has no client!`);
            return;
        }

        const isVisibleInLogic = c.is_active && !c.is_hidden && c.deleted_at === null;
        
        if (!isVisibleInLogic) {
            invisibleCount++;
            console.log(`🚫 CLIENTE INVISIBLE: ${c.name} (${c.id}) | is_active: ${c.is_active}, is_hidden: ${c.is_hidden}, deleted_at: ${c.deleted_at}`);
        }

        if (l.branch_id !== c.branch_id) {
            mismatchedBranch++;
            // console.log(`⚠️ Branch mismatch for ${c.name}: Loan branch ${l.branch_id} vs Client branch ${c.branch_id}`);
        }
        
        if (!l.collector_id) {
            collectorMissing++;
        }
    });

    console.log(`\nResumen:`);
    console.log(`- Total Préstamos Activos: ${loans.length}`);
    console.log(`- Clientes con Préstamo Activo que NO son visibles (inactivos/ocultos): ${invisibleCount}`);
    console.log(`- Desajuste de Branch ID (Préstamo vs Cliente): ${mismatchedBranch}`);
    console.log(`- Préstamos sin Collector ID: ${collectorMissing}`);
}

main();
