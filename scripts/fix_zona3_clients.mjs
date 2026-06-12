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
    let zona3Id = await loginAndGetId('zona3', '1234');
    if (!zona3Id) zona3Id = await loginAndGetId('zona3', 'Cobros2026');

    await supabase.auth.signInWithPassword({ email: 'DDANTE1983@anexocobro.com', password: 'Cobros2026' });

    // Fetch all clients in the branch
    const {data: allClients} = await supabase.from('clients').select('*').eq('branch_id', adminId).limit(2000);

    const namesToFind = [
        "BLANCA ESTELA SOSA", "NORMA JIMENEZ", "maria lezcano", "CRISTINA BRITEZ", "NORA AVELINA SOSA", 
        "LUCIA ALVAREZ", "nestor veron", "MARIA AMANDA FRUTOS", "JUAN SIMON TORRES", "LORENA MAGDALENA VILLASBOA", 
        "MONICA RUDAS", "MARTI FERREIRA", "FELISA CONCEPCION OBREGON", "NILDA PERALTA ROTELA", "ZUNILDA RAMONA CANO", 
        "ANDRES EMMANUEL MARECO", "HILDA LEGUIZAMON", "MARIA SILVA", "MARIA NANCY LEZCANO", "ISIDRO RUBEN PARQUET", 
        "JULIO ALDERETE", "ULICES BENITEZ DE LOS SANTOS", "PAOLA AMARILLA", "DAMASIO RUBEN DI GALO", 
        "MARIA OLINDA COLLANTE", "GLORIA ELIZABETH OSORIO", "MARIA MUNOZ", "ADELA GRISELDA SNEAD", 
        "RICHARD LOBO GARCIA", "FEDERICO CUEVAS", "FRANCISCO OJEDA", "OLGA COLLANTE GOMEZ", "JOSE IVAN VERON CABALLERO", 
        "GLADYS PETRONA GARCIA COLMAN", "NILDA TERESA RIVEROS", "MARIELA ASUNCION CON SU TIA", "URBANA CACERES", 
        "EDUARDO YAMIL ESPINOLA", "CLAUDIA MAVEL VERA", "MIGUEL CUEVAS JIMENEZ", "LUIS MIGUEL"
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
    console.log(`Matched ${clientIds.length} clients for zona3.`);

    if (clientIds.length === 0) return;

    const {data: loans} = await supabase.from('loans').select('id, client_id, collector_id, status').in('client_id', clientIds);
    console.log(`Found ${loans?.length || 0} loans for these clients.`);
    
    let wrongCollectorLoans = [];
    for (const l of (loans || [])) {
        if (l.collector_id !== zona3Id) {
            wrongCollectorLoans.push(l);
        }
    }
    console.log(`${wrongCollectorLoans.length} loans do NOT have zona3 as collector.`);

    let wrongClients = matchedClients.filter(c => c.added_by !== zona3Id && c.collector_id !== zona3Id);
    console.log(`${wrongClients.length} clients are NOT directly assigned to zona3.`);

    if (wrongCollectorLoans.length > 0) {
        const loanIds = wrongCollectorLoans.map(l => l.id);
        const { error: updateLoansErr } = await supabase.from('loans').update({ collector_id: zona3Id }).in('id', loanIds);
        if (updateLoansErr) console.error("Error updating loans:", updateLoansErr);
        else console.log("SUCCESSFULLY updated loans to zona3!");
    }

    if (wrongClients.length > 0) {
        if ('collector_id' in matchedClients[0]) {
            const { error: updateClientsErr } = await supabase.from('clients').update({ collector_id: zona3Id }).in('id', clientIds);
            if (updateClientsErr) console.error("Error updating clients collector_id:", updateClientsErr);
            else console.log("SUCCESSFULLY updated clients collector_id to zona3!");
        } else {
            const { error: updateClientsErr } = await supabase.from('clients').update({ added_by: zona3Id }).in('id', clientIds);
            if (updateClientsErr) console.error("Error updating clients added_by:", updateClientsErr);
            else console.log("SUCCESSFULLY updated clients added_by to zona3!");
        }
    }
}

run();
