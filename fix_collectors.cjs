const fs = require('fs');

const extraTranslations = {
  es: {
    titleTabs: "RUTAS/COBRADORES",
    managementMsg: "Gestión de mis cobradores personales",
    isolatedManagementMsg: "Gestión de sucursal aislada",
    exitBtn: "SALIR",
    newRouteBtn: "NUEVA RUTA",
    gpsMandatory: "GPS Obligatorio",
    activate: "ACTIVAR",
    inactive: "INACTIVO",
    editCollector: "Editar Cobrador",
    newCollectionRoute: "Nueva Ruta de Cobro",
    staffRecord: "Expediente del personal",
    accessCredentials: "I. Credenciales de Acceso",
    fullName: "Nombre Completo",
    userId: "Usuario ID",
    pinPassword: "PIN / Clave",
    licenseExpiration: "Fecha Vencimiento Licencia",
    photoRecord: "II. Expediente Fotográfico",
    profilePhoto: "Foto Perfil",
    housePhoto: "Foto Fachada Casa",
    saveChanges: "Guardar Cambios"
  },
  en: {
    titleTabs: "ROUTES/COLLECTORS",
    managementMsg: "Management of my personal collectors",
    isolatedManagementMsg: "Isolated branch management",
    exitBtn: "EXIT",
    newRouteBtn: "NEW ROUTE",
    gpsMandatory: "Mandatory GPS",
    activate: "ACTIVATE",
    inactive: "INACTIVE",
    editCollector: "Edit Collector",
    newCollectionRoute: "New Collection Route",
    staffRecord: "Staff Record",
    accessCredentials: "I. Access Credentials",
    fullName: "Full Name",
    userId: "User ID",
    pinPassword: "PIN / Password",
    licenseExpiration: "License Expiration Date",
    photoRecord: "II. Photographic Record",
    profilePhoto: "Profile Photo",
    housePhoto: "House Facade Photo",
    saveChanges: "Save Changes"
  },
  pt: {
    titleTabs: "ROTAS/COBRADORES",
    managementMsg: "Gestão dos meus cobradores pessoais",
    isolatedManagementMsg: "Gestão de filial isolada",
    exitBtn: "SAIR",
    newRouteBtn: "NOVA ROTA",
    gpsMandatory: "GPS Obrigatório",
    activate: "ATIVAR",
    inactive: "INATIVO",
    editCollector: "Editar Cobrador",
    newCollectionRoute: "Nova Rota de Cobrança",
    staffRecord: "Registro de Pessoal",
    accessCredentials: "I. Credenciais de Acesso",
    fullName: "Nome Completo",
    userId: "ID do Usuário",
    pinPassword: "PIN / Senha",
    licenseExpiration: "Data de Vencimento da Licença",
    photoRecord: "II. Registro Fotográfico",
    profilePhoto: "Foto de Perfil",
    housePhoto: "Foto da Fachada",
    saveChanges: "Salvar Alterações"
  },
  fr: {
    titleTabs: "ITINÉRAIRES/COLLECTEURS",
    managementMsg: "Gestion de mes collecteurs",
    isolatedManagementMsg: "Gestion de succursale isolée",
    exitBtn: "QUITTER",
    newRouteBtn: "NOUVEL ITINÉRAIRE",
    gpsMandatory: "GPS Obligatoire",
    activate: "ACTIVER",
    inactive: "INACTIF",
    editCollector: "Modifier Collecteur",
    newCollectionRoute: "Nouvel Itinéraire de Recouvrement",
    staffRecord: "Dossier du Personnel",
    accessCredentials: "I. Identifiants de Connexion",
    fullName: "Nom Complet",
    userId: "Identifiant",
    pinPassword: "PIN / Mot de Passe",
    licenseExpiration: "Date d'Expiration de la Licence",
    photoRecord: "II. Dossier Photographique",
    profilePhoto: "Photo de Profil",
    housePhoto: "Photo de Façade",
    saveChanges: "Enregistrer"
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
  />RUTAS\/COBRADORES<\/h2>/g,
  ">{(t as any).collectors?.titleTabs || 'RUTAS/COBRADORES'}</h2>"
);

code = code.replace(
  /\{isAdmin \? 'Gesti.n de mis cobradores personales' : 'Gesti.n de sucursal aislada'\}/g,
  "{isAdmin ? ((t as any).collectors?.managementMsg || 'Gestión de mis cobradores personales') : ((t as any).collectors?.isolatedManagementMsg || 'Gestión de sucursal aislada')}"
);

code = code.replace(
  />\s*SALIR\s*<\/button>/g,
  ">{(t as any).collectors?.exitBtn || 'SALIR'}</button>"
);

code = code.replace(
  />\s*NUEVA RUTA\s*<\/button>/g,
  ">{(t as any).collectors?.newRouteBtn || 'NUEVA RUTA'}</button>"
);

code = code.replace(
  /GPS Obligatorio/g,
  "{(t as any).collectors?.gpsMandatory || 'GPS Obligatorio'}"
);

code = code.replace(
  /✓ ACTIVAR/g,
  "✓ {(t as any).collectors?.activate || 'ACTIVAR'}"
);

code = code.replace(
  /✕ INACTIVO/g,
  "✕ {(t as any).collectors?.inactive || 'INACTIVO'}"
);

code = code.replace(
  /\{editingUserId \? 'Editar Cobrador' : 'Nueva Ruta de Cobro'\}/g,
  "{editingUserId ? ((t as any).collectors?.editCollector || 'Editar Cobrador') : ((t as any).collectors?.newCollectionRoute || 'Nueva Ruta de Cobro')}"
);

code = code.replace(
  />Expediente del personal<\/p>/g,
  ">{(t as any).collectors?.staffRecord || 'Expediente del personal'}</p>"
);

code = code.replace(
  /I\. Credenciales de Acceso/g,
  "{(t as any).collectors?.accessCredentials || 'I. Credenciales de Acceso'}"
);

code = code.replace(
  />Nombre Completo<\/label>/g,
  ">{(t as any).collectors?.fullName || 'Nombre Completo'}</label>"
);

code = code.replace(
  />Usuario ID<\/label>/g,
  ">{(t as any).collectors?.userId || 'Usuario ID'}</label>"
);

code = code.replace(
  />PIN \/ Clave<\/label>/g,
  ">{(t as any).collectors?.pinPassword || 'PIN / Clave'}</label>"
);

code = code.replace(
  />Fecha Vencimiento Licencia<\/label>/g,
  ">{(t as any).collectors?.licenseExpiration || 'Fecha Vencimiento Licencia'}</label>"
);

code = code.replace(
  /II\. Expediente Fotogr.fico/g,
  "{(t as any).collectors?.photoRecord || 'II. Expediente Fotográfico'}"
);

code = code.replace(
  /Foto Perfil/g,
  "{(t as any).collectors?.profilePhoto || 'Foto Perfil'}"
);

code = code.replace(
  /Foto Fachada Casa/g,
  "{(t as any).collectors?.housePhoto || 'Foto Fachada Casa'}"
);

code = code.replace(
  />\s*GUARDAR CAMBIOS\s*<\/button>/g,
  ">{(t as any).collectors?.saveChanges || 'GUARDAR CAMBIOS'}</button>"
);

// Exit button in modal is `> <i className="fa-solid fa-xmark mr-1"></i> SALIR`
code = code.replace(
  />\s*<i className="fa-solid fa-xmark mr-1"><\/i>\s*SALIR\s*<\/button>/g,
  "><i className=\"fa-solid fa-xmark mr-1\"></i> {(t as any).collectors?.exitBtn || 'SALIR'}</button>"
);

fs.writeFileSync('components/Collectors.tsx', code, 'utf8');

console.log('Fixed translations in Collectors.tsx');
