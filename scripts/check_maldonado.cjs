require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkMaldonado() {
    console.log("Buscando a Maldonado...");
    const { data: clients, error: cErr } = await supabase
        .from('clients')
        .select('*')
        .ilike('name', '%maldonado%');

    if (cErr) {
        console.error("Error buscando cliente:", cErr);
        return;
    }

    if (!clients || clients.length === 0) {
        console.log("No se encontro a Maldonado.");
        return;
    }

    for (const client of clients) {
        console.log(`\n=== CLIENTE: ${client.name} (ID: ${client.id}) ===`);

        const { data: loans } = await supabase.from('loans').select('*').eq('client_id', client.id);
        console.log(`Prestamos:`, loans?.length || 0);

        const { data: logs } = await supabase.from('collection_logs').select('*').eq('client_id', client.id);
        if (logs) {
            console.log(`Pagos (${logs.length}):`);
            logs.forEach(l => {
                console.log(` - Monto: ${l.amount} | Tipo: ${l.type} | is_opening: ${l.is_opening} | is_renewal: ${l.is_renewal} | Fecha: ${l.date} | ID: ${l.id} | Notes: ${l.notes}`);
            });
        }
    }
}

checkMaldonado();
