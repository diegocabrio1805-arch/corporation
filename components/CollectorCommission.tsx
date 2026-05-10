
import React, { useState, useMemo, useRef } from 'react';
import { AppState, CollectionLogType, Role, LoanStatus, CollectionLog, PaymentStatus, CommissionBracket } from '../types';
import { formatCurrency, getLocalDateStringForCountry, formatDate, getDaysOverdue, calculateTotalPaidFromLogs, formatRawNumber, formatLocalDate, formatLocalTime } from '../utils/helpers';
import { getTranslation } from '../utils/translations';
import html2canvas from 'html2canvas';
import { jsPDF } from "jspdf";
import * as XLSX from 'xlsx-js-style';

interface CollectorCommissionProps {
  state: AppState;
  setCommissionPercentage: (percentage: number) => void;
  updateCommissionBrackets: (brackets: CommissionBracket[]) => void;
  deleteCollectionLog?: (logId: string) => void;
}

const CollectorCommission: React.FC<CollectorCommissionProps> = ({ state, setCommissionPercentage, updateCommissionBrackets, deleteCollectionLog }) => {
  const countryTodayStr = getLocalDateStringForCountry(state.settings.country);

  const isAdmin = state.currentUser?.role === Role.ADMIN;
  const isManager = state.currentUser?.role === Role.MANAGER;
  const isPowerUser = isAdmin || isManager;
  const currentUserId = state.currentUser?.id;
  const t = getTranslation(state.settings.language);

  const [selectedHistoricalRoutes, setSelectedHistoricalRoutes] = useState<string[]>(isPowerUser ? ['all'] : [currentUserId || '']);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [showGlobalSummary, setShowGlobalSummary] = useState(false);
  const [showBracketModal, setShowBracketModal] = useState(false);

  const [showCollectorHistoryId, setShowCollectorHistoryId] = useState<string | null>(null);
  const [showExcelModal, setShowExcelModal] = useState(false);
  const [excelStartDate, setExcelStartDate] = useState(countryTodayStr);
  const [excelEndDate, setExcelEndDate] = useState(countryTodayStr);
  const [paymentTypeFilter, setPaymentTypeFilter] = useState<'all' | 'cash' | 'virtual' | 'renewal' | 'nopay'>('all');

  const [localCommissionPercent, setLocalCommissionPercent] = useState<number>(0);
  const [editingBrackets, setEditingBrackets] = useState<CommissionBracket[]>([...(Array.isArray(state.commissionBrackets) ? state.commissionBrackets : [])]);

  // Estado para override manual del incentivo (null = usar automático)
  // Estado para override manual del incentivo (deseado: enteros)
  const [manualIncentivePercent, setManualIncentivePercent] = useState<number | null>(null);

  // Estado para override manual de Mora (deseado: default 0)
  const [manualMoraPercent, setManualMoraPercent] = useState<number | null>(0);
  const [sencilloAmount, setSencilloAmount] = useState<number>(0);
  const [expenseAmount, setExpenseAmount] = useState<number>(0);
  const [expenseNote, setExpenseNote] = useState<string>('');
  const [historyCommissionPercent, setHistoryCommissionPercent] = useState<number>(10);

  const receiptImageRef = useRef<HTMLDivElement>(null);
  const auditTableRef = useRef<HTMLDivElement>(null);
  const [sharingLog, setSharingLog] = useState<CollectionLog | null>(null);
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [isGeneratingExcel, setIsGeneratingExcel] = useState(false);

  // LOGICA DE CALCULO DE MULTIPLICADOR POR DESEMPEÑO
  const getPayoutFactor = (moraRate: number) => {
    const sorted = [...(Array.isArray(state.commissionBrackets) ? state.commissionBrackets : [])].sort((a, b) => a.maxMora - b.maxMora);
    const bracket = sorted.find(b => moraRate <= b.maxMora);
    return bracket ? bracket.payoutPercent / 100 : (sorted[sorted.length - 1]?.payoutPercent / 100 || 0);
  };

  const calculateStatsForCollector = (targetUserIds: string[]) => {
    const todayDate = new Date();
    const dayOfWeek = todayDate.getDay();
    const diffToMonday = todayDate.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
    const monday = new Date(todayDate);
    monday.setDate(diffToMonday);
    monday.setHours(0, 0, 0, 0);

    let totalDelinquencySum = 0;
    let daysWithActivity = 0;
    const daysStats = [];

    for (let i = 0; i < 6; i++) {
      const currentDay = new Date(monday);
      currentDay.setDate(monday.getDate() + i);
      if (currentDay > new Date()) continue;

      const dailyLogs = (Array.isArray(state.collectionLogs) ? state.collectionLogs : []).filter(log => {
        const logDate = new Date(log.date);
        const isSameDay = logDate.toDateString() === currentDay.toDateString();
        const logCollectorId = log.collectorId || (log as any).recordedBy || (log as any).recorded_by;
        const matchesUser = targetUserIds.includes('all') ? true : targetUserIds.includes(logCollectorId);
        return isSameDay && matchesUser && !log.isOpening;
      });

      const countPago = dailyLogs.filter(l => l.type === CollectionLogType.PAYMENT).length;
      const countNoPago = dailyLogs.filter(l => l.type === CollectionLogType.NO_PAGO).length;
      const totalGestionesDiarias = countPago + countNoPago;

      const delinquencyRate = totalGestionesDiarias > 0 ? (countNoPago / totalGestionesDiarias) * 100 : 0;

      if (totalGestionesDiarias > 0) {
        totalDelinquencySum += delinquencyRate;
        daysWithActivity++;
      }

      daysStats.push({
        rate: delinquencyRate,
        name: formatLocalDate(currentDay, state.settings.country, { weekday: 'short' })
      });
    }

    const logsHoy = (Array.isArray(state.collectionLogs) ? state.collectionLogs : []).filter(log => {
      const logCollectorId = log.collectorId || (log as any).recordedBy || (log as any).recorded_by;
      const matchesUser = targetUserIds.includes('all') ? true : targetUserIds.includes(logCollectorId);
      return matchesUser && new Date(log.date).toDateString() === new Date().toDateString() && !log.isOpening;
    });

    const recaudoHoy = logsHoy
      .filter(l => l.type === CollectionLogType.PAYMENT)
      .reduce((acc, curr) => acc + (curr.amount || 0), 0);

    const avgMora = daysWithActivity > 0 ? totalDelinquencySum / daysWithActivity : 0;
    const performanceFactor = getPayoutFactor(avgMora);

    return {
      averageDelinquency: avgMora,
      performanceFactor,
      days: daysStats,
      recaudoHoy
    };
  };

  const currentViewStats = useMemo(() => calculateStatsForCollector(selectedHistoricalRoutes), [state.collectionLogs, state.loans, state.commissionBrackets, selectedHistoricalRoutes]);

  const thirtyDayHistory = useMemo(() => {
    if (!showCollectorHistoryId) return [];

    const today = new Date();
    today.setHours(23, 59, 59, 999);
    
    // Retrocedemos 30 días exactos
    const thirtyDaysAgo = new Date(today.getTime() - (30 * 24 * 60 * 60 * 1000));
    
    // Para no cortar la primera semana a la mitad (ej. que falte lunes y martes),
    // buscamos el LUNES de la semana donde cae esa fecha límite.
    const dayOfWeekLimit = thirtyDaysAgo.getDay();
    const diffToMondayLimit = thirtyDaysAgo.getDate() - dayOfWeekLimit + (dayOfWeekLimit === 0 ? -6 : 1);
    const startOfLimitWeek = new Date(thirtyDaysAgo);
    startOfLimitWeek.setDate(diffToMondayLimit);
    startOfLimitWeek.setHours(0, 0, 0, 0);
    
    const collectorLogs = (Array.isArray(state.collectionLogs) ? state.collectionLogs : []).filter(log => {
      if (log.type !== CollectionLogType.PAYMENT) return false;
      if (log.isOpening || log.deletedAt) return false;
      const logDate = new Date(log.date);
      if (logDate < startOfLimitWeek) return false; // Filtramos desde el Lunes completo
      const logCollectorId = log.collectorId || (log as any).recordedBy || (log as any).recorded_by;
      return logCollectorId === showCollectorHistoryId;
    });

    const weeksMap = new Map<string, { weekStart: Date, weekEnd: Date, Lunes: number, Martes: number, Miércoles: number, Jueves: number, Viernes: number, Sábado: number, Total: number }>();

    collectorLogs.forEach(log => {
      const d = new Date(log.date);
      const dayOfWeek = d.getDay(); 
      const diffToMonday = d.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
      const monday = new Date(d);
      monday.setDate(diffToMonday);
      monday.setHours(0, 0, 0, 0);
      const mondayStr = monday.toISOString().split('T')[0];

      if (!weeksMap.has(mondayStr)) {
        const sunday = new Date(monday);
        sunday.setDate(monday.getDate() + 6);
        weeksMap.set(mondayStr, {
          weekStart: monday,
          weekEnd: sunday,
          Lunes: 0, Martes: 0, Miércoles: 0, Jueves: 0, Viernes: 0, Sábado: 0, Total: 0
        });
      }

      const weekData = weeksMap.get(mondayStr)!;
      const amount = log.amount || 0;
      
      if (dayOfWeek === 1) weekData.Lunes += amount;
      else if (dayOfWeek === 2) weekData.Martes += amount;
      else if (dayOfWeek === 3) weekData.Miércoles += amount;
      else if (dayOfWeek === 4) weekData.Jueves += amount;
      else if (dayOfWeek === 5) weekData.Viernes += amount;
      else if (dayOfWeek === 6) weekData.Sábado += amount;
      
      if (dayOfWeek >= 1 && dayOfWeek <= 6) {
        weekData.Total += amount;
      }
    });

    return Array.from(weeksMap.values()).sort((a, b) => b.weekStart.getTime() - a.weekStart.getTime());
  }, [state.collectionLogs, showCollectorHistoryId]);

  const thirtyDayColocacionHistory = useMemo(() => {
    if (!showCollectorHistoryId) return [];

    const today = new Date();
    today.setHours(23, 59, 59, 999);
    const thirtyDaysAgo = new Date(today.getTime() - (30 * 24 * 60 * 60 * 1000));
    
    const dayOfWeekLimit = thirtyDaysAgo.getDay();
    const diffToMondayLimit = thirtyDaysAgo.getDate() - dayOfWeekLimit + (dayOfWeekLimit === 0 ? -6 : 1);
    const startOfLimitWeek = new Date(thirtyDaysAgo);
    startOfLimitWeek.setDate(diffToMondayLimit);
    startOfLimitWeek.setHours(0, 0, 0, 0);
    
    const collectorLoans = (Array.isArray(state.loans) ? state.loans : []).filter(loan => {
      if (loan.deletedAt) return false;
      const loanDate = new Date(loan.createdAt || (loan as any).date);
      if (loanDate < startOfLimitWeek) return false;
      const logCollectorId = loan.collectorId || (loan as any).collector_id || loan.branchId; 
      return logCollectorId === showCollectorHistoryId;
    });

    const weeksMap = new Map<string, { 
      weekStart: Date, 
      weekEnd: Date, 
      LunesN: number, LunesR: number, 
      MartesN: number, MartesR: number, 
      MiércolesN: number, MiércolesR: number, 
      JuevesN: number, JuevesR: number, 
      ViernesN: number, ViernesR: number, 
      SábadoN: number, SábadoR: number, 
      TotalNuevos: number, TotalRenovados: number 
    }>();

    collectorLoans.forEach(loan => {
      const d = new Date(loan.createdAt || (loan as any).date);
      const dayOfWeek = d.getDay(); 
      const diffToMonday = d.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
      const monday = new Date(d);
      monday.setDate(diffToMonday);
      monday.setHours(0, 0, 0, 0);
      const mondayStr = monday.toISOString().split('T')[0];

      if (!weeksMap.has(mondayStr)) {
        const sunday = new Date(monday);
        sunday.setDate(monday.getDate() + 6);
        weeksMap.set(mondayStr, {
          weekStart: monday,
          weekEnd: sunday,
          LunesN: 0, LunesR: 0, 
          MartesN: 0, MartesR: 0, 
          MiércolesN: 0, MiércolesR: 0, 
          JuevesN: 0, JuevesR: 0, 
          ViernesN: 0, ViernesR: 0, 
          SábadoN: 0, SábadoR: 0, 
          TotalNuevos: 0, TotalRenovados: 0
        });
      }

      const weekData = weeksMap.get(mondayStr)!;
      const amount = Number(loan.principal) || 0;
      const isR = loan.isRenewal;
      
      if (dayOfWeek === 1) { if (isR) weekData.LunesR += amount; else weekData.LunesN += amount; }
      else if (dayOfWeek === 2) { if (isR) weekData.MartesR += amount; else weekData.MartesN += amount; }
      else if (dayOfWeek === 3) { if (isR) weekData.MiércolesR += amount; else weekData.MiércolesN += amount; }
      else if (dayOfWeek === 4) { if (isR) weekData.JuevesR += amount; else weekData.JuevesN += amount; }
      else if (dayOfWeek === 5) { if (isR) weekData.ViernesR += amount; else weekData.ViernesN += amount; }
      else if (dayOfWeek === 6) { if (isR) weekData.SábadoR += amount; else weekData.SábadoN += amount; }
      
      if (dayOfWeek >= 1 && dayOfWeek <= 6) {
        if (isR) weekData.TotalRenovados += amount;
        else weekData.TotalNuevos += amount;
      }
    });

    return Array.from(weeksMap.values()).sort((a, b) => b.weekStart.getTime() - a.weekStart.getTime());
  }, [state.loans, showCollectorHistoryId]);

  const allCollectorsSummary = useMemo(() => {
    const eligibleUsers = (Array.isArray(state.users) ? state.users : []).filter(u =>
      (u.role === Role.COLLECTOR) && (u.id === currentUserId || u.managedBy === currentUserId)
    );
    return (Array.isArray(eligibleUsers) ? eligibleUsers : []).map(user => ({
      user,
      stats: calculateStatsForCollector([user.id])
    }));
  }, [state.users, state.collectionLogs, state.loans, state.commissionBrackets, currentUserId]);

  const normalizeId = (id: any): string => {
    if (!id) return '';
    return id.toString().trim().replace(/[.\-\s]/g, '').toLowerCase();
  };

  const excelLogs = useMemo(() => {
    const [sYear, sMonth, sDay] = excelStartDate.split('-').map(Number);
    const start = new Date(sYear, sMonth - 1, sDay, 0, 0, 0, 0);
    const [eYear, eMonth, eDay] = excelEndDate.split('-').map(Number);
    const end = new Date(eYear, eMonth - 1, eDay, 23, 59, 59, 999);

    return (Array.isArray(state.collectionLogs) ? state.collectionLogs : []).filter(log => {
      // 1. Basic Validity Checks (Clean up "---" rows)
      if (log.isOpening || log.deletedAt || log.type === CollectionLogType.DELETED_PAYMENT) return false;
      if (!log.clientId) return false; // Exclude logs with no associated client

      // 2. Activity Check (Exclude 0 amount unless it's a valid non-monetary interaction)
      const hasValidAmount = (log.amount || 0) > 0;
      const isInteraction = log.type === CollectionLogType.NO_PAGO || log.isRenewal;
      if (!hasValidAmount && !isInteraction) return false;

      // 3. Range & User Filters
      const d = new Date(log.date);
      if (!(d >= start && d <= end)) return false;
      const logCollectorId = log.collectorId || (log as any).recordedBy || (log as any).recorded_by;
      if (!selectedHistoricalRoutes.includes('all') && !selectedHistoricalRoutes.includes(logCollectorId)) return false;

      // 4. Type Filters
      if (paymentTypeFilter === 'nopay') return log.type === CollectionLogType.NO_PAGO;
      if (paymentTypeFilter === 'virtual') return log.isVirtual;
      if (paymentTypeFilter === 'renewal') return log.isRenewal;
      if (paymentTypeFilter === 'cash') return !log.isVirtual && !log.isRenewal && log.type === CollectionLogType.PAYMENT;

      return true;
    }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [state.collectionLogs, state.loans, excelStartDate, excelEndDate, selectedHistoricalRoutes, paymentTypeFilter]);

  const auditLogs = useMemo(() => {
    const clients = Array.isArray(state.clients) ? state.clients : [];
    return excelLogs.map(log => {
      const normalizedLogClientId = normalizeId(log.clientId);
      const client = clients.find(c => normalizeId(c.id) === normalizedLogClientId);
      return { ...log, _clientName: client ? (client.name + (client.deletedAt ? ' (ELIMINADO)' : '')) : '---' };
    });
  }, [excelLogs, state.clients]);

  const totalsBreakdown = useMemo(() => {
    return excelLogs.reduce((acc, log) => {
      if (log.type === CollectionLogType.NO_PAGO) return acc;
      const amt = log.amount || 0;
      if (log.isRenewal) acc.renewal += amt;
      else if (log.isVirtual) acc.virtual += amt;
      else acc.cash += amt;
      return acc;
    }, { cash: 0, virtual: 0, renewal: 0 });
  }, [excelLogs]);

  const totalCollectedInRange = totalsBreakdown.cash + totalsBreakdown.virtual + totalsBreakdown.renewal;

  const baseCommissionValue = useMemo(() => {
    return totalCollectedInRange * (localCommissionPercent / 100);
  }, [totalCollectedInRange, localCommissionPercent]);


  const effectiveIncentive = manualIncentivePercent !== null ? manualIncentivePercent : 0;
  // User requested: Default Mora Penalty = 0.
  const effectiveMora = manualMoraPercent !== null ? manualMoraPercent : 0;

  const finalCommissionValue = useMemo(() => {
    // Formula: Subtotal - (Subtotal * Mora) + (Subtotal * Incentive)
    // Equivalent: Subtotal * (1 - Mora + Incentive)
    const factor = 1 - effectiveMora + effectiveIncentive;
    return Math.max(0, baseCommissionValue * factor);
  }, [baseCommissionValue, effectiveMora, effectiveIncentive]);

  const handleSaveBrackets = () => {
    updateCommissionBrackets(editingBrackets);
    setShowBracketModal(false);
    alert("Reglas de comisión actualizadas.");
  };

  const handleExportExcel = async () => {
    if (isGeneratingExcel || !excelLogs.length) return;
    setIsGeneratingExcel(true);

    try {
      // Create a new workbook
      const wb = XLSX.utils.book_new();

      // Define standard border
      const borderAll = {
        top: { style: "thin", color: { auto: 1 } },
        bottom: { style: "thin", color: { auto: 1 } },
        left: { style: "thin", color: { auto: 1 } },
        right: { style: "thin", color: { auto: 1 } }
      };

      // Define headers style
      const headerStyle = {
        font: { bold: true, name: 'Aptos Narrow', sz: 12 },
        border: borderAll,
        alignment: { vertical: "center", horizontal: "center" }
      };

      // Base Data Construction
      const wsData: any[][] = [];

      // Row 1: Title
      wsData.push([{
        v: `AUDITORÍA DE ABONOS - ${state.settings.companyName || 'ANEXO COBRANZA'}`,
        t: "s",
        s: { font: { bold: true, name: 'Aptos Narrow', sz: 16 }, alignment: { vertical: "center", horizontal: "center" } }
      }, "", "", "", "", ""]);

      // Row 2: Empty
      wsData.push([]);

      // Row 3: Period
      wsData.push([
        "",
        { v: `Periodo: ${excelStartDate} al ${excelEndDate}`, t: "s", s: { font: { name: 'Aptos Narrow', sz: 12 }, alignment: { vertical: "center", horizontal: "center" } } },
        "", "", "", ""
      ]);

      // Row 4: Empty
      wsData.push([]);

      // Row 5: Headers
      wsData.push([
        { v: "Fecha", t: "s", s: headerStyle },
        { v: "Cliente", t: "s", s: headerStyle },
        { v: "Medio", t: "s", s: headerStyle },
        { v: "Monto", t: "s", s: headerStyle },
        { v: "Comisión Base", t: "s", s: headerStyle },
        { v: "Gestor", t: "s", s: headerStyle }
      ]);

      // Add Data Rows
      auditLogs.forEach(log => {
        const isNoPay = log.type === CollectionLogType.NO_PAGO;
        const commBase = (log.amount || 0) * (localCommissionPercent / 100);
        const gestor = state.users.find(u => u.id === log.recordedBy)?.name || '---';
        const medioPago = isNoPay ? 'No Pago' : log.isRenewal ? 'Liquid.' : log.isVirtual ? 'Transf.' : 'Efectivo';

        let fontColor = "FF000000"; // Black
        if (medioPago === 'Efectivo') fontColor = "FF166534"; // Green
        else if (medioPago === 'Transf.') fontColor = "FF1D4ED8"; // Blue
        else if (medioPago === 'No Pago') fontColor = "FFDC2626"; // Red
        else if (medioPago === 'Liquid.') fontColor = "FFD97706"; // Amber

        const baseStyle = {
          font: { color: { rgb: fontColor }, name: 'Aptos Narrow', sz: 11, bold: false },
          border: borderAll,
          alignment: { vertical: "center", horizontal: "left" }
        };

        const fechaStyle = { ...baseStyle, alignment: { vertical: "center", horizontal: "left" } };
        const clienteStyle = { ...baseStyle, font: { ...baseStyle.font, bold: true }, alignment: { vertical: "center", horizontal: "left" } };
        const medioStyle = { ...baseStyle, font: { ...baseStyle.font, bold: true }, alignment: { vertical: "center", horizontal: "center" } };
        const montoStyle = { ...baseStyle, numFmt: '#,##0.00', alignment: { vertical: "center", horizontal: "right" } };
        const gestorStyle = { ...baseStyle, alignment: { vertical: "center", horizontal: "center" } };

        wsData.push([
          { v: new Date(log.date).toLocaleString(), t: "s", s: fechaStyle },
          { v: log._clientName, t: "s", s: clienteStyle },
          { v: medioPago, t: "s", s: medioStyle },
          { v: isNoPay ? '-' : (log.amount || 0), t: isNoPay ? "s" : "n", s: isNoPay ? medioStyle : montoStyle },
          { v: isNoPay ? '-' : commBase, t: isNoPay ? "s" : "n", s: isNoPay ? medioStyle : montoStyle },
          { v: gestor.toUpperCase(), t: "s", s: gestorStyle }
        ]);
      });

      // Add Summary
      wsData.push([]);

      const summaryRow1Idx = wsData.length;
      const summaryLabelStyle = { font: { bold: true, name: 'Aptos Narrow', sz: 12 }, border: borderAll, alignment: { vertical: "center", horizontal: "left" } };
      const summaryMoneyStyle = { font: { bold: true, name: 'Aptos Narrow', sz: 12 }, border: borderAll, numFmt: '#,##0.00', alignment: { vertical: "center", horizontal: "right" } };
      const emptyBorderStyle = { border: borderAll };

      wsData.push([
        { v: 'Recaudo Bruto:', t: "s", s: summaryLabelStyle },
        { v: "", t: "s", s: emptyBorderStyle },
        { v: "", t: "s", s: emptyBorderStyle },
        { v: totalCollectedInRange, t: "n", s: summaryMoneyStyle },
        "", "" // Empty
      ]);

      const summaryRow2Idx = wsData.length;
      wsData.push([
        { v: 'Base / Sencillo:', t: "s", s: summaryLabelStyle },
        { v: "", t: "s", s: emptyBorderStyle },
        { v: "", t: "s", s: emptyBorderStyle },
        { v: sencilloAmount, t: "n", s: summaryMoneyStyle },
        "", "" // Empty
      ]);

      const summaryRow3Idx = wsData.length;
      const gastoLabelStyle = { font: { bold: true, name: 'Aptos Narrow', sz: 12, color: { rgb: "FFFF0000" } }, border: borderAll, alignment: { vertical: "center", horizontal: "left" } };
      const gastoMoneyStyle = { font: { bold: true, name: 'Aptos Narrow', sz: 12, color: { rgb: "FFFF0000" } }, border: borderAll, numFmt: '#,##0.00', alignment: { vertical: "center", horizontal: "right" } };
      const gastoLabel = expenseNote ? `Gasto / ${expenseNote}` : 'Gasto';
      wsData.push([
        { v: gastoLabel, t: "s", s: gastoLabelStyle },
        { v: "", t: "s", s: emptyBorderStyle },
        { v: "", t: "s", s: emptyBorderStyle },
        { v: expenseAmount, t: "n", s: gastoMoneyStyle },
        "", "" // Empty
      ]);

      const summaryRow4Idx = wsData.length;
      const rendirLabelStyle = { font: { bold: true, name: 'Aptos Narrow', sz: 12, color: { rgb: "FF00B050" } }, border: borderAll, alignment: { vertical: "center", horizontal: "left" } };
      const rendirMoneyStyle = { font: { bold: true, name: 'Aptos Narrow', sz: 12, color: { rgb: "FF00B050" } }, border: borderAll, numFmt: '#,##0.00', alignment: { vertical: "center", horizontal: "right" } };
      wsData.push([
        { v: 'Total a Rendir:', t: "s", s: rendirLabelStyle },
        { v: "", t: "s", s: emptyBorderStyle },
        { v: "", t: "s", s: emptyBorderStyle },
        { v: totalCollectedInRange + sencilloAmount - expenseAmount, t: "n", s: rendirMoneyStyle },
        "", "" // Empty
      ]);

      const summaryRow5Idx = wsData.length;
      wsData.push([
        { v: 'Total Liquidación:', t: "s", s: summaryLabelStyle },
        { v: "", t: "s", s: emptyBorderStyle },
        { v: "", t: "s", s: emptyBorderStyle },
        { v: finalCommissionValue, t: "n", s: summaryMoneyStyle },
        "", "" // Empty
      ]);

      // Create Worksheet
      const ws = XLSX.utils.aoa_to_sheet(wsData);

      // Merge Cells Configuration
      if (!ws['!merges']) ws['!merges'] = [];
      ws['!merges'].push({ s: { r: 0, c: 0 }, e: { r: 0, c: 5 } }); // Title Merge A1:F1
      ws['!merges'].push({ s: { r: 2, c: 1 }, e: { r: 2, c: 4 } }); // Period Merge B3:E3
      ws['!merges'].push({ s: { r: summaryRow1Idx, c: 0 }, e: { r: summaryRow1Idx, c: 2 } });
      ws['!merges'].push({ s: { r: summaryRow2Idx, c: 0 }, e: { r: summaryRow2Idx, c: 2 } });
      ws['!merges'].push({ s: { r: summaryRow3Idx, c: 0 }, e: { r: summaryRow3Idx, c: 2 } });
      ws['!merges'].push({ s: { r: summaryRow4Idx, c: 0 }, e: { r: summaryRow4Idx, c: 2 } });
      ws['!merges'].push({ s: { r: summaryRow5Idx, c: 0 }, e: { r: summaryRow5Idx, c: 2 } });

      // Column Widths
      ws['!cols'] = [
        { wpx: 130 }, // Fecha
        { wpx: 250 }, // Cliente
        { wpx: 80 },  // Medio
        { wpx: 100 }, // Monto
        { wpx: 100 }, // Comision
        { wpx: 150 }  // Gestor
      ];

      XLSX.utils.book_append_sheet(wb, ws, "Auditoria");

      // Generate buffer and download
      const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
      const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const fileName = `Auditoria_Excel_${excelStartDate}_al_${excelEndDate}.xlsx`;

      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      link.click();
      URL.revokeObjectURL(url);

    } catch (error) {
      console.error("Error generating Excel:", error);
      alert("Error al generar Excel. Revisa la consola o intenta de nuevo.");
    } finally {
      setIsGeneratingExcel(false);
    }
  };

  const handleShareLogImage = async (log: CollectionLog) => {
    const client = (Array.isArray(state.clients) ? state.clients : []).find(c => c.id === log.clientId);
    if (!client) return;
    setSharingLog(log);
    setIsGeneratingImage(true);

    // Pequeño delay para que el DOM se renderice con los datos del sharingLog
    setTimeout(async () => {
      if (receiptImageRef.current) {
        try {
          const canvas = await html2canvas(receiptImageRef.current, {
            scale: 4, // HD Resolution
            backgroundColor: '#ffffff',
            useCORS: true,
            logging: false
          });

          canvas.toBlob(async (blob) => {
            if (!blob) return;
            const fileName = log.type === CollectionLogType.PAYMENT ? `Recibo_${client.name}.png` : `Notificacion_${client.name}.png`;
            const file = new File([blob], fileName, { type: 'image/png' });

            if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
              await navigator.share({
                files: [file],
                title: `Comprobante de Gestión - ${state.settings.companyName || 'ANEXO COBRO'}`,
                text: `Hola ${client.name}, adjunto el soporte de la gestión realizada hoy.`
              });
            } else {
              // Fallback for Desktop: Copy to clipboard and open WhatsApp Web
              try {
                const item = new ClipboardItem({ 'image/png': blob });
                await navigator.clipboard.write([item]);
                alert("¡Imagen copiada al portapapeles!\nEn la ventana de WhatsApp que se abrirá, presiona 'Strg + V' o 'Ctrl + V' para pegar y enviar la imagen.");
              } catch (clipErr) {
                console.warn("No se pudo copiar al portapapeles:", clipErr);
                // Standard download fallback if clipboard fails
                const link = document.createElement('a');
                link.href = URL.createObjectURL(blob);
                link.download = fileName;
                link.click();
              }

              const phone = client.phone.replace(/\D/g, '');
              const waText = encodeURIComponent(`Hola ${client.name}, le adjunto su soporte actualizado. Clic aquí para descargar la app o revisar el adjunto.`);
              window.open(`https://wa.me/${phone}?text=${waText}`, '_blank');
            }
          }, 'image/png');
        } catch (err) {
          console.error("Error generating image:", err);
        } finally {
          setIsGeneratingImage(false);
          setSharingLog(null);
        }
      }
    }, 600);
  };

  return (
    <div className="flex flex-col space-y-4 animate-fadeIn max-w-7xl mx-auto pb-24 px-1 md:px-0">

      {/* HEADER */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-4 md:p-6 rounded-2xl border border-slate-100 shadow-sm">
        <div>
          <h2 className="text-xl md:text-2xl font-black text-slate-900 flex items-center gap-2 tracking-tighter uppercase">
            <i className="fa-solid fa-file-invoice-dollar text-blue-600"></i>
            Libro de Comisiones
          </h2>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Configuración de incentivos por cumplimiento</p>
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          {isPowerUser && (
            <>
              <button
                onClick={() => setShowBracketModal(true)}
                className="flex-1 md:flex-none px-4 py-3 bg-blue-600 text-white rounded-xl font-black text-[9px] uppercase tracking-widest shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2"
              >
                <i className="fa-solid fa-gears text-black"></i> EDITAR REGLAS MORA
              </button>
              <button
                onClick={() => setShowGlobalSummary(true)}
                className="flex-1 md:flex-none px-4 py-3 bg-slate-900 text-white rounded-xl font-black text-[9px] uppercase tracking-widest shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2"
              >
                <i className="fa-solid fa-users-gear text-black"></i> RESUMEN RUTAS
              </button>
            </>
          )}
        </div>
      </div>

      {/* PANEL DE DESEMPEÑO Y CÁLCULO VISUAL */}
      {isPowerUser && (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* GRÁFICO SEMANAL (DERECHA) */}
        <div className="lg:col-span-8 bg-slate-900 rounded-[2rem] p-6 shadow-xl relative overflow-hidden">
          <div className="relative z-10 flex flex-col gap-6">
            <h3 className="text-white text-[10px] font-black uppercase tracking-tighter flex items-center gap-2 border-b border-white/10 pb-2">
              <i className="fa-solid fa-chart-line text-emerald-400"></i>
              Histórico de Mora Semanal: <span className="text-emerald-400 line-clamp-1">{selectedHistoricalRoutes.includes('all') ? 'CONSOLIDADO' : state.users.filter(u => selectedHistoricalRoutes.includes(u.id)).map(u => u.name.toUpperCase()).join(', ')}</span>
            </h3>
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
              {(Array.isArray(currentViewStats.days) ? currentViewStats.days : []).map((stat, idx) => (
                <div key={idx} className="bg-white/5 border border-white/10 rounded-2xl p-3 flex flex-col items-center justify-center text-center">
                  <p className="text-[8px] font-black text-slate-500 uppercase mb-1">{stat.name}</p>
                  <p className={`text-sm font-black ${stat.rate < 20 ? 'text-emerald-400' : stat.rate < 35 ? 'text-yellow-400' : 'text-red-500'}`}>{Math.round(stat.rate)}%</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* INDICADORES DE DESCUENTO (IZQUIERDA) */}
        <div className="lg:col-span-4 flex flex-col gap-4">
          <div className="bg-white p-3 rounded-[1.5rem] border border-slate-100 shadow-sm flex-1 flex flex-col justify-between items-center text-center relative group min-h-[140px]">
            {/* TOP: REAL MORA STATISTIC */}
            <div className="w-full border-b border-slate-100 pb-2 mb-2">
              <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Mora Real Registrada</p>
              <p className={`text-4xl font-black ${currentViewStats.averageDelinquency > 20 ? 'text-red-500' : 'text-emerald-500'}`}>{Math.round(currentViewStats.averageDelinquency)}%</p>
            </div>

            {/* BOTTOM: EDITABLE DISCOUNT */}
            <div className="flex-1 flex flex-col justify-center w-full">
              <p className="text-[7px] font-black text-slate-400 uppercase tracking-widest mb-1">Descuento a Aplicar</p>
              <div className="flex items-center gap-1 justify-center">
                <input
                  type="number"
                  value={Math.round(effectiveMora * 100)}
                  onChange={(e) => {
                    const val = Number(e.target.value);
                    setManualMoraPercent(val / 100);
                  }}
                  className={`no-spinner bg-transparent !text-6xl font-black text-center w-32 outline-none border-b-2 transition-colors p-0 leading-none ${effectiveMora > 0 ? 'text-red-600 border-red-200 focus:border-red-500' : 'text-slate-300 border-slate-200 focus:border-slate-500'}`}
                />
                <span className={`text-3xl font-black ${effectiveMora > 0 ? 'text-red-600' : 'text-slate-300'}`}>%</span>
              </div>
              <div className="mt-1 inline-block">
                <span className="text-[6px] font-black text-slate-300 uppercase px-2 py-0.5 bg-slate-50 rounded-full border border-slate-100">EDITABLE</span>
              </div>
            </div>
          </div>
          <div className="bg-blue-600 p-3 rounded-[1.5rem] shadow-xl flex-1 flex flex-col justify-center items-center text-center text-white relative group min-h-[140px]">
            <div className="flex-1 flex flex-col justify-center w-full">
              <p className="text-[10px] font-black text-blue-200 uppercase tracking-widest mb-2">Incentivo Extra</p>

              <div className="flex items-center gap-1 justify-center">
                <input
                  type="number"
                  value={Math.round(effectiveIncentive * 100)}
                  onChange={(e) => {
                    const val = Number(e.target.value);
                    setManualIncentivePercent(val / 100);
                  }}
                  className="no-spinner bg-transparent !text-6xl font-black text-white text-center w-32 outline-none border-b-2 border-white/20 focus:border-white transition-colors p-0 leading-none"
                />
                <span className="text-3xl font-black text-white/80">%</span>
              </div>

              <p className="text-[7px] font-bold text-blue-300 uppercase mt-4">SE SUMARÁ AL PAGO</p>
            </div>
          </div>
        </div>
      </div>

      {/* DESGLOSE DEL CÁLCULO PARA EL GERENTE */}
      <div className="bg-white p-6 rounded-[2.5rem] border border-slate-200 shadow-xl overflow-hidden relative">
        <div className="flex flex-col md:flex-row justify-between items-center gap-8">
          {/* Factor 1: Recaudo */}
          <div className="flex-1 text-center md:text-left space-y-1">
            <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">1. Recaudo Bruto</p>
            <p className="text-xl font-black text-slate-800 font-mono">{formatCurrency(totalCollectedInRange, state.settings)}</p>
          </div>

          <i className="fa-solid fa-xmark text-slate-300 text-xs"></i>

          {/* Factor 2: Comision % */}
          <div className="flex-1 text-center space-y-1">
            <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">2. Comisión Base</p>
            <div className="flex items-center justify-center gap-2">
              <input type="number" value={localCommissionPercent === 0 ? '' : localCommissionPercent} placeholder="0" onChange={(e) => {
                const val = e.target.value === '' ? 0 : Number(e.target.value);
                setLocalCommissionPercent(val);
                setCommissionPercentage(val);
              }} className="w-12 bg-slate-100 text-center font-black rounded-lg py-1 text-sm outline-none focus:ring-2 focus:ring-blue-500 text-black" />
              <span className="text-sm font-black text-slate-400">%</span>
            </div>
          </div>

          <i className="fa-solid fa-equals text-slate-300 text-xs"></i>

          {/* Resultado Intermedio */}
          <div className="flex-1 text-center space-y-1 bg-slate-50 p-3 rounded-2xl">
            <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Subtotal (100%)</p>
            <p className="text-lg font-black text-blue-600 font-mono">{formatCurrency(baseCommissionValue, state.settings)}</p>
          </div>

          <i className="fa-solid fa-minus text-red-300 text-xs"></i>

          {/* Factor 3: Resta Mora */}
          <div className="flex-1 text-center space-y-1">
            <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">3. Descuento Mora</p>
            <p className="text-xl font-black text-red-500">-{Math.round(effectiveMora * 100)}%</p>
          </div>

          <i className="fa-solid fa-plus text-emerald-300 text-xs"></i>

          {/* Factor 4: Suma Incentivo */}
          <div className="flex-1 text-center space-y-1">
            <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">4. Incentivo</p>
            <p className="text-xl font-black text-emerald-500">+{Math.round(effectiveIncentive * 100)}%</p>
          </div>

          <i className="fa-solid fa-equals text-slate-900 text-lg"></i>

          {/* PAGO FINAL */}
          <div className="flex-1 text-center md:text-right space-y-1 bg-emerald-600 text-white p-5 rounded-[2rem] shadow-xl shadow-emerald-600/20">
            <p className="text-[8px] font-black text-emerald-200 uppercase tracking-widest">Liquidación Final</p>
            <p className="text-2xl font-black font-mono">{formatCurrency(finalCommissionValue, state.settings)}</p>
          </div>
        </div>
      </div>
        </>
      )}

      {/* SECCIÓN DE RENDICIÓN DE CAJA */}
      <div className="bg-white p-6 rounded-[2.5rem] border border-slate-200 shadow-xl overflow-hidden relative mt-8">
        <div className="flex flex-col md:flex-row justify-between items-center gap-8">
          
          {isPowerUser && (
            <>
              {/* Valor Recaudo */}
              <div className="flex-1 text-center space-y-1">
            <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Recaudo Filtrado</p>
            <p className="text-2xl font-black text-slate-800 font-mono">{formatCurrency(totalCollectedInRange, state.settings)}</p>
          </div>

          <i className="fa-solid fa-plus text-slate-300 text-lg"></i>

          {/* Sencillo Editable */}
          <div className="flex-1 text-center space-y-2">
            <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Sencillo / Base</p>
            <div className="flex items-center justify-center gap-2">
              <span className="text-xl font-black text-slate-400">$</span>
              <input 
                type="number" 
                value={sencilloAmount === 0 ? '' : sencilloAmount} 
                onChange={(e) => setSencilloAmount(e.target.value === '' ? 0 : Number(e.target.value))} 
                className="w-28 bg-slate-100 text-center font-black rounded-xl py-2 text-xl outline-none focus:ring-2 focus:ring-blue-500 text-black shadow-inner" 
                placeholder="0"
              />
            </div>
          </div>

          <i className="fa-solid fa-minus text-red-300 text-lg"></i>

          {/* Gasto Editable */}
          <div className="flex-1 text-center space-y-2">
            <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Gasto (Obs y Monto)</p>
            <div className="flex flex-col items-center gap-1">
              <input 
                type="text" 
                value={expenseNote} 
                onChange={(e) => setExpenseNote(e.target.value)} 
                className="w-full max-w-[120px] bg-slate-50 text-center font-bold rounded-lg py-1 text-xs outline-none focus:ring-1 focus:ring-red-400 text-slate-600 border border-slate-200" 
                placeholder="Observacion"
              />
              <div className="flex items-center justify-center gap-1">
                <span className="text-xl font-black text-red-400">$</span>
                <input 
                  type="number" 
                  value={expenseAmount === 0 ? '' : expenseAmount} 
                  onChange={(e) => setExpenseAmount(e.target.value === '' ? 0 : Number(e.target.value))} 
                  className="w-24 bg-red-50 text-center font-black rounded-xl py-2 text-xl outline-none focus:ring-2 focus:ring-red-500 text-red-600 shadow-inner" 
                  placeholder="0"
                />
              </div>
            </div>
          </div>

          <i className="fa-solid fa-equals text-slate-900 text-2xl"></i>
            </>
          )}

          {/* Total a Rendir */}
          <div className="flex-1 text-center md:text-right space-y-1 bg-slate-900 text-white p-5 rounded-[2rem] shadow-xl">
            <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Total a Rendir</p>
            <p className="text-3xl font-black text-blue-400 font-mono">{formatCurrency(totalCollectedInRange + sencilloAmount - expenseAmount, state.settings)}</p>
          </div>

        </div>
      </div>

      {/* FILTROS DE HISTORIAL EXCEL */}
      <div className="flex flex-col sm:flex-row items-center gap-4 bg-white p-4 rounded-[2.5rem] border border-slate-200 shadow-xl mt-8">
        <button onClick={() => setShowExcelModal(true)} className="w-full sm:w-auto px-6 py-4 bg-slate-900 text-white rounded-3xl font-black text-[10px] uppercase tracking-widest shadow-xl flex items-center justify-center gap-2 active:scale-95 transition-all">
          <i className="fa-solid fa-table-list text-emerald-400"></i> VER HISTORIAL DETALLADO EXCEL
        </button>

        <div className="flex items-center gap-2 bg-slate-50 px-4 py-3 rounded-xl border border-slate-200 w-full sm:w-auto relative">
          <i className="fa-solid fa-route text-blue-600 text-xs"></i>
          
          <div className="relative w-full cursor-pointer" onClick={() => setIsDropdownOpen(!isDropdownOpen)}>
            <div className="flex items-center justify-between text-[10px] font-black text-slate-700 uppercase tracking-widest min-w-[180px]">
              <span className="truncate max-w-[150px]">
                {selectedHistoricalRoutes.includes('all') 
                  ? 'CONSOLIDADO SUCURSAL' 
                  : state.users.filter(u => selectedHistoricalRoutes.includes(u.id)).map(u => u.name).join(', ')}
              </span>
              <i className={`fa-solid fa-chevron-down ml-2 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`}></i>
            </div>
            
            {isDropdownOpen && (
              <>
                <div className="fixed inset-0 z-[90]" onClick={(e) => { e.stopPropagation(); setIsDropdownOpen(false); }}></div>
                <div className="absolute bottom-full left-0 mb-3 w-[250px] bg-white rounded-2xl shadow-2xl border border-slate-200 z-[100] max-h-64 overflow-y-auto custom-scrollbar" onClick={(e) => e.stopPropagation()}>
                  <div 
                    className="px-4 py-3 border-b border-slate-100 hover:bg-slate-50 cursor-pointer flex items-center gap-3 transition-colors"
                    onClick={() => {
                      if (selectedHistoricalRoutes.includes('all')) {
                        setSelectedHistoricalRoutes([]);
                      } else {
                        setSelectedHistoricalRoutes(['all']);
                      }
                    }}
                  >
                    <div className={`w-4 h-4 rounded-[4px] border ${selectedHistoricalRoutes.includes('all') ? 'bg-blue-600 border-blue-600' : 'border-slate-300'} flex items-center justify-center`}>
                      {selectedHistoricalRoutes.includes('all') && <i className="fa-solid fa-check text-[10px] text-white"></i>}
                    </div>
                    <span className="text-[10px] font-black text-slate-800 uppercase tracking-widest">TODOS (CONSOLIDADO)</span>
                  </div>
                  
                  {state.users.filter(u => u.role === Role.COLLECTOR && (u.id === currentUserId || u.managedBy === currentUserId)).map(u => (
                    <div 
                      key={u.id}
                      className="px-4 py-3 hover:bg-slate-50 cursor-pointer flex items-center gap-3 transition-colors"
                      onClick={() => {
                        let newRoutes = selectedHistoricalRoutes.filter(id => id !== 'all');
                        if (newRoutes.includes(u.id)) {
                          newRoutes = newRoutes.filter(id => id !== u.id);
                          if (newRoutes.length === 0) newRoutes = ['all'];
                        } else {
                          newRoutes.push(u.id);
                        }
                        setSelectedHistoricalRoutes(newRoutes);
                      }}
                    >
                      <div className={`w-4 h-4 rounded-[4px] border ${(selectedHistoricalRoutes.includes('all') || selectedHistoricalRoutes.includes(u.id)) ? 'bg-blue-600 border-blue-600' : 'border-slate-300'} flex items-center justify-center`}>
                        {(selectedHistoricalRoutes.includes('all') || selectedHistoricalRoutes.includes(u.id)) && <i className="fa-solid fa-check text-[10px] text-white"></i>}
                      </div>
                      <span className="text-[10px] font-bold text-slate-700 uppercase tracking-widest truncate">{u.name}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* MODAL REGLAS DE COMISIÓN (EDITABLE) */}
      {showBracketModal && (
        <div className="fixed inset-0 bg-slate-900/98 flex items-start pt-10 md:pt-20 justify-center z-[300] p-4 overflow-y-auto">
          <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-md overflow-hidden animate-scaleIn border border-white/20">
            <div className="p-6 bg-slate-900 text-white flex justify-between items-center">
              <h3 className="text-lg font-black uppercase tracking-tighter">Reglas de Pago x Mora</h3>
              <button onClick={() => setShowBracketModal(false)} className="text-white/50 hover:text-white"><i className="fa-solid fa-xmark text-xl"></i></button>
            </div>
            <div className="p-8 space-y-6 bg-slate-50">
              <p className="text-[10px] font-bold text-slate-500 uppercase leading-relaxed text-center">
                Ajusta los porcentajes de cobro según la morosidad registrada en la ruta.
              </p>
              <div className="space-y-4">
                {(Array.isArray(editingBrackets) ? editingBrackets : []).map((bracket, idx) => (
                  <div key={idx} className="flex items-center gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm relative group overflow-hidden">
                    <div className="flex-1">
                      <label className="block text-[8px] font-black text-slate-400 uppercase mb-1.5">Si la Mora es hasta:</label>
                      <div className="flex items-center gap-1.5">
                        <input type="number" value={bracket.maxMora} onChange={(e) => {
                          const newB = [...editingBrackets];
                          newB[idx].maxMora = Number(e.target.value);
                          setEditingBrackets(newB);
                        }} className="w-20 bg-slate-100 text-center font-black rounded-xl py-2 text-base outline-none focus:ring-2 focus:ring-blue-500 text-black shadow-inner" />
                        <span className="font-black text-black text-lg">%</span>
                      </div>
                    </div>

                    <div className="w-10 flex justify-center opacity-20">
                      <i className="fa-solid fa-arrow-right text-slate-900"></i>
                    </div>

                    <div className="flex-1">
                      <label className="block text-[8px] font-black text-slate-400 uppercase mb-1.5">Pagar el:</label>
                      <div className="flex items-center gap-1.5">
                        <input type="number" value={bracket.payoutPercent} onChange={(e) => {
                          const newB = [...editingBrackets];
                          newB[idx].payoutPercent = Number(e.target.value);
                          setEditingBrackets(newB);
                        }} className="w-20 bg-emerald-50 text-emerald-700 text-center font-black rounded-xl py-2 text-base outline-none focus:ring-2 focus:ring-emerald-500 text-black shadow-inner" />
                        <span className="font-black text-black text-lg">%</span>
                      </div>
                    </div>
                    <div className="absolute top-0 right-0 p-1 opacity-10"><span className="text-[6px] font-black uppercase text-slate-900">Nivel {idx + 1}</span></div>
                  </div>
                ))}
              </div>
              <div className="p-4 bg-amber-50 rounded-2xl border border-amber-100">
                <p className="text-[8px] font-black text-amber-700 uppercase leading-relaxed">
                  <i className="fa-solid fa-circle-info mr-1"></i>
                  Ejemplo: Si mora es 25% (Rango 30), el cobrador recibe el 80% de su comisión total calculada.
                </p>
              </div>
              <button onClick={handleSaveBrackets} className="w-full py-5 bg-slate-900 text-white rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl active:scale-95 transition-all">
                GUARDAR CONFIGURACIÓN PERSONALIZADA
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL HISTORIAL EXCEL / AUDITORÍA */}
      {showExcelModal && (
        <div className="fixed inset-0 bg-slate-900/98 flex items-start pt-10 md:pt-20 justify-center z-[250] p-0 md:p-4 animate-fadeIn overflow-y-auto">
          <div className="bg-white w-full md:rounded-[2.5rem] shadow-2xl flex flex-col border border-white/20">
            <div className="p-4 md:p-6 bg-slate-900 text-white flex flex-col gap-4 shrink-0">
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="text-lg font-black uppercase tracking-tighter">Auditoría Histórica de Abonos</h3>
                </div>
                <button onClick={() => setShowExcelModal(false)} className="w-10 h-10 bg-white/10 text-white rounded-xl flex items-center justify-center"><i className="fa-solid fa-xmark"></i></button>
              </div>
              <div className="flex flex-col lg:flex-row gap-3">
                <div className="grid grid-cols-2 gap-2 bg-white/5 p-2 rounded-xl">
                  <input type="date" value={excelStartDate} onChange={(e) => setExcelStartDate(e.target.value)} className="bg-white text-black rounded-lg py-1 px-3 text-[10px] font-black" />
                  <input type="date" value={excelEndDate} onChange={(e) => setExcelEndDate(e.target.value)} className="bg-white text-black rounded-lg py-1 px-3 text-[10px] font-black" />
                </div>
                <div className="flex gap-2 overflow-x-auto no-scrollbar">
                  {['all', 'cash', 'virtual', 'renewal', 'nopay'].map(f => (
                    <button key={f} onClick={() => setPaymentTypeFilter(f as any)} className={`px-3 py-1.5 rounded-lg text-[8px] font-black uppercase whitespace-nowrap ${paymentTypeFilter === f ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400'}`}>
                      {f === 'all' ? 'Todo' : f === 'cash' ? 'Efectivo' : f === 'virtual' ? 'Transf.' : f === 'renewal' ? 'Liquid.' : 'No Pago'}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-auto bg-white custom-scrollbar" ref={auditTableRef}>
              <table className="w-full text-left border-collapse min-w-[1000px]">
                <thead className="sticky top-0 bg-slate-100 z-10">
                  <tr className="text-[9px] font-black text-slate-500 uppercase border-b border-slate-200">
                    <th className="px-5 py-4">Fecha</th>
                    <th className="px-5 py-4">Cliente</th>
                    <th className="px-5 py-4 text-center">Medio</th>
                    <th className="px-5 py-4 text-right">Monto</th>
                    <th className="px-5 py-4 text-right text-blue-600">Comisión Base</th>
                    <th className="px-5 py-4 text-center">Gestor</th>
                    <th className="px-5 py-4 text-center no-print">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {(Array.isArray(auditLogs) ? auditLogs : []).map((log) => {
                    const isNoPay = log.type === CollectionLogType.NO_PAGO;
                    const comm = (log.amount || 0) * (localCommissionPercent / 100);
                    return (
                      <tr key={log.id} className="hover:bg-slate-50 transition-colors text-[11px] font-bold">
                        <td className="px-5 py-3 whitespace-nowrap uppercase">{formatLocalDate(log.date, state.settings.country)} <span className="text-[8px] text-slate-400 ml-1">{formatLocalTime(log.date, state.settings.country)}</span></td>
                        <td className="px-5 py-3 uppercase font-black text-black">{log._clientName}</td>
                        <td className="px-5 py-3 text-center">
                          <span className={`px-2 py-0.5 rounded text-[7px] font-black uppercase ${isNoPay ? 'bg-red-600 text-white' : log.isRenewal ? 'bg-amber-100 text-amber-700' : log.isVirtual ? 'bg-blue-100 text-blue-700' : 'bg-emerald-100 text-emerald-700'}`}>
                            {isNoPay ? 'No Pago' : log.isRenewal ? 'Liquid.' : log.isVirtual ? 'Transf.' : 'Efectivo'}
                          </span>
                        </td>
                        <td className="px-5 py-3 text-right font-mono font-black text-black">{isNoPay ? '-' : formatRawNumber(log.amount || 0, state.settings)}</td>
                        <td className="px-5 py-3 text-right font-mono font-black text-blue-600 bg-blue-50/20">{isNoPay ? '-' : formatRawNumber(comm, state.settings)}</td>
                        <td className="px-5 py-3 text-center uppercase text-[9px] text-black">{state.users.find(u => u.id === log.recordedBy)?.name || '---'}</td>
                        <td className="px-5 py-3 no-print">
                          <div className="flex justify-center gap-1">
                            <button
                              onClick={() => handleShareLogImage(log)}
                              disabled={isGeneratingImage && sharingLog?.id === log.id}
                              className={`w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shadow-sm active:scale-90 transition-all ${isGeneratingImage && sharingLog?.id === log.id ? 'opacity-50 animate-pulse' : ''}`}
                            >
                              {isGeneratingImage && sharingLog?.id === log.id ? <i className="fa-solid fa-spinner animate-spin"></i> : <i className="fa-solid fa-image"></i>}
                            </button>
                            {isPowerUser && (
                              <button onClick={() => { if (confirm('¿BORRAR ESTE PAGO DEFINITIVAMENTE? SE REVERTIRÁN LOS SALDOS.')) deleteCollectionLog?.(log.id); }} className="w-8 h-8 rounded-lg bg-red-50 text-red-600 flex items-center justify-center shadow-sm"><i className="fa-solid fa-trash"></i></button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="p-6 bg-slate-900 text-white flex flex-col md:flex-row justify-between items-center gap-6">
              <div className="flex flex-wrap gap-6 text-center md:text-left">
                <div><p className="text-[8px] font-black text-slate-500 uppercase">Recaudo Bruto</p><p className="text-xl font-black font-mono">{formatCurrency(totalCollectedInRange, state.settings)}</p></div>
                <div className="border-x border-white/10 px-6"><p className="text-[8px] font-black text-slate-500 uppercase">Eficiencia Ruta</p><p className="text-xl font-black text-emerald-400">{Math.round(effectiveIncentive * 100)}%</p></div>
                <div><p className="text-[8px] font-black text-slate-500 uppercase">Total a Renovar</p><p className="text-2xl font-black text-blue-400 font-mono">{formatCurrency(finalCommissionValue, state.settings)}</p></div>
              </div>
              <div className="flex gap-2 w-full md:w-auto">
                {/* Print button removed per feature request */}
                <button
                  onClick={handleExportExcel}
                  disabled={isGeneratingExcel}
                  className={`px-8 py-3 bg-emerald-600 text-white rounded-xl font-black text-[10px] uppercase tracking-widest shadow-xl active:scale-95 transition-all flex items-center justify-center gap-3 w-full md:w-auto ${isGeneratingExcel ? 'opacity-50 cursor-wait' : ''}`}
                >
                  {isGeneratingExcel ? <i className="fa-solid fa-spinner animate-spin"></i> : <i className="fa-solid fa-file-excel text-lg"></i>} EXPORTAR EXCEL
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TEMPLATE OCULTO PARA CAPTURA DE IMAGEN (NOTIFICACION/RECIBO) */}
      <div className="fixed -left-[4000px] top-0 pointer-events-none z-[-1]">
        {sharingLog && (() => {
          const client = (Array.isArray(state.clients) ? state.clients : []).find(c => c.id === sharingLog.clientId);
          const loan = (Array.isArray(state.loans) ? state.loans : []).find(l => l.id === sharingLog.loanId);
          if (!client || !loan) return null;

          const isNoPay = sharingLog.type === CollectionLogType.NO_PAGO;
          const installments = Array.isArray(loan.installments) ? loan.installments : [];
          const totalPaid = calculateTotalPaidFromLogs(loan, state.collectionLogs);
          const balance = loan.totalAmount - totalPaid;
          const settingsToUse = sharingLog.companySnapshot || state.settings;
          const daysOverdue = getDaysOverdue(loan, settingsToUse, totalPaid);
          const paidInstallments = installments.filter(i => i.status === PaymentStatus.PAID).length;

          return (
            <div ref={receiptImageRef} className="w-[600px] bg-white border-[12px] border-red-600 rounded-[3rem] p-10 font-sans overflow-hidden shadow-2xl">
              {/* Header Card */}
              <div className="bg-red-600 rounded-[2rem] p-8 text-center text-white mb-10 shadow-lg">
                <h1 className="text-5xl font-black uppercase tracking-tighter mb-1">{settingsToUse.companyName || 'ANEXO COBRO'}</h1>
                <p className="text-lg font-bold opacity-90 uppercase tracking-widest">
                  {isNoPay ? 'NOTIFICACIÓN DE VISITA (MORA)' : 'COMPROBANTE OFICIAL DE PAGO'}
                </p>
              </div>

              {/* Data Section */}
              <div className="space-y-8 px-4">
                <div className="border-b-2 border-slate-100 pb-6">
                  <p className="text-slate-400 text-xs font-black uppercase tracking-widest mb-2">CLIENTE / TITULAR</p>
                  <h2 className="text-4xl font-black text-slate-900 uppercase tracking-tight leading-normal py-4 break-words">{client.name}</h2>
                </div>

                <div className="grid grid-cols-2 gap-10">
                   <div>
                    <p className="text-slate-400 text-xs font-black uppercase tracking-widest mb-1">FECHA</p>
                    <p className="text-3xl font-black text-slate-900">{formatLocalDate(sharingLog.date, settingsToUse.country)}</p>
                  </div>
                  <div>
                    <p className="text-slate-400 text-xs font-black uppercase tracking-widest mb-1">HORA</p>
                    <p className="text-3xl font-black text-slate-900">{formatLocalTime(sharingLog.date, settingsToUse.country)}</p>
                  </div>
                </div>

                {/* Status Box */}
                <div className={`rounded-[2.5rem] p-10 text-center border-2 ${isNoPay ? 'bg-red-50 border-red-100' : 'bg-emerald-50 border-emerald-100'}`}>
                  <p className={`text-xs font-black uppercase tracking-widest mb-2 ${isNoPay ? 'text-red-500' : 'text-emerald-600'}`}>
                    ESTADO REGISTRADO
                  </p>
                  <h3 className={`text-5xl font-black uppercase tracking-tighter mb-2 ${isNoPay ? 'text-red-700' : 'text-emerald-700'}`}>
                    {isNoPay ? 'SIN ABONO HOY' : 'PAGO REGISTRADO'}
                  </h3>
                  <p className={`text-xs font-bold uppercase italic ${isNoPay ? 'text-red-400' : 'text-emerald-500'}`}>
                    {isNoPay ? 'FAVOR COMUNICARSE CON ADMINISTRACIÓN' : '¡GRACIAS POR SU PUNTUALIDAD!'}
                  </p>
                </div>

                {/* Metrics Box */}
                <div className="bg-slate-50 rounded-[2rem] p-8 space-y-4 border border-slate-200">
                  <div className="flex justify-between items-center">
                    <p className="text-sm font-black text-slate-500 uppercase tracking-widest">SALDO RESTANTE:</p>
                    <p className="text-3xl font-black text-red-600 font-mono">{formatCurrency(balance, settingsToUse)}</p>
                  </div>
                  <div className="flex justify-between items-center border-t border-slate-200 pt-4">
                    <p className="text-sm font-black text-slate-500 uppercase tracking-widest">DÍAS EN MORA:</p>
                    <p className="text-3xl font-black text-slate-900">{daysOverdue} días</p>
                  </div>
                  <div className="flex justify-between items-center border-t border-slate-200 pt-4">
                    <p className="text-sm font-black text-slate-500 uppercase tracking-widest">CUOTAS PAGADAS:</p>
                    <p className="text-3xl font-black text-slate-900">{paidInstallments} / {loan.totalInstallments}</p>
                  </div>
                </div>

                {/* Footer Image Content */}
                <div className="text-center pt-8 border-t-2 border-dashed border-slate-200 space-y-4">
                  <p className="text-slate-400 font-black text-[10px] uppercase tracking-[0.2em] leading-relaxed">
                    EVITE EL REPORTE NEGATIVO EN CENTRALES.<br />
                    DOCUMENTO GENERADO POR SISTEMA AUTOMATIZADO.<br />
                    SOPORTE: {settingsToUse.contactPhone || 'NO ASIGNADO'}
                  </p>
                  <div className="w-12 h-12 bg-slate-200 rounded-full flex items-center justify-center mx-auto">
                    <i className="fa-solid fa-circle-exclamation text-slate-400 text-2xl"></i>
                  </div>
                </div>
              </div>
            </div>
          );
        })()}
      </div>

      {/* RESUMEN GLOBAL RUTAS (SI ES MANAGER/ADMIN) */}
      {showGlobalSummary && (
        <div className="fixed inset-0 bg-slate-900/98 flex items-start pt-10 md:pt-20 justify-center z-[200] p-4 overflow-y-auto">
          <div className="bg-white w-full max-w-5xl rounded-[2.5rem] shadow-2xl flex flex-col overflow-hidden animate-scaleIn">
            <div className="p-6 md:p-8 bg-slate-900 text-white flex justify-between items-center">
              <h3 className="text-xl font-black uppercase tracking-tighter">Comparativa de Desempeño</h3>
              <button onClick={() => setShowGlobalSummary(false)} className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center"><i className="fa-solid fa-xmark"></i></button>
            </div>
            <div className="flex-1 overflow-y-auto p-6 md:p-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 bg-slate-800">
              {(Array.isArray(allCollectorsSummary) ? allCollectorsSummary : []).map(({ user, stats }) => (
                <div key={user.id} className="bg-slate-900 p-6 rounded-[2rem] border border-slate-700 shadow-lg space-y-4 hover:shadow-2xl transition-all">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-slate-800 rounded-2xl flex items-center justify-center font-black text-xl text-white">{user.name.charAt(0)}</div>
                    <div>
                      <h4 className="font-black text-white uppercase text-sm truncate">{user.name}</h4>
                      <p className="text-[8px] font-bold text-slate-400 uppercase">Corte hoy: {formatCurrency(stats.recaudoHoy, state.settings)}</p>
                    </div>
                  </div>
                  <div className="flex justify-between items-center bg-slate-800 p-3 rounded-xl border border-slate-700">
                    <span className="text-[9px] font-black text-slate-400 uppercase">Mora: <span className={stats.averageDelinquency > 20 ? 'text-red-400' : 'text-emerald-400'}>{Math.round(stats.averageDelinquency)}%</span></span>
                    <span className="text-[9px] font-black text-blue-400 uppercase">PAGO: {Math.round(stats.performanceFactor * 100)}%</span>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => { setShowCollectorHistoryId(user.id); }} className="flex-1 py-3 bg-blue-600 text-white rounded-xl font-black text-[9px] uppercase hover:bg-blue-500 active:scale-95 transition-all">HISTORIAL DE COBROS 30 DÍAS</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
      {/* MODAL HISTORIAL 30 DIAS */}
      {showCollectorHistoryId && (
        <div className="fixed inset-0 bg-slate-900/98 flex items-start pt-10 md:pt-20 justify-center z-[350] p-0 md:p-4 animate-fadeIn overflow-y-auto">
          <div className="bg-white w-full max-w-6xl md:rounded-[2.5rem] shadow-2xl flex flex-col border border-white/20">
            <div className="p-4 md:p-6 bg-slate-900 text-white flex justify-between items-center shrink-0">
              <div>
                <h3 className="text-lg font-black uppercase tracking-tighter">Historial de Cobros (Últimos 30 días)</h3>
                <p className="text-[10px] text-slate-400 font-bold uppercase mt-1">Gestor: {state.users.find(u => u.id === showCollectorHistoryId)?.name || '---'}</p>
              </div>
              <div className="flex items-center gap-4">
                <div className="flex flex-col items-end">
                  <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Comisión %</span>
                  <div className="flex items-center gap-1 bg-white/10 px-3 py-1.5 rounded-lg border border-white/10">
                    <input 
                      type="number" 
                      value={historyCommissionPercent} 
                      onChange={(e) => setHistoryCommissionPercent(Number(e.target.value))} 
                      className="w-12 bg-transparent text-right font-black text-white outline-none no-spinner" 
                    />
                    <span className="font-black text-slate-400">%</span>
                  </div>
                </div>
                <button onClick={() => setShowCollectorHistoryId(null)} className="w-10 h-10 bg-white/10 text-white rounded-xl flex items-center justify-center hover:bg-white/20 transition-colors"><i className="fa-solid fa-xmark"></i></button>
              </div>
            </div>

            <div className="flex-1 overflow-auto bg-white custom-scrollbar p-6">
              <h4 className="text-sm font-black text-blue-600 uppercase tracking-widest mb-4 flex items-center gap-2"><i className="fa-solid fa-money-bill-wave"></i> Recaudo de Cuotas</h4>
              {thirtyDayHistory.length === 0 ? (
                <div className="text-center py-6 text-slate-400 font-bold uppercase text-sm border-2 border-dashed border-slate-100 rounded-2xl mb-8">
                  No hay cobros registrados en los últimos 30 días para este gestor.
                </div>
              ) : (
                <div className="mb-10">
                <table className="w-full text-left border-collapse min-w-[800px]">
                  <thead className="bg-slate-100 rounded-t-xl">
                    <tr className="text-[10px] font-black text-slate-600 uppercase">
                      <th className="px-4 py-4 rounded-tl-xl">Semana Del</th>
                      <th className="px-4 py-4 text-right">Lunes</th>
                      <th className="px-4 py-4 text-right">Martes</th>
                      <th className="px-4 py-4 text-right">Miércoles</th>
                      <th className="px-4 py-4 text-right">Jueves</th>
                      <th className="px-4 py-4 text-right">Viernes</th>
                      <th className="px-4 py-4 text-right">Sábado</th>
                      <th className="px-4 py-4 text-right text-blue-700 bg-blue-50">Total Semanal</th>
                      <th className="px-4 py-4 text-right text-emerald-700 bg-emerald-50 rounded-tr-xl">Comisión {historyCommissionPercent}%</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {thirtyDayHistory.map((week, idx) => (
                      <tr key={idx} className="hover:bg-slate-50 transition-colors text-xs font-bold text-slate-800">
                        <td className="px-4 py-4 whitespace-nowrap text-[10px] uppercase text-slate-500">
                          {formatLocalDate(week.weekStart.toISOString(), state.settings.country)} al {formatLocalDate(week.weekEnd.toISOString(), state.settings.country)}
                        </td>
                        <td className="px-4 py-4 text-right font-mono">{week.Lunes > 0 ? formatCurrency(week.Lunes, state.settings) : '-'}</td>
                        <td className="px-4 py-4 text-right font-mono">{week.Martes > 0 ? formatCurrency(week.Martes, state.settings) : '-'}</td>
                        <td className="px-4 py-4 text-right font-mono">{week.Miércoles > 0 ? formatCurrency(week.Miércoles, state.settings) : '-'}</td>
                        <td className="px-4 py-4 text-right font-mono">{week.Jueves > 0 ? formatCurrency(week.Jueves, state.settings) : '-'}</td>
                        <td className="px-4 py-4 text-right font-mono">{week.Viernes > 0 ? formatCurrency(week.Viernes, state.settings) : '-'}</td>
                        <td className="px-4 py-4 text-right font-mono">{week.Sábado > 0 ? formatCurrency(week.Sábado, state.settings) : '-'}</td>
                        <td className="px-4 py-4 text-right font-mono text-blue-700 font-black bg-blue-50/30">{formatCurrency(week.Total, state.settings)}</td>
                        <td className="px-4 py-4 text-right font-mono text-emerald-700 font-black bg-emerald-50/30">{formatCurrency(week.Total * (historyCommissionPercent / 100), state.settings)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                </div>
              )}

              <h4 className="text-sm font-black text-orange-600 uppercase tracking-widest mt-6 mb-4 flex items-center gap-2 pt-4 border-t border-slate-100"><i className="fa-solid fa-hand-holding-dollar"></i> Colocación (Capital Prestado)</h4>
              {thirtyDayColocacionHistory.length === 0 ? (
                <div className="text-center py-6 text-slate-400 font-bold uppercase text-sm border-2 border-dashed border-slate-100 rounded-2xl">
                  No hay créditos entregados en los últimos 30 días para este gestor.
                </div>
              ) : (
                <table className="w-full text-left border-collapse min-w-[1000px]">
                  <thead className="bg-slate-100 rounded-t-xl">
                    <tr className="text-[10px] font-black text-slate-600 uppercase">
                      <th className="px-4 py-4 rounded-tl-xl">Semana Del</th>
                      <th className="px-4 py-4 text-center">Lunes</th>
                      <th className="px-4 py-4 text-center">Martes</th>
                      <th className="px-4 py-4 text-center">Miércoles</th>
                      <th className="px-4 py-4 text-center">Jueves</th>
                      <th className="px-4 py-4 text-center">Viernes</th>
                      <th className="px-4 py-4 text-center">Sábado</th>
                      <th className="px-4 py-4 text-right text-orange-700 bg-orange-50 rounded-tr-xl">Total Colocado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {thirtyDayColocacionHistory.map((week, idx) => {
                      const showDay = (nuevos: number, renov: number) => {
                         if (nuevos === 0 && renov === 0) return <span className="text-slate-300">-</span>;
                         return (
                           <div className="flex flex-col gap-1 items-center font-mono">
                             {nuevos > 0 && <span className="text-[9px] font-black bg-emerald-50 text-emerald-600 px-1.5 py-0.5 rounded shadow-sm w-full" title="Nuevo Cliente"><span className="text-emerald-400">N:</span> {formatCurrency(nuevos, state.settings)}</span>}
                             {renov > 0 && <span className="text-[9px] font-black bg-amber-50 text-amber-600 px-1.5 py-0.5 rounded shadow-sm w-full" title="Renovación"><span className="text-amber-400">R:</span> {formatCurrency(renov, state.settings)}</span>}
                           </div>
                         );
                      };
                      return (
                      <tr key={idx} className="hover:bg-slate-50 transition-colors text-xs font-bold text-slate-800">
                        <td className="px-4 py-4 whitespace-nowrap text-[10px] uppercase text-slate-500">
                          {formatLocalDate(week.weekStart.toISOString(), state.settings.country)} al {formatLocalDate(week.weekEnd.toISOString(), state.settings.country)}
                        </td>
                        <td className="px-4 py-4 text-center min-w-[120px]">{showDay(week.LunesN, week.LunesR)}</td>
                        <td className="px-4 py-4 text-center min-w-[120px]">{showDay(week.MartesN, week.MartesR)}</td>
                        <td className="px-4 py-4 text-center min-w-[120px]">{showDay(week.MiércolesN, week.MiércolesR)}</td>
                        <td className="px-4 py-4 text-center min-w-[120px]">{showDay(week.JuevesN, week.JuevesR)}</td>
                        <td className="px-4 py-4 text-center min-w-[120px]">{showDay(week.ViernesN, week.ViernesR)}</td>
                        <td className="px-4 py-4 text-center min-w-[120px]">{showDay(week.SábadoN, week.SábadoR)}</td>
                        <td className="px-4 py-4 text-right font-mono text-orange-700 bg-orange-50/30 w-40">
                          <span className="text-sm font-black block leading-none">{formatCurrency(week.TotalNuevos + week.TotalRenovados, state.settings)}</span>
                          <div className="flex flex-col gap-0.5 mt-2 text-[8px] font-bold uppercase tracking-wider text-orange-800/60">
                             {week.TotalNuevos > 0 && <span>+ Nuevos: {formatCurrency(week.TotalNuevos, state.settings)}</span>}
                             {week.TotalRenovados > 0 && <span>+ Renov.: {formatCurrency(week.TotalRenovados, state.settings)}</span>}
                          </div>
                        </td>
                      </tr>
                    )})}
                  </tbody>
                </table>
              )}
            </div>
            <div className="p-4 bg-slate-50 border-t border-slate-200 text-center md:rounded-b-[2.5rem]">
              <p className="text-[10px] text-slate-500 font-bold uppercase"><i className="fa-solid fa-info-circle mr-1"></i> El total semanal suma exclusivamente los cobros realizados de Lunes a Sábado.</p>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default CollectorCommission;
