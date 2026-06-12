const fs = require('fs');
let c = fs.readFileSync('utils/auditReportGenerator.ts', 'utf8');

c = c.replace(
    'analysisText = "EXCELENTE: Aumento en base de clientes y recaudación. Gestión efectiva y crecimiento saludable.";',
    'analysisText = t?.analysis?.excellent || "EXCELENTE: Aumento en base de clientes y recaudación. Gestión efectiva y crecimiento saludable.";'
);
c = c.replace(
    'analysisText = "ALERTA: Más clientes pero menos recaudación. Posible deterioro de cartera o créditos nuevos sin pago.";',
    'analysisText = t?.analysis?.alert || "ALERTA: Más clientes pero menos recaudación. Posible deterioro de cartera o créditos nuevos sin pago.";'
);
c = c.replace(
    'analysisText = "ESTABLE: Recaudación sube sin nuevos clientes. Buena recuperación, pero baja expansión.";',
    'analysisText = t?.analysis?.stable || "ESTABLE: Recaudación sube sin nuevos clientes. Buena recuperación, pero baja expansión.";'
);
c = c.replace(
    'analysisText = "CRÍTICO: Caída en clientes y recaudación. Requiere intervención inmediata.";',
    'analysisText = t?.analysis?.critical || "CRÍTICO: Caída en clientes y recaudación. Requiere intervención inmediata.";'
);

c = c.replace('doc.text("CLIENTE", 22, nextY + 5);', 'doc.text(t?.unpaid?.client || "CLIENTE", 22, nextY + 5);');
c = c.replace('doc.text("ÚLTOMB PAGO", 85, nextY + 5);', 'doc.text(t?.unpaid?.lastPayment || "ÚLTOMB PAGO", 85, nextY + 5);');
c = c.replace('doc.text("MORA", 125, nextY + 5);', 'doc.text(t?.unpaid?.overdue || "MORA", 125, nextY + 5);');
c = c.replace('doc.text("SALDO DEUDA", 160, nextY + 5);', 'doc.text(t?.unpaid?.debt || "SALDO DEUDA", 160, nextY + 5);');

fs.writeFileSync('utils/auditReportGenerator.ts', c, 'utf8');
console.log('PATCHED EVERYTHING PROPERLY');
