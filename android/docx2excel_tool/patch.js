const fs = require('fs');

const file = 'c:/Users/DANIEL/Desktop/cobros/components/Clients.tsx';
let content = fs.readFileSync(file, 'utf8');

const targetStr = `      if (selectedCollector !== 'all') {
        const collectorLower = selectedCollector.toLowerCase();
        const activeLoan = (Array.isArray(state.loans) ? state.loans : []).find(l => (l.clientId || (l as any).client_id) === c.id && (l.status === LoanStatus.ACTIVE || l.status === LoanStatus.DEFAULT));
        return (activeLoan?.collectorId || (activeLoan as any)?.collector_id)?.toLowerCase() === collectorLower || (c.addedBy || (c as any).added_by)?.toLowerCase() === collectorLower;
      }`;

const repStr = `      if (selectedCollector !== 'all') {
        const collectorLower = selectedCollector.toLowerCase();
        const activeLoan = (Array.isArray(state.loans) ? state.loans : []).find(l => (l.clientId || (l as any).client_id) === c.id && (l.status === LoanStatus.ACTIVE || l.status === LoanStatus.DEFAULT));
        const addedByLower = (c.addedBy || (c as any).added_by || '').toLowerCase();
        return addedByLower === collectorLower || (activeLoan?.collectorId || (activeLoan as any)?.collector_id)?.toLowerCase() === collectorLower;
      }`;

if (content.includes(targetStr)) {
    content = content.replace(targetStr, repStr);
    fs.writeFileSync(file, content);
    console.log("PARCHADO CON EXITO.");
} else {
    console.log("NO SE ENCONTRO LA CADENA EXACTA.");
}
