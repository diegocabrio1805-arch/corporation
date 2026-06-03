import React, { useEffect, useMemo, useRef, useCallback } from 'react';
import { AppState, User, Role, CollectionLog, CollectionLogType, Loan, PaymentRecord, LoanStatus, PaymentStatus } from '../types';
import { useSync } from './useSync';
import { supabase } from '../utils/supabaseClient';
import { StorageService } from '../utils/localforageStorage';
import { Preferences } from '@capacitor/preferences';
import { isPrintingNow, connectToPrinter } from '../services/bluetoothPrinterService';
import { App as CapApp } from '@capacitor/app';

export const useAppSyncEngine = (
  state: AppState,
  setState: React.Dispatch<React.SetStateAction<AppState>>,
  resolvedSettings: any,
  isInitializing: boolean
) => {
  // Función para guardar el estado inmediatamente en IndexedDB (Crítico para robustez offline)
  const immediateSave = useCallback(async (stateToSave: AppState) => {
    try {
      await StorageService.setItem('prestamaster_v2', stateToSave);
      if (stateToSave.currentUser) {
        await Preferences.set({ key: 'NATIVE_CURRENT_USER', value: JSON.stringify(stateToSave.currentUser) });
      }
    } catch (e) {
      console.error("🚨 [Critical] Error en guardado inmediato:", e);
    }
  }, []);

  const mergeData = <T extends { id: string, updated_at?: string }>(
    local: T[],
    remote: T[],
    pendingAddIds: Set<string> = new Set(),
    pendingDeleteIds: Set<string> = new Set(),
    isFullSync: boolean = false,
    isAppendOnly: boolean = false
  ): T[] => {
    if (!Array.isArray(local)) local = [];
    if (!Array.isArray(remote)) remote = [];
    if (isFullSync) {
      const localMap = new Map((Array.isArray(local) ? local : []).map(l => [l.id, l]));
      const result = (Array.isArray(remote) ? remote : []).filter(r => !pendingDeleteIds.has(r.id) && !(r as any).deletedAt)
        .map(r => {
          const l = localMap.get(r.id);
          if (l) {
            const cleanR = Object.fromEntries(Object.entries(r as any).filter(([_, v]) => v !== undefined)) as Partial<T>;
            return { ...l, ...cleanR } as T;
          }
          return r;
        });

      const remoteIds = new Set(result.map(r => r.id));
      local.forEach(l => {
        if (!l || !l.id) return;
        const isRecent = l.updated_at && (Date.now() - new Date(l.updated_at).getTime() < 86400000);
        if ((pendingAddIds.has(l.id) || isRecent) && !remoteIds.has(l.id)) {
          result.push(l);
          remoteIds.add(l.id);
        }
      });
      return result;
    }

    const remoteMap = new Map((Array.isArray(remote) ? remote : []).map(i => [i.id, i]));
    const result: T[] = [...(Array.isArray(remote) ? remote : []).filter(r => !pendingDeleteIds.has(r.id) && !(r as any).deletedAt)];
    const resultMap = new Map(result.map(i => [i.id, i]));

    local.forEach(l => {
      if (!l || !l.id || pendingDeleteIds.has(l.id)) return;
      const r = remoteMap.get(l.id);
      const isRecent = l.updated_at && (Date.now() - new Date(l.updated_at).getTime() < 86400000);

      if (!r) {
        if ((pendingAddIds.has(l.id) || isRecent) && !resultMap.has(l.id)) {
          result.push(l);
          resultMap.set(l.id, l);
        }
      } else {
        const remoteInstallments = Array.isArray((r as any).installments) ? (r as any).installments : [];
        const localInstallments = Array.isArray((l as any).installments) ? (l as any).installments : [];
        const remotePaidCount = remoteInstallments.filter((i: any) => i.status === 'Pagado').length;
        const localPaidCount = localInstallments.filter((i: any) => i.status === 'Pagado').length;
        const remoteIsMoreComplete = remoteInstallments.length > localInstallments.length || remotePaidCount > localPaidCount;

        if (!isAppendOnly && !remoteIsMoreComplete && (l.updated_at && r.updated_at && new Date(l.updated_at).getTime() > new Date(r.updated_at).getTime())) {
          const idx = result.findIndex(item => item.id === l.id);
          if (idx !== -1) {
            result[idx] = l;
            resultMap.set(l.id, l);
          }
        } else if (r) {
          const idx = result.findIndex(item => item.id === r.id);
          if (idx !== -1) {
            const cleanR = Object.fromEntries(Object.entries(r as any).filter(([_, v]) => v !== undefined)) as Partial<T>;
            result[idx] = { ...l, ...cleanR } as T;
            resultMap.set(r.id, result[idx]);
          }
        }
      }
    });

    if (!isFullSync) {
      local.forEach(l => {
        if (l && l.id && !pendingDeleteIds.has(l.id) && !remoteMap.has(l.id) && !resultMap.has(l.id)) {
          result.push(l);
          resultMap.set(l.id, l);
        }
      });
    }
    return result;
  };

  const handleRealtimeData = useCallback((newData: Partial<AppState>, isFullSync?: boolean) => {
    setState(prev => {
      const queueStr = localStorage.getItem('syncQueue');
      const queue = queueStr ? JSON.parse(queueStr) : [];
      const pendingDeleteIds = new Set<string>();
      const pendingAddIds = new Set<string>();

      if (Array.isArray(queue)) {
        queue.forEach((item: any) => {
          if (item?.data?.id) {
            if (item.operation.startsWith('DELETE_')) pendingDeleteIds.add(item.data.id);
            else if (item.operation.startsWith('ADD_')) pendingAddIds.add(item.data.id);
          }
        });
      }

      const updatedState = { ...prev };

      if (newData.deletedItems && newData.deletedItems.length > 0) {
        const delIds = new Set(newData.deletedItems.map(d => d.recordId));
        if (updatedState.payments) updatedState.payments = updatedState.payments.filter(i => !delIds.has(i.id));
        if (updatedState.collectionLogs) updatedState.collectionLogs = updatedState.collectionLogs.filter(i => !delIds.has(i.id));
        if (updatedState.loans) updatedState.loans = updatedState.loans.filter(i => !delIds.has(i.id));
        if (updatedState.clients) updatedState.clients = updatedState.clients.filter(i => !delIds.has(i.id));
      }

      const mappedData = { ...newData };
      if (mappedData.users) {
        mappedData.users = mappedData.users.filter((u: any) => !u.deletedAt);
      }

      if (mappedData.payments) updatedState.payments = mergeData(updatedState.payments, mappedData.payments, pendingAddIds, pendingDeleteIds, !!isFullSync, true);
      if (mappedData.collectionLogs) updatedState.collectionLogs = mergeData(updatedState.collectionLogs, mappedData.collectionLogs, pendingAddIds, pendingDeleteIds, !!isFullSync, true);
      if (mappedData.loans) updatedState.loans = mergeData(updatedState.loans, mappedData.loans, pendingAddIds, pendingDeleteIds, !!isFullSync);
      if (mappedData.clients) updatedState.clients = mergeData(updatedState.clients, mappedData.clients, pendingAddIds, pendingDeleteIds, !!isFullSync);
      if (mappedData.expenses) updatedState.expenses = mergeData(updatedState.expenses, mappedData.expenses, pendingAddIds, pendingDeleteIds, !!isFullSync);
      if (mappedData.users) {
        updatedState.users = mergeData(updatedState.users, mappedData.users, pendingAddIds, pendingDeleteIds, !!isFullSync);
        if (prev.currentUser && mappedData.users.length > 0) {
          const refreshedCurrentUser = mappedData.users.find((u: any) => u.id === prev.currentUser!.id);
          if (refreshedCurrentUser) {
            const mappedUser = {
              ...prev.currentUser,
              ...refreshedCurrentUser,
              requiresLocation: refreshedCurrentUser.requiresLocation ?? (refreshedCurrentUser as any).requires_location ?? prev.currentUser.requiresLocation,
              blocked: refreshedCurrentUser.blocked ?? prev.currentUser.blocked,
              expiryDate: refreshedCurrentUser.expiryDate ?? (refreshedCurrentUser as any).expiry_date ?? prev.currentUser.expiryDate,
              name: refreshedCurrentUser.name ?? prev.currentUser.name,
              username: refreshedCurrentUser.username ?? prev.currentUser.username,
            };
            updatedState.currentUser = mappedUser;
          }
        }
      }

      if (newData.branchSettings) updatedState.branchSettings = { ...prev.branchSettings, ...newData.branchSettings };

      // Persistencia inmediata del nuevo estado sincronizado
      immediateSave(updatedState);
      return updatedState;
    });
  }, [setState, immediateSave]);

  const sync = useSync(handleRealtimeData);

  const handleDeepReset = () => {
    if (confirm("¿Estás seguro? Esto borrará todos los datos locales y forzará una descarga total.")) {
      StorageService.removeItem('prestamaster_v2').then(() => {
        localStorage.clear();
        window.location.reload();
      });
    }
  };

  const handleForceSync = useCallback(async (silent: boolean = false, message: string = "¡Sincronizado!", fullSync: boolean = false, skipPull: boolean = false) => {
    if (!silent) sync.setSuccessMessage(message);
    if (fullSync) {
      await sync.forceFullSync();
    } else {
      await sync.processQueue(true, false, skipPull);
      // Forzar un Pull incremental si es un disparo manual (no silent) para que el usuario "vea" que descargó datos
      if (!silent && !skipPull) {
        await sync.pullData(false);
      }
    }
  }, [sync]);

  useEffect(() => {
    if (isInitializing) return;
    const timer = setTimeout(() => {
      try {
        StorageService.setItem('prestamaster_v2', state);
        if (state.currentUser) {
          Preferences.set({ key: 'NATIVE_CURRENT_USER', value: JSON.stringify(state.currentUser) });
        }
      } catch (e) {
        console.error("IDB Save Error:", e);
      }
    }, 1500);

    return () => clearTimeout(timer);
  }, [state, isInitializing]);

  useEffect(() => {
    if (isInitializing) return;
    const recover = async () => {
      if (state.currentUser) return;
      const { value } = await Preferences.get({ key: 'NATIVE_CURRENT_USER' });
      if (value) {
        try {
          if (navigator.onLine) {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) {
              console.log("No valid Supabase session on recover. Forcing logout.");
              await Preferences.remove({ key: 'NATIVE_CURRENT_USER' });
              setState((prev: AppState) => ({ ...prev, currentUser: null }));
              return;
            }
          }
          const user = JSON.parse(value);
          setState((prev: AppState) => ({ ...prev, currentUser: user }));
          setTimeout(() => handleForceSync(true), 1000);
        } catch (e) { }
      }
    };
    recover();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event: any, session: any) => {
      // Solo forzar logout si el evento es explícitamente SIGNED_OUT
      // o si es INITIAL_SESSION nulo Y no tenemos un usuario nativo ya cargado.
      if (event === 'SIGNED_OUT' || (event === 'INITIAL_SESSION' && !session && !state.currentUser && navigator.onLine)) {
        Preferences.remove({ key: 'NATIVE_CURRENT_USER' }).catch(console.error);
        setState((prev: AppState) => ({ ...prev, currentUser: null }));
      }
    });

    const triggerEmergencySync = async () => {
      const lastSyncKey = localStorage.getItem('last_emergency_sync_key');
      const syncKey = 'emergency_sync_v640_STABLE';
      
      if (lastSyncKey !== syncKey && state.currentUser) {
        console.log("🚨 [EMERGENCY] Triggering specialized sync:", syncKey);
        sync.setSuccessMessage("¡RECUPERANDO DATOS v6.4.0!");
        
        const keysToRemove = [
          'last_sync_timestamp', 'last_full_sync', 'sync_metadata', 'local_changes_queue',
          'emergency_sync_v638_UPDATE_FINAL', 'emergency_sync_v639_UPDATE_FINAL',
          'emergency_sync_v639_FINAL_COMPLETE', 'last_sync_timestamp_ms',
          'last_sync_timestamp_v6', 'last_sync_timestamp_v7',
          'last_sync_timestamp_v8', 'last_sync_timestamp_v630'
        ];
        
        keysToRemove.forEach(k => localStorage.removeItem(k));
        localStorage.setItem('last_emergency_sync_key', syncKey);

        setTimeout(() => {
          window.location.reload();
        }, 1500);
      }
    };
    triggerEmergencySync();

    return () => {
      subscription?.unsubscribe?.();
    };
  }, [state.currentUser?.id, isInitializing, handleForceSync]);

  useEffect(() => {
    if (isInitializing) return;
    // NOTA: El delay es de 5s para evitar colisión con el fullSync que App.tsx
    // dispara a los 3s cuando no hay clientes en caché local.
    const timer = setTimeout(() => {
      sync.pullData();
    }, 5000);

    return () => {
      clearTimeout(timer);
    };
  }, [isInitializing]);


  useEffect(() => {
    if (isInitializing) return;
    let lastFocusSync = 0;
    const handleFocus = () => {
      const now = Date.now();
      if (now - lastFocusSync > 30000) { // Reduced to 30s for snappier cross-browser sync
        lastFocusSync = now;
        sync.pullData();
      }
    };
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [isInitializing]);

  useEffect(() => {
    if (isInitializing) return;
    // Contador de ciclos para deep-sync periódico
    let syncCycleCount = 0;

    const intervalTime = sync.queueLength > 0 ? 2000 : 300000;
    const healthCheckInterval = setInterval(() => {
        // Si no hubo sync reciente, descargar datos frescos para compensar posibles
        // caídas de la conexión Realtime
        const lastSyncMs = parseInt(localStorage.getItem('last_sync_timestamp_ms') || '0', 10);
        const msSinceLastSync = Date.now() - lastSyncMs;

        // DEEP-SYNC AUTOMÁTICO: Cada hora, borrar timestamps para forzar
        // una revisión amplia (como la Opción 4, pero silenciosa y sin borrar nada).
        // Cubre el caso donde un pago quedó justo fuera del margen de delta-sync.
        const lastDeepSyncMs = parseInt(localStorage.getItem('last_deep_sync_ms') || '0', 10);
        const msSinceDeepSync = Date.now() - lastDeepSyncMs;
        const shouldDeepSync = msSinceDeepSync > 3600000; // cada 1 hora

        syncCycleCount++;
        const isTenthCycle = syncCycleCount % 10 === 0;

        if ((shouldDeepSync || isTenthCycle) && !sync.isSyncing && sync.isOnline) {
            console.log('[AutoRepair] Ejecutando deep-sync silencioso. Ciclo:', syncCycleCount);
            const keys = [
                'last_sync_timestamp_ms',
                'last_sync_timestamp_v8',
            ];
            keys.forEach(k => localStorage.removeItem(k));
            localStorage.setItem('last_deep_sync_ms', Date.now().toString());
            sync.pullData(false);
            return;
        }

        if (msSinceLastSync > 60000 && !sync.isSyncing && sync.isOnline) {
            sync.pullData();
        }
    }, 30000); // Health check cada 30s
    const syncInterval = setInterval(() => {
      if (!sync.isSyncing && sync.isOnline && !isPrintingNow()) {
        handleForceSync(true);
      }
    }, intervalTime);

    const handleOnline = () => handleForceSync(true);
    window.addEventListener('online', handleOnline);

    return () => {
      clearInterval(syncInterval);
      clearInterval(healthCheckInterval);
      window.removeEventListener('online', handleOnline);
    };
  }, [sync.isSyncing, sync.isOnline, sync.queueLength, handleForceSync, isInitializing]);

  const getBranchId = (user: User | null): string => {
    if (!user) return 'none';
    if (user.role === Role.ADMIN || user.role === Role.MANAGER) return user.id;
    return user.managedBy || 'none';
  };

  const filteredState = useMemo(() => {
    if (!state.currentUser) return state;
    const user = state.currentUser;
    const branchId = getBranchId(user);
    const myIdLower = user.id.toLowerCase();
    const branchIdLower = branchId.toLowerCase();

    const myDirectCollectorIds = new Set<string>();
    (Array.isArray(state.users) ? state.users : []).forEach(u => {
      const uManagerId = (u.managedBy || (u as any).managed_by)?.toLowerCase();
      if (uManagerId === branchIdLower && u.role === Role.COLLECTOR) {
        myDirectCollectorIds.add(u.id.toLowerCase());
      }
    });

    const isOurBranch = (itemBranchId: string | undefined, itemAddedBy: string | undefined, itemCollectorId: string | undefined) => {
      const itemBranchLower = itemBranchId?.toLowerCase();
      const addedByLower = itemAddedBy?.toLowerCase() || '';
      const collectorIdLower = itemCollectorId?.toLowerCase() || '';

      if (itemBranchLower) {
        return itemBranchLower === branchIdLower;
      } else {
        return addedByLower === myIdLower ||
          myDirectCollectorIds.has(addedByLower) ||
          collectorIdLower === myIdLower ||
          myDirectCollectorIds.has(collectorIdLower);
      }
    };

    let clients = (Array.isArray(state.clients) ? state.clients : []).filter(c =>
      isOurBranch(c.branchId || (c as any).branch_id, c.addedBy || (c as any).added_by, undefined) &&
      c.isActive !== false
    );
    const activeClientIds = new Set(clients.filter(c => !c.deletedAt).map(c => c.id));

    let loans = (Array.isArray(state.loans) ? state.loans : []).filter(l =>
      activeClientIds.has(l.clientId || (l as any).client_id) && !l.deletedAt
    );
    let payments = (Array.isArray(state.payments) ? state.payments : []).filter(p =>
      activeClientIds.has(p.clientId || (p as any).client_id) && !p.deletedAt
    );
    let expenses = (Array.isArray(state.expenses) ? state.expenses : []).filter(e =>
      isOurBranch(e.branchId || (e as any).branch_id, e.addedBy || (e as any).added_by, undefined)
    );
    let collectionLogs = (Array.isArray(state.collectionLogs) ? state.collectionLogs : []).filter(log =>
      isOurBranch(log.branchId || (log as any).branch_id, log.recordedBy || (log as any).recorded_by, undefined) &&
      !log.deletedAt &&
      (
        // Logs de auditoría de eliminados: siempre visibles (no tienen clientId activo)
        log.type === CollectionLogType.DELETED_PAYMENT ||
        // Logs normales: solo mostrar si el cliente sigue activo en el sistema
        !log.clientId ||
        activeClientIds.has(log.clientId)
      )
    );

    let users = (Array.isArray(state.users) ? state.users : []).filter(u => {
      if (u.deletedAt || (u as any).deleted_at) return false;
      
      const uName = (u.name || '').toUpperCase().trim();
      const excludedNames = ['DIEGO', 'FABIAN PEDROZO', 'ALTERFINZONA01'];
      if (excludedNames.includes(uName)) return false;

      const uId = u.id.toLowerCase();
      const uManagedBy = (u.managedBy || (u as any).managed_by)?.toLowerCase();
      
      if (user.role === Role.ADMIN) {
        return true; 
      }
      
      return uId === myIdLower || (uManagedBy && uManagedBy === branchIdLower);
    });

    if (user.role === Role.COLLECTOR) {
      // 1. Identificar IDs de clientes donde el cobrador tiene préstamos asignados (activos o pasados)
      const involvedClientIds = new Set<string>();
      const allLoansInState = Array.isArray(state.loans) ? state.loans : [];
      
      allLoansInState.forEach(l => {
        const collId = (l.collectorId || (l as any).collector_id || '').toLowerCase();
        if (collId === user.id.toLowerCase()) {
          involvedClientIds.add(l.clientId || (l as any).client_id);
        }
      });

      // 2. Filtrar clientes: Creador OR Dueño Directo OR Involucrado en Préstamos
      clients = clients.filter(c => {
        const myId = user.id.toLowerCase();
        const isCreator = (c.addedBy || (c as any).added_by || '').toLowerCase() === myId;
        const isDirectOwner = ((c as any).collectorId || (c as any).collector_id || '').toLowerCase() === myId;
        const isInvolved = involvedClientIds.has(c.id);
        
        return isCreator || isDirectOwner || isInvolved;
      });

      const visibleClientIds = new Set(clients.map(c => c.id));

      // 3. Filtrar préstamos: Todos los préstamos de mis clientes visibles (Unifica saldos con Admin)
      loans = loans.filter(l => visibleClientIds.has(l.clientId || (l as any).client_id));
      const visibleLoanIds = new Set(loans.map(l => l.id));

      // 4. Filtrar pagos y logs: Todos los registros vinculados a mis clientes/préstamos visibles
      payments = payments.filter(p => 
        visibleClientIds.has(p.clientId || (p as any).client_id) ||
        visibleLoanIds.has(p.loanId || (p as any).loan_id)
      );

      collectionLogs = collectionLogs.filter(log => 
        (log.clientId && visibleClientIds.has(log.clientId)) ||
        (log.type === CollectionLogType.DELETED_PAYMENT && (log.recordedBy || (log as any).recorded_by) === user.id)
      );

      users = users.filter(u => u.id === user.id);
    }

    return { ...state, clients, loans, payments, expenses, collectionLogs, users, settings: resolvedSettings };
  }, [state, resolvedSettings]);

  return {
    ...sync,
    handleRealtimeData,
    handleForceSync,
    handleDeepReset,
    pushRenewal: sync.pushRenewal,
    filteredState,
    getBranchId,
    immediateSave
  };
};
