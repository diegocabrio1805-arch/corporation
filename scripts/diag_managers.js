import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Faltan credenciales VITE_SUPABASE_URL o VITE_SUPABASE_ANON_KEY en .env.local");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkManagers() {
  console.log('--- INICIANDO DIAGNÓSTICO DE GERENTES Y COBRADORES ---');
  
  // Obtener Gerentes
  const { data: managers, error: mgrErr } = await supabase
    .from('users')
    .select('id, name, username, role')
    .eq('role', 'MANAGER');
    
  if (mgrErr) {
    console.error("Error obteniendo gerentes:", mgrErr);
    return;
  }
  
  console.log(`\nEncontrados ${managers.length} Gerentes/Sucursales:`);
  managers.forEach(m => console.log(`- [${m.id}] ${m.name} (${m.username})`));

  // Obtener Cobradores
  const { data: collectors, error: colErr } = await supabase
    .from('users')
    .select('id, name, username, role, managed_by, branch_id, admin_id')
    .eq('role', 'COLLECTOR');

  if (colErr) {
    console.error("Error obteniendo cobradores:", colErr);
    return;
  }

  console.log(`\nEncontrados ${collectors.length} Cobradores en total.`);
  
  // Agrupar cobradores por managed_by
  console.log('\n--- VÍNCULOS DE COBRADORES ---');
  const orphans = [];
  
  collectors.forEach(c => {
    if (!c.managed_by) {
      orphans.push(c);
      return;
    }
    
    const manager = managers.find(m => m.id === c.managed_by);
    if (manager) {
      console.log(`[OK] Cobrador: ${c.name} (${c.username}) -> Asignado a Gerente: ${manager.name}`);
    } else {
      console.log(`[WARNING] Cobrador: ${c.name} (${c.username}) -> managed_by: ${c.managed_by} (GERENTE NO ENCONTRADO EN TABLA MANAGER)`);
    }
  });

  if (orphans.length > 0) {
    console.log(`\n--- COBRADORES HUÉRFANOS (Sin managed_by asignado) [${orphans.length}] ---`);
    console.log(`Estos cobradores NO aparecerán en el panel de ninguna sucursal:`);
    orphans.forEach(o => {
      console.log(`- ${o.name} (${o.username}) | branch_id: ${o.branch_id} | admin_id: ${o.admin_id}`);
    });
  }
}

checkManagers();
