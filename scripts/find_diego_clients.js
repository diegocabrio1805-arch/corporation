
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

// Leer .env.local de forma robusta
const envPath = 'c:/Users/DANIEL/Desktop/cobros/.env.local';
const envContent = fs.readFileSync(envPath, 'utf8');
const env = {};
envContent.split(/\r?\n/).forEach(line => {
    const parts = line.split('=');
    if (parts.length >= 2) {
        const key = parts[0].trim();
        const value = parts.slice(1).join('=').trim().replace(/^['"]|['"]$/g, '');
        env[key] = value;
    }
});

const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

async function inspectMissingClients() {
    const diegoId = '558ce035-e158-42d8-b18e-9649a7f5c52b';
    const missingNames = ['Hugo molinas', 'Patty acosta Roa'];

    console.log(`Inspeccionando clientes de Diego que no aparecen en la UI...`);

    const { data: clients, error } = await supabase
        .from('clients')
        .select('*')
        .eq('added_by', diegoId);

    if (error) {
        console.error(error);
        return;
    }

    const missing = clients.filter(c => missingNames.some(name => c.name.toLowerCase() === name.toLowerCase()));

    console.log("\nDetalle de clientes Hugo y Patty:");
    console.table(missing.map(c => ({
        id: c.id,
        name: c.name,
        branch_id: c.branch_id,
        is_hidden: c.is_hidden,
        is_active: c.is_active,
        deleted_at: c.deleted_at
    })));

    // Verificar si Diego tiene branch_id en su perfil (vimos que no, pero quizás use otra columna)
    const { data: profile } = await supabase.from('profiles').select('*').eq('id', diegoId).single();
    console.log("\nPerfil de Diego completo:");
    console.table([profile]);
}

inspectMissingClients();
