
import React, { useState, useMemo } from 'react';
import { Expense, AppState, ExpenseCategory, CollectionLogType, LoanStatus, Loan, CollectionLog } from '../types';
import { formatCurrency, formatDate, getLocalDateStringForCountry, getDaysOverdue, generateUUID, calculateTotalPaidFromLogs } from '../utils/helpers';
import { getTranslation } from '../utils/translations';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, AreaChart, Area } from 'recharts';

interface ExpensesProps {
  state: AppState;
  addExpense: (expense: Expense) => void;
  removeExpense: (id: string) => void;
  updateInitialCapital: (amount: number) => void;
}

const Expenses: React.FC<ExpensesProps> = ({ state, addExpense, removeExpense, updateInitialCapital }) => {
  // PROTECTION: If settings are not loaded yet, prevent crash
  if (!state.settings || !state.settings.country) {
    return <div className="p-10 text-center animate-pulse text-slate-400 font-bold uppercase tracking-widest">Cargando Configuración...</div>;
  }

  const countryTodayStr = getLocalDateStringForCountry(state.settings.country);

  const [showModal, setShowModal] = useState(false);
  const [showCapitalModal, setShowCapitalModal] = useState(false);
  const [initialCapitalForm, setInitialCapitalForm] = useState(state.initialCapital);

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

  // 3. Gastos operativos totales
  const totalOperatingExpenses = useMemo(() => {
    return (Array.isArray(state.expenses) ? state.expenses : []).reduce((acc, curr) => acc + curr.amount, 0);
  }, [state.expenses]);

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
        name: d.toLocaleString('es-ES', { month: 'short' }).toUpperCase().replace('.', ''),
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
      const dayIso = d.toISOString().split('T')[0];
      const monthIndex = d.getMonth();
      const year = d.getFullYear();
      const fullDate = d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });

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
        return lDate.toISOString().split('T')[0] === dayIso;
      });
      const count = dayLoans.length;
      const renewals = dayLoans.filter((l: Loan) => l.isRenewal).length;
      const nuevos = count - renewals;

      const label = d.getDate() === 1 || i === 179 ? d.toLocaleString('es-ES', { month: 'short' }).toUpperCase().replace('.', '') : '';

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
          <h2 className="text-xl md:text-2xl font-black text-slate-800 uppercase tracking-tighter">Control de Capital</h2>
          <p className="text-[10px] md:text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">Gestión de flujo de caja operativo</p>
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <button
            onClick={() => setShowCapitalModal(true)}
            className="flex-1 sm:flex-none bg-slate-900 text-white px-6 py-3.5 rounded-xl font-black text-[10px] uppercase tracking-widest shadow-xl active:scale-95 transition-all flex items-center justify-center gap-2"
          >
            <i className="fa-solid fa-vault"></i>
            CARGAR CAPITAL INICIAL
          </button>
          <button
            onClick={() => setShowModal(true)}
            className="flex-1 sm:flex-none bg-red-600 hover:bg-red-700 text-white px-6 py-3.5 rounded-xl font-black text-[10px] uppercase tracking-widest shadow-xl shadow-red-500/20 active:scale-95 transition-all flex items-center justify-center gap-2"
          >
            <i className="fa-solid fa-minus-circle"></i>
            GASTO OPERATIVO
          </button>
        </div>
      </div>

      {/* DASHBOARD DE CAPITAL OPERATIVO */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">

        {/* CUADRO 1: CAPITAL DE TRABAJO */}
        <div className="bg-white p-5 rounded-[2rem] border border-slate-100 shadow-sm relative overflow-hidden group">
          <div className="relative z-10">
            <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Capital de Trabajo</p>
            <h3 className="text-2xl font-black text-slate-800 font-mono">{formatCurrency(state.initialCapital, state.settings)}</h3>
            <p className="text-[7px] font-bold text-slate-500 mt-2 uppercase">Fondo base inicial cargado</p>
          </div>
          <i className="fa-solid fa-piggy-bank absolute -right-4 -bottom-4 text-6xl text-slate-50 group-hover:scale-110 transition-transform"></i>
        </div>

        {/* CUADRO 2: EFECTIVO EN CAJA (CON GANANCIAS Y DESCUENTOS) */}
        <div className="bg-slate-900 p-5 rounded-[2rem] shadow-xl relative overflow-hidden group">
          <div className="relative z-10">
            <p className="text-[8px] font-black text-emerald-400 uppercase tracking-widest mb-1">Efectivo Real en Caja</p>
            <h3 className={`text-2xl font-black font-mono ${currentCashInHand >= 0 ? 'text-white' : 'text-red-400'}`}>
              {formatCurrency(currentCashInHand, state.settings)}
            </h3>
            <div className="mt-2 space-y-1">
              <div className="flex justify-between text-[7px] font-bold uppercase text-slate-400">
                <span>Base + Cobros:</span>
                <span className="text-emerald-400">+{formatCurrency(state.initialCapital + collectedCash, state.settings)}</span>
              </div>
              <div className="flex justify-between text-[7px] font-bold uppercase text-slate-400">
                <span>Entregado + Gastos:</span>
                <span className="text-red-400">-{formatCurrency(lentCash + totalOperatingExpenses, state.settings)}</span>
              </div>
            </div>
          </div>
          <div className="absolute top-2 right-2 px-2 py-0.5 bg-emerald-500/20 text-emerald-400 rounded-full text-[6px] font-black border border-emerald-500/30 animate-pulse">EN VIVO</div>
        </div>

        {/* CUADRO 3: CRÉDITOS OTORGADOS */}
        <div className="bg-blue-600 p-5 rounded-[2rem] text-white shadow-xl relative overflow-hidden group">
          <div className="relative z-10">
            <p className="text-[8px] font-black text-blue-200 uppercase tracking-widest mb-1">Créditos Otorgados</p>
            <div className="flex items-end gap-2">
              <h3 className="text-3xl font-black">{totalLoansCount}</h3>
              <span className="text-[8px] font-black mb-1 opacity-70 uppercase">Operaciones</span>
            </div>
            <div className="mt-3 pt-3 border-t border-white/10">
              <p className="text-[8px] font-black text-blue-200 uppercase">Utilidad Proyectada</p>
              <p className="text-lg font-black font-mono">+{formatCurrency(projectedTotalProfit, state.settings)}</p>
            </div>
          </div>
          <i className="fa-solid fa-hand-holding-dollar absolute -right-4 -bottom-4 text-7xl text-white/10 group-hover:rotate-12 transition-transform"></i>
        </div>

        {/* CUADRO 4: MORA CRÍTICA (+40 DÍAS) */}
        <div className="bg-rose-50 p-5 rounded-[2rem] border border-rose-100 shadow-sm relative overflow-hidden group">
          <div className="relative z-10">
            <p className="text-[8px] font-black text-rose-600 uppercase tracking-widest mb-1">Mora Crítica (+40 d)</p>
            <h3 className="text-2xl font-black text-rose-700 font-mono">{formatCurrency(criticalMoraBalance, state.settings)}</h3>
            <p className="text-[7px] font-bold text-rose-400 mt-2 uppercase">Capital en alto riesgo de pérdida</p>
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
              Balance Histórico de Créditos
            </h3>
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1">Rendimiento proyectado y mora de los últimos 6 meses</p>
          </div>
          <div className="flex flex-wrap gap-4">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-black"></div>
              <span className="text-[8px] font-black text-slate-500 uppercase">UTILIDAD</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-rose-500"></div>
              <span className="text-[8px] font-black text-slate-500 uppercase">MORA</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-emerald-500"></div>
              <span className="text-[8px] font-black text-slate-500 uppercase">RENOVACIONES</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-indigo-400"></div>
              <span className="text-[8px] font-black text-slate-500 uppercase">C. NUEVOS</span>
            </div>
          </div>
        </div>

        <div className="h-[350px] w-full bg-[#f3f4f6] rounded-[2rem] p-6 relative shadow-inner">
          <ResponsiveContainer width="100%" height="100%">
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
                  const isCount = name === "RENOVACIONES" || name === "CRÉDITOS NUEVOS";
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
                name="CRÉDITOS NUEVOS"
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
                name="MORA PENDIENTE"
                animationDuration={2500}
              />
              <Area
                yAxisId="right"
                type="monotone"
                dataKey="renovaciones"
                stroke="transparent"
                fill="transparent"
                strokeWidth={0}
                name="RENOVACIONES"
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
                name="UTILIDAD PROYECTADA"
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
              <p className="text-[14px] font-black text-slate-800 leading-tight">{month.creditos} TOTALES</p>
              <div className="flex flex-col items-center gap-1 mt-1">
                <span className="text-[14px] font-black text-indigo-600 uppercase">{month.nuevos} NUEVOS</span>
                <span className="text-[14px] font-black text-emerald-700 uppercase">{month.renovaciones} RENOV.</span>
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

      {/* TABLA DE GASTOS / SALIDAS DE CAPITAL */}
      <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-50 bg-slate-50/30">
          <h3 className="text-[10px] font-black text-slate-800 uppercase tracking-widest">Historial de Salidas (Gastos)</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left min-w-[500px]">
            <thead className="bg-slate-50">
              <tr className="text-[8px] font-black text-slate-400 uppercase tracking-widest">
                <th className="px-5 py-4">Descripción</th>
                <th className="px-5 py-4">Categoría</th>
                <th className="px-5 py-4">Fecha</th>
                <th className="px-5 py-4">Monto</th>
                <th className="px-5 py-4 text-right">---</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {(Array.isArray(state.expenses) ? state.expenses : []).length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-16 text-center text-slate-400">
                    <div className="flex flex-col items-center">
                      <i className="fa-solid fa-receipt text-3xl mb-3 opacity-10"></i>
                      <p className="text-[10px] font-black uppercase tracking-widest">No hay gastos registrados</p>
                    </div>
                  </td>
                </tr>
              ) : (
                (Array.isArray(state.expenses) ? [...state.expenses] : []).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map((exp) => (
                  <tr key={exp.id} className="hover:bg-slate-50/50 transition-colors text-[11px] font-bold">
                    <td className="px-5 py-4 text-slate-800 uppercase truncate max-w-[150px]">{exp.description}</td>
                    <td className="px-5 py-4">
                      <span className="px-2 py-0.5 rounded-md text-[7px] font-black uppercase bg-slate-100 text-slate-500 border border-slate-200">
                        {exp.category}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-slate-400 whitespace-nowrap uppercase text-[10px]">{formatDate(exp.date)}</td>
                    <td className="px-5 py-4 font-black text-red-600 font-mono whitespace-nowrap">{formatCurrency(exp.amount, state.settings)}</td>
                    <td className="px-5 py-4 text-right">
                      <button
                        onClick={() => removeExpense(exp.id)}
                        className="w-9 h-9 text-slate-300 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all active:scale-90"
                      >
                        <i className="fa-solid fa-trash-can"></i>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL CARGA CAPITAL INICIAL */}
      {
        showCapitalModal && (
          <div className="fixed inset-0 bg-slate-900/98 flex items-start justify-center z-[200] p-4 overflow-y-auto pt-10 md:pt-20">
            <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-sm overflow-hidden animate-scaleIn border border-white/20">
              <div className="p-6 bg-slate-900 text-white flex justify-between items-center sticky top-0 z-10">
                <h3 className="text-lg font-black uppercase tracking-tighter">Base de Capital</h3>
                <button onClick={() => setShowCapitalModal(false)} className="w-8 h-8 bg-white/10 text-white rounded-lg flex items-center justify-center hover:bg-red-600 transition-all">
                  <i className="fa-solid fa-xmark text-lg"></i>
                </button>
              </div>
              <form onSubmit={handleUpdateCapital} className="p-8 space-y-6 bg-slate-50">
                <div className="text-center">
                  <div className="w-16 h-16 bg-slate-200 text-slate-600 rounded-3xl flex items-center justify-center mx-auto mb-4 shadow-inner">
                    <i className="fa-solid fa-money-bill-transfer text-2xl"></i>
                  </div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Establecer Capital de Trabajo</p>
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
                  Este monto es el fondo inicial con el que el sistema empezará a descontar los préstamos otorgados.
                </div>
                <button type="submit" className="w-full font-black py-5 bg-slate-900 text-white rounded-2xl shadow-xl uppercase text-xs tracking-widest active:scale-95 transition-all">
                  ACTUALIZAR FONDO
                </button>
              </form>
            </div>
          </div>
        )
      }

      {/* MODAL REGISTRAR GASTO */}
      {
        showModal && (
          <div className="fixed inset-0 bg-slate-900/98 flex items-start justify-center z-[150] p-4 overflow-y-auto pt-10 md:pt-20">
            <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-md overflow-hidden animate-scaleIn flex flex-col border border-white/20">
              <div className="p-6 border-b border-slate-100 flex justify-between items-center sticky top-0 bg-white z-10">
                <h3 className="text-lg font-black text-slate-800 uppercase tracking-tighter">Registrar Gasto</h3>
                <button onClick={() => setShowModal(false)} className="w-8 h-8 text-slate-400 hover:text-slate-600 active:scale-95 transition-all">
                  <i className="fa-solid fa-xmark text-xl"></i>
                </button>
              </div>
              <form onSubmit={handleSubmit} className="p-6 md:p-8 space-y-4 flex-1 overflow-y-auto bg-slate-50">
                <div className="space-y-1.5">
                  <label className="block text-[8px] font-black text-slate-400 uppercase ml-1">Descripción del Gasto</label>
                  <input
                    required
                    type="text"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-red-500 outline-none font-bold text-slate-700 uppercase text-xs shadow-sm"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="block text-[8px] font-black text-slate-400 uppercase ml-1">Categoría</label>
                  <select
                    required
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value as ExpenseCategory })}
                    className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-red-500 outline-none font-black text-slate-700 text-xs shadow-sm"
                  >
                    {Object.values(ExpenseCategory).map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="block text-[8px] font-black text-slate-400 uppercase ml-1">Monto ($)</label>
                    <input
                      required
                      type="number"
                      value={formData.amount}
                      onChange={(e) => setFormData({ ...formData, amount: Number(e.target.value) })}
                      className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-red-500 outline-none font-black text-red-600 shadow-sm text-sm"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="block text-[8px] font-black text-slate-400 uppercase ml-1">Fecha</label>
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
                <button
                  type="submit"
                  className="w-full bg-red-600 hover:bg-red-700 text-white font-black py-4 rounded-xl shadow-lg shadow-red-500/20 transition-all active:scale-95 mt-4 uppercase text-[10px] tracking-widest"
                >
                  CONFIRMAR SALIDA
                </button>
              </form>
            </div>
          </div>
        )
      }
    </div >
  );
};

export default Expenses;
