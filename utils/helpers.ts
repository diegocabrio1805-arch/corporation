import { v4 as uuidv4 } from 'uuid';
import { Client, Loan, CollectionLog, AppSettings, CountryCode, Frequency, LoanStatus, CollectionLogType, PaymentStatus } from '../types';

export const generateUUID = (): string => {
  try {
    // Intenta usar la API nativa si está disponible (entornos seguros/modernos)
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return crypto.randomUUID();
    }
  } catch (e) {
    // Silently fallback
  }
  
  // Fallback robusto para HTTP, dispositivos viejos o entornos no seguros
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
};

const COUNTRY_TIMEZONES: Record<string, string> = {
  'AR': 'America/Argentina/Buenos_Aires',
  'BO': 'America/La_Paz',
  'BR': 'America/Sao_Paulo',
  'CL': 'America/Santiago',
  'CO': 'America/Bogota',
  'EC': 'America/Guayaquil',
  'GY': 'America/Guyana',
  'PY': 'America/Asuncion',
  'PE': 'America/Lima',
  'SR': 'America/Paramaribo',
  'UY': 'America/Montevideo',
  'VE': 'America/Caracas',
  'ES': 'Europe/Madrid',
  'BZ': 'America/Belize',
  'CR': 'America/Costa_Rica',
  'SV': 'America/El_Salvador',
  'GT': 'America/Guatemala',
  'HN': 'America/Tegucigalpa',
  'NI': 'America/Managua',
  'PA': 'America/Panama',
  'CA': 'America/Toronto',
  'US': 'America/New_York',
  'MX': 'America/Mexico_City',
  'DO': 'America/Santo_Domingo',
  'CU': 'America/Havana',
  'HT': 'America/Port-au-Prince',
  'JM': 'America/Jamaica',
  'TT': 'America/Port_of_Spain',
  'BS': 'America/Nassau',
  'BB': 'America/Barbados',
  'LC': 'America/St_Lucia',
  'VC': 'America/St_Vincent',
  'GD': 'America/Grenada',
  'AG': 'America/Antigua',
  'DM': 'America/Dominica',
  'KN': 'America/St_Kitts'
};

const getTimeZoneForCountry = (country: string): string => {
  return COUNTRY_TIMEZONES[country] || 'America/Bogota';
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
    timeZone: getTimeZoneForCountry(country),
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

  const allLogs = Array.isArray(collectionLogs) ? collectionLogs : [];
  
  // Obtener todos los loan_ids que aparecen en los logs para identificar IDs fantasma
  const allLogLoanIds = new Set(allLogs.map(l => String(l.loanId || l.loan_id || '').trim().toLowerCase()).filter(id => id.length > 0));

  const validLogs = allLogs.filter(log => {
    const logLoanId = String(log.loanId || log.loan_id || '').trim().toLowerCase();
    const lId = String(loanId || '').trim().toLowerCase();
    const logType = String(log.type || '').toUpperCase();
    const isOpening = log.isOpening || log.is_opening || false;
    const isDeleted = log.deletedAt || log.deleted_at;

    if (isDeleted) return false;
    if (!(logType === 'PAGO' || logType === CollectionLogType.PAYMENT)) return false;

    // EXCLUIR SIEMPRE los logs de apertura de crédito del cálculo de abonos
    // Son registros contables internos (isOpening: true), NO pagos reales del cliente
    if (isOpening) return false;

    // Coincidencia directa por loan_id (caso normal)
    if (logLoanId === lId) return true;

    // FALLBACK: log apunta a un préstamo que NO existe (Ghost) pero mismo cliente
    if (clientId) {
      const logClientId = String(log.clientId || log.client_id || '').trim().toLowerCase();
      const cId = String(clientId || '').trim().toLowerCase();
      if (logClientId === cId && logLoanId !== lId && logLoanId.length > 0) {
        // En este contexto, si el log NO coincide con el préstamo actual pero es del mismo cliente,
        // solo lo tomamos si es un ID que no reconocemos como otro préstamo activo (simplificación segura)
        // Pero para evitar duplicidades en reducciones consolidadas, es mejor ser estricto.
        return false; 
      }
    }
    return false;
  });

  const seenMigs = new Set<string>();
  return validLogs.reduce((acc: number, log: any) => {
    const id = String(log.id || '');
    if (id.startsWith('LOG-MIG-')) {
        const lId = String(log.loanId || log.loan_id || '').trim();
        if (seenMigs.has(lId)) return acc; 
        seenMigs.add(lId);
    }
    
    // Robust parsing for amount
    const amt = typeof log.amount === 'number' ? log.amount : (parseFloat(String(log.amount).replace(/[^\d.-]/g, '')) || 0);
    return acc + amt;
  }, 0);
};

export const calculateMonthlyStats = (
  loans: Loan[],
  collectionLogs: CollectionLog[],
  month: number,
  year: number,
  collectorId?: string
) => {
  const loansMap = new Map((Array.isArray(loans) ? loans : []).map(l => [l.id, l]));

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

    const loan = loansMap.get(log.loanId);
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
    timeZone: getTimeZoneForCountry(country),
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

export const formatLocalDate = (date: Date | string | null | undefined, country: string = 'CO', options: Intl.DateTimeFormatOptions = {}, language: string = 'es'): string => {
  if (!date) return '---';
  const d = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(d.getTime())) return '---';
  
  const defaultOptions: Intl.DateTimeFormatOptions = {
    timeZone: getTimeZoneForCountry(country),
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    ...options
  };
  
  const locale = language === 'en' ? 'en-US' : language === 'fr' ? 'fr-FR' : language === 'pt' ? 'pt-BR' : 'es-ES';
  return new Intl.DateTimeFormat(locale, defaultOptions).format(d);
};

export const formatLocalTime = (date: Date | string | null | undefined, country: string = 'CO', options: Intl.DateTimeFormatOptions = {}): string => {
  if (!date) return '---';
  const d = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(d.getTime())) return '---';
  
  const defaultOptions: Intl.DateTimeFormatOptions = {
    timeZone: getTimeZoneForCountry(country),
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
    ...options
  };
  
  return new Intl.DateTimeFormat('es-ES', defaultOptions).format(d);
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
  
  const locale = settings?.numberFormat === 'comma' ? 'en-US' : 'es-CO';
  const formatted = Math.round(value).toLocaleString(locale);
  return `${currencySymbol}${formatted}`;
};

export const formatRawNumber = (value: number | undefined, settings?: AppSettings): string => {
  if (value === undefined || isNaN(value)) return '0';
  const locale = settings?.numberFormat === 'comma' ? 'en-US' : 'es-CO';
  return Math.round(value).toLocaleString(locale);
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

    const totalAmount = Math.round(calculateTotalReturn(numAmount, numRate));
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
      const freqStr = String(frequency).toLowerCase();
      // Calcular siguiente fecha según frecuencia
      if (freqStr.includes('diari') && freqStr.includes('v')) {
        currentDate.setDate(currentDate.getDate() + 1); // Diario L-V
      } else if (freqStr.includes('diari')) {
        currentDate.setDate(currentDate.getDate() + 1); // Diario L-S
      } else if (freqStr.includes('semanal') && freqStr.includes('quincenal') === false) {
        currentDate.setDate(currentDate.getDate() + 7);
      } else if (freqStr.includes('quincenal')) {
        currentDate.setDate(currentDate.getDate() + 15);
      } else if (freqStr.includes('mensual')) {
        currentDate.setMonth(currentDate.getMonth() + 1);
      }

      let safetyCounter = 0;
      const isDailyMF = freqStr.includes('diari') && freqStr.includes('v');
      
      while ((currentDate.getDay() === 0 || 
             (isDailyMF && currentDate.getDay() === 6) ||
             isHoliday(currentDate, country, customHolidays)) && safetyCounter < 45) {
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

    // OPCIÓN B: Tiempo Real Infinito
    // Días de mora = Días hábiles transcurridos desde la fecha de la primera cuota impaga hasta hoy (inclusive)
    
    // 1. Calcular cuántas cuotas enteras están pagadas
    const paidInstallmentsCount = Math.floor(totalPaid / (loan.installmentValue || 1));
    
    // 2. Encontrar la fecha de la primera cuota que falta por pagar
    // (Si pagó 5, la primera impaga es la número 6, que en el array es el índice 5)
    const firstUnpaidIndex = paidInstallmentsCount;
    
    // Si ya pagó todas las cuotas (o más), no hay mora
    if (firstUnpaidIndex >= virtualInstallments.length) return 0;
    
    const firstUnpaidInstallment = virtualInstallments[firstUnpaidIndex];
    const cleanDueDateStr = firstUnpaidInstallment.dueDate.split('T')[0];
    const firstDueDate = new Date(cleanDueDateStr + 'T00:00:00');

    // Si la cuota vence en el futuro, no hay mora
    if (isNaN(firstDueDate.getTime()) || firstDueDate > today) {
      return 0;
    }

    // 3. Contar DÍAS HÁBILES desde el primer vencimiento impago hasta HOY (inclusive)
    let delayedWorkingDays = 0;
    let tempDate = new Date(firstDueDate);
    
    const freqStr = String(loan.frequency).toLowerCase();
    const isDailyMF = freqStr.includes('diari') && freqStr.includes('v');

    while (tempDate <= today) {
      const isSun = tempDate.getDay() === 0;
      const isSat = tempDate.getDay() === 6;
      const isHol = isHoliday(tempDate, settings?.country || 'CO', loan.customHolidays || []);

      const shouldSkip = isSun || (isDailyMF && isSat) || isHol;

      if (!shouldSkip) {
        delayedWorkingDays++;
      }
      
      // Avanzar al día siguiente
      tempDate.setDate(tempDate.getDate() + 1);
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
    const isSun = tempDate.getDay() === 0;
    const isSat = tempDate.getDay() === 6;
    const isHol = isHoliday(tempDate, country, loan.customHolidays || []);
    
    const shouldSkip = isSun || (loan.frequency === Frequency.DAILY_MF && isSat) || isHol;

    if (!shouldSkip) {
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

import { getTranslation } from './translations';

export const generateReceiptText = (data: ReceiptData, settings: AppSettings) => {
  const t = getTranslation((settings as any).language || 'es') as any;
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

  const contactLabel = (data.contactLabelManual || '').trim() ? data.contactLabelManual : (t.receipt?.publicPhone || "TEL. PUBLICO");
  const rawManualPhone = (data.contactPhoneManual || '').trim();
  let phone = rawManualPhone ? rawManualPhone : (settings.contactPhone || '---');
  if (phone === '---' && settings.contactPhone) phone = settings.contactPhone;
  const formattedPhone = format(phone, settings.contactPhoneBold);

  let rawIdLabel = (data.companyIdentifierLabelManual || '').trim();
  if (rawIdLabel === 'ID EMPRESA') rawIdLabel = t.receipt?.companyId || 'ID EMPRESA';
  const idLabel = rawIdLabel ? rawIdLabel : (t.receipt?.companyId || "ID EMPRESA");
  const rawManualId = (data.companyIdentifierManual || '').trim();
  let idVal = rawManualId ? rawManualId : (settings.companyIdentifier || '---');
  if (idVal === '---' && settings.companyIdentifier) idVal = settings.companyIdentifier;
  const idValue = format(idVal, settings.companyIdentifierBold);

  let rawManualShareLabel = (data.shareLabelManual || '').trim();
  let shareFallback = settings.shareLabel || (t.receipt?.bank || 'BANCO');
  if (shareFallback.toUpperCase() === 'CUENTA') shareFallback = t.receipt?.account || 'CUENTA';
  if (rawManualShareLabel && rawManualShareLabel.toUpperCase() === 'CUENTA') rawManualShareLabel = t.receipt?.account || 'CUENTA';
  const bankLabel = (rawManualShareLabel ? rawManualShareLabel : shareFallback).toUpperCase();

  const rawManualShareVal = (data.shareValueManual || '').trim();
  let bankVal = rawManualShareVal ? rawManualShareVal : (settings.shareValue || '');
  if ((!bankVal || bankVal === '---') && settings.shareValue) bankVal = settings.shareValue;
  const bankValue = format(bankVal.toUpperCase(), settings.shareValueBold, settings.shareValueSize);

  const supportLabel = t.receipt?.publicPhone || "TEL. PUBLICO";
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
        return `\n${t.receipt?.pending || 'PENDIENTE'} ${currencySymbol}${pendingAmount.toLocaleString('es-CO').replace(/,/g, '.')}  /  ${nextInstallmentNum}`;
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
    ? `\n${bankLabel}\n${bankLabel.includes('CUENTA') ? 'NUMERO' : (t.receipt?.account || 'CUENTA')}: ${bankValue}\n===============================`
    : '';

  return `
${company}
${alias ? alias : ''}
===============================${bankBlock}
${t.receipt?.client || 'CLIENTE'}: ${data.clientName.toUpperCase()}
${t.receipt?.date || 'FECHA'}: ${datePart ? datePart.trim() : dateTime}
${t.receipt?.time || 'HORA'}: ${timePart ? timePart.trim() : '---'}
${t.receipt?.method || 'METODO'}: ${data.isVirtual ? (t.receipt?.transfer || 'TRANSFERENCIA') : (t.receipt?.cash || 'EFECTIVO')}
===============================
${t.receipt?.amount || 'MONTO'}: ${montoStr}
${t.receipt?.installment || 'CUOTA'}: ${cuotaStr}
${t.receipt?.term || 'PLAZO'}: ${plazoStr}
===============================
${t.receipt?.prevBalance || 'SALDO ANTERIOR'}: ${currencySymbol}${data.previousBalance.toLocaleString('es-CO').replace(/,/g, '.')}
${t.receipt?.payment || 'ABONO'}: ${currencySymbol}${data.amountPaid.toLocaleString('es-CO').replace(/,/g, '.')}
${t.receipt?.currentBalance || 'SALDO ACTUAL'}: ${currencySymbol}${data.remainingBalance.toLocaleString('es-CO').replace(/,/g, '.')}
===============================
${t.receipt?.paidInstallments || 'CUOTAS PAGADAS'}: ${displayedPaidInstallments}
${t.receipt?.totalInstallments || 'CUOTAS TOTALES'}: ${data.totalInstallments}${pendingInstallmentText()}
===============================
${t.receipt?.startDate || 'FECHA DE INICIO'}: ${formatDate(data.startDate)}
${t.receipt?.expiryDate || 'FECHA DE VENCIMIENTO'}: ${formatDate(data.expiryDate)}
${t.receipt?.daysOverdue || 'DIAS DE MORA'}: ${data.daysOverdue} ${t.receipt?.days || 'dias'}
===============================
${contactLabel}: ${formattedPhone}
${idLabel}: ${t.receipt?.accountState || 'ESTADO DE CUENTA'}
===============================
${t.receipt?.thanks || 'GRACIAS POR SU PAGO'}
`;
};

export const generateNoPaymentReceiptText = (data: ReceiptData, settings: AppSettings) => {
  const t = getTranslation((settings as any).language || 'es') as any;
  const company = settings.companyName || 'ANEXO COBRO';
  const currencySymbol = settings.currencySymbol || '$';
  return `
===============================
       ${t.receipt?.notification || 'NOTIFICACION'}
===============================
${t.receipt?.client || 'CLIENTE'}: ${data.clientName}
${t.receipt?.date || 'FECHA'}: ${formatFullDateTime(settings.country)}
${t.receipt?.balance || 'SALDO'}: ${currencySymbol}${data.remainingBalance.toLocaleString('es-CO')}
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
  if (str === '-' || str === '--') return 0;
  
  // Si tiene puntos y comas, asumimos que el último es el decimal
  const clean = str.replace(/[^\d.,-]/g, '');
  const lastDot = clean.lastIndexOf('.');
  const lastComma = clean.lastIndexOf(',');

  // Caso específico de Paraguay/Argentina: "1.320.000" o "1.320" 
  // No hay comas, pero hay puntos. Si el punto NO es el decimal (porque hay múltiples o porque hay 3 dígitos después)
  if (lastComma === -1 && lastDot !== -1) {
    const dots = (clean.match(/\./g) || []).length;
    const afterLastDot = clean.substring(lastDot + 1);
    
    // Si hay más de un punto, DEFINITIVAMENTE son separadores de miles
    if (dots > 1) return parseFloat(clean.replace(/\./g, '')) || 0;
    
    // Si hay un solo punto pero tiene 3 dígitos después (ej: 1.500), tratamos como miles
    // EXCEPCIÓN: Si es un número pequeño con decimales (ej: 1.50). 
    // En el contexto de esta App (Cobros), 1.320 suele ser mil trescientos veinte, no uno punto tres.
    if (afterLastDot.length === 3) return parseFloat(clean.replace(/\./g, '')) || 0;
  }

  // Lógica estándar para otros casos
  if (lastDot > lastComma) {
    // El punto es el decimal, quitamos comas
    return parseFloat(clean.replace(/,/g, '')) || 0;
  } else if (lastComma > lastDot) {
    // La coma es el decimal, quitamos puntos y cambiamos coma por punto
    return parseFloat(clean.replace(/\./g, '').replace(',', '.')) || 0;
  }

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
