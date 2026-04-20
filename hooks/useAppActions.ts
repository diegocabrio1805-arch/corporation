import { AppState, User, Role, AppSettings, Client, Loan, CollectionLog, CollectionLogType, LoanStatus, PaymentStatus, PaymentRecord, CommissionBracket, Expense } from '../types';
import { supabase } from '../utils/supabaseClient';
import { Preferences } from '@capacitor/preferences';
import { calculateTotalPaidFromLogs, formatCurrency } from '../utils/helpers';
import { connectToPrinter } from '../services/bluetoothPrinterService';
import React from 'react';
export const useAppActions = (
  state: AppState,
  setState: React.Dispatch<React.SetStateAction<AppState>>,
  setActiveTab: (tab: string) => void,
  sync: any // From useAppSyncEngine
) => {
  const { pullData, handleRealtimeData, pushUser, pushSettings, handleForceSync, pushClient, pushLoan, deleteRemoteLoan, pushLog, pushPayment, pushBulk, deleteRemoteLog, deleteRemotePayment, deleteRemoteClient, addToQueue, addToQueueBulk, pushRenewal } = sync;

  const handleLogin = (user: User) => {
    const normalizedRole = (user.role as string).toLowerCase() === 'admin' ? Role.ADMIN : user.role;
    const normalizedUser = { ...user, role: normalizedRole };
    setState(prev => ({ ...prev, currentUser: normalizedUser }));
    setActiveTab(normalizedRole === Role.COLLECTOR ? 'route' : 'dashboard');
    
    setTimeout(() => {
      pullData(false).then((newData: any) => {
        if (newData) handleRealtimeData(newData);
      });
    }, 500);

    // Intentamos conectar a la impresora después de un breve delay para evitar solapamiento con permisos de GPS
    setTimeout(() => {
      connectToPrinter(undefined).catch(() => { });
    }, 2000);
  };

  const handleLogout = async () => {
    setState((prev: AppState) => ({ ...prev, currentUser: null }));
    if (navigator.onLine) await supabase.auth.signOut();
    await Preferences.remove({ key: 'NATIVE_CURRENT_USER' });
  };

  const addUser = async (user: User) => {
    const newUser = { ...user, managedBy: user.managedBy || (state.currentUser?.role === Role.MANAGER || state.currentUser?.role === Role.ADMIN ? state.currentUser.id : undefined) };

    if (newUser.role === Role.MANAGER) {
      const defaultSettings: AppSettings = {
        language: state.settings.language,
        country: state.settings.country,
        numberFormat: state.settings.numberFormat,
        companyName: 'A COMPLETAR',
        companyAlias: 'A COMPLETAR',
        contactPhone: 'A COMPLETAR',
        companyIdentifier: 'A COMPLETAR',
        shareLabel: 'A COMPLETAR',
        shareValue: 'A COMPLETAR',
        receiptPrintMargin: 2
      };

      setState(prev => ({
        ...prev,
        branchSettings: { ...(prev.branchSettings || {}), [newUser.id]: defaultSettings }
      }));
      await pushSettings(newUser.id, defaultSettings);
    }

    await pushUser(newUser);
    setState(prev => ({ ...prev, users: [...prev.users, newUser] }));
    await handleForceSync(false);
  };

  const updateUser = async (updatedUser: User) => {
    const userWithStamp = { ...updatedUser, updated_at: new Date().toISOString() };
    setState(prev => ({ ...prev, users: prev.users.map(u => u.id === userWithStamp.id ? userWithStamp : u), currentUser: state.currentUser?.id === userWithStamp.id ? userWithStamp : state.currentUser }));
    pushUser(userWithStamp);

    if (navigator.onLine) {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          const oldUser = state.users.find(u => u.id === updatedUser.id);
          const usernameChanged = oldUser && oldUser.username !== updatedUser.username;
          const passwordChanged = oldUser && oldUser.password !== updatedUser.password;

          if (usernameChanged || passwordChanged) {
            const payload: any = { userId: updatedUser.id };
            if (usernameChanged) payload.newUsername = updatedUser.username;
            if (passwordChanged) payload.newPassword = updatedUser.password;

            await supabase.functions.invoke('update-auth-user', { body: payload });
          }
        }
      } catch (authSyncErr) {
        console.error('[updateUser] Auth sync error:', authSyncErr);
      }
    }

    handleForceSync(false);
  };

  const deleteUser = async (userId: string) => {
    const deletedTimestamp = new Date().toISOString();
    const usersToDelete = state.users.filter(u => u.id === userId || u.managedBy === userId);
    usersToDelete.forEach(u => {
      pushUser({ ...u, deletedAt: deletedTimestamp, updated_at: deletedTimestamp } as any);
    });

    setState(prev => ({ ...prev, users: prev.users.filter(u => u.id !== userId && u.managedBy !== userId) }));
    await handleForceSync(false);
  };

  const internalGetBranchId = (user: User | null): string => {
    if (!user) return 'none';
    if (user.role === Role.ADMIN || user.role === Role.MANAGER) return user.id;
    return user.managedBy || 'none';
  };

  const updateSettings = async (newSettings: AppSettings) => {
    const branchId = internalGetBranchId(state.currentUser);
    setState(prev => ({ ...prev, settings: newSettings, branchSettings: { ...(prev.branchSettings || {}), [branchId]: newSettings } }));
    pushSettings(branchId, newSettings);
    handleForceSync(false);
  };

  const addClient = async (client: Client, loan?: Loan) => {
    const branchId = internalGetBranchId(state.currentUser);
    const newClient = { ...client, branchId, isActive: true, createdAt: new Date().toISOString(), updated_at: new Date().toISOString() };
    setState(prev => ({ ...prev, clients: [...prev.clients, newClient] }));
    pushClient(newClient);
    if (loan) addLoan(loan);
    handleForceSync(false);
  };

  const addLoan = async (loan: Loan) => {
    const branchId = internalGetBranchId(state.currentUser);
    const newLoan = { ...loan, branchId, updated_at: new Date().toISOString() };
    setState(prev => ({ ...prev, loans: [newLoan, ...prev.loans] }));
    pushLoan(newLoan);
    handleForceSync(false);
  };

  const updateClient = async (updatedClient: Client) => {
    const clientWithStamp = { ...updatedClient, updated_at: new Date().toISOString() };
    setState(prev => ({ ...prev, clients: prev.clients.map(c => c.id === clientWithStamp.id ? clientWithStamp : c) }));
    pushClient(clientWithStamp);
    handleForceSync(false);
  };

  const deleteClient = async (clientId: string) => {
    const client = state.clients.find(c => c.id === clientId);
    if (!client) return;

    const updatedClient = { ...client, deletedAt: new Date().toISOString() };
    await updateClient(updatedClient);
    
    // Trigger the actual remote deletion to ensure it's removed from the backend
    // This action also creates the necessary audit logs
    await deleteRemoteClientAction(clientId);
  };

  const updateLoan = async (updatedLoan: Loan) => {
    const loanWithStamp = { ...updatedLoan, updated_at: new Date().toISOString() };
    setState(prev => ({ ...prev, loans: prev.loans.map(l => l.id === loanWithStamp.id ? loanWithStamp : l) }));
    pushLoan(loanWithStamp);
    handleForceSync(false);
  };

  const renewLoan = async (newLoan: Loan, previousLoanIds: string[]) => {
    const branchId = internalGetBranchId(state.currentUser);
    const stampedNewLoan = { 
      ...newLoan, 
      branchId, 
      updated_at: new Date().toISOString() 
    };

    // 1. Actualización Local (Optimistic UI)
    setState(prev => ({
      ...prev,
      loans: [
        stampedNewLoan,
        ...prev.loans.map(l => 
          previousLoanIds.includes(l.id) ? { ...l, status: LoanStatus.PAID, updated_at: new Date().toISOString() } : l
        )
      ]
    }));

    // 2. Sincronización Blindada (Atómica)
    await pushRenewal(stampedNewLoan, previousLoanIds);
    
    // 3. Forzar sincronización
    handleForceSync(false, "RENOVACIÓN BLINDADA PROCESADA");
  };

  const recalculateAllLoansBalances = async () => {
    try {
      const updatedLoans = state.loans.map(loan => {
        const totalPaid = calculateTotalPaidFromLogs(loan, state.collectionLogs);
        const balance = Math.max(0, loan.totalAmount - totalPaid);
        const isPaid = balance <= 0;
        const status = isPaid ? LoanStatus.PAID : loan.status;

        return {
          ...loan,
          totalPaid,
          balance,
          status,
          updatedAt: new Date().toISOString()
        };
      });

      setState(prev => ({ ...prev, loans: updatedLoans }));
      alert('Todos los saldos han sido recalculados y sincronizados correctamente.');
    } catch (error) {
      console.error('Error en recalculación global:', error);
      alert('No se pudo completar la recalculación global.');
    }
  };

  const recalculateLoanStatus = async (loanId: string, providedLogs?: CollectionLog[]) => {
    let finalUpdatedLoan: Loan | null = null;
    
    setState(prev => {
      const loan = prev.loans.find(l => l.id === loanId);
      if (!loan) return prev;

      const useLogs = providedLogs || prev.collectionLogs;
      const totalPaid = calculateTotalPaidFromLogs(loan, useLogs);
      const balance = Math.round(Math.max(0, loan.totalAmount - totalPaid) * 100) / 100;

      const newInstallments = (loan.installments || []).map(i => ({ ...i, paidAmount: 0, status: PaymentStatus.PENDING }));
      let totalToApply = totalPaid;
      for (let i = 0; i < newInstallments.length && totalToApply > 0.01; i++) {
        const inst = newInstallments[i];
        const appliedToInst = Math.round(Math.min(totalToApply, inst.amount) * 100) / 100;
        inst.paidAmount = appliedToInst;
        totalToApply = Math.round((totalToApply - appliedToInst) * 100) / 100;
        inst.status = inst.paidAmount >= inst.amount - 0.01 ? PaymentStatus.PAID : (inst.paidAmount > 0 ? PaymentStatus.PARTIAL : PaymentStatus.PENDING);
      }

      const isPaid = balance <= 0.01;
      let newStatus = loan.status;
      if (isPaid) {
        newStatus = LoanStatus.PAID;
      } else if (loan.status === LoanStatus.PAID) {
        newStatus = LoanStatus.ACTIVE;
      }

      finalUpdatedLoan = {
        ...loan,
        totalPaid,
        balance,
        installments: newInstallments,
        status: newStatus,
        updatedAt: new Date().toISOString()
      };

      return { ...prev, loans: prev.loans.map(l => l.id === loanId ? finalUpdatedLoan! : l) };
    });

    if (finalUpdatedLoan) {
      await pushLoan(finalUpdatedLoan);
    }
    return finalUpdatedLoan;
  };

  const deleteLoan = async (loanId: string) => {
    const loan = state.loans.find(l => l.id === loanId);
    if (!loan) return;

    const client = state.clients.find(c => c.id === loan.clientId);
    const collector = state.users.find(u => u.id === loan.collectorId);
    const deletedByUser = state.users.find(u => u.id === state.currentUser?.id);
    
    const newAuditLog: CollectionLog = {
      id: crypto.randomUUID(),
      loanId: loan.id,
      clientId: loan.clientId,
      branchId: state.currentUser?.managedBy || state.currentUser?.id,
      type: CollectionLogType.DELETED_PAYMENT,
      amount: loan.totalAmount,
      date: new Date().toISOString(),
      location: { lat: 0, lng: 0 },
      recordedBy: state.currentUser?.id,
      collectorId: loan.collectorId,
      notes: JSON.stringify({
        tipo: 'CREDITO_ELIMINADO',
        clienteNombre: client ? client.name : 'Desconocido',
        cobradorNombre: collector ? collector.name : 'Desconocido',
        eliminadoPorNombre: deletedByUser?.name || 'Administrador',
        montoTotal: loan.totalAmount,
        capital: loan.principal,
        cuotas: loan.totalInstallments,
        frecuencia: loan.frequency,
        estado: loan.status,
        fechaCredito: loan.createdAt
      })
    };

    setState(prev => ({ 
      ...prev, 
      loans: prev.loans.filter(l => l.id !== loanId),
      collectionLogs: [newAuditLog, ...prev.collectionLogs]
    }));
    deleteRemoteLoan(loanId);
    pushLog(newAuditLog);
    handleForceSync(false);
  };

  const addCollectionAttempt = async (log: CollectionLog, skipSync: boolean = false) => {
    const branchId = internalGetBranchId(state.currentUser);
    const newLog = { ...log, branchId, recordedBy: state.currentUser?.id, updated_at: new Date().toISOString() };

    // NO llamar pushLog aqui todavía - se llama abajo después del setState para garantizar
    // que el estado local esté actualizado antes de intentar sincronizar

    let updatedPayments = [...state.payments];
    const newPaymentsForSync: PaymentRecord[] = [];

    if (newLog.type === CollectionLogType.OPENING) {
      setState(prev => ({ ...prev, collectionLogs: [newLog, ...prev.collectionLogs] }));
      pushLog(newLog); // Solo para OPENING que retorna inmediatamente
      if (!skipSync) handleForceSync(true);
      return;
    }

    if (newLog.type === CollectionLogType.PAYMENT && newLog.amount && newLog.loanId) {
      let totalToApply = Math.round(newLog.amount * 100) / 100;
      const loan = state.loans.find(l => l.id === newLog.loanId);
      
      if (loan) {
        const newInstallments = (loan.installments || []).map(i => ({ ...i }));

        for (let i = 0; i < newInstallments.length && totalToApply > 0.01; i++) {
          const inst = newInstallments[i];
          if (inst.status === PaymentStatus.PAID) continue;

          const remainingInInst = Math.round((inst.amount - (inst.paidAmount || 0)) * 100) / 100;
          const appliedToInst = Math.min(totalToApply, remainingInInst);
          inst.paidAmount = Math.round(((inst.paidAmount || 0) + appliedToInst) * 100) / 100;
          totalToApply = Math.round((totalToApply - appliedToInst) * 100) / 100;
          inst.status = inst.paidAmount >= inst.amount - 0.01 ? PaymentStatus.PAID : PaymentStatus.PARTIAL;

          const pRec: PaymentRecord = {
            id: `pay-${newLog.id}-${inst.number}`,
            loanId: newLog.loanId,
            clientId: newLog.clientId,
            collectorId: state.currentUser?.id,
            branchId: loan.branchId || branchId,
            amount: appliedToInst,
            date: newLog.date,
            installmentNumber: inst.number,
            isVirtual: newLog.isVirtual || false,
            isRenewal: newLog.isRenewal || false,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          };

          newPaymentsForSync.push(pRec);
          updatedPayments.push(pRec);
        }
      }
    }

    // Actualizar logs e historiales EN EL ESTADO
    setState(prev => ({ ...prev, payments: updatedPayments, collectionLogs: [newLog, ...prev.collectionLogs] }));

    if (newPaymentsForSync.length > 0) {
      for (const p of newPaymentsForSync) pushPayment(p);
    }
    pushLog(newLog);

    // Delegar el cálculo numérico total del balance a la rutina blindada
    if (newLog.loanId) {
      setTimeout(() => recalculateLoanStatus(newLog.loanId!), 0);
    }

    if (!skipSync) handleForceSync(true);
  };

  const deleteCollectionLog = async (logId: string) => {
    if (state.currentUser?.role === Role.COLLECTOR) {
      alert("ERROR: No tienes permisos para eliminar registros.");
      return;
    }

    const logToDelete = state.collectionLogs.find(l => l.id === logId);
    if (!logToDelete) return;

    if (!confirm(`¿ESTÁ SEGURO DE ELIMINAR EL REGISTRO DE ${logToDelete.type === CollectionLogType.PAYMENT ? 'PAGO' : 'GESTIÓN'} POR ${formatCurrency(logToDelete.amount || 0, state.settings)}?`)) {
      return;
    }

    try {
      // --- Guardado de Auditoría Completa para Pagos Eliminados ---
      let newAuditLog: CollectionLog | null = null;
      if (logToDelete.type === CollectionLogType.PAYMENT) {
        const client = state.clients.find(c => c.id === logToDelete.clientId);
        const collector = state.users.find(u => u.id === (logToDelete.collectorId || logToDelete.recordedBy));
        const deletedByUser = state.users.find(u => u.id === state.currentUser?.id);
        const loan = state.loans.find(l => l.id === logToDelete.loanId);

        newAuditLog = {
          id: crypto.randomUUID(),
          loanId: logToDelete.loanId,
          clientId: logToDelete.clientId,
          branchId: state.currentUser?.managedBy || state.currentUser?.id,
          type: CollectionLogType.DELETED_PAYMENT,
          amount: logToDelete.amount || 0,
          date: new Date().toISOString(),
          location: { lat: 0, lng: 0 },
          recordedBy: state.currentUser?.id,
          collectorId: logToDelete.collectorId || logToDelete.recordedBy,
          notes: JSON.stringify({
            tipo: 'PAGO_ELIMINADO',
            clienteNombre: client ? client.name : 'Desconocido',
            cobradorNombre: collector ? collector.name : 'Desconocido',
            eliminadoPorNombre: deletedByUser?.name || 'Administrador',
            montoPago: logToDelete.amount || 0,
            fechaOriginalPago: logToDelete.date,
            creditoId: logToDelete.loanId,
            capitalCredito: loan ? loan.principal : 0
          })
        };
      }

      let logsForRecalc: CollectionLog[] = [];

      setState(prev => {
        const updatedLogs = prev.collectionLogs.filter(l => l.id !== logId);
        if (newAuditLog) updatedLogs.push(newAuditLog);
        logsForRecalc = updatedLogs;

        const updatedPayments = prev.payments.filter(p => !p.id.startsWith(`pay-${logId}-`));

        return { ...prev, collectionLogs: updatedLogs, payments: updatedPayments };
      });

      if (logToDelete.loanId) {
        // Ejecución asíncrona, no bloquea el setState
        setTimeout(() => recalculateLoanStatus(logToDelete.loanId!, logsForRecalc), 0);
      }

      deleteRemoteLog(logId);
      const related = state.payments.filter(p => p.id.startsWith(`pay-${logId}-`));
      for (const p of related) deleteRemotePayment(p.id);

      if (newAuditLog) {
        pushLog(newAuditLog);
      }

      // CRITICAL: Force sync so deletions are pushed to the server immediately
      await handleForceSync(true, "Pago eliminado y sincronizado");

    } catch (err: any) {
      console.error("Critical error deleting log:", err);
      alert("Error al eliminar el registro.");
    }
  };

  const updateCollectionLog = async (logId: string, newAmount: number) => {
    try {
      const logToUpdate = state.collectionLogs.find(l => l.id === logId);
      if (!logToUpdate) return;

      const updatedLogs = state.collectionLogs.map(l =>
        l.id === logId ? { ...l, amount: newAmount, updated_at: new Date().toISOString() } : l
      );

      setState(prev => ({ ...prev, collectionLogs: updatedLogs }));

      if (logToUpdate.loanId) {
        await recalculateLoanStatus(logToUpdate.loanId, updatedLogs);
      }

      supabase.from('collection_logs').update({ amount: newAmount, updated_at: new Date().toISOString() }).eq('id', logId);

      if (logToUpdate.type === CollectionLogType.PAYMENT) {
        const updatedPayments = state.payments.map(p =>
          p.id.startsWith(`pay-${logId}-`) ? { ...p, amount: newAmount, updated_at: new Date().toISOString() } : p
        );
        setState(prev => ({ ...prev, payments: updatedPayments }));
        supabase.from('payments').update({ amount: newAmount, updated_at: new Date().toISOString() }).eq('logId', logId);
      }
    } catch (error: any) {
      console.error('Error updating collection log:', error);
      alert('Error al actualizar el cobro');
    }
  };

  const addBulkData = async (clients: Client[], loans: Loan[], logs: CollectionLog[]) => {
    const branchId = internalGetBranchId(state.currentUser);
    const timestamp = new Date().toISOString();

    // Helper para generar IDs únicos robustos
    const generateId = () => {
        if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
        return Math.random().toString(36).substring(2, 12) + Date.now().toString(36);
    };

    const newClients = clients.map(c => ({ ...c, branchId: c.branchId || branchId, createdAt: c.createdAt || timestamp, updated_at: timestamp }));
    const newLoans = loans.map(l => ({ ...l, branchId: l.branchId || branchId, updated_at: timestamp }));
    const newLogs = logs.map(l => ({ ...l, branchId: l.branchId || branchId, recordedBy: state.currentUser?.id, updated_at: timestamp }));

    const allNewPayments: PaymentRecord[] = [];
    const updatedLoansWithPayments = newLoans.map(loan => {
      // Evitar aplicar duplicadamente los logs de migración inicial sobre las cuotas (porque excelHelper ya lo hace internamente)
      const loanLogs = newLogs.filter(log => log.loanId === loan.id && log.type === CollectionLogType.PAYMENT && !log.id.startsWith("LOG-MIG-"));
      let totalToApply = loanLogs.reduce((sum, log) => sum + (log.amount || 0), 0);
      
      const newInstallments = (loan.installments || []).map(i => ({ ...i }));
      
      if (totalToApply > 0) {
        for (let i = 0; i < newInstallments.length && totalToApply > 0.01; i++) {
          const inst = newInstallments[i];
          if (inst.status === PaymentStatus.PAID) continue;

          const remainingInInst = Math.round((inst.amount - (inst.paidAmount || 0)) * 100) / 100;
          const appliedToInst = Math.min(totalToApply, remainingInInst);
          inst.paidAmount = Math.round(((inst.paidAmount || 0) + appliedToInst) * 100) / 100;
          totalToApply = Math.round((totalToApply - appliedToInst) * 100) / 100;
          inst.status = inst.paidAmount >= inst.amount - 0.01 ? PaymentStatus.PAID : PaymentStatus.PARTIAL;

          allNewPayments.push({
            id: `pay-bulk-${generateId()}`, // FIXED: ID único real
            loanId: loan.id,
            clientId: loan.clientId,
            collectorId: loan.collectorId,
            branchId: loan.branchId || branchId,
            amount: appliedToInst,
            date: loan.createdAt,
            installmentNumber: inst.number,
            isVirtual: false,
            isRenewal: false,
            created_at: timestamp,
            updated_at: timestamp
          });
        }
      }

      const allPaid = newInstallments.length > 0 && newInstallments.every(inst => inst.status === PaymentStatus.PAID);
      const totalPaidSoFar = newInstallments.reduce((sum, inst) => sum + (inst.paidAmount || 0), 0);
      const currentBalance = Math.round((loan.totalAmount - totalPaidSoFar) * 100) / 100;

      return { 
        ...loan, 
        installments: newInstallments, 
        status: allPaid ? LoanStatus.PAID : LoanStatus.ACTIVE,
        totalPaid: totalPaidSoFar,
        balance: currentBalance,
        updatedAt: timestamp
      };
    });

    // 1. Actualizar estado UI de un golpe de manera segura (Merge para no duplicar si los IDs ya existen)
    setState(prev => {
        const mergedClients = [...prev.clients];
        newClients.forEach(nc => {
            const idx = mergedClients.findIndex(c => c.id === nc.id);
            if (idx >= 0) mergedClients[idx] = nc;
            else mergedClients.push(nc);
        });

        const mergedLoans = [...prev.loans];
        updatedLoansWithPayments.forEach(nl => {
            const idx = mergedLoans.findIndex(l => l.id === nl.id);
            if (idx >= 0) mergedLoans[idx] = nl;
            else mergedLoans.push(nl);
        });

        const mergedLogs = [...prev.collectionLogs];
        newLogs.forEach(nl => {
            const idx = mergedLogs.findIndex(l => l.id === nl.id);
            if (idx >= 0) mergedLogs[idx] = nl;
            else mergedLogs.push(nl);
        });

        return {
            ...prev,
            clients: mergedClients,
            loans: mergedLoans,
            payments: [...prev.payments, ...allNewPayments],
            collectionLogs: mergedLogs
        };
    });

    // 2. Persistir en cola de sincronización (BULK para evitar O(N^2))
    pushBulk(newClients, updatedLoansWithPayments, allNewPayments, newLogs);

    // 3. Disparar sincronización forzada después de un breve delay
    setTimeout(() => {
        handleForceSync(false, "Importación masiva enviada a la nube");
    }, 500);

    return {
        clientsCount: newClients.length,
        loansCount: updatedLoansWithPayments.length,
        logsCount: newLogs.length,
        paymentsCount: allNewPayments.length
    };
  };

  const updateCollectionLogNotes = (logId: string, notes: string) => {
    setState(prev => ({
      ...prev,
      collectionLogs: prev.collectionLogs.map(l => l.id === logId ? { ...l, notes } : l)
    }));
  };

  const addExpense = (expense: Expense) => {
    const branchId = internalGetBranchId(state.currentUser);
    const newExpense = { ...expense, branchId, addedBy: state.currentUser?.id };
    setState(prev => ({ ...prev, expenses: [newExpense, ...prev.expenses] }));
    addToQueue('ADD_EXPENSE', newExpense);
    handleForceSync(true);
  };

  const removeExpense = async (id: string) => {
    setState(prev => ({ ...prev, expenses: prev.expenses.filter(x => x.id !== id) }));
    await handleForceSync(false);
  };

  const updateInitialCapital = async (amount: number) => {
    setState(prev => ({ ...prev, initialCapital: amount }));
    await handleForceSync(false);
  };

  const updateCommissionBrackets = async (brackets: CommissionBracket[]) => {
    setState(prev => ({ ...prev, commissionBrackets: brackets }));
    await handleForceSync(false);
  };

  const handleSyncUser = (user: User) => {
    setState(prev => {
      if (prev.users.find(u => u.id === user.id)) return prev;
      return { ...prev, users: [user, ...prev.users] };
    });
  };

  const deleteRemoteClientAction = async (clientId: string) => {
    const client = state.clients.find(c => c.id === clientId);
    if (client) {
      const clientLoans = state.loans.filter(l => l.clientId === clientId);
      const totalCapital = clientLoans.reduce((sum, l) => sum + l.principal, 0);
      const deletedByUser = state.users.find(u => u.id === state.currentUser?.id);

      const newAuditLog: CollectionLog = {
        id: crypto.randomUUID(),
        loanId: (clientLoans.length > 0 ? clientLoans[0].id : clientId) as any,
        clientId: clientId as any,
        branchId: state.currentUser?.managedBy || state.currentUser?.id,
        type: CollectionLogType.DELETED_PAYMENT,
        amount: totalCapital,
        date: new Date().toISOString(),
        location: { lat: 0, lng: 0 },
        recordedBy: state.currentUser?.id,
        collectorId: state.currentUser?.id,
        notes: JSON.stringify({
          tipo: 'CLIENTE_ELIMINADO',
          clienteNombre: client.name,
          clienteTelefono: client.phone || '',
          clienteDireccion: client.address || '',
          eliminadoPorNombre: deletedByUser?.name || 'Administrador',
          capitalTotal: totalCapital,
          creditosEliminados: clientLoans.length
        })
      };
      
      pushLog(newAuditLog);
      
      // Cleanup associated data
      const clientLogs = state.collectionLogs.filter(l => l.clientId === clientId);
      clientLogs.forEach(log => deleteRemoteLog(log.id));
      clientLoans.forEach(loan => deleteRemoteLoan(loan.id));

      setState(prev => ({
        ...prev,
        collectionLogs: [...prev.collectionLogs.filter(l => l.clientId !== clientId), newAuditLog]
      }));
    }

    setState(prev => ({
      ...prev,
      clients: prev.clients.filter(c => c.id !== clientId),
      loans: prev.loans.filter(l => l.clientId !== clientId),
    }));
    await deleteRemoteClient(clientId);
    await handleForceSync(false);
  };

  return {
    handleLogin, handleLogout, addUser, updateUser, deleteUser, updateSettings,
    addClient, addLoan, updateClient, deleteClient, updateLoan, recalculateAllLoansBalances,
    recalculateLoanStatus, deleteLoan, addCollectionAttempt, deleteCollectionLog,
    updateCollectionLog, addBulkData, updateCollectionLogNotes, addExpense, removeExpense,
    updateInitialCapital, updateCommissionBrackets, handleSyncUser, deleteRemoteClientAction,
    renewLoan
  };
};
