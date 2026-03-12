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
    // Login as Dante to bypass RLS and see everything he sees
    await supabase.auth.signInWithPassword({
        email: 'DDANTE1983@anexocobro.com',
        password: 'Cobros2026'
    });

    console.log("=== REVISANDO ESTADO DE PRÉSTAMOS ===");

    const { data: loans, error } = await supabase
        .from('loans')
        .select('id, status, deleted_at, collector_id, client_id')
        .is('deleted_at', null);

    if (error) {
        console.error("Error:", error);
        return;
    }

    const statusCounts = {};
    loans.forEach(l => {
        statusCounts[l.status] = (statusCounts[l.status] || 0) + 1;
    });

    console.log("Distribución de estados de préstamos (no borrados):");
    console.log(statusCounts);

    // Buscar préstamos de los clientes que deberían estar pero no están activos
    // El dashboard dice que solo hay ~30 activos.
    // Mi script previo decía que había 320 clientes.
}

main();
