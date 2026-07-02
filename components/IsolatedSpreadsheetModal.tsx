import React, { useState, useMemo } from 'react';
import { AppState, ExpenseCategory, IsolatedExpense } from '../types';
import { formatCurrency, generateUUID } from '../utils/helpers';

interface IsolatedSpreadsheetModalProps {
  state: AppState;
  onClose: () => void;
  updateSettings?: (settings: any) => void;
}

export const IsolatedSpreadsheetModal: React.FC<IsolatedSpreadsheetModalProps> = ({ state, onClose, updateSettings }) => {
  const [currentMonth, setCurrentMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });

  const currentBranchId = state.currentUser ? (
    (state.currentUser.role === 'ADMIN' || state.currentUser.role === 'MANAGER') 
      ? state.currentUser.id 
      : (state.currentUser.managedBy || (state.currentUser as any).managed_by || state.currentUser.id)
  ) : 'none';

  const totalMonthlyPayroll = React.useMemo(() => {
    let total = 0;
    const branchUsers = state.users.filter((u: any) => 
      (u.managedBy === currentBranchId || (u as any).managed_by === currentBranchId || u.id === currentBranchId)
    );
    branchUsers.forEach((u: any) => {
      if (u.payConfig && u.payConfig.scheme === 'monthly') {
        total += (u.payConfig.monthly || 0);
      }
    });
    return total;
  }, [state.users, currentBranchId]);
  
  const activeSettings = currentBranchId && state.branchSettings ? (state.branchSettings[currentBranchId] || state.settings) : state.settings;
  const parentIsolatedExpenses = activeSettings?.isolatedExpenses;

  const [localExpenses, setLocalExpenses] = useState<IsolatedExpense[]>(parentIsolatedExpenses || []);
  const [localAutoProject, setLocalAutoProject] = useState(!!activeSettings?.autoIsolatedFuelProjection);
  const [localProjectAmount, setLocalProjectAmount] = useState(activeSettings?.isolatedProjectionAmount || '');

  React.useEffect(() => {
    if (parentIsolatedExpenses) {
      setLocalExpenses(parentIsolatedExpenses);
    }
    setLocalAutoProject(!!activeSettings?.autoIsolatedFuelProjection);
    setLocalProjectAmount(activeSettings?.isolatedProjectionAmount || '');
  }, [parentIsolatedExpenses, activeSettings?.autoIsolatedFuelProjection, activeSettings?.isolatedProjectionAmount]);

  const daysInMonth = useMemo(() => {
    if (!currentMonth) return [];
    const [year, month] = currentMonth.split('-').map(Number);
    const date = new Date(year, month - 1, 1);
    const days = [];
    while (date.getMonth() === month - 1) {
      days.push(new Date(date).toISOString().split('T')[0]);
      date.setDate(date.getDate() + 1);
    }
    return days;
  }, [currentMonth]);

  const fuelHistory = useMemo(() => {
    return activeSettings?.fuelHistory || [];
  }, [activeSettings]);

  const getFuelAmountForDay = (dateStr: string) => {
    return localProjectAmount || 0;
  };

  const addIsolatedExpense = (exp: IsolatedExpense) => {
    if (!updateSettings) return;
    const newExpenses = [...localExpenses, exp];
    setLocalExpenses(newExpenses);
    updateSettings({ ...activeSettings, isolatedExpenses: newExpenses });
  };

  const removeIsolatedExpense = (id: string) => {
    if (!updateSettings) return;
    if (id.startsWith('virtual-')) {
      const dayDate = id.replace('virtual-', '');
      const omitExp: IsolatedExpense = {
        id: generateUUID(),
        description: 'COMBUSTIBLE (OMITIDO)',
        amount: 0,
        category: ExpenseCategory.OTHERS,
        date: dayDate + 'T12:00:00.000Z'
      };
      const newExpenses = [...localExpenses, omitExp];
      setLocalExpenses(newExpenses);
      updateSettings({ ...activeSettings, isolatedExpenses: newExpenses });
      return;
    }
    const newExpenses = localExpenses.filter((e: IsolatedExpense) => e.id !== id);
    setLocalExpenses(newExpenses);
    updateSettings({ ...activeSettings, isolatedExpenses: newExpenses });
  };

  const getVirtualFuelRow = (dayDate: string, dayExpenses: IsolatedExpense[]) => {
    const today = new Date().toISOString().split('T')[0];
    
    if (dayDate > today) return null;
    
    const [y, m, d] = dayDate.split('-').map(Number);
    const dateObj = new Date(y, m - 1, d);
    if (dateObj.getDay() === 0) return null; // No domingo

    if (!localAutoProject) return null;

    const hasRealFuel = dayExpenses.some((e: IsolatedExpense) => e.description?.includes('COMBUSTIBLE'));
    if (hasRealFuel) return null; 

    const activeAmount = Number(getFuelAmountForDay(dayDate));
    
    return (
      <ProjectedExpenseRow 
        key={`virtual-${dayDate}`}
        date={dayDate}
        defaultAmount={activeAmount}
        settings={activeSettings}
        addIsolatedExpense={addIsolatedExpense}
        removeIsolatedExpense={removeIsolatedExpense}
      />
    );
  };

  const totalMonthExpenses = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    return daysInMonth.reduce((acc, dayDate) => {
      const realTotal = localExpenses.filter((e: IsolatedExpense) => e.date.startsWith(dayDate)).reduce((sum: number, e: IsolatedExpense) => sum + e.amount, 0);
      
      let virtualTotal = 0;
      if (dayDate <= today && localAutoProject) {
        const [y, m, d] = dayDate.split('-').map(Number);
        const dateObj = new Date(y, m - 1, d);
        if (dateObj.getDay() !== 0) { 
          const dayExps = localExpenses.filter((e: IsolatedExpense) => e.date.startsWith(dayDate));
          const hasRealFuel = dayExps.some((e: IsolatedExpense) => e.description?.includes('COMBUSTIBLE'));
          if (!hasRealFuel) virtualTotal = Number(getFuelAmountForDay(dayDate));
        }
      }
      
      return acc + realTotal + (virtualTotal > 0 ? virtualTotal : 0);
    }, 0);
  }, [daysInMonth, localExpenses, fuelHistory, localAutoProject, localProjectAmount]);

  return (
    <div className="fixed inset-0 bg-slate-900/90 backdrop-blur-sm flex items-start justify-center z-[300] p-4 overflow-hidden pt-10 md:pt-10">
      <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-6xl h-[90vh] overflow-hidden flex flex-col border border-slate-200">
        <div className="p-4 md:p-6 border-b border-slate-100 flex flex-col sm:flex-row justify-between items-center bg-slate-50 gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-emerald-100 text-emerald-600 rounded-xl flex items-center justify-center shadow-inner">
              <i className="fa-solid fa-file-excel text-xl"></i>
            </div>
            <div>
              <h3 className="text-xl font-black text-slate-800 uppercase tracking-tighter">Planilla Operativa (Aislada)</h3>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Este módulo NO afecta el Dashboard</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {updateSettings && (
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-xl border border-slate-200 shadow-sm cursor-pointer" 
                     onClick={() => {
                        const newVal = !localAutoProject;
                        setLocalAutoProject(newVal);
                        updateSettings({...activeSettings, autoIsolatedFuelProjection: newVal});
                     }}>
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Proyección Automática</span>
                  <div className={`w-10 h-5 flex items-center rounded-full p-1 transition-colors ${localAutoProject ? 'bg-emerald-500' : 'bg-slate-300'}`}>
                    <div className={`bg-white w-3 h-3 rounded-full shadow-md transform transition-transform ${localAutoProject ? 'translate-x-5' : 'translate-x-0'}`}></div>
                  </div>
                </div>

                <div className="flex items-center gap-2 bg-white px-2 py-1 rounded-xl border border-slate-200 shadow-sm">
                  <span className="text-slate-400 font-black pl-2">$</span>
                  <input 
                    type="number" 
                    placeholder="Monto..."
                    value={localProjectAmount}
                    onChange={(e) => {
                      const val = e.target.value === '' ? '' : Number(e.target.value);
                      setLocalProjectAmount(val);
                      updateSettings({ ...activeSettings, isolatedProjectionAmount: val === '' ? undefined : val });
                    }}
                    className="w-24 text-sm font-mono font-bold outline-none bg-transparent text-slate-700"
                  />
                </div>
              </div>
            )}
            <div className="flex items-center gap-2">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Mes y Año:</label>
              <input
                type="month"
                value={currentMonth}
                onChange={(e) => setCurrentMonth(e.target.value)}
                className="px-4 py-2 border border-slate-200 rounded-xl font-bold text-slate-700 outline-none focus:ring-2 focus:ring-emerald-500 shadow-sm"
              />
            </div>
            <button onClick={onClose} className="w-10 h-10 bg-white hover:bg-red-50 text-slate-400 hover:text-red-500 border border-slate-200 rounded-xl transition-all flex items-center justify-center shadow-sm">
              <i className="fa-solid fa-xmark text-lg"></i>
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-auto bg-slate-100/50 p-4">
          <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden min-w-[800px]">
            <table className="w-full text-left border-collapse">
              <thead className="bg-slate-800 text-white sticky top-0 z-10 shadow-sm">
                <tr className="text-[10px] font-black uppercase tracking-widest">
                  <th className="px-4 py-3 border-r border-slate-700 w-32">Día / Fecha</th>
                  <th className="px-4 py-3 border-r border-slate-700">Descripción del Gasto</th>
                  <th className="px-4 py-3 border-r border-slate-700 w-48">Categoría</th>
                  <th className="px-4 py-3 border-r border-slate-700 w-40">Monto ($)</th>
                  <th className="px-4 py-3 w-28 text-center">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {daysInMonth.map(dayDate => {
                  const dayExpenses = localExpenses.filter((e: IsolatedExpense) => e.date.startsWith(dayDate));
                  return (
                    <React.Fragment key={dayDate}>
                      {getVirtualFuelRow(dayDate, dayExpenses)}
                      {dayExpenses.filter((e: IsolatedExpense) => !e.description?.includes('(OMITIDO)')).map((exp: IsolatedExpense) => (
                        <ExpenseRow 
                          key={exp.id} 
                          date={dayDate} 
                          expense={exp} 
                          settings={activeSettings} 
                          removeIsolatedExpense={removeIsolatedExpense}
                        />
                      ))}
                      <NewExpenseRow 
                        date={dayDate} 
                        addIsolatedExpense={addIsolatedExpense} 
                      />
                    </React.Fragment>
                  );
                })}
              </tbody>
              <tfoot className="bg-slate-800 text-white z-10 sticky bottom-0 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)]">
                <tr>
                  <td colSpan={2} className="px-4 py-3 border-r border-slate-700 text-[10px] font-black uppercase tracking-widest text-slate-400 text-left">
                    {totalMonthlyPayroll > 0 && (
                      <div className="flex items-center gap-2">
                        <i className="fa-solid fa-wallet text-emerald-400"></i>
                        <span>Nómina Mensual:</span>
                        <span className="text-emerald-400">{formatCurrency(totalMonthlyPayroll, activeSettings)}</span>
                      </div>
                    )}
                  </td>
                  <td colSpan={1} className="px-4 py-3 border-r border-slate-700 text-[10px] font-black uppercase tracking-widest text-emerald-400 text-right">
                    Total Gastos Operativos del Mes:
                  </td>
                  <td colSpan={1} className="px-2 py-3 font-black font-mono text-white bg-emerald-700 text-center flex flex-col items-center justify-center leading-tight">
                    <span className="text-[11px] text-emerald-100">{formatCurrency(totalMonthExpenses, activeSettings)}</span>
                  </td>
                  <td colSpan={1} className="px-2 py-3 font-black font-mono text-white bg-rose-600 text-center flex flex-col items-center justify-center leading-tight border-l border-white/10 rounded-br-xl">
                    <span className="text-[7px] text-rose-200 uppercase tracking-widest leading-none mb-0.5">Suma Total</span>
                    <span className="text-[11px] text-white">{formatCurrency(totalMonthExpenses + totalMonthlyPayroll, activeSettings)}</span>
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

const ExpenseRow = ({ date, expense, settings, removeIsolatedExpense }: any) => {
  return (
    <tr className="bg-white hover:bg-slate-50 transition-colors group border-l-4 border-l-transparent hover:border-l-emerald-400">
      <td className="px-4 py-2 border-r border-slate-100 text-xs font-bold text-slate-500 flex items-center gap-2">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
        {new Date(date + 'T12:00:00Z').toLocaleDateString('es-ES', { weekday: 'short', day: '2-digit' }).toUpperCase()}
      </td>
      <td className="px-4 py-2 border-r border-slate-100">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-slate-800 uppercase flex-1">{expense.description}</span>
        </div>
      </td>
      <td className="px-4 py-2 border-r border-slate-100 text-[10px] font-bold text-slate-500 uppercase">
        <span className="bg-slate-100 px-2 py-1 rounded border border-slate-200">{expense.category}</span>
      </td>
      <td className="px-4 py-2 border-r border-slate-100 font-mono text-sm font-black text-slate-700">
        {formatCurrency(expense.amount, settings)}
      </td>
      <td className="px-4 py-2 text-center">
        <button 
          onClick={() => {
            if (window.confirm('¿Eliminar gasto?')) {
              removeIsolatedExpense(expense.id);
            }
          }}
          className="w-7 h-7 flex items-center justify-center bg-white hover:bg-red-50 text-slate-300 hover:text-red-500 border border-slate-200 rounded transition-colors shadow-sm mx-auto"
        >
          <i className="fa-solid fa-trash-can text-[10px]"></i>
        </button>
      </td>
    </tr>
  );
};

const ProjectedExpenseRow = ({ date, defaultAmount, settings, addIsolatedExpense, removeIsolatedExpense }: any) => {
  const [customAmount, setCustomAmount] = useState(defaultAmount.toString());

  React.useEffect(() => {
    setCustomAmount(defaultAmount.toString());
  }, [defaultAmount]);

  const handleSave = () => {
    if (!customAmount || isNaN(Number(customAmount))) return;
    const newExp: IsolatedExpense = {
      id: generateUUID(),
      description: 'COMBUSTIBLE DIARIO',
      amount: Number(customAmount),
      category: ExpenseCategory.TRANSPORTATION,
      date: date + 'T12:00:00.000Z'
    };
    addIsolatedExpense(newExp);
  };

  return (
    <tr className="bg-white hover:bg-slate-50 transition-colors group border-l-4 border-l-transparent hover:border-l-emerald-400">
      <td className="px-4 py-2 border-r border-slate-100 text-xs font-bold text-slate-500 flex items-center gap-2">
        <span className="w-1.5 h-1.5 rounded-full bg-slate-300"></span>
        {new Date(date + 'T12:00:00Z').toLocaleDateString('es-ES', { weekday: 'short', day: '2-digit' }).toUpperCase()}
      </td>
      <td className="px-4 py-2 border-r border-slate-100">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-slate-800 uppercase flex-1">COMBUSTIBLE DIARIO</span>
        </div>
      </td>
      <td className="px-4 py-2 border-r border-slate-100 text-[10px] font-bold text-slate-500 uppercase">
        <span className="bg-slate-100 px-2 py-1 rounded border border-slate-200">TRANSPORTE</span>
      </td>
      <td className="px-4 py-2 border-r border-slate-100 font-mono text-sm font-black text-slate-700">
        <div className="flex items-center gap-2">
          <span className="text-slate-400 font-bold">$</span>
          <input 
            type="number"
            value={customAmount}
            onChange={(e) => setCustomAmount(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSave()}
            className="w-full bg-white border border-slate-200 rounded px-2 py-1 outline-none focus:border-emerald-500 text-slate-800"
          />
        </div>
      </td>
      <td className="px-4 py-2 text-center">
        <div className="flex items-center gap-1 justify-center">
          <button 
            onClick={handleSave}
            disabled={!customAmount}
            className="w-7 h-7 flex items-center justify-center bg-slate-800 hover:bg-emerald-600 disabled:bg-slate-200 text-white rounded transition-colors shadow-sm"
          >
            <i className="fa-solid fa-check text-[10px]"></i>
          </button>
          <button 
            onClick={() => {
              removeIsolatedExpense(`virtual-${date}`);
            }}
            className="w-7 h-7 flex items-center justify-center bg-white hover:bg-red-50 text-slate-300 hover:text-red-500 border border-slate-200 rounded transition-colors shadow-sm"
          >
            <i className="fa-solid fa-trash-can text-[10px]"></i>
          </button>
        </div>
      </td>
    </tr>
  );
};

const NewExpenseRow = ({ date, addIsolatedExpense }: any) => {
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState<ExpenseCategory>(ExpenseCategory.OTHERS);

  const handleSave = () => {
    if (!description.trim() || !amount || isNaN(Number(amount))) return;
    const newExp: IsolatedExpense = {
      id: generateUUID(),
      description: description.trim(),
      amount: Number(amount),
      category,
      date: date + 'T12:00:00.000Z'
    };
    addIsolatedExpense(newExp);
    setDescription('');
    setAmount('');
    setCategory(ExpenseCategory.OTHERS);
  };

  return (
    <tr className="bg-slate-50/50 hover:bg-slate-50 transition-colors border-b border-slate-200">
      <td className="px-4 py-2 border-r border-slate-200 text-xs font-bold text-slate-400 bg-slate-100/50">
        {new Date(date + 'T12:00:00Z').toLocaleDateString('es-ES', { weekday: 'short', day: '2-digit' }).toUpperCase()}
      </td>
      <td className="px-4 py-2 border-r border-slate-200">
        <input 
          type="text" 
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Añadir descripción..."
          className="w-full bg-white border border-slate-200 rounded px-2 py-1 text-xs outline-none focus:border-emerald-500 font-bold text-slate-700 placeholder:font-normal uppercase"
        />
      </td>
      <td className="px-4 py-2 border-r border-slate-200">
        <select 
          value={category}
          onChange={(e) => setCategory(e.target.value as ExpenseCategory)}
          className="w-full bg-white border border-slate-200 rounded px-2 py-1 text-[10px] uppercase font-bold outline-none focus:border-emerald-500 text-slate-600"
        >
          {Object.values(ExpenseCategory).map(cat => (
            <option key={cat} value={cat}>{cat}</option>
          ))}
        </select>
      </td>
      <td className="px-4 py-2 border-r border-slate-200">
        <input 
          type="number"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="0"
          className="w-full bg-white border border-slate-200 rounded px-2 py-1 text-sm font-mono font-bold outline-none focus:border-emerald-500 text-slate-800"
          onKeyDown={(e) => e.key === 'Enter' && handleSave()}
        />
      </td>
      <td className="px-4 py-2 text-center">
        <button 
          onClick={handleSave}
          disabled={!description.trim() || !amount}
          className="w-full bg-slate-800 hover:bg-emerald-600 disabled:bg-slate-200 text-white text-[9px] font-black uppercase tracking-widest py-1.5 rounded transition-colors shadow-sm disabled:shadow-none"
        >
          Guardar
        </button>
      </td>
    </tr>
  );
};
