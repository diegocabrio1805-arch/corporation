import React, { useState, useMemo, useEffect } from 'react';
import { AppState, ExpenseCategory, Expense } from '../types';
import { formatCurrency, generateUUID, formatLocalTime } from '../utils/helpers';

interface IsolatedSpreadsheetModalProps {
  state: AppState;
  onClose: () => void;
  updateSettings?: (settings: any, targetBranchId?: string) => void;
  addExpense?: (expense: Expense) => void;
  removeExpense?: (id: string) => void;
  updateExpense?: (expense: Expense) => void;
}

export const IsolatedSpreadsheetModal: React.FC<IsolatedSpreadsheetModalProps> = ({ state, onClose, updateSettings, addExpense, removeExpense, updateExpense }) => {
  const [currentMonth, setCurrentMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });

  const isAdmin = state.currentUser?.role === 'ADMIN';
  const SYSTEM_ADMIN_ID = 'b3716a78-fb4f-4918-8c0b-92004e3d63ec';
  
  const [selectedAdminBranchId, setSelectedAdminBranchId] = useState<string>(() => {
    return state.currentUser?.id || SYSTEM_ADMIN_ID;
  });

  const currentBranchId = isAdmin 
    ? selectedAdminBranchId 
    : (state.currentUser ? (
        state.currentUser.role === 'MANAGER' 
          ? state.currentUser.id 
          : (state.currentUser.managedBy || (state.currentUser as any).managed_by || state.currentUser.id)
      ) : 'none');

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
  
  const branchSettings = currentBranchId && state.branchSettings ? state.branchSettings[currentBranchId] : undefined;
  
  // Leemos desde localStorage como backup de emergencia
  const backupStateStr = localStorage.getItem('prestamaster_v2');
  let backupAmount: number | undefined = undefined;
  let backupAuto: boolean | undefined = undefined;
  if (backupStateStr) {
    try {
      const backupState = JSON.parse(backupStateStr);
      if (backupState.branchSettings && backupState.branchSettings[currentBranchId]) {
         backupAmount = backupState.branchSettings[currentBranchId].isolatedProjectionAmount;
         backupAuto = backupState.branchSettings[currentBranchId].autoIsolatedFuelProjection;
      }
    } catch(e) {}
  }
  
  // TERCERA CAPA DE SEGURIDAD: Storage directo blindado
  const directStorageStr = localStorage.getItem(`fuel_config_${currentBranchId}`);
  if (directStorageStr) {
    try {
      const parsedDirect = JSON.parse(directStorageStr);
      if (backupAmount === undefined) backupAmount = parsedDirect.amount;
      if (backupAuto === undefined) backupAuto = parsedDirect.auto;
    } catch(e) {}
  }

  // For display settings (company name, currency, etc.) use branchSettings normally
  const activeSettings = {
    ...(branchSettings || state.settings),
    // STRICT ISOLATION: Never inherit projection fields from master's global state.settings
    autoIsolatedFuelProjection: branchSettings?.autoIsolatedFuelProjection ?? backupAuto ?? false,
    isolatedProjectionAmount: (branchSettings?.isolatedProjectionAmount ?? backupAmount) === 63300 
      ? undefined 
      : (branchSettings?.isolatedProjectionAmount ?? backupAmount)
  };

  const [localAutoProject, setLocalAutoProject] = useState<boolean>(!!activeSettings.autoIsolatedFuelProjection);
  const [localProjectAmount, setLocalProjectAmount] = useState<string | number>(activeSettings.isolatedProjectionAmount ?? '');

  React.useEffect(() => {
    setLocalAutoProject(!!activeSettings.autoIsolatedFuelProjection);
    setLocalProjectAmount(activeSettings.isolatedProjectionAmount ?? '');
  }, [activeSettings.autoIsolatedFuelProjection, activeSettings.isolatedProjectionAmount]);

  const saveProjectionLocally = (autoProject: boolean, amount: string | number) => {
    if (updateSettings) {
      const parsedAmount = amount === '' ? undefined : Number(amount);
      const newSettings = {
        ...activeSettings,
        autoIsolatedFuelProjection: autoProject,
        isolatedProjectionAmount: parsedAmount
      };
      
      // Guardado directo invulnerable a reseteos de caché de React
      localStorage.setItem(`fuel_config_${currentBranchId}`, JSON.stringify({
        auto: autoProject,
        amount: parsedAmount
      }));

      updateSettings(newSettings, currentBranchId);
      
      // Update local state immediately for instant feedback
      setLocalAutoProject(autoProject);
      setLocalProjectAmount(amount);
    }
  };

  const parentExpenses = useMemo(() => {
    if (!state.expenses) return [];
    return state.expenses.filter((e: any) => {
      if (currentBranchId === 'none') return false;
      // Filter out corrupted 63300 if somehow present
      if (e.amount === 63300 && e.description === 'COMBUSTIBLE DIARIO') return false;
      return e.branchId === currentBranchId || e.branch_id === currentBranchId;
    });
  }, [state.expenses, currentBranchId]);

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

  const getFuelAmountForDay = (_dateStr: string) => {
    return Number(localProjectAmount) || 0;
  };

  // Days skipped by the user (trash on virtual row) — session only, no DB
  const [skippedDays, setSkippedDays] = useState<Set<string>>(() => {
     // Cargar días saltados de este mes desde localStorage al iniciar
     const storageKey = `fuel_skipped_${currentBranchId}_${currentMonth}`;
     try {
       const stored = JSON.parse(localStorage.getItem(storageKey) || '[]');
       return new Set(stored);
     } catch(e) {
       return new Set();
     }
  });

  // Escuchar cambios de mes para cargar el caché correcto
  useEffect(() => {
     const storageKey = `fuel_skipped_${currentBranchId}_${currentMonth}`;
     try {
       const stored = JSON.parse(localStorage.getItem(storageKey) || '[]');
       setSkippedDays(new Set(stored));
     } catch(e) {
       setSkippedDays(new Set());
     }
  }, [currentMonth, currentBranchId]);

  const handleAddExpense = (exp: Expense) => {
    if (addExpense) addExpense(exp);
  };

  const handleRemoveExpense = (id: string) => {
    if (id.startsWith('virtual-')) {
      if (window.confirm('¿Desea anular permanentemente la proyección de combustible para este día?')) {
        const dayDate = id.replace('virtual-', '');
        
        // 1. Guardar localmente que este día se saltó la proyección
        setSkippedDays(prev => {
          const next = new Set(prev);
          next.add(dayDate);
          
          // Persistir en localstorage para que sobreviva recargas
          const storageKey = `fuel_skipped_${currentBranchId}_${currentMonth}`;
          const currentSkipped = JSON.parse(localStorage.getItem(storageKey) || '[]');
          if (!currentSkipped.includes(dayDate)) {
             localStorage.setItem(storageKey, JSON.stringify([...currentSkipped, dayDate]));
          }
          return next;
        });

        // 2. Crear un registro de gasto 0 anónimo para que el motor de sincronización lo registre
        const newExp: Expense = {
          id: generateUUID(),
          description: 'COMBUSTIBLE DIARIO (ANULADO)',
          amount: 0,
          category: ExpenseCategory.TRANSPORT,
          date: dayDate + 'T12:00:00.000Z'
        };
        if (addExpense) addExpense(newExp);
      }
      return;
    }
    if (removeExpense) removeExpense(id);
  };

  const getVirtualFuelRow = (dayDate: string, dayExpenses: Expense[]) => {
    const today = new Date().toISOString().split('T')[0];
    if (dayDate > today) return null;
    const [y, m, d] = dayDate.split('-').map(Number);
    if (new Date(y, m - 1, d).getDay() === 0) return null; // No domingo
    if (!localAutoProject) return null;
    const fuelAmt = getFuelAmountForDay(dayDate);
    if (!fuelAmt || fuelAmt <= 0) return null;
    if (skippedDays.has(dayDate)) return null;
    const hasRealFuel = dayExpenses.some((e: Expense) => e.description?.includes('COMBUSTIBLE'));
    if (hasRealFuel) return null;
    return (
      <ProjectedExpenseRow
        key={`virtual-${dayDate}`}
        date={dayDate}
        defaultAmount={fuelAmt}
        settings={activeSettings}
        addExpense={handleAddExpense}
        removeExpense={handleRemoveExpense}
      />
    );
  };

  const totalMonthExpenses = useMemo(() => {
    return daysInMonth.reduce((acc, dayDate) => {
      const realTotal = parentExpenses.filter((e: any) => e.date.startsWith(dayDate)).reduce((sum: number, e: any) => sum + e.amount, 0);
      let virtualTotal = 0;
      const today = new Date().toISOString().split('T')[0];
      if (dayDate <= today && localAutoProject) {
        const [y, m, d] = dayDate.split('-').map(Number);
        if (new Date(y, m - 1, d).getDay() !== 0) {
          const dayExpenses = parentExpenses.filter((e: any) => e.date.startsWith(dayDate));
          const hasRealFuel = dayExpenses.some((e: any) => e.description?.includes('COMBUSTIBLE'));
          if (!hasRealFuel && !skippedDays.has(dayDate)) {
            virtualTotal = getFuelAmountForDay(dayDate);
          }
        }
      }
      return acc + realTotal + virtualTotal;
    }, 0);
  }, [daysInMonth, parentExpenses, localAutoProject, localProjectAmount, skippedDays]);

  return (
    <div className="fixed inset-0 bg-slate-900/90 backdrop-blur-sm flex items-start justify-center z-[300] p-4 overflow-hidden pt-10 md:pt-10">
      <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-6xl h-[90vh] overflow-hidden flex flex-col border border-slate-200">
        <div className="p-4 md:p-6 border-b border-slate-100 flex flex-col sm:flex-row justify-between items-center bg-slate-50 gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-emerald-100 text-emerald-600 rounded-xl flex items-center justify-center shadow-inner">
              <i className="fa-solid fa-file-excel text-xl"></i>
            </div>
            <div>
              <h3 className="text-xl font-black text-slate-800 uppercase tracking-tighter flex items-center gap-3">
                Planilla Operativa (Aislada)
                {isAdmin && (
                  <select 
                    value={selectedAdminBranchId}
                    onChange={(e) => setSelectedAdminBranchId(e.target.value)}
                    className="ml-2 text-sm font-bold bg-white border border-slate-300 text-slate-700 py-1 px-2 rounded-lg outline-none shadow-sm"
                  >
                    <option value={state.currentUser?.id || SYSTEM_ADMIN_ID}>Mi Sucursal (Maestro)</option>
                    {(Array.isArray(state.users) ? state.users : []).filter(u => u.role === 'MANAGER' || u.role === 'ADMIN').map(u => {
                      if (u.id === (state.currentUser?.id || SYSTEM_ADMIN_ID)) return null;
                      return <option key={u.id} value={u.id}>{u.name}</option>;
                    })}
                  </select>
                )}
              </h3>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Este módulo NO afecta el Dashboard</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-xl border border-slate-200 shadow-sm cursor-pointer" 
                   onClick={() => {
                      const newVal = !localAutoProject;
                      setLocalAutoProject(newVal);
                      saveProjectionLocally(newVal, localProjectAmount);
                   }}>
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Proyección Automática</span>
                <div className={`w-10 h-5 flex items-center rounded-full p-1 transition-colors ${localAutoProject ? 'bg-emerald-500' : 'bg-slate-300'}`}>
                  <div className={`bg-white w-3 h-3 rounded-full shadow-md transform transition-transform ${localAutoProject ? 'translate-x-5' : 'translate-x-0'}`}></div>
                </div>
              </div>

              <div className="flex items-center gap-1 bg-white pl-2 pr-1 py-1 rounded-xl border border-slate-200 shadow-sm">
                <span className="text-slate-400 font-black pl-2">$</span>
                <input 
                  type="number" 
                  placeholder="Monto..."
                  value={localProjectAmount}
                  onChange={(e) => {
                    const val = e.target.value === '' ? '' : Number(e.target.value);
                    setLocalProjectAmount(val);
                  }}
                  onBlur={() => {
                    saveProjectionLocally(localAutoProject, localProjectAmount);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      saveProjectionLocally(localAutoProject, localProjectAmount);
                      e.currentTarget.blur();
                    }
                  }}
                  className="w-24 text-sm font-mono font-bold outline-none bg-transparent text-slate-700"
                />
                <button 
                  onClick={() => {
                    saveProjectionLocally(localAutoProject, localProjectAmount);
                    alert("Monto guardado correctamente");
                  }}
                  title="Guardar Monto de Proyección"
                  className="w-8 h-8 flex items-center justify-center bg-slate-800 hover:bg-emerald-600 text-white rounded-lg transition-colors shadow-sm"
                >
                  <i className="fa-solid fa-floppy-disk text-[11px]"></i>
                </button>
              </div>
            </div>

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
                  const dayExpenses = parentExpenses.filter((e: any) => e.date.startsWith(dayDate));
                  return (
                    <React.Fragment key={dayDate}>
                      {getVirtualFuelRow(dayDate, dayExpenses)}
                      {dayExpenses.filter((e: any) => !e.description?.includes('(ANULADO)')).map((exp: any) => (
                        <ExpenseRow 
                          key={exp.id} 
                          date={dayDate} 
                          expense={exp} 
                          settings={activeSettings} 
                          removeExpense={handleRemoveExpense}
                          updateExpense={updateExpense}
                        />
                      ))}
                      <NewExpenseRow 
                        date={dayDate} 
                        addExpense={handleAddExpense} 
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

const ExpenseRow = ({ date, expense, settings, removeExpense, updateExpense }: any) => {
  const [isDeleting, setIsDeleting] = useState(false);
  const [amount, setAmount] = useState<string | number>(expense.amount);

  const handleDelete = () => {
    if (window.confirm('¿Está seguro de que desea eliminar este gasto?')) {
      setIsDeleting(true);
      removeExpense(expense.id);
    }
  };

  const handleUpdate = () => {
    const newAmount = Number(amount);
    if (newAmount !== expense.amount && updateExpense) {
      updateExpense({ ...expense, amount: newAmount });
    }
  };

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
        <div className="flex items-center gap-2">
          <span className="text-slate-400 font-bold">$</span>
          <input 
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            onBlur={handleUpdate}
            onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
            className="w-full bg-white border border-slate-200 rounded px-2 py-1 outline-none focus:border-emerald-500 text-slate-800 transition-colors"
          />
        </div>
      </td>
      <td className="px-4 py-2 text-center">
        <button 
          onClick={handleDelete}
          className="w-7 h-7 flex items-center justify-center bg-white hover:bg-red-50 text-slate-300 hover:text-red-500 border border-slate-200 rounded transition-colors shadow-sm mx-auto"
        >
          <i className="fa-solid fa-trash-can text-[10px]"></i>
        </button>
      </td>
    </tr>
  );
};

const ProjectedExpenseRow = ({ date, defaultAmount, settings, addExpense, removeExpense }: any) => {
  const [isSaving, setIsSaving] = useState(false);
  const [customAmount, setCustomAmount] = useState<string | number>(defaultAmount);

  const handleSave = () => {
    setIsSaving(true);
    const newExp: Expense = {
      id: generateUUID(),
      description: 'COMBUSTIBLE DIARIO',
      amount: Number(customAmount),
      category: ExpenseCategory.TRANSPORT,
      date: date + 'T12:00:00.000Z'
    };
    addExpense(newExp);
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
              removeExpense(`virtual-${date}`);
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

const NewExpenseRow = ({ date, addExpense }: any) => {
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState<ExpenseCategory>(ExpenseCategory.OTHERS);

  const handleSave = () => {
    if (!description.trim() || !amount || isNaN(Number(amount))) return;
    const newExp: Expense = {
      id: generateUUID(),
      description: description.trim(),
      amount: Number(amount),
      category,
      date: date + 'T12:00:00.000Z'
    };
    addExpense(newExp);
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
