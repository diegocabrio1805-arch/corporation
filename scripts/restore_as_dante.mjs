import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://samgpnczlznynnfhjjff.supabase.co';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNhbWdwbmN6bHpueW5uZmhqamZmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIxNjU1NjQsImV4cCI6MjA4Nzc0MTU2NH0.AV1Z-QlltfPp8am-_ALlgopoGB8WhOrle83TNZrjqTE';

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
    console.log("=== RESTAURANDO CLIENTES COMO ADMINISTRADOR ===");
    
    // Login con las credenciales dadas por el usuario
    const { data: authData, error: authErr } = await supabase.auth.signInWithPassword({
        email: 'DDANTE1983@anexocobro.com', // Usando el formato de correo que usa el login
        password: 'Cobros2026'
    });
    
    if (authErr) {
        // Intentar sin el dominio si falla
        const { data: authData2, error: authErr2 } = await supabase.auth.signInWithPassword({
            email: 'DDANTE1983',
            password: 'Cobros2026'
        });
        if (authErr2) {
             console.error("Fallo el login:", authErr.message);
             return;
        }
    }
    
    console.log("✅ Conectado como Administrador Dante (Auth ID: " + (authData?.user?.id || 'OK') + ")");

    // 1. Obtener los 54 clientes
    const { data: deletedClients, error: getErr } = await supabase
        .from('clients')
        .select('id, name')
        .not('deleted_at', 'is', null);
        
    if (getErr || !deletedClients) {
        console.error("Error buscando clientes:", getErr);
        return;
    }
    
    console.log(`⏳ Se encontraron ${deletedClients.length} clientes borrados para restaurar...`);

    let restoredClients = 0;
    
    for (const client of deletedClients) {
        const { error } = await supabase
            .from('clients')
            .update({ deleted_at: null, is_hidden: false, is_active: true })
            .eq('id', client.id);
            
        if (error) {
            console.error(`❌ Error con ${client.name}:`, error.message);
        } else {
            console.log(`✅ Restaurado: ${client.name}`);
            restoredClients++;
        }
    }
    
    // 2. Obtener prestamos
    const { data: deletedLoans, error: loanGetErr } = await supabase
        .from('loans')
        .select('id')
        .not('deleted_at', 'is', null);
        
    let restoredLoans = 0;
    if (deletedLoans && deletedLoans.length > 0) {
        console.log(`⏳ Restaurando ${deletedLoans.length} prestamos...`);
        for (const loan of deletedLoans) {
            const { error: lErr } = await supabase
                .from('loans')
                .update({ deleted_at: null })
                .eq('id', loan.id);
            if (!lErr) restoredLoans++;
        }
    }

    console.log(`\n🎉 PROCESO COMPLETADO 🎉`);
    console.log(`Clientes restaurados: ${restoredClients}/${deletedClients.length}`);
    console.log(`Prestamos restaurados: ${restoredLoans}/${deletedLoans?.length || 0}`);
}

main().catch(console.error);
