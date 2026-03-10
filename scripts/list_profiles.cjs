require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.VITE_SUPABASE_URL;
// IMPORTANTE: USAR SERVICE ROLE O LOGUEARSE COMO ADMIN
const supabaseKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function findCollector() {
    // Intentaremos login temporal si hace falta con admin en .env
    const { data: profiles, error } = await supabase.from('profiles').select('id, name, role');

    if (error) {
        console.error(error);
        return;
    }

    console.log(`Lista completa de perfiles en la base de datos (${profiles.length}):`);
    profiles.forEach(p => {
        console.log(` - ID: ${p.id} | Name: ${p.name} | Role: ${p.role}`);
    });
}
findCollector();
