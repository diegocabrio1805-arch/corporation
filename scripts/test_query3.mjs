import { createClient } from '@supabase/supabase-js';

const supabase = createClient('https://samgpnczlznynnfhjjff.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNhbWdwbmN6bHpueW5uZmhqamZmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDA2MzEwNDIsImV4cCI6MjA1NjIwNzA0Mn0.Q6fcqt3Iz5mXUE_a5m5pkrGpJQ4EQOiMcMk6TnnAi-c');

async function run() {
    const {data: profiles} = await supabase.from('profiles').select('*').limit(5);
    console.log('Profiles structure:', profiles);
    
    // Look for Dante and zona2 by name or role
    const {data: allProfs} = await supabase.from('profiles').select('*');
    const dante = allProfs.find(p => p.name?.toLowerCase().includes('dante') || p.username?.toLowerCase().includes('dante'));
    const zona2 = allProfs.find(p => p.name?.toLowerCase().includes('zona2') || p.username?.toLowerCase().includes('zona2') || p.id === '...zona2 id if known...');
    
    console.log('Found Dante:', dante);
    console.log('Found zona2:', zona2);

    // Let's also look for that specific client name
    const {data: clients} = await supabase.from('clients').select('*').ilike('name', '%Lida Raquel%');
    console.log('Found Lida:', clients);
}

run();
