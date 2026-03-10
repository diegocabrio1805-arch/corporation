const fs = require('fs');

const file = 'c:/Users/DANIEL/Desktop/cobros/components/Clients.tsx';
let content = fs.readFileSync(file, 'utf8');

// STRATEGY: Reemplazar bloque por bloque buscando coincidencias más pequeñas
let c1 = content.split('// de que tiene un préstamo activo con él. Esto evita ocultarlos si ya pagaron.');
if (c1.length > 1) {
    let p2 = c1[1].split('});\n    }\n    // SAFE SORT (NaN PROOF)');

    const newBlock1 = `
        const activeLoan = (Array.isArray(state.loans) ? state.loans : []).find(l => (l.clientId || (l as any).client_id) === c.id && (l.status === LoanStatus.ACTIVE || l.status === LoanStatus.DEFAULT));
        const anyHistoricLoan = (Array.isArray(state.loans) ? state.loans : []).find(l => (l.clientId || (l as any).client_id) === c.id && (l.collectorId || (l as any).collector_id)?.toLowerCase() === collectorLower);
        const addedByLower = (c.addedBy || (c as any).added_by || '').toLowerCase();

        return addedByLower === collectorLower || (activeLoan?.collectorId || (activeLoan as any)?.collector_id)?.toLowerCase() === collectorLower || !!anyHistoricLoan;
      `;

    if (p2.length > 1) {
        content = c1[0] + '// de que tiene un préstamo activo con él. Esto evita ocultarlos si ya pagaron.' + newBlock1 + '});\n    }\n    // SAFE SORT (NaN PROOF)' + p2[1];
        console.log("PACTH 1 APLICADO");
    }
}

let c2 = content.split('      if (selectedCollector !== \\'all\\') {\n        const collectorLower = selectedCollector.toLowerCase();\n        const activeLoan = (Array.isArray(state.loans) ? state.loans : []).find(l => (l.clientId || (l as any).client_id) === c.id && (l.status === LoanStatus.ACTIVE || l.status === LoanStatus.DEFAULT));\n        const addedByLower = (c.addedBy || (c as any).added_by || \\'\\').toLowerCase();\n        return addedByLower === collectorLower || (activeLoan?.collectorId || (activeLoan as any)?.collector_id)?.toLowerCase() === collectorLower;\n      }');

if (c2.length > 1) {
    const newBlock2 = `      if (selectedCollector !== 'all') {
        const collectorLower = selectedCollector.toLowerCase();
        const activeLoan = (Array.isArray(state.loans) ? state.loans : []).find(l => (l.clientId || (l as any).client_id) === c.id && (l.status === LoanStatus.ACTIVE || l.status === LoanStatus.DEFAULT));
        const anyHistoricLoan = (Array.isArray(state.loans) ? state.loans : []).find(l => (l.clientId || (l as any).client_id) === c.id && (l.collectorId || (l as any).collector_id)?.toLowerCase() === collectorLower);
        const addedByLower = (c.addedBy || (c as any).added_by || '').toLowerCase();
        return addedByLower === collectorLower || (activeLoan?.collectorId || (activeLoan as any)?.collector_id)?.toLowerCase() === collectorLower || !!anyHistoricLoan;
      }`;
    content = c2.join(newBlock2);
    console.log("PATCH 2 APLICADO");
}

fs.writeFileSync(file, content);
console.log("ARCHIVOS GUARDADOS.");
