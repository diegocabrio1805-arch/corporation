require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkSoftDeletes() {
    console.log("=== COMPROBANDO PERFILES ELIMINADOS SOFTAMENTE ===");
    // profiles no tiene deleted_at habitualmente, pero si Auth user se borró, a veces profile queda o viceversa.
    // También podría estar en una tabla anexa (deleted_items)

    const { data: ghosts } = await supabase.from('deleted_items').select('*').eq('table_name', 'profiles');
    if (ghosts && ghosts.length > 0) {
        console.log("Hay perfiles reportados como borrados!");
        ghosts.forEach(g => console.log(g.record_id));
    } else {
        console.log("No hay constancia en deleted_items de perfiles borrados.");
    }

    // Y finalmente, si Derlis Armoa solo tiene 17 clientes en la UI actual, eso coincide casi perfecto 
    // con el id fantasma `93e73104-7ce8-453b-b0a3-b574b69a744c` que tiene 7 clientes? O con los 17 en progreso.
    // Necesitamos ver los IDs reales almacenados en `branch_settings`.

    const { data: settings } = await supabase.from('branch_settings').select('*');
    for (const s of settings) {
        if (s.settings && s.settings.branchName) {
            console.log(`Setting ID: ${s.id} -> Nombre Registrado: ${s.settings.branchName}`);
        }
    }
}
checkSoftDeletes();
