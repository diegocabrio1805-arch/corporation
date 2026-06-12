const fs = require('fs');

let translations = fs.readFileSync('utils/translations.ts', 'utf8');

// Inject the new strings into translations.ts
const newStrings = {
  es: {
    title: "AUDITORIA DE CAMPO - CONTROL",
    subtitle: "SISTEMA DE GESTIÓN DE CARTERA",
    collectorInfo: "Información del Cobrador:",
    auditedPeriod: "Periodo Auditado:"
  },
  en: {
    title: "FIELD AUDIT - CONTROL",
    subtitle: "PORTFOLIO MANAGEMENT SYSTEM",
    collectorInfo: "Collector Information:",
    auditedPeriod: "Audited Period:"
  },
  pt: {
    title: "AUDITORIA DE CAMPO - CONTROLE",
    subtitle: "SISTEMA DE GESTÃO DE CARTEIRA",
    collectorInfo: "Informações do Cobrador:",
    auditedPeriod: "Período Auditado:"
  },
  fr: {
    title: "AUDIT SUR LE TERRAIN - CONTRÔLE",
    subtitle: "SYSTÈME DE GESTION DE PORTEFEUILLE",
    collectorInfo: "Informations sur le Recouvreur :",
    auditedPeriod: "Période Auditée :"
  }
};

const langs = ['es', 'en', 'pt', 'fr'];
for (const lang of langs) {
  const langIndex = translations.indexOf(`  ${lang}: {`);
  if (langIndex !== -1) {
    const auditPdfIndex = translations.indexOf(`    auditPdf: {`, langIndex);
    if (auditPdfIndex !== -1) {
      const nextLineIndex = translations.indexOf(`\n`, auditPdfIndex);
      let add = ``;
      for (const [k, v] of Object.entries(newStrings[lang])) {
        add += `\n      ${k}: "${v}",`;
      }
      translations = translations.slice(0, nextLineIndex) + add + translations.slice(nextLineIndex);
    }
  }
}
fs.writeFileSync('utils/translations.ts', translations, 'utf8');

// Update Reports.tsx
let reports = fs.readFileSync('components/Reports.tsx', 'utf8');

reports = reports.replace(
  /doc\.text\('AUDITORIA DE CAMPO - CONTROL', 105, 20, \{ align: 'center' \}\);/g,
  "doc.text(t.auditPdf?.title || 'AUDITORIA DE CAMPO - CONTROL', 105, 20, { align: 'center' });"
);

reports = reports.replace(
  /doc\.text\(\`SISTEMA DE GESTIÓN DE CARTERA - \$\{dateStr\}\`, 105, 30, \{ align: 'center' \}\);/g,
  "doc.text(`${t.auditPdf?.subtitle || 'SISTEMA DE GESTIÓN DE CARTERA'} - ${dateStr}`, 105, 30, { align: 'center' });"
);

reports = reports.replace(
  /\`Cobrador: \$\{collectorName\}\`/g,
  "`${t.auditPdf?.collector || 'Cobrador:'} ${collectorName}`"
);

reports = reports.replace(
  /\`Periodo: \$\{selectedDate\} \/ \$\{endDate \|\| selectedDate\}\`/g,
  "`${t.auditPdf?.period || 'Periodo:'} ${selectedDate} / ${endDate || selectedDate}`"
);

reports = reports.replace(
  /\`Informaci.n del Cobrador: \$\{collectorName\}\`/g,
  "`${t.auditPdf?.collectorInfo || 'Información del Cobrador:'} ${collectorName}`"
);

reports = reports.replace(
  /\`Periodo Auditado: \$\{selectedDate\} \/ \$\{endDate \|\| selectedDate\}\`/g,
  "`${t.auditPdf?.auditedPeriod || 'Periodo Auditado:'} ${selectedDate} / ${endDate || selectedDate}`"
);

fs.writeFileSync('components/Reports.tsx', reports, 'utf8');
console.log('Fixed missed audit strings');
