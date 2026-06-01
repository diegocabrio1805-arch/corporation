import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const env = fs.readFileSync('.env.local', 'utf8');
const urlMatch = env.match(/VITE_SUPABASE_URL=(.*)/);
const keyMatch = env.match(/VITE_SUPABASE_ANON_KEY=(.*)/);

const supabase = createClient(urlMatch[1].trim(), keyMatch[1].trim());

async function run() {
  const { data: clients, error: errC } = await supabase.from('clients').select('*').ilike('name', '%GREGORIA LEON%');
  if (errC) console.error(errC);
  console.log('Clients:', clients?.map(c => ({id: c.id, name: c.name})));

  if (clients) {
    for (let c of clients) {
      const { data: loans, error: errL } = await supabase.from('loans').select('*').eq('client_id', c.id);
      if (errL) console.error(errL);
      console.log(`Loans for ${c.name} (${c.id}):`);
      console.table(loans?.map(l => ({ id: l.id, status: l.status, collector_id: l.collector_id, amount: l.total_amount, paid: l.total_paid, created_at: l.created_at })));
    }
  }

  const { data: users, error: errU } = await supabase.from('users').select('*').ilike('name', '%fabian arrua%');
  if (errU) console.error(errU);
  console.log('Users:', users?.map(u => ({id: u.id, name: u.name})));
}

run();
