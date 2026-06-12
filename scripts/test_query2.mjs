import { createClient } from '@supabase/supabase-js';

const supabase = createClient('https://samgpnczlznynnfhjjff.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNhbWdwbmN6bHpueW5uZmhqamZmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDA2MzEwNDIsImV4cCI6MjA1NjIwNzA0Mn0.Q6fcqt3Iz5mXUE_a5m5pkrGpJQ4EQOiMcMk6TnnAi-c');

async function run() {
    const {data: admins} = await supabase.from('profiles').select('id, name, username').ilike('username', '%dante%');
    const {data: colls} = await supabase.from('profiles').select('id, name, username').ilike('username', '%zona2%');
    console.log('Admins matching DANTE:', admins);
    console.log('Collectors matching zona2:', colls);
    
    const {data: clients} = await supabase.from('clients').select('id, name, branch_id, added_by').ilike('name', '%Lida Raquel vera Fari%');
    console.log('Sample client:', clients);
}

run();
