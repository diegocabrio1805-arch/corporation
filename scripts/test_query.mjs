import { createClient } from '@supabase/supabase-js';

const supabase = createClient('https://samgpnczlznynnfhjjff.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNhbWdwbmN6bHpueW5uZmhqamZmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDA2MzEwNDIsImV4cCI6MjA1NjIwNzA0Mn0.Q6fcqt3Iz5mXUE_a5m5pkrGpJQ4EQOiMcMk6TnnAi-c');

async function run() {
    const {data: admin} = await supabase.from('profiles').select('id, name, username').eq('username', 'DDANTE1983').single();
    const {data: coll} = await supabase.from('profiles').select('id, name, username').eq('username', 'zona2').single();
    console.log('Admin:', admin);
    console.log('Collector:', coll);
    
    if (!admin || !coll) {
        console.error("Missing admin or collector.");
        return;
    }

    const {data: clients} = await supabase.from('clients').select('id, name, branch_id, added_by').ilike('name', '%Lida Raquel vera Fari%');
    console.log('Sample client:', clients);
    
    // Check all clients for this admin
    const {data: allClients} = await supabase.from('clients').select('id, name, branch_id, added_by').eq('branch_id', admin.id);
    console.log('Total clients for Admin Branch:', allClients?.length);

    // Filter ones that match the ones in the prompt or all? The prompt lists 48 clients.
}

run();
