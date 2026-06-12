import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://samgpnczlznynnfhjjff.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNhbWdwbmN6bHpueW5uZmhqamZmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIxNjU1NjQsImV4cCI6MjA4Nzc0MTU2NH0.AV1Z-QlltfPp8am-_ALlgopoGB8WhOrle83TNZrjqTE';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function loginAndGetId(username, password) {
    const email = username.includes('@') ? username : `${username}@anexocobro.com`;
    const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
    });
    return data?.user;
}

async function run() {
    let alterfinAdmin = await loginAndGetId('ALTERFINADMI', '123456');
    console.log("ALTERFINADMI:", alterfinAdmin?.id);

    // Login as admin Dante to query
    await supabase.auth.signInWithPassword({ email: 'DDANTE1983@anexocobro.com', password: 'Cobros2026' });

    // Check ALTERFINADMI profile
    if (alterfinAdmin) {
        const {data: p} = await supabase.from('profiles').select('*').eq('id', alterfinAdmin.id).single();
        console.log("ALTERFINADMI Profile:", p);
    }

    // Find all clients with MARTINEZ LEGAL
    const {data: clients} = await supabase.from('clients').select('id, name, branch_id, added_by, collector_id').ilike('name', '%MARTINEZ LEGAL%');
    console.log("Clients matching MARTINEZ LEGAL:", clients);

    for (const c of clients || []) {
        const {data: loans} = await supabase.from('loans').select('id, collector_id').eq('client_id', c.id);
        console.log(`Loans for ${c.name}:`, loans);
    }
}

run();
