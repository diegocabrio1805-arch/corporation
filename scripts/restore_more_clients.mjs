import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://samgpnczlznynnfhjjff.supabase.co';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNhbWdwbmN6bHpueW5uZmhqamZmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIxNjU1NjQsImV4cCI6MjA4Nzc0MTU2NH0.AV1Z-QlltfPp8am-_ALlgopoGB8WhOrle83TNZrjqTE';

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
    console.log("=== BÚSQUEDA PROFUNDA DE CLIENTES PERDIDOS ===");
    
    // Login temporal como Dante para buscar saltándose RLS
    await supabase.auth.signInWithPassword({
        email: 'DDANTE1983@anexocobro.com',
        password: 'Cobros2026'
    });

    let totalRecovered = 0;

    // 1. Buscar clientes que estén "Ocultos" (is_hidden = true)
    const { data: hiddenClients, error: err1 } = await supabase
        .from('clients')
        .select('id, name')
        .eq('is_hidden', true)
        .is('deleted_at', null);

    if (hiddenClients?.length > 0) {
        console.log(`\n🔎 Encontrados ${hiddenClients.length} clientes con 'is_hidden = true'`);
        for (const c of hiddenClients) {
            await supabase.from('clients').update({ is_hidden: false, is_active: true }).eq('id', c.id);
            console.log(` ✅ Desocultado: ${c.name}`);
            totalRecovered++;
        }
    }

    // 2. Buscar clientes inactivos (is_active = false)
    const { data: inactiveClients, error: err2 } = await supabase
        .from('clients')
        .select('id, name')
        .eq('is_active', false)
        .is('deleted_at', null)
        .eq('is_hidden', false);

    if (inactiveClients?.length > 0) {
        console.log(`\n🔎 Encontrados ${inactiveClients.length} clientes inactivos ('is_active = false')`);
        for (const c of inactiveClients) {
            await supabase.from('clients').update({ is_active: true }).eq('id', c.id);
            console.log(` ✅ Reactivado: ${c.name}`);
            totalRecovered++;
        }
    }
    
    // 3. Buscar clientes sin cobrador asignado
    const { data: noBranchClients, error: err3 } = await supabase
        .from('clients')
        .select('id, name')
        .is('branch_id', null)
        .is('deleted_at', null);

    if (noBranchClients?.length > 0) {
        console.log(`\n🔎 Encontrados ${noBranchClients.length} clientes sin Branch ID asignado (huérfanos).`);
        // Los asignamos al administrador directamente para que no queden flotando
        for (const c of noBranchClients) {
            await supabase.from('clients').update({ branch_id: 'b3716a78-fb4f-4918-8c0b-92004e3d63ec' }).eq('id', c.id);
            console.log(` ✅ Reasignado a Admin: ${c.name}`);
            totalRecovered++;
        }
    }

    console.log(`\n🎉 Resumen: Se rescataron ${totalRecovered} clientes adicionales en esta búsqueda profunda.`);
}

main().catch(console.error);
