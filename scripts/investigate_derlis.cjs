require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function findCollector() {
    console.log("=== LISTADO DE TODOS LOS PERFILES ===");
    const { data: profiles, error } = await supabase.from('profiles').select('id, name, role');

    if (error) {
        console.log("Error consultando perfiles:", error);
        return;
    }

    profiles.forEach(p => {
        console.log(` - ${p.name}`);
    });
}
findCollector();
