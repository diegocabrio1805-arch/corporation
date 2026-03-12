require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function run() {
    const res = await fetch(`${process.env.VITE_SUPABASE_URL}/rest/v1/?apikey=${process.env.VITE_SUPABASE_ANON_KEY}`);
    const swagger = await res.json();
    
    console.log("\n=== LOANS COLUMNS ===");
    console.log(Object.keys(swagger.definitions.loans.properties));
}
run().catch(console.error);
