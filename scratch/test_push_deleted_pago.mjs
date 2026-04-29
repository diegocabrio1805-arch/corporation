import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: './.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing credentials in .env.local");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  console.log("Attempting to insert a PAGO_ELIMINADO log record into collection_logs...");
  const fakeId = 'fake-pago-eliminado-' + Date.now();
  
  const { data, error } = await supabase.from('collection_logs').insert([
    {
      id: fakeId,
      loan_id: null,
      client_id: null,
      branch_id: 'test-branch',
      recorded_by: 'test-user',
      amount: 50,
      type: 'PAGO_ELIMINADO',
      date: new Date().toISOString(),
      notes: JSON.stringify({ tipo: 'PAGO_ELIMINADO', reason: 'Testing' })
    }
  ]);

  if (error) {
    console.error("FAILED to insert PAGO_ELIMINADO:", error);
  } else {
    console.log("SUCCESSFULLY inserted PAGO_ELIMINADO. Deleting it now...");
    const { error: delError } = await supabase.from('collection_logs').delete().eq('id', fakeId);
    if (delError) {
      console.error("FAILED to delete fake log:", delError);
    } else {
      console.log("SUCCESSFULLY deleted fake log.");
    }
  }
}

run();
