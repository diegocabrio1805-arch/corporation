const fs = require('fs');
const file = 'c:/Users/DANIEL/Desktop/cobros/components/Clients.tsx';
let content = fs.readFileSync(file, 'utf8');

const dateFilterRegex = /const isDefaultRange = filterStartDate === countryTodayStr && filterEndDate === countryTodayStr;\s*if \(!isDefaultRange\) \{\s*const clientDate = new Date\(c\.createdAt \|\| 0\);\s*if \(clientDate < start \|\| clientDate > end\) return false;\s*\}/g;

const replacement = `// FILTRO DE FECHA REMOVIDO: En CARTERA GENERAL queremos ver toda la cartera histórica o activa independientemente de la fecha ingresada`;

if (dateFilterRegex.test(content)) {
    content = content.replace(dateFilterRegex, replacement);
    fs.writeFileSync(file, content);
    console.log("PACTH FECHA APLICADO EXITOSAMENTE.");
} else {
    console.log("REGEX NO HIZO MATCH");
}
