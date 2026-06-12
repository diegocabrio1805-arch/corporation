import React, { useState, useMemo, useRef, useEffect } from 'react';
import { AppState, Client, CollectionLogType, LoanStatus, Role } from '../types';
import { formatCurrency, parseAmount, calculateTotalPaidFromLogs, generateUUID, getDaysOverdue, generateReceiptText, convertReceiptForWhatsApp } from '../utils/helpers';
import PullToRefresh from './PullToRefresh';
import { getTranslation } from '../utils/translations';
import { Geolocation } from '@capacitor/geolocation';
import { Capacitor } from '@capacitor/core';
import { supabase } from '../utils/supabaseClient';
import { getFastLocation } from '../utils/gpsHelper';

interface MobileCollectorModeProps {
  state: AppState;
  addCollectionAttempt: (log: any, skipSync?: boolean) => void;
  onForceSync?: (silent?: boolean, message?: string, fullSync?: boolean, skipPull?: boolean) => Promise<void>;
  activeLocation?: { lat: number, lng: number, timestamp: number } | null;
}

const MobileCollectorMode: React.FC<MobileCollectorModeProps> = ({ state, addCollectionAttempt, onForceSync, activeLocation }) => {
  const lang = (state.settings as any).language || 'es';
  const t = getTranslation(lang) as any;
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedClient, setSelectedClient] = useState<string | null>(null);
  const [amountInput, setAmountInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  
  // States para el tipo de abono y recibo
  const [isVirtualProcessing, setIsVirtualProcessing] = useState(false);
  const [isRenewalProcessing, setIsRenewalProcessing] = useState(false);
  const [receipt, setReceipt] = useState<string | null>(null);
  const [isSharing, setIsSharing] = useState(false);
  const receiptCardRef = useRef<HTMLDivElement>(null);
  const qrChannelRef = useRef<any>(null);
  const [showHistoryFor, setShowHistoryFor] = useState<string | null>(null);

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 10;

  const currentUserId = state.currentUser?.id;
  const isAdminOrManager = state.currentUser?.role === Role.ADMIN || state.currentUser?.role === Role.MANAGER;

  const activeClientsMap = useMemo(() => {
    const map: Record<string, any> = {};
    const loans = (Array.isArray(state.loans) ? state.loans : []);
    
    // Sort to get the most relevant/recent loan if multiple exist
    const sortedLoans = [...loans].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    
    sortedLoans.forEach(l => {
      if (!isAdminOrManager && currentUserId && (l.collectorId || (l as any).collector_id) !== currentUserId) return;
      if (!map[l.clientId]) map[l.clientId] = l;
    });
    return map;
  }, [state.loans, currentUserId, isAdminOrManager]);

  const filteredClients = useMemo(() => {
    const s = searchTerm.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
    const result = (Array.isArray(state.clients) ? state.clients : []).filter(c => {
      if (c.isHidden || c.deletedAt) return false;
      // YA NO FILTRAMOS POR PRÉSTAMO ACTIVO PARA MOSTRAR TODA LA CARTERA

      if (s) {
        const nameNorm = c.name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        const docNorm = (c.documentId || '').toLowerCase().replace(/\s+/g, "");
        return nameNorm.includes(s) || docNorm.includes(s);
      }
      return true;
    }).sort((a,b) => a.name.localeCompare(b.name));
    
    return result;
  }, [state.clients, searchTerm]);

  // Reset pagination when search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  const totalPages = Math.ceil(filteredClients.length / ITEMS_PER_PAGE);
  const paginatedClients = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredClients.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredClients, currentPage]);

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setCurrentPage(newPage);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const [isQrProcessing, setIsQrProcessing] = useState(false);
  const [qrCodePayload, setQrCodePayload] = useState<string | null>(null);
  const [isWaitingForQrPayment, setIsWaitingForQrPayment] = useState(false);
  const [hasQrConfig, setHasQrConfig] = useState(false);

  useEffect(() => {
    const checkQrConfig = async () => {
      if (!selectedClient || !state.currentUser) return;
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
  }, [selectedClient, state.currentUser?.id]);

  const handleOpenPayment = (clientId: string, defaultAmount: number) => {
    setSelectedClient(clientId);
    setAmountInput(defaultAmount.toString());
    setIsVirtualProcessing(false);
    setIsRenewalProcessing(false);
    setIsQrProcessing(false);
    setQrCodePayload(null);
    setIsWaitingForQrPayment(false);
  };

  const setMethodInRoute = (method: 'cash' | 'virtual' | 'renewal' | 'qr', loan: any) => {
    setIsVirtualProcessing(method === 'virtual');
    setIsRenewalProcessing(method === 'renewal');
    setIsQrProcessing(method === 'qr');
    const totalPaid = calculateTotalPaidFromLogs(loan, state.collectionLogs);
    if (method === 'renewal') {
      setAmountInput(Math.max(0, loan.totalAmount - totalPaid).toString());
    } else {
      setAmountInput(Math.max(0, loan.installmentValue).toString());
    }
  };

  const resetUI = () => {
    if ((window as any).qrPaymentTimerMobile) {
      clearTimeout((window as any).qrPaymentTimerMobile);
    }
    if (qrChannelRef.current) {
      supabase.removeChannel(qrChannelRef.current);
      qrChannelRef.current = null;
    }
    setReceipt(null);
    setSelectedClient(null);
    setIsProcessing(false);
    setIsVirtualProcessing(false);
    setIsRenewalProcessing(false);
    setIsQrProcessing(false);
    setQrCodePayload(null);
    setIsWaitingForQrPayment(false);
    setAmountInput('0');
  };
  const handleGenerateQrMobile = async (clientId: string) => {
    const loan = activeClientsMap[clientId];
    if (!loan || !state.currentUser) return;

    setIsProcessing(true);
    setIsWaitingForQrPayment(true);
    
    try {
      const amount = parseAmount(amountInput);
      const uniqueRef = `bancard_ref_${generateUUID().slice(0,8)}`;

      // 1. Insertar el pago en estado PENDING en la tabla pagos_qr de Supabase
      const { data: pagoQrData, error } = await supabase
        .from('pagos_qr')
        .insert({
          loan_id: loan.id,
          collector_id: state.currentUser.id,
          amount: amount,
          status: 'PENDING',
          bancard_process_id: uniqueRef
        })
        .select()
        .single();

      if (error) {
        throw new Error(error.message);
      }

      // 2. Generar el código QR scannable de prueba
      setTimeout(() => {
        const mockPayload = `Bancard-QR|Monto:${amount}|Comercio:${state.settings.companyName || 'Anexo Cobro'}|Ref:${uniqueRef}`;
        setQrCodePayload(`https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(mockPayload)}`);
        setIsProcessing(false);
      }, 1500);

      // 3. Suscribirse en Supabase Realtime a cambios en este pago QR
      if (qrChannelRef.current) {
        supabase.removeChannel(qrChannelRef.current);
      }

      const channel = supabase
        .channel(`pago_qr_mobile_${pagoQrData.id}`)
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'pagos_qr',
            filter: `id=eq.${pagoQrData.id}`
          },
          async (payload: any) => {
            console.log("Cambio detectado en tiempo real en Mobile:", payload);
            if (payload.new && payload.new.status === 'COMPLETED') {
              // Limpiar la suscripción y el QR
              if (qrChannelRef.current) {
                supabase.removeChannel(qrChannelRef.current);
                qrChannelRef.current = null;
              }
              setIsWaitingForQrPayment(false);
              setQrCodePayload(null);
              
              // Registrar abono real
              await handleAction(clientId, CollectionLogType.PAYMENT);
            }
          }
        )
        .subscribe();

      qrChannelRef.current = channel;

    } catch (err: any) {
      console.error("[QR] Error al generar registro:", err);
      alert("Error al inicializar el pago QR: " + err.message);
      setIsProcessing(false);
      setIsWaitingForQrPayment(false);
    }
  };

  const handleCancelQrMobile = async (loan: any) => {
    if (qrChannelRef.current) {
      supabase.removeChannel(qrChannelRef.current);
      qrChannelRef.current = null;
    }

    if (loan && state.currentUser) {
      try {
        await supabase
          .from('pagos_qr')
          .update({ status: 'CANCELLED' })
          .eq('loan_id', loan.id)
          .eq('status', 'PENDING');
      } catch (err) {
        console.warn("[QR] No se pudo cancelar el registro en DB:", err);
      }
    }

    setIsWaitingForQrPayment(false);
    setQrCodePayload(null);
    setIsProcessing(false);
    setMethodInRoute('cash', loan);
  };

  const handleAction = async (clientId: string, type: CollectionLogType) => {
    if (isProcessing) return;
    const loan = activeClientsMap[clientId];
    if (!loan) return;

    setIsProcessing(true);
    try {
      const amountToApply = parseAmount(amountInput);
      
      const threshold = 500;
      if (type === CollectionLogType.PAYMENT && amountToApply > 0 && amountToApply < threshold) {
        if (!confirm(`¡ATENCIÓN!\n\nHas ingresado un monto de ${formatCurrency(amountToApply, state.settings)}.\n\n¿Estás SEGURO de que este monto es correcto y no quisiste poner un número mayor?`)) {
          setIsProcessing(false);
          return;
        }
      }

      let currentLocation = await getFastLocation(activeLocation);

      const loans = (Array.isArray(state.loans) ? state.loans : []);
      const activeLoans = loans.filter(l => 
        l.status !== LoanStatus.PAID && 
        l.clientId === clientId && 
        (l.balance === undefined || l.balance > 0) &&
        (!isAdminOrManager && currentUserId ? (l.collectorId || (l as any).collector_id) === currentUserId : true)
      );

      if (type === CollectionLogType.NO_PAGO && activeLoans.length > 1) {
        for (const activeLoan of activeLoans) {
          const log = {
            id: generateUUID(),
            clientId,
            loanId: activeLoan.id,
            type,
            amount: 0,
            date: new Date().toISOString(),
            location: currentLocation,
            isVirtual: isVirtualProcessing,
            isRenewal: isRenewalProcessing,
            companySnapshot: state.settings
          };
          await addCollectionAttempt(log, true);
        }
        if (onForceSync) await onForceSync(true, "Registrando...", false, true);
      } else {
        const log = {
          id: generateUUID(),
          clientId,
          loanId: loan.id,
          type,
          amount: type === CollectionLogType.PAYMENT ? amountToApply : 0,
          date: new Date().toISOString(),
          location: currentLocation,
          isVirtual: isVirtualProcessing,
          isRenewal: isRenewalProcessing,
          companySnapshot: state.settings
        };
        await addCollectionAttempt(log, true);
        if (onForceSync) await onForceSync(true, "Registrando...", false, true);
      }

      if (type === CollectionLogType.PAYMENT) {
          const client = (Array.isArray(state.clients) ? state.clients : []).find(c => c.id === clientId);
          if (client) {
             const totalPaidHistory = calculateTotalPaidFromLogs(loan, state.collectionLogs) + amountToApply;
             const receiptText = generateReceiptText({
                clientName: client.name,
                amountPaid: amountToApply,
                previousBalance: Math.max(0, loan.totalAmount - (totalPaidHistory - amountToApply)),
                loanId: loan.id,
                startDate: loan.createdAt,
                expiryDate: loan.createdAt,
                daysOverdue: getDaysOverdue(loan, state.settings, totalPaidHistory),
                remainingBalance: Math.max(0, loan.totalAmount - totalPaidHistory),
                paidInstallments: totalPaidHistory / (loan.installmentValue || 1),
                totalInstallments: loan.totalInstallments,
                isRenewal: isRenewalProcessing,
                isVirtual: isVirtualProcessing,
                installmentValue: loan.installmentValue,
                totalPaidAmount: totalPaidHistory,
                principal: loan.totalAmount,
             }, state.settings);

             setReceipt(receiptText);
             import('../services/bluetoothPrinterService').then(({ printText }) => {
                printText(receiptText).catch(e => console.error("Auto print failed", e));
             });
             
             setTimeout(() => {
                const phone = client.phone.replace(/\D/g, '');
                if (phone) {
                   window.open(`https://wa.me/${phone}?text=${encodeURIComponent('ticket')}`, '_blank');
                }
             }, 1000);
          }
      } else {
          // If NO PAGO, send WhatsApp message and clear selection
          const client = (Array.isArray(state.clients) ? state.clients : []).find(c => c.id === clientId);
          if (client) {
             const totalPaidHistory = calculateTotalPaidFromLogs(loan, state.collectionLogs);
             const remainingBalance = Math.max(0, loan.totalAmount - totalPaidHistory);
             const daysOverdue = getDaysOverdue(loan, state.settings, totalPaidHistory);
             
             let message = '';
             if (client.customNoPayMessage) {
                 message = client.customNoPayMessage
                     .replace('{cliente}', client.name)
                     .replace('{saldo}', formatCurrency(remainingBalance, state.settings))
                     .replace('{atraso}', daysOverdue.toString());
             } else {
                 message = `Hola ${client.name}, te informamos que hoy no se registró tu pago. Tu saldo pendiente es de ${formatCurrency(remainingBalance, state.settings)} y cuentas con ${daysOverdue} días de atraso. Por favor, ponte al día para evitar inconvenientes gracias`;
             }

             setTimeout(() => {
                const phone = client.phone.replace(/\D/g, '');
                if (phone) {
                   window.open(`https://wa.me/${phone}?text=${encodeURIComponent(message)}`, '_blank');
                }
             }, 1000);
          }
          resetUI();
      }
      setSelectedClient(null);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleShareReceiptPDF = async () => {
    if (!receiptCardRef.current || !receipt || isSharing) return;
    setIsSharing(true);
    try {
      const html2canvas = (await import('html2canvas')).default;
      const { jsPDF } = await import('jspdf');

      const container = document.getElementById('receipt-container-hidden-route');
      if (container) {
        container.style.display = 'block';
        container.style.visibility = 'visible';
        container.style.left = '0';
        container.style.opacity = '1';
        container.style.zIndex = '9999';
      }

      await new Promise(r => setTimeout(r, 400));

      const canvas = await html2canvas(receiptCardRef.current, {
        scale: 2, useCORS: true, logging: false, allowTaint: true, windowWidth: 400, width: 400, height: receiptCardRef.current.scrollHeight,
      });

      if (container) { container.style.display = 'none'; container.style.opacity = '0'; container.style.left = '-5000px'; }

      const fileName = `Recibo_${new Date().getTime()}.pdf`;
      const pdf = new jsPDF('p', 'mm', [80, 200]);
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const imgHeight = (canvas.height * pdfWidth) / canvas.width;
      pdf.addImage(canvas, 'JPEG', 0, 0, pdfWidth, imgHeight);
      
      const pdfBase64 = pdf.output('datauristring').split(',')[1];

      const { Filesystem, Directory } = await import('@capacitor/filesystem');
      const { Share } = await import('@capacitor/share');
      const savedFile = await Filesystem.writeFile({ path: fileName, data: pdfBase64, directory: Directory.Cache });
      await Share.share({ title: 'Recibo', text: 'Comprobante', url: savedFile.uri, dialogTitle: 'Enviar Recibo' });
    } catch (err) {
      alert("Error al compartir PDF: " + err);
    } finally { setIsSharing(false); }
  };

  const handleShareReceiptPhoto = async () => {
    if (!receiptCardRef.current || !receipt || isSharing) return;
    setIsSharing(true);
    try {
      const html2canvas = (await import('html2canvas')).default;
      const container = document.getElementById('receipt-container-hidden-route');
      if (container) {
        container.style.display = 'block'; container.style.visibility = 'visible'; container.style.left = '0'; container.style.opacity = '1'; container.style.zIndex = '9999';
      }
      await new Promise(r => setTimeout(r, 400));
      const canvas = await html2canvas(receiptCardRef.current, {
        scale: 2, useCORS: true, logging: false, allowTaint: true, windowWidth: 400, width: 400, height: receiptCardRef.current.scrollHeight,
      });

      const clientMatch = receipt.match(/CLIENTE: (.*)\n/);
      const clientName = clientMatch ? clientMatch[1].trim() : 'Recibo';
      const fileName = `Recibo_${clientName.replace(/\s+/g, '_')}_${new Date().getTime()}.jpg`;

      if (!Capacitor.isNativePlatform()) {
        const blob = await new Promise<Blob | null>(r => canvas.toBlob(r, 'image/jpeg', 0.8));
        if (blob) {
          const blobUrl = URL.createObjectURL(blob);
          const link = document.createElement('a'); link.href = blobUrl; link.download = fileName; link.click();
        }
      } else {
        const { Filesystem, Directory } = await import('@capacitor/filesystem');
        const { Share } = await import('@capacitor/share');
        const base64Data = canvas.toDataURL('image/jpeg', 0.8).split(',')[1];
        const savedFile = await Filesystem.writeFile({ path: fileName, data: base64Data, directory: Directory.Cache });
        await Share.share({ title: 'Recibo', text: 'Comprobante', url: savedFile.uri, dialogTitle: 'Enviar Foto' });
      }
    } catch (err) {
      alert("Error imagen: " + err);
    } finally {
      setIsSharing(false);
      const container = document.getElementById('receipt-container-hidden-route');
      if (container) { container.style.display = 'none'; container.style.left = '-5000px'; }
    }
  };

  return (
    <PullToRefresh onRefresh={async () => { if (onForceSync) await onForceSync(false); }}>
      <div className="bg-slate-950 min-h-screen p-4 pb-32 text-white overflow-x-hidden">
        
        {/* Cabecera Resumen LITE */}
        <div className="bg-slate-900 border border-emerald-900/30 rounded-3xl p-6 mb-6 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-full blur-3xl -mr-10 -mt-10 pointer-events-none"></div>
          <h2 className="text-emerald-500 font-black tracking-widest text-[10px] uppercase mb-1">{lang === 'fr' ? 'Route Mobile Active' : lang === 'pt' ? 'Rota Móvel Ativa' : 'Ruta Móvil Activa'}</h2>
          <p className="text-3xl font-black text-white font-mono tracking-tighter">{(filteredClients.length)}</p>
          <p className="text-slate-400 text-[10px] uppercase font-bold tracking-widest">{lang === 'fr' ? 'Débiteurs Assignés' : lang === 'pt' ? 'Devedores Atribuídos' : 'Deudores Asignados'}</p>
        </div>

        {/* Buscador */}
        <div className="relative mb-6">
          <i className="fa-solid fa-search absolute left-5 top-1/2 -translate-y-1/2 text-slate-500"></i>
          <input 
             type="text" placeholder={lang === 'fr' ? 'Rechercher Client...' : lang === 'pt' ? 'Buscar Cliente...' : 'Buscar Cliente...'} value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
             className="w-full bg-slate-900 border border-slate-800 text-white font-bold py-5 pl-14 pr-6 rounded-3xl outline-none focus:border-emerald-500 transition-all shadow-inner focus:shadow-[0_0_20px_rgba(16,185,129,0.1)]"
          />
        </div>

        {/* Lista de Clientes (Paginda) */}
        <div className="space-y-4">
          {paginatedClients.map(client => {
            const loan = activeClientsMap[client.id];
            
            // CORRECCIÓN DE SALDO: Usar el balance directo del servidor para máxima precisión
            const balance = loan ? (loan.balance !== undefined ? loan.balance : Math.max(0, loan.totalAmount - (loan.totalPaid || 0))) : 0;
            
            const isSelected = selectedClient === client.id;

            return (
              <div key={client.id} className="bg-slate-900/80 rounded-3xl border border-slate-800 p-5 shadow-lg relative transition-all duration-300">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-2xl bg-slate-800 border-2 border-slate-700 flex items-center justify-center overflow-hidden shrink-0">
                    {client.profilePic ? <img src={client.profilePic} className="w-full h-full object-cover" /> : <i className="fa-solid fa-user text-slate-500 text-2xl"></i>}
                  </div>
                  <div className="flex-1">
                    <h3 className="font-black text-sm uppercase tracking-tighter line-clamp-1">{client.name}</h3>
                    <p className="text-slate-500 text-[9px] uppercase font-black tracking-widest mt-0.5"><i className="fa-solid fa-file-invoice text-slate-600 mr-1"></i> ID: {client.documentId}</p>
                    <p className={`${balance > 0 ? 'text-emerald-400' : 'text-slate-500'} font-mono text-lg font-black mt-1 leading-none`}>
                       {loan ? formatCurrency(balance, state.settings) : 'SIN DEUDA'}
                    </p>
                  </div>
                </div>

                {/* Zona Activa Expandible */}
                <div className={`mt-4 pt-4 border-t border-slate-800 transition-all duration-300 ${isSelected ? 'block' : 'hidden'}`}>
                       {loan ? (
                    <>
                      {/* Selector de Método de Pago */}
                      <div className={`grid ${state.currentUser?.role === Role.ADMIN ? 'grid-cols-4' : 'grid-cols-3'} gap-1 mb-4 bg-slate-950 p-1 rounded-xl`}>
                        <button onClick={() => setMethodInRoute('cash', loan)} className={`py-2.5 rounded-lg text-[8px] font-black uppercase transition-all ${!isVirtualProcessing && !isRenewalProcessing && !isQrProcessing ? 'bg-slate-800 text-white shadow-md' : 'text-slate-500'}`}>{lang === 'fr' ? 'ESPÈCES' : lang === 'pt' ? 'DINHEIRO' : 'EFECTIVO'}</button>
                        <button onClick={() => setMethodInRoute('virtual', loan)} className={`py-2.5 rounded-lg text-[8px] font-black uppercase transition-all ${isVirtualProcessing ? 'bg-blue-600 text-white shadow-md' : 'text-slate-500'}`}>{lang === 'fr' ? 'TRANSF.' : 'TRANSF.'}</button>
                        {state.currentUser?.role === Role.ADMIN && (
                          <button onClick={() => setMethodInRoute('qr', loan)} className={`py-2.5 rounded-lg text-[8px] font-black uppercase transition-all ${isQrProcessing ? 'bg-purple-600 text-white shadow-md' : 'text-slate-500'}`}>QR</button>
                        )}
                        <button onClick={() => setMethodInRoute('renewal', loan)} className={`py-2.5 rounded-lg text-[8px] font-black uppercase transition-all ${isRenewalProcessing ? 'bg-amber-600 text-white shadow-md' : 'text-slate-500'}`}>{lang === 'fr' ? 'RENOUVELER' : lang === 'pt' ? 'RENOVAR' : 'RENOVAR'}</button>
                      </div>

                      {isWaitingForQrPayment ? (
                        <div className="space-y-4 py-2 animate-scaleIn">
                          {qrCodePayload ? (
                            <div className="flex flex-col items-center justify-center">
                              <div className="p-3 bg-white rounded-2xl border-2 border-purple-900/30 shadow-lg">
                                <img src={qrCodePayload} alt="QR de Pago" className="w-40 h-40 mx-auto" />
                              </div>
                              <p className="text-[9px] font-black text-purple-400 uppercase mt-3 tracking-widest animate-pulse flex items-center justify-center gap-1.5">
                                <i className="fa-solid fa-spinner animate-spin"></i> Esperando cobro...
                              </p>
                              <p className="text-[8px] text-slate-500 mt-0.5 uppercase font-bold tracking-widest">Monto: {formatCurrency(parseAmount(amountInput), state.settings)}</p>
                            </div>
                          ) : (
                            <div className="py-6 flex flex-col items-center justify-center gap-2">
                              <i className="fa-solid fa-circle-notch fa-spin text-3xl text-purple-500"></i>
                              <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Generando QR...</p>
                            </div>
                          )}
                          
                          <div className="pt-2 border-t border-slate-800">
                            <button
                              onClick={() => handleCancelQrMobile(loan)}
                              className="w-full py-3.5 bg-red-900/20 text-red-400 border border-red-900/40 rounded-xl font-black uppercase text-[9px] tracking-widest active:scale-95 transition-all flex items-center justify-center gap-1.5"
                            >
                              <i className="fa-solid fa-ban"></i> Cancelar Espera
                            </button>
                          </div>
                        </div>
                      ) : (
                        <>
                          {isQrProcessing && !hasQrConfig && (
                            <div className="bg-purple-950/40 p-4 rounded-xl border border-purple-900/60 text-center mb-3 animate-fadeIn">
                              <i className="fa-solid fa-triangle-exclamation text-purple-400 text-lg mb-1.5 block"></i>
                              <p className="text-[9px] font-black text-purple-300 uppercase tracking-widest">Configuración Requerida</p>
                              <p className="text-[7.5px] text-purple-400 mt-0.5 uppercase font-bold leading-normal">El Gerente debe configurar las credenciales de Bancard en Opciones para habilitar este cobro.</p>
                            </div>
                          )}

                          {(!isQrProcessing || hasQrConfig) && (
                            <div className="relative mb-3">
                              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xl font-black text-slate-500">$</span>
                              <input 
                                type="text" inputMode="numeric" value={amountInput} onChange={(e) => setAmountInput(e.target.value)}
                                className="w-full bg-slate-950 border border-emerald-900 text-emerald-400 text-2xl font-black text-center py-4 rounded-xl outline-none"
                              />
                            </div>
                          )}
                          <div className="flex gap-2">
                             {(!isQrProcessing || hasQrConfig) ? (
                               <button
                                 disabled={isProcessing}
                                 onClick={() => {
                                   const finalAmount = parseAmount(amountInput);
                                   const threshold = 500;
                                   if (finalAmount > 0 && finalAmount < threshold) {
                                     if (!confirm(`¡ATENCIÓN!\n\nHas ingresado un monto de ${formatCurrency(finalAmount, state.settings)}.\n\n¿Estás SEGURO de que este monto es correcto y no quisiste poner un número mayor?`)) {
                                       return;
                                     }
                                   }

                                   if (isQrProcessing) {
                                     handleGenerateQrMobile(client.id);
                                   } else {
                                     handleAction(client.id, CollectionLogType.PAYMENT);
                                   }
                                 }}
                                 className={`flex-1 ${isQrProcessing ? 'bg-purple-600 hover:bg-purple-700 shadow-[0_0_15px_rgba(147,51,234,0.3)]' : 'bg-emerald-600 hover:bg-emerald-700 shadow-[0_0_15px_rgba(16,185,129,0.3)]'} text-white font-black py-4 rounded-xl text-[10px] uppercase tracking-widest active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2`}
                               >
                                 {isQrProcessing ? (
                                   <>
                                     <i className="fa-solid fa-qrcode"></i> {lang === 'fr' ? 'Générer QR de Paiement' : lang === 'pt' ? 'Gerar QR de Cobrança' : 'Generar QR de Cobro'}
                                   </>
                                 ) : (
                                   lang === 'fr' ? 'CONFIRMER REGISTRE' : lang === 'pt' ? 'CONFIRMAR REGISTRO' : 'CONFIRMAR REGISTRO'
                                 )}
                               </button>
                             ) : null}
                             <button onClick={() => resetUI()} className="w-14 bg-slate-800 text-slate-400 font-black rounded-xl text-center active:scale-95"><i className="fa-solid fa-xmark"></i></button>
                          </div>
                        </>
                      )}
                    </>
                  ) : (
                    <div className="bg-slate-950 p-4 rounded-xl text-center mb-4">
                       <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{lang === 'fr' ? 'Aucun Crédit Actif' : lang === 'pt' ? 'Sem Créditos Ativos' : 'Sin Créditos Activos'}</p>
                       <p className="text-[8px] text-slate-600 mt-1 uppercase">{lang === 'fr' ? 'Ce client n\'a aucune dette en attente.' : lang === 'pt' ? 'Este cliente não possui dívida pendente atualmente.' : 'Este cliente no posee deuda pendiente actualmente.'}</p>
                       <button onClick={() => resetUI()} className="mt-3 w-full py-2 bg-slate-800 text-slate-400 rounded-lg text-[8px] font-black uppercase tracking-widest">{lang === 'fr' ? 'Fermer' : 'Cerrar'}</button>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-2 mt-2">
                     {loan && (
                       <>
                         <button disabled={isProcessing} onClick={() => handleAction(client.id, CollectionLogType.NO_PAGO)} className="bg-red-900/30 text-red-400 border border-red-900/50 py-3 rounded-xl text-[8px] uppercase tracking-widest font-black active:scale-95 text-center flex items-center justify-center">{lang === 'fr' ? 'NON-PAIEMENT' : lang === 'pt' ? 'NÃO PAGO' : 'NO PAGO'}</button>
                         <button onClick={() => setShowHistoryFor(showHistoryFor === client.id ? null : client.id)} className="bg-slate-800 text-slate-300 border border-slate-700 py-3 rounded-xl text-[8px] uppercase tracking-widest font-black active:scale-95 text-center flex items-center justify-center gap-1">
                            <i className="fa-solid fa-clock-rotate-left"></i> {showHistoryFor === client.id ? (lang === 'fr' ? 'CACHER' : 'OCULTAR') : (lang === 'fr' ? 'HISTORIQUE' : lang === 'pt' ? 'HISTÓRICO' : 'HISTORIAL')}
                         </button>
                       </>
                     )}
                     <a href={client.domicilioLocation?.lat ? `https://www.google.com/maps/search/?api=1&query=${client.domicilioLocation.lat},${client.domicilioLocation.lng}` : `https://www.google.com/maps/search/?api=1&query=${client.address}`} target="_blank" rel="noreferrer" className="bg-blue-900/30 text-blue-400 border border-blue-900/50 py-3 rounded-xl text-[8px] uppercase tracking-widest font-black flex items-center justify-center gap-1 active:scale-95 text-center px-1"><i className="fa-solid fa-house"></i> GPS {lang === 'fr' ? 'MAISON' : 'CASA'}</a>
                     <a href={client.location?.lat ? `https://www.google.com/maps/search/?api=1&query=${client.location.lat},${client.location.lng}` : `https://www.google.com/maps/search/?api=1&query=${client.workCity || ''} ${client.workStreetMain || ''}`} target="_blank" rel="noreferrer" className="bg-indigo-900/30 text-indigo-400 border border-indigo-900/50 py-3 rounded-xl text-[8px] uppercase tracking-widest font-black flex items-center justify-center gap-1 active:scale-95 text-center px-1"><i className="fa-solid fa-briefcase"></i> GPS {lang === 'fr' ? 'TRAVAIL' : 'NEG.'}</a>
                  </div>
                </div>

                {/* Historial Reciente Expandible */}
                {showHistoryFor === client.id && loan && (
                  <div className="mt-4 pt-4 border-t border-slate-800 animate-fadeIn">
                     <h4 className="text-[9px] font-black uppercase tracking-widest text-slate-500 mb-3"><i className="fa-solid fa-clock-rotate-left mr-1"></i> Historial Reciente (Últimos 4)</h4>
                     <div className="space-y-2">
                        {state.collectionLogs
                          .filter(l => l.loanId === loan.id && (l.type === CollectionLogType.PAYMENT || l.type === CollectionLogType.NO_PAGO) && !l.deletedAt)
                          .sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                          .slice(0, 4)
                          .map(log => (
                             <div key={log.id} className="flex justify-between items-center bg-slate-950 p-3 rounded-xl border border-slate-800 shadow-inner">
                               <div>
                                 <p className="text-[10px] font-black text-slate-300">{new Date(log.date).toLocaleDateString('es-ES', { day:'2-digit', month:'2-digit', year:'numeric' })}</p>
                                 <p className="text-[8px] font-bold text-slate-500 uppercase">{new Date(log.date).toLocaleTimeString('es-ES', { hour:'2-digit', minute:'2-digit'})}</p>
                               </div>
                               <div className="text-right">
                                 {log.type === CollectionLogType.NO_PAGO ? (
                                    <p className="text-[10px] font-black text-red-400 uppercase tracking-widest bg-red-900/20 px-2 py-1 rounded">No Pago</p>
                                 ) : (
                                    <p className="text-sm font-mono font-black text-emerald-400">{formatCurrency(log.amount || 0, state.settings)}</p>
                                 )}
                               </div>
                             </div>
                        ))}
                        {state.collectionLogs.filter(l => l.loanId === loan.id && (l.type === CollectionLogType.PAYMENT || l.type === CollectionLogType.NO_PAGO) && !l.deletedAt).length === 0 && (
                          <div className="text-center p-3 text-slate-500 text-[10px] uppercase font-bold">Sin pagos registrados</div>
                        )}
                     </div>
                  </div>
                )}

                {!isSelected && (
                  <button onClick={() => handleOpenPayment(client.id, loan ? loan.installmentValue : 0)} className="w-full mt-4 bg-emerald-950/50 hover:bg-emerald-900 border border-emerald-900 text-emerald-500 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all">
                    {lang === 'fr' ? 'GÉRER' : lang === 'pt' ? 'GERENCIAR' : 'GESTIONAR'}
                  </button>
                )}
              </div>
            );
          })}
        </div>

        {/* Paginación por Hojas */}
        {totalPages > 1 && (
          <div className="mt-8 flex flex-col items-center gap-4 animate-fadeIn">
            <div className="flex items-center gap-2">
              <button 
                disabled={currentPage === 1}
                onClick={() => handlePageChange(currentPage - 1)}
                className={`w-12 h-12 rounded-2xl flex items-center justify-center border transition-all ${currentPage === 1 ? 'bg-slate-900 border-slate-800 text-slate-700' : 'bg-slate-800 border-slate-700 text-white active:scale-95'}`}
              >
                <i className="fa-solid fa-chevron-left text-xs"></i>
              </button>
              
              <div className="bg-slate-900 border border-slate-800 px-6 py-2.5 rounded-2xl flex items-center gap-3">
                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Hoja</span>
                <span className="text-lg font-black text-emerald-500 font-mono">{currentPage}</span>
                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">de {totalPages}</span>
              </div>

              <button 
                disabled={currentPage === totalPages}
                onClick={() => handlePageChange(currentPage + 1)}
                className={`w-12 h-12 rounded-2xl flex items-center justify-center border transition-all ${currentPage === totalPages ? 'bg-slate-900 border-slate-800 text-slate-700' : 'bg-slate-800 border-slate-700 text-white active:scale-95'}`}
              >
                <i className="fa-solid fa-chevron-right text-xs"></i>
              </button>
            </div>

            {/* Accesos Rápidos a Hojas (Si son pocas) */}
            <div className="flex flex-wrap justify-center gap-1.5 max-w-xs">
               {Array.from({ length: totalPages }).map((_, i) => (
                 <button
                    key={i}
                    onClick={() => handlePageChange(i + 1)}
                    className={`w-8 h-8 rounded-lg text-[9px] font-black transition-all ${currentPage === i + 1 ? 'bg-emerald-600 text-white shadow-lg' : 'bg-slate-900 text-slate-500 border border-slate-800'}`}
                 >
                   {i + 1}
                 </button>
               )).slice(Math.max(0, currentPage - 3), Math.min(totalPages, currentPage + 2))}
            </div>
          </div>
        )}

        {/* Modal de Éxito de Cobro (Mismo componente visual que CollectionRoute) */}
        {receipt && (
          <div className="fixed inset-0 bg-slate-950/98 flex items-center justify-center z-[160] p-4 overflow-y-auto">
            <div className="bg-slate-900 border border-slate-800 rounded-[2rem] text-center max-w-sm w-full animate-scaleIn shadow-2xl overflow-hidden mt-10">
              <div className="p-6 md:p-8">
                <div className="w-16 h-16 bg-emerald-900/30 text-emerald-400 rounded-2xl flex items-center justify-center mx-auto mb-6 text-3xl shadow-xl border border-emerald-900/50">
                  <i className="fa-solid fa-check-double"></i>
                </div>
                <h3 className="text-xl font-black text-white mb-6 uppercase tracking-tighter">{((t as any).receipt?.successMsg) || '¡Gestión Exitosa!'}</h3>
                <div className="bg-slate-950 p-4 shrink-0 rounded-xl font-mono text-[9px] text-left mb-6 max-h-48 overflow-y-auto border border-slate-800 text-slate-300 font-black whitespace-pre-wrap leading-relaxed shadow-inner">
                  {receipt}
                </div>
                <div className="flex flex-col gap-2">
                  <button onClick={resetUI} className="w-full py-4 bg-slate-800 text-white rounded-xl font-black uppercase text-[10px] tracking-widest shadow-2xl active:scale-95 transition-all">{((t as any).receipt?.finish) || 'Finalizar y Salir'}</button>
                  <button onClick={async () => { const { printText } = await import('../services/bluetoothPrinterService'); printText(receipt || '').catch(e => alert("Error: " + e)); }} className="w-full py-4 bg-purple-600 text-white rounded-xl font-black uppercase text-[10px] tracking-widest shadow-xl active:scale-95 transition-all">
                    <i className="fa-solid fa-print mr-2"></i> {((t as any).receipt?.reprint) || 'Re-Imprimir Ticket'}
                  </button>
                  <button disabled={isSharing} onClick={handleShareReceiptPDF} className={`w-full py-4 bg-emerald-700 text-white rounded-xl font-black uppercase text-[10px] tracking-widest shadow-xl active:scale-95 transition-all flex items-center justify-center gap-2 ${isSharing ? 'opacity-50' : ''}`}>
                    {isSharing ? <i className="fa-solid fa-spinner animate-spin"></i> : <i className="fa-brands fa-whatsapp"></i>} ENVIAR POR WHATSAPP (PDF)
                  </button>
                  <button disabled={isSharing} onClick={handleShareReceiptPhoto} className={`w-full py-4 bg-emerald-600 text-white rounded-xl font-black uppercase text-[10px] tracking-widest shadow-xl active:scale-95 transition-all flex items-center justify-center gap-2 ${isSharing ? 'opacity-50' : ''}`}>
                    {isSharing ? <i className="fa-solid fa-spinner animate-spin"></i> : <i className="fa-solid fa-camera"></i>} ENVIAR FOTO DE RECIBO
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* DOM Oculto para HTML2Canvas */}
        {receipt && (
          <div id="receipt-container-hidden-route" style={{ position: 'fixed', left: '-5000px', top: '0', opacity: '0', pointerEvents: 'none', zIndex: -1, background: 'white', width: '400px', padding: '20px' }}>
            <div ref={receiptCardRef} className="bg-white p-6 border-2 border-slate-900 rounded-lg text-black font-mono text-sm leading-relaxed whitespace-pre-wrap">
              <div className="text-center mb-4">
                <h2 className="text-xl font-black uppercase">{state.settings.companyName || 'ANEXO'}</h2>
                <p className="text-[10px] uppercase font-bold text-slate-500">{state.settings.companyAlias || ''}</p>
                <div className="h-px bg-slate-900 my-2"></div>
              </div>
              {convertReceiptForWhatsApp(receipt || '')}
              <div className="mt-4 pt-4 border-t border-dashed border-slate-400 text-center">
                <p className="text-[10px] font-black uppercase">¡Gracias por su confianza!</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </PullToRefresh>
  );
};
export default MobileCollectorMode;
