const fs = require('fs');
let c = fs.readFileSync('utils/auditReportGenerator.ts', 'utf8');

// Ensure translation import exists
if (!c.includes('import { getTranslation }')) {
  c = c.replace(
    "import { jsPDF } from 'jspdf';",
    "import { jsPDF } from 'jspdf';\nimport { getTranslation } from './translations';"
  );
}

// 1. Add t
c = c.replace(
  /} = data as any;/,
  "} = data as any;\n    const t = (getTranslation(settings?.language || 'es') as any).dashboard?.auditPDF;"
);

// 2. HEADER
c = c.replace(
  /doc\.text\('REPORTE AUDITOR GENERAL', 105, 20, { align: 'center' }\);/,
  "doc.text(t?.title || 'REPORTE AUDITOR GENERAL', 105, 20, { align: 'center' });"
);

// 3. COLLECTOR INFO
c = c.replace(
  /doc\.text\(`COBRADOR: \$\{collectorName\.toUpperCase\(\)\}`, 20, 55\);/,
  "doc.text(`${t?.collector || 'COBRADOR:'} ${collectorName.toUpperCase()}`, 20, 55);"
);
c = c.replace(
  /doc\.text\(`PERIODO AUDITADO: \$\{startDate\} al \$\{endDate\}\`, 20, 62\);/,
  "doc.text(`${t?.period || 'PERIODO AUDITADO:'} ${startDate} al ${endDate}`, 20, 62);"
);
c = c.replace(
  /doc\.text\(`FECHA REPORTE: \$\{dateStr\}\`, 20, 67\);/,
  "doc.text(`${t?.date || 'FECHA REPORTE:'} ${dateStr}`, 20, 67);"
);

// 4. VERDICT
c = c.replace(
  /doc\.text\(verdict, boxX \+ \(boxWidth \/ 2\), 59, { align: 'center' }\);/,
  "doc.text(t?.verdictText?.[verdict] || verdict, boxX + (boxWidth / 2), 59, { align: 'center' });"
);
c = c.replace(
  /doc\.text\("VEREDICTO", boxX \+ \(boxWidth \/ 2\), 63, { align: 'center' }\);/,
  "doc.text(t?.verdict || 'VEREDICTO', boxX + (boxWidth / 2), 63, { align: 'center' });"
);

// 5. KPIs
c = c.replace(
  /drawKPI\("RECAUDO TOTAL", formatCurrency\(totalRevenue, settings\), 20\);/,
  "drawKPI(t?.kpi?.revenue || 'RECAUDO TOTAL', formatCurrency(totalRevenue, settings), 20);"
);
c = c.replace(
  /drawKPI\("CARTERA TOTAL", \(totalClients \|\| 0\)\.toString\(\), 65\);/,
  "drawKPI(t?.kpi?.portfolio || 'CARTERA TOTAL', (totalClients || 0).toString(), 65);"
);
c = c.replace(
  /drawKPI\("PAGARON", activeClients\.toString\(\), 105\);/,
  "drawKPI(t?.kpi?.paid || 'PAGARON', activeClients.toString(), 105);"
);
c = c.replace(
  /drawKPI\("NUEVOS", `\+\$\{newClients\}`, 135\);/,
  "drawKPI(t?.kpi?.new || 'NUEVOS', `+${newClients}`, 135);"
);
c = c.replace(
  /drawKPI\("COBERTURA", `\$\{coverage\}%`, 165\);/,
  "drawKPI(t?.kpi?.coverage || 'COBERTURA', `${coverage}%`, 165);"
);

// 6. ANALYSIS
c = c.replace(
  /doc\.text\("ANÁLISIS DE RENDIMIENTO", 20, 110\);/,
  "doc.text(t?.analysis?.title || 'ANÁLISIS DE RENDIMIENTO', 20, 110);"
);

const oldFeedback = `let analysisText = "";
    if (data.clientsIncreased && data.revenueIncreased) {
        analysisText = "EXCELENTE: Aumento en base de clientes y recaudación. Gestión efectiva y crecimiento saludable.";
    } else if (data.clientsIncreased && !data.revenueIncreased) {
        analysisText = "ALERTA: Más clientes pero menos recaudación. Posible deterioro de cartera o créditos nuevos sin pago.";
    } else if (!data.clientsIncreased && data.revenueIncreased) {
        analysisText = "ESTABLE: Recaudación sube sin nuevos clientes. Buena recuperación, pero baja expansión.";
    } else {
        analysisText = "CRÍTICO: Caída en clientes y recaudación. Requiere intervención inmediata.";
    }`;

const newFeedback = `let analysisText = "";
    if (data.clientsIncreased && data.revenueIncreased) {
        analysisText = t?.analysis?.excellent || "EXCELENTE: Aumento en base de clientes y recaudación. Gestión efectiva y crecimiento saludable.";
    } else if (data.clientsIncreased && !data.revenueIncreased) {
        analysisText = t?.analysis?.alert || "ALERTA: Más clientes pero menos recaudación. Posible deterioro de cartera o créditos nuevos sin pago.";
    } else if (!data.clientsIncreased && data.revenueIncreased) {
        analysisText = t?.analysis?.stable || "ESTABLE: Recaudación sube sin nuevos clientes. Buena recuperación, pero baja expansión.";
    } else {
        analysisText = t?.analysis?.critical || "CRÍTICO: Caída en clientes y recaudación. Requiere intervención inmediata.";
    }`;
c = c.replace(oldFeedback, newFeedback);

// 7. CHART HEADERS
c = c.replace(
  /doc\.text\("PERIODO", 30, startY \+ 8\);\s*doc\.text\("RECAUDO", 100, startY \+ 8\);\s*doc\.text\("TENDENCIA", 150, startY \+ 8\);/,
  `doc.text(t?.charts?.period || 'PERIODO', 30, startY + 8);
        doc.text(t?.charts?.revenue || 'RECAUDO', 100, startY + 8);
        doc.text(t?.charts?.trend || 'TENDENCIA', 150, startY + 8);`
);

// 8. CHART TITLES
c = c.replace(
  /let nextY = drawBarChart\("EVOLUCIÓN DIARIA \(LUNES - SÁBADO\)", dailyItems, 135\);/,
  "let nextY = drawBarChart(t?.charts?.daily || 'EVOLUCIÓN DIARIA', dailyItems, 135);"
);
c = c.replace(
  /nextY = drawBarChart\("EVOLUCIÓN SEMANAL \(PERIODO SELECCIONADO\)", weeklyRevenue, nextY\);/,
  "nextY = drawBarChart(t?.charts?.weekly || 'EVOLUCIÓN SEMANAL', weeklyRevenue, nextY);"
);
c = c.replace(
  /nextY = drawBarChart\(`HISTÓRICO MENSUAL \(\$\{new Date\(\)\.getFullYear\(\)\}\)`, monthlyRevenue, nextY\);/,
  "nextY = drawBarChart(`${t?.charts?.monthly || 'HISTÓRICO MENSUAL'} (${new Date().getFullYear()})`, monthlyRevenue, nextY);"
);

// 9. CLIENTES SIN PAGO
c = c.replace(
  /doc\.text\(`CLIENTES SIN PAGO \(\$\{clientsWithoutPayment\?\.length \|\| 0\}\)`, 20, nextY\);/,
  "doc.text(`${t?.unpaid?.title || 'CLIENTES SIN PAGO'} (${clientsWithoutPayment?.length || 0})`, 20, nextY);"
);
c = c.replace(
  /doc\.text\("Listado de clientes activos asignados que no registraron pagos en este periodo\.", 20, nextY \+ 5\);/,
  "doc.text(t?.unpaid?.desc || 'Listado de clientes activos...', 20, nextY + 5);"
);
c = c.replace(
  /doc\.text\("CLIENTE", 22, nextY \+ 5\);\s*doc\.text\("ÚLT\. PAGO", 85, nextY \+ 5\);\s*doc\.text\("MORA", 125, nextY \+ 5\);\s*doc\.text\("SALDO DEUDA", 160, nextY \+ 5\);/,
  `doc.text(t?.unpaid?.client || 'CLIENTE', 22, nextY + 5);
    doc.text(t?.unpaid?.lastPayment || 'ÚLT. PAGO', 85, nextY + 5);
    doc.text(t?.unpaid?.overdue || 'MORA', 125, nextY + 5);
    doc.text(t?.unpaid?.debt || 'SALDO DEUDA', 160, nextY + 5);`
);

// 10. CLIENTE CONT
c = c.replace(
  /doc\.text\("CLIENTE \(Cont\.\)", 22, nextY \+ 5\);\s*doc\.text\("ÚLT\. PAGO", 85, nextY \+ 5\);\s*doc\.text\("MORA", 125, nextY \+ 5\);\s*doc\.text\("SALDO DEUDA", 160, nextY \+ 5\);/,
  `doc.text((t?.unpaid?.client || 'CLIENTE') + " (Cont.)", 22, nextY + 5);
                doc.text(t?.unpaid?.lastPayment || 'ÚLT. PAGO', 85, nextY + 5);
                doc.text(t?.unpaid?.overdue || 'MORA', 125, nextY + 5);
                doc.text(t?.unpaid?.debt || 'SALDO DEUDA', 160, nextY + 5);`
);

// 11. FELICITACIONES
c = c.replace(
  /doc\.text\("¡Felicitaciones! Todos los clientes activos han realizado al menos un pago en este rango de tiempo\.", 25, nextY\);/,
  "doc.text(t?.unpaid?.congrats || '¡Felicitaciones!', 25, nextY);"
);

// 12. NUNCA Y DIAS
c = c.replace(
  /doc\.text\("NUNCA", 85, nextY \+ 1\.5\);/,
  "doc.text(t?.unpaid?.never || 'NUNCA', 85, nextY + 1.5);"
);
c = c.replace(
  /doc\.text\(`\$\{client\.daysOverdue\} días`, 125, nextY \+ 1\.5\);/,
  "doc.text(`${client.daysOverdue} ${t?.unpaid?.days || 'días'}`, 125, nextY + 1.5);"
);

// 13. TOTAL DEUDA
c = c.replace(
  /doc\.text\("TOTAL CARTERA EN MORA \(ESTE PERIODO\):", 80, nextY\);/,
  "doc.text(t?.unpaid?.totalDebt || 'TOTAL CARTERA EN MORA:', 80, nextY);"
);

// 14. FOOTER
c = c.replace(
  /doc\.text\("Reporte Interno - Anexo Cobro", 105, 285, { align: 'center' }\);\s*doc\.text\(`Página \$\{i\} de \$\{pageCount\}`, 190, 285, { align: 'right' }\);/g,
  `doc.text(t?.footer || "Reporte Interno - Anexo Cobro", 105, 285, { align: 'center' });
        doc.text(\`\${t?.page || 'Página'} \${i} / \${pageCount}\`, 190, 285, { align: 'right' });`
);

// -------------------------------------
// DELETED PAYMENTS PDF
// -------------------------------------
c = c.replace(
  /export const generateDeletedPaymentsPDF = \(data: any\) => {/,
  "export const generateDeletedPaymentsPDF = (data: any) => {\n    const t = (getTranslation(data.settings?.language || 'es') as any).dashboard?.deleted;"
);

c = c.replace(
  /doc\.text\('AUDITORÍA DE PAGOS ELIMINADOS', 105, 20, { align: 'center' }\);/,
  "doc.text(t?.title || 'AUDITORÍA DE PAGOS ELIMINADOS', 105, 20, { align: 'center' });"
);

c = c.replace(
  /doc\.text\(`COBRADOR FILTRADO: \$\{collectorName\.toUpperCase\(\)\}`, 20, 55\);/,
  "doc.text(`${t?.collector || 'COBRADOR:'} ${collectorName.toUpperCase()}`, 20, 55);"
);

c = c.replace(
  /doc\.text\(`PERIODO DE ELIMINACIÓN: \$\{startDate\} al \$\{endDate\}\`, 20, 62\);/,
  "doc.text(`${t?.period || 'PERIODO:'} ${startDate} al ${endDate}`, 20, 62);"
);

c = c.replace(
  /doc\.text\(`FECHA DE REPORTE: \$\{dateStr\}\`, 20, 67\);/,
  "doc.text(`${t?.date || 'FECHA:'} ${dateStr}`, 20, 67);"
);

// Table headers
c = c.replace(
  /doc\.text\("FECHA ELIM\.", 22, nextY \+ 5\);\s*doc\.text\("CLIENTE", 55, nextY \+ 5\);\s*doc\.text\("ELIMINADO POR", 110, nextY \+ 5\);\s*doc\.text\("COBRADOR ORIG\.", 145, nextY \+ 5\);\s*doc\.text\("MONTO", 185, nextY \+ 5, { align: 'right' }\);/g,
  `doc.text(t?.table?.date || "FECHA ELIM.", 22, nextY + 5);
    doc.text(t?.table?.client || "CLIENTE", 55, nextY + 5);
    doc.text(t?.table?.deletedBy || "ELIMINADO POR", 110, nextY + 5);
    doc.text(t?.table?.original || "COBRADOR ORIG.", 145, nextY + 5);
    doc.text(t?.table?.amount || "MONTO", 185, nextY + 5, { align: 'right' });`
);

// Empty
c = c.replace(
  /doc\.text\("NO SE ENCONTRARON PAGOS ELIMINADOS EN ESTE PERIODO\.", 105, nextY, { align: 'center' }\);/,
  "doc.text(t?.empty || 'NO SE ENCONTRARON PAGOS ELIMINADOS EN ESTE PERIODO.', 105, nextY, { align: 'center' });"
);

// Admin name patch
c = c.replace(
  /const elimDate = new Date\(log\.date\)\.toLocaleString\(\[\], { dateStyle: 'short', timeStyle: 'short' }\);\s*const clientName = clients\?\.find\(\(c: any\) => c\.id === log\.clientId\)\?\.name \|\| 'Desconocido';\s*const adminName = users\?\.find\(\(u: any\) => u\.id === log\.recordedBy\)\?\.name \|\| 'Admin';\s*const collName = users\?\.find\(\(u: any\) => u\.id === log\.collectorId\)\?\.name \|\| 'Desconocido';/,
  `const elimDate = new Date(log.date).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' });
            const lang = settings?.language || 'es';
            const unknownText = lang === 'fr' ? 'Inconnu' : lang === 'en' ? 'Unknown' : lang === 'pt' ? 'Desconhecido' : 'Desconocido';
            const getTranslatedAdmin = (name: string) => {
                const lower = name.toLowerCase();
                if (lower === 'administrador' || lower === 'admin') {
                    return lang === 'fr' ? 'Administrateur' : lang === 'en' ? 'Administrator' : 'Administrador';
                }
                return name;
            };
            const clientName = clients?.find((c: any) => c.id === log.clientId)?.name || unknownText;
            const adminName = getTranslatedAdmin(users?.find((u: any) => u.id === log.recordedBy)?.name || 'Administrador');
            const collName = users?.find((u: any) => u.id === log.collectorId)?.name || unknownText;`
);

// Total
c = c.replace(
  /doc\.text\("TOTAL DINERO ANULADO:", 110, nextY\);/,
  "doc.text(t?.total || 'TOTAL DINERO ANULADO:', 110, nextY);"
);

// Footer
c = c.replace(
  /doc\.text\("Auditoría Interna de Seguridad - Anexo Cobro", 105, 285, { align: 'center' }\);\s*doc\.text\(`Página \$\{i\} de \$\{pageCount\}`, 190, 285, { align: 'right' }\);/g,
  `doc.text(t?.footer || "Auditoría Interna de Seguridad - Anexo Cobro", 105, 285, { align: 'center' });
        doc.text(\`\${t?.page || 'Página'} \${i} / \${pageCount}\`, 190, 285, { align: 'right' });`
);

fs.writeFileSync('utils/auditReportGenerator.ts', c, 'utf8');
console.log('PATCH COMPLETO APLICADO!');
