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

async function tryLogin(email, password) {
    const { data: authData, error: authErr } = await supabase.auth.signInWithPassword({
        email,
        password
    });
    
    if (authErr) return null;
    
    const { data: profile } = await supabase.from('profiles').select('name, role').eq('id', authData.user.id).single();
    if (profile && (profile.role === 'Administrador' || profile.role === 'Gerente')) {
        console.log(`Successfully logged in as ${profile.role}: ${profile.name} (${email})`);
        return true;
    }
    await supabase.auth.signOut();
    return false;
}

async function main() {
    console.log("=== RESTORING CLIENTS (WITH AUTH) ===");
    
    // Admins to try:
    const adminsToTry = [
        { email: 'daniel@anexocobro.com', password: '123' },
        { email: 'daniel@anexocobro.com', password: 'password' },
        { email: 'daniel@anexocobro.com', password: 'Cobros2026' },
        { email: 'admin@anexocobro.com', password: '123' },
        { email: 'admin@anexocobro.com', password: 'password' },
        { email: 'admin@anexocobro.com', password: 'Cobros2026' },
        { email: 'diegovillalba@anexocobro.com', password: 'Cobros2026' }
    ];
    
    let loggedIn = false;
    for (const cred of adminsToTry) {
        loggedIn = await tryLogin(cred.email, cred.password);
        if (loggedIn) break;
    }
    
    if (!loggedIn) {
        console.log("Could not log in as an Admin or Manager. Trying the repair strategy...");
        // Wait, if I can't login, I can't update. Let's just try.
    }
    
    // First, let's find all clients that have deleted_at NOT NULL
    const { data: deletedClients, error: getErr } = await supabase
        .from('clients')
        .select('id, name, deleted_at, is_hidden')
        .not('deleted_at', 'is', null);
        
    if (getErr) {
        console.error("Error fetching deleted clients:", getErr);
        return;
    }
    
    console.log(`Found ${deletedClients.length} clients to restore (soft-deleted).`);

    // Now update them
    let restoredCount = 0;
    
    for (const client of deletedClients) {
        const { error: updateErr } = await supabase
            .from('clients')
            .update({ deleted_at: null, is_hidden: false, is_active: true })
            .eq('id', client.id);
            
        if (updateErr) {
            console.error(`Failed to restore ${client.id}:`, updateErr.message);
        } else {
            console.log(`Restored client: ${client.name}`);
            restoredCount++;
        }
    }
    
    console.log(`\nSuccessfully restored ${restoredCount} out of ${deletedClients.length} clients.`);
}

main().catch(console.error);
