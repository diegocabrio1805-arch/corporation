import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://samgpnczlznynnfhjjff.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNhbWdwbmN6bHpueW5uZmhqamZmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIxNjU1NjQsImV4cCI6MjA4Nzc0MTU2NH0.AV1Z-QlltfPp8am-_ALlgopoGB8WhOrle83TNZrjqTE';
const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  const payload = {
    id: "test-uuid-5678",
    description: "IMPRESORA_TEST_2",
    amount: 500000,
    category: "Otros", // Con minúsculas, igual que en el código
    date: new Date().toISOString(),
    branch_id: "none",
    added_by: "none",
    updated_at: new Date().toISOString()
  };
  
  const { data, error } = await supabase.from('expenses').upsert(payload);
  if (error) {
    console.error('Error insertando en expenses:', error);
  } else {
    console.log("Inserción exitosa:", data);
  }
}

check();
