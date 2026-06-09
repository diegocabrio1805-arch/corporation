const fs = require('fs');
const file = 'c:\\\\Users\\\\Usuario\\\\.antigravity\\\\cobros\\\\utils\\\\translations.ts';
let content = fs.readFileSync(file, 'utf8');

const receiptES = `receipt: {
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
      generatingPdf: 'GENERANDO PDF...',
      generatingPhoto: 'GENERANDO FOTO...'
    }`;

const receiptEN = `receipt: {
      successMsg: 'SUCCESSFUL MANAGEMENT!',
      viewTitle: 'RECEIPT PREVIEW',
      finish: 'Finish and Exit',
      reprint: 'Re-print Ticket',
      sendWhatsapp: 'Send via WhatsApp (PDF)',
      sendPhoto: 'Send Receipt Photo',
      client: 'CLIENT',
      date: 'DATE',
      time: 'TIME',
      method: 'METHOD',
      transfer: 'TRANSFER',
      cash: 'CASH',
      amount: 'AMOUNT',
      installment: 'INSTALLMENT',
      term: 'TERM',
      prevBalance: 'PREVIOUS BALANCE',
      payment: 'PAYMENT',
      currentBalance: 'CURRENT BALANCE',
      paidInstallments: 'PAID INSTALLMENTS',
      totalInstallments: 'TOTAL INSTALLMENTS',
      pending: 'PENDING',
      startDate: 'START DATE',
      expiryDate: 'EXPIRY DATE',
      daysOverdue: 'DAYS OVERDUE',
      days: 'days',
      accountState: 'ACCOUNT STATEMENT',
      thanks: 'THANK YOU FOR YOUR PAYMENT',
      notification: 'NOTIFICATION',
      balance: 'BALANCE',
      generatingPdf: 'GENERATING PDF...',
      generatingPhoto: 'GENERATING PHOTO...'
    }`;

const receiptFR = `receipt: {
      successMsg: 'GESTION RÉUSSIE !',
      viewTitle: 'APERÇU DU REÇU',
      finish: 'Terminer et Quitter',
      reprint: 'Ré-imprimer le Ticket',
      sendWhatsapp: 'Envoyer par WhatsApp (PDF)',
      sendPhoto: 'Envoyer Photo du Reçu',
      client: 'CLIENT',
      date: 'DATE',
      time: 'HEURE',
      method: 'MÉTHODE',
      transfer: 'TRANSFERT',
      cash: 'ESPÈCES',
      amount: 'MONTANT',
      installment: 'ÉCHÉANCE',
      term: 'DURÉE',
      prevBalance: 'SOLDE PRÉCÉDENT',
      payment: 'PAIEMENT',
      currentBalance: 'SOLDE ACTUEL',
      paidInstallments: 'ÉCHÉANCES PAYÉES',
      totalInstallments: 'ÉCHÉANCES TOTALES',
      pending: 'EN ATTENTE',
      startDate: 'DATE DE DÉBUT',
      expiryDate: 'DATE D\\'EXPIRATION',
      daysOverdue: 'JOURS DE RETARD',
      days: 'jours',
      accountState: 'RELEVÉ DE COMPTE',
      thanks: 'MERCI POUR VOTRE PAIEMENT',
      notification: 'NOTIFICATION',
      balance: 'SOLDE',
      generatingPdf: 'GÉNÉRATION PDF...',
      generatingPhoto: 'GÉNÉRATION PHOTO...'
    }`;

const receiptPT = `receipt: {
      successMsg: 'GESTÃO BEM-SUCEDIDA!',
      viewTitle: 'VISUALIZAÇÃO DE RECIBO',
      finish: 'Finalizar e Sair',
      reprint: 'Re-imprimir Ticket',
      sendWhatsapp: 'Enviar por WhatsApp (PDF)',
      sendPhoto: 'Enviar Foto do Recibo',
      client: 'CLIENTE',
      date: 'DATA',
      time: 'HORA',
      method: 'MÉTODO',
      transfer: 'TRANSFERÊNCIA',
      cash: 'DINHEIRO',
      amount: 'MONTANTE',
      installment: 'PARCELA',
      term: 'PRAZO',
      prevBalance: 'SALDO ANTERIOR',
      payment: 'PAGAMENTO',
      currentBalance: 'SALDO ATUAL',
      paidInstallments: 'PARCELAS PAGAS',
      totalInstallments: 'PARCELAS TOTAIS',
      pending: 'PENDENTE',
      startDate: 'DATA DE INÍCIO',
      expiryDate: 'DATA DE VENCIMENTO',
      daysOverdue: 'DIAS EM ATRASO',
      days: 'dias',
      accountState: 'EXTRATO DE CONTA',
      thanks: 'OBRIGADO PELO SEU PAGAMENTO',
      notification: 'NOTIFICAÇÃO',
      balance: 'SALDO',
      generatingPdf: 'GERANDO PDF...',
      generatingPhoto: 'GERANDO FOTO...'
    }`;

const regex = /receipt: \{[\s\S]*?generatingPhoto: '[^']+'\s*\}/g;

let count = 0;
content = content.replace(regex, (match) => {
  if (count === 0) { count++; return receiptES; }
  if (count === 1) { count++; return receiptEN; }
  if (count === 2) { count++; return receiptFR; }
  if (count === 3) { count++; return receiptPT; }
  return match;
});

fs.writeFileSync(file, content);
console.log('Fixed receipt translations! Replaced: ' + count);
