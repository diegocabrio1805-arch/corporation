require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function inspectFinal() {
    const { data: clients } = await supabase.from('clients')
        .select('branch_id');

    // ID b3716a78-fb4f-4918-8c0b-92004e3d63ec es el FANTASMA MAYOR (fusionador)
    const active = clients.filter(c => c.branch_id === 'b3716a78-fb4f-4918-8c0b-92004e3d63ec');
    console.log(`Clientes totales asimilados en la base principal oculta: ${active.length}`);
}

inspectFinal();
