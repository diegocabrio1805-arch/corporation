
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { AppState, Loan, LoanStatus, Role, PaymentStatus, CollectionLog, CollectionLogType, Client } from '../types';
import { formatCurrency, generateReceiptText, getDaysOverdue, formatDate, generateUUID, ReceiptData, calculateTotalPaidFromLogs } from '../utils/helpers';
import { getTranslation } from '../utils/translations';
import { generateAIStatement, generateNoPaymentAIReminder } from '../services/geminiService';
import { Geolocation } from '@capacitor/geolocation';

interface LoansProps {
  state: AppState;
  addLoan: (loan: Loan) => void;
  updateLoanDates: (loanId: string, newStartDate: string) => void;
  addCollectionAttempt: (log: CollectionLog) => void;
  deleteCollectionLog: (logId: string) => void;
  updateClient?: (client: Client) => void;
  onForceSync?: (silent?: boolean) => Promise<void>;
}

const Loans: React.FC<LoansProps> = ({ state, addCollectionAttempt, deleteCollectionLog, updateClient, onForceSync }) => {
  const [viewMode, setViewMode] = useState<'gestion' | 'renovaciones' | 'vencidos' | 'ocultos'>('gestion');
  const [selectedLoanId, setSelectedLoanId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [showPaymentInput, setShowPaymentInput] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState<number>(0);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [isVirtualPayment, setIsVirtualPayment] = useState(false);
  const [isRenewalPayment, setIsRenewalPayment] = useState(false);
  const [receipt, setReceipt] = useState<string | null>(null);
  const [editingReceipt, setEditingReceipt] = useState<ReceiptData | null>(null);
  const [lastLogId, setLastLogId] = useState<string | null>(null);

  // PAGINATION LOGIC
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 20;

  const t = getTranslation(state.settings.language);
  const isAdminOrManager = state.currentUser?.role === Role.ADMIN || state.currentUser?.role === Role.MANAGER;

  // Filtrado de préstamos general
  const filteredLoans = useMemo(() => {
    return (Array.isArray(state.loans) ? state.loans : []).filter((loan) => {
      const client = (Array.isArray(state.clients) ? state.clients : []).find(c => c.id === loan.clientId);
      if (!client || client.isHidden) return false;
      const searchLower = searchTerm.toLowerCase();

      const matchesSearch = client.name.toLowerCase().includes(searchLower) ||
        client.address.toLowerCase().includes(searchLower) ||
        client.documentId.includes(searchLower);

      if (viewMode === 'vencidos') {
        return matchesSearch && getDaysOverdue(loan, state.settings) > 0;
      }

      if (viewMode === 'renovaciones') {
        // Solo mostrar créditos marcados como renovaciones
        return matchesSearch && loan.isRenewal === true && loan.status === LoanStatus.ACTIVE;
      }

      // Balance usando logs (consistente con getClientMetrics y el panel de saldo)
      const loanLogs = (Array.isArray(state.collectionLogs) ? state.collectionLogs : [])
        .filter(l => l.loanId === loan.id && l.type === CollectionLogType.PAYMENT && !l.isOpening && !l.deletedAt);
      const totalPaidFromLogs = loanLogs.reduce((acc: number, l: any) => acc + (l.amount || 0), 0);
      const balanceFromLogs = loan.totalAmount - totalPaidFromLogs;
      const isActuallyPaid = loan.status === LoanStatus.PAID || balanceFromLogs <= 0.01;
      return matchesSearch && !isActuallyPaid;
    }).sort((a, b) => {
      if (viewMode === 'vencidos') {
        return getDaysOverdue(b, state.settings) - getDaysOverdue(a, state.settings);
      }
      // Ordenar por fecha de creación para renovaciones (más recientes primero)
      if (viewMode === 'renovaciones') {
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }
      return 0;
    });
  }, [state.loans, state.clients, state.collectionLogs, searchTerm, state.currentUser, isAdminOrManager, viewMode]);

  // RESET PAGE ON FILTER CHANGE
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, viewMode]);

  // PAGINATED DATA
  const paginatedLoans = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredLoans.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredLoans, currentPage]);

  const totalPages = Math.ceil(filteredLoans.length / ITEMS_PER_PAGE);

  // Filtrado de clientes ocultos
  const hiddenClientsData = useMemo(() => {
    if (viewMode !== 'ocultos') return [];
    return (Array.isArray(state.clients) ? state.clients : []).filter(c => c.isHidden).map(client => {
      const activeLoan = (Array.isArray(state.loans) ? state.loans : []).find(l => l.clientId === client.id && (l.status === LoanStatus.ACTIVE || l.status === LoanStatus.DEFAULT));
      let balance = 0;
      if (activeLoan) {
        const totalPaid = calculateTotalPaidFromLogs(activeLoan, state.collectionLogs);
        balance = activeLoan.totalAmount - totalPaid;
      }
      return { ...client, balance };
    }).sort((a, b) => {
      const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return dateB - dateA;
    });
  }, [state.clients, state.loans, viewMode]);

  const resetUI = () => {
    setReceipt(null);
    setEditingReceipt(null);
    setLastLogId(null);
    setShowPaymentInput(false);
    setSelectedLoanId(null);
    setIsProcessingPayment(false);
    setIsVirtualPayment(false);
    setIsRenewalPayment(false);
    setPaymentAmount(0);
  };

  const handleOpenPayment = (loan: Loan) => {
    setSelectedLoanId(loan.id);
    setPaymentAmount(loan.installmentValue);
    setIsVirtualPayment(false);
    setIsRenewalPayment(false);
    setShowPaymentInput(true);
  };

  const handleRestoreClient = (client: any) => {
    if (!isAdminOrManager) return;
    if (updateClient && confirm(`¿DESEA MOSTRAR NUEVAMENTE A ${client.name.toUpperCase()} EN LA CARTERA ACTIVA?`)) {
      updateClient({ ...client, isHidden: false });
    }
  };

  const triggerPrintTicket = async (receiptText: string) => {
    // 4. Imprimir vía Bluetooth
    const { printText } = await import('../services/bluetoothPrinterService');
    try {
      await printText(receiptText);
      alert("Reimpresión enviada a la impresora.");
    } catch (printErr) {
      console.error("Error direct printing:", printErr);
      alert("Error: No se pudo conectar con la impresora Bluetooth.");
    }
  };

  const handlePrintOverdueReport = () => {
    const printWin = window.open('', '_blank');
    if (!printWin) return;

    const tableRows = (Array.isArray(filteredLoans) ? filteredLoans : []).map(loan => {
      const client = (Array.isArray(state.clients) ? state.clients : []).find(c => c.id === loan.clientId);
      const totalPaid = calculateTotalPaidFromLogs(loan, state.collectionLogs);
      const mora = getDaysOverdue(loan, state.settings, totalPaid);
      const balance = loan.totalAmount - totalPaid;
      return `
        <tr>
          <td style="border: 1px solid #ddd; padding: 8px;">${client?.name || '---'}</td>
          <td style="border: 1px solid #ddd; padding: 8px;">${client?.phone || '---'}</td>
          <td style="border: 1px solid #ddd; padding: 8px;">${client?.address || '---'}</td>
          <td style="border: 1px solid #ddd; padding: 8px; text-align: center; color: red; font-weight: bold;">${mora}</td>
          <td style="border: 1px solid #ddd; padding: 8px; text-align: right;">${formatCurrency(loan.installmentValue, state.settings)}</td>
          <td style="border: 1px solid #ddd; padding: 8px; text-align: right; font-weight: bold;">${formatCurrency(balance, state.settings)}</td>
        </tr>
      `;
    }).join('');

    const html = `
      <html>
        <head>
          <title>REPORTE DE COBROS VENCIDOS - ${new Date().toLocaleDateString()}</title>
          <style>
            body { font-family: sans-serif; padding: 20px; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th { background-color: #f2f2f2; border: 1px solid #ddd; padding: 12px; text-align: left; font-size: 12px; text-transform: uppercase; }
            h1 { text-align: center; font-size: 20px; text-transform: uppercase; }
            .header-info { text-align: center; font-size: 12px; color: #666; margin-bottom: 30px; }
          </style>
        </head>
        <body>
          <h1>REPORTE DE CARTERA VENCIDA</h1>
          <div class="header-info">Generado el ${new Date().toLocaleString()} | ${state.settings.companyName || 'ANEXO COBRO'}</div>
          <table>
            <thead>
              <tr>
                <th>Cliente</th>
                <th>Teléfono</th>
                <th>Dirección</th>
                <th>Días Mora</th>
                <th>Valor Cuota</th>
                <th>Saldo Total</th>
              </tr>
            </thead>
            <tbody>
              ${tableRows}
            </tbody>
          </table>
        </body>
      </html>
    `;

    printWin.document.write(html);
    printWin.document.close();
    printWin.focus();
    setTimeout(() => {
      printWin.print();
      printWin.close();
    }, 500);
  };

  const setMethod = (method: 'cash' | 'virtual' | 'renewal') => {
    setIsVirtualPayment(method === 'virtual');
    setIsRenewalPayment(method === 'renewal');

    if (method === 'renewal' && selectedLoanId) {
      const loan = (Array.isArray(state.loans) ? state.loans : []).find(l => l.id === selectedLoanId);
      if (loan) {
        const totalPaid = calculateTotalPaidFromLogs(loan, state.collectionLogs);
        setPaymentAmount(Math.max(0, loan.totalAmount - totalPaid));
      }
    } else {
      const loan = (Array.isArray(state.loans) ? state.loans : []).find(l => l.id === selectedLoanId);
      if (loan) setPaymentAmount(loan.installmentValue);
    }
  };

  const handleQuickAction = async (loanId: string, type: CollectionLogType, customAmount?: number, isVirtual: boolean = false, isRenewal: boolean = false) => {
    if (isProcessingPayment) return;
    const loan = (Array.isArray(state.loans) ? state.loans : []).find(l => l.id === loanId);
    if (!loan) return;

    setIsProcessingPayment(true);
    try {
      const client = (Array.isArray(state.clients) ? state.clients : []).find(c => c.id === loan.clientId);
      const amountToPay = customAmount || loan.installmentValue;
      const logId = generateUUID();
      let currentLocation = { lat: 0, lng: 0 };

      // VALIDACIÓN DE SALDO: No permitir pagos mayores al saldo
      const loanLogs = (Array.isArray(state.collectionLogs) ? state.collectionLogs : []).filter(l => l.loanId === loan.id && l.type === CollectionLogType.PAYMENT && !l.isOpening && !l.deletedAt);
      const currentTotalPaid = loanLogs.reduce((acc, l) => acc + (l.amount || 0), 0);
      const remainingBalance = loan.totalAmount - currentTotalPaid;

      if (type === CollectionLogType.PAYMENT && amountToPay > (remainingBalance + 0.01)) {
        alert(`ERROR: El abono (${formatCurrency(amountToPay, state.settings)}) no puede superar el saldo pendiente (${formatCurrency(remainingBalance, state.settings)}).`);
        setIsProcessingPayment(false);
        return;
      }

      // Intentar obtener ubicación real con timeout extendido
      try {
        console.log("Obteniendo ubicación GPS obligatoria...");
        const pos = await Geolocation.getCurrentPosition({
          enableHighAccuracy: true,
          timeout: 2000,
          maximumAge: 120000
        });
        currentLocation = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      } catch (geoErr) {
        try {
          const fb = await Geolocation.getCurrentPosition({ enableHighAccuracy: false, timeout: 1500, maximumAge: 300000 });
          currentLocation = { lat: fb.coords.latitude, lng: fb.coords.longitude };
        } catch (fbErr) {
          console.warn("Falla en captura GPS:", fbErr);
        }
      }

      // GPS fallback: solo advertir, NO bloquear el pago
      if (currentLocation.lat === 0 && currentLocation.lng === 0) {
        console.warn("GPS no disponible. El pago se registrará sin ubicación exacta.");
      }

      const log: CollectionLog = {
        id: logId,
        clientId: loan.clientId,
        loanId: loan.id,
        type: type,
        amount: type === CollectionLogType.PAYMENT ? amountToPay : undefined,
        date: new Date().toISOString(),
        location: currentLocation,
        isVirtual,
        isRenewal,
        companySnapshot: state.settings
      };

      addCollectionAttempt(log);
      setLastLogId(logId);

      if (client && type === CollectionLogType.PAYMENT) {
        const loanLogs = (Array.isArray(state.collectionLogs) ? state.collectionLogs : []).filter(log => log.loanId === loan.id && log.type === CollectionLogType.PAYMENT && !log.isOpening && !log.deletedAt);
        const totalPaidHistory = loanLogs.reduce((acc, log) => acc + (log.amount || 0), 0) + amountToPay;

        const progress = totalPaidHistory / (loan.installmentValue || 1);
        const paidInstCount = progress % 1 === 0 ? progress : Math.floor(progress * 10) / 10;

        const overdueDays = getDaysOverdue(loan, state.settings, totalPaidHistory);

        const receiptData: ReceiptData = {
          clientName: client.name,
          amountPaid: amountToPay,
          previousBalance: Math.max(0, loan.totalAmount - (totalPaidHistory - amountToPay)),
          loanId: loan.id,
          startDate: loan.createdAt,
          expiryDate: (Array.isArray(loan.installments) && loan.installments.length > 0)
            ? loan.installments[loan.installments.length - 1].dueDate
            : new Date().toISOString(),
          daysOverdue: overdueDays,
          remainingBalance: Math.max(0, loan.totalAmount - totalPaidHistory),
          paidInstallments: paidInstCount,
          totalInstallments: loan.totalInstallments,
          isRenewal,
          isVirtual,
          installmentValue: loan.installmentValue,
          totalPaidAmount: totalPaidHistory,
          principal: loan.totalAmount,
          // Pre-populate with settings explicitly, fallback to null/empty to allow generateReceiptText to use settings
          companyNameManual: state.settings.companyName || null,
          companyAliasManual: state.settings.companyAlias || null,
          contactLabelManual: "TEL. PUBLICO",
          contactPhoneManual: state.settings.contactPhone || null,
          companyIdentifierLabelManual: "ID EMPRESA",
          companyIdentifierManual: state.settings.companyIdentifier || null,
          shareLabelManual: state.settings.shareLabel || null,
          shareValueManual: state.settings.shareValue || null,
          supportLabelManual: "NUMERO CO",
          supportPhoneManual: state.settings.technicalSupportPhone || null,
          fullDateTimeManual: new Date().toLocaleString()
        };

        // Direct register and UI flow
        const finalReceipt = generateReceiptText(receiptData, state.settings);
        setReceipt(finalReceipt);
        setShowPaymentInput(false);

        // Silent print
        const { printText } = await import('../services/bluetoothPrinterService');
        printText(finalReceipt).catch(() => { });

        // WhatsApp
        if (client) {
          const phone = client.phone.replace(/\D/g, '');
          window.open(`https://wa.me/${phone.length === 10 ? '57' + phone : phone}?text=${encodeURIComponent(finalReceipt)}`, '_blank');
        }
      } else if (type === CollectionLogType.NO_PAGO) {
        const totalPaid = calculateTotalPaidFromLogs(loan, state.collectionLogs);
        const currentBalance = loan.totalAmount - totalPaid;
        const overdueDays = getDaysOverdue(loan, state.settings);

        const msg = await generateNoPaymentAIReminder(
          loan,
          state.clients.find(c => c.id === loan.clientId)!,
          overdueDays,
          state.settings,
          currentBalance
        );
        const cleanMsg = convertReceiptForWhatsApp(msg);
        window.open(`https://wa.me/${state.clients.find(c => c.id === loan.clientId)?.phone.replace(/\D/g, '')}?text=${encodeURIComponent(cleanMsg)}`, '_blank');
        resetUI();
      }
    } catch (e) {
      console.error(e);
      resetUI();
    } finally {
      setIsProcessingPayment(false);
    }
  };

  const handleReprintLastReceipt = async (loanId: string) => {
    const loan = (Array.isArray(state.loans) ? state.loans : []).find(l => l.id === loanId);
    if (!loan) return;

    const client = (Array.isArray(state.clients) ? state.clients : []).find(c => c.id === loan.clientId);
    if (!client) return;

    // 1. Encontrar el ÚLTIMO pago registrado para este crédito (SIN importar la fecha)
    const allPaymentLogs = (Array.isArray(state.collectionLogs) ? state.collectionLogs : [])
      .filter(l => l.loanId === loan.id && l.type === CollectionLogType.PAYMENT && !l.isOpening && !l.deletedAt);

    // Ordenar por fecha descendente para obtener el más reciente
    const lastPaymentLog = [...(Array.isArray(allPaymentLogs) ? allPaymentLogs : [])].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];

    if (!lastPaymentLog) {
      alert("No hay pagos registrados para este crédito.");
      return;
    }

    // 2. Recalcular el estado HISTÓRICO
    const historicLogs = (Array.isArray(state.collectionLogs) ? state.collectionLogs : []).filter(l =>
      l.loanId === loan.id &&
      l.type === CollectionLogType.PAYMENT &&
      !l.isOpening &&
      !l.deletedAt &&
      new Date(l.date).getTime() <= new Date(lastPaymentLog.date).getTime()
    );

    const totalPaidAtThatMoment = historicLogs.reduce((acc, log) => acc + (log.amount || 0), 0);
    const amountPaidInLastLog = lastPaymentLog.amount || 0;

    const installments = Array.isArray(loan.installments) ? loan.installments : [];
    const lastDueDate = installments.length > 0 ? installments[installments.length - 1].dueDate : loan.createdAt;

    const progress = totalPaidAtThatMoment / (loan.installmentValue || 1);
    const paidInstCount = progress % 1 === 0 ? progress : Math.floor(progress * 10) / 10;

    const settingsToUse = lastPaymentLog.companySnapshot || state.settings;

    const receiptData: ReceiptData = {
      clientName: client.name,
      amountPaid: amountPaidInLastLog,
      previousBalance: Math.max(0, loan.totalAmount - (totalPaidAtThatMoment - amountPaidInLastLog)),
      loanId: loan.id,
      startDate: loan.createdAt,
      expiryDate: lastDueDate,
      daysOverdue: getDaysOverdue(loan, settingsToUse, totalPaidAtThatMoment),
      remainingBalance: Math.max(0, loan.totalAmount - totalPaidAtThatMoment),
      paidInstallments: paidInstCount,
      totalInstallments: loan.totalInstallments,
      isRenewal: lastPaymentLog.isRenewal,
      isVirtual: lastPaymentLog.isVirtual,
      installmentValue: loan.installmentValue,
      totalPaidAmount: totalPaidAtThatMoment,
      principal: loan.totalAmount,

      companyNameManual: settingsToUse.companyName || null,
      companyAliasManual: settingsToUse.companyAlias || null,
      contactLabelManual: "TEL. PUBLICO",
      contactPhoneManual: settingsToUse.contactPhone || null,
      companyIdentifierLabelManual: "ID EMPRESA",
      companyIdentifierManual: settingsToUse.companyIdentifier || null,
      shareLabelManual: settingsToUse.shareLabel || null,
      shareValueManual: settingsToUse.shareValue || null,
      supportLabelManual: "NUMERO CO",
      supportPhoneManual: settingsToUse.technicalSupportPhone || null,
      fullDateTimeManual: new Date(lastPaymentLog.date).toLocaleString()
    };

    // Direct register and UI flow
    const finalReceipt = generateReceiptText(receiptData, settingsToUse);
    setReceipt(finalReceipt);

    // Silent print
    const { printText } = await import('../services/bluetoothPrinterService');
    printText(finalReceipt).catch(() => { });

    // WhatsApp
    if (client) {
      const phone = client.phone.replace(/\D/g, '');
      window.open(`https://wa.me/${phone.length === 10 ? '57' + phone : phone}?text=${encodeURIComponent(finalReceipt)}`, '_blank');
    }
  };

  return (
    <div className="space-y-4 md:space-y-6 pb-20 animate-fadeIn px-1">
      {/* SELECTOR DE OPCIONES DE COBRO */}
      <div className="bg-white p-2 rounded-2xl md:rounded-[2rem] border border-slate-100 shadow-sm flex items-center gap-1 overflow-x-auto">
        <button
          onClick={() => setViewMode('gestion')}
          className={`flex-1 py-3 md:py-4 rounded-xl md:rounded-2xl font-black text-[10px] md:text-xs uppercase tracking-widest transition-all flex items-center justify-center gap-2 min-w-[100px] ${viewMode === 'gestion' ? 'bg-emerald-600 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-50'}`}
        >
          <i className="fa-solid fa-hand-holding-dollar"></i>
          GESTIÓN
        </button>
        <button
          onClick={() => setViewMode('renovaciones')}
          className={`flex-1 py-3 md:py-4 rounded-xl md:rounded-2xl font-black text-[10px] md:text-xs uppercase tracking-widest transition-all flex items-center justify-center gap-2 min-w-[100px] ${viewMode === 'renovaciones' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-50'}`}
        >
          <i className="fa-solid fa-rotate"></i>
          RENOVADOS
        </button>
        <button
          onClick={() => setViewMode('vencidos')}
          className={`flex-1 py-3 md:py-4 rounded-xl md:rounded-2xl font-black text-[10px] md:text-xs uppercase tracking-widest transition-all flex items-center justify-center gap-2 min-w-[100px] ${viewMode === 'vencidos' ? 'bg-red-600 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-50'}`}
        >
          <i className="fa-solid fa-calendar-xmark"></i>
          VENCIDOS
        </button>
        <button
          onClick={() => setViewMode('ocultos')}
          className={`flex-1 py-3 md:py-4 rounded-xl md:rounded-2xl font-black text-[10px] md:text-xs uppercase tracking-widest transition-all flex items-center justify-center gap-2 min-w-[100px] ${viewMode === 'ocultos' ? 'bg-slate-800 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-50'}`}
        >
          <i className="fa-solid fa-eye-slash"></i>
          OCULTOS
        </button>
      </div>

      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-4 md:p-6 rounded-2xl md:rounded-[2.5rem] border border-slate-100 shadow-sm">
        <div className="w-full md:w-auto text-center md:text-left">
          <h2 className="text-xl md:text-2xl font-black text-slate-900 uppercase tracking-tighter flex items-center justify-center md:justify-start gap-3">
            <i className={`fa-solid ${viewMode === 'gestion' ? 'fa-money-bill-wave text-blue-600' : viewMode === 'renovaciones' ? 'fa-rotate text-emerald-600' : viewMode === 'vencidos' ? 'fa-triangle-exclamation text-red-600' : 'fa-eye-slash text-slate-900'}`}></i>
            {viewMode === 'gestion' ? t.loans.title : viewMode === 'renovaciones' ? 'Renovaciones' : viewMode === 'vencidos' ? 'Cartera Vencida' : 'Clientes Ocultos'}
          </h2>
          <p className="text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">
            {viewMode === 'gestion' ? t.loans.subtitle : viewMode === 'renovaciones' ? 'Créditos renovados activos' : viewMode === 'vencidos' ? 'Créditos con pagos atrasados' : 'Base de datos de clientes archivados'}
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto items-center">
          {viewMode === 'vencidos' && filteredLoans.length > 0 && (
            <button
              onClick={handlePrintOverdueReport}
              className="w-full sm:w-auto bg-slate-900 text-white px-6 py-3.5 rounded-xl font-black text-[10px] uppercase tracking-widest shadow-xl active:scale-95 transition-all flex items-center justify-center gap-2"
            >
              <i className="fa-solid fa-print"></i>
              IMPRIMIR
            </button>
          )}
          <div className="relative w-full md:w-80">
            <input
              type="text"
              placeholder="Buscar..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl md:rounded-2xl py-3 md:py-4 pl-10 md:pl-12 pr-4 text-xs md:sm font-black text-slate-800 outline-none focus:ring-2 focus:ring-blue-500 shadow-inner"
            />
            <i className="fa-solid fa-search absolute left-4 top-1/2 -translate-y-1/2 text-slate-300"></i>
          </div>
        </div>
      </div>

      {(viewMode === 'gestion' || viewMode === 'renovaciones') && (
        <>
          <div className="grid grid-cols-1 gap-4 md:gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {paginatedLoans.length === 0 ? (
              <div className="col-span-full py-16 md:py-20 bg-white rounded-2xl md:rounded-[2.5rem] border-2 border-dashed border-slate-100 flex flex-col items-center justify-center text-slate-400 text-center px-4">
                <i className="fa-solid fa-folder-open text-4xl md:text-5xl mb-4 opacity-10"></i>
                <p className="text-[10px] md:text-xs font-black uppercase tracking-widest">
                  {viewMode === 'renovaciones' ? 'Sin renovaciones activas encontradas' : 'Sin cobros pendientes encontrados'}
                </p>
              </div>
            ) : (
              (Array.isArray(paginatedLoans) ? paginatedLoans : []).map((loan) => {
                const client = (Array.isArray(state.clients) ? state.clients : []).find(c => c.id === loan.clientId);
                // Usar logs para balance (consistente con getClientMetrics)
                const cardLoanLogs = (Array.isArray(state.collectionLogs) ? state.collectionLogs : [])
                  .filter(l => l.loanId === loan.id && l.type === CollectionLogType.PAYMENT && !l.isOpening && !l.deletedAt);
                const totalPaid = cardLoanLogs.reduce((acc: number, l: any) => acc + (l.amount || 0), 0);
                const balance = Math.max(0, loan.totalAmount - totalPaid);
                const progress = Math.min(100, (totalPaid / loan.totalAmount) * 100);
                const daysOverdue = getDaysOverdue(loan, state.settings, totalPaid);
                // Último pago para poder borrarlo
                const lastPayLog = [...cardLoanLogs].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];

                return (
                  <div key={loan.id} className="bg-white rounded-2xl md:rounded-[2.5rem] border border-slate-100 shadow-sm hover:shadow-xl transition-all group overflow-hidden flex flex-col">
                    <div className="p-4 md:p-6 space-y-3 md:space-y-4 flex-1">
                      <div className="flex justify-between items-start">
                        <div className="w-10 h-10 md:w-12 md:h-12 bg-slate-50 text-slate-400 rounded-xl md:rounded-2xl flex items-center justify-center text-lg md:text-xl font-black shadow-inner group-hover:bg-blue-600 group-hover:text-white transition-all uppercase">
                          {client?.name.charAt(0)}
                        </div>
                        <div className="text-right">
                          <span className={`px-2 py-0.5 md:px-3 md:py-1 rounded-md md:rounded-lg text-[7px] md:text-[8px] font-black uppercase border ${daysOverdue > 0 ? 'bg-red-50 text-red-600 border-red-100 animate-pulse' : 'bg-emerald-50 text-emerald-700 border-emerald-100'}`}>
                            {daysOverdue > 0 ? `${daysOverdue} d mora` : 'Al Día'}
                          </span>
                        </div>
                      </div>

                      <div className="min-w-0">
                        <h4 className="font-black text-slate-800 text-base md:text-lg uppercase tracking-tight truncate">{client?.name}</h4>
                        <p className="text-[8px] md:text-[9px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1 truncate">
                          <i className="fa-solid fa-location-dot"></i> {client?.address}
                        </p>
                      </div>

                      <div className="bg-slate-50 p-3 md:p-4 rounded-xl md:rounded-2xl space-y-2 md:space-y-3 border border-slate-100 shadow-inner">
                        <div className="flex justify-between items-center">
                          <p className="text-[7px] md:text-[8px] font-black text-slate-400 uppercase">Cuota</p>
                          <p className="text-sm md:text-lg font-black text-blue-600 font-mono">{formatCurrency(loan.installmentValue, state.settings)}</p>
                        </div>
                        <div className="flex justify-between items-center pt-1.5 md:pt-2 border-t border-slate-200">
                          <p className="text-[7px] md:text-[8px] font-black text-slate-400 uppercase">Saldo</p>
                          <p className="text-xs md:text-sm font-black text-red-500 font-mono">{formatCurrency(balance, state.settings)}</p>
                        </div>
                      </div>

                      <div className="space-y-1">
                        <div className="flex justify-between text-[7px] md:text-[8px] font-black text-slate-400 uppercase tracking-widest">
                          <span>Avance</span>
                          <span>{Math.round(progress)}%</span>
                        </div>
                        <div className="w-full h-1.5 md:h-2 bg-slate-100 rounded-full overflow-hidden shadow-inner">
                          <div className="h-full bg-emerald-500 transition-all duration-1000" style={{ width: `${progress}%` }}></div>
                        </div>
                      </div>
                    </div>

                    <div className="p-3 md:p-4 bg-slate-50 border-t border-slate-100 grid grid-cols-[auto_auto_1fr_1fr] gap-2 md:gap-3">
                      <button
                        onClick={() => handleReprintLastReceipt(loan.id)}
                        className="w-10 md:w-12 rounded-lg md:rounded-xl bg-slate-200 text-slate-500 hover:bg-slate-800 hover:text-white transition-all flex items-center justify-center shadow-sm active:scale-95"
                        title="Reimprimir Último Pago"
                      >
                        <i className="fa-solid fa-print text-sm"></i>
                      </button>
                      {isAdminOrManager && lastPayLog && (
                        <button
                          onClick={() => { if (confirm('¿BORRAR ÚLTIMO PAGO? Se revertirá el saldo.')) deleteCollectionLog?.(lastPayLog.id); }}
                          className="w-10 md:w-12 rounded-lg md:rounded-xl bg-red-100 text-red-500 hover:bg-red-600 hover:text-white transition-all flex items-center justify-center shadow-sm active:scale-95"
                          title="Borrar Último Pago"
                        >
                          <i className="fa-solid fa-trash-can text-sm"></i>
                        </button>
                      )}
                      <button
                        onClick={() => handleQuickAction(loan.id, CollectionLogType.NO_PAGO)}
                        className="py-2.5 md:py-3 bg-white border border-slate-200 rounded-lg md:rounded-xl font-black text-[8px] md:text-[9px] text-red-500 uppercase tracking-widest hover:bg-red-50 transition-all active:scale-95"
                      >
                        No Pago
                      </button>
                      <button
                        onClick={() => handleOpenPayment(loan)}
                        className="py-2.5 md:py-3 bg-emerald-600 text-white rounded-lg md:rounded-xl font-black text-[8px] md:text-[9px] uppercase tracking-widest shadow-lg shadow-emerald-500/20 hover:bg-emerald-700 transition-all active:scale-95"
                      >
                        Pagar
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* CONTROLES DE PAGINACIÓN */}
          {filteredLoans.length > ITEMS_PER_PAGE && (
            <div className="flex justify-between items-center pt-4 pb-20 px-2">
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-6 py-3 bg-white border border-slate-200 rounded-xl font-black text-[10px] uppercase shadow-sm disabled:opacity-50"
              >
                Anterior
              </button>
              <span className="text-[10px] font-black text-slate-400">
                Página {currentPage} de {totalPages}
              </span>
              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="px-6 py-3 bg-white border border-slate-200 rounded-xl font-black text-[10px] uppercase shadow-sm disabled:opacity-50"
              >
                Siguiente
              </button>
            </div>
          )}
        </>
      )}

      {viewMode === 'vencidos' && (
        <div className="bg-white rounded-[2rem] border border-slate-200 shadow-xl overflow-hidden flex flex-col">
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-left border-collapse min-w-[900px]">
              <thead>
                <tr className="bg-slate-900 text-white text-[9px] font-black uppercase tracking-widest">
                  <th className="px-6 py-5 border-r border-white/10">Cliente / ID</th>
                  <th className="px-6 py-5 border-r border-white/10">Contacto</th>
                  <th className="px-6 py-5 border-r border-white/10">Ubicación</th>
                  <th className="px-6 py-5 border-r border-white/10 text-center">Días Mora</th>
                  <th className="px-6 py-5 border-r border-white/10 text-right">Valor Cuota</th>
                  <th className="px-6 py-5 border-r border-white/10 text-right">Saldo Pend.</th>
                  <th className="px-6 py-5 text-center">Gestión</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {(paginatedLoans || []).length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-24 text-center text-slate-300 font-black uppercase tracking-[0.3em]">No hay créditos en mora actualmente en esta página</td>
                  </tr>
                ) : (
                  (Array.isArray(paginatedLoans) ? paginatedLoans : []).map((loan) => {
                    const amountToPay = loan.installmentValue || 0;
                    const client = (Array.isArray(state.clients) ? state.clients : []).find(c => c.id === loan.clientId);
                    const totalPaid = calculateTotalPaidFromLogs(loan, state.collectionLogs);
                    const mora = getDaysOverdue(loan, state.settings, totalPaid);
                    const balance = loan.totalAmount - totalPaid;

                    return (
                      <tr key={loan.id} className="hover:bg-red-50/30 transition-colors text-[11px] font-bold text-slate-700">
                        <td className="px-6 py-4 border-r border-slate-100">
                          <p className="text-slate-900 font-black uppercase truncate max-w-[200px]">{client?.name}</p>
                          <p className="text-[8px] text-slate-400 font-black tracking-widest">{client?.documentId}</p>
                        </td>
                        <td className="px-6 py-4 border-r border-slate-100 uppercase text-blue-600 font-black">{client?.phone}</td>
                        <td className="px-6 py-4 border-r border-slate-100 uppercase truncate max-w-[200px] text-slate-400">{client?.address}</td>
                        <td className="px-6 py-4 border-r border-slate-100 text-center">
                          <span className="inline-flex items-center justify-center w-10 h-10 bg-red-100 text-red-600 rounded-xl font-black shadow-inner">
                            {mora}
                          </span>
                        </td>
                        <td className="px-6 py-4 border-r border-slate-100 text-right font-mono font-black text-slate-900">{formatCurrency(loan.installmentValue, state.settings)}</td>
                        <td className="px-6 py-4 border-r border-slate-100 text-right font-mono font-black text-red-600">{formatCurrency(balance, state.settings)}</td>
                        <td className="px-6 py-4 text-center">
                          <button
                            onClick={() => handleOpenPayment(loan)}
                            className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-100 hover:bg-emerald-600 hover:text-white transition-all active:scale-90 flex items-center justify-center mx-auto shadow-sm"
                          >
                            <i className="fa-solid fa-dollar-sign"></i>
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* CONTROLES DE PAGINACIÓN VENCIDOS */}
          {filteredLoans.length > ITEMS_PER_PAGE && (
            <div className="flex justify-between items-center p-4 bg-slate-50 border-t border-slate-200">
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-6 py-3 bg-white border border-slate-200 rounded-xl font-black text-[10px] uppercase shadow-sm disabled:opacity-50"
              >
                Anterior
              </button>
              <span className="text-[10px] font-black text-slate-400">
                Página {currentPage} de {totalPages}
              </span>
              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="px-6 py-3 bg-white border border-slate-200 rounded-xl font-black text-[10px] uppercase shadow-sm disabled:opacity-50"
              >
                Siguiente
              </button>
            </div>
          )}
        </div>
      )}

      {/* NUEVA VISTA: CLIENTES OCULTOS (EXCEL) */}
      {viewMode === 'ocultos' && (
        <div className="bg-white rounded-[2rem] border border-slate-200 shadow-xl overflow-hidden flex flex-col">
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-left border-collapse min-w-[800px]">
              <thead>
                <tr className="bg-slate-800 text-white text-[9px] font-black uppercase tracking-widest">
                  <th className="px-6 py-5 border-r border-white/10">Fecha Registro</th>
                  <th className="px-6 py-5 border-r border-white/10">Cliente / ID</th>
                  <th className="px-6 py-5 border-r border-white/10">Teléfono</th>
                  <th className="px-6 py-5 border-r border-white/10 text-right">Saldo Archivador</th>
                  <th className="px-6 py-5 text-center">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-bold text-[11px]">
                {(hiddenClientsData || []).length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-24 text-center text-slate-300 font-black uppercase tracking-[0.3em]">No hay clientes ocultos actualmente</td>
                  </tr>
                ) : (
                  (Array.isArray(hiddenClientsData) ? hiddenClientsData : []).map(client => (
                    <tr key={client.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4 uppercase text-slate-500 border-r border-slate-100">{client.createdAt ? new Date(client.createdAt).toLocaleDateString() : '---'}</td>
                      <td className="px-6 py-4 uppercase text-slate-900 border-r border-slate-100">{client.name}<br /><span className="text-[8px] text-slate-400">ID: {client.documentId}</span></td>
                      <td className="px-6 py-4 text-blue-600 border-r border-slate-100">{client.phone}</td>
                      <td className="px-6 py-4 text-right font-mono text-slate-600 border-r border-slate-100">{formatCurrency(client.balance, state.settings)}</td>
                      <td className="px-6 py-4 text-center">
                        {isAdminOrManager && (
                          <button
                            onClick={() => handleRestoreClient(client)}
                            className="px-4 py-2 bg-emerald-500 text-white rounded-lg font-black text-[9px] uppercase tracking-widest active:scale-90 transition-all shadow-md flex items-center justify-center mx-auto gap-2"
                          >
                            <i className="fa-solid fa-eye"></i> RESTAURAR
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <div className="p-4 bg-slate-900 text-white flex justify-between items-center text-[10px] font-black uppercase tracking-widest">
            <span>Registros en Archivo: {hiddenClientsData.length}</span>
            <span className="text-slate-500">Auditoría de Clientes Ocultos</span>
          </div>
        </div>
      )}

      {/* MODALES DE PAGO OMITIDOS POR BREVEDAD */}
      {showPaymentInput && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md flex items-center justify-center z-[150] p-2 overflow-y-auto">
          <div className="bg-white rounded-[2rem] shadow-2xl w-full max-sm overflow-hidden animate-scaleIn border border-white/20">
            <div className="p-5 md:p-6 bg-slate-900 text-white flex justify-between items-center sticky top-0 z-10">
              <div><h3 className="text-base md:text-lg font-black uppercase tracking-tighter">Registrar Abono</h3></div>
              <button onClick={resetUI} className="w-8 h-8 bg-white/10 text-white rounded-lg flex items-center justify-center hover:bg-red-600 transition-all"><i className="fa-solid fa-xmark text-lg"></i></button>
            </div>
            <div className="p-5 md:p-6 space-y-4 md:space-y-6">
              <div className="grid grid-cols-3 gap-2">
                <button onClick={() => setMethod('cash')} className={`py-2 rounded-lg text-[8px] font-black uppercase border transition-all ${!isVirtualPayment && !isRenewalPayment ? 'bg-slate-900 text-white shadow-md' : 'bg-slate-50 text-slate-400 active:bg-slate-100'}`}>Efectivo</button>
                <button onClick={() => setMethod('virtual')} className={`py-2 rounded-lg text-[8px] font-black uppercase border transition-all ${isVirtualPayment ? 'bg-blue-600 text-white shadow-md' : 'bg-slate-50 text-slate-400 active:bg-slate-100'}`}>Transf.</button>
                <button onClick={() => setMethod('renewal')} className={`py-2 rounded-lg text-[8px] font-black uppercase border transition-all ${isRenewalPayment ? 'bg-amber-600 text-white shadow-md' : 'bg-slate-50 text-slate-400 active:bg-slate-100'}`}>Renovar</button>
              </div>
              <div className="relative">
                <span className="absolute left-5 top-1/2 -translate-y-1/2 text-2xl font-black text-slate-300">$</span>
                <input type="number" autoFocus value={paymentAmount} onChange={(e) => setPaymentAmount(Number(e.target.value))} className="w-full pl-12 pr-5 py-8 md:py-10 bg-slate-50 border border-slate-200 rounded-2xl md:rounded-[2.5rem] text-3xl md:text-5xl font-black text-center text-slate-900 outline-none focus:ring-4 focus:ring-emerald-500/20 shadow-inner" />
              </div>
              <button onClick={() => selectedLoanId && handleQuickAction(selectedLoanId, CollectionLogType.PAYMENT, paymentAmount, isVirtualPayment, isRenewalPayment)} disabled={isProcessingPayment} className="w-full py-4 md:py-5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl md:rounded-[2rem] font-black uppercase text-xs md:text-sm tracking-widest shadow-2xl active:scale-95 transition-all disabled:opacity-50">{isProcessingPayment ? <i className="fa-solid fa-circle-notch animate-spin mr-2"></i> : 'Confirmar Cobro'}</button>
            </div>
          </div>
        </div>
      )}

      {editingReceipt && (
        <div className="fixed inset-0 bg-slate-900/90 backdrop-blur-md flex items-center justify-center z-[170] p-4 overflow-y-auto">
          <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-lg overflow-hidden animate-scaleIn border border-white/20">
            <div className="p-5 bg-slate-900 text-white flex justify-between items-center sticky top-0 z-10">
              <div>
                <h3 className="text-base font-black uppercase tracking-tighter leading-none">Editor de Recibo</h3>
                <p className="text-[10px] font-bold opacity-70 uppercase tracking-widest mt-1">Verifique y edite los datos</p>
              </div>
              <button onClick={resetUI} className="w-8 h-8 bg-white/10 text-white rounded-lg flex items-center justify-center hover:bg-red-600 transition-all">
                <i className="fa-solid fa-xmark text-lg"></i>
              </button>
            </div>

            <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto bg-slate-50 custom-scrollbar pb-24">
              {/* SECCIÓN EMPRESA */}
              <div className="space-y-4">
                <h4 className="text-[10px] font-black text-blue-600 uppercase tracking-widest border-b border-blue-100 pb-2 flex justify-between">
                  <span>Datos de Empresa</span>
                  <span className="text-[8px] opacity-70">Puedes editar etiquetas y valores</span>
                </h4>
                <div className="grid grid-cols-1 gap-4">
                  <div className="space-y-1">
                    <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest ml-1">Nombre Empresa</label>
                    <input
                      type="text"
                      value={editingReceipt.companyNameManual ?? state.settings.companyName ?? ''}
                      onChange={(e) => setEditingReceipt({ ...editingReceipt, companyNameManual: e.target.value })}
                      className="w-full px-3 py-3 bg-white border border-slate-200 rounded-xl text-xs font-black text-slate-800 outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest ml-1">Etiqueta 1 (Ej: MARCA)</label>
                      <input
                        type="text"
                        disabled
                        value="MARCA:"
                        className="w-full px-3 py-2 bg-slate-100 border border-slate-200 rounded-xl text-[10px] font-black text-slate-500 cursor-not-allowed"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest ml-1">Valor Marca</label>
                      <input
                        type="text"
                        value={editingReceipt.companyAliasManual ?? state.settings.companyAlias ?? ''}
                        onChange={(e) => setEditingReceipt({ ...editingReceipt, companyAliasManual: e.target.value })}
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-[11px] font-black text-slate-800 outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest ml-1">Etiqueta 2 (Ej: TEL. PUBLICO)</label>
                      <input
                        type="text"
                        value={editingReceipt.contactLabelManual ?? "TEL. PUBLICO"}
                        onChange={(e) => setEditingReceipt({ ...editingReceipt, contactLabelManual: e.target.value })}
                        className="w-full px-3 py-2 bg-white border border-blue-200 rounded-xl text-[10px] font-black text-blue-700 outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest ml-1">Valor Teléfono/Letras</label>
                      <input
                        type="text"
                        value={editingReceipt.contactPhoneManual ?? state.settings.contactPhone ?? ''}
                        onChange={(e) => setEditingReceipt({ ...editingReceipt, contactPhoneManual: e.target.value })}
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-[11px] font-black text-slate-800 outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest ml-1">Etiqueta 3 (Ej: ID EMPRESA)</label>
                      <input
                        type="text"
                        value={editingReceipt.companyIdentifierLabelManual ?? "ID EMPRESA"}
                        onChange={(e) => setEditingReceipt({ ...editingReceipt, companyIdentifierLabelManual: e.target.value })}
                        className="w-full px-3 py-2 bg-white border border-blue-200 rounded-xl text-[10px] font-black text-blue-700 outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest ml-1">Valor ID</label>
                      <input
                        type="text"
                        value={editingReceipt.companyIdentifierManual ?? state.settings.companyIdentifier ?? ''}
                        onChange={(e) => setEditingReceipt({ ...editingReceipt, companyIdentifierManual: e.target.value })}
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-[11px] font-black text-slate-800 outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest ml-1">Etiqueta Banco</label>
                      <input
                        type="text"
                        value={editingReceipt.shareLabelManual ?? state.settings.shareLabel ?? 'BANCO'}
                        onChange={(e) => setEditingReceipt({ ...editingReceipt, shareLabelManual: e.target.value })}
                        className="w-full px-3 py-2 bg-white border border-blue-200 rounded-xl text-[10px] font-black text-blue-700 outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest ml-1">Cuenta/Alias</label>
                      <input
                        type="text"
                        value={editingReceipt.shareValueManual ?? state.settings.shareValue ?? ''}
                        onChange={(e) => setEditingReceipt({ ...editingReceipt, shareValueManual: e.target.value })}
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-[11px] font-black text-slate-800 outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest ml-1">Etiqueta 5 (Ej: NUMERO CO)</label>
                      <input
                        type="text"
                        value={editingReceipt.supportLabelManual ?? "NUMERO CO"}
                        onChange={(e) => setEditingReceipt({ ...editingReceipt, supportLabelManual: e.target.value })}
                        className="w-full px-3 py-2 bg-white border border-blue-200 rounded-xl text-[10px] font-black text-blue-700 outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest ml-1">Valor 5</label>
                      <input
                        type="text"
                        value={editingReceipt.supportPhoneManual ?? state.settings.technicalSupportPhone ?? ''}
                        onChange={(e) => setEditingReceipt({ ...editingReceipt, supportPhoneManual: e.target.value })}
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-[11px] font-black text-slate-800 outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* SECCIÓN CLIENTE Y FECHAS */}
              <div className="space-y-4">
                <h4 className="text-[10px] font-black text-emerald-600 uppercase tracking-widest border-b border-emerald-100 pb-2">Datos del Cliente e Importes</h4>
                <div className="grid grid-cols-1 gap-3">
                  <div className="space-y-1">
                    <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest ml-1">Nombre del Cliente</label>
                    <input
                      type="text"
                      value={editingReceipt.clientName}
                      onChange={(e) => setEditingReceipt({ ...editingReceipt, clientName: e.target.value })}
                      className="w-full px-3 py-3 bg-white border border-slate-200 rounded-xl text-xs font-black text-slate-800 outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest ml-1">Fecha / Hora Recibo</label>
                      <input
                        type="text"
                        value={editingReceipt.fullDateTimeManual ?? ''}
                        placeholder="Automático (Ahora)"
                        onChange={(e) => setEditingReceipt({ ...editingReceipt, fullDateTimeManual: e.target.value })}
                        className="w-full px-3 py-2 bg-white border border-emerald-200 rounded-xl text-[10px] font-black text-emerald-700 outline-none focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest ml-1">Días de Atraso</label>
                      <input
                        type="number"
                        value={editingReceipt.daysOverdue}
                        onChange={(e) => setEditingReceipt({ ...editingReceipt, daysOverdue: Number(e.target.value) })}
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-[11px] font-black text-slate-800 outline-none focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest ml-1">Inicio Préstamo</label>
                      <input
                        type="text"
                        value={editingReceipt.startDate}
                        onChange={(e) => setEditingReceipt({ ...editingReceipt, startDate: e.target.value })}
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-[10px] font-black text-slate-700 outline-none focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest ml-1">Vencimiento</label>
                      <input
                        type="text"
                        value={editingReceipt.expiryDate}
                        onChange={(e) => setEditingReceipt({ ...editingReceipt, expiryDate: e.target.value })}
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-[10px] font-black text-slate-700 outline-none focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div className="space-y-1">
                    <label className="text-[7px] font-black text-slate-400 uppercase tracking-widest ml-1">Saldo Ant.</label>
                    <input
                      type="number"
                      value={editingReceipt.previousBalance}
                      onChange={(e) => setEditingReceipt({ ...editingReceipt, previousBalance: Number(e.target.value) })}
                      className="w-full px-2 py-2 bg-white border border-slate-200 rounded-lg text-[10px] font-black text-slate-800 outline-none"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[7px] font-black text-slate-400 uppercase tracking-widest ml-1">Abono</label>
                    <input
                      type="number"
                      value={editingReceipt.amountPaid}
                      onChange={(e) => setEditingReceipt({ ...editingReceipt, amountPaid: Number(e.target.value) })}
                      className="w-full px-2 py-2 bg-white border border-emerald-300 rounded-lg text-[10px] font-black text-emerald-700 outline-none shadow-sm"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[7px] font-black text-slate-400 uppercase tracking-widest ml-1">Saldo Act.</label>
                    <input
                      type="number"
                      value={editingReceipt.remainingBalance}
                      onChange={(e) => setEditingReceipt({ ...editingReceipt, remainingBalance: Number(e.target.value) })}
                      className="w-full px-2 py-2 bg-white border border-red-300 rounded-lg text-[10px] font-black text-red-700 outline-none shadow-sm"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest ml-1">Cuotas Pagadas</label>
                    <input
                      type="number"
                      value={editingReceipt.paidInstallments}
                      onChange={(e) => setEditingReceipt({ ...editingReceipt, paidInstallments: Number(e.target.value) })}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-[11px] font-black text-slate-800 text-center"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest ml-1">Total Cuotas</label>
                    <input
                      type="number"
                      value={editingReceipt.totalInstallments}
                      onChange={(e) => setEditingReceipt({ ...editingReceipt, totalInstallments: Number(e.target.value) })}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-[11px] font-black text-slate-800 text-center"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="p-5 bg-white border-t border-slate-100 flex gap-3 sticky bottom-0">
              <button
                onClick={async () => {
                  if (!editingReceipt) return;
                  const finalReceipt = generateReceiptText(editingReceipt, state.settings);
                  setReceipt(finalReceipt);
                  setEditingReceipt(null); // This line removes the editor UI by setting editingReceipt to null

                  // Silent print
                  const { printText } = await import('../services/bluetoothPrinterService');
                  printText(finalReceipt).catch(() => { });

                  // WhatsApp
                  const client = (Array.isArray(state.clients) ? state.clients : []).find(c => c.name === editingReceipt.clientName);
                  if (client) {
                    const phone = client.phone.replace(/\D/g, '');
                    window.open(`https://wa.me/${phone.length === 10 ? '57' + phone : phone}?text=${encodeURIComponent(finalReceipt)}`, '_blank');
                  }
                }}
                className="flex-1 py-4 bg-emerald-600 text-white rounded-xl font-black uppercase text-xs tracking-widest shadow-xl active:scale-95 transition-all flex items-center justify-center gap-2"
              >
                <i className="fa-solid fa-paper-plane"></i> FINALIZAR Y ENVIAR
              </button>
            </div>
          </div>
        </div>
      )}

      {receipt && (
        <div className="fixed inset-0 bg-slate-900/95 backdrop-blur-xl flex items-center justify-center z-[160] p-4 overflow-y-auto">
          <div className="bg-white rounded-[2rem] text-center max-w-sm w-full animate-scaleIn shadow-2xl overflow-hidden">
            {/* Header de navegación en el ticket */}
            <div className="flex justify-between items-center px-6 py-4 border-b border-slate-100 italic bg-white sticky top-0">
              <button onClick={resetUI} className="text-slate-400 hover:text-slate-600 transition-all active:scale-90">
                <i className="fa-solid fa-arrow-left text-lg"></i>
              </button>
              <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Vista de Comprobante</span>
              <button onClick={resetUI} className="text-slate-400 hover:text-red-500 transition-all active:scale-90">
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
                <button onClick={resetUI} className="w-full py-4 bg-slate-900 text-white rounded-xl font-black uppercase text-[10px] tracking-widest shadow-2xl active:scale-95 transition-all">
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
  );
};

export default Loans;
