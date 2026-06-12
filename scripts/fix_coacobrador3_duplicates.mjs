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
    let adminDante = await loginAndGetId('DDANTE1983', 'Cobros2026');

    // Login as admin
    await supabase.auth.signInWithPassword({ email: 'DDANTE1983@anexocobro.com', password: 'Cobros2026' });

    const names = [
        "Lida Raquel vera",
        "SANDRA ELIZABET ALVEZ"
    ];

    let allMatched = [];
    for (const name of names) {
        const {data: clients} = await supabase.from('clients')
                                              .select('*')
                                              .ilike('name', `%${name}%`);
        if (clients && clients.length > 0) {
            allMatched.push(...clients);
        }
    }

    const clientIds = allMatched.map(c => c.id);
    
    // Move clients back to zona2
    const { error: updateClientsErr } = await supabase.from('clients').update({ 
        added_by: zona2Id,
        branch_id: adminDante
    }).in('id', clientIds);
    
    if (updateClientsErr) {
        console.error("Error updating clients:", updateClientsErr);
    } else {
        console.log("SUCCESSFULLY moved clients back to zona2 / DDANTE1983!");
    }
}

run();
