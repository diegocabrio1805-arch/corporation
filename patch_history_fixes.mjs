import { readFileSync, writeFileSync } from 'fs';

const filePath = './components/Clients.tsx';
let content = readFileSync(filePath, 'utf8');
const lines = content.split('\n');

// ─── FIX 1: Orden del historial — cuando tienen la misma fecha, CRÉDITO debe ir DESPUÉS del pago ───
// Line 695-696 (0-indexed 694-695):
//   return [...logs, ...loanGrants]
//     .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
// Replace with tiebreaker: if same timestamp, logs (payments) come before loans (credits)

const oldSort = `    // Merge and sort by date (most recent first)\r
    return [...logs, ...loanGrants]\r
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());\r`;

const newSort = `    // Merge and sort by date (most recent first)\r
    // Tiebreaker: cuando tienen la misma fecha, el CREDITO va DESPUES del pago de liquidacion\r
    return [...logs, ...loanGrants]\r
      .sort((a, b) => {\r
        const diff = new Date(b.date).getTime() - new Date(a.date).getTime();\r
        if (diff !== 0) return diff;\r
        // Mismo timestamp: pago (log) antes que credito (loan)\r
        if (a.itemType === 'loan' && b.itemType !== 'loan') return 1;\r
        if (b.itemType === 'loan' && a.itemType !== 'loan') return -1;\r
        return 0;\r
      });\r`;

if (content.includes(oldSort)) {
  content = content.replace(oldSort, newSort);
  console.log('FIX 1 applied: history sort tiebreaker');
} else {
  console.log('FIX 1 FAILED: old sort string not found');
}

// ─── FIX 2: Detección del pago de renovación ─────────────────────────────────────────────────────
// The search in handleRenewLoan only looks in previousLoanIds, but we should also search
// by clientId for any recent renewal payment log
const oldSearch = `        // Detectar si el ultimo movimiento del credito anterior fue RENOVACION\r
        const allPrevLogs = (Array.isArray(state.collectionLogs) ? state.collectionLogs : [])\r
          .filter((l) => previousLoanIds.includes(l.loanId) && l.type === CollectionLogType.PAYMENT && !l.deletedAt && !l.isOpening)\r
          .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());\r
        const lastRenewLog = allPrevLogs[0];\r
        const lastLogIsRenewal = lastRenewLog?.isRenewal === true;`;

const newSearch = `        // Detectar si el ultimo movimiento del credito anterior fue RENOVACION\r
        // Buscar por previousLoanIds O por clientId para mayor robustez\r
        const clientLogs = (Array.isArray(state.collectionLogs) ? state.collectionLogs : [])\r
          .filter((l) => {\r
            if (l.deletedAt || l.isOpening) return false;\r
            if (l.type !== CollectionLogType.PAYMENT) return false;\r
            // Buscar en los prestamos previos O cualquier log del cliente\r
            return previousLoanIds.includes(l.loanId) || l.clientId === clientInLegajo.id;\r
          })\r
          .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());\r
        const lastRenewLog = clientLogs[0];\r
        const lastLogIsRenewal = lastRenewLog?.isRenewal === true;`;

if (content.includes(oldSearch)) {
  content = content.replace(oldSearch, newSearch);
  console.log('FIX 2 applied: renewal detection now also searches by clientId');
} else {
  console.log('FIX 2 FAILED: old search string not found');
}

writeFileSync(filePath, content, 'utf8');
console.log('All fixes written to Clients.tsx');
