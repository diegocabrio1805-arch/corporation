require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function run() {
    console.log("\n=== ALL USERS DATA ===");
    const { data: users, error } = await supabase.from('profiles').select('id, name, role');
    if (error) {
        console.error("Error fetching users:", error);
        return;
    }
    users.forEach(u => {
        console.log(`- ID: ${u.id} | Name: ${u.name} | Role: ${u.role}`);
    });
}
run().catch(console.error);
