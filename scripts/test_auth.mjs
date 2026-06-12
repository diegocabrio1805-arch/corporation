import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://samgpnczlznynnfhjjff.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNhbWdwbmN6bHpueW5uZmhqamZmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIxNjU1NjQsImV4cCI6MjA4Nzc0MTU2NH0.AV1Z-QlltfPp8am-_ALlgopoGB8WhOrle83TNZrjqTE';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function loginAndGetId(username, password) {
    const email = username.includes('@') ? username : `${username}@anexocobro.com`;
    const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
    });
    if (error) {
        console.error(`Login failed for ${username} with pass ${password}:`, error.message);
        return null;
    }
    return data.user.id;
}

async function run() {
    console.log("Logging in...");
    const adminId = await loginAndGetId('DDANTE1983', 'Cobros2026');
    console.log("Admin ID:", adminId);

    // Try to get zona2 id
    let zona2Id = await loginAndGetId('zona2', '1234');
    if (!zona2Id) {
        zona2Id = await loginAndGetId('zona2', 'Cobros2026');
    }
    console.log("Zona2 ID:", zona2Id);

    if (!adminId || !zona2Id) return;

    // Login as admin again to perform queries if needed
    await supabase.auth.signInWithPassword({ email: 'DDANTE1983@anexocobro.com', password: 'Cobros2026' });

    // Fetch all clients in the branch to check them
    const {data: allClients} = await supabase.from('clients').select('id, name, branch_id, added_by').eq('branch_id', adminId).limit(1000);
    console.log(`Total clients visible to admin (branch_id = adminId): ${allClients?.length}`);

    if (allClients) {
        const namesToFind = [
            "Lida Raquel", "PATRICIA MELGAREJO", "WILMA MOUDELLE", "MARIA RAMONA GOMEZ",
            "CARLOS GALEANO", "PEDRO ANTONIO MARTINEZ", "PEDRO RAMON GONZALEZ", "ARNALDO AYALA",
            "JAIME ALFREDO SALINAS", "DERLIS BAEZ", "GABRIELA NOEMI RESQUIN", "NOELIA MIRANDA",
            "MIRIAN CENTURION", "ROSSANNA ENCARNACION", "JOSE CARLOS CAREAGA", "HUGO ANTONIO RODRIGUEZ",
            "NAHIDELIN GIANINA", "PAMELA LEITE", "CRISTINA ELVIRA", "JORGE MIGUEL",
            "VICENTE PAUL BERNAL", "LUCINA REYES", "GUSTAVO ALFREDO", "FRANCISCO DAVID",
            "ESNILDA RECALDE", "NESTOR HUMBERTO", "ALICE ARECO", "MAURA ISABEL",
            "MERCEDES CONCEPCION", "OLGA ZARACHO", "BLANCA EDITH", "JORGE ANTONIO",
            "JORGE DANIEL", "MARIA LUZ", "CLAUDIA CAROLINA", "JUAN GILBERTO",
            "JACQUELINE MARITE", "FREDY ARNALDO", "VALENTIN GODOY", "ARNALDO DAVID",
            "ELISA ABDALA", "GLADYS ANTONIA", "SANDRA ELIZABET", "ARNALDO DARIO",
            "ALEJANDRO ZARATE", "DIANA NATALIA", "CYNTIA MELGAREJO", "BENICIA ROMERO"
        ];

        let matchedClients = [];
        for (const c of allClients) {
            for (const name of namesToFind) {
                if (c.name.toUpperCase().includes(name.toUpperCase())) {
                    matchedClients.push(c);
                    break;
                }
            }
        }
        console.log(`Matched ${matchedClients.length} clients out of the requested list.`);
        
        // Output matched clients ids so we can update them in another step
        require('fs').writeFileSync('matched_clients.json', JSON.stringify(matchedClients, null, 2));
        console.log("Wrote matched_clients.json. Sample:", matchedClients[0]);
    }
}

run();
