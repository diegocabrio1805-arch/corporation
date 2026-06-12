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
  console.log("Logged in!");
  
  const { data: users } = await supabase.from('users').select('*');
  const user = users.find(u => u.id === 'DDANTE1983');
  console.log("DDANTE1983:", user);
  
  const myBranchIds = new Set();
  const branchId = user.id.toLowerCase();
  myBranchIds.add(branchId);
  users.forEach(u => {
    if (u.managed_by?.toLowerCase() === branchId) myBranchIds.add(u.id.toLowerCase());
  });
  console.log("myBranchIds:", Array.from(myBranchIds));
  
  const { data: clients } = await supabase.from('clients').select('*').ilike('name', '%FLORES, TERESA%');
  console.log("Client FLORES:", clients[0]);
  
  if (clients[0]) {
      const { data: loans } = await supabase.from('loans').select('*').eq('client_id', clients[0].id);
      console.log("Loans for FLORES:", loans.map(l => ({ id: l.id, collector_id: l.collector_id, status: l.status })));
  }
}
check();
