const fs = require('fs');

const extraTranslations = {
  es: {
    tableHeaders: {
      clientId: "Cliente / ID",
      contact: "Contacto",
      location: "Ubicación",
      daysOverdue: "Días Mora",
      paidInstallments: "Cuotas Pagadas",
      installmentValue: "Valor Cuota",
      pendingBalance: "Saldo Pend.",
      management: "Gestión",
      regDate: "Fecha Registro",
      phone: "Teléfono",
      archivedBalance: "Saldo Archivador",
      actions: "Acciones",
      searchPlaceholder: "Buscar...",
      archivedRecords: "Registros en Archivo",
      hiddenAudit: "AUDITORÍA DE CLIENTES OCULTOS",
      restore: "RESTAURAR"
    },
    history: {
      title: "Historial Reciente",
      dateHour: "Fecha/Hora",
      concept: "Concepto",
      amount: "Monto",
      actions: "Acciones",
      paymentReceived: "Abono Recibido"
    }
  },
  en: {
    tableHeaders: {
      clientId: "Client / ID",
      contact: "Contact",
      location: "Location",
      daysOverdue: "Days Late",
      paidInstallments: "Paid Instalmnts",
      installmentValue: "Instalmnt Val",
      pendingBalance: "Pending Bal.",
      management: "Management",
      regDate: "Reg. Date",
      phone: "Phone",
      archivedBalance: "Archived Bal.",
      actions: "Actions",
      searchPlaceholder: "Search...",
      archivedRecords: "Archived Records",
      hiddenAudit: "HIDDEN CLIENTS AUDIT",
      restore: "RESTORE"
    },
    history: {
      title: "Recent History",
      dateHour: "Date/Time",
      concept: "Concept",
      amount: "Amount",
      actions: "Actions",
      paymentReceived: "Payment Received"
    }
  },
  pt: {
    tableHeaders: {
      clientId: "Cliente / ID",
      contact: "Contato",
      location: "Localização",
      daysOverdue: "Dias Atraso",
      paidInstallments: "Parcelas Pagas",
      installmentValue: "Valor Parcela",
      pendingBalance: "Saldo Pend.",
      management: "Gestão",
      regDate: "Data Reg.",
      phone: "Telefone",
      archivedBalance: "Saldo Arquivado",
      actions: "Ações",
      searchPlaceholder: "Buscar...",
      archivedRecords: "Registros Arquivados",
      hiddenAudit: "AUDITORIA DE CLIENTES OCULTOS",
      restore: "RESTAURAR"
    },
    history: {
      title: "Histórico Recente",
      dateHour: "Data/Hora",
      concept: "Conceito",
      amount: "Valor",
      actions: "Ações",
      paymentReceived: "Pagamento Recebido"
    }
  },
  fr: {
    tableHeaders: {
      clientId: "Client / ID",
      contact: "Contact",
      location: "Emplacement",
      daysOverdue: "Jours Retard",
      paidInstallments: "Échéances Payées",
      installmentValue: "Val. Échéance",
      pendingBalance: "Solde Pend.",
      management: "Gestion",
      regDate: "Date Enreg.",
      phone: "Téléphone",
      archivedBalance: "Solde Archivé",
      actions: "Actions",
      searchPlaceholder: "Rechercher...",
      archivedRecords: "Dossiers Archivés",
      hiddenAudit: "AUDIT CLIENTS CACHÉS",
      restore: "RESTAURER"
    },
    history: {
      title: "Historique Récent",
      dateHour: "Date/Heure",
      concept: "Concept",
      amount: "Montant",
      actions: "Actions",
      paymentReceived: "Paiement Reçu"
    }
  }
};

let translations = fs.readFileSync('utils/translations.ts', 'utf8');

const langs = ['es', 'en', 'pt', 'fr'];
for (const lang of langs) {
  const langIndex = translations.indexOf(`  ${lang}: {`);
  if (langIndex !== -1) {
    const loansBlockIndex = translations.indexOf(`    loans: {`, langIndex);
    if (loansBlockIndex !== -1) {
      const filtersBlockIndex = translations.indexOf(`      filters: {`, loansBlockIndex);
      if (filtersBlockIndex !== -1) {
        const nextLineIndex = translations.indexOf(`\n`, filtersBlockIndex);
        
        let add = `\n      tableHeaders: {`;
        for (const [k, v] of Object.entries(extraTranslations[lang].tableHeaders)) {
          add += `\n        ${k}: "${v.replace(/"/g, '\\"')}",`;
        }
        add += `\n      },`;
        add += `\n      history: {`;
        for (const [k, v] of Object.entries(extraTranslations[lang].history)) {
          add += `\n        ${k}: "${v.replace(/"/g, '\\"')}",`;
        }
        add += `\n      },`;
        
        translations = translations.slice(0, nextLineIndex) + add + translations.slice(nextLineIndex);
      }
    }
  }
}
fs.writeFileSync('utils/translations.ts', translations, 'utf8');

let code = fs.readFileSync('components/Loans.tsx', 'utf8');

// Replace standard strings
code = code.replace(/placeholder="Buscar\.\.\."/g, `placeholder={((t as any).loans.tableHeaders?.searchPlaceholder || 'Buscar...')}`);
code = code.replace(/>Cliente \/ ID<\/th>/g, `>{((t as any).loans.tableHeaders?.clientId || 'Cliente / ID')}</th>`);
code = code.replace(/>Contacto<\/th>/g, `>{((t as any).loans.tableHeaders?.contact || 'Contacto')}</th>`);
code = code.replace(/>Ubicaci.n<\/th>/g, `>{((t as any).loans.tableHeaders?.location || 'Ubicación')}</th>`);
code = code.replace(/>D.as Mora<\/th>/g, `>{((t as any).loans.tableHeaders?.daysOverdue || 'Días Mora')}</th>`);
code = code.replace(/>Cuotas Pagadas<\/th>/g, `>{((t as any).loans.tableHeaders?.paidInstallments || 'Cuotas Pagadas')}</th>`);
code = code.replace(/>Valor Cuota<\/th>/g, `>{((t as any).loans.tableHeaders?.installmentValue || 'Valor Cuota')}</th>`);
code = code.replace(/>Saldo Pend\.<\/th>/g, `>{((t as any).loans.tableHeaders?.pendingBalance || 'Saldo Pend.')}</th>`);
code = code.replace(/>Gesti.n<\/th>/g, `>{((t as any).loans.tableHeaders?.management || 'Gestión')}</th>`);
code = code.replace(/>Fecha Registro<\/th>/g, `>{((t as any).loans.tableHeaders?.regDate || 'Fecha Registro')}</th>`);
code = code.replace(/>Tel.fono<\/th>/g, `>{((t as any).loans.tableHeaders?.phone || 'Teléfono')}</th>`);
code = code.replace(/>Saldo Archivador<\/th>/g, `>{((t as any).loans.tableHeaders?.archivedBalance || 'Saldo Archivador')}</th>`);
code = code.replace(/>Acciones<\/th>/g, `>{((t as any).loans.tableHeaders?.actions || 'Acciones')}</th>`);
code = code.replace(/>\s*RESTAURAR\s*<\/button>/g, `>{((t as any).loans.tableHeaders?.restore || 'RESTAURAR')}</button>`);
code = code.replace(/>Registros en Archivo: /g, `>{((t as any).loans.tableHeaders?.archivedRecords || 'Registros en Archivo')}: `);
code = code.replace(/>\s*AUDITOR.A DE CLIENTES OCULTOS\s*<\/button>/g, `>{((t as any).loans.tableHeaders?.hiddenAudit || 'AUDITORÍA DE CLIENTES OCULTOS')}</button>`);

// History Modal
code = code.replace(/> Historial Reciente/g, `> {((t as any).loans.history?.title || 'Historial Reciente')}`);
code = code.replace(/>Fecha\/Hora<\/th>/g, `>{((t as any).loans.history?.dateHour || 'Fecha/Hora')}</th>`);
code = code.replace(/>Concepto<\/th>/g, `>{((t as any).loans.history?.concept || 'Concepto')}</th>`);
code = code.replace(/>Monto<\/th>/g, `>{((t as any).loans.history?.amount || 'Monto')}</th>`);
code = code.replace(/Acciones<\/th>/g, `{((t as any).loans.history?.actions || 'Acciones')}</th>`);
code = code.replace(/'Abono Recibido'/g, `((t as any).loans.history?.paymentReceived || 'Abono Recibido')`);

fs.writeFileSync('components/Loans.tsx', code, 'utf8');

console.log('Fixed extra translations in Loans.tsx');
