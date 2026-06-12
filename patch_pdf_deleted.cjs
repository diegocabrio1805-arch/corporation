const fs = require('fs');
let c = fs.readFileSync('utils/auditReportGenerator.ts', 'utf8');

c = c.replace(
    /doc\.text\(t\?\.table\?\.date \|\| "FECHA ELIM\.", 22, nextY \+ 5\);\n\s*doc\.text\(t\?\.table\?\.client \|\| "CLIENTE", 55, nextY \+ 5\);\n\s*doc\.text\(t\?\.table\?\.deletedBy \|\| "ELIMINADO POR", 110, nextY \+ 5\);\n\s*doc\.text\(t\?\.table\?\.original \|\| "COBRADOR ORIG\.", 145, nextY \+ 5\);\n\s*doc\.text\(t\?\.table\?\.amount \|\| "MONTO", 185, nextY \+ 5, \{ align: 'right' \}\);/g,
    'doc.text(t?.table?.date || "FECHA ELIM.", 22, nextY + 5);\n    doc.text(t?.table?.type || "TIPO", 45, nextY + 5);\n    doc.text(t?.table?.client || "CLIENTE", 70, nextY + 5);\n    doc.text(t?.table?.deletedBy || "ELIMINADO POR", 120, nextY + 5);\n    doc.text(t?.table?.original || "COBRADOR ORIG.", 155, nextY + 5);\n    doc.text(t?.table?.amount || "MONTO", 190, nextY + 5, { align: \'right\' });'
);

c = c.replace(
    /doc\.text\(elimDate, 22, nextY \+ 5\);\n\s*doc\.text\(clientName, 55, nextY \+ 5\);\n\s*doc\.text\(adminName, 110, nextY \+ 5\);\n\s*doc\.text\(collName, 145, nextY \+ 5\);\n\s*doc\.text\(formatCurrency\(log\.amount \|\| 0, settings\), 185, nextY \+ 5, \{ align: 'right' \}\);/g,
    'doc.text(elimDate, 22, nextY + 5);\n            const dtText = deletedType === \'CREDITO_ELIMINADO\' ? (lang === \'fr\' ? \'Crédit\' : \'Crédito\') : deletedType === \'CLIENTE_ELIMINADO\' ? (lang === \'fr\' ? \'Client\' : \'Cliente\') : (lang === \'fr\' ? \'Paiement\' : \'Abono\');\n            doc.text(dtText, 45, nextY + 5);\n            doc.text(clientName, 70, nextY + 5);\n            doc.text(adminName, 120, nextY + 5);\n            doc.text(collName, 155, nextY + 5);\n            doc.text(formatCurrency(log.amount || 0, settings), 190, nextY + 5, { align: \'right\' });'
);

fs.writeFileSync('utils/auditReportGenerator.ts', c, 'utf8');
console.log('Patched PDF table in auditReportGenerator.ts');
