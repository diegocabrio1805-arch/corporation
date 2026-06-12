const fs = require('fs');

const extraTranslations = {
  es: {
    searchPlaceholder: "Buscar...",
    thClientId: "Cliente / ID",
    thContact: "Contacto",
    thLocation: "Ubicación",
    thDaysOverdue: "Días Mora",
    thPaidInstallments: "Cuotas Pagadas",
    thInstallmentValue: "Valor Cuota",
    thPendingBalance: "Saldo Pend.",
    thManagement: "Gestión",
    thRegDate: "Fecha Registro",
    thPhone: "Teléfono",
    thArchivedBalance: "Saldo Archivador",
    thActions: "Acciones",
    btnRestore: "RESTAURAR",
    archivedRecords: "REGISTROS EN ARCHIVO",
    hiddenAudit: "AUDITORÍA DE CLIENTES OCULTOS"
  },
  en: {
    searchPlaceholder: "Search...",
    thClientId: "Client / ID",
    thContact: "Contact",
    thLocation: "Location",
    thDaysOverdue: "Days Late",
    thPaidInstallments: "Paid Installments",
    thInstallmentValue: "Installment Value",
    thPendingBalance: "Pending Bal.",
    thManagement: "Management",
    thRegDate: "Reg. Date",
    thPhone: "Phone",
    thArchivedBalance: "Archived Bal.",
    thActions: "Actions",
    btnRestore: "RESTORE",
    archivedRecords: "ARCHIVED RECORDS",
    hiddenAudit: "HIDDEN CLIENTS AUDIT"
  },
  pt: {
    searchPlaceholder: "Buscar...",
    thClientId: "Cliente / ID",
    thContact: "Contato",
    thLocation: "Localização",
    thDaysOverdue: "Dias Atraso",
    thPaidInstallments: "Parcelas Pagas",
    thInstallmentValue: "Valor Parcela",
    thPendingBalance: "Saldo Pend.",
    thManagement: "Gestão",
    thRegDate: "Data Registro",
    thPhone: "Telefone",
    thArchivedBalance: "Saldo Arquivado",
    thActions: "Ações",
    btnRestore: "RESTAURAR",
    archivedRecords: "REGISTROS ARQUIVADOS",
    hiddenAudit: "AUDITORIA DE CLIENTES OCULTOS"
  },
  fr: {
    searchPlaceholder: "Rechercher...",
    thClientId: "Client / ID",
    thContact: "Contact",
    thLocation: "Emplacement",
    thDaysOverdue: "Jours Retard",
    thPaidInstallments: "Échéances Payées",
    thInstallmentValue: "Valeur Échéance",
    thPendingBalance: "Solde Pend.",
    thManagement: "Gestion",
    thRegDate: "Date Enreg.",
    thPhone: "Téléphone",
    thArchivedBalance: "Solde Archivé",
    thActions: "Actions",
    btnRestore: "RESTAURER",
    archivedRecords: "DOSSIERS ARCHIVÉS",
    hiddenAudit: "AUDIT DES CLIENTS CACHÉS"
  }
};

let translations = fs.readFileSync('utils/translations.ts', 'utf8');

const langs = ['es', 'en', 'pt', 'fr'];
for (const lang of langs) {
  const langIndex = translations.indexOf(`  ${lang}: {`);
  if (langIndex !== -1) {
    const clientsBlockIndex = translations.indexOf(`    clients: {`, langIndex);
    if (clientsBlockIndex !== -1) {
      const listBlockIndex = translations.indexOf(`      list: {`, clientsBlockIndex);
      if (listBlockIndex !== -1) {
        const nextLineIndex = translations.indexOf(`\n`, listBlockIndex);
        let add = ``;
        for (const [k, v] of Object.entries(extraTranslations[lang])) {
          add += `\n        ${k}: "${v.replace(/"/g, '\\"')}",`;
        }
        translations = translations.slice(0, nextLineIndex) + add + translations.slice(nextLineIndex);
      }
    }
  }
}
fs.writeFileSync('utils/translations.ts', translations, 'utf8');

let code = fs.readFileSync('components/Clients.tsx', 'utf8');

// Replace standard strings
code = code.replace(/placeholder="Buscar\.\.\."/g, `placeholder={((t as any).clients.list?.searchPlaceholder || 'Buscar...')}`);
code = code.replace(/>Cliente \/ ID<\/th>/g, `>{((t as any).clients.list?.thClientId || 'Cliente / ID')}</th>`);
code = code.replace(/>Contacto<\/th>/g, `>{((t as any).clients.list?.thContact || 'Contacto')}</th>`);
code = code.replace(/>Ubicaci.n<\/th>/g, `>{((t as any).clients.list?.thLocation || 'Ubicación')}</th>`);
code = code.replace(/>D.as Mora<\/th>/g, `>{((t as any).clients.list?.thDaysOverdue || 'Días Mora')}</th>`);
code = code.replace(/>Cuotas Pagadas<\/th>/g, `>{((t as any).clients.list?.thPaidInstallments || 'Cuotas Pagadas')}</th>`);
code = code.replace(/>Valor Cuota<\/th>/g, `>{((t as any).clients.list?.thInstallmentValue || 'Valor Cuota')}</th>`);
code = code.replace(/>Saldo Pend\.<\/th>/g, `>{((t as any).clients.list?.thPendingBalance || 'Saldo Pend.')}</th>`);
code = code.replace(/>Gesti.n<\/th>/g, `>{((t as any).clients.list?.thManagement || 'Gestión')}</th>`);
code = code.replace(/>Fecha Registro<\/th>/g, `>{((t as any).clients.list?.thRegDate || 'Fecha Registro')}</th>`);
code = code.replace(/>Tel.fono<\/th>/g, `>{((t as any).clients.list?.thPhone || 'Teléfono')}</th>`);
code = code.replace(/>Saldo Archivador<\/th>/g, `>{((t as any).clients.list?.thArchivedBalance || 'Saldo Archivador')}</th>`);
code = code.replace(/>Acciones<\/th>/g, `>{((t as any).clients.list?.thActions || 'Acciones')}</th>`);

// Buttons and text
code = code.replace(/>\s*RESTAURAR\s*<\/button>/g, `>{((t as any).clients.list?.btnRestore || 'RESTAURAR')}</button>`);
code = code.replace(/>REGISTROS EN ARCHIVO:/g, `>{((t as any).clients.list?.archivedRecords || 'REGISTROS EN ARCHIVO')}:`);
code = code.replace(/>\s*AUDITOR.A DE CLIENTES OCULTOS\s*<\/button>/g, `>{((t as any).clients.list?.hiddenAudit || 'AUDITORÍA DE CLIENTES OCULTOS')}</button>`);

// Fix doc.text PDF headers for these strings as well just in case
code = code.replace(/"CLIENTE \/ ID"/g, `((t as any).clients.list?.thClientId || "CLIENTE / ID").toUpperCase()`);

fs.writeFileSync('components/Clients.tsx', code, 'utf8');

console.log('Fixed extra translations in Clients.tsx');
