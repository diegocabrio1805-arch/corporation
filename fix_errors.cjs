const fs = require('fs');

// 1. FIX TRANSLATIONS.TS DUPLICATES
const tFile = 'c:\\\\Users\\\\Usuario\\\\.antigravity\\\\cobros\\\\utils\\\\translations.ts';
let tContent = fs.readFileSync(tFile, 'utf8');

// The duplicate properties look like:
//       publicPhone: 'TEL. PUBLICO',
//       companyId: 'ID EMPRESA',
//       account: 'CUENTA',
//       balance: 'SALDO',
//       publicPhone: 'TEL. PUBLICO',
//       companyId: 'ID EMPRESA',
//       account: 'CUENTA',
// Let's just restore from scratch using the same receiptES etc logic, or just regex the duplicates out.

tContent = tContent.replace(/publicPhone: 'TEL. PUBLICO',\s*companyId: 'ID EMPRESA',\s*account: 'CUENTA',\s*balance: 'SALDO',\s*publicPhone: 'TEL. PÚBLICO',\s*companyId: 'ID EMPRESA',\s*account: 'CONTA',/g, 
  "balance: 'SALDO',\n      publicPhone: 'TEL. PUBLICO',\n      companyId: 'ID EMPRESA',\n      account: 'CUENTA',");

// Wait, the easiest way to fix translations.ts is to use a cleaner regex or just replace the whole receipt block again with the new strings.
// But we already have fix_receipt_trans.cjs which writes the blocks perfectly! I'll just edit that script and re-run it.
// Let's modify the fix_receipt_trans.cjs file to include the new keys and run it!

const newReceiptES = `receipt: {
      successMsg: '¡GESTIÓN EXITOSA!',
      viewTitle: 'VISTA DE COMPROBANTE',
      finish: 'Finalizar y Salir',
      reprint: 'Re-imprimir Ticket',
      sendWhatsapp: 'Enviar por WhatsApp (PDF)',
      sendPhoto: 'Enviar Foto de Recibo',
      client: 'CLIENTE',
      date: 'FECHA',
      time: 'HORA',
      method: 'MÉTODO',
      transfer: 'TRANSFERENCIA',
      cash: 'EFECTIVO',
      amount: 'MONTO',
      installment: 'CUOTA',
      term: 'PLAZO',
      prevBalance: 'SALDO ANTERIOR',
      payment: 'ABONO',
      currentBalance: 'SALDO ACTUAL',
      paidInstallments: 'CUOTAS PAGADAS',
      totalInstallments: 'CUOTAS TOTALES',
      pending: 'PENDIENTE',
      startDate: 'FECHA DE INICIO',
      expiryDate: 'FECHA DE VENCIMIENTO',
      daysOverdue: 'DÍAS DE MORA',
      days: 'días',
      accountState: 'ESTADO DE CUENTA',
      thanks: 'GRACIAS POR SU PAGO',
      notification: 'NOTIFICACIÓN',
      balance: 'SALDO',
      publicPhone: 'TEL. PUBLICO',
      companyId: 'ID EMPRESA',
      account: 'CUENTA',
      generatingPdf: 'GENERANDO PDF...',
      generatingPhoto: 'GENERANDO FOTO...'
    }`;

const newReceiptEN = newReceiptES.replace(/'¡GESTIÓN EXITOSA!'/, "'SUCCESSFUL MANAGEMENT!'").replace(/'VISTA DE COMPROBANTE'/, "'RECEIPT PREVIEW'").replace(/'Finalizar y Salir'/, "'Finish and Exit'").replace(/'Re-imprimir Ticket'/, "'Re-print Ticket'").replace(/'Enviar por WhatsApp \(PDF\)'/, "'Send via WhatsApp (PDF)'").replace(/'Enviar Foto de Recibo'/, "'Send Receipt Photo'").replace(/'CLIENTE'/, "'CLIENT'").replace(/'FECHA'/, "'DATE'").replace(/'HORA'/, "'TIME'").replace(/'MÉTODO'/, "'METHOD'").replace(/'TRANSFERENCIA'/, "'TRANSFER'").replace(/'EFECTIVO'/, "'CASH'").replace(/'MONTO'/, "'AMOUNT'").replace(/'CUOTA'/, "'INSTALLMENT'").replace(/'PLAZO'/, "'TERM'").replace(/'SALDO ANTERIOR'/, "'PREVIOUS BALANCE'").replace(/'ABONO'/, "'PAYMENT'").replace(/'SALDO ACTUAL'/, "'CURRENT BALANCE'").replace(/'CUOTAS PAGADAS'/, "'PAID INSTALLMENTS'").replace(/'CUOTAS TOTALES'/, "'TOTAL INSTALLMENTS'").replace(/'PENDIENTE'/, "'PENDING'").replace(/'FECHA DE INICIO'/, "'START DATE'").replace(/'FECHA DE VENCIMIENTO'/, "'EXPIRY DATE'").replace(/'DÍAS DE MORA'/, "'DAYS OVERDUE'").replace(/'días'/, "'days'").replace(/'ESTADO DE CUENTA'/, "'ACCOUNT STATEMENT'").replace(/'GRACIAS POR SU PAGO'/, "'THANK YOU FOR YOUR PAYMENT'").replace(/'NOTIFICACIÓN'/, "'NOTIFICATION'").replace(/'SALDO'/, "'BALANCE'").replace(/'TEL. PUBLICO'/, "'PUBLIC PHONE'").replace(/'ID EMPRESA'/, "'COMPANY ID'").replace(/'CUENTA'/, "'ACCOUNT'").replace(/'GENERANDO PDF...'/, "'GENERATING PDF...'").replace(/'GENERANDO FOTO...'/, "'GENERATING PHOTO...'");

const newReceiptFR = newReceiptES.replace(/'¡GESTIÓN EXITOSA!'/, "'GESTION RÉUSSIE !'").replace(/'VISTA DE COMPROBANTE'/, "'APERÇU DU REÇU'").replace(/'Finalizar y Salir'/, "'Terminer et Quitter'").replace(/'Re-imprimir Ticket'/, "'Ré-imprimer le Ticket'").replace(/'Enviar por WhatsApp \(PDF\)'/, "'Envoyer par WhatsApp (PDF)'").replace(/'Enviar Foto de Recibo'/, "'Envoyer Photo du Reçu'").replace(/'CLIENTE'/, "'CLIENT'").replace(/'FECHA'/, "'DATE'").replace(/'HORA'/, "'HEURE'").replace(/'MÉTODO'/, "'MÉTHODE'").replace(/'TRANSFERENCIA'/, "'TRANSFERT'").replace(/'EFECTIVO'/, "'ESPÈCES'").replace(/'MONTO'/, "'MONTANT'").replace(/'CUOTA'/, "'ÉCHÉANCE'").replace(/'PLAZO'/, "'DURÉE'").replace(/'SALDO ANTERIOR'/, "'SOLDE PRÉCÉDENT'").replace(/'ABONO'/, "'PAIEMENT'").replace(/'SALDO ACTUAL'/, "'SOLDE ACTUEL'").replace(/'CUOTAS PAGADAS'/, "'ÉCHÉANCES PAYÉES'").replace(/'CUOTAS TOTALES'/, "'ÉCHÉANCES TOTALES'").replace(/'PENDIENTE'/, "'EN ATTENTE'").replace(/'FECHA DE INICIO'/, "'DATE DE DÉBUT'").replace(/'FECHA DE VENCIMIENTO'/, "'DATE D\\'EXPIRATION'").replace(/'DÍAS DE MORA'/, "'JOURS DE RETARD'").replace(/'días'/, "'jours'").replace(/'ESTADO DE CUENTA'/, "'RELEVÉ DE COMPTE'").replace(/'GRACIAS POR SU PAGO'/, "'MERCI POUR VOTRE PAIEMENT'").replace(/'NOTIFICACIÓN'/, "'NOTIFICATION'").replace(/'SALDO'/, "'SOLDE'").replace(/'TEL. PUBLICO'/, "'TÉL. PUBLIC'").replace(/'ID EMPRESA'/, "'ID ENTREPRISE'").replace(/'CUENTA'/, "'COMPTE'").replace(/'GENERANDO PDF...'/, "'GÉNÉRATION PDF...'").replace(/'GENERANDO FOTO...'/, "'GÉNÉRATION PHOTO...'");

const newReceiptPT = newReceiptES.replace(/'¡GESTIÓN EXITOSA!'/, "'GESTÃO BEM-SUCEDIDA!'").replace(/'VISTA DE COMPROBANTE'/, "'VISUALIZAÇÃO DE RECIBO'").replace(/'Finalizar y Salir'/, "'Finalizar e Sair'").replace(/'Re-imprimir Ticket'/, "'Re-imprimir Ticket'").replace(/'Enviar por WhatsApp \(PDF\)'/, "'Enviar por WhatsApp (PDF)'").replace(/'Enviar Foto de Recibo'/, "'Enviar Foto do Recibo'").replace(/'CLIENTE'/, "'CLIENTE'").replace(/'FECHA'/, "'DATA'").replace(/'HORA'/, "'HORA'").replace(/'MÉTODO'/, "'MÉTODO'").replace(/'TRANSFERENCIA'/, "'TRANSFERÊNCIA'").replace(/'EFECTIVO'/, "'DINHEIRO'").replace(/'MONTO'/, "'MONTANTE'").replace(/'CUOTA'/, "'PARCELA'").replace(/'PLAZO'/, "'PRAZO'").replace(/'SALDO ANTERIOR'/, "'SALDO ANTERIOR'").replace(/'ABONO'/, "'PAGAMENTO'").replace(/'SALDO ACTUAL'/, "'SALDO ATUAL'").replace(/'CUOTAS PAGADAS'/, "'PARCELAS PAGAS'").replace(/'CUOTAS TOTALES'/, "'PARCELAS TOTAIS'").replace(/'PENDIENTE'/, "'PENDENTE'").replace(/'FECHA DE INICIO'/, "'DATA DE INÍCIO'").replace(/'FECHA DE VENCIMIENTO'/, "'DATA DE VENCIMENTO'").replace(/'DÍAS DE MORA'/, "'DIAS EM ATRASO'").replace(/'días'/, "'dias'").replace(/'ESTADO DE CUENTA'/, "'EXTRATO DE CONTA'").replace(/'GRACIAS POR SU PAGO'/, "'OBRIGADO PELO SEU PAGAMENTO'").replace(/'NOTIFICACIÓN'/, "'NOTIFICAÇÃO'").replace(/'SALDO'/, "'SALDO'").replace(/'TEL. PUBLICO'/, "'TEL. PÚBLICO'").replace(/'ID EMPRESA'/, "'ID EMPRESA'").replace(/'CUENTA'/, "'CONTA'").replace(/'GENERANDO PDF...'/, "'GERANDO PDF...'").replace(/'GENERANDO FOTO...'/, "'GERANDO FOTO...'");

// Find all receipt: { ... } blocks
let count = 0;
tContent = tContent.replace(/receipt:\s*\{[\s\S]*?generatingPhoto:\s*'[^']+'\s*\}/g, (match) => {
  if (count === 0) { count++; return newReceiptES; }
  if (count === 1) { count++; return newReceiptEN; }
  if (count === 2) { count++; return newReceiptFR; }
  if (count === 3) { count++; return newReceiptPT; }
  return match;
});

fs.writeFileSync(tFile, tContent);

// 2. FIX MOBILECOLLECTORMODE.TSX t IMPORT
const mFile = 'c:\\\\Users\\\\Usuario\\\\.antigravity\\\\cobros\\\\components\\\\MobileCollectorMode.tsx';
let mContent = fs.readFileSync(mFile, 'utf8');

// Let's replace '((t as any).receipt?.finish) ||' with 'Finalizar y Salir' inside MobileCollectorMode since it doesn't have t.
// Wait, we CAN use getTranslation in MobileCollectorMode!
if (!mContent.includes("import { getTranslation }")) {
  mContent = mContent.replace("import { useAppContext }", "import { useAppContext } from '../context/AppContext';\nimport { getTranslation }");
}

if (!mContent.includes("const t = getTranslation")) {
  mContent = mContent.replace("const { state", "const { state, dispatch } = useAppContext();\n  const t = getTranslation((state.settings as any).language || 'es') as any;\n  // const { state");
}

// Ensure the buttons in MobileCollectorMode are translated.
mContent = mContent.replace(
  />\s*Finalizar y Salir\s*</g,
  `>{((t as any).receipt?.finish) || 'Finalizar y Salir'}<`
);
mContent = mContent.replace(
  /<\/i>\s*Re-Imprimir Ticket/g,
  `</i> {((t as any).receipt?.reprint) || 'Re-Imprimir Ticket'}`
);

fs.writeFileSync(mFile, mContent);
console.log('Fixed translations and MobileCollectorMode');
