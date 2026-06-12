const fs = require('fs');

// Update Clients.tsx
let clientsContent = fs.readFileSync('components/Clients.tsx', 'utf8');
if (!clientsContent.includes("t.confirmations?.deletePaymentDefinitive")) {
  clientsContent = clientsContent.replace(
    /confirm\('¿BORRAR ESTE PAGO DEFINITIVAMENTE\? SE REVERTIRÁN LOS SALDOS\.'\)/g,
    'confirm(t.confirmations?.deletePaymentDefinitive || "¿BORRAR ESTE PAGO DEFINITIVAMENTE? SE REVERTIRÁN LOS SALDOS.")'
  );
  fs.writeFileSync('components/Clients.tsx', clientsContent, 'utf8');
}

// Update Loans.tsx
let loansContent = fs.readFileSync('components/Loans.tsx', 'utf8');
if (!loansContent.includes("t.confirmations?.deletePaymentDefinitive")) {
  loansContent = loansContent.replace(
    /confirm\('¿BORRAR ESTE PAGO\?'\)/g,
    'confirm(t.confirmations?.deletePaymentDefinitive || "¿BORRAR ESTE PAGO DEFINITIVAMENTE? SE REVERTIRÁN LOS SALDOS.")'
  );
  fs.writeFileSync('components/Loans.tsx', loansContent, 'utf8');
}

console.log('Confirmation texts updated in all files.');
