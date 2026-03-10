require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function mapRealUsers() {
    console.log("=== MAPEO DE TODOS LOS PERFILES REALES Y SUS CLIENTES ===");
    const { data: profiles } = await supabase.from('profiles').select('id, name');

    for (const p of profiles) {
        const { count } = await supabase.from('clients')
            .select('*', { count: 'exact', head: true })
            .eq('branch_id', p.id)
            .is('deleted_at', null);

        console.log(`Perfil: ${p.name.padEnd(25)} | Clientes: ${count}`);

        if (count === 17) {
            console.log(`\n¡¡¡ ENCONTRAMOS AL DUEÑO DE LOS 17 CLIENTES !!!`);
            console.log(`El perfil "${p.name}" (ID: ${p.id}) es el que la aplicación interpreta como Derlis Armoa en esa foto.`);

            // Listar sus 17 clientes:
            const { data: clients } = await supabase.from('clients')
                .select('name')
                .eq('branch_id', p.id)
                .is('deleted_at', null);

            console.log("\nESTOS SON SUS 17 CLIENTES:");
            clients.forEach((c, idx) => console.log(` ${idx + 1}. ${c.name}`));

            // Revisar si él creó más pero se los quitaron
            const { data: transfers } = await supabase.from('clients')
                .select('id')
                .eq('added_by', p.id)
                .neq('branch_id', p.id)
                .is('deleted_at', null);
            console.log(`\nAdemás de esos 17, él ingresó ${transfers?.length || 0} clientes que luego pasaron a otro cobrador.`);
        }
    }
}
mapRealUsers();
