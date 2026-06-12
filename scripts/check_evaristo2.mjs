import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://samgpnczlznynnfhjjff.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNhbWdwbmN6bHpueW5uZmhqamZmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIxNjU1NjQsImV4cCI6MjA4Nzc0MTU2NH0.AV1Z-QlltfPp8am-_ALlgopoGB8WhOrle83TNZrjqTE';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function run() {
    await supabase.auth.signInWithPassword({ email: 'DDANTE1983@anexocobro.com', password: 'Cobros2026' });

    const {data: clients, error} = await supabase.from('clients').select('id, name, branch_id, added_by').ilike('name', '%evaristo%');
    console.log("Error:", error);
    console.log("Clients matching EVARISTO:", clients);
}

run();
