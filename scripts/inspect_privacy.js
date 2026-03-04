
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '../.env.local' });

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function inspectBranches() {
    console.log("--- PERFILES Y SUCURSALES ---");
    const { data: profiles, error: pError } = await supabase
        .from('profiles')
        .select('id, username, name, role, branch_id');

    if (pError) console.error("Error profiles:", pError);
    else console.table(profiles);

    console.log("\n--- CLIENTES POR SUCURSAL (CONTEO) ---");
    const { data: clients, error: cError } = await supabase
        .from('clients')
        .select('branch_id');

    if (cError) console.error("Error clients:", cError);
    else {
        const counts = clients.reduce((acc, c) => {
            acc[c.branch_id] = (acc[c.branch_id] || 0) + 1;
            return acc;
        }, {});
        console.table(counts);
    }
}

inspectBranches();
