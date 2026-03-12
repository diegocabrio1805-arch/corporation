require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function run() {
    const res = await fetch(`${process.env.VITE_SUPABASE_URL}/rest/v1/?apikey=${process.env.VITE_SUPABASE_ANON_KEY}`);
    const swagger = await res.json();
    
    console.log("=== PROFILES COLUMNS ===");
    console.log(Object.keys(swagger.definitions.profiles.properties));
    
    console.log("\n=== CLIENTS COLUMNS ===");
    console.log(Object.keys(swagger.definitions.clients.properties));
    
    console.log("\n=== USERS DATA (COLLECTORS) ===");
    const { data: users } = await supabase.from('profiles').select('id, name, role');
    console.log(users.filter(u => u.role === 'Collector' || u.role === 'collector'));
}
run().catch(console.error);
