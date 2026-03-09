import { v4 as uuidv4 } from 'uuid';
import { Client, Loan, CollectionLog, AppSettings, CountryCode, Frequency, LoanStatus, CollectionLogType, PaymentStatus } from '../types';

export const generateUUID = (): string => {
  return uuidv4();
};

const safeParseDate = (dateStr: any): Date | null => {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (!isNaN(d.getTime())) return d;

  // Try YYYY-MM-DD format manually if needed
  if (typeof dateStr === 'string' && dateStr.includes('-')) {
    const [y, m, d_part] = dateStr.split('T')[0].split('-').map(Number);
    const local = new Date(y, m - 1, d_part);
    if (!isNaN(local.getTime())) return local;
  }
  return null;
};

const getProp = (obj: any, camel: string, snake: string) => {
  if (!obj) return undefined;
  return obj[camel] !== undefined ? obj[camel] : obj[snake];
};

const isPaidStatus = (status: any) => {
  if (!status) return false;
  const s = String(status).toLowerCase();
  return s === 'pagado' || s === 'paid' || s === PaymentStatus.PAID.toLowerCase();
};

export const getLocalDateStringForCountry = (country: string = 'CO', date: Date | null = null): string => {
  const targetDate = date || new Date();
  const options: Intl.DateTimeFormatOptions = {
    timeZone: country === 'PY' ? 'America/Asuncion' : 'America/Bogota',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  };
  // Forzamos formato YYYY-MM-DD usando Intl de forma segura
  const parts = new Intl.DateTimeFormat('en-GB', options).formatToParts(targetDate);
  const day = parts.find(p => p.type === 'day')?.value;
  const month = parts.find(p => p.type === 'month')?.value;
  const year = parts.find(p => p.type === 'year')?.value;
  return `${year}-${month}-${day}`;
};

export const calculateTotalPaidFromLogs = (loanOrId: any, collectionLogs: any[]): number => {
  if (!loanOrId || !collectionLogs) return 0;

  const loanId = typeof loanOrId === 'string' ? loanOrId : (loanOrId.id || loanOrId.loan_id);
  const clientId = typeof loanOrId !== 'string' ? (loanOrId.clientId || loanOrId.client_id || null) : null;

  // Obtener todos los loan_ids válidos en la colección para detectar IDs fantasma
  const allKnownLoanIds = new Set(
    (Array.isArray(collectionLogs) ? collectionLogs : [])
      .map(l => String(l.loanId || l.loan_id || '').trim().toLowerCase())
      .filter(id => id.length > 0)
  );

  const validLogs = (Array.isArray(collectionLogs) ? collectionLogs : []).filter(log => {
    const logLoanId = String(log.loanId || log.loan_id || '').trim().toLowerCase();
    const lId = String(loanId || '').trim().toLowerCase();
    const logType = String(log.type || '').toUpperCase();
    const isOpening = log.isOpening || log.is_opening || false;
    const isDeleted = log.deletedAt || log.deleted_at;

    if (isDeleted) return false;
    if (!(logType === 'PAGO' || logType === CollectionLogType.PAYMENT)) return false;

    // Coincidencia directa por loan_id (caso normal)
    if (logLoanId === lId) return true;

    // FALLBACK: log apunta a un préstamo que NO existe en la tabla loans pero mismo cliente
    // Detecta pagos huérfanos registrados con un loan_id borrado/fantasma
    if (clientId) {
      const logClientId = String(log.clientId || log.client_id || '').trim().toLowerCase();
      const cId = String(clientId || '').trim().toLowerCase();
      if (logClientId === cId && logLoanId !== lId && logLoanId.length > 0) {
        // Solo recuperar si ese loan_id fantasma no es un préstamo distinto válido conocido
        // (evitar mezclar pagos de otro préstamo activo real del mismo cliente)
        const isGhostLoanId = !allKnownLoanIds.has(logLoanId) ||
          // Si aparece en logs pero no como un préstamo real (solo como ID huérfano)
          false;
        return isGhostLoanId;
      }
    }
    return false;
  });

  return validLogs.reduce((acc: number, log: any) => acc + (Number(log.amount) || 0), 0);
};

export const calculateMonthlyStats = (
  loans: Loan[],
  collectionLogs: CollectionLog[],
  month: number,
  year: number,
  collectorId?: string
) => {
  const activeLoans = (Array.isArray(loans) ? loans : []).filter(l => {
    const status = getProp(l, 'status', 'status');
    return status === LoanStatus.ACTIVE || status === 'Activo';
  });

  const filteredLoans = collectorId
    ? activeLoans.filter(l => {
      const cId = getProp(l, 'collectorId', 'collector_id');
      return cId === collectorId;
    })
    : activeLoans;

  let totalResponsibility = 0; // Lo que falta cobrar de cuotas vencidas y del mes actual
  const lastDayOfMonth = new Date(year, month + 1, 0, 23, 59, 59);

  filteredLoans.forEach(loan => {
    (Array.isArray(loan.installments) ? loan.installments : []).forEach(inst => {
      const dueDate = safeParseDate(inst.dueDate);
      if (!dueDate) return;

      if (dueDate <= lastDayOfMonth) {
        const instAmount = Number(inst.amount) || 0;
        const instPaid = Number(inst.paidAmount) || 0;
        const balance = Math.max(0, instAmount - instPaid);
        totalResponsibility += balance;
      }
    });
  });

  // Logs del mes para estadísticas de actividad
  const filteredLogs = (Array.isArray(collectionLogs) ? collectionLogs : []).filter(log => {
    const logDate = safeParseDate(log.date);
    if (!logDate) return false;

    const loan = (Array.isArray(loans) ? loans : []).find(l => l.id === log.loanId);
    const cId = getProp(loan, 'collectorId', 'collector_id');
    const isCollector = collectorId ? cId === collectorId : true;
    const logType = getProp(log, 'type', 'type');

    return isCollector &&
      logDate.getMonth() === month &&
      logDate.getFullYear() === year &&
      (logType === CollectionLogType.PAYMENT || String(logType).toUpperCase() === 'PAGO') &&
      !log.deletedAt;
  });

  const collectedThisMonth = filteredLogs.reduce((acc, log) => acc + (log.amount || 0), 0);

  return {
    monthlyGoal: totalResponsibility + collectedThisMonth, // Meta teórica al inicio del mes
    currentMonthGoals: totalResponsibility, // Lo que falta hoy
    pastArrears: 0,
    collectedThisMonth,
    remainingBalance: totalResponsibility, // "No Recaudado" real hoy
    logsCount: filteredLogs.length
  };
};

export const formatFullDateTime = (country: string = 'CO'): string => {
  const now = new Date();
  const options: Intl.DateTimeFormatOptions = {
    timeZone: country === 'PY' ? 'America/Asuncion' : 'America/Bogota',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true
  };
  return new Intl.DateTimeFormat('es-ES', options).format(now);
};

export const formatCountryTime = (country: CountryCode): string => {
  return formatFullDateTime(country);
};

export const getCountryName = (country: CountryCode): string => {
  const names: Record<CountryCode, string> = {
    'CO': 'Colombia',
    'PY': 'Paraguay',
    'PA': 'Panamá',
    'EC': 'Ecuador',
    'SV': 'El Salvador',
    'GT': 'Guatemala',
    'HN': 'Honduras',
    'MX': 'México',
    'NI': 'Nicaragua',
    'CR': 'Costa Rica',
    'DO': 'Rep. Dominicana',
    'AR': 'Argentina', 'BO': 'Bolivia', 'BR': 'Brasil', 'CL': 'Chile', 'PE': 'Perú', 'UY': 'Uruguay', 'VE': 'Venezuela',
    'US': 'Estados Unidos', 'ES': 'España', 'BZ': 'Belice', 'GY': 'Guyana', 'SR': 'Surinam',
    'CU': 'Cuba', 'HT': 'Haití', 'JM': 'Jamaica', 'TT': 'Trinidad y Tobago', 'BS': 'Bahamas', 'BB': 'Barbados',
    'LC': 'Santa Lucía', 'VC': 'San Vicente', 'GD': 'Granada', 'AG': 'Antigua y Barbuda', 'DM': 'Dominica', 'KN': 'San Cristóbal y Nieves',
    'CA': 'Canadá'
  };
  return names[country] || 'Colombia';
};

export const isHoliday = (date: Date | null | undefined, country: string, customHolidays: string[] = []): boolean => {
  if (!date || isNaN(date.getTime())) return false;

  const month = date.getMonth() + 1;
  const day = date.getDate();
  const dateStr = date.toISOString().split('T')[0];

  // Feriados Nacionales Colombia (Formato aproximado 2025/2026)
  if (country === 'CO') {
    const fixedHolidays = [
      '01-01', '01-06', '03-24', '04-17', '04-18', '05-01', '05-19',
      '06-09', '06-16', '06-23', '06-30', '07-20', '08-07', '08-18',
      '10-13', '11-03', '11-17', '12-08', '12-25'
    ];
    if (fixedHolidays.includes(`${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`)) return true;
  }

  // Feriados Nacionales Paraguay (Formato aproximado 2025/2026)
  if (country === 'PY') {
    const fixedHolidays = [
      '01-01', '03-01', '04-17', '04-18', '05-01', '05-14', '05-15',
      '06-12', '08-15', '09-29', '12-08', '12-25'
    ];
    if (fixedHolidays.includes(`${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`)) return true;
  }

  // Feriados personalizados
  if (customHolidays && customHolidays.includes(dateStr)) return true;

  return false;
};

export const formatCurrency = (value: number | undefined, settings: AppSettings | undefined): string => {
  const currencySymbol = settings?.currencySymbol || '$';
  if (value === undefined || isNaN(value)) return `${currencySymbol}0`;
  return `${currencySymbol}${Math.round(value).toLocaleString('es-CO')}`;
};

export const formatRawNumber = (value: number | undefined): string => {
  if (value === undefined || isNaN(value)) return '0';
  return Math.round(value).toLocaleString('es-CO');
};

export const calculateTotalReturn = (amount: any, rate: any): number => {
  return Number(amount) * (1 + Number(rate) / 100);
};

export const generateAmortizationTable = (
  amount: any,
  rate: any,
  installments: any,
  frequency: Frequency,
  startDate: string | Date,
  country: string,
  customHolidays: string[] = []
) => {
  try {
    const numAmount = Number(amount);
    const numRate = Number(rate);
    const numInstallments = Number(installments);

    const totalAmount = calculateTotalReturn(numAmount, numRate);
    const installmentValue = Math.ceil(totalAmount / (numInstallments || 1));
    const table = [];

    // Asegurar que startDate sea un objeto Date a las 00:00:00
    let currentDate: Date;
    if (typeof startDate === "string") {
      // Handle DD/MM/YYYY or YYYY-MM-DD
      if (startDate.includes('/') && !startDate.includes('-')) {
        const parts = startDate.split(' ')[0].split('/');
        if (parts[0].length === 2) { // DD/MM/YYYY
          currentDate = new Date(`${parts[2]}-${parts[1]}-${parts[0]}T00:00:00`);
        } else { // YYYY/MM/DD
          currentDate = new Date(`${parts[0]}-${parts[1]}-${parts[2]}T00:00:00`);
        }
      } else {
        const cleanStartDate = startDate.split(" ")[0].split("T")[0];
        currentDate = new Date(cleanStartDate + "T00:00:00");
      }
    } else {
      currentDate = new Date(startDate);
      currentDate.setHours(0, 0, 0, 0);
    }

    if (isNaN(currentDate.getTime())) {
      console.warn("Fecha inválida en amortización, usando hoy");
      currentDate = new Date();
      currentDate.setHours(0, 0, 0, 0);
    }

    for (let i = 1; i <= numInstallments; i++) {
      // Calcular siguiente fecha según frecuencia
      if (frequency === Frequency.DAILY) {
        currentDate.setDate(currentDate.getDate() + 1);
      } else if (frequency === Frequency.WEEKLY) {
        currentDate.setDate(currentDate.getDate() + 7);
      } else if (frequency === Frequency.BIWEEKLY) {
        currentDate.setDate(currentDate.getDate() + 15);
      } else if (frequency === Frequency.MONTHLY) {
        currentDate.setMonth(currentDate.getMonth() + 1);
      }

      // REGLA DE ORO: Saltar Domingos (getDay === 0) y Festivos
      let safetyCounter = 0;
      while ((currentDate.getDay() === 0 || isHoliday(currentDate, country, customHolidays)) && safetyCounter < 45) {
        currentDate.setDate(currentDate.getDate() + 1);
        safetyCounter++;
      }

      table.push({
        number: i,
        dueDate: currentDate.toISOString().split('T')[0],
        amount: i === numInstallments ? totalAmount - (installmentValue * (numInstallments - 1)) : installmentValue,
        status: 'pending'
      });
    }
    return table;
  } catch (error) {
    console.error("Error generando tabla amortización:", error);
    return [];
  }
};

export const getDaysOverdue = (loan: Loan, settings: AppSettings, customTotalPaid?: number): number => {
  try {
    if (!loan || !loan.createdAt) return 0;

    const todayStr = getLocalDateStringForCountry(settings?.country || 'CO');
    const today = new Date(todayStr + 'T00:00:00');

    // Priorizar cálculo si se pasó `customTotalPaid`, de lo contrario hacer fallback al método legacy
    const totalPaid = customTotalPaid !== undefined
      ? Number(customTotalPaid)
      : (loan.installments || []).reduce((acc: any, i: any) => acc + (Number(i.paidAmount) || 0), 0);


    // SIEMPRE generar tabla virtual desde la fecha de creación real para el cálculo de mora.
    // Esto evita errores si el cronograma guardado en el objeto 'loan' tiene fechas futuras.
    const virtualInstallments = generateAmortizationTable(
      loan.principal,
      loan.interestRate,
      loan.totalInstallments,
      loan.frequency,
      loan.createdAt,
      settings?.country || 'CO',
      loan.customHolidays || []
    );

    if (!virtualInstallments || virtualInstallments.length === 0) return 0;

    // 1. Encontrar la primera cuota que no está totalmente pagada en la tabla virtual
    let accumulatedPaid = totalPaid;
    const firstUnpaidInstallment = virtualInstallments.find(inst => {
      const amount = Number(inst.amount) || 0;
      if (accumulatedPaid >= amount - 0.1) {
        accumulatedPaid -= amount;
        return false;
      }
      return true;
    });

    if (!firstUnpaidInstallment) return 0;

    const cleanDueDateStr = firstUnpaidInstallment.dueDate.split('T')[0];
    const firstDueDate = new Date(cleanDueDateStr + 'T00:00:00');

    if (isNaN(firstDueDate.getTime()) || firstDueDate >= today) {
      return 0;
    }

    // 2. Contar DÍAS DE ATRASO (Excluyendo domingos y feriados sugeridos por el usuario)
    let delayedWorkingDays = 0;
    let tempDate = new Date(firstDueDate);

    // El atraso cuenta desde el día siguiente al vencimiento HASTA EL DÍA ANTERIOR A HOY
    // (Según ejemplo del usuario: si vence el 1 y es el 4, son 2 días de mora: el 2 y el 3)
    while (tempDate < today) {
      tempDate.setDate(tempDate.getDate() + 1);

      if (tempDate >= today) break; // NO contar el día de hoy ni días después

      const isSun = tempDate.getDay() === 0;
      const isHol = isHoliday(tempDate, settings?.country || 'CO', loan.customHolidays || []);

      if (!isSun && !isHol) {
        delayedWorkingDays++;
      }
    }

    return delayedWorkingDays;
  } catch (err) {
    console.error("Error calculando mora para prestamo:", loan?.id, err);
    return 0; // Fallback seguro
  }
};

export const calculateOverdueDays = (dueDate: string, country: string, loan: Loan): number => {
  const todayStr = getLocalDateStringForCountry(country);
  const today = new Date(todayStr + 'T00:00:00');
  const due = new Date(dueDate + 'T00:00:00');
  if (isNaN(due.getTime()) || today <= due) return 0;

  let diffDays = 0;
  let tempDate = new Date(due);
  while (tempDate < today) {
    tempDate.setDate(tempDate.getDate() + 1);
    if (tempDate >= today) break; // Excluir hoy
    if (tempDate.getDay() !== 0 && !isHoliday(tempDate, country, loan.customHolidays || [])) {
      diffDays++;
    }
  }
  return diffDays;
};

export const compressImage = (base64: string, maxWidth = 800, maxHeight = 800): Promise<string> => {
  return new Promise((resolve) => {
    const img = new Image();
    img.src = base64;
    img.onload = () => {
      const canvas = document.createElement('canvas');
      let width = img.width;
      let height = img.height;
      if (width > height) {
        if (width > maxWidth) {
          height *= maxWidth / width;
          width = maxWidth;
        }
      } else {
        if (height > maxHeight) {
          width *= maxHeight / height;
        }
      }
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx?.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL('image/jpeg', 0.6));
    };
    img.onerror = () => resolve(base64);
  });
};

export interface ReceiptData {
  clientName: string;
  amountPaid: number;
  previousBalance: number;
  loanId: string;
  startDate: string;
  expiryDate: string;
  daysOverdue: number;
  remainingBalance: number;
  paidInstallments: number;
  totalInstallments: number;
  installmentValue?: number;
  totalPaidAmount?: number;
  principal?: number;
  frequency?: string;
  isRenewal?: boolean;
  isVirtual?: boolean;
  // Manual overrides
  companyNameManual?: string;
  companyAliasManual?: string;
  contactLabelManual?: string;
  contactPhoneManual?: string;
  companyIdentifierLabelManual?: string;
  companyIdentifierManual?: string;
  shareLabelManual?: string;
  shareValueManual?: string;
  supportLabelManual?: string;
  supportPhoneManual?: string;
  fullDateTimeManual?: string;
}

export const generateReceiptText = (data: ReceiptData, settings: AppSettings) => {
  const format = (text: string, bold?: boolean, size?: 'normal' | 'medium' | 'large') => {
    let result = text;
    if (bold) result = `<B1>${result}<B0>`;
    if (size === 'large') result = `<GS1>${result}<GS0>`;
    if (size === 'medium') result = `<GS2>${result}<GS0>`;
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

  const idLabel = (data.companyIdentifierLabelManual || '').trim() ? data.companyIdentifierLabelManual : "ID EMPRESA";
  const rawManualId = (data.companyIdentifierManual || '').trim();
  let idVal = rawManualId ? rawManualId : (settings.companyIdentifier || '---');
  if (idVal === '---' && settings.companyIdentifier) idVal = settings.companyIdentifier;
  const idValue = format(idVal, settings.companyIdentifierBold);

  const rawManualShareLabel = (data.shareLabelManual || '').trim();
  const bankLabel = (rawManualShareLabel ? rawManualShareLabel : (settings.shareLabel || 'BANCO')).toUpperCase();

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
        return `\nPENDIENTE ${currencySymbol}${pendingAmount.toLocaleString('es-CO').replace(/,/g, '.')}  /  ${nextInstallmentNum}`;
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
  const plazoStr = `${data.totalInstallments} ${data.frequency || ''}`.toUpperCase().trim();

  const bankBlock = (bankVal && bankVal !== '---')
    ? `\n${bankLabel}\n${bankLabel.includes('CUENTA') ? 'NUMERO' : 'CUENTA'}: ${bankValue}\n===============================`
    : '';

  return `
${company}
${alias ? alias : ''}
===============================${bankBlock}
CLIENTE: ${data.clientName.toUpperCase()}
FECHA: ${datePart ? datePart.trim() : dateTime}
HORA: ${timePart ? timePart.trim() : '---'}
METODO: ${data.isVirtual ? 'TRANSFERENCIA' : 'EFECTIVO'}
===============================
MONTO: ${montoStr}
CUOTA: ${cuotaStr}
PLAZO: ${plazoStr}
===============================
SALDO ANTERIOR: ${currencySymbol}${data.previousBalance.toLocaleString('es-CO').replace(/,/g, '.')}
ABONO: ${currencySymbol}${data.amountPaid.toLocaleString('es-CO').replace(/,/g, '.')}
SALDO ACTUAL: ${currencySymbol}${data.remainingBalance.toLocaleString('es-CO').replace(/,/g, '.')}
===============================
CUOTAS PAGADAS: ${displayedPaidInstallments}
CUOTAS TOTALES: ${data.totalInstallments}${pendingInstallmentText()}
===============================
FECHA DE INICIO: ${formatDate(data.startDate)}
FECHA DE VENCIMIENTO: ${formatDate(data.expiryDate)}
DIAS DE MORA: ${data.daysOverdue} dias
===============================
${contactLabel}: ${formattedPhone}
${idLabel}: ESTADO DE CUENTA
===============================
GRACIAS POR SU PAGO
`;
};

export const generateNoPaymentReceiptText = (data: ReceiptData, settings: AppSettings) => {
  const company = settings.companyName || 'ANEXO COBRO';
  const currencySymbol = settings.currencySymbol || '$';
  return `
===============================
       NOTIFICACION
===============================
CLIENTE: ${data.clientName}
FECHA: ${formatFullDateTime(settings.country)}
SALDO: ${currencySymbol}${data.remainingBalance.toLocaleString('es-CO')}
===============================
`;
};

export const convertReceiptForWhatsApp = (receiptText: string): string => {
  return receiptText.replace(/<GS[012]>/g, '').replace(/<B[01]>/g, '');
};

export const formatDate = (dateString: string): string => {
  if (!dateString) return '---';
  const cleanDate = dateString.split('T')[0];
  const date = new Date(cleanDate + 'T00:00:00');
  return date.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

/**
 * Robustly parses a currency string by stripping non-numeric characters.
 * Handles cases like "25.000", "$ 25.000", "25,000.00" etc.
 */
export const parseAmount = (input: string | number): number => {
  if (typeof input === 'number') return input;
  if (!input) return 0;

  let str = String(input).trim();
  const clean = str.replace(/[^\d.,-]/g, '');

  const dots = (clean.match(/\./g) || []).length;
  const commas = (clean.match(/,/g) || []).length;

  if (dots > 1 && commas === 0) return parseFloat(clean.replace(/\./g, '')) || 0;
  if (commas > 1 && dots === 0) return parseFloat(clean.replace(/,/g, '')) || 0;

  const lastDot = clean.lastIndexOf('.');
  const lastComma = clean.lastIndexOf(',');

  if (lastDot > lastComma) return parseFloat(clean.replace(/,/g, '')) || 0;
  if (lastComma > lastDot) return parseFloat(clean.replace(/\./g, '').replace(',', '.')) || 0;

  const res = parseFloat(clean);
  return isNaN(res) ? 0 : res;
};

/**
 * Returns the tailwind class for the renewal button based on global rules:
 * 0-39 days: Blue
 * Exactly 40 days: Yellow
 * 41-60 days: Orange
 * >60 days: Red
 */
export const getRenewalButtonColor = (maxOverdueDays: number): string => {
  if (maxOverdueDays <= 39) return 'bg-blue-600 hover:bg-blue-700';
  if (maxOverdueDays === 40) return 'bg-yellow-500 hover:bg-yellow-600';
  if (maxOverdueDays <= 60) return 'bg-orange-600 hover:bg-orange-700';
  return 'bg-red-600 hover:bg-red-700';
};
