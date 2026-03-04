
import React, { useState, useMemo } from 'react';
import { AppState, User, Role } from '../types';
import { getTranslation } from '../utils/translations';
import { compressImage, generateUUID } from '../utils/helpers';

interface ManagersProps {
  state: AppState;
  onAddUser: (user: User) => void;
  onUpdateUser: (user: User) => void;
  onDeleteUser: (userId: string) => void;
}

const Managers: React.FC<ManagersProps> = ({ state, onAddUser, onUpdateUser, onDeleteUser }) => {
  // Estados para Gerentes
  const [showModal, setShowModal] = useState(false);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    username: '',
    password: '',
    role: Role.MANAGER,
    blocked: false,
    expiryDate: ''
  });

  // Estados para Cobradores del Gerente
  const [showCollectorManagerModal, setShowCollectorManagerModal] = useState<string | null>(null); // ID del Gerente
  const [isEditingCollector, setIsEditingCollector] = useState<string | null>(null); // ID del Cobrador
  const [isCapturingCollectorGPS, setIsCapturingCollectorGPS] = useState(false);

  const [collectorForm, setCollectorForm] = useState({
    name: '',
    username: '',
    password: '',
    blocked: false,
    expiryDate: '',
    profilePic: '',
    homePic: '',
    homeLocation: undefined as { lat: number; lng: number } | undefined,
    requiresLocation: false
  });

  const t = getTranslation(state.settings.language);

  // Funciones Gerente
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Check for duplicate username
    const usernameExists = (Array.isArray(state.users) ? state.users : []).some(u =>
      u.username.toLowerCase() === formData.username.toLowerCase() &&
      u.id !== editingUserId
    );

    if (usernameExists) {
      alert("ERROR ID YA REGISTRADO");
      return;
    }

    const userData: User = {
      id: editingUserId || generateUUID(),
      name: formData.name,
      username: formData.username,
      password: formData.password,
      role: Role.MANAGER,
      blocked: formData.blocked,
      expiryDate: formData.expiryDate
    };
    if (editingUserId) onUpdateUser(userData);
    else onAddUser(userData);
    closeModal();
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingUserId(null);
    setFormData({ name: '', username: '', password: '', role: Role.MANAGER, blocked: false, expiryDate: '' });
  };

  const handleEdit = (user: User) => {
    setEditingUserId(user.id);
    setFormData({
      name: user.name,
      username: user.username,
      password: user.password || '',
      role: user.role,
      blocked: !!user.blocked,
      expiryDate: user.expiryDate || ''
    });
    setShowModal(true);
  };

  // Funciones Cobrador
  const handleCollectorGPS = () => {
    setIsCapturingCollectorGPS(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCollectorForm(prev => ({
          ...prev,
          homeLocation: { lat: pos.coords.latitude, lng: pos.coords.longitude }
        }));
        setIsCapturingCollectorGPS(false);
      },
      (err) => {
        alert("Error GPS: " + err.message);
        setIsCapturingCollectorGPS(false);
      },
      { enableHighAccuracy: true }
    );
  };

  const handleCollectorFile = (e: React.ChangeEvent<HTMLInputElement>, field: 'profilePic' | 'homePic') => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const base64 = ev.target?.result as string;
      const compressed = await compressImage(base64);
      setCollectorForm(prev => ({ ...prev, [field]: compressed }));
    };
    reader.readAsDataURL(file);
  };

  const handleCollectorSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!showCollectorManagerModal) return;

    // Check for duplicate username
    const usernameExists = (Array.isArray(state.users) ? state.users : []).some(u =>
      u.username.toLowerCase() === collectorForm.username.toLowerCase() &&
      u.id !== isEditingCollector
    );

    if (usernameExists) {
      alert("ERROR ID YA REGISTRADO");
      return;
    }

    const userData: User = {
      id: isEditingCollector || generateUUID(),
      name: collectorForm.name,
      username: collectorForm.username,
      password: collectorForm.password,
      role: Role.COLLECTOR,
      blocked: collectorForm.blocked,
      expiryDate: collectorForm.expiryDate,
      managedBy: showCollectorManagerModal,
      profilePic: collectorForm.profilePic,
      homePic: collectorForm.homePic,
      homeLocation: collectorForm.homeLocation,
      requiresLocation: collectorForm.requiresLocation // Preserve GPS setting
    };

    if (isEditingCollector) onUpdateUser(userData);
    else onAddUser(userData);

    resetCollectorForm();
  };

  const resetCollectorForm = () => {
    setIsEditingCollector(null);
    setCollectorForm({
      name: '',
      username: '',
      password: '',
      blocked: false,
      expiryDate: '',
      profilePic: '',
      homePic: '',
      homeLocation: undefined
    });
  };

  const handleEditCollector = (user: User) => {
    setIsEditingCollector(user.id);
    setCollectorForm({
      name: user.name,
      username: user.username,
      password: user.password || '',
      blocked: !!user.blocked,
      expiryDate: user.expiryDate || '',
      profilePic: user.profilePic || '',
      homePic: user.homePic || '',
      homeLocation: user.homeLocation,
      requiresLocation: !!user.requiresLocation // Preserve GPS setting
    });
  };

  const checkNearExpiry = (dateStr?: string) => {
    if (!dateStr) return false;
    const expiry = new Date(dateStr);
    expiry.setHours(0, 0, 0, 0);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const diffTime = expiry.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays <= 5;
  };

  const managers = (Array.isArray(state.users) ? state.users : []).filter(u => u.role === Role.MANAGER);
  const selectedManager = (Array.isArray(state.users) ? state.users : []).find(u => u.id === showCollectorManagerModal);
  const currentCollectors = (Array.isArray(state.users) ? state.users : []).filter(u =>
    u.role === Role.COLLECTOR &&
    (u.managedBy || (u as any).managed_by)?.toLowerCase() === showCollectorManagerModal?.toLowerCase()
  );

  return (
    <div className="space-y-6 animate-fadeIn pb-24 px-1">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-4 md:p-6 rounded-2xl md:rounded-[2.5rem] border border-slate-200 shadow-sm text-center md:text-left">
        <div className="w-full md:w-auto">
          <h2 className="text-xl md:text-2xl font-black text-slate-950 uppercase tracking-tighter">Panel de Gerencia</h2>
          <p className="text-[9px] md:text-[10px] font-black text-slate-700 uppercase tracking-widest mt-1 opacity-80">Control de licencias y acceso</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="w-full md:w-auto bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-3.5 rounded-xl md:rounded-2xl flex items-center justify-center gap-3 transition-all font-black shadow-lg shadow-indigo-500/20 active:scale-95 uppercase text-[10px] tracking-widest"
        >
          <i className="fa-solid fa-user-plus text-sm"></i>
          {t.managers.newManager}
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 md:gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {managers.length === 0 ? (
          <div className="col-span-full py-16 md:py-20 bg-white rounded-2xl md:rounded-[2.5rem] border-2 border-dashed border-slate-200 flex flex-col items-center justify-center text-slate-500 text-center">
            <i className="fa-solid fa-user-tie text-4xl md:text-5xl mb-4 opacity-20"></i>
            <p className="text-[10px] md:text-xs font-black uppercase tracking-widest">Sin gerentes registrados</p>
          </div>
        ) : (
          managers.map((user) => {
            const isCritical = checkNearExpiry(user.expiryDate);
            return (
              <div key={user.id} className={`p-6 md:p-8 rounded-2xl md:rounded-[2.5rem] border transition-all group relative overflow-hidden ${isCritical ? 'bg-red-50 border-red-600 shadow-2xl animate-border-blink' : 'bg-white border-slate-200 shadow-sm hover:shadow-xl'}`}>
                <div className="absolute -right-4 -top-4 text-slate-100 opacity-20 group-hover:opacity-40 transition-colors">
                  <i className="fa-solid fa-user-tie text-7xl md:text-9xl"></i>
                </div>

                <div className="relative z-10 space-y-6">
                  <div className="flex justify-between items-start">
                    <div className={`w-12 h-12 md:w-14 md:h-14 rounded-xl md:rounded-2xl flex items-center justify-center text-xl md:text-2xl font-black shadow-inner uppercase ${isCritical ? 'bg-white text-red-600' : 'bg-indigo-50 text-indigo-700'}`}>
                      {user.name.charAt(0)}
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleEdit(user)}
                        className={`w-9 h-9 md:w-10 md:h-10 border rounded-lg transition-all shadow-sm active:scale-90 flex items-center justify-center ${isCritical ? 'bg-white border-red-200 text-red-600 hover:bg-red-50' : 'bg-white border-slate-200 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50'}`}
                      >
                        <i className="fa-solid fa-pen-to-square text-xs"></i>
                      </button>
                      <button
                        onClick={() => onDeleteUser(user.id)}
                        className={`w-9 h-9 md:w-10 md:h-10 border rounded-lg transition-all shadow-sm active:scale-90 flex items-center justify-center ${isCritical ? 'bg-white border-red-200 text-red-600 hover:bg-red-50' : 'bg-white border-slate-200 text-slate-500 hover:text-red-600 hover:bg-red-50'}`}
                      >
                        <i className="fa-solid fa-trash-can text-xs"></i>
                      </button>
                    </div>
                  </div>

                  <div>
                    <h4 className={`font-black text-lg md:text-xl uppercase tracking-tighter truncate ${isCritical ? 'text-slate-900' : 'text-slate-950'}`}>{user.name}</h4>
                    <div className="flex items-center gap-2 mt-2">
                      <span className={`text-[7px] md:text-[8px] font-black px-2.5 py-1 rounded-md border uppercase tracking-widest ${isCritical ? 'bg-white text-red-700 border-white' : 'bg-indigo-50 text-indigo-800 border-indigo-200'}`}>
                        {user.blocked ? 'CUENTA BLOQUEADA' : 'ACCESO ACTIVO'}
                      </span>
                    </div>
                  </div>

                  <div className={`p-4 rounded-xl md:rounded-2xl space-y-3 border shadow-inner ${isCritical ? 'bg-black/10 border-white/20 text-slate-900' : 'bg-slate-50 border-slate-200 text-slate-900'}`}>
                    <div className="flex justify-between items-center text-[10px] md:text-xs">
                      <span className={`font-bold uppercase tracking-tighter ${isCritical ? 'text-slate-700' : 'text-slate-700'}`}>Corte de Licencia:</span>
                      <span className="font-black flex items-center gap-1.5 text-slate-950">
                        <i className="fa-solid fa-calendar-day"></i>
                        {user.expiryDate ? new Date(user.expiryDate).toLocaleDateString() : 'SIN FECHA'}
                      </span>
                    </div>
                  </div>

                  <button
                    onClick={() => setShowCollectorManagerModal(user.id)}
                    className={`w-full py-4 rounded-xl font-black text-[10px] uppercase tracking-widest shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2 ${isCritical ? 'bg-white text-red-600 border border-red-200' : 'bg-slate-950 text-white'}`}
                  >
                    <i className="fa-solid fa-user-gear"></i>
                    GESTIONAR COBRADOR
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* MODAL COBRADOR POR SUCURSAL */}
      {showCollectorManagerModal && selectedManager && (
        <div className="fixed inset-0 bg-slate-900/95 backdrop-blur-md flex items-center justify-center z-[200] p-0 md:p-4 overflow-hidden">
          <div className="bg-white w-full h-full md:rounded-[2.5rem] shadow-2xl flex flex-col overflow-hidden animate-scaleIn border border-white/20">
            <div className="p-5 md:p-8 bg-[#0f172a] text-white flex justify-between items-center shrink-0">
              <div>
                <h3 className="text-xl md:text-2xl font-black uppercase tracking-tighter flex items-center gap-3">
                  <i className="fa-solid fa-users-gear text-blue-400"></i>
                  Sucursal: <span className="text-blue-400">{selectedManager.name}</span>
                </h3>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Gestión completa de expediente de cobrador</p>
              </div>
              <button onClick={() => { setShowCollectorManagerModal(null); resetCollectorForm(); }} className="w-12 h-12 bg-white/10 text-white rounded-2xl hover:bg-red-600 transition-all flex items-center justify-center">
                <i className="fa-solid fa-xmark text-2xl"></i>
              </button>
            </div>

            <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
              {/* Formulario Registro/Edición */}
              <div className="w-full md:w-[450px] p-6 bg-slate-50 border-r border-slate-200 overflow-y-auto mobile-scroll-container">
                <h4 className="text-[10px] font-black text-blue-700 uppercase tracking-widest mb-6 flex items-center gap-2 border-l-4 border-blue-700 pl-2">
                  {isEditingCollector ? 'MODIFICAR EXPEDIENTE' : 'REGISTRAR NUEVA RUTA'}
                </h4>

                <form onSubmit={handleCollectorSubmit} className="space-y-6">
                  <div className="bg-white p-5 rounded-2xl border border-slate-300 shadow-sm space-y-4">
                    <div className="space-y-1.5">
                      <label className="text-[8px] font-black text-slate-700 uppercase ml-1">Nombre Completo</label>
                      <input required type="text" value={collectorForm.name} onChange={e => setCollectorForm({ ...collectorForm, name: e.target.value })} className="w-full px-4 py-3 bg-slate-50 border border-slate-300 rounded-xl font-black uppercase text-slate-950 outline-none focus:ring-2 focus:ring-blue-500 shadow-inner" />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <label className="text-[8px] font-black text-slate-700 uppercase ml-1">Usuario ID</label>
                        <input required type="text" value={collectorForm.username} onChange={e => setCollectorForm({ ...collectorForm, username: e.target.value.toLowerCase().replace(/\s/g, '') })} className="w-full px-4 py-3 bg-slate-50 border border-slate-300 rounded-xl font-black text-slate-950 outline-none focus:ring-2 focus:ring-blue-500 shadow-inner" />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[8px] font-black text-slate-700 uppercase ml-1">Pin Acceso</label>
                        <input required type="text" value={collectorForm.password} onChange={e => setCollectorForm({ ...collectorForm, password: e.target.value })} className="w-full px-4 py-3 bg-slate-50 border border-slate-300 rounded-xl font-black text-blue-800 outline-none focus:ring-2 focus:ring-blue-500 shadow-inner" />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[8px] font-black text-slate-700 uppercase ml-1">Corte de Licencia</label>
                      <input required type="date" value={collectorForm.expiryDate} onChange={e => setCollectorForm({ ...collectorForm, expiryDate: e.target.value })} className="w-full px-4 py-3 bg-slate-50 border border-slate-300 rounded-xl font-black text-slate-950 outline-none focus:ring-2 focus:ring-blue-500 shadow-inner" style={{ colorScheme: 'light' }} />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[8px] font-black text-slate-700 uppercase ml-1">Foto Perfil</label>
                      <div className="relative aspect-square bg-white border-2 border-dashed border-slate-300 rounded-2xl flex items-center justify-center overflow-hidden hover:border-blue-500 transition-all cursor-pointer shadow-sm">
                        {collectorForm.profilePic ? <img src={collectorForm.profilePic} className="w-full h-full object-cover" /> : <i className="fa-solid fa-camera text-slate-400 text-2xl"></i>}
                        <input type="file" accept="image/*" onChange={(e) => handleCollectorFile(e, 'profilePic')} className="absolute inset-0 opacity-0 cursor-pointer" />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[8px] font-black text-slate-700 uppercase ml-1">Foto Fachada Casa</label>
                      <div className="relative aspect-square bg-white border-2 border-dashed border-slate-300 rounded-2xl flex items-center justify-center overflow-hidden hover:border-blue-500 transition-all cursor-pointer shadow-sm">
                        {collectorForm.homePic ? <img src={collectorForm.homePic} className="w-full h-full object-cover" /> : <i className="fa-solid fa-house-user text-slate-400 text-2xl"></i>}
                        <input type="file" accept="image/*" onChange={(e) => handleCollectorFile(e, 'homePic')} className="absolute inset-0 opacity-0 cursor-pointer" />
                      </div>
                    </div>
                  </div>

                  <div className="bg-white p-5 rounded-2xl border border-slate-300 shadow-sm space-y-4">
                    <button type="button" onClick={handleCollectorGPS} disabled={isCapturingCollectorGPS} className={`w-full py-4 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all flex items-center justify-center gap-3 ${collectorForm.homeLocation ? 'bg-emerald-600 text-white shadow-lg' : 'bg-slate-900 text-white shadow-md active:scale-95'}`}>
                      {isCapturingCollectorGPS ? <i className="fa-solid fa-spinner animate-spin"></i> : <i className="fa-solid fa-location-dot"></i>}
                      {collectorForm.homeLocation ? 'CASA GEO-LOCALIZADA OK' : 'MARCAR GPS CASA'}
                    </button>
                    {collectorForm.homeLocation && (
                      <p className="text-[8px] font-black text-emerald-800 uppercase text-center bg-emerald-50 py-2 rounded-lg border border-emerald-200">COORD: {collectorForm.homeLocation.lat.toFixed(6)}, {collectorForm.homeLocation.lng.toFixed(6)}</p>
                    )}
                  </div>

                  <div className="flex items-center justify-between p-4 bg-white border border-slate-300 rounded-xl shadow-sm">
                    <span className="text-[9px] font-black text-slate-900 uppercase">BLOQUEAR ACCESO</span>
                    <button type="button" onClick={() => setCollectorForm({ ...collectorForm, blocked: !collectorForm.blocked })} className={`w-12 h-6 rounded-full relative transition-colors ${collectorForm.blocked ? 'bg-red-600' : 'bg-slate-300'}`}>
                      <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all ${collectorForm.blocked ? 'left-7' : 'left-1'}`}></div>
                    </button>
                  </div>

                  <div className="pt-2 space-y-2 pb-10">
                    <button type="submit" className="w-full py-5 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl active:scale-95 transition-all">
                      {isEditingCollector ? 'GUARDAR EXPEDIENTE' : 'CREAR NUEVA RUTA'}
                    </button>
                    {isEditingCollector && (
                      <button type="button" onClick={resetCollectorForm} className="w-full py-3 text-[9px] font-black text-slate-500 uppercase hover:text-red-500 transition-colors">DESCARTAR EDICIÓN</button>
                    )}
                  </div>
                </form>
              </div>

              {/* Lista de Cobradores Actuales */}
              <div className="flex-1 p-6 md:p-8 overflow-y-auto bg-white custom-scrollbar">
                <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-6 border-b border-slate-200 pb-2">PERSONAL DE CAMPO ACTIVO</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  {currentCollectors.length === 0 ? (
                    <div className="col-span-full py-24 flex flex-col items-center justify-center text-slate-400 border-2 border-dashed border-slate-200 rounded-[3rem]">
                      <i className="fa-solid fa-users-slash text-5xl mb-4 opacity-10"></i>
                      <p className="text-sm font-black uppercase tracking-widest">Sin cobradores registrados</p>
                    </div>
                  ) : (
                    currentCollectors.map(col => {
                      const colCritical = checkNearExpiry(col.expiryDate);
                      return (
                        <div key={col.id} className={`p-6 rounded-3xl border transition-all group overflow-hidden relative ${colCritical ? 'bg-red-50 border-red-300 shadow-xl animate-border-blink' : 'bg-white border-slate-200 shadow-sm hover:shadow-lg hover:border-blue-400'}`}>
                          <div className="flex justify-between items-start mb-5">
                            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center font-black overflow-hidden shadow-lg border-2 ${col.blocked ? 'bg-slate-300 text-slate-600' : 'bg-blue-600 text-white border-blue-100'}`}>
                              {col.profilePic ? <img src={col.profilePic} className="w-full h-full object-cover" /> : col.name.charAt(0)}
                            </div>
                            <div className="flex gap-2">
                              <button onClick={() => handleEditCollector(col)} className="w-9 h-9 rounded-xl bg-white border border-slate-200 text-slate-500 hover:text-blue-600 transition-all flex items-center justify-center shadow-sm active:scale-90"><i className="fa-solid fa-pen-to-square"></i></button>
                              <button onClick={() => onDeleteUser(col.id)} className="w-9 h-9 rounded-xl bg-white border border-slate-200 text-slate-500 hover:text-red-600 transition-all flex items-center justify-center shadow-sm active:scale-90"><i className="fa-solid fa-trash-can"></i></button>
                            </div>
                          </div>
                          <h5 className="font-black text-slate-950 text-lg uppercase tracking-tight truncate mb-4">{col.name}</h5>

                          <div className="space-y-2">
                            <div className="flex justify-between items-center text-[8px] font-black uppercase bg-slate-50 p-2 rounded-lg border border-slate-200">
                              <span className="text-slate-600">Status:</span>
                              <span className={col.blocked ? 'text-red-700' : 'text-emerald-700'}>{col.blocked ? 'SUSPENDIDO' : 'ACTIVO'}</span>
                            </div>
                            <div className="flex justify-between items-center text-[8px] font-black uppercase bg-slate-50 p-2 rounded-lg border border-slate-200">
                              <span className="text-slate-600">Expira:</span>
                              <span className={colCritical ? 'text-red-700 font-black' : 'text-slate-900'}>{col.expiryDate || '---'}</span>
                            </div>
                          </div>

                          <div className="mt-4 grid grid-cols-2 gap-2">
                            {col.homeLocation && (
                              <button onClick={() => window.open(`https://www.google.com/maps/search/?api=1&query=${col.homeLocation?.lat},${col.homeLocation?.lng}`, '_blank')} className="py-2 bg-emerald-50 text-emerald-900 rounded-xl text-[8px] font-black uppercase border border-emerald-200 flex items-center justify-center gap-1.5 active:scale-95 transition-all">
                                <i className="fa-solid fa-house-chimney"></i> CASA GPS
                              </button>
                            )}
                            {col.homePic && (
                              <button onClick={() => window.open(col.homePic)} className="py-2 bg-blue-50 text-blue-900 rounded-xl text-[8px] font-black uppercase border border-blue-200 flex items-center justify-center gap-1.5 active:scale-95 transition-all">
                                <i className="fa-solid fa-camera"></i> VER FACHADA
                              </button>
                            )}
                          </div>

                          {/* GPS ENFORCEMENT - ADDED FOR MANAGERS */}
                          <div className="mt-4 p-3 rounded-xl border bg-slate-50 border-slate-200">
                            <div className="flex items-center gap-2 mb-2">
                              <i className="fa-solid fa-location-dot text-sm text-blue-600"></i>
                              <span className="text-[8px] font-black uppercase text-slate-700">GPS Obligatorio</span>
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                              <button
                                onClick={() => onUpdateUser({ ...col, requiresLocation: true })}
                                disabled={col.requiresLocation}
                                className={`py-2 px-3 rounded-lg font-black text-[7px] uppercase tracking-wider transition-all flex items-center justify-center gap-1 ${col.requiresLocation ? 'bg-emerald-600 text-white opacity-50' : 'bg-blue-600 text-white active:scale-95'}`}
                              >
                                <i className="fa-solid fa-check"></i>
                                {col.requiresLocation ? 'ACTIVO' : 'ACTIVAR'}
                              </button>
                              <button
                                onClick={() => onUpdateUser({ ...col, requiresLocation: false })}
                                disabled={!col.requiresLocation}
                                className={`py-2 px-3 rounded-lg font-black text-[7px] uppercase tracking-wider transition-all flex items-center justify-center gap-1 ${!col.requiresLocation ? 'bg-slate-400 text-white opacity-50' : 'bg-red-600 text-white active:scale-95'}`}
                              >
                                <i className="fa-solid fa-xmark"></i>
                                {!col.requiresLocation ? 'INACTIVO' : 'DESACTIVAR'}
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL NUEVO/EDITAR GERENTE */}
      {showModal && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md flex items-center justify-center z-[150] p-2 overflow-y-auto">
          <div className="bg-white rounded-[1.5rem] md:rounded-[3rem] shadow-2xl w-full max-w-md overflow-hidden animate-scaleIn border border-white/20 flex flex-col">
            <div className="p-5 md:p-8 bg-indigo-600 text-white flex justify-between items-center sticky top-0 z-10">
              <div>
                <h3 className="text-lg md:text-xl font-black uppercase tracking-tighter">{editingUserId ? 'Gestionar Gerente' : 'Nuevo Gerente'}</h3>
                <p className="text-[8px] md:text-[9px] font-bold text-indigo-100 uppercase tracking-widest">Ajustes de licencia y bloqueo</p>
              </div>
              <button onClick={closeModal} className="w-8 h-8 md:w-10 md:h-10 bg-white/10 text-white rounded-lg hover:bg-red-600 transition-all flex items-center justify-center">
                <i className="fa-solid fa-xmark text-lg"></i>
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-5 md:p-8 space-y-6 flex-1 overflow-y-auto">
              <div className="space-y-4">
                <div>
                  <label className="block text-[8px] md:text-[10px] font-black text-slate-800 uppercase tracking-widest mb-1.5 ml-1">Nombre Completo</label>
                  <input required type="text" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} className="w-full px-5 py-3.5 bg-slate-50 border border-slate-400 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none font-black text-slate-950 uppercase shadow-inner text-xs" />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[8px] md:text-[10px] font-black text-slate-800 uppercase tracking-widest mb-1.5 ml-1">Usuario</label>
                    <input required type="text" value={formData.username} onChange={(e) => setFormData({ ...formData, username: e.target.value.toLowerCase().replace(/\s/g, '') })} className="w-full px-5 py-3.5 bg-slate-50 border border-slate-400 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none font-black text-slate-950 shadow-inner text-xs" />
                  </div>
                  <div>
                    <label className="block text-[8px] md:text-[10px] font-black text-slate-800 uppercase tracking-widest mb-1.5 ml-1">Contraseña</label>
                    <input required type="text" value={formData.password} onChange={(e) => setFormData({ ...formData, password: e.target.value })} className="w-full px-5 py-3.5 bg-slate-50 border border-slate-400 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none font-black text-indigo-900 shadow-inner text-xs" />
                  </div>
                </div>

                <div>
                  <label className="block text-[8px] md:text-[10px] font-black text-slate-800 uppercase tracking-widest mb-1.5 ml-1">Fecha de Corte / Vigencia</label>
                  <div className="relative">
                    <input
                      type="date"
                      value={formData.expiryDate}
                      onChange={(e) => setFormData({ ...formData, expiryDate: e.target.value })}
                      className="w-full px-5 py-3.5 bg-slate-50 border border-slate-400 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none font-black text-slate-950 shadow-inner text-xs uppercase"
                      style={{ colorScheme: 'light' }}
                    />
                    <i className="fa-solid fa-calendar-alt absolute right-4 top-1/2 -translate-y-1/2 text-slate-700 pointer-events-none"></i>
                  </div>
                </div>

                <div className="flex items-center justify-between p-4 bg-slate-100 border border-slate-300 rounded-2xl">
                  <div>
                    <p className="text-[9px] font-black text-slate-950 uppercase">Estado de la cuenta</p>
                    <p className="text-[7px] font-bold text-slate-700 opacity-80 uppercase">Bloquear acceso al sistema</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      className="sr-only peer"
                      checked={formData.blocked}
                      onChange={(e) => setFormData({ ...formData, blocked: e.target.checked })}
                    />
                    <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-red-600"></div>
                  </label>
                </div>
              </div>

              <button
                type="submit"
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-black py-4 rounded-xl md:rounded-2xl shadow-xl shadow-indigo-500/20 transition-all active:scale-95 uppercase tracking-widest text-[10px] md:text-xs"
              >
                {t.common.save}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Managers;
