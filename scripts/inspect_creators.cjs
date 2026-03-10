require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function inspectCreators() {
    const { data: clients, error } = await supabase.from('clients').select('id, name, added_by, branch_id');

    if (error) {
        console.log("Error leyendo clientes (RLS):", error.message);
        return;
    }

    // Contar cuántos clientes ha creado cada ID
    const creators = {};
    clients.forEach(c => {
        creators[c.added_by] = (creators[c.added_by] || 0) + 1;
    });

    console.log("TOP CREADORES DE CLIENTES:");
    Object.entries(creators)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .forEach(([id, count]) => console.log(` - ID: ${id} -> ${count} clientes creados`));

    // Revisaremos todos los que han transferido clientes: 
    // añadidos por un ID pero branch_id es otro
    console.log("\nTRANSFERENCIAS DE CLIENTES:");
    const transfers = {};
    clients.forEach(c => {
        if (c.added_by !== c.branch_id) {
            const key = `De ${c.added_by} hacia ${c.branch_id}`;
            transfers[key] = (transfers[key] || 0) + 1;
        }
    });

    Object.entries(transfers)
        .sort((a, b) => b[1] - a[1])
        .forEach(([key, count]) => {
            if (count > 2) console.log(` - ${key}: ${count} clientes`);
        });

    // Intentaremos listar nombres de usuarios llamando a rpc o simplemente un truco:
    // Algunos clientes guardan historico en raw_data o en reportes.
}

inspectCreators();
