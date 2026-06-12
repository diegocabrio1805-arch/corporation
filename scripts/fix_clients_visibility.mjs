import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';

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
    let zona2Id = await loginAndGetId('zona2', '1234');
    if (!zona2Id) zona2Id = await loginAndGetId('zona2', 'Cobros2026');

    await supabase.auth.signInWithPassword({ email: 'DDANTE1983@anexocobro.com', password: 'Cobros2026' });

    const {data: allClients} = await supabase.from('clients').select('*').eq('branch_id', adminId).limit(1000);

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

    const clientIds = matchedClients.map(c => c.id);
    console.log(`Matched ${clientIds.length} clients.`);

    const {data: loans} = await supabase.from('loans').select('id, client_id, collector_id, status').in('client_id', clientIds);
    
    console.log(`Found ${loans?.length || 0} loans for these clients.`);
    
    let wrongCollectorLoans = [];
    for (const l of (loans || [])) {
        if (l.collector_id !== zona2Id) {
            wrongCollectorLoans.push(l);
        }
    }
    console.log(`${wrongCollectorLoans.length} loans do NOT have zona2 as collector.`);

    // How many clients don't have zona2 as added_by or collector_id?
    let wrongClients = matchedClients.filter(c => c.added_by !== zona2Id && c.collector_id !== zona2Id);
    console.log(`${wrongClients.length} clients are NOT directly assigned to zona2.`);

    // FIX: Update loans collector_id to zona2
    if (wrongCollectorLoans.length > 0) {
        const loanIds = wrongCollectorLoans.map(l => l.id);
        const { error: updateLoansErr } = await supabase.from('loans').update({ collector_id: zona2Id }).in('id', loanIds);
        if (updateLoansErr) console.error("Error updating loans:", updateLoansErr);
        else console.log("SUCCESSFULLY updated loans to zona2!");
    }

    // FIX: Update clients collector_id to zona2 just in case
    if (wrongClients.length > 0) {
        // First check if collector_id column exists by looking at first client
        if ('collector_id' in matchedClients[0]) {
            const { error: updateClientsErr } = await supabase.from('clients').update({ collector_id: zona2Id }).in('id', clientIds);
            if (updateClientsErr) console.error("Error updating clients collector_id:", updateClientsErr);
            else console.log("SUCCESSFULLY updated clients collector_id to zona2!");
        } else {
            // update added_by instead so they are visible
            const { error: updateClientsErr } = await supabase.from('clients').update({ added_by: zona2Id }).in('id', clientIds);
            if (updateClientsErr) console.error("Error updating clients added_by:", updateClientsErr);
            else console.log("SUCCESSFULLY updated clients added_by to zona2!");
        }
    }
}

run();
