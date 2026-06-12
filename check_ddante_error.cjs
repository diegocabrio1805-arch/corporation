const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = 'https://samgpnczlznynnfhjjff.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNhbWdwbmN6bHpueW5uZmhqamZmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIxNjU1NjQsImV4cCI6MjA4Nzc0MTU2NH0.AV1Z-QlltfPp8am-_ALlgopoGB8WhOrle83TNZrjqTE';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function check() {
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email: 'DDANTE1983@anexocobro.com', // typical format
    password: 'Cobros2026'
  });
  
  if (authError) {
      console.log("Auth Error:", authError.message);
      return;
  }
  
  const { data: users, error: usersError } = await supabase.from('users').select('*');
  console.log("usersError:", usersError);
  
  const { data: clients, error: clientsError } = await supabase.from('clients').select('*').ilike('name', '%FLORES, TERESA%');
  console.log("Client FLORES:", clients && clients[0]);
  
  if (clients && clients[0]) {
      const { data: loans } = await supabase.from('loans').select('*').eq('client_id', clients[0].id);
      console.log("Loans for FLORES:", loans && loans.map(l => ({ id: l.id, collector_id: l.collector_id, status: l.status })));
  }
}
check();
