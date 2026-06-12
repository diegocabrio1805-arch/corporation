import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://samgpnczlznynnfhjjff.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNhbWdwbmN6bHpueW5uZmhqamZmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIxNjU1NjQsImV4cCI6MjA4Nzc0MTU2NH0.AV1Z-QlltfPp8am-_ALlgopoGB8WhOrle83TNZrjqTE';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function run() {
    await supabase.auth.signInWithPassword({ email: 'DDANTE1983@anexocobro.com', password: 'Cobros2026' });

    const client_id = '55976234-5f81-40ec-9186-52bd97df8318';
    const {data: loans} = await supabase.from('loans').select('*').eq('client_id', client_id);
    
    console.log("Loans for EVARISTO:", loans);
    
    // update loans collector_id to zona2
    const zona2Id = '09772bd7-c65b-4692-8c8f-6061bd744863';
    let needsUpdate = false;
    for (const l of loans || []) {
        if (l.collector_id !== zona2Id) {
            needsUpdate = true;
            console.log(`Loan ${l.id} has collector ${l.collector_id}. Updating to zona2...`);
            await supabase.from('loans').update({ collector_id: zona2Id }).eq('id', l.id);
        }
    }
    
    if (needsUpdate) {
        console.log("Updated Evaristo loans successfully.");
    } else {
        console.log("Evaristo loans were already assigned to zona2.");
    }
}

run();
