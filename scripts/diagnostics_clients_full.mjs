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
    console.log("=== CLIENT RESTORATION DIAGNOSTICS ===");
    
    // 1. Get all profiles
    const { data: profiles, error: profErr } = await supabase.from('profiles').select('id, username, role');
    if (profErr) {
        console.error("Error fetching profiles:", profErr);
        return;
    }
    console.log(`Found ${profiles.length} profiles.`);
    
    // 2. Get all clients (no filters)
    const { data: clients, error: cliErr } = await supabase.from('clients').select('id, name, added_by, branch_id, is_active, is_hidden, deleted_at, external_id');
    if (cliErr) {
        console.error("Error fetching clients:", cliErr);
        return;
    }
    
    console.log(`Found ${clients.length} TOTAL clients in the DB.`);
    
    // 3. Group by collector
    const byCollector = {};
    for (const c of clients) {
        const colId = c.added_by || 'UNASSIGNED';
        if (!byCollector[colId]) {
            byCollector[colId] = { total: 0, active: 0, inactive: 0, hidden: 0, deleted: 0 };
        }
        byCollector[colId].total++;
        if (c.deleted_at) byCollector[colId].deleted++;
        else {
            if (c.is_hidden) byCollector[colId].hidden++;
            if (c.is_active) byCollector[colId].active++;
            else byCollector[colId].inactive++;
        }
    }
    
    console.log("\n--- Client Distribution ---");
    for (const [colId, stats] of Object.entries(byCollector)) {
        const profile = profiles.find(p => p.id === colId);
        const name = profile ? profile.username : colId;
        console.log(`Collector: ${name}`);
        console.log(`  Total: ${stats.total} | Active (not deleted/hidden): ${stats.active} | Inactive: ${stats.inactive} | Hidden: ${stats.hidden} | Soft Deleted: ${stats.deleted}`);
    }
    
}

main().catch(console.error);
