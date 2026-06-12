const fs = require('fs');

let translations = fs.readFileSync('utils/translations.ts', 'utf8');

// We will just do a quick addition of the new keys into `clients.list` for all 4 languages.
const newKeysES = `
          thRegDateFull: "Fecha Alta",
          thCredit: "Crédito",
          thAmount: "Monto",
          thInterest: "Interés",
          thCollected: "Cobrado",
          thInstallments: "Cuotas",
          thMora: "Mora",
          thRenovDate: "Fecha Renov.",
          thClient: "Cliente",
          thArrears: "Atraso",
          thFrequency: "Frecuencia",
          thApproved: "Habilitado",
          thTotal: "Total",
          thState: "Estado",
          btnView: "VER",
          btnDetail: "DETALLE",
          btnDelete: "ELIMINAR",
          btnActive: "+ ACTIVO",
          thFinished: "CRÉD. FINALIZADOS",
`;
const newKeysEN = `
          thRegDateFull: "Reg. Date",
          thCredit: "Credit",
          thAmount: "Amount",
          thInterest: "Interest",
          thCollected: "Collected",
          thInstallments: "Instalmnts",
          thMora: "Arrears",
          thRenovDate: "Renov. Date",
          thClient: "Client",
          thArrears: "Late",
          thFrequency: "Frequency",
          thApproved: "Approved",
          thTotal: "Total",
          thState: "State",
          btnView: "VIEW",
          btnDetail: "DETAIL",
          btnDelete: "DELETE",
          btnActive: "+ ACTIVE",
          thFinished: "FINISHED LOANS",
`;
const newKeysFR = `
          thRegDateFull: "Date d'Ouverture",
          thCredit: "Crédit",
          thAmount: "Montant",
          thInterest: "Intérêt",
          thCollected: "Collecté",
          thInstallments: "Échéances",
          thMora: "Mora",
          thRenovDate: "Date Renouv.",
          thClient: "Client",
          thArrears: "Retard",
          thFrequency: "Fréquence",
          thApproved: "Approuvé",
          thTotal: "Total",
          thState: "État",
          btnView: "VOIR",
          btnDetail: "DÉTAIL",
          btnDelete: "SUPPRIMER",
          btnActive: "+ ACTIF",
          thFinished: "CRÉD. TERMINÉS",
`;
const newKeysPT = `
          thRegDateFull: "Data Registro",
          thCredit: "Crédito",
          thAmount: "Valor",
          thInterest: "Juros",
          thCollected: "Arrecadado",
          thInstallments: "Parcelas",
          thMora: "Atraso",
          thRenovDate: "Data Renov.",
          thClient: "Cliente",
          thArrears: "Atraso",
          thFrequency: "Frequência",
          thApproved: "Aprovado",
          thTotal: "Total",
          thState: "Status",
          btnView: "VER",
          btnDetail: "DETALHE",
          btnDelete: "EXCLUIR",
          btnActive: "+ ATIVO",
          thFinished: "CRÉD. FINALIZADOS",
`;

// Insert the keys into the translations.ts file inside `list: {` of `clients:`
function injectKeys(langCode, keysStr) {
  const marker = "list: {\n";
  const regex = new RegExp(`(${langCode}\\s*:\\s*\\{[\\s\\S]*?clients\\s*:\\s*\\{[\\s\\S]*?list\\s*:\\s*\\{)`);
  translations = translations.replace(regex, `$1${keysStr}`);
}

injectKeys("es", newKeysES);
injectKeys("en", newKeysEN);
injectKeys("fr", newKeysFR);
injectKeys("pt", newKeysPT);

fs.writeFileSync('utils/translations.ts', translations, 'utf8');

let clients = fs.readFileSync('components/Clients.tsx', 'utf8');

// Replace table headers
clients = clients.replace(/>Fecha Alta<\/th>/g, `>{((t as any).clients.list?.thRegDateFull || 'Fecha Alta')}</th>`);
clients = clients.replace(/>Cr.dito<\/th>/g, `>{((t as any).clients.list?.thCredit || 'Crédito')}</th>`);
clients = clients.replace(/>Monto<\/th>/g, `>{((t as any).clients.list?.thAmount || 'Monto')}</th>`);
clients = clients.replace(/>Inter.s<\/th>/g, `>{((t as any).clients.list?.thInterest || 'Interés')}</th>`);
clients = clients.replace(/>Cobrado<\/th>/g, `>{((t as any).clients.list?.thCollected || 'Cobrado')}</th>`);
clients = clients.replace(/>Cuotas<\/th>/g, `>{((t as any).clients.list?.thInstallments || 'Cuotas')}</th>`);
clients = clients.replace(/>Mora<\/th>/g, `>{((t as any).clients.list?.thMora || 'Mora')}</th>`);
clients = clients.replace(/>Fecha Renov.<\/th>/g, `>{((t as any).clients.list?.thRenovDate || 'Fecha Renov.')}</th>`);
clients = clients.replace(/>Cliente<\/th>/g, `>{((t as any).clients.list?.thClient || 'Cliente')}</th>`);
clients = clients.replace(/>Atraso<\/th>/g, `>{((t as any).clients.list?.thArrears || 'Atraso')}</th>`);
clients = clients.replace(/>Frecuencia<\/th>/g, `>{((t as any).clients.list?.thFrequency || 'Frecuencia')}</th>`);
clients = clients.replace(/>Habilitado<\/th>/g, `>{((t as any).clients.list?.thApproved || 'Habilitado')}</th>`);
clients = clients.replace(/>Total<\/th>/g, `>{((t as any).clients.list?.thTotal || 'Total')}</th>`);
clients = clients.replace(/>Estado<\/th>/g, `>{((t as any).clients.list?.thState || 'Estado')}</th>`);
clients = clients.replace(/>CR.DITOS FINALIZADOS<\/h5>/g, `>{((t as any).clients.list?.thFinished || 'CRÉDITOS FINALIZADOS')}</h5>`);

// Tag replacement
clients = clients.replace(/>CR.D\. FINALIZADOS<\/span>/g, `>{((t as any).clients.list?.thFinished || 'CRÉD. FINALIZADOS')}</span>`);
clients = clients.replace(/>\s*\+\s*ACTIVO\s*<\/span>/g, `> {((t as any).clients.list?.btnActive || '+ ACTIVO')}</span>`);

// Actions buttons
clients = clients.replace(/>VER<\/span>/g, `>{((t as any).clients.list?.btnView || 'VER')}</span>`);
clients = clients.replace(/>DETALLE<\/span>/g, `>{((t as any).clients.list?.btnDetail || 'DETALLE')}</span>`);
clients = clients.replace(/>ELIMINAR<\/span>/g, `>{((t as any).clients.list?.btnDelete || 'ELIMINAR')}</span>`);

// Also pagination is hardcoded in Clients.tsx? Wait, the screenshot shows "PÁGINA 1 / 17" and "DOSSIER".
// Let's replace "PÁGINA" in Clients.tsx if it exists.
clients = clients.replace(/P.GINA (\{[^\}]+\}) \/ (\{[^\}]+\})/g, `{((t as any).clients.pagination?.page || 'PÁGINA')} $1 / $2`);

fs.writeFileSync('components/Clients.tsx', clients, 'utf8');
console.log("Done");
