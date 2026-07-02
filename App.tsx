import React, { useState, useEffect, useRef } from 'react';
import { Role, LoanStatus, CollectionLogType, User, Loan, Client, CollectionLog } from './types';
import { supabase } from './utils/supabaseClient';
import Sidebar from './components/Sidebar';
import Dashboard from './components/Dashboard';
import Clients from './components/Clients';
import Loans from './components/Loans';
import CollectionRoute from './components/CollectionRoute';
import Expenses from './components/Expenses';
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
import { formatCurrency } from './utils/helpers';
import { useAppInitialization, CURRENT_VERSION_ID } from './hooks/useAppInitialization';
import { useAppSyncEngine } from './hooks/useAppSyncEngine';
import { useAppActions } from './hooks/useAppActions';
import { startConnectionKeeper } from './services/bluetoothPrinterService';
import { useGPSWarmer } from './hooks/useGPSWarmer';
import { useLiveTracker } from './hooks/useLiveTracker';
import FloatingBackButton from './components/FloatingBackButton';
import LocationEnforcer from './components/LocationEnforcer';
import ErrorBoundary from './components/ErrorBoundary';
import LicenseReminder from './components/LicenseReminder';
import AutoUpdater from './components/AutoUpdater';
import MobileCollectorMode from './components/MobileCollectorMode';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [initialDossierClientId, setInitialDossierClientId] = useState<string | null>(null);
  const [pullY, setPullY] = useState(0);
  const [isPulling, setIsPulling] = useState(false);
  const pullStartY = useRef(0);
  const MAX_PULL = 120;
  const REFRESH_THRESHOLD = 80;

  // 1. Initialize State and App Data
  const { state, setState, isInitializing, resolvedSettings } = useAppInitialization();

  // 2. Initialize Sync Engine
  const sync = useAppSyncEngine(state, setState, resolvedSettings, isInitializing);
  const { isSyncing, isFullSyncing, isOnline, queueLength, filteredState, handleForceSync, handleDeepReset, clearQueue } = sync;

  // 3. Initialize GPS Warmer (Global Background Tracking)
  const activeLocation = useGPSWarmer(state.currentUser);

  // 3.5 Initialize Live Tracker (Broadcasts location for Admins)
  useLiveTracker(state.currentUser, activeLocation);

  // 4. Initialize Actions
  const actions = useAppActions(state, setState, setActiveTab, sync);
  const { 
    handleLogin, handleLogout, addUser, updateUser, deleteUser, updateSettings,
    addClient, addLoan, updateClient, deleteClient, updateLoan, 
    recalculateLoanStatus, deleteLoan: deleteLoanAction, addCollectionAttempt, 
    deleteCollectionLog, updateCollectionLog, addBulkData, updateCollectionLogNotes, 
    addExpense, removeExpense, updateExpense, updateInitialCapital, updateCommissionBrackets, 
    handleSyncUser, deleteRemoteClientAction, renewLoan 
  } = actions;

  // SESSION VALIDATION EFFECT: Prevenir que el dashboard cargue sin sesión de Supabase real
  useEffect(() => {
    if (isInitializing) return;
    const validateSession = async () => {
      if (state.currentUser && navigator.onLine) {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          console.warn("[App] Session mismatch detected. Forcing login.");
          handleLogout();
        }
      }
    };
    validateSession();
  }, [state.currentUser?.id, handleLogout, isInitializing]);

  const hasAttemptedInitialSyncRef = useRef(false);

  // GLOBAL EXPOSURE: For legacy handleSync alias support
  useEffect(() => {
    if (isInitializing) return;
    (window as any)._triggerForceSync = () => handleForceSync(true);
    
    // AUTO-SYNC ON EMPTY DATA: Si el usuario entra y no hay datos, forzar una descarga inicial
    if (state.currentUser && state.clients.length === 0 && !isSyncing && !isFullSyncing && navigator.onLine && !hasAttemptedInitialSyncRef.current) {
      hasAttemptedInitialSyncRef.current = true;
      console.log("[App] No data found. Triggering initial full sync...");
      const timer = setTimeout(() => {
          handleForceSync(false, "¡Descargando Datos!", true);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [handleForceSync, state.currentUser?.id, state.clients.length, isSyncing, isFullSyncing, isInitializing]);

  // Removed aggressive Bluetooth initialization here to prevent Samsung A13 Android permissions crash

  // Pull to Refresh Handlers
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
      handleForceSync(false, "¡Sincronizando Todo!", true).finally(() => setPullY(0));
    } else {
      setPullY(0);
    }
    setIsPulling(false);
  };

  if (isInitializing) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-slate-500 font-black uppercase text-xs tracking-widest">Cargando Sistema...</p>
        </div>
      </div>
    );
  }

  if (!state.currentUser) {
    return (
      <Login 
        onLogin={handleLogin} 
        users={state.users} 
        onGenerateManager={() => { }} 
        onSyncUser={handleSyncUser} 
        onForceSync={() => handleForceSync(true)} 
      />
    );
  }

  const isPowerUser = state.currentUser.role === Role.ADMIN || state.currentUser.role === Role.MANAGER;
  const isAdmin = state.currentUser.role === Role.ADMIN;
  const t = getTranslation(state.settings.language).menu;

  return (
    <ErrorBoundary>
      <AutoUpdater />
      <LocationEnforcer isRequired={!!state.currentUser.requiresLocation} onLocationEnabled={() => { }} />
      <div
        className="flex flex-col md:flex-row min-h-full bg-slate-300 relative overflow-x-hidden"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        style={{ transform: `translateY(${pullY}px)`, transition: isPulling ? 'none' : 'transform 0.3s ease-out' }}
      >
        {/* Pull Indicator Overlay */}
        <div className="absolute top-0 left-0 right-0 flex justify-center items-center pointer-events-none z-[200]" style={{ height: pullY, opacity: pullY / REFRESH_THRESHOLD, marginTop: -40 }}>
          {pullY > 10 && (
            <div className="p-2 bg-white rounded-full shadow-md">
              <i className={`fa-solid fa-arrows-rotate text-emerald-600 ${pullY > REFRESH_THRESHOLD ? 'animate-spin' : ''}`}></i>
            </div>
          )}
        </div>

        {/* MOBILE HEADER */}
        <header className="md:hidden bg-white border-b border-slate-100 px-4 py-3 sticky top-0 z-[100] shadow-sm">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-3">
              <button 
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} 
                className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${isMobileMenuOpen ? 'bg-slate-900 text-white shadow-lg' : 'bg-slate-100 text-slate-600'}`}
              >
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
              <p className="text-[10px] text-slate-400 font-mono">v{CURRENT_VERSION_ID.split('-')[0]}</p>
              {localStorage.getItem('syncQueue') && JSON.parse(localStorage.getItem('syncQueue') || '[]').filter((i:any) => i.lastError).length > 0 && <span className="text-[8px] text-red-500 max-w-[200px] truncate">{JSON.parse(localStorage.getItem('syncQueue') || '[]').filter((i:any) => i.lastError).map((i:any) => i.lastError).join(' | ')}</span>}
              <div className="w-8 h-8 rounded-lg bg-emerald-600 flex items-center justify-center text-white text-xs font-black" onClick={() => setActiveTab('profile')}>
                {state.currentUser?.name.charAt(0)}
              </div>
            </div>
          </div>

          {/* MOBILE MENU OVERLAY */}
          {isMobileMenuOpen && (
            <div className="fixed inset-0 top-[52px] left-0 w-full h-[calc(100vh-52px)] bg-slate-900 border-b border-slate-700 py-4 px-4 grid grid-cols-2 gap-2 animate-fadeIn shadow-2xl z-[90] overflow-y-auto">
              {[
                { id: 'dashboard', icon: 'fa-chart-line', label: t.dashboard, powerOnly: true },
                { id: 'clients', icon: 'fa-users', label: t.clients, powerOnly: false },
                { id: 'loans', icon: 'fa-money-bill-wave', label: t.loans, powerOnly: false },
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
                <button 
                  key={item.id} 
                  onClick={() => { setActiveTab(item.id); setIsMobileMenuOpen(false); }} 
                  className={`flex items-center gap-2 p-2.5 rounded-2xl transition-all border ${activeTab === item.id ? 'bg-emerald-600 text-white border-emerald-500 shadow-lg' : 'bg-white text-slate-500 border-slate-100 active:bg-slate-50'}`}
                >
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${activeTab === item.id ? 'bg-white/20' : 'bg-slate-50 text-emerald-500'}`}><i className={`fa-solid ${item.icon} text-xs`}></i></div>
                  <span className="text-[9px] font-black uppercase tracking-wider truncate">{item.label}</span>
                </button>
              ))}
              <div className="col-span-2 p-1">
                <button 
                  disabled={isSyncing}
                  onClick={() => handleForceSync(false)}
                  className={`w-full flex items-center justify-between gap-3 p-4 rounded-2xl border transition-all active:scale-95 ${isSyncing ? 'bg-emerald-50 text-emerald-700 border-emerald-200 shadow-inner' : 'bg-slate-50 text-slate-600 border-slate-200 shadow-md cursor-pointer'}`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isSyncing ? 'bg-emerald-600 text-white animate-pulse' : 'bg-emerald-100 text-emerald-600'}`}>
                      <i className={`fa-solid fa-sync ${isSyncing ? 'animate-spin' : ''}`}></i>
                    </div>
                    <div className="flex flex-col items-start leading-tight">
                      <span className={`text-[11px] font-black uppercase tracking-widest ${isSyncing ? 'text-emerald-600' : ''}`}>
                        {isSyncing ? 'SINCRONIZANDO...' : 'SINCRO TURBO (4S)'}
                      </span>
                      <span className="text-[8px] font-bold opacity-70 uppercase tracking-tighter">Automático Total / Manual</span>
                    </div>
                  </div>
                </button>
              </div>
              <button 
                onClick={handleLogout} 
                className="col-span-2 flex items-center justify-center gap-3 p-4 mt-2 rounded-2xl bg-red-50 text-red-600 border border-red-100 font-black uppercase text-[10px] tracking-widest"
              >
                <i className="fa-solid fa-power-off"></i> CERRAR SESIÓN
              </button>
            </div>
          )}
        </header>

        <FloatingBackButton 
          onClick={() => setActiveTab(isPowerUser ? 'dashboard' : 'route')} 
          visible={activeTab !== 'dashboard' && activeTab !== 'route'} 
        />
        
        <Sidebar
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          onLogout={handleLogout}
          user={state.currentUser}
          state={filteredState}
          isSyncing={isSyncing}
          isFullSyncing={isFullSyncing}
        />

        <main className={`flex-1 ${activeTab === 'reports' ? 'p-0' : 'p-2 md:p-8'} mobile-scroll-container`}>
          <div className={`${activeTab === 'reports' ? 'w-full' : 'max-w-[1400px] mx-auto'} pb-12`}>
            {activeTab === 'dashboard' && isPowerUser && <Dashboard state={filteredState} />}
            {activeTab === 'clients' && (
              <Clients 
                state={filteredState} 
                addClient={addClient} 
                addLoan={addLoan} 
                updateClient={updateClient} 
                updateLoan={updateLoan} 
                deleteCollectionLog={deleteCollectionLog} 
                updateCollectionLog={updateCollectionLog} 
                updateCollectionLogNotes={updateCollectionLogNotes} 
                addCollectionAttempt={addCollectionAttempt} 
                globalState={state} 
                onForceSync={handleForceSync} 
                deleteLoan={deleteLoanAction}
                recalculateLoanStatus={recalculateLoanStatus}
                setActiveTab={setActiveTab}
                fetchClientPhotos={sync.fetchClientPhotos}
                deleteClient={deleteClient}
                addBulkData={addBulkData}
                renewLoan={renewLoan}
                setState={setState}
                pushLoan={sync.pushLoan}
                activeLocation={activeLocation}
                initialDossierClientId={initialDossierClientId}
                onClearInitialDossier={() => setInitialDossierClientId(null)}
              />
            )}
            {activeTab === 'loans' && (
              <Loans 
                state={filteredState} 
                addLoan={addLoan} 
                updateLoanDates={() => { }} 
                addCollectionAttempt={addCollectionAttempt} 
                deleteCollectionLog={deleteCollectionLog} 
                onForceSync={handleForceSync} 
                setActiveTab={setActiveTab}
                activeLocation={activeLocation}
              />
            )}
            {activeTab === 'route' && (
              !isPowerUser ? (
                <MobileCollectorMode 
                  state={filteredState} 
                  addCollectionAttempt={addCollectionAttempt} 
                  onForceSync={handleForceSync}
                  activeLocation={activeLocation}
                />
              ) : (
                <CollectionRoute 
                  state={filteredState} 
                  addCollectionAttempt={addCollectionAttempt} 
                  deleteCollectionLog={deleteCollectionLog} 
                  updateClient={updateClient} 
                  deleteClient={deleteRemoteClientAction} 
                  onForceSync={handleForceSync}
                  activeLocation={activeLocation}
                />
              )
            )}
            {activeTab === 'notifications' && <Notifications state={filteredState} />}
            {activeTab === 'expenses' && isPowerUser && (
              <Expenses 
                state={{ ...filteredState, expenses: state.expenses }} 
                addExpense={addExpense} 
                removeExpense={removeExpense} 
                updateExpense={updateExpense}
                updateInitialCapital={updateInitialCapital} 
                updateUser={updateUser}
                updateSettings={updateSettings}
                onViewClientDossier={(clientId) => {
                  setInitialDossierClientId(clientId);
                  setActiveTab('clients');
                }}
              />
            )}
            {activeTab === 'commission' && (
              <CollectorCommission 
                state={filteredState} 
                setCommissionPercentage={(p) => { 
                  setState(prev => ({ ...prev, commissionPercentage: p })); 
                  setTimeout(() => handleForceSync(true), 200); 
                }} 
                updateCommissionBrackets={updateCommissionBrackets} 
                deleteCollectionLog={deleteCollectionLog} 
                updateUser={updateUser}
              />
            )}
            {activeTab === 'collectors' && (
              <Collectors 
                state={filteredState} 
                onAddUser={addUser} 
                onUpdateUser={updateUser} 
                onDeleteUser={deleteUser} 
                updateSettings={updateSettings} 
                setActiveTab={setActiveTab} 
              />
            )}
            {activeTab === 'managers' && isAdmin && (
              <Managers 
                state={filteredState} 
                onAddUser={addUser} 
                onUpdateUser={updateUser} 
                onDeleteUser={deleteUser} 
                setActiveTab={setActiveTab} 
              />
            )}
            {activeTab === 'performance' && isPowerUser && <CollectorPerformance state={filteredState} />}
            {activeTab === 'simulator' && <Simulator settings={resolvedSettings} />}
            {activeTab === 'reports' && isPowerUser && <Reports state={filteredState} settings={resolvedSettings} />}
            {activeTab === 'settings' && (
              <Settings 
                state={filteredState} 
                updateSettings={updateSettings} 
                setActiveTab={setActiveTab} 
                onForceSync={() => handleForceSync(true)} 
                onClearQueue={clearQueue} 
                isOnline={isOnline} 
                isSyncing={isSyncing} 
                isFullSyncing={isFullSyncing} 
                onDeepReset={handleDeepReset} 
              />
            )}
            {activeTab === 'generator' && <Generator settings={resolvedSettings} />}
            {activeTab === 'profile' && <Profile state={filteredState} onUpdateUser={updateUser} />}
          </div>
        </main>
        {isPowerUser && <LicenseReminder currentUser={state.currentUser} users={filteredState.users} />}
      </div>
    </ErrorBoundary>
  );
};

export default App;
