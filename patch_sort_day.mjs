import { readFileSync, writeFileSync } from 'fs';

const filePath = './components/Clients.tsx';
let content = readFileSync(filePath, 'utf8');

const oldSort = `    // Merge and sort by date (most recent first)\r
    // Tiebreaker: cuando tienen la misma fecha, el CREDITO va DESPUES del pago de liquidacion\r
    return [...logs, ...loanGrants]\r
      .sort((a, b) => {\r
        const diff = new Date(b.date).getTime() - new Date(a.date).getTime();\r
        if (diff !== 0) return diff;\r
        // Mismo timestamp: CREDITO va ARRIBA (es mas reciente que el pago de liquidacion)\r
        if (a.itemType === 'loan' && b.itemType !== 'loan') return -1;\r
        if (b.itemType === 'loan' && a.itemType !== 'loan') return 1;\r
        return 0;\r
      });`;

const newSort = `    // Merge and sort: primero por DIA (YYYY-MM-DD), luego CREDITO antes que pagos del mismo dia\r
    return [...logs, ...loanGrants]\r
      .sort((a, b) => {\r
        const dayA = (a.date || '').split('T')[0];\r
        const dayB = (b.date || '').split('T')[0];\r
        if (dayB > dayA) return 1;\r
        if (dayA > dayB) return -1;\r
        // Mismo dia: CREDITO (nuevo prestamo) aparece ARRIBA, luego pagos/renovaciones\r
        if (a.itemType === 'loan' && b.itemType !== 'loan') return -1;\r
        if (b.itemType === 'loan' && a.itemType !== 'loan') return 1;\r
        // Mismo tipo: ordenar por timestamp exacto descendente\r
        return new Date(b.date).getTime() - new Date(a.date).getTime();\r
      });`;

if (content.includes(oldSort)) {
  content = content.replace(oldSort, newSort);
  writeFileSync(filePath, content, 'utf8');
  console.log('Sort fixed: now compares by DATE only, loans appear above same-day payments');
} else {
  console.log('ERROR: string not found — checking...');
  // debug
  const idx = content.indexOf('Merge and sort');
  console.log('Found at char:', idx);
  if (idx > -1) {
    console.log(content.substring(idx, idx+500));
  }
}
