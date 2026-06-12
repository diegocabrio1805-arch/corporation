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
    return data?.user?.id;
}

async function run() {
    let coaId = await loginAndGetId('coacobrador3', '54321');
    if (!coaId) coaId = await loginAndGetId('coacobrador3', 'Cobros2026');
    console.log("CoaId:", coaId);

    // Login as admin to ensure we have access to update
    await supabase.auth.signInWithPassword({ email: 'DDANTE1983@anexocobro.com', password: 'Cobros2026' });

    // Fetch all clients without limiting by branch_id, since they might be in a different branch
    const {data: allClients} = await supabase.from('clients').select('*').limit(5000);

    const namesToFind = [
        "VILLASANTTI SOSA", "DIAZ RIOS", "CHAVEZ TORRES", "AMARILLA, LOURDES TATIANA", 
        "FERREIRA BORDON", "HERMOSILLA GODOY", "FLORENCIAÑEZ RAMIREZ", "VERA FARIÑA", 
        "VILLALBA GALEANO", "MALDONADO", "IRALA CHAMORRO", "VERA de DELGADO", 
        "SOSA, ALBA ROSA", "HAEDO BAEZ", "CRISTALDO LOPEZ", "CABALLERO COLMAN", 
        "SOTELO FALCON", "AMARILLA GONZALEZ", "RIQUELME CORONEL", "ALVARENGA FLEITAS", 
        "MEDINA RAMIREZ", "AGUILAR ORTIZ", "ALEGRE GARCIA", "ALMADA ALFONSO", 
        "FLORES, TERESA RAMONA", "LEDESMA VIÑARRO", "VILLAMAYOR, NILDA GRACIELA", 
        "RAMIREZ FALCON", "MOREL SANCHEZ", "FERNANDEZ REYES", "GARCIA ROJAS", 
        "ESCURRA GOMEZ", "VERA SILVA", "ACOSTA FRANCO", "GONZALEZ, SILVIA LORENA", 
        "AQUINO de MOREL", "RIVEROS GAONA", "FERNANDEZ DURE", "BENITEZ de CABALLERO", 
        "SALINAS TORRES", "OLIVARES ORTIZ", "MORALES, MILAGROS LUJAN", "ALVARENGA MONGELOS", 
        "CORONEL FARIÑA", "GAVILAN de OLMEDO", "AMARILLA RAMIREZ", "AVALOS SALDIVAR", 
        "SAUCEDO SILVA", "SOTO CACERES", "PAREDES MONGES", "ALVEZ AVALOS", 
        "PEREIRA TRINIDAD", "DEMANT SOSA", "MAZZINI CHAVEZ", "ROJAS CABRERA"
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

    const clientIds = matchedClients.map(c => c.id);
    console.log(`Matched ${clientIds.length} clients for coacobrador3 globally.`);

    if (clientIds.length === 0) return;

    const {data: loans} = await supabase.from('loans').select('id, client_id, collector_id, status').in('client_id', clientIds);
    console.log(`Found ${loans?.length || 0} loans for these clients.`);
    
    let wrongCollectorLoans = [];
    for (const l of (loans || [])) {
        if (l.collector_id !== coaId) {
            wrongCollectorLoans.push(l);
        }
    }
    console.log(`${wrongCollectorLoans.length} loans do NOT have coacobrador3 as collector.`);

    let wrongClients = matchedClients.filter(c => c.added_by !== coaId && c.collector_id !== coaId);
    console.log(`${wrongClients.length} clients are NOT directly assigned to coacobrador3.`);

    if (wrongCollectorLoans.length > 0) {
        const loanIds = wrongCollectorLoans.map(l => l.id);
        const { error: updateLoansErr } = await supabase.from('loans').update({ collector_id: coaId }).in('id', loanIds);
        if (updateLoansErr) console.error("Error updating loans:", updateLoansErr);
        else console.log("SUCCESSFULLY updated loans to coacobrador3!");
    }

    if (wrongClients.length > 0) {
        if ('collector_id' in matchedClients[0]) {
            const { error: updateClientsErr } = await supabase.from('clients').update({ collector_id: coaId }).in('id', clientIds);
            if (updateClientsErr) console.error("Error updating clients collector_id:", updateClientsErr);
            else console.log("SUCCESSFULLY updated clients collector_id to coacobrador3!");
        } else {
            const { error: updateClientsErr } = await supabase.from('clients').update({ added_by: coaId }).in('id', clientIds);
            if (updateClientsErr) console.error("Error updating clients added_by:", updateClientsErr);
            else console.log("SUCCESSFULLY updated clients added_by to coacobrador3!");
        }
    }
}

run();
