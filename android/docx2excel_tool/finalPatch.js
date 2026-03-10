const fs = require('fs');

const file = 'c:/Users/DANIEL/Desktop/cobros/components/Clients.tsx';
let content = fs.readFileSync(file, 'utf8');

// Parche global para filteredClients (la lista de la UI)
const targetStrFiltered = `        const activeLoan = (Array.isArray(state.loans) ? state.loans : []).find(l => (l.clientId || (l as any).client_id) === c.id && (l.status === LoanStatus.ACTIVE || l.status === LoanStatus.DEFAULT));
        const addedByLower = (c.addedBy || (c as any).added_by || '').toLowerCase();

        return addedByLower === collectorLower || (activeLoan?.collectorId || (activeLoan as any)?.collector_id)?.toLowerCase() === collectorLower;`;

const repStrFiltered = `        const activeLoan = (Array.isArray(state.loans) ? state.loans : []).find(l => (l.clientId || (l as any).client_id) === c.id && (l.status === LoanStatus.ACTIVE || l.status === LoanStatus.DEFAULT));
        const anyHistoricLoan = (Array.isArray(state.loans) ? state.loans : []).find(l => (l.clientId || (l as any).client_id) === c.id && (l.collectorId || (l as any).collector_id)?.toLowerCase() === collectorLower);
        const addedByLower = (c.addedBy || (c as any).added_by || '').toLowerCase();

        return addedByLower === collectorLower || (activeLoan?.collectorId || (activeLoan as any)?.collector_id)?.toLowerCase() === collectorLower || !!anyHistoricLoan;`;

if (content.includes(targetStrFiltered)) {
    content = content.replace(targetStrFiltered, repStrFiltered);
    console.log("PATCH FILETREDCLIENTS DONE");
}

// Parche para carteraExcelData (la tabla visual en pestaña Cartera y exportación)
const targetStrCartera = `        const activeLoan = (Array.isArray(state.loans) ? state.loans : []).find(l => (l.clientId || (l as any).client_id) === c.id && (l.status === LoanStatus.ACTIVE || l.status === LoanStatus.DEFAULT));
        const addedByLower = (c.addedBy || (c as any).added_by || '').toLowerCase();
        return addedByLower === collectorLower || (activeLoan?.collectorId || (activeLoan as any)?.collector_id)?.toLowerCase() === collectorLower;`;

const repStrCartera = `        const activeLoan = (Array.isArray(state.loans) ? state.loans : []).find(l => (l.clientId || (l as any).client_id) === c.id && (l.status === LoanStatus.ACTIVE || l.status === LoanStatus.DEFAULT));
        // Buscar CUALQUIER préstamo histórico (incluyendo PAGADOS) que haya sido asignado a este cobrador
        const anyHistoricLoan = (Array.isArray(state.loans) ? state.loans : []).find(l => (l.clientId || (l as any).client_id) === c.id && (l.collectorId || (l as any).collector_id)?.toLowerCase() === collectorLower);
        
        const addedByLower = (c.addedBy || (c as any).added_by || '').toLowerCase();
        return addedByLower === collectorLower || (activeLoan?.collectorId || (activeLoan as any)?.collector_id)?.toLowerCase() === collectorLower || !!anyHistoricLoan;`;

if (content.includes(targetStrCartera)) {
    content = content.replace(targetStrCartera, repStrCartera);
    console.log("PATCH CARTERA EXCEL DATA DONE");
}

fs.writeFileSync(file, content);
console.log("Guardado.");
