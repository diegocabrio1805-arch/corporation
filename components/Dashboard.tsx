import React, { useEffect, useState, useMemo } from 'react';
import { CURRENT_VERSION_ID } from '../hooks/useAppInitialization';
import { AppState, CollectionLogType, Role, LoanStatus, PaymentStatus } from '../types';
import { formatCurrency, getLocalDateStringForCountry, getDaysOverdue, calculateTotalPaidFromLogs, calculateMonthlyStats, formatLocalDate, formatLocalTime } from '../utils/helpers';
import { getFinancialInsights } from '../services/geminiService';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { getTranslation } from '../utils/translations';
import { generateAuditPDF, generateDeletedPaymentsPDF } from '../utils/auditReportGenerator';
import PullToRefresh from './PullToRefresh';

interface DashboardProps {
  state: AppState;
}

const Dashboard: React.FC<DashboardProps> = ({ state }) => {
  const [insights, setInsights] = useState<any>(null);
  const [loadingInsights, setLoadingInsights] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 8;

  const t = getTranslation(state.settings.language).dashboard;
  const isAdmin = state.currentUser?.role === Role.ADMIN || state.currentUser?.role === Role.MANAGER;

  // Hoy según país
  const countryTodayStr = getLocalDateStringForCountry(state.settings.country);

  const fetchInsights = async () => {
    if (loadingInsights) return;
    setLoadingInsights(true);
    setInsights(null); // Reset previous insights
    try {
      const data = await getFinancialInsights(state);
      setInsights(data);
    } catch (e) {
      console.error("Error al obtener insights:", e);
    } finally {
      setLoadingInsights(false);
    }
  };

  // 1. Determine VISIBLE COLLECTORS based on strict rules
  const visibleCollectors = useMemo(() => {
    return (Array.isArray(state.users) ? state.users : []).filter(u => {
      if (u.name?.toUpperCase() === 'FABIAN PEDROZO') return false;
      if (u.role !== Role.COLLECTOR) return false;
      if (state.currentUser?.role === Role.COLLECTOR) {
        return u.id === state.currentUser.id;
      }
      // Admin/Manager sees only their direct reports
      const mId = (u.managedBy || (u as any).managed_by);
      return mId?.toLowerCase() === state.currentUser?.id?.toLowerCase();
    });
  }, [state.users, state.currentUser]);

  // 1.5. Precalcular sumas de abonos por préstamo de forma eficiente (O(L))
  const logsByLoanId = useMemo(() => {
    const map = new Map<string, number>();
    const logs = Array.isArray(state.collectionLogs) ? state.collectionLogs : [];
    for (const log of logs) {
      if (log.deletedAt) continue;
      const logType = String(log.type || '').toUpperCase();
      if (logType !== 'PAGO' && logType !== CollectionLogType.PAYMENT) continue;
      if (log.isOpening || (log as any).is_opening) continue;
      const loanId = log.loanId || log.loan_id;
      if (!loanId) continue;
      const amt = typeof log.amount === 'number' ? log.amount : (parseFloat(String(log.amount).replace(/[^\d.-]/g, '')) || 0);
      map.set(loanId, (map.get(loanId) || 0) + amt);
    }
    return map;
  }, [state.collectionLogs]);

  // 1.6. Precalcular logs de pago por préstamo para optimizar la verificación de créditos cancelados hoy
  const paymentLogsByLoanId = useMemo(() => {
    const map = new Map<string, any[]>();
    const logs = Array.isArray(state.collectionLogs) ? state.collectionLogs : [];
    for (const log of logs) {
      if (log.deletedAt) continue;
      if (log.type !== CollectionLogType.PAYMENT && String(log.type).toUpperCase() !== 'PAGO') continue;
      if (log.isOpening || (log as any).is_opening) continue;
      const loanId = log.loanId || log.loan_id;
      if (!loanId) continue;
      if (!map.has(loanId)) {
        map.set(loanId, []);
      }
      map.get(loanId)!.push(log);
    }
    return map;
  }, [state.collectionLogs]);

  // 1.7. Precalcular los días de mora de todos los créditos activos/vencidos una sola vez
  const loansOverdueMap = useMemo(() => {
    const map = new Map<string, number>();
    const loans = Array.isArray(state.loans) ? state.loans : [];
    for (const loan of loans) {
      if (loan.status !== LoanStatus.ACTIVE && loan.status !== LoanStatus.DEFAULT) continue;
      const paid = logsByLoanId.get(loan.id) || 0;
      const overdue = getDaysOverdue(loan, state.settings, paid);
      map.set(loan.id, overdue);
    }
    return map;
  }, [state.loans, state.settings, logsByLoanId]);

  const collectorStats = useMemo(() => {
    if (!isAdmin) return [];
    const todayDateStr = getLocalDateStringForCountry(state.settings.country); 

    const collectionLogsSafe = Array.isArray(state.collectionLogs) ? state.collectionLogs : [];
    const loansSafe = Array.isArray(state.loans) ? state.loans : [];
    const clientsSafe = Array.isArray(state.clients) ? state.clients : [];

    // Filter using country's YYYY-MM-DD
    const logsTodayBase = collectionLogsSafe.filter(log => {
      if (log.isOpening) return false;
      const logDateStr = getLocalDateStringForCountry(state.settings.country, new Date(log.date));
      return logDateStr === todayDateStr;
    });

    return visibleCollectors.map(user => {
      const uidLower = user.id.toLowerCase();
      // Use recordedBy + same date comparison method as Auditoría Histórica
      const logsToday = logsTodayBase.filter(log => {
        const logRecordedBy = (log.recordedBy || (log as any).recorded_by)?.toLowerCase();
        return logRecordedBy === uidLower;
      });

      const recaudoHoy = logsToday
        .filter(l => l.type === CollectionLogType.PAYMENT)
        .reduce((acc, curr) => acc + (curr.amount || 0), 0);

      const uniqueClientsVisitedToday = new Set(logsToday.map(l => l.clientId || (l as any).client_id)).size;
      const assignedLoans = loansSafe.filter(l =>
        (l.collectorId?.toLowerCase() === uidLower || (l as any).collector_id?.toLowerCase() === uidLower)
      );
      
      // Filtrar clientes para excluir los ocultos o eliminados (igual que en Cartera)
      const validClients = clientsSafe.filter(c => !c.isHidden && !c.deletedAt);
      const validClientIdsSet = new Set(validClients.map(c => c.id));

      const clientsMappedToLoans = new Set(
        assignedLoans
          .map(l => l.clientId || (l as any).client_id)
          .filter(id => validClientIdsSet.has(id))
      );
      const clientsAddedByThisCollector = validClients
        .filter(c => c.addedBy?.toLowerCase() === uidLower)
        .map(c => c.id);
      
      const allClientIdsForCollector = new Set([...Array.from(clientsMappedToLoans), ...clientsAddedByThisCollector]);
      const totalClientsCount = allClientIdsForCollector.size;
      
      const assignedActiveLoans = assignedLoans.filter(l => l.status === LoanStatus.ACTIVE);

      const overdueLoansCount = assignedActiveLoans.filter(loan => {
        return (loansOverdueMap.get(loan.id) || 0) > 0;
      }).length;

      const financialMoraRate = totalClientsCount > 0 ? (overdueLoansCount / totalClientsCount) * 100 : 0;
      const routeCompletionRate = totalClientsCount > 0 ? (uniqueClientsVisitedToday / totalClientsCount) * 100 : 0;
      const isRouteCompleted = totalClientsCount > 0 && uniqueClientsVisitedToday >= totalClientsCount;
      const monthlyStats = calculateMonthlyStats(loansSafe, collectionLogsSafe, new Date().getMonth(), new Date().getFullYear(), user.id);

      return {
        id: user.id,
        name: user.name,
        recaudo: recaudoHoy,
        monthlyGoal: monthlyStats.monthlyGoal,
        remainingGoal: monthlyStats.remainingBalance,
        financialMora: financialMoraRate,
        routeCompletion: routeCompletionRate,
        clientes: totalClientsCount,
        visitados: uniqueClientsVisitedToday,
        isCompleted: isRouteCompleted,
        overdueCount: overdueLoansCount
      };
    });
  }, [visibleCollectors, state.collectionLogs, state.loans, state.clients, isAdmin, countryTodayStr, loansOverdueMap]);


  const totalPrincipal = (Array.isArray(state.loans) ? state.loans : []).reduce((acc, l) => acc + l.principal, 0);
  const totalProfit = (Array.isArray(state.loans) ? state.loans : []).reduce((acc, l) => acc + (l.totalAmount - l.principal), 0);
  const totalExpenses = (Array.isArray(state.expenses) ? state.expenses : []).reduce((acc, e) => acc + e.amount, 0);
  const netUtility = totalProfit - totalExpenses;

  // Sumar el recaudo de hoy directamente desde las estadísticas de los cobradores (Auditoría de Rutas)
  // Esto asegura que el "Recaudo de Hoy" coincida exactamente con la suma de la tabla
  const collectedToday = collectorStats.reduce((acc, curr) => acc + curr.recaudo, 0);

  // Sumar todos los abonos históricos reales (excluyendo aperturas y pagos borrados)
  const totalCollectedAllTime = (Array.isArray(state.collectionLogs) ? state.collectionLogs : [])
    .filter(log => log.type === CollectionLogType.PAYMENT && !log.deletedAt)
    .reduce((acc, log) => acc + (log.amount || 0), 0);

  // Calcular el saldo pendiente total de los clientes (Capital en la Calle)
  const totalOwedAmount = (Array.isArray(state.loans) ? state.loans : [])
    .filter(l => l.status === LoanStatus.ACTIVE || l.status === LoanStatus.DEFAULT)
    .reduce((acc, l) => {
      const totalPaid = logsByLoanId.get(l.id) || 0;
      const remaining = Math.max(0, l.totalAmount - totalPaid);
      return acc + remaining;
    }, 0);

  // Calcular lo cobrado SOLO de los créditos que siguen activos (no cancelados/pagados)
  const totalPaidActiveLoans = (Array.isArray(state.loans) ? state.loans : [])
    .filter(l => {
      if (l.status === LoanStatus.ACTIVE || l.status === LoanStatus.DEFAULT) return true;
      if (l.status === LoanStatus.PAID) {
        const logsForLoan = paymentLogsByLoanId.get(l.id) || [];
        if (logsForLoan.length > 0) {
          const lastLog = logsForLoan.slice().sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];
          const logDateStr = getLocalDateStringForCountry(state.settings.country, new Date(lastLog.date));
          if (logDateStr === countryTodayStr) return true;
        }
      }
      return false;
    })
    .reduce((acc, l) => acc + (logsByLoanId.get(l.id) || 0), 0);

  const totalPages = Math.ceil(collectorStats.length / ITEMS_PER_PAGE);
  const paginatedCollectors = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return collectorStats.slice(start, start + ITEMS_PER_PAGE);
  }, [collectorStats, currentPage]);

  // --- LÓGICA AUDITOR GENERAL ---
  const [auditCollector, setAuditCollector] = useState<string>('all');
  const [auditStartDate, setAuditStartDate] = useState<string>(getLocalDateStringForCountry(state.settings.country));
  const [auditEndDate, setAuditEndDate] = useState<string>(getLocalDateStringForCountry(state.settings.country));

  // --- LÓGICA HISTORIAL ELIMINADOS VISUAL ---
  const [deletedStartDate, setDeletedStartDate] = useState<string>(getLocalDateStringForCountry(state.settings.country));
  const [deletedEndDate, setDeletedEndDate] = useState<string>(getLocalDateStringForCountry(state.settings.country));
  const [deletedPage, setDeletedPage] = useState(1);
  const DELETED_PER_PAGE = 5;

  const deletedLogsList = useMemo(() => {
    const [sYear, sMonth, sDay] = deletedStartDate.split('-').map(Number);
    const start = new Date(sYear, sMonth - 1, sDay, 0, 0, 0, 0);
    const [eYear, eMonth, eDay] = deletedEndDate.split('-').map(Number);
    const end = new Date(eYear, eMonth - 1, eDay, 23, 59, 59, 999);

    return (Array.isArray(state.collectionLogs) ? state.collectionLogs : [])
      .filter(log => {
        if (log.type !== CollectionLogType.DELETED_PAYMENT) return false;
        const logDate = new Date(log.date);
        return logDate >= start && logDate <= end;
      })
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [deletedStartDate, deletedEndDate, state.collectionLogs]);

  const totalDeletedPages = Math.ceil(deletedLogsList.length / DELETED_PER_PAGE);
  const paginatedDeletedLogs = useMemo(() => {
    const startIdx = (deletedPage - 1) * DELETED_PER_PAGE;
    return deletedLogsList.slice(startIdx, startIdx + DELETED_PER_PAGE);
  }, [deletedLogsList, deletedPage]);

  const auditMetrics = useMemo(() => {
    const [sYear, sMonth, sDay] = auditStartDate.split('-').map(Number);
    const start = new Date(sYear, sMonth - 1, sDay, 0, 0, 0, 0);
    const [eYear, eMonth, eDay] = auditEndDate.split('-').map(Number);
    const end = new Date(eYear, eMonth - 1, eDay, 23, 59, 59, 999);

    const logs = (Array.isArray(state.collectionLogs) ? state.collectionLogs : []).filter(log => {
      const logDate = new Date(log.date);
      const matchesDate = logDate >= start && logDate <= end;
      if (!matchesDate) return false;

      // Si se filtra por un cobrador específico, mantener el filtro
      if (auditCollector !== 'all') {
        const logRecordedBy = (log.recordedBy || (log as any).recorded_by)?.toLowerCase();
        return logRecordedBy === auditCollector.toLowerCase();
      }

      // Si es 'todos', no filtrar por visibleCollectors, sino mostrar lo que ya viene filtrado por App.tsx (sucursal)
      return true;
    });

    const totalRevenue = logs.filter(l => l.type === CollectionLogType.PAYMENT).reduce((acc, l) => acc + (l.amount || 0), 0);
    const activeClientsSet = new Set(logs.map(l => l.clientId || (l as any).client_id));
    const activeClients = activeClientsSet.size;

    // Clientes nuevos en el periodo
    const newClients = (Array.isArray(state.clients) ? state.clients : []).filter(c => {
      const cDate = new Date(c.createdAt);
      const isNew = cDate >= start && cDate <= end;
      if (!isNew) return false;
      // Si filtramos por cobrador, verificar si tiene prestamos con ese cobrador (aproximación)
      if (auditCollector !== 'all') {
        const hasLoanWithColl = (Array.isArray(state.loans) ? state.loans : []).some(l =>
          (l.clientId || (l as any).client_id) === c.id &&
          (l.collectorId || (l as any).collector_id)?.toLowerCase() === auditCollector.toLowerCase()
        );
        return hasLoanWithColl;
      }
      return true;
    }).length;

    // Comparativa con periodo anterior (Lógica de Tendencia DIARIA/PERIODICA)
    // Calculamos el rango del periodo anterior con la misma duración
    const duration = end.getTime() - start.getTime();
    const prevEnd = new Date(start.getTime() - 1);
    const prevStart = new Date(prevEnd.getTime() - duration);

    const previousLogs = (Array.isArray(state.collectionLogs) ? state.collectionLogs : []).filter(log => {
      const logDate = new Date(log.date);
      const matchesDate = logDate >= prevStart && logDate <= prevEnd;
      if (!matchesDate) return false;
      if (log.type !== CollectionLogType.PAYMENT) return false;
      if (auditCollector === 'all') return true;
      const logRecordedBy = (log.recordedBy || (log as any).recorded_by)?.toLowerCase();
      return logRecordedBy === auditCollector.toLowerCase();
    });

    const previousRevenue = previousLogs.reduce((acc, l) => acc + (l.amount || 0), 0);

    // TENDENCIA: Solo "Aumentó" si supera estrictamente al periodo anterior.
    // Si es igual o menor -> Disminuyó o Se Mantiene.
    // User Request: "solo cuando el monto pase lo cobrado lo del dia anterior este diga aumento"
    let revenueTrend: 'up' | 'down' | 'equal' = 'equal';
    if (totalRevenue > previousRevenue) revenueTrend = 'up';
    else if (totalRevenue < previousRevenue) revenueTrend = 'down';
    else revenueTrend = 'equal'; // 0 vs 0, or exact match

    const revenueIncreased = totalRevenue > previousRevenue; // Deprecated but kept for compatibility if needed internally
    const clientsIncreased = newClients > 0;

    // Daily Revenue for Graph (ALWAYS CURRENT WEEK: Mon-Sat)
    const currentWeekStart = new Date();
    const dayOfWeek = currentWeekStart.getDay() || 7; // 1=Mon ... 7=Sun
    currentWeekStart.setHours(0, 0, 0, 0);
    currentWeekStart.setDate(currentWeekStart.getDate() - (dayOfWeek - 1)); // Go to Monday

    const currentWeekEnd = new Date(currentWeekStart);
    currentWeekEnd.setDate(currentWeekEnd.getDate() + 5); // Go to Saturday
    currentWeekEnd.setHours(23, 59, 59, 999);

    const currentWeekLogs = (Array.isArray(state.collectionLogs) ? state.collectionLogs : []).filter(log => {
      const logDate = new Date(log.date);
      const matchesDate = logDate >= currentWeekStart && logDate <= currentWeekEnd;
      if (!matchesDate) return false;
      if (log.type !== CollectionLogType.PAYMENT) return false;
      if (auditCollector === 'all') return true;

      // FILTRO ESTRICTO: Solo mostrar pagos realizados por este usuario
      const logRecordedBy = (log.recordedBy || (log as any).recorded_by)?.toLowerCase();
      return logRecordedBy === auditCollector.toLowerCase();
    });

    const dailyRevenueMap = new Map<string, number>();
    currentWeekLogs.forEach(l => {
      // Normalizar día
      const d = new Intl.DateTimeFormat(state.settings.language || 'es', { weekday: 'short' }).format(new Date(l.date)).replace('.', '').toLowerCase();
      dailyRevenueMap.set(d, (dailyRevenueMap.get(d) || 0) + (l.amount || 0));
    });

    const daysOrder = Array.from({ length: 6 }, (_, i) => {
      const date = new Date(2023, 0, i + 2); // 2023-01-02 is Monday
      return new Intl.DateTimeFormat(state.settings.language || 'es', { weekday: 'short' }).format(date).replace('.', '').toLowerCase();
    });
    const dailyRevenue = daysOrder.map(day => {
      // Buscar keys que empiecen con el día (por si acaso 'miércoles' vs 'mié')
      const key = Array.from(dailyRevenueMap.keys()).find(k => k.startsWith(day));
      return {
        day: day.charAt(0).toUpperCase() + day.slice(1),
        amount: key ? dailyRevenueMap.get(key) || 0 : 0
      };
    });

    // --- LÓGICA EXTENDIDA: Clientes Sin Pago y Tendencias ---

    // 1. Clientes Sin Pago (Clientes activos del cobrador que NO pagaron en el periodo)
    const relevantLoans = (Array.isArray(state.loans) ? state.loans : []).filter(l => {
      if (l.status !== LoanStatus.ACTIVE) return false;
      if (auditCollector === 'all') return true;
      const lCollectorId = (l.collectorId || (l as any).collector_id)?.toLowerCase();
      return lCollectorId === auditCollector.toLowerCase();
    });
    const relevantClientIds = new Set(relevantLoans.map(l => l.clientId || (l as any).client_id));
    const paidClientIds = new Set(logs.filter(l => l.type === CollectionLogType.PAYMENT).map(l => l.clientId || (l as any).client_id));

    const clientsWithoutPayment = (Array.isArray(state.clients) ? state.clients : [])
      .filter(c => relevantClientIds.has(c.id) && !paidClientIds.has(c.id))
      .map(c => {
        // Find active loan for this client and collector
        const loan = relevantLoans.find(l => (l.clientId || (l as any).client_id) === c.id);

        // Find VERY last payment (lifetime) or return null
        const clientLogs = loan ? (paymentLogsByLoanId.get(loan.id) || []) : [];
        const lastPayment = clientLogs.length > 0 ? clientLogs.slice().sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0] : null;

        // Calculate overdue days
        const daysOverdue = loan ? (loansOverdueMap.get(loan.id) || 0) : 0;

        // Calculate current balance (Sanitized)
        const totalAmt = loan ? (Number(loan.totalAmount) || 0) : 0;
        const paidAmt = loan ? (logsByLoanId.get(loan.id) || 0) : 0;
        const balance = totalAmt - paidAmt;

        return {
          id: c.id,
          name: c.name,
          phone: c.phone,
          lastPaymentDate: lastPayment ? lastPayment.date : null,
          lastPaymentAmount: lastPayment ? (Number(lastPayment.amount) || 0) : 0,
          daysOverdue,
          balance
        };
      })
      .filter(c => c.daysOverdue > 10) // Filter: Only show clients > 10 days overdue
      .sort((a, b) => b.daysOverdue - a.daysOverdue); // Sort by most overdue first

    // 2. Evolución Semanal (Dentro del rango seleccionado)
    const logsByWeek = new Map<string, number>();
    logs.filter(l => l.type === CollectionLogType.PAYMENT).forEach(l => {
      const d = new Date(l.date);
      // Obtener lunes de la semana
      const day = d.getDay() || 7;
      if (day !== 1) d.setHours(-24 * (day - 1));
      const weekKey = `${d.getDate()}/${d.getMonth() + 1}`; // Ej: 2/2, 9/2
      logsByWeek.set(weekKey, (logsByWeek.get(weekKey) || 0) + (l.amount || 0));
    });
    // Ordenar por fecha (las keys ya deberían salir en orden si logs está ordenado, pero mejor asegurar)
    const weeklyRevenue = Array.from(logsByWeek.entries())
      .map(([label, amount]) => ({ label, amount }))
      // Orden simplificado por parsing de fecha
      .sort((a, b) => {
        const [d1, m1] = a.label.split('/').map(Number);
        const [d2, m2] = b.label.split('/').map(Number);
        return (m1 * 31 + d1) - (m2 * 31 + d2);
      });

    // 3. Evolución Mensual (Contexto Anual - Ene a Dic del año actual)
    const currentYear = new Date().getFullYear();
    const allCollectorLogs = (Array.isArray(state.collectionLogs) ? state.collectionLogs : []).filter(l => {
      if (l.type !== CollectionLogType.PAYMENT) return false;
      const d = new Date(l.date);
      if (d.getFullYear() !== currentYear) return false;

      if (auditCollector === 'all') return true;

      // FILTRO ESTRICTO: Solo mostrar pagos realizados por este usuario
      const logRecordedBy = (l.recordedBy || (l as any).recorded_by)?.toLowerCase();
      return logRecordedBy === auditCollector.toLowerCase();
    });

    const months = Array.from({ length: 12 }, (_, i) => {
      const date = new Date(2023, i, 1);
      const m = new Intl.DateTimeFormat(state.settings.language || 'es', { month: 'short' }).format(date).replace('.', '');
      return m.charAt(0).toUpperCase() + m.slice(1);
    });
    const logsByMonth = new Array(12).fill(0);
    allCollectorLogs.forEach(l => {
      const m = new Date(l.date).getMonth();
      logsByMonth[m] += (l.amount || 0);
    });
    const monthlyRevenue = months.map((m, i) => ({ label: m, amount: logsByMonth[i] }));

    // Efficiency (Recaudo / (ActiveClients * avg ticket?)) - Mock formula for visual
    const efficiency = activeClients > 0 ? Math.min(100, Math.round((totalRevenue / (activeClients * 10000)) * 100)) : 0;

    // Verdict based on Coverage %
    const totalClients = relevantClientIds.size;
    const coveragePct = totalClients > 0 ? (activeClients / totalClients) * 100 : 0;

    let verdict: string = 'MALO';
    if (coveragePct >= 75) verdict = 'EXCELENTE';
    else if (coveragePct >= 51) verdict = 'BUENO';
    else if (coveragePct >= 43) verdict = 'MEDIANAMENTE BUENO';
    else if (coveragePct >= 31) verdict = 'MEDIANAMENTE MALO';
    else verdict = 'MALO'; // < 31% (covers 0-30)

    return {
      totalRevenue, activeClients, newClients, efficiency, dailyRevenue,
      revenueIncreased, revenueTrend, clientsIncreased, verdict, logs,
      clientsWithoutPayment, weeklyRevenue, monthlyRevenue,
      totalClients: relevantClientIds.size
    };
  }, [auditCollector, auditStartDate, auditEndDate, state.collectionLogs, state.loans, state.clients]);

  const handleGenerateAuditPDF = () => {
    const collectorName = auditCollector === 'all' ? 'TODOS' : (Array.isArray(state.users) ? state.users : []).find(u => u.id.toLowerCase() === auditCollector.toLowerCase())?.name || 'DESCONOCIDO';
    generateAuditPDF({
      collectorName,
      startDate: auditStartDate,
      endDate: auditEndDate,
      ...auditMetrics,
      clients: state.clients,
      settings: state.settings
    });
  };

  const handleGenerateDeletedPaymentsPDF = () => {
    const collectorName = auditCollector === 'all' ? 'TODOS' : (Array.isArray(state.users) ? state.users : []).find(u => u.id.toLowerCase() === auditCollector.toLowerCase())?.name || 'DESCONOCIDO';
    const [sYear, sMonth, sDay] = auditStartDate.split('-').map(Number);
    const start = new Date(sYear, sMonth - 1, sDay, 0, 0, 0, 0);
    const [eYear, eMonth, eDay] = auditEndDate.split('-').map(Number);
    const end = new Date(eYear, eMonth - 1, eDay, 23, 59, 59, 999);

    const deletedLogs = (Array.isArray(state.collectionLogs) ? state.collectionLogs : []).filter(log => {
      if (log.type !== CollectionLogType.DELETED_PAYMENT) return false;
      const logDate = new Date(log.date);
      const matchesDate = logDate >= start && logDate <= end;
      if (!matchesDate) return false;

      if (auditCollector === 'all') return true;
      const logRecordedBy = (log.recordedBy || (log as any).recorded_by)?.toLowerCase();
      const logCollectorId = (log.collectorId || (log as any).collector_id)?.toLowerCase();
      return logRecordedBy === auditCollector.toLowerCase() || logCollectorId === auditCollector.toLowerCase();
    });

    generateDeletedPaymentsPDF({
      collectorName,
      startDate: auditStartDate,
      endDate: auditEndDate,
      logs: deletedLogs,
      settings: state.settings,
      users: state.users,
      clients: state.clients
    });
  };

  const chartData = [
    { name: (t as any).charts?.capital || 'Capital Inv.', value: totalPrincipal, color: '#6366f1' },
    { name: (t as any).charts?.income || 'Ingresos', value: totalProfit, color: '#10b981' },
    { name: (t as any).charts?.expenses || 'Gastos', value: totalExpenses, color: '#f43f5e' },
    { name: (t as any).charts?.utility || 'Utilidad', value: netUtility, color: '#3b82f6' },
  ];

  return (
    <div className="space-y-6 animate-fadeIn pb-24 max-w-[1600px] mx-auto px-4 md:px-0">
      {/* CABECERA SUPERIOR - Premium Glassmorphism */}
      <div className="flex flex-col md:flex-row justify-between items-center gap-4 glass-card p-6 rounded-3xl border-white/40">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 premium-gradient rounded-xl flex items-center justify-center shadow-xl shadow-emerald-500/20 transition-transform">
             <i className="fa-solid fa-chart-pie text-xl text-white"></i>
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-900 uppercase tracking-tight leading-none">{t.title ? t.title.split(' ')[0] : 'Resumen'} <span className="text-emerald-500">{t.title ? t.title.split(' ').slice(1).join(' ') : 'Operativo'}</span></h2>
            <div className="flex items-center gap-2 mt-1.5">
              <span className="text-[10px] bg-slate-900 text-white px-2 py-0.5 rounded-full font-bold tracking-wider uppercase">Sistema Core v{CURRENT_VERSION_ID}</span>
              <span className="text-[10px] bg-emerald-500/10 text-emerald-600 px-2 py-0.5 rounded-full font-bold tracking-wider uppercase flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></div>
                En Vivo
              </span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3 bg-slate-900 text-white px-5 py-2.5 rounded-2xl shadow-xl border border-white/5">
          <i className="fa-solid fa-calendar-day text-emerald-400 text-sm"></i>
          <span className="text-xs font-bold uppercase tracking-widest opacity-90">
            {formatLocalDate(new Date(), state.settings.country, { day: '2-digit', month: 'long', year: 'numeric' }, state.settings.language)}
          </span>
        </div>
      </div>

      {/* MÉTRICAS PRINCIPALES (KPIs) - High-End Floating Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-5">
        {[
          { label: (t as any).totalCollected || 'Total Recaudado', value: formatCurrency(totalCollectedAllTime, state.settings), icon: 'fa-vault', color: 'text-blue-500', bg: 'bg-blue-500/10' },
          { label: (t as any).collectedActive || 'Cobrado (Activos)', value: formatCurrency(totalPaidActiveLoans, state.settings), icon: 'fa-money-bill-wave', color: 'text-violet-500', bg: 'bg-violet-500/10' },
          { label: (t as any).clientBalance || 'Saldo Clientes', value: formatCurrency(totalOwedAmount, state.settings), icon: 'fa-sack-dollar', color: 'text-rose-500', bg: 'bg-rose-500/10' },
          { label: (t as any).projectedIncome || 'Ingresos Proyectados', value: formatCurrency(totalProfit, state.settings), icon: 'fa-arrow-trend-up', color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
          { label: (t as any).registeredCapital || 'Capital Registrado', value: formatCurrency(totalExpenses, state.settings), icon: 'fa-money-bill-transfer', color: 'text-indigo-500', bg: 'bg-indigo-500/10' },
          { label: (t as any).collectedToday || 'Recaudo de Hoy', value: formatCurrency(collectedToday, state.settings), icon: 'fa-hand-holding-dollar', color: 'text-amber-500', bg: 'bg-amber-500/10' },
        ].map((stat, i) => (
          <div key={i} className="bg-white p-5 rounded-3xl border border-slate-100 shadow-lg hover:shadow-xl transition-all group relative overflow-hidden active:scale-[0.98]">
            <div className={`absolute -right-4 -top-4 w-28 h-28 ${stat.bg} rounded-full blur-[40px] opacity-0 group-hover:opacity-100 transition-opacity`}></div>
            <div className="relative z-10 flex items-center gap-4">
              <div className={`w-12 h-12 rounded-2xl ${stat.bg} ${stat.color} flex shrink-0 items-center justify-center text-xl shadow-inner group-hover:scale-105 transition-transform duration-300`}>
                <i className={`fa-solid ${stat.icon}`}></i>
              </div>
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">{stat.label}</p>
                <p className="text-xl font-bold text-slate-900 font-mono tracking-tight">{stat.value}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

            {/* AUDITORÍA DE RUTAS - Premium Table */}
      {isAdmin && (
        <div className="bg-white rounded-3xl border border-slate-100 shadow-xl overflow-hidden flex flex-col transition-all">
          <div className="p-6 border-b border-slate-50 flex flex-col sm:flex-row justify-between items-center gap-4 bg-slate-50/50">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 bg-slate-900 rounded-xl flex items-center justify-center text-white shadow-md">
                <i className="fa-solid fa-list-check text-lg"></i>
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 uppercase tracking-widest leading-none">{(t as any).routeAudit || 'Auditoría de Rutas'}</h3>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1.5 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                  {(t as any).cashFlowMonitor || 'Monitoreo de Flujo de Efectivo'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-xl border border-slate-200 shadow-sm">
              <button
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(p => p - 1)}
                className="w-8 h-8 rounded-lg hover:bg-slate-50 flex items-center justify-center text-slate-400 disabled:opacity-20 transition-all border border-transparent"
              >
                <i className="fa-solid fa-chevron-left text-sm"></i>
              </button>
              <div className="flex items-center gap-1.5 px-4 border-x border-slate-100">
                <span className="text-sm font-bold text-slate-900 uppercase">{currentPage}</span>
                <span className="text-[10px] text-slate-400 uppercase">/ {totalPages}</span>
              </div>
              <button
                disabled={currentPage === totalPages || totalPages === 0}
                onClick={() => setCurrentPage(p => p + 1)}
                className="w-8 h-8 rounded-lg hover:bg-slate-50 flex items-center justify-center text-slate-400 disabled:opacity-20 transition-all border border-transparent"
              >
                <i className="fa-solid fa-chevron-right text-sm"></i>
              </button>
            </div>
          </div>

          <div className="overflow-x-auto custom-scrollbar">
            <div className="min-w-[1200px]">
              <table className="w-full text-left border-collapse table-fixed">
                <thead>
                  <tr className="bg-slate-900 text-white text-[10px] font-bold uppercase tracking-wider sticky top-0 z-20">
                    <th className="px-6 py-4 border-r border-white/5 w-1/4">{(t as any).collectorRoute || 'Cobrador / Ruta'}</th>
                    <th className="px-4 py-4 border-r border-white/5 text-center w-[15%]">{(t as any).collectedToday || 'Recaudo de Hoy'}</th>
                    <th className="px-4 py-4 border-r border-white/5 text-center w-[15%]">{(t as any).monthlyGoal || 'Meta Mensual'}</th>
                    <th className="px-4 py-4 border-r border-white/5 text-center w-[12%]">{(t as any).effectiveness || 'Efectividad'}</th>
                    <th className="px-6 py-4 border-r border-white/5 w-[20%]">{(t as any).visitProgress || 'Progreso de Visitas'}</th>
                    <th className="px-6 py-4 text-center w-[13%]">{(t as any).status || 'Estado'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100/60">
                  {paginatedCollectors.map((stat) => (
                    <tr key={stat.id} className="hover:bg-slate-50 transition-colors group text-sm">
                      <td className="px-6 py-3 border-r border-slate-50 bg-white group-hover:bg-slate-50">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-700 font-bold group-hover:bg-emerald-500 group-hover:text-white transition-all text-xs">
                            {stat.name.charAt(0)}
                          </div>
                          <div>
                            <p className="text-slate-800 font-bold uppercase truncate">{stat.name}</p>
                            <p className="text-[10px] text-emerald-600 font-semibold uppercase mt-0.5 opacity-80">{stat.clientes} Clientes</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 border-r border-slate-50 text-center font-mono font-bold text-emerald-600">
                        {formatCurrency(stat.recaudo, state.settings)}
                      </td>
                      <td className="px-4 py-3 border-r border-slate-50 text-center font-mono font-bold text-blue-600">
                        {formatCurrency(stat.monthlyGoal, state.settings)}
                      </td>
                      <td className="px-4 py-3 border-r border-slate-50 text-center">
                        <div className={`inline-flex items-center justify-center px-2.5 py-1 rounded-md text-[11px] font-bold font-mono border ${
                          stat.financialMora > 30 ? 'bg-rose-50 text-rose-600 border-rose-100' :
                          stat.financialMora > 10 ? 'bg-amber-50 text-amber-600 border-amber-100' : 
                          'bg-emerald-50 text-emerald-600 border-emerald-100'
                        }`}>
                          {Math.round(stat.financialMora)}%
                        </div>
                      </td>
                      <td className="px-6 py-3 border-r border-slate-50">
                        <div className="space-y-1.5">
                          <div className="flex justify-between items-center text-[10px] font-bold uppercase text-slate-500">
                             <span>{(t as any).performance || 'Rendimiento'}</span>
                             <span>{stat.visitados} / {stat.clientes}</span>
                          </div>
                          <div className="h-2 bg-slate-100 rounded-full overflow-hidden border border-slate-200/50 shadow-inner">
                            <div
                              className={`h-full rounded-full transition-all duration-1000 ${stat.isCompleted ? 'bg-emerald-500' : 'bg-blue-500'}`}
                              style={{ width: `${Math.max(5, stat.routeCompletion)}%` }}
                            />
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-3 text-center">
                        {stat.isCompleted ? (
                          <span className="w-full inline-flex items-center justify-center gap-1.5 py-1.5 bg-emerald-50 text-emerald-600 border border-emerald-200 rounded-lg text-[10px] font-bold uppercase tracking-wider">
                            <i className="fa-solid fa-check"></i> {(t as any).ready || 'Listo'}
                          </span>
                        ) : (
                          <span className="w-full inline-flex items-center justify-center gap-1.5 py-1.5 bg-slate-100 text-slate-600 border border-slate-200 rounded-lg text-[10px] font-bold uppercase tracking-wider">
                            <i className="fa-solid fa-clock opacity-50"></i> {(t as any).pending || 'PEND.'}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* SECCIÓN INFERIOR: GRÁFICOS E INSIGHTS - High-End Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* GRÁFICO DE RENDIMIENTO */}
        <div className="lg:col-span-8 bg-white p-6 rounded-3xl border border-slate-100 shadow-xl flex flex-col transition-all">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 bg-emerald-500 rounded-xl flex items-center justify-center text-white shadow-lg shadow-emerald-500/20">
                <i className="fa-solid fa-chart-line text-lg"></i>
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900 uppercase tracking-tight leading-none">{(t as any).operationalTrend || 'Tendencia Operativa'}</h3>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">{(t as any).capitalMetrics || 'Métricas de Capital'}</p>
              </div>
            </div>
          </div>

          <div className="h-[280px] w-full mt-auto bg-slate-50/50 rounded-2xl p-4 border border-slate-100 relative">
            <ResponsiveContainer width="100%" height={250} minWidth={0}>
              <BarChart data={chartData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis
                  dataKey="name"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 10, fill: '#64748b', fontWeight: 700 }}
                  dy={10}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 9, fill: '#94a3b8', fontWeight: 600 }}
                  tickFormatter={(val) => `$${(val / 1000).toFixed(0)}k`}
                />
                <Tooltip
                  cursor={{ fill: '#f1f5f9', opacity: 0.6 }}
                  contentStyle={{
                    borderRadius: '1rem',
                    border: 'none',
                    boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1)',
                    fontSize: '11px',
                    fontWeight: '700',
                    backgroundColor: '#1e293b',
                    color: '#fff',
                    padding: '12px'
                  }}
                  itemStyle={{ color: '#fff', padding: '2px 0' }}
                  formatter={(value: number) => formatCurrency(value, state.settings)}
                />
                <Bar dataKey="value" name={(t as any).charts?.value || 'Value'} radius={[12, 12, 0, 0]} barSize={40}>
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* MÓDULO AUDITOR GENERAL PDF */}
        <div className="lg:col-span-4 bg-white p-6 rounded-3xl border border-slate-100 shadow-xl flex flex-col transition-all">
          <div className="flex flex-col items-center text-center space-y-3 mb-6">
            <div className="w-14 h-14 bg-rose-500 rounded-xl flex items-center justify-center text-white shadow-lg shadow-rose-500/20 rotate-3">
              <i className="fa-solid fa-file-pdf text-2xl"></i>
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900 uppercase tracking-tight leading-none">{(t as any).pdfGenerator?.title || 'Generador PDF'}</h3>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1.5">{(t as any).pdfGenerator?.subtitle || 'Informes Auditables'}</p>
            </div>
          </div>

          <div className="space-y-4 flex-1 flex flex-col justify-between">
            <div className="space-y-3 p-4 bg-slate-50 rounded-2xl border border-slate-100">
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">{(t as any).pdfGenerator?.fieldAuditor || 'Auditor de Campo'}</label>
                <select
                  className="w-full h-10 px-3 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 appearance-none shadow-sm"
                  value={auditCollector}
                  onChange={(e) => setAuditCollector(e.target.value)}
                >
                  <option value="all">{(t as any).pdfGenerator?.allCollectors || 'TODOS LOS COBRADORES'}</option>
                  {(Array.isArray(state.users) ? state.users : [])
                    .filter(u => {
                      if (u.role !== Role.COLLECTOR) return false;
                      if (state.currentUser?.role === Role.COLLECTOR) return u.id === state.currentUser.id;
                      return u.managedBy === state.currentUser?.id;
                    })
                    .map(u => (
                      <option key={u.id} value={u.id}>{u.name.toUpperCase()}</option>
                    ))}
                </select>
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">{(t as any).pdfGenerator?.dateRange || 'Rango de Fecha'}</label>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="date"
                    className="w-full h-10 px-3 bg-white border border-slate-200 rounded-lg text-[10px] font-bold text-slate-700 shadow-sm leading-none"
                    value={auditStartDate}
                    onChange={(e) => setAuditStartDate(e.target.value)}
                  />
                  <input
                    type="date"
                    className="w-full h-10 px-3 bg-white border border-slate-200 rounded-lg text-[10px] font-bold text-slate-700 shadow-sm leading-none"
                    value={auditEndDate}
                    onChange={(e) => setAuditEndDate(e.target.value)}
                  />
                </div>
              </div>
            </div>

            <button
              onClick={handleGenerateAuditPDF}
              className="w-full py-3 premium-gradient text-white rounded-xl text-xs font-bold uppercase tracking-wider shadow-lg shadow-emerald-500/20 transition-all hover:shadow-emerald-500/30 flex items-center justify-center gap-2 mt-4"
            >
              <i className="fa-solid fa-file-export text-sm"></i>
              {(t as any).pdfGenerator?.generalAuditBtn || 'AUDITORÍA GENERAL'}
            </button>
            <button
              onClick={handleGenerateDeletedPaymentsPDF}
              className="w-full py-3 bg-rose-500 hover:bg-rose-600 text-white rounded-xl text-xs font-bold uppercase tracking-wider shadow-lg shadow-rose-500/20 transition-all flex items-center justify-center gap-2 mt-2"
            >
              <i className="fa-solid fa-trash-can-arrow-up text-sm"></i>
              {(t as any).pdfGenerator?.deletedAuditBtn || 'Auditoría Eliminados'}
            </button>
          </div>
        </div>
      </div>

      {/* HISTORIAL DE PAPELERA (PAGOS ELIMINADOS) */}
      {isAdmin && (
        <div className="bg-white rounded-3xl border border-rose-100 shadow-xl overflow-hidden flex flex-col transition-all mt-6">
          <div className="p-6 border-b border-rose-50 flex flex-col xl:flex-row justify-between items-center gap-4 bg-rose-50/50">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 bg-rose-500 rounded-xl flex items-center justify-center text-white shadow-md shadow-rose-500/20">
                <i className="fa-solid fa-trash-can-arrow-up text-lg"></i>
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 uppercase tracking-widest leading-none">{(t as any).deletedHistory?.title || 'Historial de Eliminados'}</h3>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1.5 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse"></span>
                  {(t as any).deletedHistory?.subtitle || 'Auditoría Visual de Pagos Borrados'}
                </p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-4 bg-white px-4 py-2 rounded-xl border border-slate-200 shadow-sm w-full xl:w-auto overflow-x-auto">
              <div className="flex items-center gap-2 shrink-0">
                <label className="text-[10px] font-bold text-slate-400 uppercase">{(t as any).deletedHistory?.from || 'Desde:'}</label>
                <input
                  type="date"
                  className="h-8 px-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-700 focus:outline-none"
                  value={deletedStartDate}
                  onChange={(e) => { setDeletedStartDate(e.target.value); setDeletedPage(1); }}
                />
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <label className="text-[10px] font-bold text-slate-400 uppercase">{(t as any).deletedHistory?.to || 'Hasta:'}</label>
                <input
                  type="date"
                  className="h-8 px-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-700 focus:outline-none"
                  value={deletedEndDate}
                  onChange={(e) => { setDeletedEndDate(e.target.value); setDeletedPage(1); }}
                />
              </div>
              
              <div className="h-6 w-px bg-slate-200 mx-1 hidden sm:block shrink-0"></div>
              
              <div className="flex items-center gap-2 shrink-0">
                <button
                  disabled={deletedPage === 1}
                  onClick={() => setDeletedPage(p => p - 1)}
                  className="w-8 h-8 rounded-lg hover:bg-slate-50 flex items-center justify-center text-slate-400 disabled:opacity-20 transition-all border border-transparent"
                >
                  <i className="fa-solid fa-chevron-left text-sm"></i>
                </button>
                <span className="text-xs font-bold text-slate-600 bg-slate-100 px-3 py-1 rounded-lg">
                  {deletedPage} / {Math.max(1, totalDeletedPages)}
                </span>
                <button
                  disabled={deletedPage === totalDeletedPages || totalDeletedPages === 0}
                  onClick={() => setDeletedPage(p => p + 1)}
                  className="w-8 h-8 rounded-lg hover:bg-slate-50 flex items-center justify-center text-slate-400 disabled:opacity-20 transition-all border border-transparent"
                >
                  <i className="fa-solid fa-chevron-right text-sm"></i>
                </button>
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-white border-b border-slate-100 text-[10px] uppercase tracking-wider text-slate-400 font-bold">
                  <th className="p-4 pl-6 whitespace-nowrap">{(t as any).deletedHistory?.table?.date || 'Fecha y Hora'}</th>
                  <th className="p-4 whitespace-nowrap">{(t as any).deletedHistory?.table?.type || 'Tipo'}</th>
                  <th className="p-4 whitespace-nowrap">{(t as any).deletedHistory?.table?.client || 'Cliente Afectado'}</th>
                  <th className="p-4 whitespace-nowrap">{(t as any).deletedHistory?.table?.originalCollector || 'Cobrador Original'}</th>
                  <th className="p-4 whitespace-nowrap">{(t as any).deletedHistory?.table?.deletedBy || 'Eliminado Por'}</th>
                  <th className="p-4 pr-6 text-right whitespace-nowrap">{(t as any).deletedHistory?.table?.amount || 'Monto Anulado'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {paginatedDeletedLogs.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-slate-400 font-medium text-sm">
                      <div className="flex flex-col items-center justify-center gap-3">
                        <i className="fa-solid fa-file-circle-check text-4xl text-slate-200"></i>
                        <p>{(t as any).deletedHistory?.empty || 'No se encontraron pagos eliminados en este rango de fechas.'}</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  paginatedDeletedLogs.map(log => {
                    const elimDate = new Date(log.date).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' });

                    // Parse JSON notes (new format) or fallback to legacy text format
                    let parsed: any = null;
                    try { parsed = log.notes ? JSON.parse(log.notes) : null; } catch (_) { parsed = null; }

                    let clientName: string;
                    let collName: string;
                    let adminName: string;
                    let deletedType: 'PAGO_ELIMINADO' | 'CREDITO_ELIMINADO' | 'CLIENTE_ELIMINADO';
                    let extraInfo: string | null = null;

                    const trans = (t as any).deletedHistory?.types || {};
                    const transRoles = (getTranslation(state.settings.language) as any).roles || {};

                    if (parsed && parsed.tipo) {
                      // New JSON format
                      deletedType = parsed.tipo;
                      clientName = parsed.clienteNombre || 'Desconocido';
                      collName = parsed.cobradorNombre || 'Desconocido';
                      adminName = parsed.eliminadoPorNombre || 'Administrador';
                      
                      const freqMap: any = { 'Diario': trans.daily || 'Diario', 'Diaria': trans.daily || 'Diaria', 'Semanal': trans.weekly || 'Semanal', 'Quincenal': trans.biweekly || 'Quincenal', 'Mensual': trans.monthly || 'Mensual' };
                      
                      if (parsed.tipo === 'PAGO_ELIMINADO' && parsed.fechaOriginalPago) {
                        extraInfo = `${trans.origPayment || 'Pago orig:'} ${new Date(parsed.fechaOriginalPago).toLocaleDateString()}`;
                      } else if (parsed.tipo === 'CREDITO_ELIMINADO') {
                        const freqStr = freqMap[parsed.frecuencia] || parsed.frecuencia;
                        extraInfo = `${parsed.cuotas} ${trans.quotas || 'cuotas'} · ${freqStr}`;
                      } else if (parsed.tipo === 'CLIENTE_ELIMINADO') {
                        extraInfo = `${parsed.creditosEliminados} ${trans.credit?.toLowerCase() || 'crédito'}s`;
                      }
                    } else {
                      // Legacy format
                      deletedType = 'PAGO_ELIMINADO';
                      clientName = (Array.isArray(state.clients) ? state.clients : []).find(c => c.id === log.clientId)?.name || 'Desconocido';
                      if (log.notes?.includes('[CLIENT_DELETED]')) {
                        deletedType = 'CLIENTE_ELIMINADO';
                        clientName = log.notes.replace('[CLIENT_DELETED] Cliente: ', '') || clientName;
                      } else if (log.notes?.includes('[LOAN_DELETED]')) {
                        deletedType = 'CREDITO_ELIMINADO';
                        clientName = log.notes.replace('[LOAN_DELETED] Cliente: ', '') || clientName;
                      }
                      adminName = (Array.isArray(state.users) ? state.users : []).find(u => u.id === log.recordedBy)?.name || 'Admin';
                      collName = (Array.isArray(state.users) ? state.users : []).find(u => u.id === log.collectorId)?.name || 'Desconocido';
                    }

                    if (adminName.toUpperCase() === 'ADMINISTRADOR' || adminName.toUpperCase() === 'ADMIN') adminName = transRoles.admin || 'ADMINISTRADOR';
                    if (adminName.toUpperCase() === 'GERENTE') adminName = transRoles.manager || 'GERENTE';
                    if (collName.toUpperCase() === 'ADMINISTRADOR' || collName.toUpperCase() === 'ADMIN') collName = transRoles.admin || 'ADMINISTRADOR';
                    if (collName.toUpperCase() === 'GERENTE') collName = transRoles.manager || 'GERENTE';

                    const typeBadge = {
                      'PAGO_ELIMINADO':    { label: trans.payment || 'Monto Eliminado',   color: 'bg-orange-100 text-orange-700 border-orange-200' },
                      'CREDITO_ELIMINADO': { label: trans.credit || 'Crédito Eliminado', color: 'bg-purple-100 text-purple-700 border-purple-200' },
                      'CLIENTE_ELIMINADO': { label: trans.client || 'Cliente Eliminado', color: 'bg-rose-100 text-rose-700 border-rose-200' },
                    }[deletedType];

                    return (
                      <tr key={log.id} className="hover:bg-rose-50/30 transition-colors">
                        <td className="p-4 pl-6">
                          <span className="text-xs font-bold text-slate-700 bg-slate-100 px-2 py-1 rounded-md">{elimDate}</span>
                        </td>
                        <td className="p-4">
                          <span className={`inline-flex items-center px-2 py-1 rounded-md text-[9px] font-black uppercase tracking-wider border ${typeBadge.color}`}>
                            {typeBadge.label}
                          </span>
                          {extraInfo && <span className="block mt-1 text-[10px] text-slate-400 font-medium">{extraInfo}</span>}
                        </td>
                        <td className="p-4">
                          <span className="text-sm font-bold text-slate-800">{clientName.toUpperCase()}</span>
                        </td>
                        <td className="p-4">
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-[10px] font-bold text-slate-600">
                              {collName.substring(0,1).toUpperCase()}
                            </div>
                            <span className="text-xs font-bold text-slate-600">{collName.toUpperCase()}</span>
                          </div>
                        </td>
                        <td className="p-4">
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-full bg-rose-100 flex items-center justify-center text-[10px] font-bold text-rose-600">
                              {adminName.substring(0,1).toUpperCase()}
                            </div>
                            <span className="text-xs font-bold text-rose-600">{adminName.toUpperCase()}</span>
                          </div>
                        </td>
                        <td className="p-4 pr-6 text-right">
                          <span className="text-sm font-bold text-rose-500 font-mono tracking-tight">
                            {formatCurrency(log.amount || 0, state.settings)}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
