const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://samgpnczlznynnfhjjff.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNhbWdwbmN6bHpueW5uZmhqamZmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIxNjU1NjQsImV4cCI6MjA4Nzc0MTU2NH0.AV1Z-QlltfPp8am-_ALlgopoGB8WhOrle83TNZrjqTE';


const supabase = createClient(supabaseUrl, supabaseKey);

async function repairBalances() {
    console.log("=== INICIANDO REPARACION DE SALDOS AUTOMATICA ===");

    // 1. Fetch all active clients
    const { data: clients, error: clientsErr } = await supabase.from('clients').select('id, name, current_balance, is_active').eq('is_active', true);
    if (clientsErr) throw clientsErr;

    // 2. Fetch all active/default loans
    const { data: loans, error: loansErr } = await supabase.from('loans').select('*').in('status', ['Activo', 'ACTIVE', 'DEFAULT']);
    if (loansErr) throw loansErr;

    // 3. Fetch all payment logs
    const { data: logs, error: logsErr } = await supabase.from('collection_logs').select('id, loan_id, client_id, amount, is_opening').eq('type', 'PAGO').is('deleted_at', null);
    if (logsErr) throw logsErr;

    console.log(`Analizando ${clients.length} clientes, ${loans.length} creditos y ${logs.length} pagos validos.`);

    let updatedLoansCount = 0;
    let closedLoansCount = 0;
    let updatedClientsCount = 0;

    for (const client of clients) {
        let totalClientDebt = 0;
        let totalClientPaid = 0;

        const clientLoans = loans.filter(l => l.client_id === client.id);

        for (const loan of clientLoans) {
            // Calculate real paid from logs for this loan (EXCLUDING is_opening)
            const loanLogs = logs.filter(lg => lg.loan_id === loan.id && !lg.is_opening);
            const totalPaidForLoan = loanLogs.reduce((acc, curr) => acc + Number(curr.amount), 0);

            totalClientDebt += Number(loan.total_amount);
            totalClientPaid += totalPaidForLoan;

            // Reconstruct installments JSON
            let installments = loan.installments || [];
            if (typeof installments === 'string') {
                try { installments = JSON.parse(installments); } catch (e) { installments = []; }
            }

            let remainingToDistribute = totalPaidForLoan;
            let installmentsChanged = false;

            installments = installments.map(inst => {
                const dueAmount = Number(inst.amount) || 0;
                if (remainingToDistribute >= dueAmount - 0.01) {
                    remainingToDistribute -= dueAmount;
                    if (inst.status !== 'paid' || inst.paidAmount !== dueAmount) {
                        inst.status = 'paid';
                        inst.paidAmount = dueAmount;
                        installmentsChanged = true;
                    }
                } else if (remainingToDistribute > 0) {
                    if (inst.paidAmount !== remainingToDistribute) {
                        inst.status = 'pending';
                        inst.paidAmount = remainingToDistribute;
                        installmentsChanged = true;
                    }
                    remainingToDistribute = 0;
                } else {
                    if (inst.paidAmount !== 0 || inst.status === 'paid') {
                        inst.status = 'pending';
                        inst.paidAmount = 0;
                        installmentsChanged = true;
                    }
                }
                return inst;
            });

            const loanRemainingBalance = Math.max(0, Number(loan.total_amount) - totalPaidForLoan);
            let newStatus = loan.status;

            if (loanRemainingBalance <= 0.01) {
                newStatus = 'Pagado';
                closedLoansCount++;
            }

            if (installmentsChanged || newStatus !== loan.status) {
                await supabase.from('loans').update({
                    installments: installments,
                    status: newStatus
                }).eq('id', loan.id);
                updatedLoansCount++;
            }
        }

        // Fix client balance mathematically identical to the UI
        // UI uses sum + Math.max(0, l.totalAmount - calculatedPaid)
        const uiCalculatedBalance = clientLoans.reduce((sum, loan) => {
            const lPaid = logs.filter(lg => lg.loan_id === loan.id && !lg.is_opening).reduce((acc, curr) => acc + Number(curr.amount), 0);
            return sum + Math.max(0, Number(loan.total_amount) - lPaid);
        }, 0);

        if (Math.abs(Number(client.current_balance || 0) - uiCalculatedBalance) > 1.0) {
            await supabase.from('clients').update({
                current_balance: uiCalculatedBalance
            }).eq('id', client.id);
            updatedClientsCount++;
            console.log(`Corregido Cliente: ${client.name} | De: $${client.current_balance} -> $${uiCalculatedBalance}`);
        }
    }

    console.log("=== FIN REPARACION ===");
    console.log(`Prestamos actualizados (JSON): ${updatedLoansCount}`);
    console.log(`Prestamos marcados como pagados cerrados: ${closedLoansCount}`);
    console.log(`Clientes actualizados (Saldo Ficha): ${updatedClientsCount}`);
}

repairBalances().catch(console.error);
