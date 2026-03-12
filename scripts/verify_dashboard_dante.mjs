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
    console.log("=== REPORTE OFICIAL DEL ADMINISTRADOR DDANTE1983 ===");
    
    // Login real como Dante
    const { data: authData, error: authErr } = await supabase.auth.signInWithPassword({
        email: 'DDANTE1983@anexocobro.com', 
        password: 'Cobros2026'
    });
    
    if (authErr) {
        console.error("Fallo Login Dante:", authErr.message);
        return;
    }
    
    // 1. Conseguir la lista maestra de usuarios para enlazar los nombres reales
    const { data: profiles, error: pError } = await supabase
        .from('profiles')
        .select('id, name, username, role');
        
    const profileMap = {};
    profiles.forEach(p => profileMap[p.id] = p.name || p.username);

    // 2. Traer todos los clientes (Vistos desde los ojos de un Admin en la app)
    const { data: clients, error: cError } = await supabase
        .from('clients')
        .select('id, name, branch_id, added_by, is_active, is_hidden')
        .is('deleted_at', null);

    if (cError) {
        console.error("Error trayendo clientes:", cError.message);
        return;
    }

    // 3. Agrupar la data de los clientes por Cobrador (usando la lógica de la app = branch_id)
    const report = {};
    let totalActivos = 0;
    let totalInactivos = 0;

    for (const c of clients) {
        // En tu app el branch_id es lo que ata el cliente a la lista del celular de alguien, o added_by
        const ownerId = c.added_by || c.branch_id; 
        const ownerName = ownerId ? profileMap[ownerId] || `Cobrador Eliminado (${ownerId.substring(0,6)})` : 'Administración Central (Anexo)';

        if (!report[ownerName]) {
            report[ownerName] = { activos: 0, inactivos: 0 };
        }

        if (c.is_active && !c.is_hidden) {
            report[ownerName].activos++;
            totalActivos++;
        } else {
            report[ownerName].inactivos++;
            totalInactivos++;
        }
    }

    console.log(`\n======================================================`);
    console.log(`🎯 TOTAL CLIENTES EN SISTEMA: ${totalActivos + totalInactivos}`);
    console.log(`   🔸 Activos en la calle: ${totalActivos}`);
    console.log(`   🔸 Inactivos/Ocultos:   ${totalInactivos}`);
    console.log(`======================================================\n`);

    const sortedReport = Object.entries(report).sort((a,b) => b[1].activos - a[1].activos);

    for (const [cobrador, stats] of sortedReport) {
        console.log(`👤 ${cobrador.padEnd(30, ' ')} | 🟢 ${stats.activos} activos | 🔴 ${stats.inactivos} inactivos`);
    }

}

main().catch(console.error);
