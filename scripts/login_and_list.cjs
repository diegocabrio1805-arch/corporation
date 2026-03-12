require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function run() {
    console.log("=== LOGGING IN ===");
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: 'DDANTE1983@anexocobro.com',
        password: 'Cobros2026'
    });

    if (authError) {
        console.error("Auth Error:", authError);
        return;
    }

    console.log("Logged in as:", authData.user.email);

    const { data: users, error } = await supabase.from('profiles').select('id, name, role');
    if (error) {
        console.error("Error fetching profiles:", error);
    } else {
        console.log("=== PROFILES ===");
        console.log(users);
    }
}
run().catch(console.error);
