import React, { useEffect, useState, useMemo } from 'react';
import { AppState, CollectionLogType, Role, LoanStatus, PaymentStatus } from '../types';
import { formatCurrency, getLocalDateStringForCountry, getDaysOverdue, calculateTotalPaidFromLogs, calculateMonthlyStats } from '../utils/helpers';
import { getFinancialInsights } from '../services/geminiService';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { getTranslation } from '../utils/translations';
import { generateAuditPDF } from '../utils/auditReportGenerator';
import PullToRefresh from './PullToRefresh';
import { useSync } from '../hooks/useSync';

interface DashboardProps {
  state: AppState;
}

const Dashboard: React.FC<DashboardProps> = ({ state }) => {
  const { forceSync } = useSync();
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
      if (u.role !== Role.COLLECTOR) return false;
      if (state.currentUser?.role === Role.COLLECTOR) {
        return u.id === state.currentUser.id;
      }
      // Admin/Manager sees only their direct reports
      const mId = (u.managedBy || (u as any).managed_by);
      return mId?.toLowerCase() === state.currentUser?.id?.toLowerCase();
    });
  }, [state.users, state.currentUser]);

  const collectorStats = useMemo(() => {
    if (!isAdmin) return [];
    const todayDateStr = new Date().toDateString(); // Use toDateString() - same as CollectorCommission

    return visibleCollectors.map(user => {
      // Use recordedBy + same date comparison method as Auditoría Histórica
      const logsToday = (Array.isArray(state.collectionLogs) ? state.collectionLogs : []).filter(log => {
        const logRecordedBy = (log.recordedBy || (log as any).recorded_by)?.toLowerCase();
        return logRecordedBy === user.id.toLowerCase() &&
          new Date(log.date).toDateString() === todayDateStr &&
          !log.isOpening;
      });

      const recaudoHoy = logsToday
        .filter(l => l.type === CollectionLogType.PAYMENT)
        .reduce((acc, curr) => acc + (curr.amount || 0), 0);

      const uniqueClientsVisitedToday = new Set(logsToday.map(l => l.clientId || (l as any).client_id)).size;
      const assignedActiveLoans = (Array.isArray(state.loans) ? state.loans : []).filter(l =>
        (l.collectorId?.toLowerCase() === user.id.toLowerCase() || (l as any).collector_id?.toLowerCase() === user.id.toLowerCase()) &&
        l.status === LoanStatus.ACTIVE
      );
      const totalClientsCount = new Set(assignedActiveLoans.map(l => l.clientId || (l as any).client_id)).size;

      const overdueLoansCount = assignedActiveLoans.filter(loan => {
        return getDaysOverdue(loan, state.settings) > 0;
      }).length;

      const financialMoraRate = totalClientsCount > 0 ? (overdueLoansCount / totalClientsCount) * 100 : 0;
      const routeCompletionRate = totalClientsCount > 0 ? (uniqueClientsVisitedToday / totalClientsCount) * 100 : 0;
      const isRouteCompleted = totalClientsCount > 0 && uniqueClientsVisitedToday >= totalClientsCount;
      const monthlyStats = calculateMonthlyStats(state.loans, state.collectionLogs, new Date().getMonth(), new Date().getFullYear(), user.id);

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
  }, [visibleCollectors, state.collectionLogs, state.loans, state.clients, isAdmin, countryTodayStr]);


  const totalPrincipal = (Array.isArray(state.loans) ? state.loans : []).reduce((acc, l) => acc + l.principal, 0);
  const totalProfit = (Array.isArray(state.loans) ? state.loans : []).reduce((acc, l) => acc + (l.totalAmount - l.principal), 0);
  const totalExpenses = (Array.isArray(state.expenses) ? state.expenses : []).reduce((acc, e) => acc + e.amount, 0);
  const netUtility = totalProfit - totalExpenses;

  // Sumar el recaudo de hoy directamente desde las estadísticas de los cobradores (Auditoría de Rutas)
  // Esto asegura que el "Recaudo de Hoy" coincida exactamente con la suma de la tabla
  const collectedToday = collectorStats.reduce((acc, curr) => acc + curr.recaudo, 0);

  const totalPages = Math.ceil(collectorStats.length / ITEMS_PER_PAGE);
  const paginatedCollectors = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return collectorStats.slice(start, start + ITEMS_PER_PAGE);
  }, [collectorStats, currentPage]);

  // --- LÓGICA AUDITOR GENERAL ---
  const [auditCollector, setAuditCollector] = useState<string>('all');
  const [auditStartDate, setAuditStartDate] = useState<string>(getLocalDateStringForCountry(state.settings.country));
  const [auditEndDate, setAuditEndDate] = useState<string>(getLocalDateStringForCountry(state.settings.country));

  const auditMetrics = useMemo(() => {
    const start = new Date(auditStartDate);
    start.setHours(0, 0, 0, 0);
    const end = new Date(auditEndDate);
    end.setHours(23, 59, 59, 999);

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
      const d = new Date(l.date).toLocaleDateString('es-CO', { weekday: 'short' }).replace('.', '').toLowerCase();
      dailyRevenueMap.set(d, (dailyRevenueMap.get(d) || 0) + (l.amount || 0));
    });

    const daysOrder = ['lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
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
        const clientLogs = (Array.isArray(state.collectionLogs) ? state.collectionLogs : [])
          .filter(l => (l.clientId || (l as any).client_id) === c.id && l.type === CollectionLogType.PAYMENT)
          .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

        const lastPayment = clientLogs.length > 0 ? clientLogs[0] : null;

        // Calculate overdue days
        const daysOverdue = loan ? getDaysOverdue(loan, state.settings) : 0;

        // Calculate current balance (Sanitized)
        const totalAmt = loan ? (Number(loan.totalAmount) || 0) : 0;
        const paidAmt = loan ? calculateTotalPaidFromLogs(loan, state.collectionLogs) : 0;
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

    const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
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

  const chartData = [
    { name: 'Capital Inv.', value: totalPrincipal, color: '#6366f1' },
    { name: 'Ingresos', value: totalProfit, color: '#10b981' },
    { name: 'Gastos', value: totalExpenses, color: '#f43f5e' },
    { name: 'Utilidad', value: netUtility, color: '#3b82f6' },
  ];

  return (
    <div className="space-y-4 animate-fadeIn pb-24 max-w-[1600px] mx-auto">
      {/* CABECERA SUPERIOR - Más compacta */}
      <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-white p-4 rounded-[1.5rem] border border-slate-100 shadow-sm">
        <div>
          <h2 className="text-xl font-black text-slate-900 uppercase tracking-tighter leading-none">Resumen Operativo <span className="text-[11px] bg-emerald-600 text-white px-2 py-0.5 rounded-lg font-black ml-2 animate-pulse">v6.1.170</span></h2>
          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1 flex items-center gap-2">
            <i className="fa-solid fa-chart-line text-emerald-500"></i>
            Panel de Control Principal
          </p>
        </div>
        <div className="flex items-center gap-3 bg-slate-900 text-white px-4 py-2 rounded-xl shadow-lg">
          <i className="fa-solid fa-calendar-day text-emerald-400 text-xs"></i>
          <span className="text-[9px] font-black uppercase tracking-widest">
            {new Date().toLocaleDateString('es-CO', { day: '2-digit', month: 'long', year: 'numeric' })}
          </span>
        </div>
      </div>

      {/* MÉTRICAS PRINCIPALES (KPIs) - Altura reducida */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'Utilidad Neta', value: formatCurrency(netUtility, state.settings), icon: 'fa-vault', color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-100' },
          { label: 'Ingresos Proy.', value: formatCurrency(totalProfit, state.settings), icon: 'fa-arrow-up-right-dots', color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-100' },
          { label: 'Capital Regist.', value: formatCurrency(totalExpenses, state.settings), icon: 'fa-money-bill-transfer', color: 'text-indigo-600', bg: 'bg-indigo-50', border: 'border-indigo-100' },
          { label: 'Recaudo de Hoy', value: formatCurrency(collectedToday, state.settings), icon: 'fa-hand-holding-dollar', color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-100' },
        ].map((stat, i) => (
          <div key={i} className={`bg-white p-4 rounded-2xl border ${stat.border} shadow-sm hover:shadow-md transition-all group overflow-hidden relative`}>
            <div className="flex items-center gap-3 relative z-10">
              <div className={`w-10 h-10 shrink-0 rounded-xl ${stat.bg} ${stat.color} flex items-center justify-center text-lg shadow-inner group-hover:scale-105 transition-transform`}>
                <i className={`fa-solid ${stat.icon}`}></i>
              </div>
              <div className="min-w-0">
                <p className="text-[7px] font-black text-slate-400 uppercase tracking-widest mb-0.5 truncate">{stat.label}</p>
                <p className={`text-xs md:text-sm font-black text-slate-800 font-mono tracking-tighter`}>{stat.value}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* CONTENEDOR CENTRAL: AUDITORÍA ESTILO EXCEL */}
      {isAdmin && (
        <div className="bg-white rounded-[2rem] border border-slate-200 shadow-lg overflow-hidden flex flex-col">
          <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row justify-between items-center gap-4 bg-slate-50/50">
            <div>
              <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest flex items-center gap-2">
                <i className="fa-solid fa-table-list text-blue-600"></i>
                Auditoría de Rutas
              </h3>
            </div>

            <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-xl border border-slate-200 shadow-sm">
              <button
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(p => p - 1)}
                className="w-6 h-6 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-400 disabled:opacity-20 transition-all"
              >
                <i className="fa-solid fa-chevron-left text-[10px]"></i>
              </button>
              <span className="text-[9px] font-black text-slate-800 uppercase tracking-widest px-2 border-x border-slate-100">
                {currentPage} / {totalPages || 1}
              </span>
              <button
                disabled={currentPage === totalPages || totalPages === 0}
                onClick={() => setCurrentPage(p => p + 1)}
                className="w-6 h-6 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-400 disabled:opacity-20 transition-all"
              >
                <i className="fa-solid fa-chevron-right text-[10px]"></i>
              </button>
            </div>
          </div>

          <div className="overflow-x-auto custom-scrollbar">
            <div className="min-w-[900px]">
              <table className="w-full text-left border-collapse table-fixed">
                <thead>
                  <tr className="bg-slate-900 text-white text-[8px] font-black uppercase tracking-widest sticky top-0 z-20">
                    <th className="px-5 py-3 border-r border-white/10 w-1/4">Cobrador / Ruta</th>
                    <th className="px-2 py-3 border-r border-white/10 text-center w-[12%]">Recaudo Hoy</th>
                    <th className="px-2 py-3 border-r border-white/10 text-center w-[12%]">Meta Mes</th>
                    <th className="px-5 py-3 border-r border-white/10 text-center w-[12%]">Ind. Mora</th>
                    <th className="px-5 py-3 border-r border-white/10 w-[20%]">Progreso Visitas</th>
                    <th className="px-5 py-3 text-center w-[18%]">Estatus</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {paginatedCollectors.map((stat) => (
                    <tr key={stat.id} className="hover:bg-blue-50/20 transition-colors group text-[10px] font-bold">
                      <td className="px-5 py-3 border-r border-slate-100 bg-white group-hover:bg-blue-50/5">
                        <p className="text-slate-900 font-black uppercase truncate tracking-tight">{stat.name}</p>
                        <p className="text-[7px] text-blue-500 font-black uppercase tracking-widest mt-0.5">{stat.clientes} Clientes</p>
                      </td>
                      <td className="px-2 py-3 border-r border-slate-100 text-center font-mono font-black text-emerald-600 bg-slate-50/20">
                        {formatCurrency(stat.recaudo, state.settings)}
                      </td>
                      <td className="px-2 py-3 border-r border-slate-100 text-center font-mono font-black text-blue-600 bg-blue-50/10">
                        {formatCurrency(stat.monthlyGoal, state.settings)}
                      </td>
                      <td className="px-5 py-3 border-r border-slate-100 text-center">
                        <span className={`px-2 py-0.5 rounded text-[8px] font-black font-mono border ${stat.financialMora > 30 ? 'bg-red-50 text-red-600 border-red-100' :
                          stat.financialMora > 10 ? 'bg-amber-50 text-amber-600 border-amber-100' : 'bg-emerald-50 text-emerald-700 border-emerald-100'
                          }`}>
                          {Math.round(stat.financialMora)}%
                        </span>
                      </td>
                      <td className="px-5 py-3 border-r border-slate-100">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden border border-slate-200 shadow-inner">
                            <div
                              className={`h-full transition-all duration-1000 ${stat.isCompleted ? 'bg-emerald-500' : 'bg-blue-500'}`}
                              style={{ width: `${Math.max(5, stat.routeCompletion)}%` }}
                            />
                          </div>
                          <span className="text-[8px] font-black text-slate-500 w-10 text-right">
                            {stat.visitados}/{stat.clientes}
                          </span>
                        </div>
                      </td>
                      <td className="px-5 py-3 text-center">
                        {stat.isCompleted ? (
                          <span className="px-2 py-0.5 bg-emerald-50 text-emerald-600 border border-emerald-100 rounded-full text-[7px] font-black uppercase flex items-center justify-center gap-1">
                            <i className="fa-solid fa-check-double"></i> CERRADA
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 bg-slate-100 text-slate-500 border border-slate-200 rounded-full text-[7px] font-black uppercase flex items-center justify-center gap-1">
                            <i className="fa-solid fa-clock"></i> {stat.clientes - stat.visitados} PEND.
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

      {/* SECCIÓN INFERIOR: GRÁFICOS E INSIGHTS IA - Altura Optimizada */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch">
        {/* GRÁFICO DE RENDIMIENTO - Achicado */}
        <div className="lg:col-span-7 bg-white p-5 rounded-[2rem] border border-slate-100 shadow-sm flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest flex items-center gap-2">
              <i className="fa-solid fa-chart-column text-indigo-500"></i>
              Métricas Mensuales
            </h3>
            <span className="text-[7px] font-black text-slate-400 uppercase">Datos Proyectados</span>
          </div>

          <div className="h-[250px] w-full mt-auto relative bg-slate-50/30 rounded-2xl p-2">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis
                  dataKey="name"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 9, fill: '#64748b', fontWeight: 800 }}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 8, fill: '#94a3b8' }}
                  tickFormatter={(val) => `$${(val / 1000).toFixed(0)}k`}
                />
                <Tooltip
                  cursor={{ fill: '#f1f5f9', opacity: 0.4 }}
                  contentStyle={{
                    borderRadius: '1rem',
                    border: '1px solid #e2e8f0',
                    boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
                    fontSize: '10px',
                    fontWeight: '800',
                    textTransform: 'uppercase',
                    backgroundColor: 'rgba(255, 255, 255, 0.95)'
                  }}
                  formatter={(value: number) => formatCurrency(value, state.settings)}
                />
                <Bar dataKey="value" radius={[6, 6, 0, 0]} animationDuration={1500}>
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* MÓDULO AUDITOR GENERAL PDF - Reemplaza Consultoría IA */}
        <div className="lg:col-span-12 bg-white p-5 rounded-[2rem] border border-slate-100 shadow-sm flex flex-col md:flex-row gap-6">
          {/* COLUMNA IZQUIERDA: CONTROLES */}
          <div className="w-full md:w-1/3 space-y-4">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center border border-blue-100">
                <i className="fa-solid fa-file-contract text-lg"></i>
              </div>
              <div>
                <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest leading-none">Auditor General PDF</h3>
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1">Generador de Reportes de Rendimiento</p>
              </div>
            </div>

            <div className="space-y-3 p-4 bg-slate-50 rounded-2xl border border-slate-100">
              {/* SELECTOR DE COBRADOR */}
              <div>
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Seleccionar Cobrador</label>
                <select
                  className="w-full p-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  value={auditCollector}
                  onChange={(e) => setAuditCollector(e.target.value)}
                >
                  <option value="all">Todos los Cobradores</option>
                  {(Array.isArray(state.users) ? state.users : [])
                    .filter(u => {
                      if (u.role !== Role.COLLECTOR) return false;
                      if (state.currentUser?.role === Role.COLLECTOR) return u.id === state.currentUser.id;
                      return u.managedBy === state.currentUser?.id;
                    })
                    .map(u => (
                      <option key={u.id} value={u.id}>{u.name}</option>
                    ))}
                </select>
              </div>

              {/* SELECTOR DE FECHAS */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Desde</label>
                  <input
                    type="date"
                    className="w-full p-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700"
                    value={auditStartDate}
                    onChange={(e) => setAuditStartDate(e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Hasta</label>
                  <input
                    type="date"
                    className="w-full p-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700"
                    value={auditEndDate}
                    onChange={(e) => setAuditEndDate(e.target.value)}
                  />
                </div>
              </div>

              {/* BOTONES */}
              <button
                className="w-full py-3 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-slate-900/10 transition-all flex items-center justify-center gap-2 active:scale-95"
                onClick={handleGenerateAuditPDF}
              >
                <i className="fa-solid fa-file-pdf text-red-400"></i>
                Descargar Informe PDF
              </button>
            </div>
          </div>

          {/* COLUMNA DERECHA: PREVISUALIZACIÓN DE MÉTRICAS */}
          <div className="w-full md:w-2/3 grid grid-cols-1 gap-4">

            {/* KPI 2: CLIENTES (Ahora único en fila superior) */}
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 flex flex-col justify-between">
              <div className="flex justify-between items-start">
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Crecimiento Cartera</span>
                {auditMetrics.clientsIncreased ? (
                  <span className="text-[9px] font-black text-blue-600 bg-blue-100 px-2 py-0.5 rounded-full flex items-center gap-1">
                    <i className="fa-solid fa-user-plus"></i> Creció
                  </span>
                ) : (
                  <span className="text-[9px] font-black text-amber-600 bg-amber-100 px-2 py-0.5 rounded-full flex items-center gap-1">
                    <i className="fa-solid fa-user-minus"></i> Se Mantiene
                  </span>
                )}
              </div>
              <div className="mt-4">
                <div className="flex items-baseline gap-2">
                  <p className="text-2xl font-black text-slate-800 font-mono">{auditMetrics.activeClients}</p>
                  <span className="text-xs font-bold text-blue-500 bg-blue-50 px-1.5 rounded">+{auditMetrics.newClients} Nuevos</span>
                </div>
                <p className="text-[9px] font-bold text-slate-500 mt-1">Total Clientes Activos</p>
              </div>
              <div className="h-1 bg-slate-200 rounded-full mt-4 overflow-hidden">
                <div className="h-full bg-blue-500 w-[60%]"></div>
              </div>
            </div>

            {/* GRÁFICO (EVOLUCIÓN SEMANAL) */}
            <div className="col-span-1 sm:col-span-2 bg-white p-4 rounded-2xl border border-slate-200 relative overflow-hidden flex flex-col">
              <div className="flex justify-between items-center mb-4">
                <h4 className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Evolución Diaria (Lunes - Sábado)</h4>
                <div className="flex gap-2 text-[7px] font-black uppercase text-slate-400">
                  <span className="flex items-center gap-1"><div className="w-1.5 h-1.5 rounded-full bg-rose-500"></div> Bajo</span>
                  <span className="flex items-center gap-1"><div className="w-1.5 h-1.5 rounded-full bg-amber-400"></div> Medio</span>
                  <span className="flex items-center gap-1"><div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div> Alto</span>
                </div>
              </div>

              <div className="flex items-end justify-between h-28 gap-2 mt-auto">
                {auditMetrics.dailyRevenue.map((day, i) => {
                  const maxVal = Math.max(...auditMetrics.dailyRevenue.map(d => d.amount), 1);
                  const heightPct = maxVal > 0 ? (day.amount / maxVal) * 100 : 0;

                  // Determinar color
                  let barColor = 'bg-rose-500'; // Bajo
                  if (day.amount > (maxVal * 0.66)) barColor = 'bg-emerald-500'; // Alto
                  else if (day.amount > (maxVal * 0.33)) barColor = 'bg-amber-400'; // Medio

                  return (
                    <div key={`${day.day}-${i}`} className="flex-1 flex flex-col justify-end items-center group relative h-full">
                      <div
                        className={`w-full ${barColor}/80 hover:${barColor} transition-all rounded-t-lg relative`}
                        style={{ height: `${Math.max(5, heightPct)}%` }}
                      >
                        <div className="absolute -top-6 left-1/2 -translate-x-1/2 bg-slate-800 text-white text-[8px] px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-10">
                          {formatCurrency(day.amount, state.settings)}
                        </div>
                      </div>
                      <span className="mt-2 text-[8px] font-bold text-slate-400 uppercase">{day.day.substring(0, 3)}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
