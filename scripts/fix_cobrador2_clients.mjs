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
    let cob2Id = await loginAndGetId('cobrador2', '12345');
    if (!cob2Id) cob2Id = await loginAndGetId('cobrador2', 'Cobros2026');
    console.log("Cobrador2 ID:", cob2Id);

    // Login as admin to ensure we have access to update
    await supabase.auth.signInWithPassword({ email: 'DDANTE1983@anexocobro.com', password: 'Cobros2026' });

    // Fetch all clients globally
    const {data: allClients} = await supabase.from('clients').select('*').limit(5000);

    const namesToFind = [
        "OCAMPOS BLANCO", "AMARILLA CHAPARRO", "VALLEJOS BOGADO", "BAEZ JIMENEZ", 
        "MENDIETA VAZQUEZ", "VERA ALCARAZ", "CHAPARRO, MARIA ANGELA", "PEREZ de ACEVEDO", 
        "OVIEDO RIVAS", "SANCHEZ JARA", "BENITEZ IBARRA", "COCCO GARCIA", 
        "ALMIRON GIMENEZ", "GAONA, CHANINA", "GARCETE FLEITAS", "LUGO DAVALOS", 
        "CANTERO BENITEZ", "VILLALBA MARTINEZ", "CACERES RODRIGUEZ", "DELGADO de FERREIRA", 
        "AQUINO INGLES", "ARECO CUENA", "MARTINEZ VARGAS", "MEZA DUARTE", 
        "MARTINEZ LEGAL", "BENITEZ MAIDANA", "ENCISO ALCARAZ", "OSORIO VALDEZ", 
        "RIQUELME SALINAS", "NOGUERA RAMOS", "VEGA ARROYO"
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
    console.log(`Matched ${clientIds.length} clients for cobrador2 globally.`);

    if (clientIds.length === 0) return;

    const {data: loans} = await supabase.from('loans').select('id, client_id, collector_id, status').in('client_id', clientIds);
    console.log(`Found ${loans?.length || 0} loans for these clients.`);
    
    let wrongCollectorLoans = [];
    for (const l of (loans || [])) {
        if (l.collector_id !== cob2Id) {
            wrongCollectorLoans.push(l);
        }
    }
    console.log(`${wrongCollectorLoans.length} loans do NOT have cobrador2 as collector.`);

    let wrongClients = matchedClients.filter(c => c.added_by !== cob2Id && c.collector_id !== cob2Id);
    console.log(`${wrongClients.length} clients are NOT directly assigned to cobrador2.`);

    if (wrongCollectorLoans.length > 0) {
        const loanIds = wrongCollectorLoans.map(l => l.id);
        const { error: updateLoansErr } = await supabase.from('loans').update({ collector_id: cob2Id }).in('id', loanIds);
        if (updateLoansErr) console.error("Error updating loans:", updateLoansErr);
        else console.log("SUCCESSFULLY updated loans to cobrador2!");
    }

    if (wrongClients.length > 0) {
        if ('collector_id' in matchedClients[0]) {
            const { error: updateClientsErr } = await supabase.from('clients').update({ collector_id: cob2Id }).in('id', clientIds);
            if (updateClientsErr) console.error("Error updating clients collector_id:", updateClientsErr);
            else console.log("SUCCESSFULLY updated clients collector_id to cobrador2!");
        } else {
            const { error: updateClientsErr } = await supabase.from('clients').update({ added_by: cob2Id }).in('id', clientIds);
            if (updateClientsErr) console.error("Error updating clients added_by:", updateClientsErr);
            else console.log("SUCCESSFULLY updated clients added_by to cobrador2!");
        }
    }
}

run();
