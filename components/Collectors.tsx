
import React, { useState } from 'react';
import { AppState, User, Role, AppSettings } from '../types';
import { getTranslation } from '../utils/translations';
import { compressImage, generateUUID } from '../utils/helpers';

interface CollectorsProps {
  state: AppState;
  onAddUser: (user: User) => void;
  onUpdateUser: (user: User) => void;
  onDeleteUser: (userId: string) => void;
  updateSettings: (settings: AppSettings) => void;
}

const Collectors: React.FC<CollectorsProps> = ({ state, onAddUser, onUpdateUser, onDeleteUser, updateSettings }) => {
  const [showModal, setShowModal] = useState(false);
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [isCapturingGPS, setIsCapturingGPS] = useState(false);
  const [pendingToggleUserId, setPendingToggleUserId] = useState<string | null>(null);
  const [savedUserName, setSavedUserName] = useState<string | null>(null); // Para modal de confirmación

  const [formData, setFormData] = useState({
    name: '',
    username: '',
    password: '',
    role: Role.COLLECTOR,
    expiryDate: '',
    profilePic: '',
    homePic: '',
    homeLocation: undefined as { lat: number; lng: number } | undefined
  });

  const [receiptData, setReceiptData] = useState({
    companyName: state.settings.companyName || 'ANEXO COBRO',
    contactPhone: state.settings.contactPhone || '',
    transferAlias: state.settings.transferAlias || ''
  });

  const t = getTranslation(state.settings.language);
  const isAdmin = state.currentUser?.role === Role.ADMIN;
  const isManager = state.currentUser?.role === Role.MANAGER;
  const isAdminOrManager = isAdmin || isManager;
  const currentUserId = state.currentUser?.id;

  const handleCaptureGPS = () => {
    setIsCapturingGPS(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setFormData(prev => ({
          ...prev,
          homeLocation: { lat: pos.coords.latitude, lng: pos.coords.longitude }
        }));
        setIsCapturingGPS(false);
      },
      (err) => {
        alert("Error GPS: " + err.message);
        setIsCapturingGPS(false);
      },
      { enableHighAccuracy: true }
    );
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, field: 'profilePic' | 'homePic') => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const base64 = event.target?.result as string;
      const compressed = await compressImage(base64);
      setFormData(prev => ({ ...prev, [field]: compressed }));
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Check for duplicate username
    const usernameExists = (Array.isArray(state.users) ? state.users : []).some(u =>
      u.username.toLowerCase() === formData.username.toLowerCase().trim() &&
      u.id !== editingUserId
    );

    if (usernameExists) {
      alert("ERROR ID YA REGISTRADO");
      return;
    }

    if (editingUserId) {
      const oldUser = (Array.isArray(state.users) ? state.users : []).find(u => u.id === editingUserId);
      const updatedUser: User = {
        id: editingUserId,
        name: formData.name,
        username: formData.username,  // Gerentes ahora pueden editar usuario
        password: formData.password,
        role: formData.role,
        managedBy: oldUser?.managedBy,
        expiryDate: formData.expiryDate, // Gerentes ahora pueden editar fecha
        profilePic: formData.profilePic,
        homePic: formData.homePic,
        homeLocation: formData.homeLocation,
        requiresLocation: oldUser?.requiresLocation // Mantener el GPS actual
      };
      onUpdateUser(updatedUser);
      setSavedUserName(formData.name); // Mostrar modal de confirmación
    } else {
      const newUser: User = {
        id: generateUUID(),
        name: formData.name,
        username: formData.username,
        password: formData.password,
        role: formData.role,
        managedBy: currentUserId,
        expiryDate: formData.expiryDate,
        profilePic: formData.profilePic,
        homePic: formData.homePic,
        homeLocation: formData.homeLocation,
        requiresLocation: false
      };
      onAddUser(newUser);
      setSavedUserName(formData.name); // Mostrar modal de confirmación
    }
    closeModal();
  };

  const handleSaveReceiptSettings = (e: React.FormEvent) => {
    e.preventDefault();
    updateSettings({
      ...state.settings,
      companyName: receiptData.companyName,
      contactPhone: receiptData.contactPhone,
      transferAlias: receiptData.transferAlias
    });
    setShowReceiptModal(false);
    alert("Configuración de recibo actualizada.");
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingUserId(null);
    setFormData({
      name: '',
      username: '',
      password: '',
      role: Role.COLLECTOR,
      expiryDate: '',
      profilePic: '',
      homePic: '',
      homeLocation: undefined
    });
  };

  const handleEdit = (user: User) => {
    setEditingUserId(user.id);
    setFormData({
      name: user.name,
      username: user.username,
      password: user.password || '',
      role: user.role,
      expiryDate: user.expiryDate || '',
      profilePic: user.profilePic || '',
      homePic: user.homePic || '',
      homeLocation: user.homeLocation
    });
    setShowModal(true);
  };

  const getDaysToExpiry = (dateStr?: string) => {
    if (!dateStr) return null;
    const expiry = new Date(dateStr);
    expiry.setHours(0, 0, 0, 0);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const diffTime = expiry.getTime() - today.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };

  const collectors = (Array.isArray(state.users) ? state.users : []).filter(u =>
    u.role === Role.COLLECTOR &&
    (u.managedBy || (u as any).managed_by)?.toLowerCase() === currentUserId?.toLowerCase()
  );

  return (
    <div className="space-y-6 animate-fadeIn pb-24">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-4 md:p-6 rounded-2xl md:rounded-[2.5rem] border border-slate-100 shadow-sm">
        <div>
          <h2 className="text-xl md:text-2xl font-black text-slate-950 uppercase tracking-tighter">Rutas / Cobradores</h2>
          <p className="text-[9px] md:text-[10px] font-black text-slate-600 uppercase tracking-widest mt-1">
            {isAdmin ? 'Gestión de mis cobradores personales' : 'Gestión de sucursal aislada'}
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 w-full md:w-auto">
          {isAdminOrManager && (
            <button
              onClick={() => {
                setReceiptData({
                  companyName: state.settings.companyName || 'ANEXO COBRO',
                  contactPhone: state.settings.contactPhone || '',
                  transferAlias: state.settings.transferAlias || ''
                });
                setShowReceiptModal(true);
              }}
              className="bg-slate-800 hover:bg-slate-900 text-white px-5 py-3 rounded-xl flex items-center justify-center gap-2 transition-all font-bold shadow-lg active:scale-95 text-[10px] uppercase tracking-widest"
            >
              <i className="fa-solid fa-file-invoice"></i>
              CONFIGURAR RECIBO
            </button>
          )}

          {isAdminOrManager && (
            <button
              onClick={() => setShowModal(true)}
              className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-3 rounded-xl flex items-center justify-center gap-2 transition-all font-bold shadow-lg shadow-blue-500/20 active:scale-95 text-[10px] uppercase tracking-widest"
            >
              <i className="fa-solid fa-user-plus"></i>
              NUEVA RUTA
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6 px-1">
        {collectors.length === 0 ? (
          <div className="col-span-full py-16 md:py-20 bg-white rounded-2xl md:rounded-3xl border-2 border-dashed border-slate-100 flex flex-col items-center justify-center text-slate-400 text-center">
            <i className="fa-solid fa-route text-4xl md:text-5xl mb-4 opacity-20"></i>
            <p className="text-[10px] md:text-xs font-black uppercase tracking-widest text-slate-600">No hay rutas vinculadas directamente a su cuenta</p>
          </div>
        ) : (
          collectors.map((user) => {
            const daysLeft = getDaysToExpiry(user.expiryDate);
            const isExpiringSoon = daysLeft !== null && daysLeft <= 5 && daysLeft >= 0;

            return (
              <div key={user.id} className={`p-5 md:p-6 rounded-2xl md:rounded-3xl border transition-all group relative overflow-hidden ${isExpiringSoon ? 'bg-red-600 border-red-700 shadow-xl' : 'bg-white border-slate-200 shadow-sm hover:shadow-md'}`}>
                {isExpiringSoon && (
                  <div className="absolute top-0 left-0 w-full bg-red-950/20 py-1.5 text-center">
                    <p className="text-[9px] font-black text-white uppercase tracking-widest animate-pulse">
                      <i className="fa-solid fa-clock mr-1"></i>
                      {daysLeft} días para vencimiento
                    </p>
                  </div>
                )}

                <div className={`flex justify-between items-start mb-6 ${isExpiringSoon ? 'mt-4' : ''}`}>
                  <div className={`w-12 h-12 md:w-14 md:h-14 rounded-xl md:rounded-2xl flex items-center justify-center overflow-hidden text-xl md:text-2xl font-black uppercase ${isExpiringSoon ? 'bg-white/20 text-white' : 'bg-blue-50 text-blue-600'}`}>
                    {user.profilePic ? <img src={user.profilePic} className="w-full h-full object-cover" /> : user.name.charAt(0)}
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleEdit(user)}
                      className={`w-9 h-9 md:w-10 md:h-10 rounded-lg transition-all active:scale-90 flex items-center justify-center shadow-sm ${isExpiringSoon ? 'bg-white/10 border border-white/20 text-white hover:bg-white/20' : 'bg-white border border-slate-200 text-slate-700 hover:text-blue-500 hover:bg-blue-50'}`}
                    >
                      <i className="fa-solid fa-pen-to-square"></i>
                    </button>
                    {isAdminOrManager && (
                      <button
                        onClick={() => onDeleteUser(user.id)}
                        className={`w-9 h-9 md:w-10 md:h-10 rounded-lg transition-all active:scale-90 flex items-center justify-center shadow-sm ${isExpiringSoon ? 'bg-white/10 border border-white/20 text-white hover:bg-white/20' : 'bg-white border border-slate-100 text-slate-700 hover:text-red-500 hover:bg-red-50'}`}
                      >
                        <i className="fa-solid fa-trash-can"></i>
                      </button>
                    )}
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <h4 className={`font-black text-lg md:text-xl uppercase truncate ${isExpiringSoon ? 'text-white' : 'text-slate-950'}`}>{user.name}</h4>
                  </div>

                  <div className={`p-4 rounded-xl md:rounded-2xl space-y-2 border shadow-inner ${isExpiringSoon ? 'bg-black/10 border-white/10' : 'bg-slate-50 border-slate-100'}`}>
                    <div className="flex justify-between text-[9px] md:text-xs">
                      <span className={`font-bold uppercase ${isExpiringSoon ? 'text-white/80' : 'text-slate-800'}`}>{t.collectors.user}:</span>
                      <span className={`font-black truncate max-w-[120px] ${isExpiringSoon ? 'text-white' : 'text-slate-950'}`}>{user.username}</span>
                    </div>
                    <div className="flex justify-between text-[9px] md:text-xs">
                      <span className={`font-bold uppercase ${isExpiringSoon ? 'text-white/80' : 'text-slate-800'}`}>{t.collectors.pass}:</span>
                      <span className={`font-black tracking-widest ${isExpiringSoon ? 'text-white' : 'text-blue-700'}`}>{user.password}</span>
                    </div>
                    <div className="flex justify-between text-[9px] md:text-xs pt-1 border-t border-slate-200">
                      <span className={`font-bold uppercase ${isExpiringSoon ? 'text-white/80' : 'text-slate-800'}`}>Corte:</span>
                      <span className={`font-black ${isExpiringSoon ? 'text-white' : 'text-slate-950'}`}>{user.expiryDate ? new Date(user.expiryDate).toLocaleDateString() : 'SIN FECHA'}</span>
                    </div>
                  </div>

                  {user.homeLocation && (
                    <button
                      onClick={() => window.open(`https://www.google.com/maps/search/?api=1&query=${user.homeLocation?.lat},${user.homeLocation?.lng}`, '_blank')}
                      className={`w-full py-2.5 rounded-xl font-black text-[8px] uppercase tracking-widest flex items-center justify-center gap-2 border transition-all ${isExpiringSoon ? 'bg-white/10 text-white border-white/20' : 'bg-emerald-50 text-emerald-900 border-emerald-200 hover:bg-emerald-100'}`}
                    >
                      <i className="fa-solid fa-map-pin"></i> VER CASA GPS
                    </button>
                  )}

                  {/* GPS ENFORCEMENT BUTTONS */}
                  <div className={`mt-3 p-3 rounded-xl border ${isExpiringSoon ? 'bg-white/10 border-white/20' : 'bg-slate-50 border-slate-200'}`}>
                    <div className="flex items-center gap-2 mb-2">
                      <i className={`fa-solid fa-location-dot text-sm ${isExpiringSoon ? 'text-white' : 'text-blue-600'}`}></i>
                      <span className={`text-[8px] font-black uppercase ${isExpiringSoon ? 'text-white' : 'text-slate-700'}`}>
                        GPS Obligatorio
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      {/* ACTIVATE BUTTON */}
                      <button
                        onClick={() => {
                          const updatedUser = { ...user, requiresLocation: true };
                          onUpdateUser(updatedUser);
                        }}
                        disabled={user.requiresLocation}
                        className={`py-2 px-3 rounded-lg font-black text-[7px] uppercase tracking-wider transition-all flex items-center justify-center gap-1 ${user.requiresLocation
                          ? 'bg-emerald-600 text-white cursor-not-allowed opacity-50'
                          : isExpiringSoon
                            ? 'bg-white/20 text-white border border-white/30 hover:bg-white/30 active:scale-95'
                            : 'bg-blue-600 text-white hover:bg-blue-700 active:scale-95'
                          }`}
                      >
                        <i className="fa-solid fa-check"></i>
                        {user.requiresLocation ? 'ACTIVO' : 'ACTIVAR'}
                      </button>

                      {/* DEACTIVATE BUTTON */}
                      <button
                        onClick={() => {
                          const updatedUser = { ...user, requiresLocation: false };
                          onUpdateUser(updatedUser);
                        }}
                        disabled={!user.requiresLocation}
                        className={`py-2 px-3 rounded-lg font-black text-[7px] uppercase tracking-wider transition-all flex items-center justify-center gap-1 ${!user.requiresLocation
                          ? 'bg-slate-400 text-white cursor-not-allowed opacity-50'
                          : isExpiringSoon
                            ? 'bg-white/20 text-white border border-white/30 hover:bg-white/30 active:scale-95'
                            : 'bg-red-600 text-white hover:bg-red-700 active:scale-95'
                          }`}
                      >
                        <i className="fa-solid fa-xmark"></i>
                        {!user.requiresLocation ? 'INACTIVO' : 'DESACTIVAR'}
                      </button>
                    </div>

                    <p className={`text-[7px] mt-2 text-center ${isExpiringSoon ? 'text-white/70' : 'text-slate-500'}`}>
                      {user.requiresLocation
                        ? '✓ GPS requerido para usar la app'
                        : '○ GPS no requerido'}
                    </p>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center z-[150] p-2 md:p-4 overflow-y-auto">
          <div className="bg-white rounded-[1.5rem] md:rounded-[2.5rem] shadow-2xl w-full max-w-2xl overflow-hidden animate-scaleIn flex flex-col border border-white/20">
            <div className="p-5 md:p-8 border-b border-slate-200 flex justify-between items-center sticky top-0 bg-white z-10">
              <div>
                <h3 className="text-lg md:text-xl font-black text-slate-950 uppercase tracking-tighter">{editingUserId ? 'Editar Cobrador' : 'Nueva Ruta de Cobro'}</h3>
                <p className="text-[9px] font-bold text-slate-700 uppercase tracking-widest">Información detallada del personal</p>
              </div>
              <button onClick={closeModal} className="w-8 h-8 text-slate-500 hover:text-slate-800 active:scale-95 transition-all">
                <i className="fa-solid fa-xmark text-xl"></i>
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-5 md:p-8 space-y-6 flex-1 overflow-y-auto bg-slate-50 mobile-scroll-container">
              <div className="space-y-4">
                <h4 className="text-[10px] font-black text-blue-800 uppercase tracking-widest border-l-4 border-blue-800 pl-2">I. Credenciales de Acceso</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-white p-5 rounded-2xl border border-slate-300 shadow-sm">
                  <div className="md:col-span-2 space-y-1.5">
                    <label className="block text-[8px] font-black text-slate-800 uppercase ml-1">Nombre Completo</label>
                    <input required type="text" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} className="w-full px-4 py-3 bg-slate-50 border border-slate-300 rounded-xl font-bold uppercase text-slate-950 outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="block text-[8px] font-black text-slate-800 uppercase ml-1">Usuario ID</label>
                    <input
                      required
                      type="text"
                      value={formData.username}
                      onChange={(e) => setFormData({ ...formData, username: e.target.value.toLowerCase().replace(/\s/g, '') })}
                      className="w-full px-4 py-3 bg-white border border-slate-300 rounded-xl font-bold text-slate-950 outline-none focus:ring-2 focus:ring-blue-500 shadow-sm"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="block text-[8px] font-black text-slate-800 uppercase ml-1">Pin / Clave</label>
                    <input required type="text" value={formData.password} onChange={(e) => setFormData({ ...formData, password: e.target.value })} className="w-full px-4 py-3 bg-slate-50 border border-slate-300 rounded-xl font-bold text-slate-950 outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                  <div className="md:col-span-2 space-y-1.5">
                    <label className="block text-[8px] font-black text-slate-800 uppercase ml-1">Fecha Vencimiento Licencia</label>
                    <input
                      required
                      type="date"
                      value={formData.expiryDate}
                      onChange={(e) => setFormData({ ...formData, expiryDate: e.target.value })}
                      className="w-full px-4 py-3 bg-white border border-slate-300 rounded-xl font-bold text-slate-950 outline-none focus:ring-2 focus:ring-blue-500 shadow-sm"
                      style={{ colorScheme: 'light' }}
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <h4 className="text-[10px] font-black text-indigo-800 uppercase tracking-widest border-l-4 border-indigo-800 pl-2">II. Expediente Fotográfico</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[8px] font-black text-slate-800 uppercase ml-1">Foto Perfil</label>
                    <div className="relative aspect-square bg-white border-2 border-dashed border-slate-300 rounded-2xl flex flex-col items-center justify-center overflow-hidden hover:border-indigo-500 transition-all cursor-pointer">
                      {formData.profilePic ? (
                        <img src={formData.profilePic} className="w-full h-full object-cover" />
                      ) : (
                        <div className="text-center p-4">
                          <i className="fa-solid fa-user-plus text-slate-400 text-3xl"></i>
                          <p className="text-[7px] font-black text-slate-700 uppercase mt-2">Subir Foto</p>
                        </div>
                      )}
                      <input type="file" accept="image/*" onChange={(e) => handleFileChange(e, 'profilePic')} className="absolute inset-0 opacity-0 cursor-pointer" />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[8px] font-black text-slate-800 uppercase ml-1">Foto Fachada Casa</label>
                    <div className="relative aspect-square bg-white border-2 border-dashed border-slate-300 rounded-2xl flex flex-col items-center justify-center overflow-hidden hover:border-indigo-500 transition-all cursor-pointer">
                      {formData.homePic ? (
                        <img src={formData.homePic} className="w-full h-full object-cover" />
                      ) : (
                        <div className="text-center p-4">
                          <i className="fa-solid fa-house-chimney text-slate-400 text-3xl"></i>
                          <p className="text-[7px] font-black text-slate-700 uppercase mt-2">Subir Fachada</p>
                        </div>
                      )}
                      <input type="file" accept="image/*" onChange={(e) => handleFileChange(e, 'homePic')} className="absolute inset-0 opacity-0 cursor-pointer" />
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <h4 className="text-[10px] font-black text-emerald-800 uppercase tracking-widest border-l-4 border-emerald-800 pl-2">III. Ubicación Domiciliaria GPS</h4>
                <div className="bg-white p-5 rounded-2xl border border-slate-300 shadow-sm space-y-4">
                  <button
                    type="button"
                    onClick={handleCaptureGPS}
                    disabled={isCapturingGPS}
                    className={`w-full py-4 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all flex items-center justify-center gap-3 ${formData.homeLocation ? 'bg-emerald-600 text-white shadow-lg' : 'bg-slate-900 text-white active:scale-95'}`}
                  >
                    {isCapturingGPS ? <i className="fa-solid fa-spinner animate-spin"></i> : <i className="fa-solid fa-location-crosshairs"></i>}
                    {formData.homeLocation ? 'UBICACIÓN CAPTURADA OK' : 'CAPTURAR GPS CASA'}
                  </button>
                  {formData.homeLocation && (
                    <p className="text-[8px] font-black text-emerald-800 uppercase text-center bg-emerald-50 py-2 rounded-lg border border-emerald-200 animate-fadeIn">
                      COORD: {formData.homeLocation.lat.toFixed(6)}, {formData.homeLocation.lng.toFixed(6)}
                    </p>
                  )}
                </div>
              </div>

              <div className="pt-4 sticky bottom-0 bg-slate-50/90 backdrop-blur-md z-10 pb-4">
                <button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white font-black py-5 rounded-xl md:rounded-2xl shadow-xl shadow-blue-500/30 transition-all active:scale-95 uppercase tracking-widest text-[10px] md:text-sm">
                  {editingUserId ? 'ACTUALIZAR EXPEDIENTE' : 'CREAR RUTA Y ACTIVAR'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL DE CONFIRMACIÓN DE GUARDADO */}
      {savedUserName && (
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-md flex items-center justify-center z-[200] p-6">
          <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-sm overflow-hidden animate-scaleIn border-4 border-emerald-500 text-center">
            <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 p-8 text-white">
              <div className="w-20 h-20 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <i className="fa-solid fa-circle-check text-4xl"></i>
              </div>
              <h2 className="text-2xl font-black uppercase tracking-tight">¡Guardado!</h2>
              <p className="text-sm font-bold opacity-90 mt-2 uppercase tracking-widest">Cambios aplicados con éxito</p>
            </div>
            <div className="p-8 space-y-4">
              <div className="bg-emerald-50 border-2 border-emerald-200 rounded-2xl p-4">
                <p className="text-xs text-slate-700 font-black uppercase">Cobrador actualizado:</p>
                <p className="text-xl font-black text-emerald-800 uppercase mt-1">{savedUserName}</p>
              </div>
              <button
                onClick={() => setSavedUserName(null)}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-black py-4 rounded-2xl shadow-xl transition-all active:scale-95 uppercase tracking-widest text-sm"
              >
                ACEPTAR
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Collectors;
