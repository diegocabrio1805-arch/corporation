import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkProfiles() {
  console.log('--- INICIANDO DIAGNÓSTICO DE PERFILES (GERENTES Y COBRADORES) ---');
  
  const { data: profiles, error } = await supabase
    .from('profiles')
    .select('id, name, username, role, managed_by, branch_id, admin_id');
    
  if (error) {
    console.error("Error obteniendo perfiles:", error);
    return;
  }
  
  const admins = profiles.filter(p => p.role === 'ADMIN');
  const managers = profiles.filter(p => p.role === 'MANAGER');
  const collectors = profiles.filter(p => p.role === 'COLLECTOR');
  
  console.log(`\nAdmins (${admins.length}):`);
  admins.forEach(a => console.log(`- [${a.id}] ${a.name} (${a.username})`));
  
  console.log(`\nGerentes/Sucursales (${managers.length}):`);
  managers.forEach(m => console.log(`- [${m.id}] ${m.name} (${m.username}) | admin_id: ${m.admin_id}`));

  console.log(`\nCobradores (${collectors.length}):`);
  const orphans = [];
  
  collectors.forEach(c => {
    let linkedTo = 'NINGUNO (HUÉRFANO)';
    if (c.managed_by) {
      const mgr = managers.find(m => m.id === c.managed_by);
      linkedTo = mgr ? `GERENTE: ${mgr.name}` : `ID GERENTE NO ENCONTRADO (${c.managed_by})`;
    } else if (c.branch_id) {
       linkedTo = `(Solo branch_id: ${c.branch_id})`;
    } else if (c.admin_id) {
       linkedTo = `(Solo admin_id: ${c.admin_id})`;
    }
    
    console.log(`- ${c.name} (${c.username}) -> Vinculado a: ${linkedTo}`);
    if (linkedTo.includes('NINGUNO') || linkedTo.includes('NO ENCONTRADO') || linkedTo.includes('Solo')) {
      orphans.push(c);
    }
  });

  if (orphans.length > 0) {
    console.log('\n--- DETALLE DE COBRADORES DESVINCULADOS ---');
    orphans.forEach(o => console.log(o));
  }
}

checkProfiles();
