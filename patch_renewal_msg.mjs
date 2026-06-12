import { readFileSync, writeFileSync } from 'fs';

const filePath = './components/Clients.tsx';
let content = readFileSync(filePath, 'utf8');
const lines = content.split('\n');

// Lines to replace (0-indexed: 1938 to 1942, i.e. lines 1939-1943 in 1-indexed)
const startIdx = 1938;
const deleteCount = 5;

const newLines = [
  `        const companyName = (state.settings.companyAlias || state.settings.companyName || 'LA EMPRESA').toUpperCase();\r`,
  `        const contactPhone = state.settings.contactPhone ? \` \${state.settings.contactPhone}\` : '';\r`,
  `        const currSym = state.settings.currencySymbol || '$';\r`,
  `\r`,
  `        // Detectar si el ultimo movimiento del credito anterior fue RENOVACION\r`,
  `        const allPrevLogs = (Array.isArray(state.collectionLogs) ? state.collectionLogs : [])\r`,
  `          .filter((l) => previousLoanIds.includes(l.loanId) && l.type === CollectionLogType.PAYMENT && !l.deletedAt && !l.isOpening)\r`,
  `          .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());\r`,
  `        const lastRenewLog = allPrevLogs[0];\r`,
  `        const lastLogIsRenewal = lastRenewLog?.isRenewal === true;\r`,
  `        const renewalDeduction = lastLogIsRenewal ? (lastRenewLog.amount || 0) : 0;\r`,
  `        const efectivoEntregado = Math.max(0, p - renewalDeduction);\r`,
  `        const fmtPrincipal = formatRawNumber(p, state.settings);\r`,
  `        const fmtDeduccion = formatRawNumber(renewalDeduction, state.settings);\r`,
  `        const fmtEfectivo = formatRawNumber(efectivoEntregado, state.settings);\r`,
  `        let msgText;\r`,
  `        if (lastLogIsRenewal && renewalDeduction > 0) {\r`,
  `          msgText = \`MENSAJE DE CONFIRMACION DE ENTREGA DE CREDITO CLIENTE: \${clientInLegajo.name.toUpperCase()} CONFIRMACION DE RENOVACION DE CREDITO \${currSym}\${fmtPrincipal} - \${currSym}\${fmtDeduccion} SALDO TOTAL EFECTIVO ENTREGADO \${currSym}\${fmtEfectivo} A \${inst} CUOTAS CUALQUIER CONSULTA O DUDA DE SU MONTO COMUNICARSE CON \${companyName}\${contactPhone}\`;\r`,
  `        } else {\r`,
  `          msgText = \`MENSAJE DE CONFIRMACION DE ENTREGA DE CREDITO CLIENTE: \${clientInLegajo.name.toUpperCase()} CONFIRMACION DE RENOVACION DE CREDITO \${currSym}\${fmtPrincipal} TOTAL EFECTIVO ENTREGADO \${currSym}\${fmtPrincipal} A \${inst} CUOTAS CUALQUIER CONSULTA O DUDA DE SU MONTO COMUNICARSE CON \${companyName}\${contactPhone}\`;\r`,
  `        }\r`,
  `        const waUrl = \`https://wa.me/\${targetPhone}?text=\${encodeURIComponent(msgText)}\`;\r`,
];

lines.splice(startIdx, deleteCount, ...newLines);

writeFileSync(filePath, lines.join('\n'), 'utf8');
console.log('Patch applied successfully! Lines', startIdx+1, 'to', startIdx+deleteCount, 'replaced with', newLines.length, 'new lines.');
