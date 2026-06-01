
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { AppState, Loan, LoanStatus, Role, PaymentStatus, CollectionLog, CollectionLogType, Client, Frequency } from '../types';
import { formatCurrency, generateReceiptText, getDaysOverdue, formatDate, generateUUID, ReceiptData, calculateTotalPaidFromLogs, convertReceiptForWhatsApp } from '../utils/helpers';
import { getTranslation } from '../utils/translations';
import { generateAIStatement, generateNoPaymentAIReminder } from '../services/geminiService';
import { Geolocation } from '@capacitor/geolocation';
import html2canvas from 'html2canvas';
import { Share } from '@capacitor/share';
import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { supabase } from '../utils/supabaseClient';

interface LoansProps {
  state: AppState;
  addLoan: (loan: Loan) => void;
  updateLoanDates: (loanId: string, newStartDate: string) => void;
  addCollectionAttempt: (log: CollectionLog) => void;
  deleteCollectionLog: (logId: string) => void;
  updateClient?: (client: Client) => void;
  onForceSync?: (silent?: boolean) => Promise<void>;
  setActiveTab: (tab: string) => void;
}

const Loans: React.FC<LoansProps> = ({ state, addCollectionAttempt, deleteCollectionLog, updateClient, onForceSync, setActiveTab }) => {
  const receiptCardRef = useRef<HTMLDivElement>(null);
  const qrChannelRef = useRef<any>(null);
  const [isSharing, setIsSharing] = useState(false);
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
  const [expandedHistory, setExpandedHistory] = useState<Record<string, boolean>>({});

  // --- BANCARD QR INTEGRATION STATES ---
  const [isQrPayment, setIsQrPayment] = useState(false);
  const [qrCodePayload, setQrCodePayload] = useState<string | null>(null);
  const [isWaitingForQrPayment, setIsWaitingForQrPayment] = useState(false);
  const [hasQrConfig, setHasQrConfig] = useState(false);
  const [frequencyFilter, setFrequencyFilter] = useState<'all' | 'Diaria' | Frequency>('all');

  useEffect(() => {
    const checkQrConfig = async () => {
      if (!selectedLoanId || !state.currentUser) return;
      const managerId = state.currentUser.role === Role.COLLECTOR 
        ? state.currentUser.managedBy 
        : state.currentUser.id;
      if (!managerId) {
        setHasQrConfig(false);
        return;
      }
      try {
        const { data } = await supabase
          .from('credenciales_bancard')
          .select('id')
          .eq('gerente_id', managerId)
          .maybeSingle();
        setHasQrConfig(!!data);
      } catch (err) {
        setHasQrConfig(false);
      }
    };
    checkQrConfig();
  }, [selectedLoanId, state.currentUser]);

  // PAGINATION LOGIC
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 20;

  const t = getTranslation(state.settings.language);
  const isAdminOrManager = state.currentUser?.role === Role.ADMIN || state.currentUser?.role === Role.MANAGER;

  // Filtrado de préstamos general - AGRUPADO POR CLIENTE para coincidir con Cartera
  const filteredLoans = useMemo(() => {
    const allLoans = Array.isArray(state.loans) ? state.loans : [];
    const allClients = Array.isArray(state.clients) ? state.clients : [];
    const allLogs = Array.isArray(state.collectionLogs) ? state.collectionLogs : [];

    // 1. Identificar clientes únicos que califiquen para la vista actual
    const clientMap: Record<string, { client: Client, loans: Loan[], isNewClient?: boolean }> = {};

    allClients.forEach(client => {
      if (client.isHidden || client.deletedAt) return;

      const searchLower = searchTerm.toLowerCase();
      const matchesSearch = client.name.toLowerCase().includes(searchLower) ||
        (client.address || '').toLowerCase().includes(searchLower) ||
        (client.documentId || '').includes(searchLower);

      if (!matchesSearch) return;

      const clientLoans = allLoans.filter(l => l.clientId === client.id);
      
      // Lógica de calificación según viewMode
      let qualifies = false;
      let targetLoans = [...clientLoans];

      if (viewMode === 'vencidos') {
        targetLoans = clientLoans.filter(loan => {
          const totalPaid = calculateTotalPaidFromLogs(loan, allLogs);
          return getDaysOverdue(loan, state.settings, totalPaid) > 0;
        });
        qualifies = targetLoans.length > 0;
      } else if (viewMode === 'renovaciones') {
        targetLoans = clientLoans.filter(loan => loan.isRenewal === true && loan.status === LoanStatus.ACTIVE);
        qualifies = targetLoans.length > 0;
      } else if (viewMode === 'gestion') {
        if (clientLoans.length === 0) {
          // CASO NUEVO: Cliente sin créditos
          qualifies = true;
          clientMap[client.id] = { client, loans: [], isNewClient: true };
          return;
        }

        const hasActive = clientLoans.some(l => (l.status === LoanStatus.ACTIVE || l.status === LoanStatus.DEFAULT) && (l.totalAmount - calculateTotalPaidFromLogs(l, allLogs)) > 0.01);
        
        if (hasActive) {
          targetLoans = clientLoans.filter(l => (l.status === LoanStatus.ACTIVE || l.status === LoanStatus.DEFAULT));
          qualifies = true;
        } else {
          // Si está pagado, califica el más reciente de este cliente
          const sorted = [...clientLoans].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
          targetLoans = [sorted[0]];
          qualifies = true;
        }
      } else {
        qualifies = true;
      }

      if (qualifies) {
        clientMap[client.id] = { client, loans: targetLoans };
      }
    });

    // 2. Consolidar préstamos por cliente
    return Object.values(clientMap).map(({ client, loans, isNewClient }) => {
      if (isNewClient || loans.length === 0) {
        // Objeto dummy para cliente nuevo
        return {
          id: `new-client-${client.id}`,
          clientId: client.id,
          principal: 0,
          totalAmount: 0,
          installmentValue: 0,
          totalInstallments: 0,
          status: LoanStatus.PAID,
          createdAt: client.createdAt || new Date().toISOString(),
          installments: [],
          _isNewClient: true,
          _consolidatedPaid: 0,
          _consolidatedBalance: 0,
          _consolidatedPrincipal: 0,
          _consolidatedTotalAmount: 0,
          _consolidatedInstallmentValue: 0,
          _consolidatedMora: 0,
          _clientName: client.name 
        };
      }
      
      // Métricas consolidadas de TODOS los préstamos activos (estilo Cartera)
      const clientLoans = allLoans.filter(l => l.clientId === client.id && (l.status === LoanStatus.ACTIVE || l.status === LoanStatus.DEFAULT));
      
      // Ordenar préstamos activos: Más reciente primero para el "base"
      const sortedLoans = [...clientLoans].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      
      // Si no hay préstamos activos (ej: modo gestion mostrando el último pagado), usamos los que calificaron originalmente
      const displayLoans = sortedLoans.length > 0 ? sortedLoans : (loans || []);
      const baseLoan = displayLoans[0];

      const totalPaid = calculateTotalPaidFromLogs(baseLoan, allLogs);
      const consolidatedBalance = Math.max(0, baseLoan.totalAmount - totalPaid);
      
      const consolidatedPrincipal = baseLoan.principal || 0;
      const consolidatedTotalAmount = baseLoan.totalAmount || 0;
      const consolidatedInstallmentValue = baseLoan.installmentValue || 0;

      const consolidatedMora = getDaysOverdue(baseLoan, state.settings, totalPaid);
      
      return {
        ...baseLoan,
        _consolidatedPaid: totalPaid,
        _consolidatedBalance: consolidatedBalance,
        _consolidatedPrincipal: consolidatedPrincipal,
        _consolidatedTotalAmount: consolidatedTotalAmount,
        _consolidatedInstallmentValue: consolidatedInstallmentValue,
        _consolidatedMora: consolidatedMora,
        _isConsolidated: clientLoans.length > 1,
        _clientName: client.name 
      };
    }).sort((a, b) => {
      if (viewMode === 'vencidos') {
        const moraA = (a as any)._consolidatedMora || 0;
        const moraB = (b as any)._consolidatedMora || 0;
        return moraB - moraA;
      }
      if (viewMode === 'renovaciones') {
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }
      if (viewMode === 'gestion') {
        const aActive = ((a as any)._consolidatedBalance || 0) > 0.01 ? 0 : 1;
        const bActive = ((b as any)._consolidatedBalance || 0) > 0.01 ? 0 : 1;
        if (aActive !== bActive) return aActive - bActive;
        // Dentro del mismo grupo, los de mayor mora primero
        const moraA = (a as any)._consolidatedMora || 0;
        const moraB = (b as any)._consolidatedMora || 0;
        return moraB - moraA;
      }
      return 0;
    });
  }, [state.loans, state.clients, state.collectionLogs, searchTerm, state.currentUser, isAdminOrManager, viewMode, state.settings]);

  // RESET PAGE ON FILTER CHANGE
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, viewMode, frequencyFilter]);

  // FILTRO POR FRECUENCIA
  const frequencyFilteredLoans = useMemo(() => {
    if (frequencyFilter === 'all') return filteredLoans;
    if (frequencyFilter === 'Diaria') {
      return filteredLoans.filter(loan => 
        !(loan as any)._isNewClient && 
        (loan.frequency === Frequency.DAILY || loan.frequency === Frequency.DAILY_MF || loan.frequency === 'Diaria' as any)
      );
    }
    return filteredLoans.filter(loan => (loan as any)._isNewClient ? false : loan.frequency === frequencyFilter);
  }, [filteredLoans, frequencyFilter]);

  // PAGINATED DATA
  const paginatedLoans = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return frequencyFilteredLoans.slice(start, start + ITEMS_PER_PAGE);
  }, [frequencyFilteredLoans, currentPage]);

  const totalPages = Math.ceil(frequencyFilteredLoans.length / ITEMS_PER_PAGE);

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
    if ((window as any).qrPaymentTimerLoans) {
      clearTimeout((window as any).qrPaymentTimerLoans);
    }
    if (qrChannelRef.current) {
      supabase.removeChannel(qrChannelRef.current);
      qrChannelRef.current = null;
    }
    setReceipt(null);
    setEditingReceipt(null);
    setLastLogId(null);
    setShowPaymentInput(false);
    setSelectedLoanId(null);
    setIsProcessingPayment(false);
    setIsVirtualPayment(false);
    setIsRenewalPayment(false);
    setIsQrPayment(false);
    setQrCodePayload(null);
    setIsWaitingForQrPayment(false);
    setPaymentAmount(0);
  };

  const handleOpenPayment = (loan: Loan) => {
    setSelectedLoanId(loan.id);
    setPaymentAmount(loan.installmentValue);
    setIsVirtualPayment(false);
    setIsRenewalPayment(false);
    setIsQrPayment(false);
    setQrCodePayload(null);
    setIsWaitingForQrPayment(false);
    setShowPaymentInput(true);
  };

  const handleOpenMap = (coords?: { lat: number, lng: number }) => {
    if (!coords || (coords.lat === 0 && coords.lng === 0)) {
      alert("Ubicación no registrada para este cliente.");
      return;
    }
    window.open(`https://www.google.com/maps?q=${coords.lat},${coords.lng}`, '_blank');
  };

  const handleDirectWhatsApp = (phone: string) => {
    if (!phone) return alert("Número de teléfono no disponible");
    const cleanPhone = phone.replace(/\D/g, '');
    const countryPrefix = state.settings.country === 'PY' ? '595' : '57';
    const targetPhone = (cleanPhone.length === 10 && countryPrefix === '57') ? countryPrefix + cleanPhone : (cleanPhone.startsWith(countryPrefix) ? cleanPhone : countryPrefix + cleanPhone);
    window.open(`https://wa.me/${targetPhone}`, '_blank');
  };

  const toggleHistory = (loanId: string) => {
    setExpandedHistory(prev => ({
      ...prev,
      [loanId]: !prev[loanId]
    }));
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
      const totalPaid = (loan as any)._consolidatedPaid;
      const mora = (loan as any)._consolidatedMora;
      const balance = (loan as any)._consolidatedBalance;
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

  const setMethod = (method: 'cash' | 'virtual' | 'renewal' | 'qr') => {
    setIsVirtualPayment(method === 'virtual');
    setIsRenewalPayment(method === 'renewal');
    setIsQrPayment(method === 'qr');

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

  const handleGenerateQrLoans = async () => {
    if (!selectedLoanId || !state.currentUser) return;
    const loan = (Array.isArray(state.loans) ? state.loans : []).find(l => l.id === selectedLoanId);
    if (!loan) return;

    setIsProcessingPayment(true);
    setIsWaitingForQrPayment(true);
    
    try {
      const uniqueRef = `bancard_ref_${generateUUID().slice(0,8)}`;

      // 1. Insertar el pago en estado PENDING en la tabla pagos_qr de Supabase
      const { data: pagoQrData, error } = await supabase
        .from('pagos_qr')
        .insert({
          loan_id: loan.id,
          collector_id: state.currentUser.id,
          amount: paymentAmount,
          status: 'PENDING',
          bancard_process_id: uniqueRef
        })
        .select()
        .single();

      if (error) {
        throw new Error(error.message);
      }

      // 2. Generar el código QR de prueba scannable
      setTimeout(() => {
        const mockPayload = `Bancard-QR|Monto:${paymentAmount}|Comercio:${state.settings.companyName || 'Anexo Cobro'}|Ref:${uniqueRef}`;
        setQrCodePayload(`https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(mockPayload)}`);
        setIsProcessingPayment(false);
      }, 1500);

      // 3. Suscribirse en Supabase Realtime a cambios en este pago QR
      if (qrChannelRef.current) {
        supabase.removeChannel(qrChannelRef.current);
      }

      const channel = supabase
        .channel(`pago_qr_loans_${pagoQrData.id}`)
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'pagos_qr',
            filter: `id=eq.${pagoQrData.id}`
          },
          async (payload: any) => {
            console.log("Cambio detectado en tiempo real en Loans:", payload);
            if (payload.new && payload.new.status === 'COMPLETED') {
              // Limpiar la suscripción y el QR
              if (qrChannelRef.current) {
                supabase.removeChannel(qrChannelRef.current);
                qrChannelRef.current = null;
              }
              setIsWaitingForQrPayment(false);
              setQrCodePayload(null);
              
              // Registrar abono real
              await handleQuickAction(
                loan.id,
                CollectionLogType.PAYMENT,
                paymentAmount,
                false,
                false
              );
            }
          }
        )
        .subscribe();

      qrChannelRef.current = channel;

    } catch (err: any) {
      console.error("[QR] Error al generar registro:", err);
      alert("Error al inicializar el pago QR: " + err.message);
      setIsProcessingPayment(false);
      setIsWaitingForQrPayment(false);
    }
  };

  const handleCancelQrLoans = async () => {
    if (qrChannelRef.current) {
      supabase.removeChannel(qrChannelRef.current);
      qrChannelRef.current = null;
    }

    if (selectedLoanId && state.currentUser) {
      try {
        await supabase
          .from('pagos_qr')
          .update({ status: 'CANCELLED' })
          .eq('loan_id', selectedLoanId)
          .eq('status', 'PENDING');
      } catch (err) {
        console.warn("[QR] No se pudo cancelar el registro en DB:", err);
      }
    }

    setIsWaitingForQrPayment(false);
    setQrCodePayload(null);
    setIsProcessingPayment(false);
    setMethod('cash');
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
          window.open(`https://wa.me/${phone.length === 10 ? '57' + phone : phone}?text=${encodeURIComponent("ticket")}`, '_blank');
        }
      } else if (type === CollectionLogType.NO_PAGO) {
        const client = state.clients.find(c => c.id === loan.clientId);
        if (!client) return;
        const totalPaid = calculateTotalPaidFromLogs(loan, state.collectionLogs);
        const currentBalance = Math.max(0, loan.totalAmount - totalPaid);
        const overdueDays = getDaysOverdue(loan, state.settings, totalPaid);

        let msg = '';
        if (client.customNoPayMessage) {
          msg = client.customNoPayMessage
              .replace('{cliente}', client.name)
              .replace('{saldo}', formatCurrency(currentBalance, state.settings))
              .replace('{atraso}', overdueDays.toString());
        } else {
          msg = `Hola ${client.name}, te informamos que hoy no se registró tu pago. Tu saldo pendiente es de ${formatCurrency(currentBalance, state.settings)} y cuentas con ${overdueDays} días de atraso. Por favor, ponte al día para evitar inconvenientes gracias`;
        }
        
        setTimeout(() => {
          const phone = client.phone.replace(/\D/g, '');
          const countryPrefix = state.settings.country === 'PY' ? '595' : '57';
          const targetPhone = (phone.length === 10 && countryPrefix === '57') ? countryPrefix + phone : (phone.startsWith(countryPrefix) ? phone : countryPrefix + phone);
          window.open(`https://wa.me/${targetPhone}?text=${encodeURIComponent(msg)}`, '_blank');
        }, 2000);
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

    // WhatsApp - REMOVED automatic "ticket" word opening to satisfy "only print" request
    /*
    if (client) {
      const phone = client.phone.replace(/\D/g, '');
      const countryPrefix = state.settings.country === 'PY' ? '595' : '57';
      const targetPhone = (phone.length === 10 && countryPrefix === '57') ? countryPrefix + phone : (phone.startsWith(countryPrefix) ? phone : countryPrefix + phone);
      window.open(`https://wa.me/${targetPhone}?text=${encodeURIComponent('ticket')}`, '_blank');
    }
    */

    return true; // Indicar éxito
  };

  const handleShareLastReceiptAsPhoto = async (loanId: string) => {
    const loan = (Array.isArray(state.loans) ? state.loans : []).find(l => l.id === loanId);
    if (!loan) return;

    const client = (Array.isArray(state.clients) ? state.clients : []).find(c => c.id === loan.clientId);
    if (!client) return;

    // 1. Encontrar el ÚLTIMO pago registrado
    const allPaymentLogs = (Array.isArray(state.collectionLogs) ? state.collectionLogs : [])
      .filter(l => l.loanId === loan.id && l.type === CollectionLogType.PAYMENT && !l.isOpening && !l.deletedAt);

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

    const finalReceipt = generateReceiptText(receiptData, settingsToUse);
    setReceipt(finalReceipt);

    // Pequeña espera para que el estado 'receipt' se propague y el ref esté disponible
    setTimeout(() => {
      handleShareReceiptPhoto();
    }, 600);
  };

  const handleShareReceiptPDF = async () => {
    if (!receiptCardRef.current || !receipt || isSharing) return;
    setIsSharing(true);

    try {
      const html2canvas = (await import('html2canvas')).default;
      const { jsPDF } = await import('jspdf');

      // 1. Mostrar temporalmente para captura
      const container = document.getElementById('receipt-container-hidden-loans');
      if (container) {
        container.style.display = 'block';
        container.style.visibility = 'visible';
        container.style.left = '0';
        container.style.opacity = '1';
        container.style.zIndex = '9999';
      }

      await new Promise(r => setTimeout(r, 400));

      const canvas = await html2canvas(receiptCardRef.current, {
        scale: 2,
        useCORS: true,
        logging: false,
        allowTaint: true,
        windowWidth: 400,
        width: 400,
        height: receiptCardRef.current.scrollHeight,
      });

      if (container) {
        container.style.display = 'none';
        container.style.opacity = '0';
        container.style.left = '-5000px';
      }

      if (!canvas) throw new Error("No se pudo crear el lienzo.");

      const fileName = `Recibo_${new Date().getTime()}.pdf`;
      const pdf = new jsPDF('p', 'mm', [80, 200]); // Formato ticket de 80mm
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const imgWidth = pdfWidth;
      const imgHeight = (canvas.height * pdfWidth) / canvas.width;

      pdf.addImage(canvas, 'JPEG', 0, 0, imgWidth, imgHeight);

      const pdfBase64Data = pdf.output('datauristring');
      const pdfBase64 = pdfBase64Data.split(',')[1];

      if (Capacitor.isNativePlatform()) {
        const { Filesystem, Directory } = await import('@capacitor/filesystem');
        const { Share } = await import('@capacitor/share');

        const savedFile = await Filesystem.writeFile({
          path: fileName,
          data: pdfBase64,
          directory: Directory.Cache
        });

        await Share.share({
          title: 'Recibo de Pago',
          text: `Recibo de Pago`,
          url: savedFile.uri,
          dialogTitle: 'Enviar Recibo por WhatsApp'
        });
      } else {
        const blob = await (await fetch(pdfBase64Data)).blob();
        const blobUrl = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = blobUrl;
        link.download = fileName;
        link.click();

        // Manual WhatsApp "ticket"
        const client = (Array.isArray(state.clients) ? state.clients : []).find(c =>
          receipt.includes(c.name.toUpperCase().substring(0, 10))
        );
        const phone = client?.phone.replace(/\D/g, '') || '';
        const countryPrefix = state.settings.country === 'PY' ? '595' : '57';
        const targetPhone = (phone.length === 10 && countryPrefix === '57') ? countryPrefix + phone : (phone.startsWith(countryPrefix) ? phone : countryPrefix + phone);
        window.open(`https://wa.me/${targetPhone}?text=${encodeURIComponent("ticket")}`, '_blank');
      }
    } catch (err) {
      console.error("Error sharing PDF:", err);
      alert("Error al compartir PDF: " + err);
    } finally {
      setIsSharing(false);
    }
  };

  const handleShareReceiptPhoto = async () => {
    if (!receiptCardRef.current || !receipt || isSharing) return;
    setIsSharing(true);

    try {
      // 1. Mostrar temporalmente para captura
      const container = document.getElementById('receipt-container-hidden-loans');
      if (container) {
        container.style.display = 'block';
        container.style.visibility = 'visible';
        container.style.left = '0';
        container.style.opacity = '1';
        container.style.zIndex = '9999';
      }

      await new Promise(r => setTimeout(r, 400));

      const canvas = await html2canvas(receiptCardRef.current, {
        scale: 2,
        useCORS: true,
        logging: false,
        allowTaint: true,
        windowWidth: 400,
        width: 400,
        height: receiptCardRef.current.scrollHeight,
      });

      if (container) {
        container.style.display = 'none';
        container.style.opacity = '0';
        container.style.left = '-5000px';
      }

      const base64Image = canvas.toDataURL('image/jpeg', 0.9);
      const fileName = `Recibo_${new Date().getTime()}.jpg`;

      if (Capacitor.isNativePlatform()) {
        const result = await Filesystem.writeFile({
          path: fileName,
          data: base64Image.split(',')[1],
          directory: Directory.Cache,
        });

        await Share.share({
          title: 'Recibo de Pago',
          text: 'Comprobante de Operación',
          url: result.uri,
          dialogTitle: 'Compartir Recibo',
        });
      } else {
        const link = document.createElement('a');
        link.download = fileName;
        link.href = base64Image;
        link.click();
      }
    } catch (error) {
      console.error('Error al compartir foto:', error);
      alert('Error al generar la imagen del recibo.');
    } finally {
      setIsSharing(false);
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

      {/* FILTROS POR FRECUENCIA - solo en Gestión */}
      {viewMode === 'gestion' && (
        <div className="bg-white p-2 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-1 overflow-x-auto">
          {([
            { key: 'all',              label: 'Todos',          icon: 'fa-layer-group',    active: 'bg-slate-900 text-white shadow-lg',   idle: 'text-slate-400 hover:bg-slate-50' },
            { key: 'Diaria',           label: 'Diarios',        icon: 'fa-sun',            active: 'bg-amber-500 text-white shadow-lg',   idle: 'text-slate-400 hover:bg-amber-50 hover:text-amber-600' },
            { key: Frequency.WEEKLY,    label: 'Semanal',        icon: 'fa-calendar-week',  active: 'bg-violet-600 text-white shadow-lg',  idle: 'text-slate-400 hover:bg-violet-50 hover:text-violet-600' },
            { key: Frequency.BIWEEKLY,  label: 'Quincenal',      icon: 'fa-calendar-days',  active: 'bg-blue-600 text-white shadow-lg',    idle: 'text-slate-400 hover:bg-blue-50 hover:text-blue-600' },
            { key: Frequency.MONTHLY,   label: 'Mensual',        icon: 'fa-calendar',       active: 'bg-slate-600 text-white shadow-lg',   idle: 'text-slate-400 hover:bg-slate-50 hover:text-slate-600' },
          ] as const).map(tab => (
            <button
              key={tab.key}
              onClick={() => setFrequencyFilter(tab.key as any)}
              className={`flex-1 py-2.5 md:py-3 rounded-xl font-black text-[9px] md:text-[10px] uppercase tracking-widest transition-all flex items-center justify-center gap-1.5 min-w-[70px] ${frequencyFilter === tab.key ? tab.active : tab.idle}`}
            >
              <i className={`fa-solid ${tab.icon}`}></i>
              {tab.label}
              {tab.key !== 'all' && (
                <span className={`text-[7px] font-black px-1 py-0.5 rounded-full ${frequencyFilter === tab.key ? 'bg-white/20' : 'bg-slate-100 text-slate-500'}`}>
                  {tab.key === 'Diaria' 
                    ? filteredLoans.filter(l => !(l as any)._isNewClient && (l.frequency === Frequency.DAILY || l.frequency === Frequency.DAILY_MF || l.frequency === 'Diaria' as any)).length
                    : filteredLoans.filter(l => !(l as any)._isNewClient && l.frequency === tab.key).length}
                </span>
              )}
            </button>
          ))}
        </div>
      )}

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
                
                // Usar métricas consolidadas calculadas en filteredLoans
                const totalPaid = (loan as any)._consolidatedPaid;
                const balance = (loan as any)._consolidatedBalance;
                const daysOverdue = (loan as any)._consolidatedMora;
                
                // Recopilar logs de TODOS los préstamos de este cliente (para el historial de la tarjeta)
                const clientLoans = (Array.isArray(state.loans) ? state.loans : []).filter(l => l.clientId === loan.clientId && (l.status === LoanStatus.ACTIVE || l.status === LoanStatus.DEFAULT));
                const cardLoanLogs = (Array.isArray(state.collectionLogs) ? state.collectionLogs : [])
                  .filter(l => clientLoans.some(cl => cl.id === l.loanId) && l.type === CollectionLogType.PAYMENT && !l.isOpening && !l.deletedAt);
                
                const progress = Math.min(100, (totalPaid / loan.totalAmount) * 100);
                const installmentsPaid = Number((totalPaid / loan.installmentValue).toFixed(1));
                
                // Último pago global del cliente
                const lastPayLog = [...cardLoanLogs].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];

                return (
                  <div key={loan.id} className="bg-slate-900 rounded-2xl md:rounded-[2.5rem] border border-slate-800 shadow-xl hover:shadow-2xl transition-all group overflow-hidden flex flex-col">
                    <div className="p-4 md:p-6 space-y-3 md:space-y-4 flex-1">
                      <div className="flex justify-between items-start">
                        <div className="w-10 h-10 md:w-12 md:h-12 bg-slate-800 text-slate-300 rounded-xl md:rounded-2xl flex items-center justify-center text-lg md:text-xl font-black shadow-inner group-hover:bg-blue-600 group-hover:text-white transition-all uppercase border border-slate-700">
                          {client?.name.charAt(0)}
                        </div>
                        <div className="text-right flex flex-col items-end gap-1">
                          <span className={`px-2 py-0.5 md:px-3 md:py-1 rounded-md md:rounded-lg text-[7px] md:text-[8px] font-black uppercase border ${daysOverdue > 0 ? 'bg-red-900/30 text-red-400 border-red-900/50 animate-pulse' : 'bg-emerald-900/30 text-emerald-400 border-emerald-900/50'}`}>
                            {daysOverdue > 0 ? `${daysOverdue} d mora` : 'Al Día'}
                          </span>
                          <button 
                            onClick={() => handleDirectWhatsApp(client?.phone || '')}
                            className="w-8 h-8 bg-emerald-900/30 text-emerald-400 rounded-lg flex items-center justify-center hover:bg-emerald-600 hover:text-white transition-all shadow-sm border border-emerald-900/50"
                            title="Chat Directo"
                          >
                            <i className="fa-brands fa-whatsapp"></i>
                          </button>
                        </div>
                      </div>

                      <div className="min-w-0">
                        <h4 className="font-black text-white text-base md:text-lg uppercase tracking-tight truncate">{client?.name}</h4>
                        <div className="flex flex-col gap-2 mt-1">
                          <p className="text-[8px] md:text-[9px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1 truncate">
                            <i className="fa-solid fa-location-dot"></i> {client?.address}
                          </p>
                          
                          {/* SECCIÓN GPS ESTILO EXPEDIENTE */}
                          <div className="flex items-center gap-2 mt-1 py-1 flex-wrap">
                            <span className="text-[7px] font-black text-slate-500 uppercase tracking-tighter">Mapa GPS:</span>
                            <button 
                              onClick={() => handleOpenMap(client?.domicilioLocation)}
                              className="px-3 py-1 bg-slate-800 text-emerald-400 rounded-full text-[8px] font-black uppercase flex items-center gap-1 hover:bg-emerald-600 hover:text-white transition-all shadow-sm border border-slate-700"
                            >
                              <i className="fa-solid fa-house-chimney"></i> Casa
                            </button>
                            <button 
                              onClick={() => handleOpenMap(client?.location)}
                              className="px-3 py-1 bg-slate-800 text-blue-400 rounded-full text-[8px] font-black uppercase flex items-center gap-1 hover:bg-blue-600 hover:text-white transition-all shadow-sm border border-slate-700"
                            >
                              <i className="fa-solid fa-briefcase"></i> Negocio
                            </button>
                            {balance > 0.01 && (() => {
                              const DIAS = ['DOMINGOS','LUNES','MARTES','MIÉRCOLES','JUEVES','VIERNES','SÁBADOS'];
                              const startDate = new Date(loan.createdAt.split('T')[0] + 'T00:00:00');
                              const diaSemana = DIAS[startDate.getDay()];
                              if (loan.frequency === Frequency.DAILY || loan.frequency === 'Diaria' as any) {
                                return (
                                  <span className="text-amber-400 text-sm font-black uppercase tracking-tight flex items-center gap-1.5">
                                    <i className="fa-solid fa-sun text-xs"></i> DIARIO · LUN A SÁB
                                  </span>
                                );
                              } else if (loan.frequency === Frequency.DAILY_MF) {
                                return (
                                  <span className="text-emerald-400 text-sm font-black uppercase tracking-tight flex items-center gap-1.5">
                                    <i className="fa-solid fa-calendar-day text-xs"></i> DIARIO · LUN A VIE
                                  </span>
                                );
                              } else if (loan.frequency === Frequency.WEEKLY) {
                                return (
                                  <span className="text-violet-400 text-sm font-black uppercase tracking-tight flex items-center gap-1.5">
                                    <i className="fa-solid fa-calendar-week text-xs"></i> SEMANAL · {diaSemana}
                                  </span>
                                );
                              } else if (loan.frequency === Frequency.BIWEEKLY) {
                                return (
                                  <span className="text-blue-400 text-sm font-black uppercase tracking-tight flex items-center gap-1.5">
                                    <i className="fa-solid fa-calendar-days text-xs"></i> QUINCENAL
                                  </span>
                                );
                              } else {
                                return (
                                  <span className="text-slate-300 text-sm font-black uppercase tracking-tight flex items-center gap-1.5">
                                    <i className="fa-solid fa-calendar text-xs"></i> MENSUAL
                                  </span>
                                );
                              }
                            })()}
                          </div>
                        </div>
                      </div>

                      {balance > 0.01 ? (
                        <>
                          <div className="bg-slate-950 p-3 md:p-4 rounded-xl md:rounded-2xl space-y-2 md:space-y-3 border border-slate-800 shadow-inner">
                            <div className="flex justify-between items-center opacity-60">
                              <p className="text-[7px] md:text-[8px] font-black text-slate-500 uppercase tracking-tighter">Monto habilitado</p>
                              <p className="text-[10px] md:text-xs font-black text-slate-400 font-mono">{formatCurrency((loan as any)._consolidatedPrincipal || loan.principal, state.settings)}</p>
                            </div>
                            
                            {loan.interestRate > 0 && (
                              <div className="flex justify-between items-center border-b border-slate-800/50 pb-2">
                                <p className="text-[7px] md:text-[8px] font-black text-slate-500 uppercase tracking-tighter">Monto Total</p>
                                <p className="text-[10px] md:text-xs font-black text-slate-300 font-mono">{formatCurrency((loan as any)._consolidatedTotalAmount || loan.totalAmount, state.settings)}</p>
                              </div>
                            )}

                            <div className="flex justify-between items-center pt-1">
                              <p className="text-[7px] md:text-[8px] font-black text-slate-500 uppercase">Cuota</p>
                              <p className="text-sm md:text-lg font-black text-blue-400 font-mono">{formatCurrency((loan as any)._consolidatedInstallmentValue || loan.installmentValue, state.settings)}</p>
                            </div>
                            <div className="flex justify-between items-center pt-1.5 md:pt-2 border-t border-slate-800">
                              <p className="text-[7px] md:text-[8px] font-black text-slate-500 uppercase">Saldo</p>
                              <p className="text-xs md:text-sm font-black text-red-400 font-mono">{formatCurrency(balance, state.settings)}</p>
                            </div>
                          </div>

                          <div className="space-y-1">
                            <div className="flex justify-between text-[7px] md:text-[8px] font-black text-slate-500 uppercase tracking-widest">
                              <span>Avance</span>
                              <span className="text-white font-mono">{installmentsPaid} / {loan.totalInstallments} <span className="opacity-40 ml-1">CUOTAS</span></span>
                            </div>
                            <div className="w-full h-1.5 md:h-2 bg-slate-800 rounded-full overflow-hidden shadow-inner">
                              <div className="h-full bg-emerald-500 transition-all duration-1000" style={{ width: `${progress}%` }}></div>
                            </div>
                          </div>
                        </>
                      ) : (loan as any)._isNewClient ? (
                        <div className="bg-slate-900/50 rounded-2xl p-5 flex flex-col items-center text-center space-y-4 border border-white/5 shadow-2xl relative overflow-hidden group">
                          {/* Sello de Nuevo Cliente */}
                          <div className="absolute -right-4 -top-4 w-20 h-20 bg-blue-500/10 rounded-full blur-2xl group-hover:bg-blue-500/20 transition-all"></div>
                          
                          <div className="w-14 h-14 bg-blue-500/20 rounded-full flex items-center justify-center border border-blue-500/30 shadow-lg shadow-blue-500/10">
                            <i className="fa-solid fa-user-plus text-blue-400 text-2xl"></i>
                          </div>

                          <div>
                            <span className="bg-blue-600 text-white text-[8px] font-black px-3 py-1 rounded-full uppercase tracking-widest shadow-lg shadow-blue-500/20">Cliente sin Crédito</span>
                            <h3 className="text-base font-black text-white uppercase tracking-tight mt-3">Habilitar Cartera</h3>
                            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1.5 px-4 leading-relaxed opacity-80">
                              Este cliente ha sido cargado pero aún no cuenta con un crédito activo.
                            </p>
                          </div>

                          <div className="w-full pt-2">
                            <button 
                              onClick={() => {
                                localStorage.setItem('quick_renewal_client', JSON.stringify(client));
                                setActiveTab('clients');
                                setTimeout(() => {
                                  window.dispatchEvent(new CustomEvent('open_add_loan_modal', { detail: client }));
                                }, 100);
                              }}
                              className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-black text-[10px] uppercase tracking-[0.15em] shadow-xl shadow-blue-500/20 active:scale-95 transition-all flex items-center justify-center gap-3 border-b-4 border-blue-800"
                            >
                              <i className="fa-solid fa-plus-circle text-xs"></i>
                              CARGAR CREDITO
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="bg-slate-900/50 rounded-2xl p-5 flex flex-col items-center text-center space-y-4 border border-white/5 shadow-2xl relative overflow-hidden group">
                          {/* Sello de Liquidado */}
                          <div className="absolute -right-4 -top-4 w-20 h-20 bg-emerald-500/10 rounded-full blur-2xl group-hover:bg-emerald-500/20 transition-all"></div>
                          
                          <div className="w-14 h-14 bg-emerald-500/20 rounded-full flex items-center justify-center border border-emerald-500/30 shadow-lg shadow-emerald-500/10">
                            <i className="fa-solid fa-check-double text-emerald-400 text-2xl"></i>
                          </div>

                          <div>
                            <span className="bg-emerald-500 text-white text-[8px] font-black px-3 py-1 rounded-full uppercase tracking-widest shadow-lg shadow-emerald-500/20">Crédito Liquidado</span>
                            <h3 className="text-base font-black text-white uppercase tracking-tight mt-3">¡Listo para Renovar!</h3>
                            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1.5 px-4 leading-relaxed opacity-80">
                              El cliente ha completado todos sus pagos con éxito.
                            </p>
                          </div>

                          <div className="w-full pt-2">
                            <button 
                              onClick={() => {
                                localStorage.setItem('quick_renewal_client', JSON.stringify(client));
                                setActiveTab('clients');
                                setTimeout(() => {
                                  window.dispatchEvent(new CustomEvent('open_add_loan_modal', { detail: client }));
                                }, 100);
                              }}
                              className="w-full py-4 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-black text-[10px] uppercase tracking-[0.15em] shadow-xl shadow-emerald-500/20 active:scale-95 transition-all flex items-center justify-center gap-3 border-b-4 border-emerald-700"
                            >
                              <i className="fa-solid fa-bolt-lightning text-xs"></i>
                              Nueva Renovación Directa
                            </button>
                          </div>
                          
                          <div className="flex items-center gap-2 w-full">
                            <div className="h-px bg-white/10 flex-1"></div>
                            <span className="text-[7px] font-black text-slate-600 uppercase tracking-widest">Opciones de Historial</span>
                            <div className="h-px bg-white/10 flex-1"></div>
                          </div>
                        </div>
                      )}

                      {/* TABLA DE HISTORIAL DESPLEGABLE (ESTILO IMAGEN 2) */}
                      {expandedHistory[loan.id] && (
                        <div className="mt-4 bg-slate-900 rounded-2xl overflow-hidden animate-slideDown border border-white/5 shadow-2xl">
                          <div className="p-3 bg-slate-800/50 flex justify-between items-center border-b border-white/5">
                            <h5 className="text-[9px] font-black text-white uppercase tracking-widest flex items-center gap-2">
                              <i className="fa-solid fa-clock-rotate-left"></i> Historial Reciente
                            </h5>
                            <button onClick={() => toggleHistory(loan.id)} className="text-white/40 hover:text-white"><i className="fa-solid fa-xmark"></i></button>
                          </div>
                          <div className="overflow-x-auto">
                            <table className="w-full text-left">
                              <thead>
                                <tr className="text-[7px] font-black text-slate-500 uppercase tracking-tighter border-b border-white/5">
                                  <th className="px-3 py-2">Fecha / Hora</th>
                                  <th className="px-3 py-2">Concepto</th>
                                  <th className="px-3 py-2 text-right">Monto</th>
                                  <th className="px-3 py-2 text-center">Acciones</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-white/5">
                                {cardLoanLogs.length === 0 ? (
                                  <tr><td colSpan={4} className="px-3 py-6 text-center text-[8px] font-bold text-slate-500 uppercase tracking-widest">Sin abonos recientes</td></tr>
                                ) : (
                                  [...cardLoanLogs].sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 5).map(log => (
                                    <tr key={log.id} className="text-[9px] font-bold text-slate-300 hover:bg-white/5">
                                      <td className="px-3 py-2">{formatDate(log.date)}<br/><span className="text-[7px] opacity-40">{new Date(log.date).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span></td>
                                      <td className="px-3 py-2 uppercase text-[8px]">{log.type === CollectionLogType.PAYMENT ? 'Abono Recibido' : 'No Pago'}</td>
                                      <td className="px-3 py-2 text-right font-black text-white">{formatCurrency(log.amount || 0, state.settings)}</td>
                                      <td className="px-3 py-2 text-center">
                                        {isAdminOrManager && (
                                          <button 
                                            onClick={() => { if(confirm('¿BORRAR ESTE PAGO?')) deleteCollectionLog?.(log.id); }}
                                            className="w-6 h-6 bg-red-500/10 text-red-500 rounded-md hover:bg-red-500 hover:text-white transition-all"
                                          >
                                            <i className="fa-solid fa-trash-can text-[8px]"></i>
                                          </button>
                                        )}
                                      </td>
                                    </tr>
                                  ))
                                )}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="p-3 md:p-4 bg-slate-800 border-t border-slate-700 flex flex-wrap gap-2 md:gap-3">
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleReprintLastReceipt(loan.id)}
                          className="w-10 md:w-12 h-10 md:h-12 rounded-lg md:rounded-xl bg-slate-700 text-slate-300 hover:bg-slate-600 hover:text-white transition-all flex items-center justify-center shadow-sm active:scale-95 border border-slate-600"
                          title="Imprimir Último"
                        >
                          <i className="fa-solid fa-print text-sm"></i>
                        </button>
                        <button
                          onClick={() => handleShareLastReceiptAsPhoto(loan.id)}
                          className="w-10 md:w-12 h-10 md:h-12 rounded-lg md:rounded-xl bg-emerald-900/40 text-emerald-400 hover:bg-emerald-600 hover:text-white transition-all flex items-center justify-center shadow-sm active:scale-95 border border-emerald-800"
                          title="Foto WhatsApp"
                        >
                          <i className="fa-solid fa-camera text-sm"></i>
                        </button>
                        <button
                          onClick={() => toggleHistory(loan.id)}
                          className={`w-10 md:w-12 h-10 md:h-12 rounded-lg md:rounded-xl transition-all flex items-center justify-center shadow-sm active:scale-95 border ${expandedHistory[loan.id] ? 'bg-blue-600 text-white border-blue-500' : 'bg-blue-900/40 text-blue-400 hover:bg-blue-600 hover:text-white border-blue-800'}`}
                          title="Historial de Pagos"
                        >
                          <i className="fa-solid fa-history text-sm"></i>
                        </button>
                        {isAdminOrManager && lastPayLog && (
                          <button
                            onClick={() => { if (confirm('¿BORRAR ÚLTIMO PAGO? Se revertirá el saldo.')) deleteCollectionLog?.(lastPayLog.id); }}
                            className="w-10 md:w-12 h-10 md:h-12 rounded-lg md:rounded-xl bg-red-900/40 text-red-400 hover:bg-red-600 hover:text-white transition-all flex items-center justify-center shadow-sm active:scale-95 border border-red-800"
                            title="Borrar Último"
                          >
                            <i className="fa-solid fa-trash-can text-sm"></i>
                          </button>
                        )}
                      </div>
                      <div className="flex-1 flex gap-2">
                        {balance > 0.01 && (
                          <>
                            <button
                              onClick={() => handleQuickAction(loan.id, CollectionLogType.NO_PAGO)}
                              className="flex-1 py-2.5 md:py-3 bg-slate-700 border border-slate-600 rounded-lg md:rounded-xl font-black text-[8px] md:text-[9px] text-red-400 uppercase tracking-widest hover:bg-red-900/20 transition-all active:scale-95"
                            >
                              No Pago
                            </button>
                            <button
                              onClick={() => handleOpenPayment(loan)}
                              className="flex-1 py-2.5 md:py-3 bg-emerald-600 text-white rounded-lg md:rounded-xl font-black text-[8px] md:text-[9px] uppercase tracking-widest shadow-lg shadow-emerald-900/20 hover:bg-emerald-500 transition-all active:scale-95"
                            >
                              Pagar
                            </button>
                          </>
                        )}
                      </div>
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
                  <th className="px-6 py-5 border-r border-white/10 text-center">Cuotas Pagadas</th>
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
                    const client = (Array.isArray(state.clients) ? state.clients : []).find(c => c.id === loan.clientId);
                    
                    const totalPaid = (loan as any)._consolidatedPaid;
                    const balance = (loan as any)._consolidatedBalance;
                    const mora = (loan as any)._consolidatedMora;

                    const installmentsPaid = Number((totalPaid / loan.installmentValue).toFixed(1));

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
                        <td className="px-6 py-4 border-r border-slate-100 text-center font-mono font-black text-slate-500">
                          {Number((totalPaid / loan.installmentValue).toFixed(1))} / {loan.totalInstallments}
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
        <div className="fixed inset-0 bg-slate-900/98 flex items-start justify-center z-[150] p-2 overflow-y-auto pt-10 md:pt-20">
          <div className="bg-white rounded-[2rem] shadow-2xl w-full max-sm overflow-hidden animate-scaleIn border border-white/20">
            <div className="p-5 md:p-6 bg-slate-900 text-white flex justify-between items-center sticky top-0 z-10">
              <div><h3 className="text-base md:text-lg font-black uppercase tracking-tighter">Registrar Abono</h3></div>
              <button onClick={resetUI} className="w-8 h-8 bg-white/10 text-white rounded-lg flex items-center justify-center hover:bg-red-600 transition-all"><i className="fa-solid fa-xmark text-lg"></i></button>
            </div>
            <div className="p-5 md:p-6 space-y-4 md:space-y-6">
              <div className={`grid ${state.currentUser?.role === Role.ADMIN ? 'grid-cols-4' : 'grid-cols-3'} gap-1 mb-6 bg-slate-50 p-1 rounded-xl border border-slate-200`}>
                <button onClick={() => setMethod('cash')} className={`py-2 rounded-lg text-[8px] font-black uppercase border transition-all ${!isVirtualPayment && !isRenewalPayment && !isQrPayment ? 'bg-slate-900 text-white shadow-md' : 'bg-slate-50 text-slate-400 active:bg-slate-100'}`}>Efectivo</button>
                <button onClick={() => setMethod('virtual')} className={`py-2 rounded-lg text-[8px] font-black uppercase border transition-all ${isVirtualPayment ? 'bg-blue-600 text-white shadow-md' : 'bg-slate-50 text-slate-400 active:bg-slate-100'}`}>Transf.</button>
                {state.currentUser?.role === Role.ADMIN && (
                  <button onClick={() => setMethod('qr')} className={`py-2 rounded-lg text-[8px] font-black uppercase border transition-all ${isQrPayment ? 'bg-purple-600 text-white shadow-md' : 'bg-slate-50 text-slate-400 active:bg-slate-100'}`}>QR</button>
                )}
                <button onClick={() => setMethod('renewal')} className={`py-2 rounded-lg text-[8px] font-black uppercase border transition-all ${isRenewalPayment ? 'bg-amber-600 text-white shadow-md' : 'bg-slate-50 text-slate-400 active:bg-slate-100'}`}>Renovar</button>
              </div>

              {isWaitingForQrPayment ? (
                <div className="space-y-6 py-4 animate-scaleIn">
                  {qrCodePayload ? (
                    <div className="flex flex-col items-center justify-center">
                      <div className="p-3 bg-white rounded-2xl border-2 border-purple-200 shadow-lg">
                        <img src={qrCodePayload} alt="QR de Pago" className="w-48 h-48 mx-auto" />
                      </div>
                      <p className="text-[10px] font-black text-slate-800 uppercase mt-4 tracking-widest animate-pulse flex items-center justify-center gap-2">
                        <i className="fa-solid fa-spinner animate-spin text-purple-600"></i> Esperando confirmación...
                      </p>
                      <p className="text-[8px] text-slate-400 mt-1 uppercase font-bold tracking-widest leading-none">Monto: {formatCurrency(paymentAmount, state.settings)}</p>
                    </div>
                  ) : (
                    <div className="py-8 flex flex-col items-center justify-center gap-3">
                      <i className="fa-solid fa-circle-notch fa-spin text-4xl text-purple-600"></i>
                      <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Generando QR de Bancard...</p>
                    </div>
                  )}
                  
                  <div className="pt-4 border-t border-slate-100">
                    <button
                      onClick={handleCancelQrLoans}
                      className="w-full py-4 bg-red-50 text-red-600 border border-red-200 rounded-xl font-black uppercase text-[10px] tracking-widest active:scale-95 transition-all flex items-center justify-center gap-2"
                    >
                      <i className="fa-solid fa-ban"></i> Cancelar Espera
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  {isQrPayment && !hasQrConfig && (
                    <div className="bg-purple-50 p-4 rounded-2xl border border-purple-200 text-center mb-4 animate-fadeIn">
                      <i className="fa-solid fa-triangle-exclamation text-purple-600 text-xl mb-2"></i>
                      <p className="text-[10px] font-black text-purple-800 uppercase tracking-widest">Configuración Requerida</p>
                      <p className="text-[8px] text-purple-600 mt-1 uppercase font-bold leading-normal">El Gerente debe configurar las credenciales de Bancard en Opciones para habilitar este cobro.</p>
                    </div>
                  )}

                  {(!isQrPayment || hasQrConfig) && (
                    <div className="relative mb-6">
                      <span className="absolute left-5 top-1/2 -translate-y-1/2 text-2xl font-black text-slate-300">$</span>
                      <input type="number" autoFocus value={paymentAmount === 0 ? '' : paymentAmount} onChange={(e) => setPaymentAmount(Number(e.target.value))} className="w-full pl-12 pr-5 py-8 md:py-10 bg-slate-50 border border-slate-200 rounded-2xl md:rounded-[2.5rem] text-3xl md:text-5xl font-black text-center text-slate-900 outline-none focus:ring-4 focus:ring-emerald-500/20 shadow-inner" />
                    </div>
                  )}

                  {(!isQrPayment || hasQrConfig) ? (
                    <button
                      onClick={() => {
                        if (isQrPayment) {
                          handleGenerateQrLoans();
                        } else {
                          selectedLoanId && handleQuickAction(selectedLoanId, CollectionLogType.PAYMENT, paymentAmount, isVirtualPayment, isRenewalPayment);
                        }
                      }}
                      disabled={isProcessingPayment}
                      className={`w-full py-4 md:py-5 ${isQrPayment ? 'bg-purple-600 hover:bg-purple-700 shadow-purple-500/20' : 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-500/20'} text-white rounded-xl md:rounded-[2rem] font-black uppercase text-xs md:text-sm tracking-widest shadow-2xl active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-2`}
                    >
                      {isProcessingPayment ? (
                        <i className="fa-solid fa-circle-notch animate-spin mr-2"></i>
                      ) : isQrPayment ? (
                        <>
                          <i className="fa-solid fa-qrcode"></i> Generar QR de Cobro
                        </>
                      ) : (
                        'Confirmar Cobro'
                      )}
                    </button>
                  ) : null}
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {editingReceipt && (
        <div className="fixed inset-0 bg-slate-900/98 flex items-start justify-center z-[170] p-4 overflow-y-auto pt-10 md:pt-20">
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

                  // WhatsApp Automático
                  const client = (Array.isArray(state.clients) ? state.clients : []).find(c => c.name === editingReceipt.clientName);
                  if (client) {
                    const phone = client.phone.replace(/\D/g, '');
                    const countryPrefix = state.settings.country === 'PY' ? '595' : '57';
                    const targetPhone = (phone.length === 10 && countryPrefix === '57') ? countryPrefix + phone : (phone.startsWith(countryPrefix) ? phone : countryPrefix + phone);
                    window.open(`https://wa.me/${targetPhone}?text=${encodeURIComponent("ticket")}`, '_blank');
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
        <div className="fixed inset-0 bg-slate-900/98 flex items-start justify-center z-[160] p-4 overflow-y-auto pt-10 md:pt-20">
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
                  disabled={isSharing}
                  onClick={handleShareReceiptPDF}
                  className={`w-full py-4 bg-emerald-600 text-white rounded-xl font-black uppercase text-[10px] tracking-widest shadow-xl active:scale-95 transition-all flex items-center justify-center gap-2 ${isSharing ? 'opacity-50' : ''}`}
                >
                  {isSharing ? <i className="fa-solid fa-spinner animate-spin"></i> : <i className="fa-brands fa-whatsapp"></i>}
                  {isSharing ? 'GENERANDO PDF...' : 'Enviar por WhatsApp (PDF)'}
                </button>
                <button
                  disabled={isSharing}
                  onClick={handleShareReceiptPhoto}
                  className={`w-full py-4 bg-emerald-500 text-white rounded-xl font-black uppercase text-[10px] tracking-widest shadow-xl active:scale-95 transition-all flex items-center justify-center gap-2 ${isSharing ? 'opacity-50' : ''}`}
                >
                  {isSharing ? <i className="fa-solid fa-spinner animate-spin"></i> : <i className="fa-solid fa-camera"></i>}
                  {isSharing ? 'GENERANDO FOTO...' : 'ENVIAR FOTO DE RECIBO'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* CONTENEDOR OCULTO PARA CAPTURA DE RECIBO EN IMAGEN */}
      {receipt && (
        <div id="receipt-container-hidden-loans" style={{ position: 'fixed', left: '-5000px', top: '0', opacity: '0', pointerEvents: 'none', zIndex: -1, background: 'white', width: '400px', padding: '20px' }}>
          <div ref={receiptCardRef} className="bg-white p-6 border-2 border-slate-900 rounded-lg text-black font-mono text-sm leading-relaxed whitespace-pre-wrap">
            <div className="text-center mb-4">
              <h2 className="text-xl font-black uppercase">{state.settings.companyName || 'ANEXO COBROS'}</h2>
              <p className="text-[10px] uppercase font-bold text-slate-500">{state.settings.companyAlias || ''}</p>
              <div className="h-px bg-slate-900 my-2"></div>
            </div>
            {convertReceiptForWhatsApp(receipt || '')}
            <div className="mt-4 pt-4 border-t border-dashed border-slate-400 text-center">
              <p className="text-[10px] font-black uppercase">¡Gracias por su confianza!</p>
              <p className="text-[8px] mt-1">{state.settings.shareLabel || 'Cuenta'}: {state.settings.shareValue || ''}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Loans;
