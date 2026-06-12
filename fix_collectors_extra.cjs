const fs = require('fs');

const extraTranslations = {
  es: {
    cutoff: "Corte:",
    noDate: "SIN FECHA",
    uploadPhoto: "Subir Foto",
    uploadFacade: "Subir Fachada",
    gpsHome: "III. Ubicación Domiciliaria GPS",
    captureGps: "CAPTURAR GPS CASA",
    gpsCaptured: "UBICACIÓN CAPTURADA OK",
    createRoute: "CREAR RUTA",
    noRoutes: "No hay rutas vinculadas directamente a su cuenta"
  },
  en: {
    cutoff: "Cutoff:",
    noDate: "NO DATE",
    uploadPhoto: "Upload Photo",
    uploadFacade: "Upload Facade",
    gpsHome: "III. GPS Home Location",
    captureGps: "CAPTURE HOME GPS",
    gpsCaptured: "LOCATION CAPTURED OK",
    createRoute: "CREATE ROUTE",
    noRoutes: "There are no routes directly linked to your account"
  },
  pt: {
    cutoff: "Corte:",
    noDate: "SEM DATA",
    uploadPhoto: "Enviar Foto",
    uploadFacade: "Enviar Fachada",
    gpsHome: "III. Localização GPS",
    captureGps: "CAPTURAR GPS CASA",
    gpsCaptured: "LOCALIZAÇÃO CAPTURADA OK",
    createRoute: "CRIAR ROTA",
    noRoutes: "Não há rotas vinculadas diretamente à sua conta"
  },
  fr: {
    cutoff: "Coupure:",
    noDate: "SANS DATE",
    uploadPhoto: "Importer Photo",
    uploadFacade: "Importer Façade",
    gpsHome: "III. Localisation GPS du Domicile",
    captureGps: "CAPTURER GPS DOMICILE",
    gpsCaptured: "LOCALISATION CAPTURÉE OK",
    createRoute: "CRÉER ITINÉRAIRE",
    noRoutes: "Aucun itinéraire lié directement à votre compte"
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

code = code.replace(
  />Rutas \/ Cobradores<\/h2>/g,
  ">{(t as any).collectors?.titleTabs || 'RUTAS/COBRADORES'}</h2>"
);

code = code.replace(
  />No hay rutas vinculadas directamente a su cuenta<\/p>/g,
  ">{(t as any).collectors?.noRoutes || 'No hay rutas vinculadas directamente a su cuenta'}</p>"
);

code = code.replace(
  />Corte:<\/span>/g,
  ">{(t as any).collectors?.cutoff || 'Corte:'}</span>"
);

code = code.replace(
  /'SIN FECHA'/g,
  "(t as any).collectors?.noDate || 'SIN FECHA'"
);

code = code.replace(
  />Subir Foto<\/p>/g,
  ">{(t as any).collectors?.uploadPhoto || 'Subir Foto'}</p>"
);

code = code.replace(
  />Subir Fachada<\/p>/g,
  ">{(t as any).collectors?.uploadFacade || 'Subir Fachada'}</p>"
);

code = code.replace(
  />III\. Ubicaci.n Domiciliaria GPS<\/h4>/g,
  ">{(t as any).collectors?.gpsHome || 'III. Ubicación Domiciliaria GPS'}</h4>"
);

code = code.replace(
  /'UBICACI.N CAPTURADA OK' : 'CAPTURAR GPS CASA'/g,
  "((t as any).collectors?.gpsCaptured || 'UBICACIÓN CAPTURADA OK') : ((t as any).collectors?.captureGps || 'CAPTURAR GPS CASA')"
);

code = code.replace(
  /\{editingUserId \? 'GUARDAR CAMBIOS' : 'CREAR RUTA'\}/g,
  "{editingUserId ? ((t as any).collectors?.saveChanges || 'GUARDAR CAMBIOS') : ((t as any).collectors?.createRoute || 'CREAR RUTA')}"
);

fs.writeFileSync('components/Collectors.tsx', code, 'utf8');

console.log('Fixed additional translations in Collectors.tsx');
