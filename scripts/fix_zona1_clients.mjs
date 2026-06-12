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
    const adminId = await loginAndGetId('DDANTE1983', 'Cobros2026');
    let zona1Id = await loginAndGetId('zona1', '1234');
    if (!zona1Id) zona1Id = await loginAndGetId('zona1', 'Cobros2026');

    await supabase.auth.signInWithPassword({ email: 'DDANTE1983@anexocobro.com', password: 'Cobros2026' });

    // Fetch all clients in the branch
    const {data: allClients} = await supabase.from('clients').select('*').eq('branch_id', adminId).limit(2000);

    const namesToFind = [
        "ALBA LIDIA MERCADO GALEANO", "RAMONA OZUNA", "EFRAIN 1", "cami 2", "IGNACIA RODRIGUEZ", 
        "JV AMADA OCAMPO", "JV MIRIAM ACOSTA", "JV MIRIAM OZORIO", "JV PAOLO", "JV SERGIA", 
        "ANTONIO ELIODORO", "JV ARNALDO ALVAREZ", "GONZALO ROTELA", "1946 LERIN", "ALDO ACOSTA", 
        "MARIA VERONICA", "RAMONA OZUNA (VECINA)", "JV JORGE WEBER", "JV RODOLFO", "JV BJ MIRIAN", 
        "JV TOMASA MARTINEZ", "JV NESTOR DEL PILAR", "NIELSEN BEATRIZ", "NIELSEN MARIDO", "JV BLANCA ALEGRE", 
        "JV MARCO ALEGRE", "JV MIGUEL GONZALEZ", "JV MARCIA DOMINGUEZ", "SAUL CABALLERO", "LUARA ALICIA", 
        "JV GLADYS VERA", "JV GY CARINA", "OFELIA 2", "JV GRACIELA BOGADO", "JV JUAN FLORES", 
        "JV LILIAN FLORES", "ISABEL 2", "JV JUAN ANTONIO", "JV MARTA GENES", "JV GY FRANCISCO", 
        "MERCE 3", "AMADA OCAMPO", "MARILIN PORTILLO", "CAROLINA ALVAREZ", "CESAR GONZALO ROTELA", 
        "ELENA FERREIRA", "FRANCISCO (HIJO DE", "MARIO VECINO", "DV MERCEDES ALARCON", "CAMI", 
        "EFRAIN 2", "EFRAIN NUNEZ", "NESTOR -RAMON-", "JUAN AGAPITO", "OLGA NOEMI GAVILAN", 
        "JV LILIA ELIZABETH", "LILIA ELIZABETH", "FELIPE GONZALEZ", "DIONISIO ACHUCARRO", 
        "VENANCIO SANABRIA", "JV MELANIO FLORES", "DV MERCEDES ALARCON (2)"
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
    console.log(`Matched ${clientIds.length} clients for zona1.`);

    if (clientIds.length === 0) return;

    const {data: loans} = await supabase.from('loans').select('id, client_id, collector_id, status').in('client_id', clientIds);
    console.log(`Found ${loans?.length || 0} loans for these clients.`);
    
    let wrongCollectorLoans = [];
    for (const l of (loans || [])) {
        if (l.collector_id !== zona1Id) {
            wrongCollectorLoans.push(l);
        }
    }
    console.log(`${wrongCollectorLoans.length} loans do NOT have zona1 as collector.`);

    let wrongClients = matchedClients.filter(c => c.added_by !== zona1Id && c.collector_id !== zona1Id);
    console.log(`${wrongClients.length} clients are NOT directly assigned to zona1.`);

    if (wrongCollectorLoans.length > 0) {
        const loanIds = wrongCollectorLoans.map(l => l.id);
        const { error: updateLoansErr } = await supabase.from('loans').update({ collector_id: zona1Id }).in('id', loanIds);
        if (updateLoansErr) console.error("Error updating loans:", updateLoansErr);
        else console.log("SUCCESSFULLY updated loans to zona1!");
    }

    if (wrongClients.length > 0) {
        if ('collector_id' in matchedClients[0]) {
            const { error: updateClientsErr } = await supabase.from('clients').update({ collector_id: zona1Id }).in('id', clientIds);
            if (updateClientsErr) console.error("Error updating clients collector_id:", updateClientsErr);
            else console.log("SUCCESSFULLY updated clients collector_id to zona1!");
        } else {
            const { error: updateClientsErr } = await supabase.from('clients').update({ added_by: zona1Id }).in('id', clientIds);
            if (updateClientsErr) console.error("Error updating clients added_by:", updateClientsErr);
            else console.log("SUCCESSFULLY updated clients added_by to zona1!");
        }
    }
}

run();
