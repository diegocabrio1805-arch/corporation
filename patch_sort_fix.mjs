import { readFileSync, writeFileSync } from 'fs';

const filePath = './components/Clients.tsx';
let content = readFileSync(filePath, 'utf8');

// Fix the tiebreaker logic — loans (CRÉDITO) should appear ABOVE payments (RENOVACIÓN)
// when they share the same date, because the new loan is created AFTER the payment
const oldTiebreaker = `        // Mismo timestamp: pago (log) antes que credito (loan)\r
        if (a.itemType === 'loan' && b.itemType !== 'loan') return 1;\r
        if (b.itemType === 'loan' && a.itemType !== 'loan') return -1;`;

const newTiebreaker = `        // Mismo timestamp: CREDITO va ARRIBA (es mas reciente que el pago de liquidacion)\r
        if (a.itemType === 'loan' && b.itemType !== 'loan') return -1;\r
        if (b.itemType === 'loan' && a.itemType !== 'loan') return 1;`;

if (content.includes(oldTiebreaker)) {
  content = content.replace(oldTiebreaker, newTiebreaker);
  writeFileSync(filePath, content, 'utf8');
  console.log('Tiebreaker fixed: CREDITO now appears ABOVE RENOVACION');
} else {
  console.log('ERROR: string not found');
}
