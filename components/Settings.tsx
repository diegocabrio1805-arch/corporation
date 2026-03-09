
import React, { useState } from 'react';
import { AppState, AppSettings, Language, CountryCode, Role } from '../types';
import { getTranslation } from '../utils/translations';

interface SettingsProps {
  state: AppState;
  updateSettings: (settings: AppSettings) => void;
  setActiveTab: (tab: string) => void;
  onForceSync?: () => void;
  onClearQueue?: () => void;
  isOnline?: boolean;
  isSyncing?: boolean;
  isFullSyncing?: boolean;
  onDeepReset?: () => void;
}

const Settings: React.FC<SettingsProps> = ({ state, updateSettings, setActiveTab, onForceSync, onClearQueue, isOnline = true, isSyncing = false, isFullSyncing = false, onDeepReset }) => {
  const { language, country, numberFormat } = state.settings;
  const t = getTranslation(language);
  const isAdmin = state.currentUser?.role === Role.ADMIN;
  const isManager = state.currentUser?.role === Role.MANAGER;
  const isPowerUser = isAdmin || isManager;

  const [showSupportModal, setShowSupportModal] = useState(false);
  const [supportPhone, setSupportPhone] = useState(state.settings.technicalSupportPhone || '');
  const [isSearching, setIsSearching] = useState(false);
  const [connectedDevice, setConnectedDevice] = useState<string | null>(localStorage.getItem('printer_name'));

  // --- PRINTER LOGIC ---
  const [showPrinterModal, setShowPrinterModal] = useState(false);
  const [printerDevices, setPrinterDevices] = useState<any[]>([]);
  const [scanningPrinters, setScanningPrinters] = useState(false);

  // --- LOCAL FORM STATE FOR COMPANY DATA (Prevents sync overwrites) ---
  const [localForm, setLocalForm] = useState({
    companyName: state.settings.companyName || '',
    contactPhone: state.settings.contactPhone || '',
    companyAlias: state.settings.companyAlias || '',
    companyIdentifier: state.settings.companyIdentifier || '',
    shareLabel: state.settings.shareLabel || '',
    shareValue: state.settings.shareValue || '',
    receiptPrintMargin: state.settings.receiptPrintMargin ?? 2,
    companyNameBold: state.settings.companyNameBold ?? false,
    companyNameSize: state.settings.companyNameSize || 'normal',
    companyIdentifierBold: state.settings.companyIdentifierBold ?? false,
    contactPhoneBold: state.settings.contactPhoneBold ?? false,
    shareLabelBold: state.settings.shareLabelBold ?? false,
    shareLabelSize: state.settings.shareLabelSize || 'normal',
    shareValueBold: state.settings.shareValueBold ?? false,
    shareValueSize: state.settings.shareValueSize || 'normal'
  });

  const handleScanPrinters = async () => {
    setScanningPrinters(true);
    try {
      const { listBondedDevices, checkBluetoothEnabled, enableBluetooth } = await import('../services/bluetoothPrinterService');
      const enabled = await checkBluetoothEnabled();
      if (!enabled) {
        const success = await enableBluetooth();
        if (!success) {
          alert("Es necesario activar el Bluetooth.");
          setScanningPrinters(false);
          return;
        }
      }
      const devices = await listBondedDevices();
      setPrinterDevices(devices);
    } catch (e: any) {
      alert("Error buscando impresoras. Verifica los permisos de 'Dispositivos Cercanos'.");
    } finally {
      setScanningPrinters(false);
    }
  };

  const handleSelectPrinter = async (device: any) => {
    try {
      const { connectToPrinter } = await import('../services/bluetoothPrinterService');
      const connected = await connectToPrinter(device.id);
      if (connected) {
        alert(`Conectado a ${device.name}`);
        setConnectedDevice(device.name);
        localStorage.setItem('printer_name', device.name);
        setShowPrinterModal(false);
      } else {
        alert("No se pudo conectar.");
      }
    } catch (e) {
      alert("Error al conectar.");
    }
  };

  const handleTestPrint = async () => {
    try {
      const { printText, isPrinterConnected, connectToPrinter } = await import('../services/bluetoothPrinterService');
      if (!(await isPrinterConnected())) {
        await connectToPrinter();
      }
      setTimeout(async () => {
        const success = await printText("PRUEBA DE IMPRESION\n\nEXITOSA\n\n................................\n\n");
        if (success) alert("✅ Prueba enviada");
        else alert("❌ Error al enviar");
      }, 500);
    } catch (e: any) {
      alert("Error: " + e.message);
    }
  };

  const handleLanguageChange = (lang: Language) => {
    updateSettings({ ...state.settings, language: lang });
  };

  const handleCountryChange = (ctry: CountryCode) => {
    updateSettings({ ...state.settings, country: ctry });
  };

  const handleFormatChange = (fmt: 'dot' | 'comma') => {
    updateSettings({ ...state.settings, numberFormat: fmt });
  };

  const handleSaveSupportPhone = (e: React.FormEvent) => {
    e.preventDefault();
    // Support phone is ALWAYS global, so we update the main settings
    updateSettings({ ...state.settings, technicalSupportPhone: supportPhone });
    setShowSupportModal(false);
    alert("Número de Soporte Técnico actualizado globalmente.");
  };

  const handleSaveAndExit = async () => {
    // Save local form data before exiting
    await updateSettings({
      ...state.settings,
      ...localForm
    });
    // Explicitly save printer margin for the service to pick up
    localStorage.setItem('printer_margin_bottom', localForm.receiptPrintMargin.toString());

    alert("✅ Configuración guardada correctamente.");
    setActiveTab(isPowerUser ? 'dashboard' : 'route');
  };

  const handleOpenWeb = () => {
    // Open in system browser
    window.open('https://anexo-cobro.vercel.app', '_system');
  };

  const countries = [
    { code: 'AG', name: 'Antigua y Barbuda', flag: '🇦🇬' },
    { code: 'AR', name: 'Argentina', flag: '🇦🇷' },
    { code: 'BS', name: 'Bahamas', flag: '🇧🇸' },
    { code: 'BB', name: 'Barbados', flag: '🇧🇧' },
    { code: 'BZ', name: 'Belice', flag: '🇧🇿' },
    { code: 'BO', name: 'Bolivia', flag: '🇧🇴' },
    { code: 'BR', name: 'Brasil', flag: '🇧🇷' },
    { code: 'CA', name: 'Canadá', flag: '🇨🇦' },
    { code: 'CL', name: 'Chile', flag: '🇨🇱' },
    { code: 'CO', name: 'Colombia', flag: '🇨🇴' },
    { code: 'CR', name: 'Costa Rica', flag: '🇨🇷' },
    { code: 'CU', name: 'Cuba', flag: '🇨🇺' },
    { code: 'DM', name: 'Dominica', flag: '🇩🇲' },
    { code: 'EC', name: 'Ecuador', flag: '🇪🇨' },
    { code: 'SV', name: 'El Salvador', flag: '🇸🇻' },
    { code: 'US', name: 'Estados Unidos', flag: '🇺🇸' },
    { code: 'GD', name: 'Granada', flag: '🇬🇩' },
    { code: 'GT', name: 'Guatemala', flag: '🇬🇹' },
    { code: 'GY', name: 'Guyana', flag: '🇬🇾' },
    { code: 'HT', name: 'Haití', flag: '🇭🇹' },
    { code: 'HN', name: 'Honduras', flag: '🇭🇳' },
    { code: 'JM', name: 'Jamaica', flag: '🇯🇲' },
    { code: 'MX', name: 'México', flag: '🇲🇽' },
    { code: 'NI', name: 'Nicaragua', flag: '🇳🇮' },
    { code: 'PA', name: 'Panamá', flag: '🇵🇦' },
    { code: 'PY', name: 'Paraguay', flag: '🇵🇾' },
    { code: 'PE', name: 'Perú', flag: '🇵🇪' },
    { code: 'DO', name: 'Rep. Dominicana', flag: '🇩🇴' },
    { code: 'KN', name: 'San Cristóbal y N.', flag: '🇰🇳' },
    { code: 'VC', name: 'San Vicente y G.', flag: '🇻🇨' },
    { code: 'LC', name: 'Santa Lucía', flag: '🇱🇨' },
    { code: 'SR', name: 'Surinam', flag: '🇸🇷' },
    { code: 'TT', name: 'Trinidad y Tobago', flag: '🇹🇹' },
    { code: 'UY', name: 'Uruguay', flag: '🇺🇾' },
    { code: 'VE', name: 'Venezuela', flag: '🇻🇪' },
  ];

  const languages = [
    { code: 'es', name: 'Español', flag: '🇪🇸' },
    { code: 'en', name: 'English', flag: '🇺🇸' },
    { code: 'pt', name: 'Português', flag: '🇧🇷' },
    { code: 'fr', name: 'Français', flag: '🇫🇷' },
  ];

  return (
    <div className="max-w-4xl mx-auto space-y-4 md:space-y-8 animate-fadeIn pb-32 px-1">
      <div className="bg-white p-6 md:p-8 rounded-[1.5rem] md:rounded-[2.5rem] border border-slate-100 shadow-sm flex flex-col md:flex-row justify-between items-center gap-4">
        <div className="flex items-center gap-4 w-full md:w-auto">
          <div className="w-10 h-10 md:w-12 md:h-12 bg-slate-900 rounded-xl md:rounded-2xl flex items-center justify-center text-white text-lg shadow-xl">
            <i className="fa-solid fa-gear"></i>
          </div>
          <div>
            <h2 className="text-xl md:text-2xl font-black text-slate-800 uppercase tracking-tighter leading-none">Opciones</h2>
            <p className="text-slate-400 font-bold uppercase text-[9px] md:text-[10px] tracking-widest mt-1">Configuración Regional</p>
          </div>
        </div>

        {isAdmin && (
          <button
            onClick={() => {
              setSupportPhone(state.settings.technicalSupportPhone || '');
              setShowSupportModal(true);
            }}
            className="w-full md:w-auto bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest shadow-lg shadow-blue-500/20 active:scale-95 transition-all flex items-center justify-center gap-2"
          >
            <i className="fa-solid fa-headset"></i>
            CONFIGURAR SOPORTE TÉCNICO
          </button>
        )}
      </div>

      {/* CONFIGURACIÓN DE EMPRESA Y LEGAJO */}
      {isPowerUser && (
        <div className="bg-white p-6 md:p-8 rounded-2xl md:rounded-[2.5rem] border border-slate-100 shadow-sm hover:shadow-lg transition-all border-l-8 border-l-blue-600">
          <div className="flex items-center gap-3 mb-6">
            <i className="fa-solid fa-building text-xl md:text-2xl text-blue-600"></i>
            <div>
              <h3 className="text-base md:text-lg font-black text-slate-800 uppercase">Datos de la Empresa</h3>
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Para Recibos y Legajos</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Nombre de la Empresa (Título App)</label>
                <input
                  type="text"
                  value={localForm.companyName}
                  onChange={(e) => setLocalForm({ ...localForm, companyName: e.target.value })}
                  placeholder="Ej: MI COBRANZA EXPRESS"
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-black text-slate-800 outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Teléfono Público</label>
                <input
                  type="text"
                  value={localForm.contactPhone}
                  onChange={(e) => setLocalForm({ ...localForm, contactPhone: e.target.value })}
                  placeholder="Ej: +57 300 000 0000"
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-black text-slate-800 outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Marca</label>
                <input
                  type="text"
                  value={localForm.companyAlias}
                  onChange={(e) => setLocalForm({ ...localForm, companyAlias: e.target.value })}
                  placeholder="Ej: DANTE"
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-black text-slate-800 outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">ID Empresa (Legajo)</label>
                <input
                  type="text"
                  value={localForm.companyIdentifier}
                  onChange={(e) => setLocalForm({ ...localForm, companyIdentifier: e.target.value })}
                  placeholder="Ej: 900.123.456"
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-black text-slate-800 outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="space-y-4 col-span-1 md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Nombres de banco o cuentas bancarias</label>
                <div className="flex flex-col gap-2">
                  <input
                    type="text"
                    value={localForm.shareLabel}
                    onChange={(e) => setLocalForm({ ...localForm, shareLabel: e.target.value })}
                    placeholder="COMPLETAR"
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-black text-slate-800 outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <div className="flex flex-col sm:flex-row gap-3 ml-1 mt-1 items-start sm:items-center">
                    <button
                      onClick={() => setLocalForm({ ...localForm, shareLabelBold: !localForm.shareLabelBold })}
                      className={`px-3 py-1.5 rounded-lg text-[8px] font-black uppercase transition-all shadow-sm ${localForm.shareLabelBold ? 'bg-indigo-600 text-white ring-2 ring-indigo-300' : 'bg-white text-slate-400 border border-slate-200'}`}
                    >
                      <i className="fa-solid fa-bold mr-1"></i> Negrita
                    </button>
                    <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-slate-200 shadow-sm">
                      {['normal', 'medium', 'large'].map((size) => (
                        <button
                          key={size}
                          onClick={() => setLocalForm({ ...localForm, shareLabelSize: size as any })}
                          className={`px-3 py-1.5 rounded-lg text-[8px] font-black uppercase transition-all ${localForm.shareLabelSize === size ? 'bg-blue-600 text-white shadow-md ring-2 ring-blue-200' : 'text-slate-400 hover:bg-slate-50'}`}
                        >
                          {size === 'normal' ? 'Normal' : size === 'medium' ? 'Med.' : 'Gnd.'}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Numero de cuenta o alias de la empresa</label>
                <div className="flex flex-col gap-2">
                  <input
                    type="text"
                    value={localForm.shareValue}
                    onChange={(e) => setLocalForm({ ...localForm, shareValue: e.target.value })}
                    placeholder="COMPLETAR"
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-black text-slate-800 outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <div className="flex flex-col sm:flex-row gap-3 ml-1 mt-1 items-start sm:items-center">
                    <button
                      onClick={() => setLocalForm({ ...localForm, shareValueBold: !localForm.shareValueBold })}
                      className={`px-3 py-1.5 rounded-lg text-[8px] font-black uppercase transition-all shadow-sm ${localForm.shareValueBold ? 'bg-indigo-600 text-white ring-2 ring-indigo-300' : 'bg-white text-slate-400 border border-slate-200'}`}
                    >
                      <i className="fa-solid fa-bold mr-1"></i> Negrita
                    </button>
                    <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-slate-200 shadow-sm">
                      {['normal', 'medium', 'large'].map((size) => (
                        <button
                          key={size}
                          onClick={() => setLocalForm({ ...localForm, shareValueSize: size as any })}
                          className={`px-3 py-1.5 rounded-lg text-[8px] font-black uppercase transition-all ${localForm.shareValueSize === size ? 'bg-blue-600 text-white shadow-md ring-2 ring-blue-200' : 'text-slate-400 hover:bg-slate-50'}`}
                        >
                          {size === 'normal' ? 'Normal' : size === 'medium' ? 'Med.' : 'Gnd.'}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* OPCIONES DE FORMATO DE IMPRESIÓN */}
            <div className="col-span-1 md:col-span-2 pt-6 border-t border-slate-100 space-y-6">
              <div className="flex items-center gap-2">
                <i className="fa-solid fa-wand-magic-sparkles text-blue-600"></i>
                <h4 className="text-[10px] font-black text-slate-800 uppercase tracking-widest">Estilos de Impresión (Resaltado)</h4>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {/* Nombre de la Empresa */}
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-3">
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none">Nombre de Empresa</p>
                  <div className="flex flex-col gap-3">
                    <button
                      onClick={() => setLocalForm({ ...localForm, companyNameBold: !localForm.companyNameBold })}
                      className={`w-fit px-3 py-1.5 rounded-lg text-[9px] font-black uppercase transition-all shadow-sm ${localForm.companyNameBold ? 'bg-indigo-600 text-white shadow-lg ring-2 ring-indigo-300' : 'bg-white text-slate-400 border border-slate-200'}`}
                    >
                      <i className="fa-solid fa-bold mr-1"></i> Negrita
                    </button>
                    <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-slate-200 w-fit shadow-sm">
                      {['normal', 'medium', 'large'].map((size) => (
                        <button
                          key={size}
                          onClick={() => setLocalForm({ ...localForm, companyNameSize: size as any })}
                          className={`px-3 py-1.5 rounded-lg text-[8px] font-black uppercase transition-all ${localForm.companyNameSize === size ? 'bg-blue-600 text-white shadow-md ring-2 ring-blue-200' : 'text-slate-400 hover:bg-slate-50'}`}
                        >
                          {size === 'normal' ? 'Normal' : size === 'medium' ? 'Mediano' : 'Grande'}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* ID Empresa */}
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-3">
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none">ID Legal (NIT/RUC)</p>
                  <div>
                    <button
                      onClick={() => setLocalForm({ ...localForm, companyIdentifierBold: !localForm.companyIdentifierBold })}
                      className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase transition-all shadow-sm ${localForm.companyIdentifierBold ? 'bg-indigo-600 text-white shadow-lg ring-2 ring-indigo-300' : 'bg-white text-slate-400 border border-slate-200'}`}
                    >
                      <i className="fa-solid fa-bold mr-1"></i> Negrita
                    </button>
                  </div>
                </div>

                {/* Teléfono */}
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-3">
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none">Teléfono Soporte</p>
                  <div>
                    <button
                      onClick={() => setLocalForm({ ...localForm, contactPhoneBold: !localForm.contactPhoneBold })}
                      className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase transition-all shadow-sm ${localForm.contactPhoneBold ? 'bg-indigo-600 text-white shadow-lg ring-2 ring-indigo-300' : 'bg-white text-slate-400 border border-slate-200'}`}
                    >
                      <i className="fa-solid fa-bold mr-1"></i> Negrita
                    </button>
                  </div>
                </div>
              </div>

              {/* Margen de Impresión */}
              <div className="p-5 bg-blue-50/50 rounded-2xl border border-blue-100 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center text-blue-600">
                    <i className="fa-solid fa-arrows-up-down"></i>
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-slate-800 uppercase leading-none">Margen Final (Cola del Recibo)</p>
                    <p className="text-[9px] font-bold text-slate-400 uppercase mt-1">Largo del papel sobrante</p>
                  </div>
                </div>
                <div className="flex items-center gap-4 w-full sm:w-auto px-2">
                  <input
                    type="range"
                    min="0"
                    max="10"
                    step="1"
                    value={localForm.receiptPrintMargin}
                    onChange={(e) => setLocalForm({ ...localForm, receiptPrintMargin: parseInt(e.target.value) })}
                    className="flex-1 sm:w-32 accent-blue-600"
                  />
                  <span className="w-12 text-center py-1 bg-white border border-blue-200 rounded-lg text-[10px] font-black text-blue-700">
                    {localForm.receiptPrintMargin} <span className="text-[8px] opacity-50">LÍNEAS</span>
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-8 pt-6 border-t border-slate-100">
            <button
              onClick={() => {
                updateSettings({ ...state.settings, ...localForm });
                // Explicitly save printer margin for the service to pick up
                localStorage.setItem('printer_margin_bottom', localForm.receiptPrintMargin.toString());
                alert("✅ Datos de la empresa guardados correctamente.");
              }}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white py-4 rounded-xl font-black uppercase text-[10px] tracking-widest shadow-lg shadow-blue-500/20 active:scale-95 transition-all flex items-center justify-center gap-3"
            >
              <i className="fa-solid fa-floppy-disk text-sm"></i>
              GUARDAR DATOS DE EMPRESA
            </button>
          </div>
        </div>
      )}

      {/* ZONA DE ESTABILIZACIÓN - ACCESIBLE PARA ADMIN Y GERENTE */}
      {isPowerUser && (
        <div className="bg-white p-6 md:p-8 rounded-2xl md:rounded-[2.5rem] border border-slate-100 shadow-sm hover:shadow-lg transition-all border-l-8 border-l-amber-400">
          <div className="flex items-center gap-3 mb-6">
            <i className="fa-solid fa-satellite-dish text-xl md:text-2xl text-amber-500 animate-pulse"></i>
            <div>
              <h3 className="text-base md:text-lg font-black text-slate-800 uppercase">Zona de Estabilización</h3>
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Solución de Sincronización</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Estado de Red */}
            <div className={`p-5 rounded-2xl border-2 flex flex-col items-center justify-center gap-2 transition-all ${isOnline ? 'border-emerald-200 bg-emerald-50' : 'border-red-200 bg-red-50'}`}>
              <div className={`w-12 h-12 rounded-full flex items-center justify-center text-2xl mb-2 ${isOnline ? 'bg-emerald-100 text-emerald-600' : 'bg-red-100 text-red-600'}`}>
                <i className={`fa-solid ${isOnline ? 'fa-wifi' : 'fa-triangle-exclamation'}`}></i>
              </div>
              <h4 className={`text-sm font-black uppercase ${isOnline ? 'text-emerald-800' : 'text-red-800'}`}>
                {isOnline ? 'Conexión Estable' : 'Sin Internet Real'}
              </h4>
              <p className="text-[10px] font-bold text-center opacity-60 uppercase tracking-widest leading-tight px-4">
                {isOnline ? 'La App tiene acceso verificado a los servidores.' : 'Detectamos problemas de conexión. Los datos se guardarán localmente.'}
              </p>
            </div>

            {/* Controles */}
            <div className="space-y-3">
              <button
                onClick={onForceSync}
                disabled={isSyncing || !isOnline}
                className={`w-full p-4 rounded-2xl border-2 flex items-center justify-center gap-4 transition-all shadow-lg active:scale-95 ${isSyncing ? 'bg-slate-100 border-slate-200 text-slate-400' : 'bg-amber-400 border-amber-400 text-amber-950 hover:bg-amber-500'}`}
              >
                <i className={`fa-solid ${isSyncing ? 'fa-arrows-rotate animate-spin' : 'fa-rotate'} text-xl`}></i>
                <span className="text-[10px] font-black uppercase tracking-widest">
                  {isSyncing ? 'SINCRONIZANDO...' : 'FORZAR SINCRONIZACIÓN'}
                </span>
              </button>

              <button
                onClick={() => {
                  if (confirm("¿ESTÁ SEGURO DE LIMPIAR LA COLA DE SINCRONIZACIÓN? ESTO ELIMINARÁ DATOS PENDIENTES DE SUBIR SI LOS HAY.")) {
                    onClearQueue && onClearQueue();
                  }
                }}
                className="w-full p-4 rounded-2xl border-2 border-red-600 bg-red-50 text-red-600 flex items-center justify-center gap-4 transition-all shadow-lg active:scale-95"
              >
                <i className="fa-solid fa-trash-can text-xl"></i>
                <span className="text-[10px] font-black uppercase tracking-widest">LIMPIAR COLA</span>
              </button>

              <button
                onClick={handleOpenWeb}
                className="w-full p-4 rounded-2xl border-2 border-slate-900 bg-slate-900 text-white flex items-center justify-center gap-4 transition-all shadow-lg active:scale-95"
              >
                <i className="fa-brands fa-chrome text-xl"></i>
                <span className="text-[10px] font-black uppercase tracking-widest text-center">ABRIR VERSIÓN WEB</span>
              </button>

              <button
                onClick={() => {
                  if (confirm("¿USAR ESTA OPCIÓN SI FALTAN PAGOS O DATOS ANTIGUOS? ESTO RE-DESCARGARÁ TODO DESDE CERO.")) {
                    localStorage.removeItem('last_sync_timestamp');
                    localStorage.removeItem('last_sync_timestamp_v6');
                    if (onForceSync) onForceSync();
                  }
                }}
                className="w-full p-4 rounded-2xl border-2 border-slate-900 bg-slate-900 text-white flex items-center justify-center gap-4 transition-all shadow-lg active:scale-95"
              >
                <i className="fa-solid fa-cloud-arrow-down text-xl"></i>
                <span className="text-[10px] font-black uppercase tracking-widest text-center">REPARAR PROBL. SINCRONIZACIÓN</span>
              </button>

              {/* BOTON DE REPARACIÓN PROFUNDA (EL DEFINITIVO) */}
              <button
                onClick={onDeepReset}
                className="w-full p-4 rounded-2xl border-2 border-red-600 bg-white text-red-600 flex items-center justify-center gap-4 transition-all shadow-lg active:scale-95 hover:bg-red-50"
              >
                <i className="fa-solid fa-triangle-exclamation text-xl"></i>
                <span className="text-[10px] font-black uppercase tracking-widest text-center">REPARACIÓN PROFUNDA (BORRAR TODO)</span>
              </button>
            </div>
          </div>
          <p className="text-[9px] font-bold text-slate-400 mt-4 uppercase tracking-widest leading-relaxed text-center">
            * Use "Forzar Sincronización" si sus pagos no aparecen. Use "Reparación Profunda" solo si el problema persiste tras forzar.
          </p>
        </div>
      )}


      {
        isPowerUser && (
          <div className="bg-white p-6 md:p-8 rounded-2xl md:rounded-[2.5rem] border border-slate-100 shadow-sm hover:shadow-lg transition-all">
            <div className="flex items-center gap-3 mb-6">
              <i className="fa-solid fa-coins text-xl md:text-2xl text-amber-500"></i>
              <h3 className="text-base md:text-lg font-black text-slate-800 uppercase">Formato de Moneda</h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <button
                onClick={() => handleFormatChange('dot')}
                className={`p-5 rounded-2xl border-2 flex flex-col items-center gap-2 transition-all ${numberFormat !== 'comma' ? 'border-emerald-600 bg-emerald-50' : 'border-slate-100 bg-slate-50 active:border-emerald-200'}`}
              >
                <span className={`text-xl font-black ${numberFormat !== 'comma' ? 'text-emerald-700' : 'text-slate-500'}`}>1.000.000,00</span>
                <span className="text-[10px] font-black uppercase tracking-widest opacity-60">PUNTO DE MIL</span>
              </button>

              <button
                onClick={() => handleFormatChange('comma')}
                className={`p-5 rounded-2xl border-2 flex flex-col items-center gap-2 transition-all ${numberFormat === 'comma' ? 'border-emerald-600 bg-emerald-50' : 'border-slate-100 bg-slate-50 active:border-emerald-200'}`}
              >
                <span className={`text-xl font-black ${numberFormat === 'comma' ? 'text-emerald-700' : 'text-slate-500'}`}>1,000,000.00</span>
                <span className="text-[10px] font-black uppercase tracking-widest opacity-60">PUNTO DE COMA</span>
              </button>
            </div>
          </div>
        )
      }

      {/* Configuración de Impresora - ACCESIBLE PARA TODOS */}
      <div className="bg-white p-6 md:p-8 rounded-2xl md:rounded-[2.5rem] border border-slate-100 shadow-sm hover:shadow-lg transition-all">

        <div className="flex items-center gap-3 mb-6">
          <i className="fa-solid fa-print text-xl md:text-2xl text-blue-600"></i>
          <h3 className="text-base md:text-lg font-black text-slate-800 uppercase">Configuración de Impresora</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-4">
            <button
              onClick={() => {
                setShowPrinterModal(true);
                handleScanPrinters();
              }}
              disabled={scanningPrinters}
              className={`w-full p-5 rounded-2xl border-2 flex items-center justify-center gap-4 transition-all ${scanningPrinters ? 'bg-slate-100 border-slate-200' : 'bg-blue-600 text-white border-blue-600 shadow-lg shadow-blue-500/20 active:scale-95 text-center'}`}
            >
              {scanningPrinters ? <i className="fa-solid fa-spinner animate-spin text-xl text-center"></i> : <i className="fa-solid fa-bluetooth text-xl"></i>}
              <span className="text-[10px] font-black uppercase tracking-widest">{scanningPrinters ? 'BUSCANDO...' : 'BUSCAR IMPRESORA'}</span>
            </button>
            {connectedDevice && (
              <div className="px-4 py-2 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-xl text-[10px] font-black uppercase text-center animate-fadeIn">
                <i className="fa-solid fa-circle-check mr-2"></i>
                Vinculado: {connectedDevice}
              </div>
            )}
          </div>

          <button
            onClick={handleTestPrint}
            className="w-full p-5 rounded-2xl border-2 border-slate-900 bg-slate-900 text-white flex items-center justify-center gap-4 transition-all shadow-lg active:scale-95"
          >
            <i className="fa-solid fa-vial text-xl"></i>
            <span className="text-[10px] font-black uppercase tracking-widest text-center">PROBAR IMPRESIÓN</span>
          </button>
        </div>
        <p className="text-[9px] font-bold text-slate-400 mt-4 uppercase tracking-widest leading-relaxed">
          * Conecte su impresora térmica vía Bluetooth para imprimir recibos automáticamente tras cada cobro.
        </p>
      </div>



      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-8">
        {/* COLUMNA 1: IDIOMA */}
        <div className="flex flex-col gap-4 md:gap-6">
          <div className="bg-white p-6 md:p-8 rounded-2xl md:rounded-[2.5rem] border border-slate-100 shadow-sm hover:shadow-lg transition-all h-full">
            <div className="flex items-center gap-3 mb-5 md:mb-6">
              <i className="fa-solid fa-language text-xl md:text-2xl text-blue-600"></i>
              <h3 className="text-base md:text-lg font-black text-slate-800 uppercase">Idioma App</h3>
            </div>

            <div className="space-y-2 md:space-y-3">
              {languages.map((lang) => (
                <button
                  key={lang.code}
                  onClick={() => handleLanguageChange(lang.code as Language)}
                  className={`w-full p-3.5 md:p-4 rounded-xl md:rounded-2xl border-2 flex items-center justify-between transition-all group ${language === lang.code ? 'border-blue-600 bg-blue-50' : 'border-slate-100 active:border-blue-200'}`}
                >
                  <div className="flex items-center gap-3 md:gap-4">
                    <span className="text-xl md:text-2xl">{lang.flag}</span>
                    <span className={`font-black uppercase text-xs md:text-sm ${language === lang.code ? 'text-blue-700' : 'text-slate-600'}`}>{lang.name}</span>
                  </div>
                  {language === lang.code && <i className="fa-solid fa-circle-check text-blue-600"></i>}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* COLUMNA 2: PAÍS + BOTÓN GUARDAR Y SALIR */}
        <div className="flex flex-col gap-4 md:gap-6">
          <div className="bg-white p-6 md:p-8 rounded-2xl md:rounded-[2.5rem] border border-slate-100 shadow-sm hover:shadow-lg transition-all h-fit flex flex-col">
            <div className="flex items-center gap-3 mb-1.5 md:mb-2">
              <i className="fa-solid fa-earth-americas text-xl md:text-2xl text-emerald-600"></i>
              <h3 className="text-base md:text-lg font-black text-slate-800 uppercase">País de Operación</h3>
            </div>
            <p className="text-[8px] md:text-[10px] text-slate-400 mb-4 font-medium leading-relaxed">
              Ajusta festivos y formato de moneda.
            </p>

            <div className="grid grid-cols-1 gap-1.5 max-h-[300px] md:max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
              {countries.map((ctry) => (
                <button
                  key={ctry.code}
                  onClick={() => handleCountryChange(ctry.code as CountryCode)}
                  className={`w-full p-2.5 md:p-3 rounded-xl border-2 flex items-center justify-between transition-all ${country === ctry.code ? 'border-emerald-600 bg-emerald-50' : 'border-slate-100 active:border-emerald-200'}`}
                >
                  <div className="flex items-center gap-2 md:gap-3">
                    <span className="text-lg md:text-2xl">{ctry.flag}</span>
                    <span className={`font-black uppercase text-[10px] md:text-xs ${country === ctry.code ? 'text-emerald-700' : 'text-slate-600'}`}>{ctry.name}</span>
                  </div>
                  {country === ctry.code && <i className="fa-solid fa-circle-check text-emerald-600"></i>}
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={handleSaveAndExit}
            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-black py-5 rounded-2xl md:rounded-[2rem] shadow-xl shadow-emerald-500/20 transition-all active:scale-95 uppercase tracking-[0.2em] text-xs md:text-sm flex items-center justify-center gap-3 border-b-4 border-emerald-800"
          >
            <i className="fa-solid fa-cloud-arrow-up text-lg"></i>
            GUARDAR Y SALIR
          </button>
        </div>
      </div>

      {
        showSupportModal && (
          <div className="fixed inset-0 bg-slate-900/98 flex items-start pt-10 md:pt-20 justify-center z-[150] p-4 overflow-y-auto animate-fadeIn">
            <div className="bg-white rounded-[2rem] shadow-2xl w-full max-sm overflow-hidden animate-scaleIn border border-white/20">
              <div className="p-5 bg-blue-600 text-white flex justify-between items-center sticky top-0 z-10">
                <div>
                  <h3 className="text-base font-black uppercase tracking-tighter leading-none">Soporte Técnico</h3>
                  <p className="text-[10px] font-bold opacity-70 uppercase tracking-widest mt-1">Configuración Global</p>
                </div>
                <button onClick={() => setShowSupportModal(false)} className="w-8 h-8 bg-white/10 text-white rounded-lg flex items-center justify-center hover:bg-red-600 transition-all">
                  <i className="fa-solid fa-xmark text-lg"></i>
                </button>
              </div>
              <form onSubmit={handleSaveSupportPhone} className="p-6 space-y-4 bg-slate-50">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Número de Teléfono</label>
                  <div className="relative">
                    <i className="fa-solid fa-phone absolute left-4 top-1/2 -translate-y-1/2 text-slate-300"></i>
                    <input
                      required
                      type="tel"
                      autoFocus
                      value={supportPhone}
                      onChange={(e) => setSupportPhone(e.target.value)}
                      placeholder="Ej: +57 300 123 4567"
                      className="w-full pl-12 pr-4 py-4 bg-white border border-slate-200 rounded-2xl text-base font-black text-slate-800 outline-none focus:ring-4 focus:ring-blue-500/20 shadow-inner"
                    />
                  </div>
                  <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest mt-2 ml-1 leading-relaxed">
                    <i className="fa-solid fa-info-circle mr-1 text-blue-500"></i>
                    Este número aparecerá en el menú lateral de todos los Gerentes.
                  </p>
                </div>
                <button type="submit" className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-black uppercase text-xs tracking-widest shadow-xl active:scale-95 transition-all">
                  GUARDAR CAMBIOS
                </button>
              </form>
            </div>
          </div>
        )
      }
      {
        showPrinterModal && (
          <div className="fixed inset-0 bg-slate-900/98 flex items-start pt-10 md:pt-20 justify-center z-[200] p-4 overflow-y-auto">
            <div className="bg-white w-full max-w-sm rounded-[2rem] shadow-2xl overflow-hidden animate-scaleIn mx-4">
              <div className="bg-slate-900 p-6 flex justify-between items-center">
                <h3 className="text-white font-black uppercase text-lg tracking-tighter">
                  <i className="fa-brands fa-bluetooth-b text-blue-400 mr-2"></i>
                  Vincular Impresora
                </h3>
                <button onClick={() => setShowPrinterModal(false)} className="text-white/50 hover:text-white">
                  <i className="fa-solid fa-xmark text-xl"></i>
                </button>
              </div>
              <div className="p-4">
                <div className="flex justify-center mb-6">
                  <button
                    onClick={handleScanPrinters}
                    disabled={scanningPrinters}
                    className={`w-full py-4 rounded-xl font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 shadow-lg transition-all ${scanningPrinters ? 'bg-slate-100 text-slate-400' : 'bg-blue-600 text-white hover:bg-blue-700 active:scale-95'}`}
                  >
                    {scanningPrinters ? (
                      <>
                        <i className="fa-solid fa-circle-notch fa-spin"></i> BUSCANDO...
                      </>
                    ) : (
                      <>
                        <i className="fa-solid fa-magnifying-glass"></i> BUSCAR VINCULADOS
                      </>
                    )}
                  </button>
                </div>

                <div className="space-y-2 max-h-[300px] overflow-y-auto">
                  {printerDevices.length === 0 ? (
                    <div className="text-center py-8 text-slate-400">
                      <i className="fa-solid fa-print text-4xl mb-2 opacity-20"></i>
                      <p className="text-[10px] font-bold uppercase">No se encontraron dispositivos</p>
                      <p className="text-[9px] mt-2">Asegúrate de haber vinculado tu impresora en los ajustes de Bluetooth del celular.</p>
                    </div>
                  ) : (
                    printerDevices.map((dev, idx) => (
                      <button
                        key={idx}
                        onClick={() => handleSelectPrinter(dev)}
                        className="w-full text-left p-3 bg-slate-50 border border-slate-100 rounded-xl hover:bg-blue-50 hover:border-blue-200 transition-all group"
                      >
                        <div className="flex justify-between items-center">
                          <div>
                            <p className="font-black text-slate-700 uppercase text-xs">{dev.name || 'Desconocido'}</p>
                            <p className="font-mono text-[9px] text-slate-400">{dev.address || dev.id}</p>
                          </div>
                          <i className="fa-solid fa-chevron-right text-slate-300 group-hover:text-blue-500"></i>
                        </div>
                      </button>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        )
      }
    </div >
  );
};

export default Settings;
