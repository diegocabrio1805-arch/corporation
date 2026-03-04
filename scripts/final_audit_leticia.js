
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

async function finalAudit() {
    const gerenteId = '93e73104-7ce8-453b-b0a3-b574b69a744c'; // Leticia/Javi
    const correctBranch = '93e73104-7ce8-453b-b0a3-b574b69a744c';

    console.log("Auditoría final de clientes para el grupo Leticia/Javi...");

    // Buscar todos los clientes asociados a Leticia/Javi o sus cobradores
    const { data: cobradores } = await supabase.from('profiles').select('id, username').eq('managed_by', gerenteId);
    const idsToCheck = [gerenteId, ...cobradores.map(c => c.id)];

    const { data: clients, error } = await supabase
        .from('clients')
        .select('id, name, branch_id, added_by')
        .in('added_by', idsToCheck);

    if (error) {
        console.error(error);
        return;
    }

    const mismatched = clients.filter(c => c.branch_id !== correctBranch);

    if (mismatched.length > 0) {
        console.log(`\nSe encontraron ${mismatched.length} clientes con sucursal incorrecta. Corrigiendo...`);
        const { error: updateError } = await supabase
            .from('clients')
            .update({ branch_id: correctBranch })
            .in('id', mismatched.map(m => m.id));

        if (updateError) console.error("Error al corregir:", updateError);
        else console.log("Todos los clientes del grupo Leticia/Javi han sido unificados en su sucursal.");
    } else {
        console.log("\nTodos los clientes están correctamente unificados en la sucursal de Leticia/Javi.");
    }

    console.log(`\nResumen final: ${clients.length} clientes totales en el grupo.`);
}

finalAudit();
