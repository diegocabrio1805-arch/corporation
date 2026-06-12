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
    return data?.user?.id;
}

async function run() {
    let zona2Id = await loginAndGetId('zona2', '1234');
    if (!zona2Id) zona2Id = await loginAndGetId('zona2', 'Cobros2026');

    // Login as admin Dante to query
    await supabase.auth.signInWithPassword({ email: 'DDANTE1983@anexocobro.com', password: 'Cobros2026' });

    // Find all clients with Evaristo
    const {data: clients} = await supabase.from('clients').select('id, name, branch_id, added_by, collector_id').ilike('name', '%evaristo%');
    console.log("Clients matching EVARISTO:", clients);

    if (clients && clients.length > 0) {
        for (const c of clients) {
            const {data: loans} = await supabase.from('loans').select('id, collector_id, status').eq('client_id', c.id);
            console.log(`Loans for ${c.name}:`, loans);

            if (c.added_by !== zona2Id) {
                console.log(`Fixing added_by for ${c.name} -> zona2`);
                await supabase.from('clients').update({ added_by: zona2Id }).eq('id', c.id);
            }
            if ('collector_id' in c && c.collector_id !== zona2Id) {
                await supabase.from('clients').update({ collector_id: zona2Id }).eq('id', c.id);
            }
            
            if (loans) {
                for (const l of loans) {
                    if (l.collector_id !== zona2Id) {
                        console.log(`Fixing loan ${l.id} collector_id -> zona2`);
                        await supabase.from('loans').update({ collector_id: zona2Id }).eq('id', l.id);
                    }
                }
            }
        }
        console.log("Assigned all found Evaristo clients to zona2.");
    }
}

run();
