const fs = require('fs');
const file = 'c:\\\\Users\\\\Usuario\\\\.antigravity\\\\cobros\\\\utils\\\\helpers.ts';
let content = fs.readFileSync(file, 'utf8');

// Add import if missing
if (!content.includes("import { getTranslation }")) {
  content = content.replace("import { v4", "import { getTranslation } from './translations';\nimport { v4");
}

const newGenerateReceipt = `export const generateReceiptText = (data: ReceiptData, settings: AppSettings) => {
  const t = getTranslation((settings as any).language || 'es') as any;
  const format = (text: string, bold?: boolean, size?: 'normal' | 'medium' | 'large') => {
    let result = text;
    if (bold) result = \`<B1>\${result}<B0>\`;
    if (size === 'large') result = \`<GS1>\${result}<GS0>\`;
    if (size === 'medium') result = \`<GS2>\${result}<GS0>\`;
    return result;
  };

  const currencySymbol = settings.currencySymbol || '$';

  // FIX: Force fallback to settings if manual overrides are empty strings or spaces
  const rawManualName = (data.companyNameManual || '').trim();
  const companyRaw = rawManualName ? rawManualName : (settings.companyName || 'ANEXO COBRO');
  const company = format(companyRaw.toUpperCase(), settings.companyNameBold, settings.companyNameSize);

  const rawManualAlias = (data.companyAliasManual || '').trim();
  const alias = (rawManualAlias ? rawManualAlias : (settings.companyAlias || '')).toUpperCase();

  const contactLabel = (data.contactLabelManual || '').trim() ? data.contactLabelManual : "TEL. PUBLICO";
  const rawManualPhone = (data.contactPhoneManual || '').trim();
  let phone = rawManualPhone ? rawManualPhone : (settings.contactPhone || '---');
  if (phone === '---' && settings.contactPhone) phone = settings.contactPhone;
  const formattedPhone = format(phone, settings.contactPhoneBold);

  const idLabel = (data.companyIdentifierLabelManual || '').trim() ? data.companyIdentifierLabelManual : (t.receipt?.accountState || "ESTADO DE CUENTA");
  const rawManualId = (data.companyIdentifierManual || '').trim();
  let idVal = rawManualId ? rawManualId : (settings.companyIdentifier || '---');
  if (idVal === '---' && settings.companyIdentifier) idVal = settings.companyIdentifier;
  const idValue = format(idVal, settings.companyIdentifierBold);

  const rawManualShareLabel = (data.shareLabelManual || '').trim();
  const bankLabel = (rawManualShareLabel ? rawManualShareLabel : (settings.shareLabel || (t.receipt?.bank || 'BANCO'))).toUpperCase();

  const rawManualShareVal = (data.shareValueManual || '').trim();
  let bankVal = rawManualShareVal ? rawManualShareVal : (settings.shareValue || '');
  if ((!bankVal || bankVal === '---') && settings.shareValue) bankVal = settings.shareValue;
  const bankValue = format(bankVal.toUpperCase(), settings.shareValueBold, settings.shareValueSize);

  const supportLabel = "TEL. PUBLICO";
  const rawManualSupport = (data.supportPhoneManual || '').trim();
  let supportVal = rawManualSupport ? rawManualSupport : (settings.contactPhone || '');
  if ((!supportVal || supportVal === '---') && settings.contactPhone) supportVal = settings.contactPhone;
  const supportValue = format(supportVal, settings.contactPhoneBold);

  const dateTime = data.fullDateTimeManual || formatFullDateTime(settings.country);
  const [datePart, timePart] = dateTime.split(',');

  const remainingInst = Math.max(0, data.totalInstallments - Math.floor(data.paidInstallments));

  const pendingInstallmentText = () => {
    if (data.installmentValue && data.totalPaidAmount !== undefined) {
      const progress = data.totalPaidAmount / data.installmentValue;
      const exactRemainder = data.totalPaidAmount % data.installmentValue;
      if (exactRemainder > 0 && Math.floor(progress) < data.totalInstallments) {
        const pendingAmount = data.installmentValue - exactRemainder;
        const nextInstallmentNum = Math.floor(progress) + 1;
        return \`\\n\${t.receipt?.pending || 'PENDIENTE'} \${currencySymbol}\${pendingAmount.toLocaleString('es-CO').replace(/,/g, '.')}  /  \${nextInstallmentNum}\`;
      }
    }
    return '';
  };

  let displayedPaidInstallments = data.paidInstallments;
  if (data.installmentValue && data.totalPaidAmount !== undefined) {
    const fullInstallments = Math.floor(data.totalPaidAmount / data.installmentValue);
    const fraction = (data.totalPaidAmount % data.installmentValue) / data.installmentValue;

    let decimalPart = 0;
    if (fraction > 0) {
      decimalPart = Math.floor(fraction * 10) / 10;
      if (decimalPart === 0) decimalPart = 0.1;
      if (decimalPart > 0.9) decimalPart = 0.9;
    }

    // Override the raw calculation with the precise decimal scale
    displayedPaidInstallments = fullInstallments + decimalPart;
  }

  // Formatting for the new "MONTO, CUOTA, PLAZO" block
  const montoStr = data.principal ? data.principal.toLocaleString('es-CO').replace(/,/g, '.') : '---';
  const cuotaStr = data.installmentValue ? data.installmentValue.toLocaleString('es-CO').replace(/,/g, '.') : '---';
  const plazoStr = \`\${data.totalInstallments} \${data.frequency || ''}\`.toUpperCase().trim();

  const bankBlock = (bankVal && bankVal !== '---')
    ? \`\\n\${bankLabel}\\n\${bankLabel.includes('CUENTA') ? 'NUMERO' : 'CUENTA'}: \${bankValue}\\n===============================\`
    : '';

  return \`
\${company}
\${alias ? alias : ''}
===============================\${bankBlock}
\${t.receipt?.client || 'CLIENTE'}: \${data.clientName.toUpperCase()}
\${t.receipt?.date || 'FECHA'}: \${datePart ? datePart.trim() : dateTime}
\${t.receipt?.time || 'HORA'}: \${timePart ? timePart.trim() : '---'}
\${t.receipt?.method || 'METODO'}: \${data.isVirtual ? (t.receipt?.transfer || 'TRANSFERENCIA') : (t.receipt?.cash || 'EFECTIVO')}
===============================
\${t.receipt?.amount || 'MONTO'}: \${montoStr}
\${t.receipt?.installment || 'CUOTA'}: \${cuotaStr}
\${t.receipt?.term || 'PLAZO'}: \${plazoStr}
===============================
\${t.receipt?.prevBalance || 'SALDO ANTERIOR'}: \${currencySymbol}\${data.previousBalance.toLocaleString('es-CO').replace(/,/g, '.')}
\${t.receipt?.payment || 'ABONO'}: \${currencySymbol}\${data.amountPaid.toLocaleString('es-CO').replace(/,/g, '.')}
\${t.receipt?.currentBalance || 'SALDO ACTUAL'}: \${currencySymbol}\${data.remainingBalance.toLocaleString('es-CO').replace(/,/g, '.')}
===============================
\${t.receipt?.paidInstallments || 'CUOTAS PAGADAS'}: \${displayedPaidInstallments}
\${t.receipt?.totalInstallments || 'CUOTAS TOTALES'}: \${data.totalInstallments}\${pendingInstallmentText()}
===============================
\${t.receipt?.startDate || 'FECHA DE INICIO'}: \${formatDate(data.startDate)}
\${t.receipt?.expiryDate || 'FECHA DE VENCIMIENTO'}: \${formatDate(data.expiryDate)}
\${t.receipt?.daysOverdue || 'DIAS DE MORA'}: \${data.daysOverdue} \${t.receipt?.days || 'dias'}
===============================
\${contactLabel}: \${formattedPhone}
\${idLabel}
===============================
\${t.receipt?.thanks || 'GRACIAS POR SU PAGO'}
\`;
};`;

const oldGenerateReceiptStart = `export const generateReceiptText = (data: ReceiptData, settings: AppSettings) => {`;
const startIdx = content.indexOf(oldGenerateReceiptStart);
if (startIdx !== -1) {
  const endIdx = content.indexOf(`};`, startIdx) + 2;
  content = content.substring(0, startIdx) + newGenerateReceipt + content.substring(endIdx);
}

const newNoPaymentReceipt = `export const generateNoPaymentReceiptText = (data: ReceiptData, settings: AppSettings) => {
  const t = getTranslation((settings as any).language || 'es') as any;
  const company = settings.companyName || 'ANEXO COBRO';
  const currencySymbol = settings.currencySymbol || '$';
  return \`
===============================
       \${t.receipt?.notification || 'NOTIFICACION'}
===============================
\${t.receipt?.client || 'CLIENTE'}: \${data.clientName}
\${t.receipt?.date || 'FECHA'}: \${formatFullDateTime(settings.country)}
\${t.receipt?.balance || 'SALDO'}: \${currencySymbol}\${data.remainingBalance.toLocaleString('es-CO')}
===============================
\`;
};`;

const oldNoPaymentStart = `export const generateNoPaymentReceiptText = (data: ReceiptData, settings: AppSettings) => {`;
const startIdx2 = content.indexOf(oldNoPaymentStart);
if (startIdx2 !== -1) {
  const endIdx2 = content.indexOf(`};`, startIdx2) + 2;
  content = content.substring(0, startIdx2) + newNoPaymentReceipt + content.substring(endIdx2);
}

fs.writeFileSync(file, content);
console.log('Helpers updated successfully.');
