const fs = require('fs');

let c = fs.readFileSync('utils/auditReportGenerator.ts', 'utf8');

// Ensure translation import exists
if (!c.includes('import { getTranslation }')) {
  c = c.replace(
    "import { jsPDF } from 'jspdf';",
    "import { jsPDF } from 'jspdf';\nimport { getTranslation } from './translations';"
  );
}

// ----------------------------------------
// PATCH generateAuditPDF
// ----------------------------------------
// Add the translation object
c = c.replace(
  /} = data as any; \/\/ Cast to any/,
  "} = data as any;\n    const t = (getTranslation(settings?.language || 'es') as any).dashboard?.auditPDF;"
);

// Title
c = c.replace(
  "doc.text('REPORTE AUDITOR GENERAL', 105, 20, { align: 'center' });",
  "doc.text(t?.title || 'REPORTE AUDITOR GENERAL', 105, 20, { align: 'center' });"
);

// Header Info
c = c.replace(
  "doc.text(`COBRADOR: ${collectorName.toUpperCase()}`, 20, 55);",
  "doc.text(`${t?.collector || 'COBRADOR:'} ${collectorName.toUpperCase()}`, 20, 55);"
);
c = c.replace(
  "doc.text(`PERIODO AUDITADO: ${startDate} al ${endDate}`, 20, 62);",
  "doc.text(`${t?.period || 'PERIODO AUDITADO:'} ${startDate} al ${endDate}`, 20, 62);"
);
c = c.replace(
  "doc.text(`FECHA REPORTE: ${dateStr}`, 20, 67);",
  "doc.text(`${t?.date || 'FECHA REPORTE:'} ${dateStr}`, 20, 67);"
);

// KPIs
c = c.replace(
  /doc\.text\("RECAUDO TOTAL", 20, 85\);\s*doc\.text\("CARTERA TOTAL", 65, 85\);\s*doc\.text\("PAGARON", 115, 85\);\s*doc\.text\("NUEVOS", 150, 85\);\s*doc\.text\("COBERTURA", 180, 85\);/,
  `doc.text(t?.kpi?.totalRevenue || "RECAUDO TOTAL", 20, 85);
    doc.text(t?.kpi?.totalClients || "CARTERA TOTAL", 65, 85);
    doc.text(t?.kpi?.paid || "PAGARON", 115, 85);
    doc.text(t?.kpi?.new || "NUEVOS", 150, 85);
    doc.text(t?.kpi?.coverage || "COBERTURA", 180, 85);`
);

// Verdict Title
c = c.replace(
  /doc\.text\("VEREDICTO", 160, 63, { align: 'center' }\);/,
  "doc.text(t?.verdictTitle || \"VEREDICTO\", 160, 63, { align: 'center' });"
);

// Verdict value translation
c = c.replace(
  "doc.text(verdict, 160, 58, { align: 'center' });",
  "doc.text(t?.verdicts?.[verdict] || verdict, 160, 58, { align: 'center' });"
);

// Analysis Title
c = c.replace(
  "doc.text('ANÁLISIS DE RENDIMIENTO', 20, 115);",
  "doc.text(t?.analysisTitle || 'ANÁLISIS DE RENDIMIENTO', 20, 115);"
);

// Feedback logic
const oldFeedback = `let feedback = "";
    if (verdict === 'EXCELENTE') {
        feedback = revenueIncreased && clientsIncreased 
            ? "EXCELENTE: Crecimiento integral. Ingresos y base de clientes en aumento." 
            : "EXCELENTE: Rendimiento excepcional en recaudación con retención de clientes.";
    } else if (verdict === 'BUENO') {
        feedback = revenueIncreased 
            ? "BUENO: Tendencia positiva en ingresos. Mantener esfuerzo en prospección." 
            : "BUENO: Cobertura sólida. Buscar estrategias para incrementar ticket promedio.";
    } else if (verdict === 'MEDIANAMENTE BUENO') {
         feedback = "ESTABLE: Recaudación sube sin nuevos clientes. Buena recuperación, pero baja expansión.";
    } else if (verdict === 'MEDIANAMENTE MALO') {
         feedback = "ATENCIÓN: Crecimiento con baja recaudación. Riesgo de liquidez, ajustar seguimiento.";
    } else {
        feedback = "ALERTA: Caída generalizada en recaudo y clientes. Requiere intervención inmediata.";
    }

    doc.text(feedback, 20, 122);`;

const newFeedback = `let feedback = t?.feedbacks?.[verdict] || "";
    if (!feedback) {
        if (verdict === 'EXCELENTE') {
            feedback = revenueIncreased && clientsIncreased 
                ? "EXCELENTE: Crecimiento integral. Ingresos y base de clientes en aumento." 
                : "EXCELENTE: Rendimiento excepcional en recaudación con retención de clientes.";
        } else if (verdict === 'BUENO') {
            feedback = revenueIncreased 
                ? "BUENO: Tendencia positiva en ingresos. Mantener esfuerzo en prospección." 
                : "BUENO: Cobertura sólida. Buscar estrategias para incrementar ticket promedio.";
        } else if (verdict === 'MEDIANAMENTE BUENO') {
             feedback = "ESTABLE: Recaudación sube sin nuevos clientes. Buena recuperación, pero baja expansión.";
        } else if (verdict === 'MEDIANAMENTE MALO') {
             feedback = "ATENCIÓN: Crecimiento con baja recaudación. Riesgo de liquidez, ajustar seguimiento.";
        } else {
            feedback = "ALERTA: Caída generalizada en recaudo y clientes. Requiere intervención inmediata.";
        }
    }
    doc.text(feedback, 20, 122);`;

c = c.replace(oldFeedback, newFeedback);

// Table headers
c = c.replace(
  /doc\.text\("PERIODO", 30, currentY \+ 5\);\s*doc\.text\("RECAUDO", 100, currentY \+ 5\);\s*doc\.text\("TENDENCIA", 150, currentY \+ 5\);/g,
  `doc.text(t?.table?.period || "PERIODO", 30, currentY + 5);
        doc.text(t?.table?.revenue || "RECAUDO", 100, currentY + 5);
        doc.text(t?.table?.trend || "TENDENCIA", 150, currentY + 5);`
);

// Chart Titles
c = c.replace(
  /let nextY = drawBarChart\('EVOLUCIÓN DIARIA \(LUNES - SÁBADO\)', dailyItems, 135\);/,
  "let nextY = drawBarChart(t?.charts?.daily || 'EVOLUCIÓN DIARIA', dailyItems, 135);"
);
c = c.replace(
  /nextY = drawBarChart\('EVOLUCIÓN SEMANAL \(PERIODO SELECCIONADO\)', weeklyRevenue, nextY\);/,
  "nextY = drawBarChart(t?.charts?.weekly || 'EVOLUCIÓN SEMANAL', weeklyRevenue, nextY);"
);
c = c.replace(
  /nextY = drawBarChart\(`HISTÓRICO MENSUAL \(\$\{new Date\(\)\.getFullYear\(\)\}\)`, monthlyRevenue, nextY\);/,
  "nextY = drawBarChart(`${t?.charts?.monthly || 'HISTÓRICO MENSUAL'} (${new Date().getFullYear()})`, monthlyRevenue, nextY);"
);

// Unpaid
c = c.replace(
  /doc\.text\(`CLIENTES SIN PAGO \(\$\{clientsWithoutPayment\?\.length \|\| 0\}\)`, 20, nextY\);/,
  "doc.text(`${t?.unpaid?.title || 'CLIENTES SIN PAGO'} (${clientsWithoutPayment?.length || 0})`, 20, nextY);"
);
c = c.replace(
  /doc\.text\("Listado de clientes activos asignados que no registraron pagos en este periodo\.", 20, nextY \+ 5\);/,
  "doc.text(t?.unpaid?.desc || 'Listado de clientes...', 20, nextY + 5);"
);

// Unpaid Headers
c = c.replace(
  /doc\.text\("CLIENTE", 22, nextY \+ 5\);\s*doc\.text\("ÚLT\. PAGO", 85, nextY \+ 5\);\s*doc\.text\("MORA", 125, nextY \+ 5\);\s*doc\.text\("SALDO DEUDA", 160, nextY \+ 5\);/,
  `doc.text(t?.unpaid?.client || "CLIENTE", 22, nextY + 5);
    doc.text(t?.unpaid?.lastPayment || "ÚLTIMO PAGO", 85, nextY + 5);
    doc.text(t?.unpaid?.overdue || "MORA", 125, nextY + 5);
    doc.text(t?.unpaid?.debt || "SALDO DEUDA", 160, nextY + 5);`
);

c = c.replace(
  /doc\.text\("CLIENTE \(Cont\.\)", 22, nextY \+ 5\);\s*doc\.text\("ÚLT\. PAGO", 85, nextY \+ 5\);\s*doc\.text\("MORA", 125, nextY \+ 5\);\s*doc\.text\("SALDO DEUDA", 160, nextY \+ 5\);/,
  `doc.text((t?.unpaid?.client || "CLIENTE") + " (Cont.)", 22, nextY + 5);
                doc.text(t?.unpaid?.lastPayment || "ÚLT. PAGO", 85, nextY + 5);
                doc.text(t?.unpaid?.overdue || "MORA", 125, nextY + 5);
                doc.text(t?.unpaid?.debt || "SALDO DEUDA", 160, nextY + 5);`
);

// Congrats
c = c.replace(
  /doc\.text\("¡Felicitaciones! Todos los clientes activos han realizado al menos un pago en este rango de tiempo\.", 25, nextY\);/,
  "doc.text(t?.unpaid?.congrats || '¡Felicitaciones!', 25, nextY);"
);

// Never
c = c.replace(
  /doc\.text\("NUNCA", 85, nextY \+ 1\.5\);/,
  "doc.text(t?.unpaid?.never || \"NUNCA\", 85, nextY + 1.5);"
);

// Days
c = c.replace(
  /doc\.text\(`\$\{client\.daysOverdue\} días`, 125, nextY \+ 1\.5\);/,
  "doc.text(`${client.daysOverdue} ${t?.unpaid?.days || 'días'}`, 125, nextY + 1.5);"
);

// Total Debt
c = c.replace(
  /doc\.text\("TOTAL CARTERA EN MORA \(ESTE PERIODO\):", 80, nextY\);/,
  "doc.text(t?.unpaid?.totalDebt || 'TOTAL CARTERA EN MORA:', 80, nextY);"
);

// Footer 1
c = c.replace(
  /doc\.text\("Reporte Interno - Anexo Cobro", 105, 285, { align: 'center' }\);\s*doc\.text\(`Página \$\{i\} de \$\{pageCount\}`, 190, 285, { align: 'right' }\);/g,
  `doc.text(t?.footer || "Reporte Interno - Anexo Cobro", 105, 285, { align: 'center' });
        doc.text(\`\${t?.page || 'Página'} \${i} / \${pageCount}\`, 190, 285, { align: 'right' });`
);


// ----------------------------------------
// PATCH generateDeletedPaymentsPDF
// ----------------------------------------

c = c.replace(
  /export const generateDeletedPaymentsPDF = \(data: any\) => {/,
  "export const generateDeletedPaymentsPDF = (data: any) => {\n    const t = (getTranslation(data.settings?.language || 'es') as any).dashboard?.deleted;"
);

c = c.replace(
  "doc.text('AUDITORÍA DE PAGOS ELIMINADOS', 105, 20, { align: 'center' });",
  "doc.text(t?.title || 'AUDITORÍA DE PAGOS ELIMINADOS', 105, 20, { align: 'center' });"
);

c = c.replace(
  "doc.text(`COBRADOR FILTRADO: ${collectorName.toUpperCase()}`, 20, 55);",
  "doc.text(`${t?.collector || 'COBRADOR:'} ${collectorName.toUpperCase()}`, 20, 55);"
);

c = c.replace(
  "doc.text(`PERIODO DE ELIMINACIÓN: ${startDate} al ${endDate}`, 20, 62);",
  "doc.text(`${t?.period || 'PERIODO:'} ${startDate} al ${endDate}`, 20, 62);"
);

c = c.replace(
  "doc.text(`FECHA DE REPORTE: ${dateStr}`, 20, 67);",
  "doc.text(`${t?.date || 'FECHA:'} ${dateStr}`, 20, 67);"
);

c = c.replace(
  /doc\.text\("FECHA ELIM\.", 22, nextY \+ 5\);\s*doc\.text\("CLIENTE", 55, nextY \+ 5\);\s*doc\.text\("ELIMINADO POR", 110, nextY \+ 5\);\s*doc\.text\("COBRADOR ORIG\.", 145, nextY \+ 5\);\s*doc\.text\("MONTO", 185, nextY \+ 5, { align: 'right' }\);/g,
  `doc.text(t?.table?.date || "FECHA ELIM.", 22, nextY + 5);
                doc.text(t?.table?.client || "CLIENTE", 55, nextY + 5);
                doc.text(t?.table?.deletedBy || "ELIMINADO POR", 110, nextY + 5);
                doc.text(t?.table?.original || "COBRADOR ORIG.", 145, nextY + 5);
                doc.text(t?.table?.amount || "MONTO", 185, nextY + 5, { align: 'right' });`
);

c = c.replace(
  /doc\.text\("NO SE ENCONTRARON PAGOS ELIMINADOS EN ESTE PERIODO\.", 105, nextY, { align: 'center' }\);/,
  "doc.text(t?.empty || 'NO SE ENCONTRARON PAGOS ELIMINADOS EN ESTE PERIODO.', 105, nextY, { align: 'center' });"
);

c = c.replace(
  /doc\.text\("TOTAL DINERO ANULADO:", 110, nextY\);/,
  "doc.text(t?.total || 'TOTAL DINERO ANULADO:', 110, nextY);"
);

c = c.replace(
  /doc\.text\("Auditoría Interna de Seguridad - Anexo Cobro", 105, 285, { align: 'center' }\);\s*doc\.text\(`Página \$\{i\} de \$\{pageCount\}`, 190, 285, { align: 'right' }\);/g,
  `doc.text(t?.footer || "Auditoría Interna de Seguridad - Anexo Cobro", 105, 285, { align: 'center' });
        doc.text(\`\${t?.page || 'Página'} \${i} / \${pageCount}\`, 190, 285, { align: 'right' });`
);

fs.writeFileSync('utils/auditReportGenerator.ts', c, 'utf8');
console.log('Patch complete.');
