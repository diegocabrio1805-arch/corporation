import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://samgpnczlznynnfhjjff.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNhbWdwbmN6bHpueW5uZmhqamZmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIxNjU1NjQsImV4cCI6MjA4Nzc0MTU2NH0.AV1Z-QlltfPp8am-_ALlgopoGB8WhOrle83TNZrjqTE';
const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  const { data, error } = await supabase.rpc('get_schema');
  console.log('Intento de RPC:', error || 'OK');
  
  // Alternative: query information_schema or just insert an empty object to get the error
  const { error: err } = await supabase.from('expenses').upsert({});
  console.log('Error de upsert vacío:', err);
}

check();
