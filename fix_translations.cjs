const fs = require('fs');
let content = fs.readFileSync('utils/translations.ts', 'utf8');

const additions = {
  es: { linkPrinterTitle: "Vincular Impresora", searchLinkedBtn: "BUSCAR VINCULADOS", noDevicesFound: "No se encontraron dispositivos", printerBluetoothHint: "Asegúrate de haber vinculado tu impresora en los ajustes de Bluetooth del celular.", unknownDevice: "Desconocido" },
  en: { linkPrinterTitle: "Link Printer", searchLinkedBtn: "SEARCH PAIRED", noDevicesFound: "No devices found", printerBluetoothHint: "Make sure you have paired your printer in your phone's Bluetooth settings.", unknownDevice: "Unknown" },
  pt: { linkPrinterTitle: "Vincular Impressora", searchLinkedBtn: "BUSCAR PAREADOS", noDevicesFound: "Nenhum dispositivo encontrado", printerBluetoothHint: "Certifique-se de ter pareado sua impressora nas configurações de Bluetooth do seu celular.", unknownDevice: "Desconhecido" },
  fr: { linkPrinterTitle: "Lier une Imprimante", searchLinkedBtn: "CHERCHER LES ASSOCIÉS", noDevicesFound: "Aucun appareil trouvé", printerBluetoothHint: "Assurez-vous d'avoir associé votre imprimante dans les paramètres Bluetooth de votre téléphone.", unknownDevice: "Inconnu" }
};

const generatorTranslations = {
  es: { title: "Generador de Pagarés", subtitle: "v1.1.0 Pro Standalone", history: "Historial", templates: "Plantillas", search: "Buscar...", noTemplates: "Sin plantillas", saveAsTemplateTip: "Guarda el texto actual como plantilla para verlo aquí.", myTemplates: "Mis Plantillas", manageTemplates: "Gestionar Plantillas", promissoryNote: "Pagaré", receipt: "Recibo", manual: "Manual", principalAmount: "Monto Principal", amountInWordsPrefix: "SON", documentDates: "Fechas del Documento", issueDate: "Fecha Emisión", dueDate: "Fecha Vencimiento", folioRef: "Número de Folio / Referencia", debtorName: "Nombre del Deudor", payerName: "De (Nombre Pagador)", ejJuan: "EJ: JUAN PÉREZ", documentId: "Cédula / Documento", ejDoc: "EJ: 4.567.890", beneficiaryName: "Nombre del Beneficiario", receiverName: "Para (Nombre Quien Recibe)", ejBeneficiary: "EJ: PRESTAMASTER", concept: "Concepto / Motivo", ejConcept: "EJ: PRESTAMO PERSONAL", documentRedaction: "Redacción del Documento", saveAsTemplate: "Guardar como Plantilla", redactHere: "Redacte el contenido aquí...", generatePdf: "Generar PDF", printTicket: "Imprimir Ticket", paperA4: "Papel A4", paperOficio: "Papel Oficio", paperThermal: "Térmico 58mm", thermal: "Térmico", oficio: "Oficio", a4: "A4" },
  en: { title: "Promissory Note Generator", subtitle: "v1.1.0 Pro Standalone", history: "History", templates: "Templates", search: "Search...", noTemplates: "No templates", saveAsTemplateTip: "Save the current text as a template to see it here.", myTemplates: "My Templates", manageTemplates: "Manage Templates", promissoryNote: "Promissory Note", receipt: "Receipt", manual: "Manual", principalAmount: "Principal Amount", amountInWordsPrefix: "SUM", documentDates: "Document Dates", issueDate: "Issue Date", dueDate: "Due Date", folioRef: "Folio Number / Reference", debtorName: "Debtor Name", payerName: "From (Payer Name)", ejJuan: "EX: JOHN DOE", documentId: "ID / Document", ejDoc: "EX: 1.234.567", beneficiaryName: "Beneficiary Name", receiverName: "To (Receiver Name)", ejBeneficiary: "EX: LOANMASTER", concept: "Concept / Reason", ejConcept: "EX: PERSONAL LOAN", documentRedaction: "Document Redaction", saveAsTemplate: "Save as Template", redactHere: "Draft content here...", generatePdf: "Generate PDF", printTicket: "Print Ticket", paperA4: "A4 Paper", paperOficio: "Legal Paper", paperThermal: "Thermal 58mm", thermal: "Thermal", oficio: "Legal", a4: "A4" },
  pt: { title: "Gerador de Notas Promissórias", subtitle: "v1.1.0 Pro Standalone", history: "Histórico", templates: "Modelos", search: "Buscar...", noTemplates: "Sem modelos", saveAsTemplateTip: "Salve o texto atual como modelo para vê-lo aqui.", myTemplates: "Meus Modelos", manageTemplates: "Gerenciar Modelos", promissoryNote: "Nota Promissória", receipt: "Recibo", manual: "Manual", principalAmount: "Valor Principal", amountInWordsPrefix: "SÃO", documentDates: "Datas do Documento", issueDate: "Data de Emissão", dueDate: "Data de Vencimento", folioRef: "Número do Folio / Referência", debtorName: "Nome do Devedor", payerName: "De (Nome do Pagador)", ejJuan: "EX: JOÃO SILVA", documentId: "RG / Documento", ejDoc: "EX: 1.234.567", beneficiaryName: "Nome do Beneficiário", receiverName: "Para (Nome do Recebedor)", ejBeneficiary: "EX: EMPRESTAMASTER", concept: "Conceito / Motivo", ejConcept: "EX: EMPRÉSTIMO PESSOAL", documentRedaction: "Redação do Documento", saveAsTemplate: "Salvar como Modelo", redactHere: "Redija o conteúdo aqui...", generatePdf: "Gerar PDF", printTicket: "Imprimir Ticket", paperA4: "Papel A4", paperOficio: "Papel Ofício", paperThermal: "Térmico 58mm", thermal: "Térmico", oficio: "Ofício", a4: "A4" },
  fr: { title: "Générateur de Billets à Ordre", subtitle: "v1.1.0 Pro Autonome", history: "Historique", templates: "Modèles", search: "Chercher...", noTemplates: "Aucun modèle", saveAsTemplateTip: "Enregistrez le texte actuel comme modèle pour le voir ici.", myTemplates: "Mes Modèles", manageTemplates: "Gérer les Modèles", promissoryNote: "Billet à Ordre", receipt: "Reçu", manual: "Manuel", principalAmount: "Montant Principal", amountInWordsPrefix: "SONT", documentDates: "Dates du Document", issueDate: "Date d'Émission", dueDate: "Date d'Échéance", folioRef: "Numéro de Folio / Référence", debtorName: "Nom du Débiteur", payerName: "De (Nom du Payeur)", ejJuan: "EX : JEAN DUPONT", documentId: "Carte d'Identité / Document", ejDoc: "EX : 1.234.567", beneficiaryName: "Nom du Bénéficiaire", receiverName: "À (Nom du Destinataire)", ejBeneficiary: "EX : PRESTAMASTER", concept: "Concept / Motif", ejConcept: "EX : PRÊT PERSONNEL", documentRedaction: "Rédaction du Document", saveAsTemplate: "Enregistrer comme Modèle", redactHere: "Rédigez le contenu ici...", generatePdf: "Générer PDF", printTicket: "Imprimer un Ticket", paperA4: "Papier A4", paperOficio: "Papier Légal", paperThermal: "Thermique 58mm", thermal: "Thermique", oficio: "Légal", a4: "A4" }
};

const saveAndExitMap = {
  es: "saveAndExit: 'GUARDAR Y SALIR'",
  en: "saveAndExit: 'SAVE AND EXIT'",
  pt: "saveAndExit: 'SALVAR E SAIR'",
  fr: "saveAndExit: 'ENREGISTRER ET QUITTER'"
};

for (const lang of ['es', 'en', 'pt', 'fr']) {
  const langIndex = content.indexOf(`  ${lang}: {`);
  if (langIndex !== -1) {
    const settingsPageIndex = content.indexOf(`    settingsPage: {`, langIndex);
    if (settingsPageIndex !== -1) {
      const saveAndExitStr = saveAndExitMap[lang];
      const saveAndExitIndex = content.indexOf(saveAndExitStr, settingsPageIndex);
      
      if (saveAndExitIndex !== -1) {
        // Find the closing brace of settingsPage
        const closingBraceIndex = content.indexOf(`    },`, saveAndExitIndex);
        
        if (closingBraceIndex !== -1) {
          const printerKeys = Object.entries(additions[lang]).map(([k, v]) => `      ${k}: "${v.replace(/"/g, '\\"')}",\n`).join('');
          const generatorStr = `\n    generator: {\n` + Object.entries(generatorTranslations[lang]).map(([k, v]) => `      ${k}: "${v.replace(/"/g, '\\"')}"`).join(',\n') + `\n    },`;
          
          // Inject printerKeys right before saveAndExitStr
          content = content.slice(0, saveAndExitIndex) + printerKeys + '      ' + content.slice(saveAndExitIndex, closingBraceIndex + 6) + generatorStr + '\n' + content.slice(closingBraceIndex + 6);
          console.log(`Updated ${lang}`);
        } else {
          console.log(`Failed to find closing brace for ${lang}`);
        }
      } else {
        console.log(`Failed to find saveAndExit for ${lang}`);
      }
    } else {
      console.log(`Failed to find settingsPage for ${lang}`);
    }
  } else {
    console.log(`Failed to find lang block for ${lang}`);
  }
}

fs.writeFileSync('utils/translations.ts', content, 'utf8');
console.log('Translations updated cleanly.');
