const fs = require('fs');
const file = 'c:/Users/DANIEL/Desktop/cobros/components/Clients.tsx';
let content = fs.readFileSync(file, 'utf8');

// 1. Filtrado de UI (paginatedClients / filteredClients)
const regexUI = /const activeLoan = \(Array\.isArray\(state\.loans\) \? state\.loans : \[\]\)\.find\(l => \(l\.clientId \|\| \(l as any\)\.client_id\) === c\.id && \(l\.status === LoanStatus\.ACTIVE \|\| l\.status === LoanStatus\.DEFAULT\)\);\s*const addedByLower = \(c\.addedBy \|\| \(c as any\)\.added_by \|\| ''\)\.toLowerCase\(\);\s*return addedByLower === collectorLower \|\| \(activeLoan\?\.collectorId \|\| \(activeLoan as any\)\?\.collector_id\)\?\.toLowerCase\(\) === collectorLower;/g;

const repUI = `const activeLoan = (Array.isArray(state.loans) ? state.loans : []).find(l => (l.clientId || (l as any).client_id) === c.id && (l.status === LoanStatus.ACTIVE || l.status === LoanStatus.DEFAULT));
        const anyHistoricLoan = (Array.isArray(state.loans) ? state.loans : []).find(l => (l.clientId || (l as any).client_id) === c.id && (l.collectorId || (l as any).collector_id)?.toLowerCase() === collectorLower);
        const addedByLower = (c.addedBy || (c as any).added_by || '').toLowerCase();
        return addedByLower === collectorLower || (activeLoan?.collectorId || (activeLoan as any)?.collector_id)?.toLowerCase() === collectorLower || !!anyHistoricLoan;`;

if (regexUI.test(content)) {
    content = content.replace(regexUI, repUI);
    console.log("PACTH regexUI APLICADO");
}

fs.writeFileSync(file, content);
console.log("GUARDADO OK.");
