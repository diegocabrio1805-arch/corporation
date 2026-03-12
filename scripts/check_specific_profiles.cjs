require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function run() {
    const ids = [
        'c956ea2f-99d7-4956-93d5-36842aeb0d54',
        'a69e2207-db0a-49b7-a764-2787624e5777',
        '1768f226-a0b7-4ad0-87a5-08857e2a8404',
        '558ce035-e158-42d8-b18e-9649a7f5c52b'
    ];
    
    console.log("\n=== CHECKING SPECIFIC PROFILES ===");
    const { data: profiles, error } = await supabase.from('profiles').select('id, name, role').in('id', ids);
    if (error) {
        console.error("Error fetching profiles:", error);
    } else {
        console.log(profiles);
    }
}
run().catch(console.error);
