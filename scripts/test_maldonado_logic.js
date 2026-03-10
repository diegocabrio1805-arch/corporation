require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

const calculateTotalPaidFromLogs = (loanOrId, collectionLogs) => {
    if (!loanOrId || !collectionLogs) return 0;
    const loanId = typeof loanOrId === 'string' ? loanOrId : (loanOrId.id || loanOrId.loan_id);
    const clientId = typeof loanOrId !== 'string' ? (loanOrId.clientId || loanOrId.client_id || null) : null;

    const validLogs = collectionLogs.filter(log => {
        const logLoanId = String(log.loanId || log.loan_id || '').trim().toLowerCase();
        const lId = String(loanId || '').trim().toLowerCase();
        const logType = String(log.type || '').toUpperCase();
        const isOpening = log.isOpening || log.is_opening || false;
        const isDeleted = log.deletedAt || log.deleted_at;

        if (isDeleted) return false;
        if (!(logType === 'PAGO' || logType === 'PAYMENT')) return false;
        if (isOpening) return false;
        if (logLoanId === lId) return true;
        if (clientId) {
            const logClientId = String(log.clientId || log.client_id || '').trim().toLowerCase();
            const cId = String(clientId || '').trim().toLowerCase();
            if (logClientId === cId && logLoanId !== lId && logLoanId.length > 0) return true; // ghost detection
        }
        return false;
    });
    return validLogs.reduce((acc, log) => acc + (Number(log.amount) || 0), 0);
};

async function run() {
    const { data: clients } = await supabase.from('clients').select('*').ilike('name', '%maldonado%');
    const client = clients[0];
    const { data: loans } = await supabase.from('loans').select('*').eq('client_id', client.id);
    const { data: logs } = await supabase.from('collection_logs').select('*').eq('client_id', client.id);

    console.log("Calculando con el loan:", loans[0].id);
    const total = calculateTotalPaidFromLogs(loans[0], logs);
    console.log("TOTAL HELPER:", total);

    console.log("Desglose real Logs:");
    logs.forEach(l => {
        console.log(` - sumaria? log_id=${l.id} loan_id=${l.loan_id} amt=${l.amount} type=${l.type} is_opening=${l.is_opening}`);
    });
}
run();
