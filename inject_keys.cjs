const fs = require('fs');

let translations = fs.readFileSync('utils/translations.ts', 'utf8');

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

// There are 4 occurrences of `clients: {\n        list: {\n`, one for each language.
const parts = translations.split(/(clients:\s*\{\s*list:\s*\{)/);

if (parts.length === 9) { // 1 before + 4 * (match + after)
  // parts[1] is match 1 (es), parts[2] is content after it
  parts[2] = newKeysES + parts[2];
  parts[4] = newKeysEN + parts[4];
  parts[6] = newKeysFR + parts[6];
  parts[8] = newKeysPT + parts[8];
  
  translations = parts.join('');
  fs.writeFileSync('utils/translations.ts', translations, 'utf8');
  console.log("Injected correctly!");
} else {
  console.log("Failed to parse", parts.length);
}
