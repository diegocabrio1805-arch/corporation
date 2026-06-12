const fs = require('fs');

const extraTranslations = {
  es: {
    activeState: "ACTIVO",
    activateBtn: "ACTIVAR",
    inactiveState: "INACTIVO",
    deactivateBtn: "DESACTIVAR",
    gpsRequiredInfo: "GPS requerido para usar la app",
    gpsNotRequiredInfo: "GPS no requerido"
  },
  en: {
    activeState: "ACTIVE",
    activateBtn: "ACTIVATE",
    inactiveState: "INACTIVE",
    deactivateBtn: "DEACTIVATE",
    gpsRequiredInfo: "GPS required to use the app",
    gpsNotRequiredInfo: "GPS not required"
  },
  pt: {
    activeState: "ATIVO",
    activateBtn: "ATIVAR",
    inactiveState: "INATIVO",
    deactivateBtn: "DESATIVAR",
    gpsRequiredInfo: "GPS exigido para usar o app",
    gpsNotRequiredInfo: "GPS não exigido"
  },
  fr: {
    activeState: "ACTIF",
    activateBtn: "ACTIVER",
    inactiveState: "INACTIF",
    deactivateBtn: "DÉSACTIVER",
    gpsRequiredInfo: "GPS requis pour l'application",
    gpsNotRequiredInfo: "GPS non requis"
  }
};

let translations = fs.readFileSync('utils/translations.ts', 'utf8');

const langs = ['es', 'en', 'pt', 'fr'];
for (const lang of langs) {
  const langIndex = translations.indexOf(`  ${lang}: {`);
  if (langIndex !== -1) {
    const collBlockIndex = translations.indexOf(`    collectors: {`, langIndex);
    if (collBlockIndex !== -1) {
      const nextLineIndex = translations.indexOf(`\n`, collBlockIndex);
      let add = ``;
      for (const [k, v] of Object.entries(extraTranslations[lang])) {
        add += `\n      ${k}: "${v.replace(/"/g, '\\"')}",`;
      }
      translations = translations.slice(0, nextLineIndex) + add + translations.slice(nextLineIndex);
    }
  }
}
fs.writeFileSync('utils/translations.ts', translations, 'utf8');

let code = fs.readFileSync('components/Collectors.tsx', 'utf8');

// Replace string literals handling Windows console encoding differences and spaces

code = code.replace(
  /\{user\.requiresLocation \? '.* ACTIVO' : '.* ACTIVAR'\}/g,
  "{user.requiresLocation ? ' ✓ ' + ((t as any).collectors?.activeState || 'ACTIVO') : ' ✓ ' + ((t as any).collectors?.activateBtn || 'ACTIVAR')}"
);

code = code.replace(
  /\{!user\.requiresLocation \? '.* INACTIVO' : '.* DESACTIVAR'\}/g,
  "{!user.requiresLocation ? ' ✕ ' + ((t as any).collectors?.inactiveState || 'INACTIVO') : ' ✕ ' + ((t as any).collectors?.deactivateBtn || 'DESACTIVAR')}"
);

code = code.replace(
  /\{user\.requiresLocation\s*\?\s*'.* GPS requerido para usar la app'\s*:\s*'.* GPS no requerido'\}/g,
  "{user.requiresLocation ? '✓ ' + ((t as any).collectors?.gpsRequiredInfo || 'GPS requerido para usar la app') : '○ ' + ((t as any).collectors?.gpsNotRequiredInfo || 'GPS no requerido')}"
);

fs.writeFileSync('components/Collectors.tsx', code, 'utf8');

console.log('Fixed GPS translations in Collectors.tsx');
