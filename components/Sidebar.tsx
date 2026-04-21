import React, { useState, useEffect } from 'react';
import { CURRENT_VERSION_ID } from '../hooks/useAppInitialization';
import { User, Role, AppState, CountryCode } from '../types';
import { getTranslation } from '../utils/translations';
import { formatCountryTime, getCountryName } from '../utils/helpers';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  onLogout: () => void;
  user: User;
  state: AppState;
  isSyncing?: boolean;
  isFullSyncing?: boolean;
}

const Sidebar: React.FC<SidebarProps> = ({ activeTab, setActiveTab, onLogout, user, state, isSyncing, isFullSyncing }) => {
  const isAdmin = user.role === Role.ADMIN;
  const isManager = user.role === Role.MANAGER;
  const isPowerUser = isAdmin || isManager;

  const [currentTime, setCurrentTime] = useState<string>('');
  const t = getTranslation(state.settings.language).menu;

  const countryCode = state.settings.country as CountryCode;
  const countryName = getCountryName(countryCode);

  const flags: Record<string, string> = {
    AG: '🇦🇬', AR: '🇦🇷', BS: '🇧🇸', BB: '🇧🇧', BZ: '🇧🇿', BO: '🇧🇴', BR: '🇧🇷',
    CA: '🇨🇦', CL: '🇨🇱', CO: '🇨🇴', CR: '🇨🇷', CU: '🇨🇺', DM: '🇩🇲', EC: '🇪🇨',
    SV: '🇸🇻', US: '🇺🇸', GD: '🇬🇩', GT: '🇬🇹', GY: '🇬🇾', HT: '🇭🇹', HN: '🇭🇳',
    JM: '🇯🇲', MX: '🇲🇽', NI: '🇳🇮', PA: '🇵🇦', PY: '🇵🇾', PE: '🇵🇪', DO: '🇩🇴',
    KN: '🇰🇳', VC: '🇻🇨', LC: '🇱🇨', SR: '🇸🇷', TT: '🇹🇹', UY: '🇺🇾', VE: '🇻🇪'
  };

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(formatCountryTime(countryCode));
    }, 1000);
    setCurrentTime(formatCountryTime(countryCode));
    return () => clearInterval(timer);
  }, [countryCode]);

  const menuItems = [
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
  ];

  const filteredItems = menuItems.filter(item => {
    if (item.adminOnly) return isAdmin;
    if (item.powerOnly) return isPowerUser;
    return true;
  });

  const technicalSupportPhone = state.settings.technicalSupportPhone;
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const handleStatus = () => setIsOnline(navigator.onLine);
    window.addEventListener('online', handleStatus);
    window.addEventListener('offline', handleStatus);
    return () => {
      window.removeEventListener('online', handleStatus);
      window.removeEventListener('offline', handleStatus);
    };
  }, []);

  return (
    <div className="w-72 charcoal-gradient h-screen sticky top-0 hidden md:flex flex-col text-slate-400 border-r border-white/5 shadow-2xl z-[100]">
      <div className="p-8 border-b border-white/5 space-y-6">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 premium-gradient rounded-2xl flex items-center justify-center shadow-lg shadow-emerald-500/20 rotate-3 group hover:rotate-0 transition-transform duration-300">
            <i className="fa-solid fa-sack-dollar text-2xl text-white"></i>
          </div>
          <div className="min-w-0">
            <h1 className="text-lg font-black text-white uppercase tracking-tighter leading-none">ANEXO <span className="text-emerald-500">COBRO</span></h1>
            <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mt-1 opacity-70">Sistema Core v{CURRENT_VERSION_ID}</p>
          </div>
        </div>

        {/* Sección de País y Hora Local - Premium Card */}
        <div className="bg-white/5 backdrop-blur-md rounded-[1.5rem] p-4 border border-white/5 shadow-inner transition-all hover:bg-white/10">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className="text-xl leading-none drop-shadow-sm">{flags[countryCode] || '🌎'}</span>
              <span className="text-[10px] font-black text-white/80 uppercase tracking-tighter truncate">{countryName}</span>
            </div>
            <div className={`w-2 h-2 rounded-full ${isOnline ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}`}></div>
          </div>
          <div className="flex items-center gap-2 text-emerald-400/90">
            <i className="fa-regular fa-clock text-[10px]"></i>
            <span className="text-sm font-black font-mono tracking-[0.15em]">{currentTime}</span>
          </div>
        </div>
      </div>

      <nav className="flex-1 p-6 space-y-1.5 overflow-y-auto custom-scrollbar">
        {filteredItems.map((item) => (
          <React.Fragment key={item.id}>
            <button
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center gap-4 px-5 py-3.5 rounded-2xl text-[10px] font-black uppercase tracking-[0.15em] transition-all group relative overflow-hidden ${activeTab === item.id
                ? 'premium-gradient text-white shadow-xl shadow-emerald-500/10'
                : 'hover:bg-white/5 hover:text-white text-slate-500'
                }`}
            >
              <div className={`w-8 h-8 rounded-xl flex items-center justify-center transition-all ${activeTab === item.id ? 'bg-white/20' : 'bg-slate-800/50 group-hover:bg-slate-700 text-emerald-500'}`}>
                <i className={`fa-solid ${item.icon} text-sm ${activeTab === item.id ? 'text-white' : ''}`}></i>
              </div>
              <span className="relative z-10">{item.label}</span>
              {activeTab === item.id && (
                <div className="absolute right-0 top-0 bottom-0 w-1 bg-white/30"></div>
              )}
            </button>

            {item.id === 'settings' && isPowerUser && technicalSupportPhone && (
              <div className="px-5 py-4 mt-2 bg-indigo-500/5 rounded-2xl border border-indigo-500/10 animate-fadeIn">
                <p className="text-[9px] font-black text-slate-600 uppercase tracking-widest mb-2">Soporte VIP</p>
                <a href={`tel:${technicalSupportPhone}`} className="text-sm font-black text-indigo-400 flex items-center gap-3 hover:text-indigo-300 transition-colors">
                  <div className="w-6 h-6 bg-indigo-500/20 rounded-lg flex items-center justify-center">
                    <i className="fa-solid fa-phone-volume text-[10px]"></i>
                  </div>
                  {technicalSupportPhone}
                </a>
              </div>
            )}
            
            {item.id === 'settings' && (
              <div className="px-5 py-3">
                <div
                  className={`w-full flex items-center justify-between p-3 rounded-2xl border transition-all ${isSyncing ? 'bg-emerald-500/5 border-emerald-500/10 text-emerald-400' : 'bg-white/5 border-white/5 text-slate-600'}`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${isSyncing ? 'bg-emerald-500 text-white animate-pulse' : 'bg-slate-800/80 text-slate-600'}`}>
                      <i className={`fa-solid fa-rotate text-xs ${isSyncing ? 'animate-spin' : ''}`}></i>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[9px] font-black uppercase tracking-widest leading-none">
                        {isSyncing ? 'Sincronizando...' : 'Online'}
                      </span>
                      <p className="text-[7px] font-bold opacity-50 uppercase mt-0.5">Cloud Sync v2</p>
                    </div>
                  </div>
                  {isSyncing && (
                    <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-ping"></div>
                  )}
                </div>
              </div>
            )}
          </React.Fragment>
        ))}
      </nav>

      <div className="p-6 border-t border-white/5 bg-black/20">
        <div 
          className="flex items-center gap-4 p-4 bg-white/5 rounded-[1.5rem] border border-white/5 cursor-pointer hover:bg-white/10 transition-all group" 
          onClick={() => setActiveTab('profile')}
        >
          <div className="w-12 h-12 rounded-2xl premium-gradient flex items-center justify-center text-white text-lg font-black shadow-lg shadow-emerald-500/20 group-hover:scale-105 transition-transform">
            {user.name.charAt(0)}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[11px] font-black text-white truncate uppercase tracking-tighter leading-none">{user.name}</p>
            <div className="flex items-center gap-1.5 mt-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div>
              <p className="text-[9px] text-emerald-500 font-black uppercase tracking-widest">{user.role}</p>
            </div>
          </div>
        </div>

        <button
          onClick={onLogout}
          className="w-full flex items-center gap-4 px-5 py-4 mt-4 rounded-2xl text-[10px] font-black text-rose-400 hover:bg-rose-500/10 transition-colors uppercase tracking-[0.2em]"
        >
          <i className="fa-solid fa-power-off text-lg"></i>
          {t.logout}
        </button>
      </div>
    </div>
  );
};

export default Sidebar;
