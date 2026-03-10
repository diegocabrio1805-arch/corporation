require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function listAllNames() {
    const { data: profiles } = await supabase.from('profiles').select('name, username');
    console.log("== LISTADO COMPLETO DE USUARIOS ==");
    profiles.forEach(p => console.log(`Nombre: ${p.name} | Usuario: ${p.username}`));
}
listAllNames();
