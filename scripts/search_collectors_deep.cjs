require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function run() {
    console.log("\n=== SEARCHING FOR COLLECTORS IN LOANS ===");
    const { data: loans, error: lError } = await supabase.from('loans').select('collector_id').limit(100);
    if (lError) console.error("Error fetching loans:", lError);
    
    const uniqueCollectorIds = [...new Set((loans || []).map(l => l.collector_id).filter(Boolean))];
    console.log("Unique Collector IDs found in loans:", uniqueCollectorIds);

    if (uniqueCollectorIds.length > 0) {
        const { data: profiles } = await supabase.from('profiles').select('id, name, role').in('id', uniqueCollectorIds);
        console.log("Profiles for these IDs:");
        console.log(profiles);
    }

    console.log("\n=== SEARCHING FOR CLIENTS OF MENTIONED COLLECTORS ===");
    const names = ['DERLIS', 'JUVE', 'FABIAN'];
    for (const name of names) {
        const { data: clients } = await supabase.from('clients').select('id, name, added_by').ilike('name', `%${name}%`).limit(5);
        console.log(`Clients matching "${name}":`);
        console.log(clients);
    }
}
run().catch(console.error);
