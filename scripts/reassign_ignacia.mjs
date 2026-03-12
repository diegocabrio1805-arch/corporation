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

    console.log("=== REASIGNANDO CLIENTE A DERLIS ARMOA ===");

    // 1. Buscar Cliente
    const { data: client } = await supabase
        .from('clients')
        .select('id, name')
        .ilike('name', '%IGNACIA RODRIGUEZ%')
        .single();

    if (!client) {
        console.error("No encontré a la cliente IGNACIA RODRIGUEZ");
        return;
    }
    console.log(`Cliente encontrada: ${client.name} (${client.id})`);

    // 2. Buscar Cobrador
    const { data: collector } = await supabase
        .from('profiles')
        .select('id, name, username')
        .ilike('username', '%DERLIS ARMOA%')
        .single();

    if (!collector) {
        console.error("No encontré al cobrador DERLIS ARMOA");
        return;
    }
    console.log(`Cobrador encontrado: ${collector.username} (${collector.id})`);

    // 3. Actualizar Préstamo
    const { data: loan, error: lErr } = await supabase
        .from('loans')
        .update({ collector_id: collector.id })
        .eq('client_id', client.id)
        .eq('status', 'Activo');

    if (lErr) {
        console.error("Error actualizando préstamo:", lErr);
    } else {
        console.log(`✅ Préstamo de ${client.name} reasignado a ${collector.username}`);
    }

    // 4. Actualizar Cliente (added_by) para consistencia
    const { error: cErr } = await supabase
        .from('clients')
        .update({ added_by: collector.id })
        .eq('id', client.id);

    if (cErr) {
        console.error("Error actualizando cliente:", cErr);
    } else {
        console.log(`✅ Cliente reasignado internamente a ${collector.username}`);
    }
}

main();
