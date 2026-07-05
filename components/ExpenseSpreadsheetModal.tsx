import React, { useState, useMemo, useEffect } from 'react';
import { AppState, ExpenseCategory, Expense } from '../types';
import { formatCurrency, formatDate } from '../utils/helpers';
import { supabase } from '../utils/supabaseClient';

interface ExpenseSpreadsheetModalProps {
  state: AppState;
  onClose: () => void;
  addExpense: (expense: Expense) => void;
  removeExpense: (id: string) => void;
}

export const ExpenseSpreadsheetModal: React.FC<ExpenseSpreadsheetModalProps> = ({ state, onClose, addExpense, removeExpense }) => {
  const [currentMonth, setCurrentMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });

  // Derived state: dates of the selected month
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

  const currentBranchId = state.currentUser ? (
    (state.currentUser.role === 'ADMIN' || state.currentUser.role === 'MANAGER') 
      ? state.currentUser.id 
      : (state.currentUser.managedBy || (state.currentUser as any).managed_by || state.currentUser.id)
  ) : 'none';
  const existingExpenses = (Array.isArray(state.expenses) ? state.expenses : []).filter(e => e.branchId === currentBranchId);
  const branchSettings = currentBranchId && state.branchSettings ? state.branchSettings[currentBranchId] : undefined;
  
  // Construct a safe activeSettings that doesn't bleed branch-specific data from global settings
  const activeSettings = {
    ...(branchSettings || state.settings)
  };

  activeSettings.isolatedExpenses = branchSettings?.isolatedExpenses || [];
  activeSettings.autoIsolatedFuelProjection = branchSettings?.autoIsolatedFuelProjection || false;
  
  if (branchSettings && 'isolatedProjectionAmount' in branchSettings) {
      activeSettings.isolatedProjectionAmount = branchSettings.isolatedProjectionAmount;
  } else {
      delete activeSettings.isolatedProjectionAmount;
  }
  
  activeSettings.defaultFuel = branchSettings?.defaultFuel || 0;
  activeSettings.fuelHistory = branchSettings?.fuelHistory || [];

  // Lee el historial de combustible
  const fuelHistory = useMemo(() => {
    return activeSettings?.fuelHistory || [];
  }, [activeSettings]);

  const getFuelAmountForDay = (dateStr: string) => {
    // Si no hay historial, usa defaultFuel
    if (fuelHistory.length === 0) {
      return activeSettings?.defaultFuel || 0;
    }
    // Ordenar historial cronológicamente ascendente
    const sorted = [...fuelHistory].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    let activeAmount = sorted[0].amount; // valor inicial por defecto (el más viejo)
    for (const entry of sorted) {
      if (entry.date <= dateStr) {
        activeAmount = entry.amount;
      }
    }
    return activeAmount;
  };

  const getVirtualFuelRow = (dayDate: string, dayExpenses: Expense[]) => {
    const today = new Date().toISOString().split('T')[0];
    
    // Si la fecha es en el futuro, no proyectar combustible
    if (dayDate > today) return null;
    
    // Si la fecha es domingo, no proyectar combustible
    // 0 = Domingo en getDay()
    const [y, m, d] = dayDate.split('-').map(Number);
    const dateObj = new Date(y, m - 1, d);
    if (dateObj.getDay() === 0) return null;

    const hasRealFuel = dayExpenses.some(e => e.description?.includes('COMBUSTIBLE'));
    if (hasRealFuel) return null; // Si ya se guardó un gasto real, no mostrar el virtual
    
    const fuelAmount = getFuelAmountForDay(dayDate);
    if (fuelAmount <= 0) return null;

    return (
      <VirtualFuelRow 
        key={`virtual-fuel-${dayDate}`}
        date={dayDate}
        amount={fuelAmount}
        settings={activeSettings}
        addExpense={addExpense}
      />
    );
  };

  // Calcular totales incluyendo virtuales
  const totalMonthExpenses = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    return daysInMonth.reduce((acc, dayDate) => {
      const realTotal = existingExpenses.filter(e => e.date.startsWith(dayDate)).reduce((sum, e) => sum + e.amount, 0);
      
      let virtualTotal = 0;
      if (dayDate <= today) {
        const [y, m, d] = dayDate.split('-').map(Number);
        const dateObj = new Date(y, m - 1, d);
        if (dateObj.getDay() !== 0) { // No domingo
          const dayExpenses = existingExpenses.filter(e => e.date.startsWith(dayDate));
          const hasRealFuel = dayExpenses.some(e => e.description?.includes('COMBUSTIBLE'));
          if (!hasRealFuel) virtualTotal = getFuelAmountForDay(dayDate);
        }
      }
      
      return acc + realTotal + (virtualTotal > 0 ? virtualTotal : 0);
    }, 0);
  }, [daysInMonth, existingExpenses, fuelHistory]);

  const totalSueldos = useMemo(() => {
    let total = 0;
    const branchUsers = (Array.isArray(state.users) ? state.users : []).filter(u => 
      (u.managedBy || (u as any).managed_by || u.id) === currentBranchId
    );
    branchUsers.forEach(user => {
      const cfg = user.payConfig;
      if (cfg) {
        if (cfg.scheme === 'monthly') total += (cfg.monthly || 0);
        if (cfg.scheme === 'weekly') total += (cfg.weekly || 0);
      }
    });
    return total;
  }, [state.users, currentBranchId]);

  return (
    <div className="fixed inset-0 bg-slate-900/90 backdrop-blur-sm flex items-start justify-center z-[300] p-4 overflow-hidden pt-10 md:pt-10">
      <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-6xl h-[90vh] overflow-hidden flex flex-col border border-slate-200">
        <div className="p-4 md:p-6 border-b border-slate-100 flex flex-col sm:flex-row justify-between items-center bg-slate-50 gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-emerald-100 text-emerald-600 rounded-xl flex items-center justify-center">
              <i className="fa-solid fa-file-excel text-xl"></i>
            </div>
            <div>
              <h3 className="text-xl font-black text-slate-800 uppercase tracking-tighter">Planilla de Gastos</h3>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Formato Excel - Carga Rápida</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Mes y Año:</label>
              <input
                type="month"
                value={currentMonth}
                onChange={(e) => setCurrentMonth(e.target.value)}
                className="px-4 py-2 border border-slate-200 rounded-xl font-bold text-slate-700 outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            <button onClick={onClose} className="w-10 h-10 bg-white hover:bg-red-50 text-slate-400 hover:text-red-500 border border-slate-200 rounded-xl transition-all flex items-center justify-center">
              <i className="fa-solid fa-xmark text-lg"></i>
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-auto bg-slate-100/50 p-4">
          <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden min-w-[800px]">
            <table className="w-full text-left border-collapse">
              <thead className="bg-slate-800 text-white sticky top-0 z-10">
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
                  const dayExpenses = existingExpenses.filter(e => e.date.startsWith(dayDate));
                  return (
                    <React.Fragment key={dayDate}>
                      {getVirtualFuelRow(dayDate, dayExpenses)}
                      {dayExpenses.filter(e => !e.description?.includes('(ANULADO)')).map(exp => (
                        <ExpenseRow 
                          key={exp.id} 
                          date={dayDate} 
                          expense={exp} 
                          settings={activeSettings} 
                          removeExpense={removeExpense}
                        />
                      ))}
                      <NewExpenseRow 
                        date={dayDate} 
                        addExpense={addExpense} 
                      />
                    </React.Fragment>
                  );
                })}
              </tbody>
              <tfoot className="bg-slate-800 text-white z-10 sticky bottom-0 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)]">
                <tr>
                  <td colSpan={3} className="px-4 py-3 border-r border-slate-700 text-[10px] font-black uppercase tracking-widest text-blue-300 text-right">
                    Sueldos: <span className="font-mono text-[11px] ml-1">{formatCurrency(totalSueldos, activeSettings)}</span>
                  </td>
                  <td className="px-4 py-3 border-r border-slate-700 text-[10px] font-black uppercase tracking-widest text-emerald-400">
                    Gastos: <span className="font-mono text-[11px] ml-1">{formatCurrency(totalMonthExpenses, activeSettings)}</span>
                  </td>
                  <td className="px-2 py-3 font-black font-mono text-white bg-emerald-700 text-center flex flex-col items-center justify-center leading-tight">
                    <span className="text-[8px] uppercase tracking-widest text-emerald-200">TOTAL FINAL</span>
                    <span className="text-[11px]">{formatCurrency(totalMonthExpenses + totalSueldos, activeSettings)}</span>
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

const VirtualFuelRow = ({ date, amount, settings, addExpense }: any) => {
  const [isSaving, setIsSaving] = useState(false);
  const [customAmount, setCustomAmount] = useState(amount.toString());

  const handleSave = () => {
    setIsSaving(true);
    const newExp: Expense = {
      id: crypto.randomUUID(),
      description: 'COMBUSTIBLE DIARIO',
      amount: Number(customAmount),
      category: ExpenseCategory.TRANSPORT, // O la categoría que use
      date: date + 'T12:00:00.000Z'
    };
    addExpense(newExp);
  };

  const handleDelete = () => {
    if (window.confirm('¿Desea anular permanentemente la proyección de combustible para este día?')) {
      setIsSaving(true);
      const newExp: Expense = {
        id: crypto.randomUUID(),
        description: 'COMBUSTIBLE DIARIO (ANULADO)',
        amount: 0,
        category: ExpenseCategory.TRANSPORT,
        date: date + 'T12:00:00.000Z'
      };
      addExpense(newExp);
    }
  };

  return (
    <tr className="bg-orange-50/40 hover:bg-orange-50 transition-colors group border-l-4 border-l-orange-400">
      <td className="px-4 py-2 border-r border-slate-200 text-xs font-bold text-orange-800/80 bg-orange-100/50 flex items-center gap-2">
        <i className="fa-solid fa-gas-pump text-[10px]"></i>
        {formatDate(date)}
      </td>
      <td className="px-4 py-2 border-r border-slate-200">
        <span className="text-xs font-bold text-orange-900 uppercase">COMBUSTIBLE DIARIO (PROYECTADO)</span>
      </td>
      <td className="px-4 py-2 border-r border-slate-200">
        <span className="px-2 py-1 rounded-md text-[9px] font-black uppercase bg-orange-100 text-orange-700 border border-orange-200">
          Transporte
        </span>
      </td>
      <td className="px-4 py-2 border-r border-slate-200">
        <div className="flex items-center gap-2">
           <span className="text-slate-400 text-xs">$</span>
           <input 
              type="number"
              value={customAmount}
              onChange={(e) => setCustomAmount(e.target.value)}
              className="w-full bg-transparent outline-none text-xs font-black font-mono text-orange-900 focus:text-orange-600"
            />
        </div>
      </td>
      <td className="px-4 py-2 text-center">
        <div className="flex items-center gap-1">
          <button 
            onClick={handleSave}
            disabled={isSaving}
            className="flex-1 bg-white hover:bg-orange-100 text-orange-600 border border-orange-300 text-[9px] font-black uppercase tracking-widest py-1.5 rounded transition-colors"
          >
            {isSaving ? '...' : 'Fijar'}
          </button>
          <button 
            onClick={handleDelete}
            disabled={isSaving}
            title="Eliminar proyección para este día"
            className="w-7 h-7 flex items-center justify-center bg-white hover:bg-red-50 text-red-400 hover:text-red-600 border border-red-200 rounded transition-colors"
          >
            <i className="fa-solid fa-trash-can text-[10px]"></i>
          </button>
        </div>
      </td>
    </tr>
  );
};

const ExpenseRow = ({ date, expense, settings, removeExpense, updateExpense }: any) => {
  const [isDeleting, setIsDeleting] = useState(false);
  const [editAmount, setEditAmount] = useState(expense.amount);
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    setEditAmount(expense.amount);
  }, [expense.amount]);

  const handleDelete = () => {
    if (window.confirm('¿Está seguro de que desea eliminar este gasto?')) {
      setIsDeleting(true);
      removeExpense(expense.id);
    }
  };

  const handleUpdate = () => {
    setIsEditing(false);
    if (editAmount !== expense.amount && !isNaN(editAmount)) {
      updateExpense({ ...expense, amount: Number(editAmount) });
    } else {
      setEditAmount(expense.amount);
    }
  };

  return (
    <tr className="hover:bg-amber-50/50 transition-colors bg-white group">
      <td className="px-4 py-2 border-r border-slate-200 text-xs font-bold text-slate-600 bg-slate-50/50">
        {formatDate(date)}
      </td>
      <td className="px-4 py-2 border-r border-slate-200">
        <span className="text-xs font-bold text-slate-800 uppercase">{expense.description || expense.category}</span>
      </td>
      <td className="px-4 py-2 border-r border-slate-200">
        <span className="px-2 py-1 rounded-md text-[9px] font-black uppercase bg-slate-100 text-slate-600 border border-slate-200">
          {expense.category}
        </span>
      </td>
      <td className="px-4 py-2 border-r border-slate-200 text-xs font-black font-mono text-slate-800 relative cursor-pointer" onDoubleClick={() => setIsEditing(true)}>
        {isEditing ? (
          <input 
            type="number"
            value={editAmount}
            autoFocus
            onChange={(e) => setEditAmount(e.target.value)}
            onBlur={handleUpdate}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleUpdate();
              if (e.key === 'Escape') {
                setEditAmount(expense.amount);
                setIsEditing(false);
              }
            }}
            className="w-full px-2 py-1 border border-emerald-400 rounded outline-none focus:ring-1 focus:ring-emerald-500 font-black text-slate-800 bg-emerald-50"
          />
        ) : (
          <div className="flex items-center justify-between" onClick={() => setIsEditing(true)}>
            <span>{formatCurrency(expense.amount, settings)}</span>
            <i className="fa-solid fa-pencil text-[9px] text-slate-300 opacity-0 group-hover:opacity-100 hover:text-emerald-500 transition-all"></i>
          </div>
        )}
      </td>
      <td className="px-4 py-2 text-center flex items-center justify-center gap-2">
        <span className="text-[9px] font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded border border-emerald-100 flex-1">
          GUARDADO
        </span>
        <button 
          onClick={handleDelete}
          disabled={isDeleting}
          className="w-7 h-7 bg-red-50 hover:bg-red-100 text-red-500 rounded flex items-center justify-center transition-colors opacity-0 group-hover:opacity-100 disabled:opacity-50"
          title="Eliminar Gasto"
        >
          <i className="fa-solid fa-trash-can text-[10px]"></i>
        </button>
      </td>
    </tr>
  );
};

const NewExpenseRow = ({ date, addExpense }: any) => {
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<ExpenseCategory>(ExpenseCategory.OTHERS);
  const [amount, setAmount] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = () => {
    const val = Number(amount);
    if (!val || val <= 0) return;
    
    setIsSaving(true);
    const newExp: Expense = {
      id: crypto.randomUUID(),
      description: description.trim(),
      amount: val,
      category,
      date: date + 'T12:00:00.000Z' // Midday to avoid timezone shifting issues
    };
    
    addExpense(newExp);
    
    // Clear inputs after save
    setDescription('');
    setAmount('');
    setIsSaving(false);
  };

  return (
    <tr className="bg-blue-50/30 hover:bg-blue-50 transition-colors border-b-2 border-blue-100">
      <td className="px-4 py-2 border-r border-slate-200 text-xs font-bold text-blue-800/60 bg-blue-50/50 flex items-center gap-2">
        <i className="fa-solid fa-plus text-[10px]"></i>
        {formatDate(date)}
      </td>
      <td className="px-4 py-2 border-r border-slate-200">
        <input 
          type="text"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Escribir gasto..."
          className="w-full bg-transparent outline-none text-xs font-bold text-slate-700 uppercase placeholder:text-slate-400 placeholder:font-normal"
        />
      </td>
      <td className="px-4 py-2 border-r border-slate-200">
        <select 
          value={category}
          onChange={(e) => setCategory(e.target.value as ExpenseCategory)}
          className="w-full bg-transparent outline-none text-xs font-black text-slate-700 uppercase cursor-pointer"
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
          className="w-full bg-transparent outline-none text-xs font-black font-mono text-slate-800 placeholder:text-slate-300"
        />
      </td>
      <td className="px-4 py-2 text-center">
        <button 
          onClick={handleSave}
          disabled={!amount || Number(amount) <= 0 || isSaving}
          className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:bg-slate-400 text-white text-[9px] font-black uppercase tracking-widest py-1.5 rounded transition-colors"
        >
          {isSaving ? '...' : 'Guardar'}
        </button>
      </td>
    </tr>
  );
};
