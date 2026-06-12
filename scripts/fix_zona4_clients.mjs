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
    let zona4Id = await loginAndGetId('zona4', '4444');
    if (!zona4Id) zona4Id = await loginAndGetId('zona4', 'Cobros2026');

    await supabase.auth.signInWithPassword({ email: 'DDANTE1983@anexocobro.com', password: 'Cobros2026' });

    // Fetch all clients in the branch
    const {data: allClients} = await supabase.from('clients').select('*').eq('branch_id', adminId).limit(2000);

    const namesToFind = [
        "GREGORIA LEON", "JUNIOR BAEZ", "jorge romero", "Dant prueba", "ISABEL OLMEDO", 
        "cliente prueba", "MARIA CRISTINA GODOY", "AURELIA ALARCON", "MARTA INFRAN", 
        "AGUSTIN INFRAN", "CECILIA BAEZ MARTINEZ", "OSCAR ARSE", "MANUEL BARONE", 
        "LORENZA FRANCO", "OSCAR ARCE", "DORA CUBILLA", "NATALIA PRIETO", "ZONIA LEON", 
        "JUAN VILLANUEVA", "HUGO ARSENIO GONZALEZ", "CASILDA BENITEZ", "ALBA CUEVAS", 
        "S ELIDA PRIETO", "PASTOR PANDO CANO", "ELODIA LOPEZ", "TERESA BEATRIZ", 
        "FELICITA MACHUCA", "JORGE SOSA", "YOHANA PELUQUERIA", "GABINO ROJAS", 
        "MARIA A. DE LOS SANTOS", "LUIS SANCHEZ", "ALBERTO GENES", "BIANCA FARINA", 
        "JOHNNY MIGUEL ZARATE", "ALCIDIA CABRERA", "OLMEDO LIBRADA", "ALICIA BEATRIZ", 
        "MARIA AURORA VILLANUEVA", "JUAN GIMENEZ", "NANCI ARAMI ARRIOLA", "GLORIA SILVA", 
        "ROSALINO ACUNA", "LIZ BENITEZ", "NORMA ELIZABETH", "JORGE LOMITERO", 
        "MARISA BENITEZ", "MARIA DEL CARMEN MORA", "ggg"
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
    console.log(`Matched ${clientIds.length} clients for zona4.`);

    if (clientIds.length === 0) return;

    const {data: loans} = await supabase.from('loans').select('id, client_id, collector_id, status').in('client_id', clientIds);
    console.log(`Found ${loans?.length || 0} loans for these clients.`);
    
    let wrongCollectorLoans = [];
    for (const l of (loans || [])) {
        if (l.collector_id !== zona4Id) {
            wrongCollectorLoans.push(l);
        }
    }
    console.log(`${wrongCollectorLoans.length} loans do NOT have zona4 as collector.`);

    let wrongClients = matchedClients.filter(c => c.added_by !== zona4Id && c.collector_id !== zona4Id);
    console.log(`${wrongClients.length} clients are NOT directly assigned to zona4.`);

    if (wrongCollectorLoans.length > 0) {
        const loanIds = wrongCollectorLoans.map(l => l.id);
        const { error: updateLoansErr } = await supabase.from('loans').update({ collector_id: zona4Id }).in('id', loanIds);
        if (updateLoansErr) console.error("Error updating loans:", updateLoansErr);
        else console.log("SUCCESSFULLY updated loans to zona4!");
    }

    if (wrongClients.length > 0) {
        if ('collector_id' in matchedClients[0]) {
            const { error: updateClientsErr } = await supabase.from('clients').update({ collector_id: zona4Id }).in('id', clientIds);
            if (updateClientsErr) console.error("Error updating clients collector_id:", updateClientsErr);
            else console.log("SUCCESSFULLY updated clients collector_id to zona4!");
        } else {
            const { error: updateClientsErr } = await supabase.from('clients').update({ added_by: zona4Id }).in('id', clientIds);
            if (updateClientsErr) console.error("Error updating clients added_by:", updateClientsErr);
            else console.log("SUCCESSFULLY updated clients added_by to zona4!");
        }
    }
}

run();
