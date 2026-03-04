
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

// Leer .env.local de forma robusta
const envPath = 'c:/Users/DANIEL/Desktop/cobros/.env.local';
const envContent = fs.readFileSync(envPath, 'utf8');
const env = {};
envContent.split(/\r?\n/).forEach(line => {
    const parts = line.split('=');
    if (parts.length >= 2) {
        const key = parts[0].trim();
        const value = parts.slice(1).join('=').trim().replace(/^['"]|['"]$/g, '');
        env[key] = value;
    }
});

const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

async function syncDiegoPayments() {
    const diegoId = '558ce035-e158-42d8-b18e-9649a7f5c52b';
    const correctBranch = '93e73104-7ce8-453b-b0a3-b574b69a744c';

    console.log(`Iniciando auditoría técnica de pagos para Diego Escribano...`);

    // 1. Obtener clientes
    const { data: clients } = await supabase.from('clients').select('id, name').eq('added_by', diegoId);
    if (!clients || clients.length === 0) return;

    const clientIds = clients.map(c => c.id);

    // 2. Obtener préstamos (detectando columnas reales)
    const { data: loans, error: lError } = await supabase.from('loans').select('*').in('client_id', clientIds);
    if (lError) {
        console.error("Error préstamos:", lError);
        return;
    }

    const loanSample = loans[0] || {};
    const amountCol = 'total_amount' in loanSample ? 'total_amount' : ('amount' in loanSample ? 'amount' : 'capital');
    const balanceCol = 'balance' in loanSample ? 'balance' : 'current_balance';

    console.log(`Columnas detectadas - Monto: ${amountCol}, Saldo: ${balanceCol}`);

    // 3. Obtener pagos
    const loanIds = loans.map(l => l.id);
    const { data: payments } = await supabase.from('payments').select('*').in('loan_id', loanIds);

    // 4. Actualizar sucursal en pagos si la columna existe
    if (payments && payments.length > 0 && 'branch_id' in payments[0]) {
        await supabase.from('payments').update({ branch_id: correctBranch }).in('loan_id', loanIds);
        console.log("Sucursal unificada en registros de pago.");
    }

    // 5. Sincronizar saldos de préstamos
    console.log("\nAlineando saldos según pagos registrados...");
    for (const loan of loans) {
        const loanPayments = payments.filter(p => p.loan_id === loan.id);
        const totalPaid = loanPayments.reduce((sum, p) => sum + p.amount, 0);
        const expectedBalance = loan[amountCol] - totalPaid;

        if (loan[balanceCol] !== expectedBalance) {
            console.log(`Ajustando saldo Cliente ${loan.client_id}: DB=${loan[balanceCol]} -> Real=${expectedBalance}`);
            await supabase.from('loans').update({ [balanceCol]: Math.max(0, expectedBalance) }).eq('id', loan.id);
        }
    }

    console.log("\nSincronización de Diego Escribano finalizada.");
}

syncDiegoPayments();
