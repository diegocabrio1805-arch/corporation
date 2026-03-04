
import { Capacitor } from '@capacitor/core';
import { App as CapApp } from '@capacitor/app';
import { Preferences } from '@capacitor/preferences';
// import { useRegisterSW } from 'virtual:pwa-register/react';
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { AppState, Client, Loan, Role, LoanStatus, PaymentStatus, Expense, CollectionLog, CollectionLogType, User, AppSettings, PaymentRecord, CommissionBracket } from './types';
import Sidebar from './components/Sidebar';
import Dashboard from './components/Dashboard';
import Clients from './components/Clients';
import Loans from './components/Loans';
import { useRegisterSW } from 'virtual:pwa-register/react';

import CollectionRoute from './components/CollectionRoute';
import Expenses from './components/Expenses';
import CollectionMap from './components/CollectionMap';
import CollectorCommission from './components/CollectorCommission';
import Collectors from './components/Collectors';
import Managers from './components/Managers';
import CollectorPerformance from './components/CollectorPerformance';
import Notifications from './components/Notifications';
import Login from './components/Login';
import Simulator from './components/Simulator';
import Settings from './components/Settings';
import Profile from './components/Profile';
import Reports from './components/Reports';
import Generator from './components/Generator/Generator';
import { getTranslation } from './utils/translations';
import { getLocalDateStringForCountry, generateUUID, formatCurrency, parseAmount, calculateTotalPaidFromLogs } from './utils/helpers';
import { resolveSettings } from './utils/settingsHierarchy';
import { useSync } from './hooks/useSync';
import { isPrintingNow, startConnectionKeeper } from './services/bluetoothPrinterService';
import FloatingBackButton from './components/FloatingBackButton';
import LocationEnforcer from './components/LocationEnforcer';
import { Geolocation } from '@capacitor/geolocation';


import ErrorBoundary from './components/ErrorBoundary';
import LicenseReminder from './components/LicenseReminder';
import { StorageService } from './utils/localforageStorage';
import { supabase } from './utils/supabaseClient';


const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [showManagerExpiryModal, setShowManagerExpiryModal] = useState(false);
  const [showCollectorExpiryAlert, setShowCollectorExpiryAlert] = useState(false);
  const [expiringCollectorsNames, setExpiringCollectorsNames] = useState<string[]>([]);
  const [daysToExpiry, setDaysToExpiry] = useState<number | null>(null);
  const [isJumping, setIsJumping] = useState(false);
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [autoSyncEnabled, setAutoSyncEnabled] = useState(true);

  // --- BULLETPROOF AUTO-UPDATER ---
  useEffect(() => {
    const checkForUpdates = async () => {
      try {
        const res = await fetch('/?t=' + Date.now(), { cache: 'no-store' });
        if (!res.ok) return;
        const text = await res.text();
        const match = text.match(/CURRENT_VERSION\s*=\s*'([^']+)'/);
        if (match && match[1]) {
          const remoteVersion = match[1];
          const localVersion = '6.1.170';
          if (remoteVersion !== localVersion) {
            console.log("CRITICAL UPDATE DETECTED! Updating from", localVersion, "to", remoteVersion);
            localStorage.removeItem('pwa_app_version');
            if ('caches' in window) {
              const names = await caches.keys();
              await Promise.all(names.map(name => caches.delete(name)));
            }
            if ('serviceWorker' in navigator) {
              const regs = await navigator.serviceWorker.getRegistrations();
              await Promise.all(regs.map(r => r.unregister()));
            }
            window.location.reload();
          }
        }
      } catch (error) {
        console.log("Auto-updater check failed (offline?)");
      }
    };

    // Check 5 seconds after boot, then every 2 minutes
    setTimeout(checkForUpdates, 5000);
    const interval = setInterval(checkForUpdates, 2 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  // Indicate successful boot to index.html anti-panic
  useEffect(() => {
    (window as any).__isBooted = true;
  }, []);
  // 1. STATE INITIALIZATION
  const [state, setState] = useState<AppState>(() => {
    const CURRENT_VERSION_ID = '6.1.170';
    const SYSTEM_ADMIN_ID = 'b3716a78-fb4f-4918-8c0b-92004e3d63ec';
    const initialAdmin: User = { id: SYSTEM_ADMIN_ID, name: 'Administrador', role: Role.ADMIN, username: 'DDANTE1983', password: 'Cobros2026' };
    const defaultInitialState: AppState = {
      clients: [],
      loans: [],
      payments: [],
      expenses: [],
      collectionLogs: [],
      users: [initialAdmin],
      currentUser: null,
      commissionPercentage: 10,
      commissionBrackets: [],
      initialCapital: 0,
      settings: { language: 'es', country: 'CO', numberFormat: 'dot' },
      branchSettings: {}
    };
    return defaultInitialState; // Inicialmente vacío mientras IndexedDB carga
  });

  const [isInitializing, setIsInitializing] = useState(true);

  // === CARGA INICIAL ASINCRONA ASYNC STORAGE ===
  useEffect(() => {
    const loadData = async () => {
      const CURRENT_VERSION_ID = '6.1.170';
      const SYSTEM_ADMIN_ID = 'b3716a78-fb4f-4918-8c0b-92004e3d63ec';
      const initialAdmin: User = { id: SYSTEM_ADMIN_ID, name: 'Administrador', role: Role.ADMIN, username: 'DDANTE1983', password: 'Cobros2026' };

      const defaultInitialState: AppState = {
        clients: [], loans: [], payments: [], expenses: [], collectionLogs: [],
        users: [initialAdmin], currentUser: null, commissionPercentage: 10, commissionBrackets: [],
        initialCapital: 0, settings: { language: 'es', country: 'CO', numberFormat: 'dot' },
        branchSettings: {}
      };

      try {
        const lastAppVersion = localStorage.getItem('LAST_APP_VERSION_ID');
        if (!lastAppVersion || lastAppVersion !== CURRENT_VERSION_ID) {
          console.log(`[App] Version mismatch: ${lastAppVersion} -> ${CURRENT_VERSION_ID}. Purging cache...`);

          // 1. Unregister Service Workers
          if ('serviceWorker' in navigator) {
            const registrations = await navigator.serviceWorker.getRegistrations();
            for (const registration of registrations) {
              await registration.unregister();
            }
          }

          // 2. Clear Caches
          if ('caches' in window) {
            const cacheNames = await caches.keys();
            for (const cacheName of cacheNames) {
              await caches.delete(cacheName);
            }
          }

          // 3. Keep settings but clear the rest
          let savedSettings = null; let savedBranchSettings = null;

          const oldSaved = localStorage.getItem('prestamaster_v2');
          if (oldSaved) {
            try {
              const oldData = JSON.parse(oldSaved);
              if (oldData?.settings) savedSettings = oldData.settings;
              if (oldData?.branchSettings) savedBranchSettings = oldData.branchSettings;
            } catch (e) { }
          } else {
            const idbSaved = await StorageService.getItem<AppState>('prestamaster_v2');
            if (idbSaved && idbSaved.settings) savedSettings = idbSaved.settings;
            if (idbSaved && idbSaved.branchSettings) savedBranchSettings = idbSaved.branchSettings;
          }

          localStorage.setItem('LAST_APP_VERSION_ID', CURRENT_VERSION_ID);
          localStorage.removeItem('prestamaster_v2'); // Destruir de LocalStorage normal (pesada)

          // CRÍTICO: Forzar full sync eliminando timestamps viejos
          localStorage.removeItem('last_sync_timestamp_ms');
          localStorage.removeItem('last_sync_timestamp_v6');
          localStorage.removeItem('last_sync_timestamp_v7');
          localStorage.removeItem('last_sync_timestamp_v8');

          if (savedSettings || savedBranchSettings) {
            await StorageService.setItem('prestamaster_v2', { settings: savedSettings || defaultInitialState.settings, branchSettings: savedBranchSettings || {} });
          }

          console.log("[App] Purge complete. Reloading...");
          window.location.reload();
          return;
        }

        // Leer datos actuales de IndexedDB (antes LocalStorage)
        let rawData: any = await StorageService.getItem<AppState>('prestamaster_v2');
        if (!rawData) {
          // Fallback temporal si estaban en localStorage y no migramos versión
          const lsData = localStorage.getItem('prestamaster_v2');
          if (lsData) {
            rawData = JSON.parse(lsData);
            localStorage.removeItem('prestamaster_v2'); // Mudar
            await StorageService.setItem('prestamaster_v2', rawData);
          }
        }

        if (!rawData) {
          setState(defaultInitialState);
          setIsInitializing(false);
          return;
        }

        // Reconstrucción del Estado
        const json = JSON.stringify(rawData).replace(/"admin-1"/g, `"${SYSTEM_ADMIN_ID}"`);
        rawData = JSON.parse(json);

        const users = (Array.isArray(rawData?.users) ? rawData.users : [initialAdmin]).map((u: any) => ({
          ...u,
          role: u.role as Role,
          managedBy: u.managedBy || u.managed_by
        }));

        let validatedCurrentUser = null;
        if (rawData?.currentUser && rawData.currentUser.id) {
          validatedCurrentUser = users.find((u: User) => u.id === rawData.currentUser.id) || null;
        } else {
          try {
            const res = await Preferences.get({ key: 'NATIVE_CURRENT_USER' });
            if (res.value) {
              const parsedNative = JSON.parse(res.value);
              validatedCurrentUser = users.find((u: User) => u.id === parsedNative.id) || null;
            }
          } catch (e) { }
        }

        setState({
          clients: Array.isArray(rawData?.clients) ? rawData.clients : [],
          loans: (Array.isArray(rawData?.loans) ? rawData.loans : []).map((l: any) => ({ ...l, isRenewal: l.isRenewal || false })),
          payments: Array.isArray(rawData?.payments) ? rawData.payments : [],
          expenses: Array.isArray(rawData?.expenses) ? rawData.expenses : [],
          collectionLogs: (Array.isArray(rawData?.collectionLogs) ? rawData.collectionLogs : []).map((l: any) => ({
            ...l, isRenewal: l.isRenewal || false, isOpening: l.isOpening || false,
            type: l.type as CollectionLogType
          })),
          users,
          currentUser: validatedCurrentUser,
          commissionPercentage: typeof rawData?.commissionPercentage === 'number' ? rawData.commissionPercentage : 10,
          commissionBrackets: Array.isArray(rawData?.commissionBrackets) ? rawData.commissionBrackets : [],
          initialCapital: typeof rawData?.initialCapital === 'number' ? rawData.initialCapital : 0,
          settings: rawData?.settings || defaultInitialState.settings,
          branchSettings: rawData?.branchSettings || defaultInitialState.branchSettings
        });

      } catch (err) {
        console.error("Error loading IDB DB", err);
        setState(defaultInitialState);
      } finally {
        setIsInitializing(false);
      }
    };
    loadData();
  }, []);


  const resolvedSettings = useMemo(() => {
    try {
      return resolveSettings(state.currentUser, state.branchSettings || {}, state.users, state.settings || { language: 'es', country: 'CO', numberFormat: 'dot' } as any);
    } catch (e) {
      console.error("Settings resolution error:", e);
      return { language: 'es', country: 'CO', numberFormat: 'dot' } as any;
    }
  }, [state.currentUser, state.branchSettings, state.users]);

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
            // MERGE to preserve heavy fields (photos) that are excluded from main sync
            const cleanR = Object.fromEntries(Object.entries(r as any).filter(([_, v]) => v !== undefined)) as Partial<T>;
            return { ...l, ...cleanR } as T;
          }
          return r;
        });

      const remoteIds = new Set(result.map(r => r.id));
      local.forEach(l => {
        if (l && l.id && pendingAddIds.has(l.id) && !remoteIds.has(l.id)) {
          result.push(l);
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

      // PROTECTION: If local item is very recent (< 5 mins), keep it even if not in remote/result
      // This protects against "Push -> FullSync -> Remote lag -> Delete" race condition
      const isRecent = l.updated_at && (Date.now() - new Date(l.updated_at).getTime() < 300000);

      if (!r) {
        if ((pendingAddIds.has(l.id) || isRecent) && !resultMap.has(l.id)) {
          result.push(l);
          resultMap.set(l.id, l);
        }
      } else {
        // PROTECTION: If remote has more installments than local, ALWAYS use remote.
        // This fixes the "2 installments vs 40" bug where local was considered "newer" but was truncated.
        const remoteInstallments = Array.isArray((r as any).installments) ? (r as any).installments : [];
        const localInstallments = Array.isArray((l as any).installments) ? (l as any).installments : [];

        const remotePaidCount = remoteInstallments.filter((i: any) => i.status === 'Pagado').length;
        const localPaidCount = localInstallments.filter((i: any) => i.status === 'Pagado').length;

        const remoteIsMoreComplete = remoteInstallments.length > localInstallments.length || remotePaidCount > localPaidCount;

        if (!isAppendOnly && !remoteIsMoreComplete && (l.updated_at && r.updated_at && new Date(l.updated_at).getTime() > new Date(r.updated_at).getTime())) {
          const idx = result.findIndex(item => item.id === l.id);
          if (idx !== -1) {
            // FIX: Instead of replacing L with R, or keeping L as is, 
            // if Remote exists but Local is "newer" (rare for sync but possible), 
            // we should still consider if Remote has fields Local doesn't. 
            // BUT here we were just preferring Local. 
            // The critical part is when we choose REMOTE (result already has R).
            result[idx] = l;
            resultMap.set(l.id, l);
          }
        } else if (r) {
          // If we are keeping remote item R (which is in 'result' by default), 
          // we should MERGE it with local item L to preserve fields omitted by server (like photos).
          const idx = result.findIndex(item => item.id === r.id);
          if (idx !== -1) {
            // CRITICAL FIX: Clean the remote object of explicit `undefined` values.
            // If the sync query omitted a column (e.g. photos) to save bandwidth, pullData maps it as { profilePic: undefined }.
            // Spreading this { profilePic: undefined } over the local object { profilePic: "base64" } deletes the base64!
            // By filtering out `undefined` keys, the local value is preserved correctly.
            // Note: `null` values are kept, as they represent actual DB clearings.
            const cleanR = Object.fromEntries(Object.entries(r as any).filter(([_, v]) => v !== undefined)) as Partial<T>;

            result[idx] = { ...l, ...cleanR } as T; // Shallow merge: preserve local valid data against undefined omissions
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

  const handleRealtimeData = (newData: Partial<AppState>, isFullSync?: boolean) => {
    console.log("[handleRealtimeData] Start merging data. isFullSync:", isFullSync, "payments:", newData.payments?.length);
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

      // MAP SNAKE_CASE TO CAMELCASE PREVENTIVELY
      const mappedData = { ...newData };
      if (mappedData.collectionLogs) {
        mappedData.collectionLogs = mappedData.collectionLogs.map(l => ({
          ...l,
          loanId: l.loanId || (l as any).loan_id,
          clientId: l.clientId || (l as any).client_id,
          branchId: l.branchId || (l as any).branch_id,
          collectorId: (l as any).collectorId || (l as any).collector_id,
          receiptNumber: (l as any).receiptNumber || (l as any).receipt_number,
          isOpening: (l as any).isOpening !== undefined ? (l as any).isOpening : (l as any).is_opening,
          isRenewal: (l as any).isRenewal !== undefined ? (l as any).isRenewal : (l as any).is_renewal,
          isVirtual: (l as any).isVirtual !== undefined ? (l as any).isVirtual : (l as any).is_virtual,
          deletedAt: (l as any).deletedAt || (l as any).deleted_at
        }));
      }
      if (mappedData.payments) {
        mappedData.payments = mappedData.payments.map(p => ({
          ...p,
          loanId: p.loanId || (p as any).loan_id,
          clientId: p.clientId || (p as any).client_id,
          branchId: p.branchId || (p as any).branch_id,
          collectorId: (p as any).collectorId || (p as any).collector_id,
          deletedAt: (p as any).deletedAt || (p as any).deleted_at
        }));
      }
      if (mappedData.loans) {
        mappedData.loans = mappedData.loans.map(lo => ({
          ...lo,
          clientId: lo.clientId || (lo as any).client_id,
          branchId: lo.branchId || (lo as any).branch_id,
          collectorId: lo.collectorId || (lo as any).collector_id,
          isRenewal: (lo as any).isRenewal !== undefined ? (lo as any).isRenewal : (lo as any).is_renewal,
          deletedAt: (lo as any).deletedAt || (lo as any).deleted_at
        }));
      }
      if (mappedData.clients) {
        mappedData.clients = mappedData.clients.map(c => ({
          ...c,
          documentId: (c as any).documentId || (c as any).document_id,
          branchId: (c as any).branchId || (c as any).branch_id,
          addedBy: (c as any).addedBy || (c as any).added_by,
          deletedAt: (c as any).deletedAt || (c as any).deleted_at
        }));
      }

      if (mappedData.payments) updatedState.payments = mergeData(updatedState.payments, mappedData.payments, pendingAddIds, pendingDeleteIds, !!isFullSync, true);
      if (mappedData.collectionLogs) updatedState.collectionLogs = mergeData(updatedState.collectionLogs, mappedData.collectionLogs, pendingAddIds, pendingDeleteIds, !!isFullSync, true);
      if (mappedData.loans) updatedState.loans = mergeData(updatedState.loans, mappedData.loans, pendingAddIds, pendingDeleteIds, !!isFullSync);
      if (mappedData.clients) updatedState.clients = mergeData(updatedState.clients, mappedData.clients, pendingAddIds, pendingDeleteIds, !!isFullSync);
      if (mappedData.expenses) updatedState.expenses = mergeData(updatedState.expenses, mappedData.expenses, pendingAddIds, pendingDeleteIds, !!isFullSync);
      if (mappedData.users) {
        updatedState.users = mergeData(updatedState.users, mappedData.users, pendingAddIds, pendingDeleteIds, !!isFullSync);
        // CRITICAL: Also update currentUser if their profile changed remotely
        // This ensures GPS enforcement and blocking take effect immediately
        if (prev.currentUser && mappedData.users.length > 0) {
          const refreshedCurrentUser = mappedData.users.find((u: any) => u.id === prev.currentUser!.id);
          if (refreshedCurrentUser) {
            const mappedUser = {
              ...prev.currentUser,
              ...refreshedCurrentUser,
              requiresLocation: refreshedCurrentUser.requiresLocation ?? refreshedCurrentUser.requires_location ?? prev.currentUser.requiresLocation,
              blocked: refreshedCurrentUser.blocked ?? prev.currentUser.blocked,
              expiryDate: refreshedCurrentUser.expiryDate ?? refreshedCurrentUser.expiry_date ?? prev.currentUser.expiryDate,
              name: refreshedCurrentUser.name ?? prev.currentUser.name,
              username: refreshedCurrentUser.username ?? prev.currentUser.username,
            };
            updatedState.currentUser = mappedUser;
          }
        }
      }

      if (newData.branchSettings) updatedState.branchSettings = { ...prev.branchSettings, ...newData.branchSettings };

      console.log("[handleRealtimeData] Merge Finished. Final payments:", updatedState.payments?.length);
      return updatedState;
    });
  };


  // 3. SYNC HOOK
  const {
    isSyncing, isFullSyncing, syncError, isOnline, processQueue, forceFullSync, pullData,
    pushClient, pushLoan, pushPayment, pushLog, pushUser, pushSettings, addToQueue,
    setSuccessMessage, showSuccess, successMessage, queueLength, clearQueue,
    deleteRemoteLoan, deleteRemoteLog, deleteRemotePayment, deleteRemoteClient, fetchClientPhotos
  } = useSync(handleRealtimeData);

  const doPull = () => pullData();

  const handleDeepReset = () => {
    if (confirm("¿Estás seguro? Esto borrará todos los datos locales y forzará una descarga total.")) {
      StorageService.removeItem('prestamaster_v2').then(() => {
        localStorage.clear();
        window.location.reload();
      });
    }
  };

  // 4. COMMAND FUNCTIONS
  const handleForceSync = async (silent: boolean = false, message: string = "¡Sincronizado!", fullSync: boolean = false) => {
    if (!silent) setSuccessMessage(message);
    if (fullSync) await forceFullSync();
    else await processQueue(true);
  };

  // --- 4. EFFECTS ---
  const forceSyncRef = React.useRef(handleForceSync);
  useEffect(() => { forceSyncRef.current = handleForceSync; }, [handleForceSync]);

  // REMOVED: Duplicate sync interval - already handled by the main sync effect below (line 309)

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
    const recover = async () => {
      if (state.currentUser) return;
      const { value } = await Preferences.get({ key: 'NATIVE_CURRENT_USER' });
      if (value) {
        try {
          const user = JSON.parse(value);
          setState((prev: AppState) => ({ ...prev, currentUser: user }));
          setTimeout(() => handleForceSync(true), 1000);
        } catch (e) { }
      }
    };
    recover();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event: any, session: any) => {
      if (event === 'SIGNED_OUT' || (event === 'INITIAL_SESSION' && !session && navigator.onLine)) {
        Preferences.remove({ key: 'NATIVE_CURRENT_USER' }).catch(console.error);
        setState((prev: AppState) => ({ ...prev, currentUser: null }));
      }
    });

    // --- EMERGENCY REMOTE SYNC TRIGGER (Forced by AI Assistant) ---
    const triggerEmergencySync = async () => {
      const user = state.currentUser;
      if (!user) return;
      const syncKey = `emergency_sync_done_${user.username}_v170_final_payment_fix`;
      const isRestoredUser = true; // Universal for this fix to ensure 300k shows up everywhere

      if (isRestoredUser && !localStorage.getItem(syncKey)) {
        console.log("[EmergencySync] Restored collector detected. Forcing full sync...");
        localStorage.setItem(syncKey, 'true');
        // Clear old markers to ensure a clean slate
        localStorage.removeItem('last_sync_timestamp');
        localStorage.removeItem('last_sync_timestamp_v6');
        setTimeout(() => {
          handleForceSync(false, "¡Actualizando Cartera Restaurada!", true);
        }, 3000);
      }
    };
    triggerEmergencySync();

    return () => {
      subscription?.unsubscribe();
    };
  }, []);

  useEffect(() => {
    startConnectionKeeper();
    // Intento inicial agresivo
    import('./services/bluetoothPrinterService').then(({ connectToPrinter }) => {
      connectToPrinter(undefined, false, true).catch(() => { });
    });
    const resumeListener = CapApp.addListener('appStateChange', async ({ isActive }) => {
      if (isActive) {
        const { connectToPrinter } = await import('./services/bluetoothPrinterService');
        connectToPrinter(undefined, false, true);
      }
    });

    const timer = setTimeout(() => {
      console.log("[App] Executing doPull after initial mount timeout.");
      doPull();
    }, 5000);

    // OPTIMIZATION: Cooldown on focus to prevent sync storm when switching tabs
    let lastFocusSync = 0;
    const handleFocus = () => {
      const now = Date.now();
      if (now - lastFocusSync > 120000) { // Only sync if last focus sync was >2 minutes ago
        lastFocusSync = now;
        doPull();
      }
    };
    window.addEventListener('focus', handleFocus);

    return () => {
      clearTimeout(timer);
      window.removeEventListener('focus', handleFocus);
      resumeListener.then(handle => handle.remove());
    };
  }, []);

  useEffect(() => {
    // OPTIMIZATION: Increased idle interval from 60s to 120s to reduce egress
    // OPTIMIZATION: Instant sync trigger (2s if busy, 30s if idle)
    const intervalTime = queueLength > 0 ? 2000 : 30000;
    const syncInterval = setInterval(() => {
      if (!isSyncing && isOnline && !isPrintingNow()) {
        console.log(`[App] Idle sync interval triggered. Queue: ${queueLength}`);
        handleForceSync(true);
      }
    }, intervalTime);

    const handleOnline = () => {
      handleForceSync(true);
    };
    window.addEventListener('online', handleOnline);

    return () => {
      clearInterval(syncInterval);
      window.removeEventListener('online', handleOnline);
    };
  }, [isSyncing, isOnline, queueLength]);

  useEffect(() => {
    if (!isOnline || isSyncing || isPrintingNow()) return;

    const interval = setInterval(() => {
      console.log("[App] Forced Turbo 4s Sync triggered");
      handleForceSync(true, "Actualizando...", true); // Sincronización completa pero silenciosa cada 4s
    }, 4000);

    return () => clearInterval(interval);
  }, [isOnline, isSyncing]);

  const getBranchId = (user: User | null): string => {
    if (!user) return 'none';
    if (user.role === Role.ADMIN || user.role === Role.MANAGER) return user.id;
    return user.managedBy || 'none';
  };

  const filteredState = useMemo(() => {
    if (!state.currentUser) return state;
    const user = state.currentUser;
    const branchId = getBranchId(user);
    const myTeamIds = new Set<string>();
    const myDirectCollectorIds = new Set<string>();
    const myIdLower = user.id.toLowerCase();
    myTeamIds.add(myIdLower);

    (Array.isArray(state.users) ? state.users : []).forEach(u => {
      const uManagerId = (u.managedBy || (u as any).managed_by)?.toLowerCase();
      if (uManagerId === myIdLower) {
        // Only add to team if it's NOT a manager, or if the user wants to see them
        if (u.role === Role.COLLECTOR) {
          myTeamIds.add(u.id.toLowerCase());
          myDirectCollectorIds.add(u.id.toLowerCase());
        }
      }
    });

    const isOurBranch = (itemBranchId: string | undefined, itemAddedBy: string | undefined, itemCollectorId: string | undefined) => {
      // ADMIN NO SEAS ESPECIAL: Ahora solo ves tu sucursal para que esté limpio (Pedido Dante)
      if (user.role === Role.ADMIN) {
        // Admins now only see items explicitly linked to their branch ID
        // or items that have no branch ID (legacy items, or items created by them before branch assignment)
        const itemBranchLower = itemBranchId?.toLowerCase();
        return !itemBranchLower || itemBranchLower === branchId.toLowerCase();
      }

      const myId = user.id.toLowerCase();
      const bId = branchId.toLowerCase();

      const addedByLower = itemAddedBy?.toLowerCase();
      const collectorIdLower = itemCollectorId?.toLowerCase();
      const itemBranchLower = itemBranchId?.toLowerCase();

      // PRIORITIZE BRANCH ISOLATION: If item belongs to a branch and it's NOT mine, return false immediately.
      // This prevents managers/collectors from seeing other managers' rosters even if they created the record.
      if (itemBranchLower && itemBranchLower !== bId) return false;

      // Fallback: If no branch is specified, allow access if added by me or my team.
      // Or if it matches my branch ID.
      if (addedByLower === myId || (addedByLower && myDirectCollectorIds.has(addedByLower))) return true;
      if (collectorIdLower === myId || (collectorIdLower && myDirectCollectorIds.has(collectorIdLower))) return true;
      if (itemBranchLower === bId) return true;

      return false;
    };

    let clients = (Array.isArray(state.clients) ? state.clients : []).filter(c => isOurBranch(c.branchId || (c as any).branch_id, c.addedBy || (c as any).added_by, undefined) && c.isActive !== false && !c.deletedAt);
    const activeClientIds = new Set(clients.map(c => c.id));
    let loans = (Array.isArray(state.loans) ? state.loans : []).filter(l => activeClientIds.has(l.clientId || (l as any).client_id) && !l.deletedAt);
    let payments = (Array.isArray(state.payments) ? state.payments : []).filter(p => activeClientIds.has(p.clientId || (p as any).client_id) && !p.deletedAt);
    let expenses = (Array.isArray(state.expenses) ? state.expenses : []).filter(e => isOurBranch(e.branchId || (e as any).branch_id, e.addedBy || (e as any).added_by, undefined));
    let collectionLogs = (Array.isArray(state.collectionLogs) ? state.collectionLogs : []).filter(log => isOurBranch(log.branchId || (log as any).branch_id, log.recordedBy || (log as any).recorded_by, undefined) && !log.deletedAt);
    let users = (Array.isArray(state.users) ? state.users : []).filter(u =>
      u.id.toLowerCase() === myIdLower ||
      myTeamIds.has(u.id.toLowerCase()) ||
      ((u.managedBy || (u as any).managed_by)?.toLowerCase() === branchId.toLowerCase()) ||
      user.role === Role.ADMIN
    );

    if (user.role === Role.COLLECTOR) {
      const myAssignedClientIds = new Set<string>();
      loans.forEach(l => { if ((l.collectorId || (l as any).collector_id) === user.id) myAssignedClientIds.add(l.clientId || (l as any).client_id); });
      clients = clients.filter(c => (c.addedBy || (c as any).added_by) === user.id || myAssignedClientIds.has(c.id));
      const visibleClientIds = new Set(clients.map(c => c.id));
      loans = loans.filter(l => visibleClientIds.has(l.clientId || (l as any).client_id));
      payments = payments.filter(p => visibleClientIds.has(p.clientId || (p as any).client_id));
      collectionLogs = collectionLogs.filter(log => log.clientId && visibleClientIds.has(log.clientId));
      users = users.filter(u => u.id === user.id);
    }

    return { ...state, clients, loans, payments, expenses, collectionLogs, users, settings: resolvedSettings };
  }, [state, resolvedSettings]);

  // ACTION HANDLERS
  const handleLogin = (user: User) => {
    const normalizedRole = (user.role as string).toLowerCase() === 'admin' ? Role.ADMIN : user.role;
    const normalizedUser = { ...user, role: normalizedRole };
    setState(prev => ({ ...prev, currentUser: normalizedUser }));
    setActiveTab(normalizedRole === Role.COLLECTOR ? 'route' : 'dashboard');
    // Only clear legacy timestamps to avoid blanking the dashboard on reconnect
    localStorage.removeItem('last_sync_timestamp');
    localStorage.removeItem('last_sync_timestamp_v6');
    // Always trigger a pull from Supabase on login to refresh data (handles cache-cleared scenarios)
    setTimeout(() => {
      pullData(false).then(newData => {
        if (newData) handleRealtimeData(newData);
      });
    }, 500);


    // Auto-reconnect Bluetooth on login for shared devices (Aggressive v6.1.161)
    import('./services/bluetoothPrinterService').then(({ forceReconnect, startConnectionKeeper }) => {
      startConnectionKeeper();
      forceReconnect().catch(console.error);
    });
  };

  const handleLogout = async () => {
    setState((prev: AppState) => ({ ...prev, currentUser: null }));
    if (navigator.onLine) await supabase.auth.signOut();
    await Preferences.remove({ key: 'NATIVE_CURRENT_USER' });
  };

  const addUser = async (user: User) => {
    const newUser = { ...user, managedBy: user.managedBy || (state.currentUser?.role === Role.MANAGER || state.currentUser?.role === Role.ADMIN ? state.currentUser.id : undefined) };

    // Si es un Gerente, inicializamos sus datos de empresa por defecto como "A COMPLETAR"
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
      // Persistimos la configuración inicial en el servidor
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

    // Sync auth.users via Edge Function when credentials change (username or password)
    // This ensures login continues to work after editing collector credentials
    if (navigator.onLine) {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          // Find the old user to detect credential changes
          const oldUser = state.users.find(u => u.id === updatedUser.id);
          const usernameChanged = oldUser && oldUser.username !== updatedUser.username;
          const passwordChanged = oldUser && oldUser.password !== updatedUser.password;

          if (usernameChanged || passwordChanged) {
            const payload: any = { userId: updatedUser.id };
            if (usernameChanged) payload.newUsername = updatedUser.username;
            if (passwordChanged) payload.newPassword = updatedUser.password;

            const { error: fnError } = await supabase.functions.invoke('update-auth-user', {
              body: payload
            });
            if (fnError) {
              console.error('[updateUser] Failed to sync auth.users:', fnError);
            } else {
              console.log('[updateUser] auth.users synced successfully for:', updatedUser.username);
            }
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

    // 1. Enviar Señal Soft-Delete a Supabase para el Gerente y sus Cobradores
    const usersToDelete = state.users.filter(u => u.id === userId || u.managedBy === userId);
    usersToDelete.forEach(u => {
      // Inyectamos deletedAt para que nadie más lo descargue o lo vea activo
      pushUser({ ...u, deletedAt: deletedTimestamp, updated_at: deletedTimestamp } as any);
    });

    // 2. Eliminar localmente de la vista inmediata
    setState(prev => ({ ...prev, users: prev.users.filter(u => u.id !== userId && u.managedBy !== userId) }));
    await handleForceSync(false);
  };

  const updateSettings = async (newSettings: AppSettings) => {
    const branchId = getBranchId(state.currentUser);
    setState(prev => ({ ...prev, settings: newSettings, branchSettings: { ...(prev.branchSettings || {}), [branchId]: newSettings } }));
    pushSettings(branchId, newSettings);
    handleForceSync(false);
  };

  const addClient = async (client: Client, loan?: Loan) => {
    const branchId = getBranchId(state.currentUser);
    const newClient = { ...client, branchId, isActive: true, createdAt: new Date().toISOString(), updated_at: new Date().toISOString() };

    // Optimistic Update
    setState(prev => ({ ...prev, clients: [...prev.clients, newClient] }));

    // Background Push
    pushClient(newClient);
    if (loan) addLoan(loan);
    handleForceSync(true);
  };

  const addLoan = async (loan: Loan) => {
    const branchId = getBranchId(state.currentUser);
    const newLoan = { ...loan, branchId, updated_at: new Date().toISOString() };

    // Optimistic Update
    setState(prev => ({ ...prev, loans: [newLoan, ...prev.loans] }));

    // Background Push
    pushLoan(newLoan);
    handleForceSync(true);
  };

  const updateClient = async (updatedClient: Client) => {
    const clientWithStamp = { ...updatedClient, updated_at: new Date().toISOString() };
    setState(prev => ({ ...prev, clients: prev.clients.map(c => c.id === clientWithStamp.id ? clientWithStamp : c) }));
    pushClient(clientWithStamp);
    handleForceSync(false);
  };

  const updateLoan = async (updatedLoan: Loan) => {
    const loanWithStamp = { ...updatedLoan, updated_at: new Date().toISOString() };
    setState(prev => ({ ...prev, loans: prev.loans.map(l => l.id === loanWithStamp.id ? loanWithStamp : l) }));
    pushLoan(loanWithStamp);
    handleForceSync(false);
  };

  const recalculateAllLoansBalances = async () => {
    console.log('Iniciando recalculación global de saldos...');
    try {
      const updatedLoans = state.loans.map(loan => {
        const totalPaid = calculateTotalPaidFromLogs(loan, state.collectionLogs);
        const balance = Math.max(0, loan.totalAmount - totalPaid);

        // Determinar si el préstamo está pagado
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



      console.log('Recalculación global completada con éxito.');
      alert('Todos los saldos han sido recalculados y sincronizados correctamente.');
    } catch (error) {
      console.error('Error en recalculación global:', error);
      alert('No se pudo completar la recalculación global.');
    }
  };

  const recalculateLoanStatus = async (loanId: string, providedLogs?: CollectionLog[]) => {
    const loan = state.loans.find(l => l.id === loanId);
    if (!loan) return null;

    const useLogs = providedLogs || state.collectionLogs;
    const totalPaid = calculateTotalPaidFromLogs(loan, useLogs);
    const balance = Math.max(0, loan.totalAmount - totalPaid);

    // Si el saldo es 0 o menor, está pagado.
    const isPaid = balance <= 0.01;
    let newStatus = loan.status;
    if (isPaid) {
      newStatus = LoanStatus.PAID;
    } else if (loan.status === LoanStatus.PAID) {
      newStatus = LoanStatus.ACTIVE;
    }

    const updatedLoan = {
      ...loan,
      totalPaid,
      balance,
      status: newStatus,
      updatedAt: new Date().toISOString()
    };

    const updatedLoans = state.loans.map(l => l.id === loanId ? updatedLoan : l);
    setState(prev => ({ ...prev, loans: updatedLoans }));


    // Si hubo cambio de estado, sincronizar con el servidor
    if (newStatus !== loan.status) {
      await pushLoan(updatedLoan);
    }
    return updatedLoan;
  };

  const deleteLoan = async (loanId: string) => {
    const loan = state.loans.find(l => l.id === loanId);
    if (!loan) return;

    // 1. Optimistic Update (Immediate UI response)
    setState(prev => ({ ...prev, loans: prev.loans.filter(l => l.id !== loanId) }));

    // 2. Specialized Deletion Sync (handles deleted_at + tracking)
    deleteRemoteLoan(loanId);

    // 3. Optional: Extra sync trigger
    handleForceSync(false);
  };

  const addCollectionAttempt = async (log: CollectionLog) => {
    const branchId = getBranchId(state.currentUser);
    const newLog = { ...log, branchId, recordedBy: state.currentUser?.id, updated_at: new Date().toISOString() };

    // 1. ASYNC FIRST: Ensure the log is pushed/queued
    pushLog(newLog);

    // 2. CALCULATE UPDATES (Synchronous logic based on current state)
    let updatedLoans = [...state.loans];
    let updatedPayments = [...state.payments];
    const newPaymentsForSync: PaymentRecord[] = [];
    const loansToSync: Loan[] = [];

    // Si es un log de apertura, no procesamos abonos ni cuotas
    if (newLog.type === CollectionLogType.OPENING) {
      setState(prev => ({ ...prev, collectionLogs: [newLog, ...prev.collectionLogs] }));
      handleForceSync(true);
      return;
    }

    if (newLog.type === CollectionLogType.PAYMENT && newLog.amount) {
      let totalToApply = Math.round(newLog.amount * 100) / 100;
      updatedLoans = updatedLoans.map(loan => {
        if (loan.id === newLog.loanId) {
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
              created_at: new Date().toISOString()
            };

            newPaymentsForSync.push(pRec);
            updatedPayments.push(pRec);
          }

          const allPaid = newInstallments.length > 0 && newInstallments.every(inst => inst.status === PaymentStatus.PAID);
          const updatedLoan = { ...loan, installments: newInstallments, status: allPaid ? LoanStatus.PAID : LoanStatus.ACTIVE, updated_at: new Date().toISOString() };
          loansToSync.push(updatedLoan);
          return updatedLoan;
        }
        return loan;
      });
    }

    // 3. UPDATE UI (Optimistic)
    setState(prev => ({ ...prev, loans: updatedLoans, payments: updatedPayments, collectionLogs: [newLog, ...prev.collectionLogs] }));

    // 4. EXECUTE SIDE EFFECTS (Outside setState)
    if (newPaymentsForSync.length > 0 || loansToSync.length > 0) {
      for (const p of newPaymentsForSync) pushPayment(p);
      for (const l of loansToSync) pushLoan(l);
    }

    handleForceSync(true);
  };

  const deleteCollectionLog = async (logId: string) => {
    // Permission check
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
      // 1. Optimistic Update (Immediate)
      const updatedLogs = state.collectionLogs.filter(l => l.id !== logId);
      const updatedPayments = state.payments.filter(p => !p.id.startsWith(`pay-${logId}-`));

      setState(prev => ({
        ...prev,
        collectionLogs: updatedLogs,
        payments: updatedPayments
      }));

      // Auto-save handles persistence via useEffect on state change

      // 2. Recalculate Loan Status synchronously for UI
      if (logToDelete.loanId) {
        await recalculateLoanStatus(logToDelete.loanId, updatedLogs);
      }

      // 3. Remote Sync (Background)
      deleteRemoteLog(logId).catch(e => console.error("Sync error in deleteCollectionLog:", e));

      const related = state.payments.filter(p => p.id.startsWith(`pay-${logId}-`));
      for (const p of related) {
        deleteRemotePayment(p.id).catch(() => { });
      }

    } catch (err: any) {
      console.error("Critical error deleting log:", err);
      alert("Error al eliminar el registro.");
    }
  };

  const updateCollectionLog = async (logId: string, newAmount: number) => {
    try {
      const logToUpdate = state.collectionLogs.find(l => l.id === logId);
      if (!logToUpdate) return;

      // 1. Optimistic Update
      const updatedLogs = state.collectionLogs.map(l =>
        l.id === logId ? { ...l, amount: newAmount, updated_at: new Date().toISOString() } : l
      );

      setState(prev => ({
        ...prev,
        collectionLogs: updatedLogs
      }));


      // 2. Recalculate Loan
      if (logToUpdate.loanId) {
        await recalculateLoanStatus(logToUpdate.loanId, updatedLogs);
      }

      // 3. Remote Sync (Background)
      supabase.from('collection_logs').update({ amount: newAmount, updated_at: new Date().toISOString() }).eq('id', logId).then(({ error }) => {
        if (error) console.error("Error updating remote log:", error);
      });

      if (logToUpdate.type === CollectionLogType.PAYMENT) {
        // Update local payments too for consistency
        const updatedPayments = state.payments.map(p =>
          p.id.startsWith(`pay-${logId}-`) ? { ...p, amount: newAmount, updated_at: new Date().toISOString() } : p
        );
        setState(prev => ({ ...prev, payments: updatedPayments }));

        supabase.from('payments').update({ amount: newAmount, updated_at: new Date().toISOString() }).eq('logId', logId).then(({ error }) => {
          if (error) console.error("Error updating remote payment:", error);
        });
      }

    } catch (error: any) {
      console.error('Error updating collection log:', error);
      alert('Error al actualizar el cobro');
    }
  };

  const updateCollectionLogNotes = (logId: string, notes: string) => {
    setState(prev => ({
      ...prev,
      collectionLogs: prev.collectionLogs.map(l => l.id === logId ? { ...l, notes } : l)
    }));
  };

  const addExpense = (expense: Expense) => {
    const branchId = getBranchId(state.currentUser);
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

  // --- Pull to Refresh Logic ---

  const [pullY, setPullY] = useState(0);
  const [isPulling, setIsPulling] = useState(false);
  const pullStartY = useRef(0);
  const MAX_PULL = 120;
  const REFRESH_THRESHOLD = 80;

  const handleTouchStart = (e: React.TouchEvent) => {
    if (window.scrollY <= 5) {
      pullStartY.current = e.touches[0].clientY;
      setIsPulling(true);
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isPulling) return;
    const dy = e.touches[0].clientY - pullStartY.current;
    if (dy > 0 && window.scrollY <= 5) {
      setPullY(Math.min(dy * 0.4, MAX_PULL));
    } else {
      setIsPulling(false);
      setPullY(0);
    }
  };

  const handleTouchEnd = () => {
    if (!isPulling) return;
    if (pullY > REFRESH_THRESHOLD) {
      setPullY(50);
      // Forzar una sincronización completa al tirar hacia abajo
      handleForceSync(false, "¡Sincronizando Todo!", true).finally(() => setPullY(0));
    } else {
      setPullY(0);
    }
    setIsPulling(false);
  };

  if (!state.currentUser) {
    return (
      <>
        <Login onLogin={handleLogin} users={state.users} onGenerateManager={() => { }} onSyncUser={handleSyncUser} onForceSync={() => handleForceSync(true)} />
      </>
    );
  }

  const isPowerUser = state.currentUser.role === Role.ADMIN || state.currentUser.role === Role.MANAGER;
  const isAdmin = state.currentUser.role === Role.ADMIN;
  const t = getTranslation(state.settings.language).menu;

  return (
    <ErrorBoundary>
      <LocationEnforcer isRequired={!!state.currentUser.requiresLocation} onLocationEnabled={() => { }} />
      <div
        className="flex flex-col md:flex-row min-h-full bg-slate-50 relative overflow-x-hidden"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        style={{ transform: `translateY(${pullY}px)`, transition: isPulling ? 'none' : 'transform 0.3s ease-out' }}
      >
        {/* Pull Indicator Overlay */}
        <div className="absolute top-0 left-0 right-0 flex justify-center items-center pointer-events-none z-[200]" style={{ height: pullY, opacity: pullY / REFRESH_THRESHOLD, marginTop: -40 }}>
          {pullY > 10 && <div className="p-2 bg-white rounded-full shadow-md">
            <i className={`fa-solid fa-arrows-rotate text-emerald-600 ${pullY > REFRESH_THRESHOLD ? 'animate-spin' : ''}`}></i>
          </div>}
        </div>
        {/* MOBILE HEADER */}
        <header className="md:hidden bg-white border-b border-slate-100 px-4 py-3 sticky top-0 z-[100] shadow-sm">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-3">
              <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${isMobileMenuOpen ? 'bg-slate-900 text-white shadow-lg' : 'bg-slate-100 text-slate-600'}`}>
                <i className={`fa-solid ${isMobileMenuOpen ? 'fa-xmark' : 'fa-bars-staggered'}`}></i>
              </button>
              <div>
                <h1 className="text-sm font-black text-emerald-600 uppercase tracking-tighter leading-none">{state.settings.companyName || <span className="text-[10px] font-black opacity-40 ml-2">ANEXO COBRO</span>}</h1>
                <div className="flex items-center gap-2 mt-1">
                  <div className={`w-2 h-2 rounded-full ${isOnline ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}`}></div>
                  <span className={`text-[8px] font-black uppercase tracking-widest ${isOnline ? 'text-emerald-600' : 'text-red-600'}`}>
                    {isOnline ? 'Conectado' : 'Sin Internet'}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {queueLength > 0 && <span className="text-[8px] font-black text-amber-600 bg-amber-50 px-2 py-1 rounded-lg border border-amber-200 animate-pulse">{queueLength}</span>}
              <span className="text-[9px] font-black text-slate-400 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200 uppercase tracking-tighter">v6.1.177</span>
              <div className="w-8 h-8 rounded-lg bg-emerald-600 flex items-center justify-center text-white text-xs font-black" onClick={() => setActiveTab('profile')}>
                {state.currentUser?.name.charAt(0)}
              </div>
            </div>
          </div>

          {/* MOBILE MENU OVERLAY */}
          {isMobileMenuOpen && (
            <div className="fixed inset-0 top-[52px] left-0 w-full h-[calc(100vh-52px)] bg-white/95 backdrop-blur-md border-b border-slate-200 py-4 px-4 grid grid-cols-2 gap-2 animate-fadeIn shadow-2xl z-[90] overflow-y-auto">
              {[
                { id: 'dashboard', icon: 'fa-chart-line', label: t.dashboard, powerOnly: true },
                { id: 'clients', icon: 'fa-users', label: t.clients, powerOnly: false },
                { id: 'loans', icon: 'fa-money-bill-wave', label: t.loans, powerOnly: false },
                { id: 'route', icon: 'fa-route', label: t.route, powerOnly: false },
                { id: 'notifications', icon: 'fa-bell', label: t.notifications, powerOnly: false },
                { id: 'collectors', icon: 'fa-user-gear', label: t.collectors, powerOnly: true },
                { id: 'performance', icon: 'fa-chart-column', label: t.performance, powerOnly: true },
                { id: 'expenses', icon: 'fa-wallet', label: t.expenses, powerOnly: true },
                { id: 'simulator', icon: 'fa-calculator', label: t.simulator, powerOnly: false },
                { id: 'reports', icon: 'fa-file-invoice-dollar', label: t.reports, powerOnly: true },
                { id: 'commission', icon: 'fa-percent', label: t.commission, powerOnly: false },
                { id: 'generator', icon: 'fa-file-signature', label: 'Pagares', powerOnly: false },
                { id: 'profile', icon: 'fa-user-circle', label: t.profile, powerOnly: false },
                { id: 'settings', icon: 'fa-gear', label: t.settings, powerOnly: false },
                { id: 'managers', icon: 'fa-user-tie', label: t.managers, adminOnly: true },
              ].filter(item => {
                if (item.adminOnly) return isAdmin;
                if (item.powerOnly) return isPowerUser;
                return true;
              }).map((item) => (
                <button key={item.id} onClick={() => { setActiveTab(item.id); setIsMobileMenuOpen(false); }} className={`flex items-center gap-2 p-2.5 rounded-2xl transition-all border ${activeTab === item.id ? 'bg-emerald-600 text-white border-emerald-500 shadow-lg' : 'bg-white text-slate-500 border-slate-100 active:bg-slate-50'}`}>
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${activeTab === item.id ? 'bg-white/20' : 'bg-slate-50 text-emerald-500'}`}><i className={`fa-solid ${item.icon} text-xs`}></i></div>
                  <span className="text-[9px] font-black uppercase tracking-wider truncate">{item.label}</span>
                </button>
              ))}
              <div className="col-span-2 p-1">
                <div
                  className={`w-full flex items-center justify-between gap-3 p-4 rounded-2xl border transition-all ${isSyncing ? 'bg-emerald-50 text-emerald-700 border-emerald-200 shadow-inner' : 'bg-slate-50 text-slate-400 border-slate-200'}`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isSyncing ? 'bg-emerald-600 text-white animate-pulse' : 'bg-slate-200 text-slate-400'}`}>
                      <i className={`fa-solid fa-sync ${isSyncing ? 'animate-spin' : ''}`}></i>
                    </div>
                    <div className="flex flex-col items-start leading-tight">
                      <span className={`text-[11px] font-black uppercase tracking-widest ${isSyncing ? 'text-emerald-600' : ''}`}>
                        {isSyncing ? 'SINCRONIZANDO...' : 'Sincro Turbo (4s)'}
                      </span>
                      <span className="text-[8px] font-bold opacity-70 uppercase tracking-tighter">Automático Total</span>
                    </div>
                  </div>
                  {isSyncing && (
                    <div className="flex gap-1.5 mr-2">
                      <div className="w-2 h-2 bg-emerald-500 rounded-full animate-bounce"></div>
                      <div className="w-2 h-2 bg-emerald-500 rounded-full animate-bounce [animation-delay:0.2s]"></div>
                      <div className="w-2 h-2 bg-emerald-500 rounded-full animate-bounce [animation-delay:0.4s]"></div>
                    </div>
                  )}
                </div>
              </div>
              <button onClick={handleLogout} className="col-span-2 flex items-center justify-center gap-3 p-4 mt-2 rounded-2xl bg-red-50 text-red-600 border border-red-100 font-black uppercase text-[10px] tracking-widest"><i className="fa-solid fa-power-off"></i> CERRAR SESIÓN</button>
            </div>
          )}
        </header>

        <FloatingBackButton onClick={() => setActiveTab(isPowerUser ? 'dashboard' : 'route')} visible={activeTab !== 'dashboard' && activeTab !== 'route'} />
        <Sidebar
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          onLogout={handleLogout}
          user={state.currentUser}
          state={filteredState}
          isSyncing={isSyncing}
          isFullSyncing={isFullSyncing}
        />
        <main className="flex-1 p-2 md:p-8 mobile-scroll-container">
          <div className="max-w-[1400px] mx-auto pb-12">
            {activeTab === 'dashboard' && isPowerUser && <Dashboard state={filteredState} />}
            {activeTab === 'clients' && <Clients state={filteredState} addClient={addClient} addLoan={addLoan} updateClient={updateClient} updateLoan={updateLoan} deleteCollectionLog={deleteCollectionLog} updateCollectionLog={updateCollectionLog} updateCollectionLogNotes={updateCollectionLogNotes} addCollectionAttempt={addCollectionAttempt} globalState={state} onForceSync={handleForceSync} deleteLoan={deleteLoan}
              recalculateLoanStatus={recalculateLoanStatus}
              setActiveTab={setActiveTab}
              fetchClientPhotos={fetchClientPhotos}
            />
            }
            {activeTab === 'loans' && <Loans state={filteredState} addLoan={addLoan} updateLoanDates={() => { }} addCollectionAttempt={addCollectionAttempt} deleteCollectionLog={deleteCollectionLog} onForceSync={handleForceSync} />}
            {activeTab === 'route' && <CollectionRoute state={filteredState} addCollectionAttempt={addCollectionAttempt} deleteCollectionLog={deleteCollectionLog} updateClient={updateClient} deleteClient={async (clientId: string) => {
              setState(prev => ({
                ...prev,
                clients: prev.clients.filter(c => c.id !== clientId),
                loans: prev.loans.filter(l => l.clientId !== clientId),
                collectionLogs: prev.collectionLogs.filter(l => l.clientId !== clientId),
              }));
              await deleteRemoteClient(clientId);
              await handleForceSync(true);
            }} onForceSync={handleForceSync} />}
            {activeTab === 'notifications' && <Notifications state={filteredState} />}
            {activeTab === 'expenses' && isPowerUser && <Expenses state={filteredState} addExpense={addExpense} removeExpense={removeExpense} updateInitialCapital={updateInitialCapital} />}
            {activeTab === 'commission' && <CollectorCommission state={filteredState} setCommissionPercentage={(p) => { setState(prev => ({ ...prev, commissionPercentage: p })); setTimeout(() => handleForceSync(true), 200); }} updateCommissionBrackets={updateCommissionBrackets} deleteCollectionLog={deleteCollectionLog} />}
            {activeTab === 'collectors' && <Collectors state={filteredState} onAddUser={addUser} onUpdateUser={updateUser} onDeleteUser={deleteUser} updateSettings={updateSettings} />}
            {activeTab === 'managers' && isAdmin && <Managers state={filteredState} onAddUser={addUser} onUpdateUser={updateUser} onDeleteUser={deleteUser} />}
            {activeTab === 'performance' && isPowerUser && <CollectorPerformance state={filteredState} />}
            {activeTab === 'simulator' && <Simulator settings={resolvedSettings} />}
            {activeTab === 'reports' && isPowerUser && <Reports state={filteredState} settings={resolvedSettings} />}
            {activeTab === 'settings' && <Settings state={filteredState} updateSettings={updateSettings} setActiveTab={setActiveTab} onForceSync={() => handleForceSync(true)} onClearQueue={clearQueue} isOnline={isOnline} isSyncing={isSyncing} isFullSyncing={isFullSyncing} onDeepReset={handleDeepReset} />}
            {activeTab === 'generator' && <Generator settings={resolvedSettings} />}
            {activeTab === 'profile' && <Profile state={filteredState} onUpdateUser={updateUser} />}
          </div>
        </main>
        {isPowerUser && <LicenseReminder currentUser={state.currentUser} users={state.users} />}
      </div>
    </ErrorBoundary>
  );
};

export default App;
