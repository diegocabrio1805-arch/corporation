require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function findCollectorUsername() {
    console.log("=== BUSCANDO POR USERNAME ===");

    // El campo de login suele usarse como identificador real
    const { data: byUsername } = await supabase
        .from('profiles')
        .select('id, name, username, role')
        .ilike('username', '%derlis%');

    if (byUsername && byUsername.length > 0) {
        console.log("Encontrado por username:");
        byUsername.forEach(p => console.log(` - ID: ${p.id} | Name: ${p.name} | User: ${p.username}`));
    } else {
        console.log("Nadie tiene 'derlis' en el username.");
    }

    console.log("\n=== BUSCANDO POR CUALQUIER OCURRENCIA DE 'ARMOA' ===");
    const { data: byArmoa } = await supabase
        .from('profiles')
        .select('id, name, username, role')
        .ilike('name', '%armoa%');

    if (byArmoa && byArmoa.length > 0) {
        byArmoa.forEach(p => console.log(` - ID: ${p.id} | Name: ${p.name}`));
    } else {
        console.log("Tampoco hay nadia apellidado 'armoa' en profiles.");
    }
}
findCollectorUsername();
