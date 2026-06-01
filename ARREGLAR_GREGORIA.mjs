import fs from 'fs';
import https from 'https';

const URL = 'https://samgpnczlznynnfhjjff.supabase.co';
const KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNhbWdwbmN6bHpueW5uZmhqamZmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIxNjU1NjQsImV4cCI6MjA4Nzc0MTU2NH0.AV1Z-QlltfPp8am-_ALlgopoGB8WhOrle83TNZrjqTE';

function req(path, method = 'GET', body = null) {
    return new Promise((resolve, reject) => {
        const hostnameStr = URL.replace('https://', '').replace('http://', '').replace('/', '');
        const options = {
            hostname: hostnameStr,
            path: '/rest/v1/' + path,
            method: method,
            headers: { 
                'apikey': KEY, 
                'Authorization': `Bearer ${KEY}`,
                'Prefer': 'return=representation'
            }
        };
        
        if (body) {
            options.headers['Content-Type'] = 'application/json';
        }

        const r = https.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    resolve(JSON.parse(data));
                } catch(e) {
                    resolve(data);
                }
            });
        });
        r.on('error', reject);
        if (body) r.write(JSON.stringify(body));
        r.end();
    });
}

async function run() {
    try {
        console.log("==================================================");
        console.log("🛠️ INICIANDO CORRECCIÓN DE CLIENTE: GREGORIA LEON");
        console.log("==================================================\n");

        console.log("1. Buscando a GREGORIA LEON en la base de datos...");
        let clients = await req('clients?name=ilike.*GREGORIA%LEON*&select=id,name');
        let gregoria = clients && clients.length > 0 ? clients[0] : null;
        
        if (!gregoria) {
            throw new Error("No se pudo encontrar a GREGORIA LEON. Verifica el nombre.");
        }
        console.log("✅ Encontrada: " + gregoria.name + " (ID: " + gregoria.id + ")");

        console.log("\n2. Buscando a FABIAN ARRUA (Zona 4)...");
        let users = await req('users?name=ilike.*FABIAN%ARRUA*&select=id,name');
        
        let fabianCorrecto = users && users.length > 0 ? users.find(u => !u.name.toLowerCase().includes('2') && !u.name.toLowerCase().includes('3')) : null;
        
        if (!fabianCorrecto) {
            // Intento 2: Buscar en la tabla profiles si no existe users
            let profiles = await req('profiles?name=ilike.*FABIAN%ARRUA*&select=id,name');
            if (profiles && profiles.length > 0) {
                fabianCorrecto = profiles.find(u => !u.name.toLowerCase().includes('2') && !u.name.toLowerCase().includes('3'));
            }
        }

        if (!fabianCorrecto) {
            // Intento 3: Mostrar opciones y usar la primera que no sea arrua2
            let allFabians = (Array.isArray(users) ? users : []).filter(u => u.name && u.name.toLowerCase().includes('fabian'));
            console.log("⚠️ No hubo coincidencia exacta para 'fabian arrua'. Opciones encontradas: ", allFabians.map(u => u.name));
            fabianCorrecto = allFabians.find(u => !u.name.toLowerCase().includes('2') && !u.name.toLowerCase().includes('3'));
            
            if(!fabianCorrecto) throw new Error("No se pudo determinar el ID de Fabian Arrua (Zona 4).");
        }
        
        console.log("✅ Destino correcto: " + fabianCorrecto.name + " (ID: " + fabianCorrecto.id + ")");

        console.log("\n3. Transfiriendo todos los préstamos vinculados...");
        let resLoans = await req('loans?client_id=eq.' + gregoria.id, 'PATCH', { 
            collector_id: fabianCorrecto.id, 
            updated_at: new Date().toISOString() 
        });
        
        console.log("✅ Préstamos actualizados: " + (resLoans.length || 0));

        console.log("\n4. Verificando si existe 'collector_id' en la tabla clients...");
        // Intentar actualizar también la tabla clients si tiene collector_id (para evitar cualquier residuo)
        let resClients = await req('clients?id=eq.' + gregoria.id, 'PATCH', { 
            collector_id: fabianCorrecto.id
        });
        
        if (!resClients.error) {
             console.log("✅ Cliente asignado correctamente a nivel perfil.");
        }

        console.log("\n==================================================");
        console.log("🎉 ÉXITO: El cliente GREGORIA LEON ahora solo pertenece a " + fabianCorrecto.name);
        console.log("==================================================");
        
        // Pausa para que el usuario pueda leer
        setTimeout(() => {}, 5000);

    } catch(e) {
        console.log("\n❌ ERROR DURANTE LA EJECUCIÓN:");
        console.error(e.message || e);
    }
}
run();
