const https = require('https');

const anonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNhbWdwbmN6bHpueW5uZmhqamZmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIxNjU1NjQsImV4cCI6MjA4Nzc0MTU2NH0.AV1Z-QlltfPp8am-_ALlgopoGB8WhOrle83TNZrjqTE';

function req(path, method = 'GET', body = null) {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'samgpnczlznynnfhjjff.supabase.co',
            path: '/rest/v1/' + path,
            method: method,
            headers: { 
                'apikey': anonKey, 
                'Authorization': `Bearer ${anonKey}`,
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
        console.log("1. Buscando Fabians y Gregoria...");
        let users = await req('profiles?select=id,name');
        console.log("Fabians encontrados:", users.filter(u => u.name && u.name.toUpperCase().includes('FABIAN')).map(u => u.name + ' (' + u.id + ')'));
        
        let clients = await req('clients?select=id,name');
        let gregoria = clients.find(c => c.name && c.name.toUpperCase().includes('GREGORIA LEON'));
        
        if (!gregoria) {
            throw new Error("No se pudo encontrar a GREGORIA LEON en la BD.");
        }
        console.log("OK: Gregoria Leon encontrada (ID: " + gregoria.id + ")");

        console.log("2. Buscando los prestamos de Gregoria...");
        let loans = await req('loans?client_id=eq.' + gregoria.id);
        console.log("Prestamos encontrados:", loans.map(l => ({id: l.id, status: l.status, collector_id: l.collector_id})));
        
        // Transfiriendo prestamos a FABIAN ARRUA
        let fabian = users.find(u => u.name === 'fabian arrua' || u.name === 'FABIAN ARRUA' || u.name === 'fabian arrua ');
        if (!fabian) fabian = users.find(u => u.name && u.name.toUpperCase() === 'FABIAN ARRUA');
        
        if (fabian) {
            console.log("3. Transfiriendo prestamos al ID de Fabian Arrua: " + fabian.id);
            let res = await req('loans?client_id=eq.' + gregoria.id, 'PATCH', { collector_id: fabian.id, updated_at: new Date().toISOString() });
            console.log("EXITO TOTAL. Prestamos movidos: ", res.length);
        } else {
             console.log("No pude aislar el ID de fabian arrua de la lista");
        }
    } catch(e) {
        console.error("ERROR: ", e);
    }
}
run();
