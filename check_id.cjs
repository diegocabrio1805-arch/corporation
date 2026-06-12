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
  } else {
      console.log("Logged in ID:", authData.user.id);
  }
}
check();
