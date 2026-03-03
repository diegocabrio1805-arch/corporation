
import React, { useState, useMemo, useEffect } from 'react';
import { AppState, CollectionLog, CollectionLogType, PaymentStatus, Role, LoanStatus, Client } from '../types';
import { formatCurrency, generateReceiptText, getDaysOverdue, getLocalDateStringForCountry, generateUUID, calculateTotalPaidFromLogs, convertReceiptForWhatsApp, parseAmount } from '../utils/helpers';
import { getTranslation } from '../utils/translations';
import { generateNoPaymentAIReminder } from '../services/geminiService';
import { Geolocation } from '@capacitor/geolocation';
import PullToRefresh from './PullToRefresh';

interface CollectionRouteProps {
  state: AppState;
  addCollectionAttempt: (log: CollectionLog) => void;
  deleteCollectionLog?: (logId: string) => void;
  updateClient?: (client: Client) => void;
  deleteClient?: (clientId: string) => void;
  onForceSync?: (silent?: boolean) => Promise<void>;
}

const CollectionRoute: React.FC<CollectionRouteProps> = ({ state, addCollectionAttempt, deleteCollectionLog, updateClient, deleteClient, onForceSync }) => {
  const [viewMode, setViewMode] = useState<'active' | 'hidden'>('active');
  const [selectedClient, setSelectedClient] = useState<string | null>(null);
  const [amountInput, setAmountInput] = useState<string>('0');
  const [isVirtualProcessing, setIsVirtualProcessing] = useState(false);
  const [isRenewalProcessing, setIsRenewalProcessing] = useState(false);
  const [receipt, setReceipt] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  const isAdminOrManager = state.currentUser?.role === Role.ADMIN || state.currentUser?.role === Role.MANAGER;
  const currentUserId = state.currentUser?.id;
  const [selectedCollectorFilter, setSelectedCollectorFilter] = useState<string>(isAdminOrManager ? 'all' : (currentUserId || ''));

  const countryTodayStr = getLocalDateStringForCountry(state.settings.country);

  const [startDate, setStartDate] = useState<string>(countryTodayStr);
  const [endDate, setEndDate] = useState<string>(countryTodayStr);

  const ITEMS_PER_PAGE = 15;
  const [currentPage, setCurrentPage] = useState(1);

  const t = getTranslation(state.settings.language);

  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearch, selectedCollectorFilter, viewMode]);

  const isViewingToday = useMemo(() => {
    return startDate === countryTodayStr && endDate === countryTodayStr;
  }, [startDate, endDate, countryTodayStr]);

  const routeLoans = useMemo(() => {
    let loans = (Array.isArray(state.loans) ? state.loans : []).filter(l => l.status === LoanStatus.ACTIVE || l.status === LoanStatus.PAID || l.status === LoanStatus.DEFAULT);
    if (isAdminOrManager && selectedCollectorFilter !== 'all') {
      const filterLower = selectedCollectorFilter.toLowerCase();
      loans = (Array.isArray(loans) ? loans : []).filter(l => (l.collectorId || (l as any).collector_id)?.toLowerCase() === filterLower);
    }
    return loans;
  }, [state.loans, selectedCollectorFilter, isAdminOrManager]);

  const handleRecoverClient = (client: Client) => {
    if (updateClient && confirm(`¿RECUPERAR CLIENTE ${client.name.toUpperCase()} A LA RUTA ACTIVA?`)) {
      updateClient({ ...client, isHidden: false });
    }
  };

  const handleDeleteClient = (client: Client) => {
    if (deleteClient && confirm(`¿ESTÁ SEGURO DE ELIMINAR A ${client.name.toUpperCase()}?\n\nESTA ACCIÓN BORRARÁ TODO SU HISTORIAL DE CRÉDITOS Y PAGOS.\nNO SE PUEDE DESHACER.`)) {
      deleteClient(client.id);
    }
  };

  // OPTIMIZATION: Index logs by loanId once to avoid O(n^2) behavior
  const logsByLoan = useMemo(() => {
    const map: Record<string, CollectionLog[]> = {};
    (Array.isArray(state.collectionLogs) ? state.collectionLogs : []).forEach(log => {
      if (!log.deletedAt) {
        if (!map[log.loanId]) map[log.loanId] = [];
        map[log.loanId].push(log);
      }
    });
    return map;
  }, [state.collectionLogs]);

  const enrichedRoute = useMemo(() => {
    const parseLocal = (s: string) => {
      if (!s) return new Date();
      const parts = s.split('-').map(Number);
      return new Date(parts[0], parts[1] - 1, parts[2]);
    };

    const startLimit = parseLocal(startDate);
    startLimit.setHours(0, 0, 0, 0);
    const endLimit = parseLocal(endDate);
    endLimit.setHours(23, 59, 59, 999);

    return (Array.isArray(routeLoans) ? routeLoans : []).map(loan => {
      const client = (Array.isArray(state.clients) ? state.clients : []).find(c => c.id === loan.clientId);
      const loanLogs = logsByLoan[loan.id] || [];

      // Regla de Oro: Histórico total para determinar si está adelantado o en mora
      const allPayments = (Array.isArray(loanLogs) ? loanLogs : []).filter(log => log.type === CollectionLogType.PAYMENT && !log.isOpening);
      const totalPaidAllTime = allPayments.reduce((acc, log) => acc + (log.amount || 0), 0);

      const rangeLogs = (Array.isArray(loanLogs) ? loanLogs : []).filter(log => {
        const logDate = new Date(log.date);
        return logDate >= startLimit && logDate <= endLimit;
      });

      const totalPaidInRange = (Array.isArray(rangeLogs) ? rangeLogs : [])
        .filter(log => log.type === CollectionLogType.PAYMENT)
        .reduce((acc, curr) => acc + (curr.amount || 0), 0);

      const hasNoPayReport = (Array.isArray(rangeLogs) ? rangeLogs : []).some(log => log.type === CollectionLogType.NO_PAGO);
      const collector = (Array.isArray(state.users) ? state.users : []).find(u => u.id.toLowerCase() === loan.collectorId?.toLowerCase() || u.id.toLowerCase() === (loan as any).collector_id?.toLowerCase());

      // CALCULO DE SALDO PENDIENTE REAL HASTA HOY
      const todayEnd = new Date();
      todayEnd.setHours(23, 59, 59, 999);

      // Suma de lo que debería haber pagado hasta el final del día de hoy
      const dueUntilToday = (Array.isArray(loan.installments) ? loan.installments : [])
        .filter(inst => new Date(inst.dueDate + 'T00:00:00') <= todayEnd)
        .reduce((acc, inst) => acc + inst.amount, 0);

      // Si lo pagado históricamente cubre o supera lo debido hasta hoy, el saldo es 0 (Al Día)
      const realDailyBalance = Math.max(0, dueUntilToday - totalPaidAllTime);

      const totalBalance = Math.max(0, loan.totalAmount - totalPaidAllTime);

      return {
        ...loan,
        client,
        collectorName: collector?.name || 'Admin',
        paidPeriod: totalPaidInRange, // Lo que pagó hoy (para reportes de recaudo)
        visitedNoPayment: hasNoPayReport,
        dailyBalance: isViewingToday ? realDailyBalance : 0,
        totalBalance: totalBalance
      };
    }).filter(item => {
      if (!isViewingToday) {
        if (viewMode === 'hidden') return item.client?.isHidden;
        return (item.paidPeriod > 0 || item.visitedNoPayment) && !item.client?.isHidden;
      }
      if (viewMode === 'hidden') return item.client?.isHidden;
      return item.status !== LoanStatus.PAID && item.totalBalance > 0.01 && !item.client?.isHidden;
    }).sort((a, b) => {
      if (viewMode === 'hidden') {
        const dateA = a.client?.createdAt ? new Date(a.client.createdAt).getTime() : 0;
        const dateB = b.client?.createdAt ? new Date(b.client.createdAt).getTime() : 0;
        return dateB - dateA; // Más recientes arriba
      }
      return 0; // Mantener orden original en ruta activa
    });
  }, [routeLoans, logsByLoan, state.clients, startDate, endDate, isViewingToday, state.users, viewMode]);

  const filteredRoute = useMemo(() => {
    const validEnriched = Array.isArray(enrichedRoute) ? enrichedRoute : [];
    if (!debouncedSearch) return validEnriched;
    const s = debouncedSearch.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, "");
    return validEnriched.filter(item => {
      const nameNorm = (item.client?.name || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, "");
      const addressNorm = (item.client?.address || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, "");
      const docNorm = (item.client?.documentId || '').replace(/\s+/g, "").toLowerCase();
      const idNorm = (item.client?.id || '').replace(/\s+/g, "").toLowerCase();
      const phoneNorm = (item.client?.phone || '').replace(/\D/g, '');
      const secondaryPhoneNorm = (item.client?.secondaryPhone || '').replace(/\D/g, '');
      const searchClean = s.toLowerCase().replace(/\D/g, ''); // For phone numbers

      return nameNorm.includes(s) ||
        addressNorm.includes(s) ||
        docNorm.includes(s) ||
        idNorm.includes(s) ||
        phoneNorm.includes(searchClean || s) ||
        secondaryPhoneNorm.includes(searchClean || s);
    });
  }, [enrichedRoute, debouncedSearch]);

  const totalCollectedInView = useMemo(() => {
    return (Array.isArray(filteredRoute) ? filteredRoute : []).reduce((acc, curr) => acc + (curr.paidPeriod || 0), 0);
  }, [filteredRoute]);

  const totalPages = Math.ceil((Array.isArray(filteredRoute) ? filteredRoute.length : 0) / ITEMS_PER_PAGE);
  const paginatedRoute = useMemo(() => {
    const validFiltered = Array.isArray(filteredRoute) ? filteredRoute : [];
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return validFiltered.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredRoute, currentPage]);

  const resetUI = () => {
    setReceipt(null);
    setSelectedClient(null);
    setIsProcessing(false);
    setIsVirtualProcessing(false);
    setIsRenewalProcessing(false);
    setAmountInput('0');
  };

  const handleOpenPayment = (clientId: string, loan: any) => {
    if (!isViewingToday) return;
    setSelectedClient(clientId);
    const instVal = Number(loan?.installmentValue) || 0;
    const paidPer = Number(loan?.paidPeriod) || 0;
    const initialAmount = Math.max(0, instVal - paidPer);
    setAmountInput(initialAmount.toString());
    setIsVirtualProcessing(false);
    setIsRenewalProcessing(false);
  };

  const triggerPrintTicket = (receiptText: string) => {
    const printWin = window.open('', '_blank', 'width=400,height=600');
    if (printWin) {
      printWin.document.write(`<html><body style="font-family:monospace;white-space:pre-wrap;padding:20px;font-size:12px;">${receiptText}</body></html>`);
      printWin.document.close();
      printWin.focus();
      printWin.print();
      printWin.close();
    }
  };

  const setMethodInRoute = (method: 'cash' | 'virtual' | 'renewal') => {
    setIsVirtualProcessing(method === 'virtual');
    setIsRenewalProcessing(method === 'renewal');

    const loan = (Array.isArray(enrichedRoute) ? enrichedRoute : []).find(l => l.clientId === selectedClient);
    if (!loan) return;
    const totalPaid = calculateTotalPaidFromLogs(loan, state.collectionLogs);

    if (method === 'renewal') {
      setAmountInput(Math.max(0, loan.totalAmount - totalPaid).toString());
    } else {
      setAmountInput(Math.max(0, loan.installmentValue - (loan.paidPeriod || 0)).toString());
    }
  };

  const handleAction = async (clientId: string, loanId: string, type: CollectionLogType, customAmount?: number, isVirtual: boolean = false, isRenewal: boolean = false) => {
    if (isProcessing) return;
    const loan = (Array.isArray(state.loans) ? state.loans : []).find(l => l.id === loanId);
    if (!loan) return;

    setIsProcessing(true);
    try {
      const amountToApply = customAmount || parseAmount(amountInput);
      const logId = generateUUID();

      let currentLocation = { lat: 0, lng: 0 };
      try {
        const position = await Geolocation.getCurrentPosition({ enableHighAccuracy: true, timeout: 2000, maximumAge: 120000 });
        currentLocation = { lat: position.coords.latitude, lng: position.coords.longitude };
      } catch (geoErr) {
        try {
          const fb = await Geolocation.getCurrentPosition({ enableHighAccuracy: false, timeout: 1500, maximumAge: 300000 });
          currentLocation = { lat: fb.coords.latitude, lng: fb.coords.longitude };
        } catch (fallbackErr) {
          console.warn("Could not get real-time GPS, using defaults:", fallbackErr);
        }
      }

      const log: CollectionLog = {
        id: logId,
        clientId,
        loanId,
        type,
        amount: type === CollectionLogType.PAYMENT ? amountToApply : undefined,
        date: new Date().toISOString(),
        location: currentLocation,
        isVirtual,
        isRenewal,
        companySnapshot: state.settings
      };

      addCollectionAttempt(log);

      if (type === CollectionLogType.PAYMENT || type === CollectionLogType.NO_PAGO) {
        if (onForceSync) onForceSync(true);
      }

      const client = (Array.isArray(state.clients) ? state.clients : []).find(c => c.id === clientId);

      if (client && type === CollectionLogType.PAYMENT) {
        const installments = Array.isArray(loan.installments) ? loan.installments : [];
        // Regla de Oro: Recalculamos el total abonado BASADO EN EL HISTORIAL (incluyendo el nuevo pago)
        const totalPaidHistory = calculateTotalPaidFromLogs(loan, state.collectionLogs) + amountToApply;

        const overdueDays = getDaysOverdue(loan, state.settings, totalPaidHistory);
        const lastDueDate = installments.length > 0 ? installments[installments.length - 1].dueDate : loan.createdAt;

        // Cuotas pagadas basadas en el dinero total / valor cuota
        const progress = totalPaidHistory / (loan.installmentValue || 1);
        const formattedProgress = progress % 1 === 0 ? progress : Math.floor(progress * 10) / 10;

        const receiptText = generateReceiptText({
          clientName: client.name,
          amountPaid: amountToApply,
          previousBalance: Math.max(0, (loan.totalAmount || 0) - (totalPaidHistory - amountToApply)),
          loanId,
          startDate: loan.createdAt,
          expiryDate: lastDueDate,
          daysOverdue: overdueDays,
          remainingBalance: Math.max(0, (loan.totalAmount || 0) - totalPaidHistory),
          paidInstallments: Number(formattedProgress), // Pasamos el progreso calculado
          totalInstallments: loan.totalInstallments || 0,
          isRenewal,
          isVirtual,
          installmentValue: loan.installmentValue,
          totalPaidAmount: totalPaidHistory,
          principal: loan.totalAmount,
          frequency: loan.frequency
        }, state.settings);

        // Condición: Solo mostrar recibo en pantalla si hay una impresora conectada
        const { isPrinterConnected, printText } = await import('../services/bluetoothPrinterService');
        const printerAppearsConnected = await isPrinterConnected();

        if (printerAppearsConnected) {
          setReceipt(receiptText);
          try {
            await printText(receiptText);
          } catch (printErr) {
            console.error("Error direct printing:", printErr);
          }
        } else {
          setAmountInput('0');
          setSelectedClient(null);
          setReceipt(null);
        }

        const phone = client.phone.replace(/\D/g, '');
        window.open(`https://wa.me/${phone.length === 10 ? '57' + phone : phone}?text=${encodeURIComponent(receiptText)}`, '_blank');
      } else if (client && type === CollectionLogType.NO_PAGO) {
        let msg = '';
        if (client.customNoPayMessage) {
          msg = client.customNoPayMessage;
        } else {
          const totalPaid = calculateTotalPaidFromLogs(loan, state.collectionLogs);
          const currentBalance = loan.totalAmount - totalPaid;
          const overdueDays = getDaysOverdue(loan, state.settings);
          msg = await generateNoPaymentAIReminder(loan, client, overdueDays, state.settings, currentBalance);
        }
        const cleanMsg = convertReceiptForWhatsApp(msg);
        window.open(`https://wa.me/${client.phone.replace(/\D/g, '')}?text=${encodeURIComponent(cleanMsg)}`, '_blank');
        resetUI();
      }
    } catch (e) {
      console.error(e);
      resetUI();
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDeleteHistoryPayment = (loanId: string) => {
    const parseLocal = (s: string) => {
      const parts = s.split('-').map(Number);
      return new Date(parts[0], parts[1] - 1, parts[2]);
    };
    const startLimit = parseLocal(startDate);
    startLimit.setHours(0, 0, 0, 0);
    const endLimit = parseLocal(endDate);
    endLimit.setHours(23, 59, 59, 999);

    const targetLogs = (Array.isArray(state.collectionLogs) ? state.collectionLogs : [])
      .filter(l => l.loanId === loanId && l.type === CollectionLogType.PAYMENT && !l.deletedAt)
      .filter(l => {
        const d = new Date(l.date);
        return d >= startLimit && d <= endLimit;
      })
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    if (targetLogs.length > 0) {
      if (confirm(`¿ELIMINAR ESTE PAGO POR ${formatCurrency(targetLogs[0].amount || 0, state.settings)}?`)) {
        deleteCollectionLog?.(targetLogs[0].id);
      }
    } else {
      alert("No hay pagos para este crédito en el rango seleccionado.");
    }
  };

  return (
    <PullToRefresh onRefresh={async () => { if (onForceSync) await onForceSync(false); }}>
      <div className="w-full max-w-6xl mx-auto space-y-4 pb-32 animate-fadeIn px-1 md:px-0">
        <div className="bg-white p-4 md:p-5 rounded-2xl md:rounded-[2.5rem] border border-slate-200 shadow-sm space-y-4">
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
            <div className="flex items-center gap-3 md:gap-4 w-full md:w-auto">
              <div className={`w-10 h-10 md:w-12 md:h-12 shrink-0 ${isViewingToday ? 'bg-emerald-600 shadow-emerald-500/20' : 'bg-blue-600 shadow-blue-500/20'} rounded-xl md:rounded-2xl flex items-center justify-center text-white shadow-xl`}>
                <i className={`fa-solid ${isViewingToday ? 'fa-route' : 'fa-clock-rotate-left'} text-lg md:text-xl`}></i>
              </div>
              <div className="min-w-0">
                <h2 className="text-base md:text-lg font-black text-slate-800 uppercase tracking-tighter truncate">Planilla de Ruta</h2>
                <p className="text-[8px] md:text-[9px] font-black uppercase text-slate-500 tracking-widest truncate">
                  {selectedCollectorFilter === 'all' ? 'CONSOLIDADO' : (Array.isArray(state.users) ? state.users : []).find(u => u.id === selectedCollectorFilter)?.name.toUpperCase()}
                </p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full lg:w-auto">
              {isAdminOrManager && (
                <div className="bg-slate-100 px-3 py-1.5 rounded-xl border border-slate-200 flex items-center gap-2 shadow-inner">
                  <i className="fa-solid fa-user-gear text-emerald-600 text-[10px]"></i>
                  <select
                    value={selectedCollectorFilter}
                    onChange={(e) => setSelectedCollectorFilter(e.target.value)}
                    className="bg-transparent border-none outline-none text-[9px] font-black text-black uppercase tracking-widest cursor-pointer w-full focus:ring-0"
                  >
                    {selectedCollectorFilter === 'all' ? <option value="all">TODAS LAS RUTAS</option> : null}
                    {(Array.isArray(state.users) ? state.users : []).filter(u => u.role === Role.COLLECTOR && (u.id.toLowerCase() === currentUserId?.toLowerCase() || (u.managedBy || (u as any).managed_by)?.toLowerCase() === currentUserId?.toLowerCase())).map(u => (
                      <option key={u.id} value={u.id}>{u.name.toUpperCase()}</option>
                    ))}
                  </select>
                </div>
              )}
              <div className="flex items-center justify-between gap-2 bg-slate-100 px-3 py-1.5 rounded-xl border border-slate-200 shadow-inner">
                <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="bg-transparent text-[9px] font-black text-black outline-none uppercase w-full" />
                <span className="text-slate-400 font-bold">-</span>
                <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="bg-transparent text-[9px] font-black text-black outline-none uppercase w-full" />
              </div>
              {onForceSync && (
                <button
                  onClick={() => onForceSync(false)}
                  className="bg-emerald-100 text-emerald-700 px-4 py-3 rounded-xl border border-emerald-200 flex items-center gap-2 hover:bg-emerald-200 transition-all active:scale-95 shadow-sm"
                >
                  <i className="fa-solid fa-rotate text-[10px] animate-spin-slow"></i>
                  <span className="text-[9px] font-black uppercase tracking-widest">Sincronizar</span>
                </button>
              )}
            </div>

            <div className="flex gap-2 border-t border-slate-100 pt-3">
              <button onClick={() => setViewMode('active')} className={`flex-1 py-3 text-[9px] font-black uppercase tracking-widest rounded-xl transition-all ${viewMode === 'active' ? 'bg-slate-900 text-white shadow-lg' : 'bg-slate-50 text-slate-400 hover:bg-slate-100'}`}>Ruta Activa</button>
              <button onClick={() => setViewMode('hidden')} className={`flex-1 py-3 text-[9px] font-black uppercase tracking-widest rounded-xl transition-all ${viewMode === 'hidden' ? 'bg-red-600 text-white shadow-lg' : 'bg-slate-50 text-slate-400 hover:bg-slate-100'}`}>Ocultos / Incobrables</button>
            </div>
          </div>

          <div className="flex flex-col md:flex-row items-center gap-3 w-full border-t border-slate-100 pt-3 md:pt-4">
            <div className="relative w-full">
              <input type="text" placeholder="Filtrar por nombre..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl md:rounded-2xl text-[10px] md:text-xs font-bold outline-none focus:ring-2 focus:ring-emerald-500 shadow-inner text-black" />
              <i className="fa-solid fa-search absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 text-[10px] md:text-xs"></i>
            </div>
            <div className="bg-slate-900 px-5 md:px-6 py-3 rounded-xl md:rounded-2xl border border-slate-800 flex flex-row md:flex-col justify-between md:justify-center items-center md:items-end shrink-0 shadow-xl w-full md:w-auto">
              <span className="text-[7px] font-black text-slate-500 uppercase md:mb-0.5">Recaudo</span>
              <span className="text-base md:text-lg font-black text-emerald-400 font-mono leading-none">{formatCurrency(totalCollectedInView, state.settings)}</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl md:rounded-[2rem] border border-slate-200 shadow-xl overflow-hidden">
          <div className="overflow-x-auto mobile-scroll-container">
            <table className="w-full text-left border-collapse min-w-[600px]">
              <thead>
                <tr className="bg-slate-100 text-slate-500 text-[8px] md:text-[9px] font-black uppercase border-b border-slate-200">
                  <th className="px-3 md:px-4 py-4">Cliente</th>
                  {viewMode === 'hidden' ? (
                    <>
                      <th className="px-3 md:px-4 py-4 text-center">Registro</th>
                      <th className="px-3 md:px-4 py-4 text-center">Teléfono</th>
                      <th className="px-3 md:px-4 py-4 text-center line-clamp-1">Saldo Deuda</th>
                    </>
                  ) : (
                    <>
                      <th className="px-3 md:px-4 py-4 text-center">Base</th>
                      <th className="px-3 md:px-4 py-4 text-center bg-emerald-50/50">Abono</th>
                      <th className="px-3 md:px-4 py-4 text-center">Estatus</th>
                    </>
                  )}
                  <th className="px-3 md:px-4 py-4 text-center">Gestión</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {(Array.isArray(paginatedRoute) ? paginatedRoute : []).map((item) => (
                  <tr key={item.id} className={`hover:bg-slate-50/80 transition-all ${item.paidPeriod > 0 ? 'bg-emerald-50/10' : ''}`}>
                    <td className="px-3 md:px-4 py-4">
                      <p className="text-[10px] md:text-[11px] font-black text-slate-800 uppercase tracking-tighter truncate max-w-[150px]">{item.client?.name}</p>
                      <p className="text-[7px] font-black text-blue-500 uppercase tracking-widest mt-0.5 truncate">{item.client?.address}</p>
                    </td>
                    {viewMode === 'hidden' ? (
                      <>
                        <td className="px-3 md:px-4 py-4 text-center font-mono text-[9px] text-slate-500 truncate">
                          {item.client?.createdAt ? new Date(item.client.createdAt).toLocaleDateString('es-CO') : '-'}
                        </td>
                        <td className="px-3 md:px-4 py-4 text-center font-black text-[9px] text-slate-600 whitespace-nowrap">
                          {item.client?.phone}
                        </td>
                        <td className="px-3 md:px-4 py-4 text-center font-black font-mono text-[10px] text-red-600">
                          {formatCurrency(Math.max(0, (item.totalAmount || 0) - ((Array.isArray(state.collectionLogs) ? state.collectionLogs : []).filter(log => log.loanId === item.id && log.type === CollectionLogType.PAYMENT && !log.isOpening && !log.deletedAt).reduce((acc, log) => acc + (log.amount || 0), 0))), state.settings)}
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="px-3 md:px-4 py-4 text-center font-mono text-[9px] md:text-[10px] text-slate-500">{formatCurrency(item.installmentValue, state.settings)}</td>
                        <td className={`px-3 md:px-4 py-4 text-center font-black font-mono text-[10px] md:text-[11px] ${item.paidPeriod > 0 ? 'text-emerald-600' : 'text-slate-300'}`}>
                          {item.paidPeriod > 0 ? formatCurrency(item.paidPeriod, state.settings) : '-'}
                        </td>
                        <td className="px-3 md:px-4 py-4 text-center font-bold text-[9px] md:text-[10px]">
                          {isViewingToday ? (
                            <span className={`font-mono ${item.dailyBalance > 0 ? 'text-red-500' : 'text-emerald-400'}`}>{item.dailyBalance > 0 ? formatCurrency(item.dailyBalance, state.settings) : 'AL DÍA'}</span>
                          ) : (
                            <span className={`text-[7px] md:text-[8px] font-black uppercase px-2 py-1 rounded-md ${item.paidPeriod > 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>{item.paidPeriod > 0 ? 'Cobro' : 'No Pago'}</span>
                          )}
                        </td>
                      </>
                    )}
                    <td className="px-3 md:px-4 py-4">
                      <div className="flex items-center justify-center gap-2">
                        {viewMode === 'hidden' ? (
                          <div className="flex gap-2">
                            <button onClick={() => item.client && handleRecoverClient(item.client)} className="px-4 py-3 bg-blue-600 text-white rounded-lg font-black text-[9px] uppercase active:scale-95 transition-all shadow-md">RECUPERAR</button>
                            {isAdminOrManager && <button onClick={() => item.client && handleDeleteClient(item.client)} className="px-4 py-3 bg-red-600 text-white rounded-lg font-black text-[9px] uppercase active:scale-95 transition-all shadow-md">ELIMINAR</button>}
                          </div>
                        ) : isViewingToday ? (
                          item.paidPeriod === 0 && !item.visitedNoPayment ? (
                            <div className="flex gap-2">
                              <button onClick={() => handleOpenPayment(item.clientId, item)} className="px-4 py-3 bg-emerald-600 text-white rounded-lg font-black text-[9px] uppercase active:scale-95 transition-all shadow-md">Abonar</button>
                              {isAdminOrManager && <button onClick={() => item.client && handleDeleteClient(item.client)} className="px-4 py-3 bg-red-600 text-white rounded-lg font-black text-[9px] uppercase active:scale-95 transition-all shadow-md">ELIMINAR</button>}
                            </div>
                          ) : (
                            <div className="flex gap-1.5">
                              <span className={`text-[7px] md:text-[8px] font-black uppercase px-2 py-2 rounded-lg flex items-center ${item.paidPeriod > 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'}`}>{item.paidPeriod > 0 ? 'RECIBIDO' : 'MORA'}</span>
                              {isAdminOrManager && (
                                <>
                                  <button onClick={() => handleOpenPayment(item.clientId, item)} className="w-9 h-9 text-blue-500 bg-white border border-blue-100 rounded-lg flex items-center justify-center shadow-sm active:scale-90"><i className="fa-solid fa-plus-circle"></i></button>
                                  {item.paidPeriod > 0 && (
                                    <button onClick={() => handleDeleteHistoryPayment(item.id)} className="w-9 h-9 text-red-500 bg-white border border-red-100 rounded-lg flex items-center justify-center shadow-sm active:scale-90"><i className="fa-solid fa-trash-can"></i></button>
                                  )}
                                  <button onClick={() => item.client && handleDeleteClient(item.client)} className="px-3 py-2 bg-red-600 text-white rounded-lg font-black text-[8px] uppercase active:scale-95 transition-all shadow-md">ELIMINAR</button>
                                </>
                              )}
                            </div>
                          )
                        ) : (
                          isAdminOrManager && item.paidPeriod > 0 && (
                            <button onClick={() => handleDeleteHistoryPayment(item.id)} className="w-9 h-9 rounded-lg bg-red-50 text-red-600 flex items-center justify-center border border-red-100 active:scale-90 transition-all shadow-sm">
                              <i className="fa-solid fa-trash-can"></i>
                            </button>
                          )
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {totalPages > 1 && (
          <div className="flex justify-center items-center gap-3 py-6">
            <button disabled={currentPage === 1} onClick={() => setCurrentPage(prev => prev - 1)} className="p-3 bg-white border border-slate-200 rounded-xl text-slate-400 disabled:opacity-30 active:scale-90 shadow-sm"><i className="fa-solid fa-chevron-left"></i></button>
            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-4">{currentPage} de {totalPages}</span>
            <button disabled={currentPage === totalPages} onClick={() => setCurrentPage(prev => prev + 1)} className="p-3 bg-white border border-slate-200 rounded-xl text-slate-400 disabled:opacity-30 active:scale-90 shadow-sm"><i className="fa-solid fa-chevron-right"></i></button>
          </div>
        )}

        {selectedClient && (
          <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md flex items-center justify-center z-[200] p-2">
            <div className="bg-white rounded-[2rem] shadow-2xl w-full max-sm p-6 text-center animate-scaleIn border border-white/20">
              <div className="w-14 h-14 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center mx-auto mb-4 text-xl border border-emerald-100">
                <i className="fa-solid fa-hand-holding-dollar"></i>
              </div>
              <h3 className="text-base font-black text-slate-800 mb-4 uppercase tracking-tighter">Registrar Abono</h3>

              <div className="grid grid-cols-3 gap-2 mb-6">
                <button onClick={() => setMethodInRoute('cash')} className={`py-3 rounded-lg text-[8px] font-black uppercase border transition-all ${!isVirtualProcessing && !isRenewalProcessing ? 'bg-slate-900 text-white shadow-md' : 'bg-slate-50 text-slate-400 active:bg-slate-100'}`}>Efectivo</button>
                <button onClick={() => setMethodInRoute('virtual')} className={`py-3 rounded-lg text-[8px] font-black uppercase border transition-all ${isVirtualProcessing ? 'bg-blue-600 text-white shadow-md' : 'bg-slate-50 text-slate-400 active:bg-slate-100'}`}>Transf.</button>
                <button onClick={() => setMethodInRoute('renewal')} className={`py-3 rounded-lg text-[8px] font-black uppercase border transition-all ${isRenewalProcessing ? 'bg-amber-600 text-white shadow-md' : 'bg-slate-50 text-slate-400 active:bg-slate-100'}`}>Renovar</button>
              </div>

              <div className="relative mb-6">
                <span className="absolute left-5 top-1/2 -translate-y-1/2 text-2xl font-black text-slate-300">$</span>
                <input
                  type="text"
                  inputMode="numeric"
                  autoFocus
                  value={amountInput}
                  onChange={(e) => setAmountInput(e.target.value)}
                  className="w-full pl-12 pr-5 py-8 text-3xl font-black bg-slate-50 rounded-2xl text-center outline-none border-2 border-transparent focus:border-emerald-500 transition-all text-slate-900 shadow-inner"
                />
              </div>
              <div className="space-y-2">
                <button
                  onClick={() => {
                    if (!enrichedRoute || !selectedClient) return;
                    const item = enrichedRoute.find(l => l.clientId === selectedClient);
                    if (!item) return;

                    const finalAmount = parseAmount(amountInput);

                    // REGLA GLOBAL: Si el monto es muy pequeño (ej: < 500), pedir confirmación triple para evitar errores como registrar "25" en vez de "25000"
                    const threshold = 500;
                    if (finalAmount > 0 && finalAmount < threshold) {
                      if (!confirm(`¡ATENCIÓN!\n\nHas ingresado un monto de ${formatCurrency(finalAmount, state.settings)}.\n\n¿Estás SEGURO de que este monto es correcto y no quisiste poner un número mayor?`)) {
                        return;
                      }
                    }

                    handleAction(selectedClient!, item.id, CollectionLogType.PAYMENT, finalAmount, isVirtualProcessing, isRenewalProcessing);
                  }}
                  className="w-full font-black py-5 bg-emerald-600 text-white rounded-xl shadow-xl uppercase text-[10px] tracking-widest active:scale-95 transition-all"
                >
                  Confirmar e Imprimir
                </button>
                <button onClick={resetUI} className="w-full py-3 text-[9px] font-black text-slate-400 uppercase tracking-widest hover:text-red-500 transition-colors">CERRAR</button>
              </div>
            </div>
          </div>
        )}

        {receipt && (
          <div className="fixed inset-0 bg-slate-900/95 backdrop-blur-xl flex items-center justify-center z-[160] p-4 overflow-y-auto">
            <div className="bg-white rounded-[2rem] text-center max-w-sm w-full animate-scaleIn shadow-2xl overflow-hidden">
              {/* Header de navegación en el ticket */}
              <div className="flex justify-between items-center px-6 py-4 border-b border-slate-100 italic bg-white sticky top-0">
                <button onClick={() => setReceipt(null)} className="text-slate-400 hover:text-slate-600 transition-all active:scale-90">
                  <i className="fa-solid fa-arrow-left text-lg"></i>
                </button>
                <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Vista de Comprobante</span>
                <button onClick={() => setReceipt(null)} className="text-slate-400 hover:text-red-500 transition-all active:scale-90">
                  <i className="fa-solid fa-xmark text-xl"></i>
                </button>
              </div>

              <div className="p-6 md:p-8">
                <div className="w-16 h-16 bg-green-100 text-green-600 rounded-2xl flex items-center justify-center mx-auto mb-6 text-3xl shadow-xl border border-green-200">
                  <i className="fa-solid fa-check-double"></i>
                </div>
                <h3 className="text-xl font-black text-slate-800 mb-6 uppercase tracking-tighter">¡Gestión Exitosa!</h3>
                <div className="bg-slate-50 p-4 md:p-6 rounded-xl md:rounded-2xl font-mono text-[9px] md:text-[10px] text-left mb-8 max-h-60 overflow-y-auto border border-slate-200 text-black font-black shadow-inner whitespace-pre-wrap leading-relaxed">
                  {receipt}
                </div>
                <div className="flex flex-col gap-2">
                  <button onClick={() => setReceipt(null)} className="w-full py-4 bg-slate-900 text-white rounded-xl font-black uppercase text-[10px] tracking-widest shadow-2xl active:scale-95 transition-all">
                    Finalizar y Salir
                  </button>
                  <button
                    onClick={async () => {
                      const { printText } = await import('../services/bluetoothPrinterService');
                      printText(receipt || '').catch(e => alert("Error impresión: " + e));
                    }}
                    className="w-full py-4 bg-purple-600 text-white rounded-xl font-black uppercase text-[10px] tracking-widest shadow-xl active:scale-95 transition-all"
                  >
                    <i className="fa-solid fa-print mr-2"></i> Re-Imprimir Ticket
                  </button>
                  <button
                    onClick={() => {
                      const client = (Array.isArray(state.clients) ? state.clients : []).find(c =>
                        receipt.includes(c.name.toUpperCase().substring(0, 10))
                      );
                      const phone = client?.phone.replace(/\D/g, '') || '';
                      const wpUrl = `https://wa.me/${phone.length === 10 ? '57' + phone : phone}?text=${encodeURIComponent(receipt || '')}`;
                      window.open(wpUrl, '_blank');
                    }}
                    className="w-full py-4 bg-emerald-600 text-white rounded-xl font-black uppercase text-[10px] tracking-widest shadow-xl active:scale-95 transition-all"
                  >
                    <i className="fa-brands fa-whatsapp mr-2"></i> Enviar por WhatsApp
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </PullToRefresh>
  );
};

export default CollectionRoute;
