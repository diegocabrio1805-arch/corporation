const fs = require('fs');

let c = fs.readFileSync('utils/auditReportGenerator.ts', 'utf8');

c = c.replace(/t\?\.kpi\?\.totalRevenue/g, 't?.kpi?.revenue');
c = c.replace(/t\?\.kpi\?\.totalClients/g, 't?.kpi?.portfolio');

c = c.replace(/t\?\.verdictTitle/g, 't?.verdict');
c = c.replace(/t\?\.verdicts\?\.\[verdict\]/g, 't?.verdictText?.[verdict]');

c = c.replace(/t\?\.analysisTitle/g, 't?.analysis?.title');

c = c.replace(/t\?\.table\?\.period/g, 't?.charts?.period');
c = c.replace(/t\?\.table\?\.revenue/g, 't?.charts?.revenue');
c = c.replace(/t\?\.table\?\.trend/g, 't?.charts?.trend');

// Fix feedbacks!
// Replace the whole feedback block since my previous patch used `feedbacks?.[verdict]` which doesn't exist.
const oldFeedbackBlock = /let feedback = t\?\.feedbacks\?\.\[verdict\] \|\| "";[\s\S]*?doc\.text\(feedback, 20, 122\);/;

const newFeedbackBlock = `let feedback = "";
    if (verdict === 'EXCELENTE') {
        feedback = t?.analysis?.excellent || (revenueIncreased && clientsIncreased 
            ? "EXCELENTE: Crecimiento integral. Ingresos y base de clientes en aumento." 
            : "EXCELENTE: Rendimiento excepcional en recaudación con retención de clientes.");
    } else if (verdict === 'BUENO' || verdict === 'MEDIANAMENTE BUENO') {
        feedback = t?.analysis?.stable || "ESTABLE: Recaudación sube sin nuevos clientes. Buena recuperación, pero baja expansión.";
    } else if (verdict === 'MEDIANAMENTE MALO' || verdict === 'REGULAR') {
         feedback = t?.analysis?.alert || "ATENCIÓN: Crecimiento con baja recaudación. Riesgo de liquidez, ajustar seguimiento.";
    } else {
        feedback = t?.analysis?.critical || "ALERTA: Caída generalizada en recaudo y clientes. Requiere intervención inmediata.";
    }
    doc.text(feedback, 20, 122);`;

if (c.match(oldFeedbackBlock)) {
    c = c.replace(oldFeedbackBlock, newFeedbackBlock);
}

fs.writeFileSync('utils/auditReportGenerator.ts', c, 'utf8');
console.log('Fixed object keys in auditReportGenerator.ts');
