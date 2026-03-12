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

    console.log("=== REVISANDO ASIGNACIÓN DE PRÉSTAMOS ===");

    const { data: loans, error: lErr } = await supabase
        .from('loans')
        .select('id, collector_id, status, client_id')
        .eq('status', 'Activo')
        .is('deleted_at', null);

    const { data: users, error: uErr } = await supabase
        .from('profiles')
        .select('id, name, username');

    const userMap = {};
    users.forEach(u => userMap[u.id] = u.name || u.username);

    const collectorCounts = {};
    loans.forEach(l => {
        const name = userMap[l.collector_id] || `Desconocido (${l.collector_id})`;
        collectorCounts[name] = (collectorCounts[name] || 0) + 1;
    });

    console.log("Préstamos Activos por Cobrador:");
    console.log(collectorCounts);
}

main();
