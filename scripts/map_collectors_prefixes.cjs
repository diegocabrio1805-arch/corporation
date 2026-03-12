require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function run() {
    console.log("\n=== MAPPING COLLECTORS FROM CLIENT PREFIXES ===");
    
    // Buscar clientes que empiezan con JV o nombres de cobradores
    const { data: juveClients } = await supabase.from('clients').select('id, name, added_by').ilike('name', 'JV %').limit(10);
    console.log("Clients starting with 'JV ':");
    console.log(juveClients);
    
    if (juveClients && juveClients.length > 0) {
        console.log("Juve Villalba ID is likely:", juveClients[0].added_by);
    }

    const { data: fabianClients } = await supabase.from('clients').select('id, name, added_by').ilike('name', 'FABIAN %').limit(10);
    console.log("Clients starting with 'FABIAN ':");
    console.log(fabianClients);
    
    const { data: allCollectors } = await supabase.from('profiles').select('id, name, role').ilike('role', 'Collector');
    console.log("Collectors found in profiles (direct check):");
    console.log(allCollectors);
}
run().catch(console.error);
