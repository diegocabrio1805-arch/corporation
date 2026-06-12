const fs = require('fs');

const extraTranslations = {
  es: { installmentSingle: "Cuota #" },
  en: { installmentSingle: "Installment #" },
  pt: { installmentSingle: "Parcela #" },
  fr: { installmentSingle: "Échéance #" }
};

let translations = fs.readFileSync('utils/translations.ts', 'utf8');

const langs = ['es', 'en', 'pt', 'fr'];
for (const lang of langs) {
  const langIndex = translations.indexOf(`  ${lang}: {`);
  if (langIndex !== -1) {
    const notifBlockIndex = translations.indexOf(`    notifications: {`, langIndex);
    if (notifBlockIndex !== -1) {
      const nextLineIndex = translations.indexOf(`\n`, notifBlockIndex);
      let add = `\n      installmentSingle: "${extraTranslations[lang].installmentSingle.replace(/"/g, '\\"')}",`;
      translations = translations.slice(0, nextLineIndex) + add + translations.slice(nextLineIndex);
    }
  }
}
fs.writeFileSync('utils/translations.ts', translations, 'utf8');

let code = fs.readFileSync('components/Notifications.tsx', 'utf8');

code = code.replace(
  /\(Cuota #/g,
  "({(t as any).notifications?.installmentSingle || 'Cuota #'}"
);

fs.writeFileSync('components/Notifications.tsx', code, 'utf8');

console.log('Fixed Cuota in Notifications.tsx');
