require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const { calculateTotalPaidFromLogs } = require('./utils/helpers.ts');

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkLogic() {
    const { data: clients } = await supabase.from('clients').select('*').ilike('name', '%maldonado%');
    const client = clients[0];
    const { data: loans } = await supabase.from('loans').select('*').eq('client_id', client.id);
    const { data: logs } = await supabase.from('collection_logs').select('*').eq('client_id', client.id);

    // Mapear como hace App.tsx
    const parsedLogs = logs.map(l => ({
        ...l,
        loanId: l.loan_id,
        clientId: l.client_id,
        isOpening: l.is_opening,
        type: l.type
    }));

    const total = calculateTotalPaidFromLogs(loans[0], parsedLogs);
    console.log("Total calculado por el helper:", total);

    // Veamos que pasa adentro:
    let sum = 0;
    parsedLogs.forEach(log => {
        console.log(`Log ${log.amount} | is_opening: ${log.is_opening} -> isOpening: ${log.isOpening}`);
        if (!log.isOpening) { sum += log.amount; }
    });
    console.log("Total sumado a mano ignorando isOpening:", sum);
}
checkLogic();
