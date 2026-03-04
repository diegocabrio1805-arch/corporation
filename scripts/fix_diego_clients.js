
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

async function fixMissingClients() {
    console.log("Iniciando reparación de clientes Hugo y Patty...");

    // 1. Mostrar de nuevo a Hugo Molinas (estaba 'is_hidden: true')
    const { data: fixHugo, error: hError } = await supabase
        .from('clients')
        .update({ is_hidden: false })
        .eq('id', '4d3ccd2a-e325-476f-9575-e0d08e1c33b3');

    if (hError) console.error("Error Hugo:", hError);
    else console.log("Hugo Molinas restaurado (is_hidden: false)");

    // 2. Corregir branch_id de Patty Acosta Roa (estaba en 'b3716a...' y Diego es '93e731...')
    // La sucursal correcta para leticiajavi es 93e73104-7ce8-453b-b0a3-b574b69a744c
    const { data: fixPatty, error: pError } = await supabase
        .from('clients')
        .update({ branch_id: '93e73104-7ce8-453b-b0a3-b574b69a744c' })
        .eq('id', 'eaee1659-26c4-4b45-a1c9-5bd6776c2e96');

    if (pError) console.error("Error Patty:", pError);
    else console.log("Patty Acosta Roa corregida (branch_id actualizado)");

    console.log("\nReparación finalizada. Verificando conteo...");

    const { count } = await supabase
        .from('clients')
        .select('*', { count: 'exact', head: true })
        .eq('added_by', '558ce035-e158-42d8-b18e-9649a7f5c52b')
        .eq('is_hidden', false);

    console.log(`Clientes totales de Diego ahora: ${count}`);
}

fixMissingClients();
