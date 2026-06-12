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

    console.log("Zona2 ID:", zona2Id);
    console.log("Admin Dante ID:", adminDante);

    // Login as admin to ensure we have access to update
    await supabase.auth.signInWithPassword({ email: 'DDANTE1983@anexocobro.com', password: 'Cobros2026' });

    // Fetch the client globally
    const {data: clients} = await supabase.from('clients')
                                          .select('*')
                                          .ilike('name', '%PEDRO ANTONIO MARTINEZ LEGAL%');
                                          
    console.log(`Found ${clients?.length || 0} clients matching PEDRO ANTONIO MARTINEZ LEGAL.`);

    if (!clients || clients.length === 0) {
        console.log("No client found. Exiting.");
        return;
    }

    const clientIds = clients.map(c => c.id);
    
    // Move clients back to zona2 and adminDante
    const { error: updateClientsErr } = await supabase.from('clients').update({ 
        added_by: zona2Id,
        branch_id: adminDante
    }).in('id', clientIds);
    
    if (updateClientsErr) {
        console.error("Error updating clients:", updateClientsErr);
    } else {
        console.log("SUCCESSFULLY moved clients back to zona2 / DDANTE1983!");
    }

    // Move their loans to zona2
    const { error: updateLoansErr } = await supabase.from('loans').update({ 
        collector_id: zona2Id 
    }).in('client_id', clientIds);
    
    if (updateLoansErr) {
        console.error("Error updating loans:", updateLoansErr);
    } else {
        console.log("SUCCESSFULLY moved loans to zona2!");
    }
}

run();
