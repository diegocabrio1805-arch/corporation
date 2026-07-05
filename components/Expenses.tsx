
import React, { useState, useMemo } from 'react';
import { Expense, AppState, ExpenseCategory, IsolatedExpense, CollectionLogType, LoanStatus, Loan, CollectionLog, Role } from '../types';
import { formatCurrency, formatDate, getLocalDateStringForCountry, getDaysOverdue, generateUUID, calculateTotalPaidFromLogs, formatLocalDate, formatLocalTime } from '../utils/helpers';
import { getTranslation } from '../utils/translations';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, AreaChart, Area } from 'recharts';
import { ExpenseSpreadsheetModal } from './ExpenseSpreadsheetModal';

interface ExpensesProps {
  state: AppState;
  addExpense: (expense: Expense) => void;
  removeExpense: (id: string) => void;
  updateExpense: (expense: Expense) => void;
  updateInitialCapital: (amount: number) => void;
  onViewClientDossier?: (clientId: string) => void;
  updateSettings?: (settings: any, targetBranchId?: string) => void;
  addIsolatedExpenseAction?: (expense: IsolatedExpense) => void;
  removeIsolatedExpenseAction?: (id: string) => void;
}

const Expenses: React.FC<ExpensesProps> = ({ state, addExpense, removeExpense, updateExpense, updateInitialCapital, onViewClientDossier, updateSettings, addIsolatedExpenseAction, removeIsolatedExpenseAction }) => {

  // PROTECTION: If settings are not loaded yet, prevent crash
  if (!state.settings || !state.settings.country) {
    return <div className="p-10 text-center animate-pulse text-slate-400 font-bold uppercase tracking-widest">Cargando Configuración...</div>;
  }

  const countryTodayStr = getLocalDateStringForCountry(state.settings.country);

  const [showModal, setShowModal] = useState(false);
  const [showSpreadsheetModal, setShowSpreadsheetModal] = useState(false);
  const [showCapitalModal, setShowCapitalModal] = useState(false);
  const [initialCapitalForm, setInitialCapitalForm] = useState(state.initialCapital);
  const [selectedMonthDetail, setSelectedMonthDetail] = useState<{ month: number; year: number; name: string } | null>(null);
  const activeSettings = state.settings || {} as any;
  const [optimisticFuel, setOptimisticFuel] = useState<number | null>(null);
  const [showLedger, setShowLedger] = useState(false);
  const [topEditId, setTopEditId] = useState<string | null>(null);
  const [topEditAmt, setTopEditAmt] = useState('');
  
  const [formData, setFormData] = useState({
    description: '',
    amount: 0,
    category: ExpenseCategory.OTHERS,
    date: countryTodayStr
  });

  const t = getTranslation(state.settings.language);

  // LOGICA FINANCIERA SOLICITADA

  // 1. Dinero físico entregado (Préstamos nuevos, no renovaciones)
  const lentCash = useMemo(() => {
    return (Array.isArray(state.loans) ? state.loans : [])
      .filter(l => !l.isRenewal)
      .reduce((acc, l) => acc + l.principal, 0);
  }, [state.loans]);

  // 2. Cobros recibidos en efectivo real (No transferencias, no renovaciones/liquidaciones)
  const collectedCash = useMemo(() => {
    return (Array.isArray(state.collectionLogs) ? state.collectionLogs : [])
      .filter(l => l.type === CollectionLogType.PAYMENT && !l.isVirtual && !l.isRenewal && !l.isOpening)
      .reduce((acc, l) => acc + (l.amount || 0), 0);
  }, [state.collectionLogs]);

  const currentBranchId = state.currentUser ? (
    (state.currentUser.role === Role.ADMIN || state.currentUser.role === Role.MANAGER) 
      ? state.currentUser.id 
      : (state.currentUser.managedBy || (state.currentUser as any).managed_by || state.currentUser.id)
  ) : 'none';

  const branchExpenses = useMemo(() => {
    if (!currentBranchId) return [];
    return (Array.isArray(state.expenses) ? state.expenses : []).filter(e => e.branchId === currentBranchId);
  }, [state.expenses, currentBranchId]);

  // Dias del mes actual (Lunes a Domingo)
  const currentMonthDays = useMemo(() => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const days = [];
    for (let i = 1; i <= daysInMonth; i++) {
      const d = new Date(year, month, i);
      days.push(d); // Incluir todos los días (incluso Domingos por ahora)
    }
    return days;
  }, []);


  // 3. Gastos operativos totales
  const totalOperatingExpenses = useMemo(() => {
    return branchExpenses.reduce((acc, curr) => acc + curr.amount, 0);
  }, [branchExpenses]);

  // 4. Caja Actual (Efectivo disponible)
  const currentCashInHand = state.initialCapital + collectedCash - lentCash - totalOperatingExpenses;

  // 5. Créditos Otorgados (Conteo y Utilidad Total Proyectada)
  const totalLoansCount = (Array.isArray(state.loans) ? state.loans : []).length;
  const projectedTotalProfit = (Array.isArray(state.loans) ? state.loans : []).reduce((acc, l) => acc + (l.totalAmount - l.principal), 0);

  // 6. Mora Crítica (Saldos de créditos con > 40 días de atraso)
  const criticalMoraBalance = useMemo(() => {
    return (Array.isArray(state.loans) ? state.loans : [])
      .filter((l: any) => l.status !== LoanStatus.PAID && getDaysOverdue(l, state.settings) > 40)
      .reduce((acc: number, loan: any) => {
        const paid = calculateTotalPaidFromLogs(loan, state.collectionLogs);
        return acc + (loan.totalAmount - paid);
      }, 0);
  }, [state.loans, state.collectionLogs, state.settings]);

  // 6.5 Gastos de Mantenimiento / Gomería del Mes Actual
  const currentMonthMaintenance = useMemo(() => {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    return branchExpenses.filter(e => {
      const d = new Date(e.date);
      if (d.getMonth() === currentMonth && d.getFullYear() === currentYear) {
        const desc = (e.description || '').toLowerCase();
        return desc.includes('mantenimiento') || desc.includes('gomeria') || desc.includes('gomería') || desc.includes('cadena') || desc.includes('taller') || e.category === 'Mantenimiento';
      }
      return false;
    }).reduce((acc, curr) => acc + curr.amount, 0);
  }, [branchExpenses]);

  // 7. Balance Histórico (Rendimiento Operativo Diario - Últimos 180 días)
  const chartData = useMemo(() => {
    const dailyPoints = [];
    const monthlySummary: any[] = [];
    const now = new Date();
    const country = state.settings.country || 'CO';

    // 1. Pre-indexar TODAS las cuotas para acceso O(1)
    const dueByDate: Record<string, number> = {};
    (Array.isArray(state.loans) ? state.loans : []).forEach(loan => {
      (Array.isArray(loan.installments) ? loan.installments : []).forEach(inst => {
        const dStr = inst.dueDate.split('T')[0];
        dueByDate[dStr] = (dueByDate[dStr] || 0) + (Number(inst.amount) || 0);
      });
    });

    // 2. Pre-indexar TODOS los pagos (logs) para acceso O(1)
    const collectedByDate: Record<string, number> = {};
    (Array.isArray(state.collectionLogs) ? state.collectionLogs : []).forEach(log => {
      if ((log.type === 'PAGO' || log.type === CollectionLogType.PAYMENT) && !log.deletedAt) {
        const dStr = log.date.split('T')[0];
        collectedByDate[dStr] = (collectedByDate[dStr] || 0) + (Number(log.amount) || 0);
      }
    });

    // 3. Preparar contenedores para los 3 meses
    for (let i = 2; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      monthlySummary.push({
        name: d.toLocaleString(state.settings.language || 'es', { month: 'short' }).toUpperCase().replace('.', ''),
        year: d.getFullYear(),
        month: d.getMonth(),
        utilidad: 0,
        mora: 0,
        creditos: 0,
        renovaciones: 0,
        nuevos: 0
      });
    }

    // 4. Generar 90 puntos diarios
    for (let i = 89; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
      const dayIso = getLocalDateStringForCountry(state.settings.country, d);
      const monthIndex = d.getMonth();
      const year = d.getFullYear();
      const fullDate = formatLocalDate(d, state.settings.country, { day: 'numeric', month: 'short' });

      // CÁLCULO CORE: RENDIMIENTO VS EXPECTATIVA
      const expected = dueByDate[dayIso] || 0;
      const collected = collectedByDate[dayIso] || 0;

      // Utilidad = Lo realmente cobrado
      const utility = collected;
      // Mora = Lo que faltó cobrar para llegar al 100% de ese día
      const mora = Math.max(0, expected - collected);

      // Métricas de Volumen (Aperturas de ese día)
      const dayLoans = (Array.isArray(state.loans) ? state.loans : []).filter((l: Loan) => {
        const lDate = new Date(l.createdAt);
        return getLocalDateStringForCountry(state.settings.country, lDate) === dayIso;
      });
      const count = dayLoans.length;
      const renewals = dayLoans.filter((l: Loan) => l.isRenewal).length;
      const nuevos = count - renewals;

      const label = d.getDate() === 1 || i === 179 ? d.toLocaleString(state.settings.language || 'es', { month: 'short' }).toUpperCase().replace('.', '') : '';

      dailyPoints.push({
        dateKey: dayIso,
        name: label,
        fullDate,
        day: d.getDate().toString(),
        utilidad: utility,
        mora: mora,
        creditos: count,
        renovaciones: renewals,
        nuevos: nuevos
      });

      // Acumular en el resumen mensual
      const monthSum = monthlySummary.find(m => m.month === monthIndex && m.year === year);
      if (monthSum) {
        monthSum.utilidad += utility;
        monthSum.mora += mora;
        monthSum.creditos += count;
        monthSum.renovaciones += renewals;
        monthSum.nuevos += nuevos;
      }
    }

    return {
      dailyPoints,
      monthlySummary
    };
  }, [state.loans, state.collectionLogs]);

  const { dailyPoints, monthlySummary } = chartData;

  const newLoansInMonth = useMemo(() => {
    if (!selectedMonthDetail) return [];
    return (Array.isArray(state.loans) ? state.loans : [])
      .filter((l: Loan) => {
        const lDate = new Date(l.createdAt);
        return lDate.getMonth() === selectedMonthDetail.month && 
               lDate.getFullYear() === selectedMonthDetail.year && 
               !l.isRenewal;
      });
  }, [state.loans, selectedMonthDetail]);

  const handleUpdateCapital = (e: React.FormEvent) => {
    e.preventDefault();
    updateInitialCapital(initialCapitalForm);
    setShowCapitalModal(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const expense: Expense = {
      id: generateUUID(),
      description: formData.description,
      amount: formData.amount,
      category: formData.category,
      date: new Date(formData.date).toISOString(),
      branchId: state.currentUser?.managedBy || (state.currentUser as any)?.managed_by || state.currentUser?.id,
      addedBy: state.currentUser?.id
    };
    addExpense(expense);
    setShowModal(false);
    setFormData({
      description: '',
      amount: 0,
      category: ExpenseCategory.OTHERS,
      date: countryTodayStr
    });
  };

  return (
    <div className="space-y-4 md:space-y-6 animate-fadeIn pb-24 px-1 max-w-[1600px] mx-auto">

      {/* HEADER Y CARGA DE CAPITAL */}
      <div className="flex flex-col sm:flex-row justify-between items-center gap-4 bg-white p-4 md:p-6 rounded-[2rem] border border-slate-100 shadow-sm text-center sm:text-left">
        <div className="w-full sm:w-auto">
          <h2 className="text-xl md:text-2xl font-black text-slate-800 uppercase tracking-tighter">{state.settings.language === 'fr' ? 'CONTRÔLE DU CAPITAL' : state.settings.language === 'pt' ? 'CONTROLE DE CAPITAL' : 'CONTROL DE CAPITAL'}</h2>
          <p className="text-[10px] md:text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">{state.settings.language === 'fr' ? 'Gestion des flux de trésorerie opérationnels' : state.settings.language === 'pt' ? 'Gestão de fluxo de caixa operacional' : 'Gestión de flujo de caja operativo'}</p>
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <button
            onClick={() => setShowCapitalModal(true)}
            className="flex-1 sm:flex-none bg-slate-900 text-white px-6 py-3.5 rounded-xl font-black text-[10px] uppercase tracking-widest shadow-xl active:scale-95 transition-all flex items-center justify-center gap-2"
          >
            <i className="fa-solid fa-vault"></i>
            {state.settings.language === 'fr' ? 'CHARGER CAPITAL INITIAL' : state.settings.language === 'pt' ? 'CARREGAR CAPITAL INICIAL' : 'CARGAR CAPITAL INICIAL'}
          </button>

        </div>
      </div>

      {/* DASHBOARD DE CAPITAL OPERATIVO */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">

        {/* CUADRO 1: CAPITAL DE TRABAJO */}
        <div className="bg-white p-5 rounded-[2rem] border border-slate-100 shadow-sm relative overflow-hidden group">
          <div className="relative z-10">
            <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">{state.settings.language === 'fr' ? 'Capital de Travail' : state.settings.language === 'pt' ? 'Capital de Giro' : 'Capital de Trabajo'}</p>
            <h3 className="text-xl lg:text-2xl font-black text-slate-800 font-mono">{formatCurrency(state.initialCapital, state.settings)}</h3>
            <p className="text-[7px] font-bold text-slate-500 mt-2 uppercase">{state.settings.language === 'fr' ? 'Fonds de base initial chargé' : state.settings.language === 'pt' ? 'Fundo base inicial carregado' : 'Fondo base inicial cargado'}</p>
          </div>
          <i className="fa-solid fa-piggy-bank absolute -right-4 -bottom-4 text-6xl text-slate-50 group-hover:scale-110 transition-transform"></i>
        </div>

        {/* CUADRO 2: EFECTIVO EN CAJA (CON GANANCIAS Y DESCUENTOS) */}
        <div className="bg-slate-900 p-5 rounded-[2rem] shadow-xl relative overflow-hidden group">
          <div className="relative z-10">
            <p className="text-[8px] font-black text-emerald-400 uppercase tracking-widest mb-1">{state.settings.language === 'fr' ? 'Trésorerie Réelle' : state.settings.language === 'pt' ? 'Dinheiro Real em Caixa' : 'Efectivo Real en Caja'}</p>
            <h3 className={`text-xl lg:text-2xl font-black font-mono ${currentCashInHand >= 0 ? 'text-white' : 'text-red-400'}`}>
              {formatCurrency(currentCashInHand, state.settings)}
            </h3>
            <div className="mt-2 space-y-1">
              <div className="flex justify-between text-[7px] font-bold uppercase text-slate-400">
                <span>{state.settings.language === 'fr' ? 'Base + Recouv.:' : state.settings.language === 'pt' ? 'Base + Cobranças:' : 'Base + Cobros:'}</span>
                <span className="text-emerald-400">+{formatCurrency(state.initialCapital + collectedCash, state.settings)}</span>
              </div>
              <div className="flex justify-between text-[7px] font-bold uppercase text-slate-400">
                <span>{state.settings.language === 'fr' ? 'Livré + Dépenses:' : state.settings.language === 'pt' ? 'Entregue + Despesas:' : 'Entregado + Gastos:'}</span>
                <span className="text-red-400">-{formatCurrency(lentCash + totalOperatingExpenses, state.settings)}</span>
              </div>
            </div>
          </div>
          <div className="absolute top-2 right-2 px-2 py-0.5 bg-emerald-500/20 text-emerald-400 rounded-full text-[6px] font-black border border-emerald-500/30 animate-pulse">{state.settings.language === 'fr' ? 'EN DIRECT' : state.settings.language === 'pt' ? 'AO VIVO' : 'EN VIVO'}</div>
        </div>

        {/* CUADRO 3: CRÉDITOS OTORGADOS */}
        <div className="bg-blue-600 p-5 rounded-[2rem] text-white shadow-xl relative overflow-hidden group">
          <div className="relative z-10">
            <p className="text-[8px] font-black text-blue-200 uppercase tracking-widest mb-1">{state.settings.language === 'fr' ? 'Crédits Accordés' : state.settings.language === 'pt' ? 'Créditos Concedidos' : 'Créditos Otorgados'}</p>
            <div className="flex items-end gap-2">
              <h3 className="text-2xl lg:text-3xl font-black">{totalLoansCount}</h3>
              <span className="text-[8px] font-black mb-1 opacity-70 uppercase">{state.settings.language === 'fr' ? 'Opérations' : state.settings.language === 'pt' ? 'Operações' : 'Operaciones'}</span>
            </div>
            <div className="mt-3 pt-3 border-t border-white/10">
              <p className="text-[8px] font-black text-blue-200 uppercase">{state.settings.language === 'fr' ? 'Bénéfice Projeté' : state.settings.language === 'pt' ? 'Lucro Projetado' : 'Utilidad Proyectada'}</p>
              <p className="text-base lg:text-lg font-black font-mono">+{formatCurrency(projectedTotalProfit, state.settings)}</p>
            </div>
          </div>
          <i className="fa-solid fa-hand-holding-dollar absolute -right-4 -bottom-4 text-7xl text-white/10 group-hover:rotate-12 transition-transform"></i>
        </div>

        {/* CUADRO 4: MORA CRÍTICA (+40 DÍAS) */}
        <div className="bg-rose-50 p-5 rounded-[2rem] border border-rose-100 shadow-sm relative overflow-hidden group">
          <div className="relative z-10">
            <p className="text-[8px] font-black text-rose-600 uppercase tracking-widest mb-1">{state.settings.language === 'fr' ? 'Retard Critique (+40 j)' : state.settings.language === 'pt' ? 'Inadimplência Crítica (+40 d)' : 'Mora Crítica (+40 d)'}</p>
            <h3 className="text-xl lg:text-2xl font-black text-rose-700 font-mono">{formatCurrency(criticalMoraBalance, state.settings)}</h3>
            <p className="text-[7px] font-bold text-rose-400 mt-2 uppercase">{state.settings.language === 'fr' ? 'Capital à haut risque de perte' : state.settings.language === 'pt' ? 'Capital em alto risco de perda' : 'Capital en alto riesgo de pérdida'}</p>
          </div>
          <div className="absolute -right-2 top-2 w-12 h-12 bg-rose-200/30 rounded-full flex items-center justify-center animate-bounce">
            <i className="fa-solid fa-triangle-exclamation text-rose-600"></i>
          </div>
        </div>

      </div>

      {/* GRÁFICO DE BALANCE HISTÓRICO - 6 MESES */}
      <div className="bg-white p-6 md:p-8 rounded-[2rem] border border-slate-100 shadow-sm flex flex-col gap-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest flex items-center gap-2">
              <i className="fa-solid fa-chart-line text-blue-600"></i>
              {state.settings.language === 'fr' ? 'Bilan Historique des Crédits' : state.settings.language === 'pt' ? 'Balanço Histórico de Créditos' : 'Balance Histórico de Créditos'}
            </h3>
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1">{state.settings.language === 'fr' ? 'Rendement projeté et retards des 6 derniers mois' : state.settings.language === 'pt' ? 'Rendimento projetado e inadimplência dos últimos 6 meses' : 'Rendimiento proyectado y mora de los últimos 6 meses'}</p>
          </div>
          <div className="flex flex-wrap gap-4">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-black"></div>
              <span className="text-[8px] font-black text-slate-500 uppercase">{state.settings.language === 'fr' ? 'BÉNÉFICE' : state.settings.language === 'pt' ? 'LUCRO' : 'UTILIDAD'}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-rose-500"></div>
              <span className="text-[8px] font-black text-slate-500 uppercase">{state.settings.language === 'fr' ? 'RETARD' : state.settings.language === 'pt' ? 'INADIMPLÊNCIA' : 'MORA'}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-emerald-500"></div>
              <span className="text-[8px] font-black text-slate-500 uppercase">{state.settings.language === 'fr' ? 'RENOUVELLEMENTS' : state.settings.language === 'pt' ? 'RENOVAÇÕES' : 'RENOVACIONES'}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-indigo-400"></div>
              <span className="text-[8px] font-black text-slate-500 uppercase">{state.settings.language === 'fr' ? 'C. NOUVEAUX' : state.settings.language === 'pt' ? 'C. NOVOS' : 'C. NUEVOS'}</span>
            </div>
          </div>
        </div>

        <div className="h-[350px] w-full bg-[#f3f4f6] rounded-[2rem] p-6 relative shadow-inner">
          <ResponsiveContainer width="100%" height={300} minWidth={0}>
            <AreaChart data={dailyPoints} margin={{ top: 20, right: 30, left: 10, bottom: 0 }}>
              <defs>
                <linearGradient id="colorUtility" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#000000" stopOpacity={0.6} />
                  <stop offset="95%" stopColor="#000000" stopOpacity={0.1} />
                </linearGradient>
                <linearGradient id="colorMora" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#fca5a5" stopOpacity={0.6} />
                  <stop offset="95%" stopColor="#fca5a5" stopOpacity={0.2} />
                </linearGradient>
                <linearGradient id="colorRenov" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#86efac" stopOpacity={0.6} />
                  <stop offset="95%" stopColor="#86efac" stopOpacity={0.2} />
                </linearGradient>
                <linearGradient id="colorNuevos" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#a5b4fc" stopOpacity={0.6} />
                  <stop offset="95%" stopColor="#a5b4fc" stopOpacity={0.2} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={true} horizontal={true} stroke="#ffffff" strokeWidth={2} />
              <XAxis
                dataKey="dateKey"
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 9, fill: '#6b7280', fontWeight: 900 }}
                tickFormatter={(val, index) => {
                  // Only show the label if it was explicitly defined (1st of month or first point)
                  return dailyPoints[index]?.name || "";
                }}
                dy={15}
                interval={0}
              />
              <YAxis
                yAxisId="left"
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 8, fill: '#6b7280', fontWeight: 600 }}
                tickFormatter={(val: number) => `$${(val / 1000).toFixed(0)}k`}
              />
              <YAxis
                yAxisId="right"
                orientation="right"
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 8, fill: '#6b7280', fontWeight: 600 }}
              />
              <Tooltip
                contentStyle={{
                  borderRadius: '1.5rem',
                  border: 'none',
                  boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)',
                  fontSize: '11px',
                  fontWeight: '900',
                  textTransform: 'uppercase',
                  padding: '1rem'
                }}
                formatter={(value: any, name: any) => {
                  const isCount = ["RENOVACIONES", "RENOUVELLEMENTS", "RENOVAÇÕES", "CRÉDITOS NUEVOS", "CRÉDITS NOUVEAUX", "CRÉDITOS NOVOS"].includes(name as string);
                  return [isCount ? value : formatCurrency(Number(value), state.settings), name];
                }}
                labelFormatter={(label, items) => {
                  return items[0]?.payload?.fullDate || label;
                }}
              />
              <Area
                yAxisId="right"
                type="monotone"
                dataKey="nuevos"
                stroke="transparent"
                fill="transparent"
                strokeWidth={0}
                name={state.settings.language === 'fr' ? 'CRÉDITS NOUVEAUX' : state.settings.language === 'pt' ? 'CRÉDITOS NOVOS' : 'CRÉDITOS NUEVOS'}
                animationDuration={2500}
              />
              <Area
                yAxisId="left"
                type="monotone"
                dataKey="mora"
                stroke="#dc2626"
                strokeWidth={2}
                strokeDasharray="4 2"
                fillOpacity={1}
                fill="url(#colorMora)"
                name={state.settings.language === 'fr' ? 'RETARD EN ATTENTE' : state.settings.language === 'pt' ? 'INADIMPLÊNCIA PENDENTE' : 'MORA PENDIENTE'}
                animationDuration={2500}
              />
              <Area
                yAxisId="right"
                type="monotone"
                dataKey="renovaciones"
                stroke="transparent"
                fill="transparent"
                strokeWidth={0}
                name={state.settings.language === 'fr' ? 'RENOUVELLEMENTS' : state.settings.language === 'pt' ? 'RENOVAÇÕES' : 'RENOVACIONES'}
                animationDuration={2500}
              />
              <Area
                yAxisId="left"
                type="monotone"
                dataKey="utilidad"
                stroke="#000000"
                strokeWidth={3}
                fillOpacity={1}
                fill="url(#colorUtility)"
                name={state.settings.language === 'fr' ? 'BÉNÉFICE PROJETÉ' : state.settings.language === 'pt' ? 'LUCRO PROJETADO' : 'UTILIDAD PROYECTADA'}
                animationDuration={2500}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-4">
        {monthlySummary.map((month: any, idx: number) => (
          <div key={idx} className="bg-slate-50 p-6 rounded-[2rem] border border-slate-100 text-center hover:bg-white hover:shadow-xl transition-all group">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mb-3">{month.name}</p>
            <div className="flex flex-col gap-2">
              <p className="text-[14px] font-black text-slate-800 leading-tight">{month.creditos} {state.settings.language === 'fr' ? 'TOTAUX' : state.settings.language === 'pt' ? 'TOTAIS' : 'TOTALES'}</p>
              <div className="flex flex-col items-center gap-1 mt-1">
                <div className="flex items-center gap-2 justify-center">
                  <span className="text-[14px] font-black text-indigo-600 uppercase">
                    {month.nuevos} {state.settings.language === 'fr' ? 'NOUVEAUX' : state.settings.language === 'pt' ? 'NOVOS' : 'NUEVOS'}
                  </span>
                  {month.nuevos > 0 && (
                    <button
                      onClick={() => setSelectedMonthDetail(month)}
                      className="px-2 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all active:scale-95 shadow-sm cursor-pointer flex items-center gap-1 border border-indigo-100"
                      title={state.settings.language === 'fr' ? 'Voir nouveaux clients' : state.settings.language === 'pt' ? 'Ver novos clientes' : 'Ver clientes nuevos'}
                    >
                      <i className="fa-solid fa-user-plus text-[8px]"></i>
                      {state.settings.language === 'fr' ? 'Voir Client' : state.settings.language === 'pt' ? 'Ver Cliente' : 'Ver Cliente'}
                    </button>
                  )}
                </div>
                <span className="text-[14px] font-black text-emerald-700 uppercase">{month.renovaciones} {state.settings.language === 'fr' ? 'RENOUV.' : state.settings.language === 'pt' ? 'RENOV.' : 'RENOV.'}</span>
              </div>
            </div>
            <div className="mt-4 h-2 bg-slate-200/50 rounded-full overflow-hidden flex shadow-inner">
              <div
                className="h-full bg-indigo-500 transition-all duration-1000"
                style={{ width: `${(month.nuevos / Math.max(1, month.creditos)) * 100}%` }}
              ></div>
              <div
                className="h-full bg-emerald-500 transition-all duration-1000"
                style={{ width: `${(month.renovaciones / Math.max(1, month.creditos)) * 100}%` }}
              ></div>
            </div>
          </div>
        ))}
      </div>

      {/* TABLA DE GASTOS / SALIDAS DE CAPITAL (LEDGER) */}
      {showLedger && (
      <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden mb-6 animate-scaleIn">
        <div className="p-4 border-b border-slate-50 bg-slate-50/30 flex justify-between items-center">
          <h3 className="text-[10px] font-black text-slate-800 uppercase tracking-widest">{state.settings.language === 'fr' ? 'Historique des Sorties (Dépenses)' : state.settings.language === 'pt' ? 'Histórico de Saídas (Despesas)' : 'Historial de Salidas (Gastos)'}</h3>
          <button onClick={() => setShowLedger(false)} className="w-6 h-6 text-slate-400 hover:text-slate-600 bg-slate-100 rounded-full flex items-center justify-center transition-all"><i className="fa-solid fa-xmark text-xs"></i></button>
        </div>
        <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
          <table className="w-full text-left min-w-[500px]">
            <thead className="bg-slate-50 sticky top-0 z-10 shadow-sm">
              <tr className="text-[8px] font-black text-slate-400 uppercase tracking-widest">
                <th className="px-5 py-4 w-32">{state.settings.language === 'fr' ? 'Date' : state.settings.language === 'pt' ? 'Data' : 'Fecha'}</th>
                <th className="px-5 py-4">{state.settings.language === 'fr' ? 'Dépenses' : state.settings.language === 'pt' ? 'Despesas' : 'Gastos del Día'}</th>
                <th className="px-5 py-4 text-right w-32">{state.settings.language === 'fr' ? 'Total' : state.settings.language === 'pt' ? 'Total' : 'Total Día'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {currentMonthDays.map((d, index) => {
                const dateStr = d.toLocaleDateString('en-CA');
                const dayExpenses = (state.isolatedExpenses || []).filter(e => e.branchId === currentBranchId && e.date.startsWith(dateStr));
                const totalDay = dayExpenses.reduce((sum, e) => sum + e.amount, 0);
                const isToday = dateStr === new Date().toLocaleDateString('en-CA');
                const sym = state.settings.country === 'CO' ? '$' : 'Gs.';
                const fmtNum = (n: number) => formatCurrency(n, state.settings).replace(/[^0-9.,]/g, '').trim();
                
                return (
                  <tr key={index} className={`transition-colors text-[11px] font-bold ${isToday ? 'bg-slate-800 text-white' : 'hover:bg-slate-50/50'}`}>
                    <td className={`px-5 py-3 align-top border-r ${isToday ? 'border-slate-700' : 'border-slate-50'}`}>
                      <span className={`text-[9px] block uppercase font-black ${isToday ? 'text-slate-400' : 'text-slate-400'}`}>{d.toLocaleDateString('es', { weekday: 'short' })}</span>
                      <span className={`text-sm ${isToday ? 'text-white font-black' : 'text-slate-600'}`}>{d.toLocaleDateString('es', { day: '2-digit', month: '2-digit' })}</span>
                    </td>
                    <td className="px-5 py-3 align-top">
                      {dayExpenses.length > 0 ? (
                        <div className="space-y-1.5">
                           {dayExpenses.map(exp => {
                             const isEditing = topEditId === exp.id;
                             return (
                               <div key={exp.id} className="flex justify-between items-center bg-white border border-slate-100 p-2 rounded-lg shadow-sm group">
                                 <div className="flex items-center gap-2">
                                   <span className="px-1.5 py-0.5 rounded text-[8px] font-black uppercase bg-slate-100 text-slate-500">{exp.category}</span>
                                   <span className="text-slate-700">{exp.description || exp.category}</span>
                                 </div>
                                 <div className="flex items-center gap-2">
                                   {isEditing ? (
                                     <div className="flex items-center gap-1">
                                       <input 
                                         type="number" 
                                         autoFocus
                                         className="w-20 border border-emerald-300 rounded px-1 py-0.5 text-xs font-black text-right outline-none focus:ring-1 focus:ring-emerald-500" 
                                         value={topEditAmt} 
                                         onChange={e => setTopEditAmt(e.target.value)} 
                                       />
                                       <button onClick={() => {
                                         const amt = Number(topEditAmt);
                                         if (amt > 0 && removeIsolatedExpenseAction && addIsolatedExpenseAction) {
                                           removeIsolatedExpenseAction(exp.id);
                                           addIsolatedExpenseAction({ ...exp, amount: amt, updated_at: new Date().toISOString() });
                                         }
                                         setTopEditId(null);
                                       }} className="w-5 h-5 rounded bg-emerald-100 text-emerald-600 hover:bg-emerald-200 flex items-center justify-center">✓</button>
                                       <button onClick={() => setTopEditId(null)} className="w-5 h-5 rounded bg-slate-100 text-slate-500 hover:bg-slate-200 flex items-center justify-center">✕</button>
                                     </div>
                                   ) : (
                                     <>
                                       <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 mr-2">
                                         <button onClick={() => { setTopEditId(exp.id); setTopEditAmt(String(exp.amount)); }} className="w-5 h-5 rounded bg-blue-50 text-blue-500 hover:bg-blue-100 flex items-center justify-center transition-all"><i className="fa-solid fa-pen text-[9px]"></i></button>
                                         <button onClick={() => { if(window.confirm('¿Eliminar este gasto?')) removeIsolatedExpenseAction?.(exp.id); }} className="w-5 h-5 rounded bg-red-50 text-red-500 hover:bg-red-100 flex items-center justify-center transition-all"><i className="fa-solid fa-trash text-[9px]"></i></button>
                                       </div>
                                       <span className="font-mono font-black text-slate-800">{sym}{fmtNum(exp.amount)}</span>
                                     </>
                                   )}
                                 </div>
                               </div>
                             );
                           })}
                        </div>
                      ) : (
                        <span className="text-slate-300 italic text-[10px] uppercase font-black">{state.settings.language === 'fr' ? 'Aucune dépense' : state.settings.language === 'pt' ? 'Sem despesas' : 'Sin gastos'}</span>
                      )}
                    </td>
                    <td className="px-5 py-3 align-top text-right">
                       <span className={`font-black font-mono text-sm ${totalDay > 0 ? (isToday ? 'text-red-400' : 'text-red-500') : (isToday ? 'text-slate-600' : 'text-slate-300')}`}>
                         {totalDay > 0 ? `${sym}${fmtNum(totalDay)}` : '-'}
                       </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot className="bg-red-50/50 border-t border-red-100">
              <tr>
                <td colSpan={2} className="px-5 py-4 text-right text-[10px] font-black text-red-800 uppercase tracking-widest">
                  {state.settings.language === 'fr' ? 'TOTAL DU MOIS :' : state.settings.language === 'pt' ? 'TOTAL DO MÊS :' : 'TOTAL DEL MES :'}
                </td>
                <td className="px-5 py-4 font-black font-mono text-red-700 text-sm text-right">
                  {(() => {
                    const totalMes = currentMonthDays.reduce((acc, d) => {
                      const dateStr = d.toLocaleDateString('en-CA');
                      return acc + (state.isolatedExpenses || []).filter(e => e.branchId === currentBranchId && e.date.startsWith(dateStr)).reduce((sum, e) => sum + e.amount, 0);
                    }, 0);
                    return formatCurrency(totalMes, state.settings);
                  })()}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
      )}

      {/* MODAL CARGA CAPITAL INICIAL */}
      {
        showCapitalModal && (
          <div className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-start justify-center z-[200] p-4 overflow-y-auto pt-10 md:pt-20">
            <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-sm overflow-hidden animate-scaleIn border border-white/20">
              <div className="p-6 bg-slate-900 text-white flex justify-between items-center sticky top-0 z-10">
                <h3 className="text-lg font-black uppercase tracking-tighter">{state.settings.language === 'fr' ? 'Base de Capital' : state.settings.language === 'pt' ? 'Base de Capital' : 'Base de Capital'}</h3>
                <button onClick={() => setShowCapitalModal(false)} className="w-8 h-8 bg-white/10 text-white rounded-lg flex items-center justify-center hover:bg-red-600 transition-all">
                  <i className="fa-solid fa-xmark text-lg"></i>
                </button>
              </div>
              <form onSubmit={handleUpdateCapital} className="p-8 space-y-6 bg-slate-50">
                <div className="text-center">
                  <div className="w-16 h-16 bg-slate-200 text-slate-600 rounded-3xl flex items-center justify-center mx-auto mb-4 shadow-inner">
                    <i className="fa-solid fa-money-bill-transfer text-2xl"></i>
                  </div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{state.settings.language === 'fr' ? 'Définir le Capital de Travail' : state.settings.language === 'pt' ? 'Definir Capital de Giro' : 'Establecer Capital de Trabajo'}</p>
                </div>
                <div className="relative">
                  <span className="absolute left-5 top-1/2 -translate-y-1/2 text-2xl font-black text-slate-300">$</span>
                  <input
                    type="number"
                    autoFocus
                    value={initialCapitalForm}
                    onChange={(e) => setInitialCapitalForm(Number(e.target.value))}
                    className="w-full pl-12 pr-5 py-8 text-3xl font-black bg-white rounded-3xl text-center outline-none border-2 border-transparent focus:border-slate-900 transition-all text-slate-900 shadow-xl"
                  />
                </div>
                <div className="p-4 bg-blue-50 rounded-2xl border border-blue-100 text-[8px] font-bold text-blue-700 leading-relaxed uppercase">
                  <i className="fa-solid fa-circle-info mr-1"></i>
                  {state.settings.language === 'fr' ? 'Ce montant est le fonds initial avec lequel le sistema commencera à déduire les prêts accordés.' : state.settings.language === 'pt' ? 'Este valor é o fundo inicial com o qual o sistema começará a descontar os empréstimos concedidos.' : 'Este monto es el fondo inicial con el que el sistema empezará a descontar los préstamos otorgados.'}
                </div>
                <button type="submit" className="w-full font-black py-5 bg-slate-900 text-white rounded-2xl shadow-xl uppercase text-xs tracking-widest active:scale-95 transition-all">
                  {state.settings.language === 'fr' ? 'METTRE À JOUR LE FONDS' : state.settings.language === 'pt' ? 'ATUALIZAR FUNDO' : 'ACTUALIZAR FONDO'}
                </button>
              </form>
            </div>
          </div>
        )
      }

      {/* MODAL REGISTRAR GASTO */}
      {
        showModal && (
          <div className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-start justify-center z-[150] p-4 overflow-y-auto pt-10 md:pt-20">
            <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-md overflow-hidden animate-scaleIn flex flex-col border border-white/20">
              <div className="p-6 border-b border-slate-100 flex justify-between items-center sticky top-0 bg-white z-10">
                <h3 className="text-lg font-black text-slate-800 uppercase tracking-tighter">{state.settings.language === 'fr' ? 'Enregistrer Dépense' : state.settings.language === 'pt' ? 'Registrar Despesa' : 'Registrar Gasto'}</h3>
                <button onClick={() => setShowModal(false)} className="w-8 h-8 text-slate-400 hover:text-slate-600 active:scale-95 transition-all">
                  <i className="fa-solid fa-xmark text-xl"></i>
                </button>
              </div>
              <form onSubmit={handleSubmit} className="p-6 md:p-8 space-y-4 flex-1 overflow-y-auto bg-slate-50">
                <div className="flex gap-2 mb-2">
                    {(() => {
                      let totalSueldos = 0;
                      const branchUsers = (Array.isArray(state.users) ? state.users : []).filter(u => 
                        (u.managedBy || (u as any).managed_by || u.id) === currentBranchId
                      );
                      branchUsers.forEach((u) => {
                         const cfg = u.payConfig;
                         if (cfg) {
                            if (cfg.scheme === 'monthly') totalSueldos += (cfg.monthly || 0);
                            if (cfg.scheme === 'weekly') totalSueldos += (cfg.weekly || 0);
                         }
                      });

                      const fuelAmount = activeSettings?.defaultFuel || 0;
                      const projectedFuel = (fuelAmount / 6) * 26;
                      const totalNominaConCombustible = totalSueldos + projectedFuel;
                      
                      return (
                        <>
                          <button
                            type="button"
                            onClick={() => {
                               setFormData({ ...formData, description: 'PAGO DE NÓMINA', amount: totalSueldos });
                            }}
                            className="flex-1 px-1 py-2 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded-lg text-[8px] sm:text-[9px] font-black uppercase transition-colors text-center border border-emerald-200 active:scale-95 flex flex-col items-center justify-center gap-0.5"
                          >
                            <span className="flex items-center gap-1"><i className="fa-solid fa-money-check-dollar"></i> SUMA SUELDOS</span>
                            {totalSueldos > 0 && <span className="text-[10px] font-mono text-emerald-600 block leading-tight">{formatCurrency(totalSueldos, state.settings)}</span>}
                          </button>
                          <div className="flex-1 flex bg-orange-50 rounded-lg border border-orange-200 overflow-hidden active:scale-95 transition-transform">
                             <button
                              type="button"
                              onClick={() => {
                                 const fuel = activeSettings?.defaultFuel || 0;
                                 if (fuel > 0) {
                                   setFormData({ ...formData, description: 'COMBUSTIBLE DIARIO', amount: fuel });
                                 } else {
                                   setFormData({ ...formData, description: 'COMBUSTIBLE DIARIO' });
                                 }
                              }}
                              className="flex-1 px-1 py-2 text-orange-700 hover:bg-orange-100 text-[8px] sm:text-[9px] font-black uppercase transition-colors text-center flex flex-col items-center justify-center gap-0.5"
                            >
                              <span className="flex items-center gap-1"><i className="fa-solid fa-gas-pump"></i> COMBUSTIBLE DIARIO</span>
                              {(optimisticFuel !== null ? optimisticFuel : (activeSettings?.defaultFuel || 0)) > 0 ? (
                                <span className="text-[10px] font-mono text-orange-600 block leading-tight">{formatCurrency(optimisticFuel !== null ? optimisticFuel : (activeSettings?.defaultFuel || 0), state.settings)}</span>
                              ) : (
                                <span className="text-[10px] font-mono opacity-50 block leading-tight">Monto Libre</span>
                              )}
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                try {
                                  const saved = (optimisticFuel !== null ? optimisticFuel : (activeSettings?.defaultFuel || 0)).toString();
                                  const ans = window.prompt("Ingrese el monto diario para el combustible (0 para Monto Libre):", saved);
                                  if (ans !== null) {
                                    const parsed = parseFloat(ans.trim());
                                    const newVal = isNaN(parsed) ? 0 : parsed;
                                    const today = new Date().toISOString().split('T')[0];
                                    const newHistory = [...(activeSettings?.fuelHistory || []), { date: today, amount: newVal }];
                                    
                                    setOptimisticFuel(newVal);
                                    
                                    if (updateSettings) {
                                      // Pass currentBranchId explicitly to ensure isolated save per branch
                                      updateSettings({ ...activeSettings, defaultFuel: newVal, fuelHistory: newHistory }, currentBranchId).catch((e: any) => console.error("Error en updateSettings", e));
                                    }
                                    
                                    setFormData({ ...formData, description: 'COMBUSTIBLE DIARIO', amount: newVal });
                                  }
                                } catch (err: any) {
                                  alert("Error al actualizar: " + err.message);
                                }
                              }}
                              className="px-2 bg-orange-100 hover:bg-orange-200 text-orange-600 flex items-center justify-center transition-colors border-l border-orange-200"
                              title="Configurar monto de combustible diario"
                            >
                              <i className="fa-solid fa-pencil text-[9px]"></i>
                            </button>
                          </div>
                        </>
                      );
                   })()}                </div>

                <div className="space-y-1.5">
                  <label className="block text-[8px] font-black text-slate-400 uppercase ml-1">
                    {state.settings.language === 'fr' ? 'Description ou Catégorie' : state.settings.language === 'pt' ? 'Descrição ou Categoria' : 'Descripción o Categoría'}
                  </label>
                  <input
                    required
                    type="text"
                    list="expense-categories"
                    placeholder="EJ. MANTENIMIENTO, ALIMENTOS..."
                    value={formData.description || formData.category}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value.toUpperCase(), category: ExpenseCategory.OTHERS })}
                    className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-red-500 outline-none font-black text-slate-700 text-xs shadow-sm uppercase"
                  />
                  <datalist id="expense-categories">
                    {Object.values(ExpenseCategory).map(cat => (
                      <option key={cat} value={cat.toUpperCase()} />
                    ))}
                  </datalist>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="block text-[8px] font-black text-slate-400 uppercase ml-1">{state.settings.language === 'fr' ? 'Montant ($)' : state.settings.language === 'pt' ? 'Valor ($)' : 'Monto ($)'}</label>
                    <input
                      required
                      type="number"
                      value={formData.amount}
                      onChange={(e) => setFormData({ ...formData, amount: Number(e.target.value) })}
                      className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-red-500 outline-none font-black text-red-600 shadow-sm text-sm"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="block text-[8px] font-black text-slate-400 uppercase ml-1">{state.settings.language === 'fr' ? 'Date' : state.settings.language === 'pt' ? 'Data' : 'Fecha'}</label>
                    <input
                      required
                      type="date"
                      value={formData.date}
                      onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                      className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-red-500 outline-none font-bold text-slate-700 text-xs shadow-sm"
                      style={{ colorScheme: 'light' }}
                    />
                  </div>
                </div>
                <div className="flex flex-col gap-2 mt-4">
                  <button type="submit" className="w-full font-black py-4 bg-red-600 text-white rounded-xl shadow-xl shadow-red-600/20 uppercase tracking-widest active:scale-95 transition-all flex items-center justify-center gap-2 hover:bg-red-700">
                    <i className="fa-solid fa-check"></i>
                    GUARDAR GASTO DEL DÍA
                  </button>
                  <button 
                    type="button" 
                    onClick={() => {
                      setShowModal(false);
                      setShowSpreadsheetModal(true);
                    }}
                    className="w-full font-black py-3 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-xl uppercase tracking-widest active:scale-95 transition-all flex items-center justify-center gap-2 hover:bg-indigo-100"
                  >
                    <i className="fa-solid fa-file-excel"></i>
                    ABRIR PLANILLA EXCEL
                  </button>
                </div>
              </form>
            </div>
          </div>
        )
      }

      {/* MODAL PLANILLA EXCEL */}
      {showSpreadsheetModal && (
        <ExpenseSpreadsheetModal 
          state={state} 
          onClose={() => setShowSpreadsheetModal(false)} 
          addExpense={addExpense}
          removeExpense={removeExpense}
          updateExpense={updateExpense}
          updateSettings={updateSettings}
        />
      )}


      {/* MODAL DETALLE DE CLIENTES NUEVOS DEL MES */}
      {selectedMonthDetail && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-start justify-center z-[200] p-4 overflow-y-auto pt-10 md:pt-20">
          <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-2xl overflow-hidden animate-scaleIn border border-white/20">
            <div className="p-6 bg-slate-900 text-white flex justify-between items-center sticky top-0 z-10">
              <div>
                <h3 className="text-lg font-black uppercase tracking-tighter">
                  {state.settings.language === 'fr' ? 'Nouveaux Clients' : state.settings.language === 'pt' ? 'Novos Clientes' : 'Clientes Nuevos'}
                </h3>
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1">
                  {selectedMonthDetail.name} {selectedMonthDetail.year} - {newLoansInMonth.length} {state.settings.language === 'fr' ? 'ENREGISTRÉS' : state.settings.language === 'pt' ? 'REGISTRADOS' : 'REGISTRADOS'}
                </p>
              </div>
              <button 
                onClick={() => setSelectedMonthDetail(null)} 
                className="w-8 h-8 bg-white/10 text-white rounded-lg flex items-center justify-center hover:bg-red-600 transition-all"
              >
                <i className="fa-solid fa-xmark text-lg"></i>
              </button>
            </div>
            
            <div className="p-6 md:p-8 space-y-6 bg-slate-50 max-h-[70vh] overflow-y-auto custom-scrollbar">
              {newLoansInMonth.length === 0 ? (
                <div className="text-center py-10 text-slate-400 font-bold uppercase tracking-widest text-xs">
                  {state.settings.language === 'fr' ? 'Aucun nouveau client ce mois-ci' : state.settings.language === 'pt' ? 'Nenhum cliente novo este mês' : 'No hay clientes nuevos registrados en este mes'}
                </div>
              ) : (
                <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-100 text-[9px] font-black text-slate-500 uppercase border-b border-slate-200">
                        <th className="px-5 py-4">{state.settings.language === 'fr' ? 'Client' : state.settings.language === 'pt' ? 'Cliente' : 'Cliente'}</th>
                        <th className="px-5 py-4">{state.settings.language === 'fr' ? 'Collecteur' : state.settings.language === 'pt' ? 'Cobrador' : 'Cobrador'}</th>
                        <th className="px-5 py-4 text-center">{state.settings.language === 'fr' ? 'Date d\'Entrée' : state.settings.language === 'pt' ? 'Data de Entrada' : 'Fecha de Ingreso'}</th>
                        <th className="px-5 py-4 text-right">{state.settings.language === 'fr' ? 'Montant' : state.settings.language === 'pt' ? 'Monto' : 'Monto'}</th>
                        <th className="px-5 py-4 text-center">{state.settings.language === 'fr' ? 'Action' : state.settings.language === 'pt' ? 'Ação' : 'Acción'}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {newLoansInMonth.map((loan) => {
                        const client = (Array.isArray(state.clients) ? state.clients : []).find(c => c.id === loan.clientId);
                        const collectorId = loan.collectorId || (loan as any).collector_id || client?.addedBy || (client as any)?.added_by;
                        const collector = (Array.isArray(state.users) ? state.users : []).find(u => u.id === collectorId);
                        
                        return (
                          <tr key={loan.id} className="hover:bg-slate-50 transition-colors text-[11px] font-bold">
                            <td className="px-5 py-4 text-slate-800 uppercase font-black">
                              {client?.name || 'Desconocido'}
                            </td>
                            <td className="px-5 py-4 text-slate-600 uppercase">
                              {collector?.name || 'Sin Asignar'}
                            </td>
                            <td className="px-5 py-4 text-center text-slate-400 whitespace-nowrap">
                              {formatLocalDate(new Date(loan.createdAt), state.settings.country, { day: 'numeric', month: 'short', year: 'numeric' })}
                            </td>
                            <td className="px-5 py-4 text-right font-black text-indigo-600 font-mono">
                              {formatCurrency(loan.principal, state.settings)}
                            </td>
                            <td className="px-5 py-4 text-center">
                              {client?.id && onViewClientDossier && (
                                <button
                                  onClick={() => {
                                    setSelectedMonthDetail(null);
                                    onViewClientDossier(client.id);
                                  }}
                                  className="px-3 py-1.5 bg-blue-50 hover:bg-blue-600 text-blue-700 hover:text-white rounded-lg text-[9px] font-black uppercase tracking-wider transition-all active:scale-95 shadow-sm border border-blue-100 cursor-pointer flex items-center gap-1 mx-auto"
                                >
                                  <i className="fa-solid fa-folder-open text-[8px]"></i>
                                  {state.settings.language === 'fr' ? 'Détails' : state.settings.language === 'pt' ? 'Ver Ficha' : 'Ver Detalle'}
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
            
            <div className="p-4 bg-slate-900 flex justify-end shrink-0">
              <button 
                onClick={() => setSelectedMonthDetail(null)} 
                className="px-6 py-3 bg-slate-800 text-white rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-700 active:scale-95 transition-all"
              >
                {state.settings.language === 'fr' ? 'Fermer' : state.settings.language === 'pt' ? 'Fechar' : 'Cerrar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* GASTOS OPERATIVOS POR SUCURSAL                               */}
      {/* Misma lógica de aislamiento que clientes y créditos          */}
      {/* ============================================================ */}
      <GastosOperativos
        state={state}
        currentBranchId={currentBranchId}
        addIsolatedExpenseAction={addIsolatedExpenseAction}
        removeIsolatedExpenseAction={removeIsolatedExpenseAction}
        toggleLedger={() => setShowLedger(prev => !prev)}
        showLedger={showLedger}
      />

    </div >
  );
};

export default Expenses;

// ============================================================
// GASTOS OPERATIVOS — Planilla estilo Excel por sucursal
// Aislamiento idéntico a créditos y clientes (branchId)
// ============================================================

interface GastosOperativosProps {
  state: AppState;
  currentBranchId: string;
  addIsolatedExpenseAction?: (expense: IsolatedExpense) => void;
  removeIsolatedExpenseAction?: (id: string) => void;
  toggleLedger?: () => void;
  showLedger?: boolean;
}

const CATS = [
  { key: 'COMBUSTIBLE', icon: '⛽', label: 'Combustible', bg: 'bg-orange-100 text-orange-700' },
  { key: 'REPARACION',  icon: '🔧', label: 'Reparación',  bg: 'bg-red-100 text-red-700'      },
  { key: 'GOMERIA',     icon: '🛞', label: 'Gomería',      bg: 'bg-slate-100 text-slate-600'  },
  { key: 'INSUMOS',     icon: '📦', label: 'Insumos',      bg: 'bg-blue-100 text-blue-700'    },
  { key: 'OFICINA',     icon: '🏢', label: 'Oficina',      bg: 'bg-purple-100 text-purple-700'},
  { key: 'OTROS',       icon: '🌐', label: 'Otros',        bg: 'bg-teal-100 text-teal-700'   },
];

const fmtNum = (n: number) =>
  n.toLocaleString('es', { minimumFractionDigits: 0, maximumFractionDigits: 0 });

const GastosOperativos: React.FC<GastosOperativosProps> = ({
  state, currentBranchId, addIsolatedExpenseAction, removeIsolatedExpenseAction, toggleLedger, showLedger
}) => {
  const now = new Date();
  const [year,  setYear]  = React.useState(now.getFullYear());
  const [month, setMonth] = React.useState(now.getMonth());

  // Combustible diario prefijado — localStorage por sucursal
  const FUEL_KEY = `op_fuel_${currentBranchId}`;
  const [fuelPreset, setFuelPreset] = React.useState<number>(() => {
    try { return Number(localStorage.getItem(FUEL_KEY) || 0); } catch { return 0; }
  });
  const [fuelInput, setFuelInput] = React.useState<string>(() => {
    try { const v = localStorage.getItem(FUEL_KEY); return v || ''; } catch { return ''; }
  });
  const saveFuelPreset = () => {
    const n = Number(fuelInput);
    if (isNaN(n) || n < 0) return;
    setFuelPreset(n);
    try { localStorage.setItem(FUEL_KEY, String(n)); } catch {}

    if (n > 0 && addIsolatedExpenseAction) {
      if (window.confirm(`¿Desea rellenar todos los días sin gastos de combustible del mes actual con ${fmtNum(n)}?`)) {
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        let addedCount = 0;
        
        for (let i = 1; i <= daysInMonth; i++) {
          const d = new Date(year, month, i);
          const dateStr = d.toLocaleDateString('en-CA');
          
          // Buscar si ya hay un gasto de COMBUSTIBLE en este día
          const hasFuel = (state.isolatedExpenses || []).some(e => 
            e.branchId === currentBranchId && 
            e.category === 'COMBUSTIBLE' && 
            e.date.startsWith(dateStr)
          );
          
          if (!hasFuel) {
            addedCount++;
            setTimeout(() => {
              addIsolatedExpenseAction({
                id: generateUUID(),
                branchId: currentBranchId,
                description: 'Combustible diario',
                amount: n,
                category: 'COMBUSTIBLE',
                date: dateStr + 'T12:00:00.000Z',
                created_at: new Date().toISOString()
              });
            }, addedCount * 150); // Retardo escalonado para no saturar el estado
          }
        }
      }
    }
  };

  // Nueva fila
  const [showForm, setShowForm] = React.useState(false);
  const [newCat,  setNewCat]   = React.useState('COMBUSTIBLE');
  const [newDesc, setNewDesc]  = React.useState('');
  const [newAmt,  setNewAmt]   = React.useState('');
  const [newDate, setNewDate]  = React.useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  });

  const openForm = (cat = 'COMBUSTIBLE') => {
    setNewCat(cat);
    setNewDesc(cat === 'COMBUSTIBLE' ? 'Combustible diario' : '');
    setNewAmt(cat === 'COMBUSTIBLE' && fuelPreset > 0 ? String(fuelPreset) : '');
    setShowForm(true);
  };

  const handleGuardar = () => {
    if (!newDesc.trim() || !newAmt || Number(newAmt) <= 0) return;
    if (!addIsolatedExpenseAction) return;
    addIsolatedExpenseAction({
      id: generateUUID(),
      description: newDesc.trim(),
      amount: Number(newAmt),
      category: newCat as any,
      date: new Date(newDate + 'T12:00:00.000Z').toISOString(),
    });
    setShowForm(false);
    setNewDesc(''); setNewAmt('');
  };

  // Edición inline
  const [editId,   setEditId]   = React.useState<string | null>(null);
  const [editDesc, setEditDesc] = React.useState('');
  const [editAmt,  setEditAmt]  = React.useState('');
  const [editCat,  setEditCat]  = React.useState('COMBUSTIBLE');
  const [editDate, setEditDate] = React.useState('');

  const startEdit = (g: IsolatedExpense) => {
    setEditId(g.id);
    setEditDesc(g.description);
    setEditAmt(String(g.amount));
    setEditCat(g.category as string);
    setEditDate(g.date.slice(0, 10));
  };

  const saveEdit = () => {
    if (!editId || !editDesc.trim() || !editAmt || Number(editAmt) <= 0) return;
    if (!removeIsolatedExpenseAction || !addIsolatedExpenseAction) return;
    removeIsolatedExpenseAction(editId);
    addIsolatedExpenseAction({
      id: editId,
      description: editDesc.trim(),
      amount: Number(editAmt),
      category: editCat as any,
      date: new Date(editDate + 'T12:00:00.000Z').toISOString(),
    });
    setEditId(null);
  };

  // Gastos filtrados por sucursal y mes — igual que clientes/créditos
  const gastosMes = React.useMemo(() => {
    if (!currentBranchId || currentBranchId === 'none') return [];
    return (state.isolatedExpenses || [])
      .filter(e => {
        if (e.branchId !== currentBranchId) return false;
        const d = new Date(e.date);
        return d.getFullYear() === year && d.getMonth() === month;
      })
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [state.isolatedExpenses, currentBranchId, year, month]);
  
  const todayStr = new Date().toLocaleDateString('en-CA');
  const gastosHoy = React.useMemo(() => gastosMes.filter(g => g.date.startsWith(todayStr)), [gastosMes, todayStr]);
  const totalHoy = gastosHoy.reduce((s, e) => s + e.amount, 0);
  const total = gastosMes.reduce((s, e) => s + e.amount, 0);

  const nominaMensual = React.useMemo(() => {
    let totalNomina = 0;
    const branchUsers = (Array.isArray(state.users) ? state.users : []).filter(u => 
      (u.managedBy || (u as any).managed_by || u.id) === currentBranchId
    );
    branchUsers.forEach(u => {
      const cfg = u.payConfig;
      if (cfg) {
        if (cfg.scheme === 'monthly') totalNomina += (cfg.monthly || 0);
        if (cfg.scheme === 'weekly') totalNomina += (cfg.weekly || 0) * 4;
      }
    });
    return totalNomina;
  }, [state.users, currentBranchId]);

  const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
  const prevMes = () => { if (month === 0) { setMonth(11); setYear(y => y - 1); } else setMonth(m => m - 1); };
  const nextMes = () => { if (month === 11) { setMonth(0); setYear(y => y + 1); } else setMonth(m => m + 1); };

  const sym = state.settings?.currencySymbol || '$';
  const ci  = (key: string) => CATS.find(c => c.key === key) || CATS[5];

  return (
    <div className="mt-6 bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden">

      {/* Header */}
      <div className="px-6 pt-5 pb-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-4">
          <div>
            <h2 className="text-base font-black text-slate-800 uppercase tracking-tighter flex items-center gap-2">
              💼 GASTOS OPERATIVOS
            </h2>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
              Solo visibles en esta sucursal
            </p>
          </div>

          {/* Combustible prefijado */}
          <div className="flex items-center gap-2 bg-orange-50 border border-orange-200 rounded-xl px-4 py-2.5">
            <span className="text-xl">⛽</span>
            <div>
              <p className="text-[9px] font-black text-orange-500 uppercase tracking-widest mb-1">Combustible diario</p>
              <div className="flex items-center gap-1.5">
                <input
                  type="number"
                  value={fuelInput}
                  onChange={e => setFuelInput(e.target.value)}
                  placeholder="0"
                  className="w-24 bg-white border border-orange-200 rounded-lg px-2 py-1 text-xs font-black text-slate-700 focus:outline-none focus:ring-2 focus:ring-orange-400"
                />
                <button
                  onClick={saveFuelPreset}
                  title="Guardar monto prefijado"
                  className="bg-orange-500 hover:bg-orange-600 text-white px-2.5 py-1 rounded-lg text-xs font-black active:scale-95 transition-all"
                >💾</button>
              </div>
            </div>
          </div>

          {/* Nómina Mensual */}
          {nominaMensual > 0 && (
            <div className="bg-slate-900/5 border border-slate-200 text-slate-700 px-5 py-2.5 rounded-xl text-right shrink-0">
              <p className="text-[9px] font-bold uppercase tracking-widest text-slate-500">Nómina Mensual</p>
              <p className="text-lg font-black font-mono text-emerald-600 flex items-center justify-end gap-1.5"><i className="fa-solid fa-money-check-dollar text-sm"></i>{sym}{fmtNum(nominaMensual)}</p>
            </div>
          )}

          {/* Total */}
          <div className="bg-slate-900 text-white px-5 py-2.5 rounded-xl text-right shrink-0">
            <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400">Total del mes</p>
            <p className="text-lg font-black font-mono">{sym}{fmtNum(total)}</p>
          </div>
        </div>

        {/* Gasto Total (Suma) */}
        <div className="bg-red-600 text-white px-5 py-2.5 rounded-xl text-right shrink-0 shadow-sm border border-red-700">
          <p className="text-[9px] font-bold uppercase tracking-widest text-red-200">Total General</p>
          <p className="text-lg font-black font-mono">{sym}{fmtNum(total + nominaMensual)}</p>
        </div>
      </div>

      {/* Navegador de mes */}
      <div className="flex items-center justify-between px-6 py-3 bg-slate-50 border-b border-slate-100">
        <button onClick={prevMes} className="w-8 h-8 rounded-lg bg-white border border-slate-200 flex items-center justify-center font-black text-slate-600 hover:bg-slate-100 active:scale-95 transition-all">‹</button>
        <span className="text-sm font-black text-slate-700 uppercase tracking-widest">{MESES[month]} {year}</span>
        <button onClick={nextMes} className="w-8 h-8 rounded-lg bg-white border border-slate-200 flex items-center justify-center font-black text-slate-600 hover:bg-slate-100 active:scale-95 transition-all">›</button>
      </div>

      {/* Planilla */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-100">
              <th className="px-4 py-2 text-left text-[9px] font-black text-slate-400 uppercase tracking-widest w-24">Fecha</th>
              <th className="px-4 py-2 text-left text-[9px] font-black text-slate-400 uppercase tracking-widest">Descripción</th>
              <th className="px-4 py-2 text-left text-[9px] font-black text-slate-400 uppercase tracking-widest w-36">Categoría</th>
              <th className="px-4 py-2 text-right text-[9px] font-black text-slate-400 uppercase tracking-widest w-32">Monto</th>
              <th className="w-20"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">

            {gastosHoy.length === 0 && !showForm && (
              <tr><td colSpan={5} className="px-6 py-10 text-center text-slate-300">
                <p className="text-3xl mb-1">📭</p>
                <p className="text-xs font-bold uppercase tracking-widest">Sin gastos hoy</p>
              </td></tr>
            )}

            {gastosHoy.map(g => {
              const info = ci(g.category as string);
              if (editId === g.id) {
                return (
                  <tr key={g.id} className="bg-blue-50">
                    <td className="px-2 py-1.5">
                      <input type="date" value={editDate} onChange={e => setEditDate(e.target.value)}
                        className="w-full border border-blue-300 rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    </td>
                    <td className="px-2 py-1.5">
                      <input type="text" value={editDesc} onChange={e => setEditDesc(e.target.value)}
                        className="w-full border border-blue-300 rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    </td>
                    <td className="px-2 py-1.5">
                      <select value={editCat} onChange={e => setEditCat(e.target.value)}
                        className="w-full border border-blue-300 rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500">
                        {CATS.map(c => <option key={c.key} value={c.key}>{c.icon} {c.label}</option>)}
                      </select>
                    </td>
                    <td className="px-2 py-1.5">
                      <input type="number" value={editAmt} onChange={e => setEditAmt(e.target.value)}
                        className="w-full border border-blue-300 rounded-lg px-2 py-1 text-xs font-black text-right focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    </td>
                    <td className="px-2 py-1.5">
                      <div className="flex gap-1">
                        <button onClick={saveEdit} className="bg-blue-600 text-white px-2.5 py-1 rounded-lg text-[10px] font-black hover:bg-blue-700 active:scale-95 transition-all">✓</button>
                        <button onClick={() => setEditId(null)} className="bg-slate-200 text-slate-600 px-2.5 py-1 rounded-lg text-[10px] font-black hover:bg-slate-300 active:scale-95 transition-all">✕</button>
                      </div>
                    </td>
                  </tr>
                );
              }
              return (
                <tr key={g.id} className="hover:bg-slate-50 transition-colors group">
                  <td className="px-4 py-3 text-[11px] font-black text-slate-500 whitespace-nowrap uppercase">
                    {new Date(g.date).toLocaleDateString('es', { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric' })}
                  </td>
                  <td className="px-4 py-3 text-sm font-medium text-slate-700">{g.description}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-black uppercase ${info.bg}`}>
                      {info.icon} {info.label}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-black font-mono text-slate-800 text-right whitespace-nowrap">{sym}{fmtNum(g.amount)}</td>
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => startEdit(g)} title="Editar"
                        className="w-7 h-7 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-500 flex items-center justify-center text-xs active:scale-90 transition-all">✏️</button>
                      <button onClick={() => removeIsolatedExpenseAction?.(g.id)} title="Eliminar"
                        className="w-7 h-7 rounded-lg bg-red-50 hover:bg-red-100 text-red-400 hover:text-red-600 flex items-center justify-center text-xs active:scale-90 transition-all">🗑️</button>
                    </div>
                  </td>
                </tr>
              );
            })}

            {/* Fila de nueva entrada */}
            {showForm && (
              <tr className="bg-emerald-50">
                <td className="px-2 py-1.5">
                  <input type="date" value={newDate} onChange={e => setNewDate(e.target.value)}
                    className="w-full border border-emerald-300 rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                </td>
                <td className="px-2 py-1.5">
                  <input type="text" value={newDesc} onChange={e => setNewDesc(e.target.value)} placeholder="Descripción..." autoFocus
                    className="w-full border border-emerald-300 rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                </td>
                <td className="px-2 py-1.5">
                  <select value={newCat} onChange={e => {
                    setNewCat(e.target.value);
                    if (e.target.value === 'COMBUSTIBLE') { setNewDesc('Combustible diario'); if (fuelPreset > 0) setNewAmt(String(fuelPreset)); }
                  }} className="w-full border border-emerald-300 rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500">
                    {CATS.map(c => <option key={c.key} value={c.key}>{c.icon} {c.label}</option>)}
                  </select>
                </td>
                <td className="px-2 py-1.5">
                  <input type="number" value={newAmt} onChange={e => setNewAmt(e.target.value)} placeholder="Monto"
                    className="w-full border border-emerald-300 rounded-lg px-2 py-1 text-xs font-black text-right focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                </td>
                <td className="px-2 py-1.5">
                  <div className="flex gap-1">
                    <button onClick={handleGuardar} className="bg-emerald-600 text-white px-2.5 py-1 rounded-lg text-[10px] font-black hover:bg-emerald-700 active:scale-95 transition-all">✓</button>
                    <button onClick={() => setShowForm(false)} className="bg-slate-200 text-slate-600 px-2.5 py-1 rounded-lg text-[10px] font-black hover:bg-slate-300 active:scale-95 transition-all">✕</button>
                  </div>
                </td>
              </tr>
            )}
          </tbody>

          {gastosHoy.length > 0 && (
            <tfoot>
              <tr className="bg-slate-900 text-white">
                <td colSpan={3} className="px-4 py-3 text-[10px] font-black uppercase tracking-widest">
                  {gastosHoy.length} registro{gastosHoy.length !== 1 ? 's' : ''} hoy
                </td>
                <td className="px-4 py-3 text-right font-black font-mono text-base">{sym}{fmtNum(totalHoy)}</td>
                <td></td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {/* Botones de agregar rápido */}
      <div className="px-6 py-4 border-t border-slate-100 flex flex-wrap gap-2">
        <button onClick={() => openForm('COMBUSTIBLE')}
          className="flex items-center gap-1.5 bg-orange-50 hover:bg-orange-100 border border-orange-200 text-orange-700 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest active:scale-95 transition-all">
          ⛽ + Combustible{fuelPreset > 0 ? ` (${sym}${fmtNum(fuelPreset)})` : ''}
        </button>
        {CATS.slice(1).map(c => (
          <button key={c.key} onClick={() => openForm(c.key)}
            className="flex items-center gap-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-600 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest active:scale-95 transition-all">
            {c.icon} + {c.label}
          </button>
        ))}
        {toggleLedger && (
          <button 
            onClick={toggleLedger}
            className={`ml-auto px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-sm border ${showLedger ? 'bg-slate-800 text-white border-slate-800' : 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200'}`}
          >
            <i className={`fa-solid ${showLedger ? 'fa-eye-slash' : 'fa-list'} mr-1.5`}></i>
            Historial de Gastos
          </button>
        )}
      </div>
    </div>
  );
};


