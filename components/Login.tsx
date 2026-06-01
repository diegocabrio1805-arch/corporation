import React, { useState } from 'react';
import { User, Role } from '../types';
import { StorageService } from '../utils/localforageStorage';
import { getTranslation } from '../utils/translations';
import { supabase } from '../utils/supabaseClient';
import { generateUUID } from '../utils/helpers';
import { APP_MODE } from '../build_config';

interface LoginProps {
  onLogin: (user: User) => void;
  users: User[];
  onGenerateManager: (data: { name: string, username: string, pass: string }) => void;
  onSyncUser?: (user: User) => void; // New prop to sync a newly found user
  onForceSync?: () => void;
}

const Login: React.FC<LoginProps> = ({ onLogin, users, onGenerateManager, onSyncUser, onForceSync }) => {
  console.log("--- LOGIN RENDER STARTED ---");
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [generatedUser, setGeneratedUser] = useState<{ username: string, pass: string } | null>(null);

  const t = getTranslation('es').auth;

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (onForceSync) onForceSync();

    const cleanUsername = username.trim();

    // 1. Try Local offline cache primarily for offline usage when they are locked out
    let localUser = users.find(u =>
      u.username.toLowerCase() === cleanUsername.toLowerCase() &&
      u.password === password
    );

    if (navigator.onLine) {
      try {
        // Native Auth request leveraging Supabase secure endpoints
        const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
          email: cleanUsername.toLowerCase() + '@anexocobro.com',
          password: password
        });

        if (authError || !authData.user) {
          setError("CREDENCIALES INVÁLIDAS O SESIÓN CADUCADA");
          return;
        }

        // Fetch corresponding application profile to verify active/blocked status
        const { data: profileData } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', authData.user.id)
          .single();

        if (profileData) {
          if (profileData.blocked) {
            setError("SU CUENTA HA SIDO BLOQUEADA POR VENCIMIENTO O ADMINISTRACIÓN");
            await supabase.auth.signOut();
            return;
          }
          // Map snake_case DB fields to camelCase frontend fields
          const mappedProfile: User = {
            id: profileData.id,
            name: profileData.name,
            username: profileData.username,
            password: profileData.password,
            role: profileData.role as Role,
            blocked: profileData.blocked,
            expiryDate: profileData.expiry_date,
            managedBy: profileData.managed_by,
            profilePic: profileData.profile_pic,
            homePic: profileData.home_pic,
            homeLocation: profileData.home_location,
            requiresLocation: profileData.requires_location,
            deletedAt: profileData.deleted_at,
          };
          if (onSyncUser) onSyncUser(mappedProfile);
          onLogin(mappedProfile);
          return;
        } else {
          setError("ERROR: PERFIL INEXISTENTE");
        }
      } catch (err) {
        console.error("Online login check failed", err);
        setError("ERROR AL CONECTAR CON SERVIDOR");
      }
    } else {
      // Offline fallback
      if (localUser) {
        if (localUser.blocked) {
          setError("SU CUENTA HA SIDO BLOQUEADA POR VENCIMIENTO O ADMINISTRACIÓN");
          return;
        }
        onLogin(localUser);
      } else {
        setError(t.error); // Fallback to traditional error msg
      }
    }
  };

  const handleAutoGenerate = () => {
    const id = generateUUID().substr(0, 5).toUpperCase();
    const newUsername = `admin${id}`;
    const newPass = Math.floor(100000 + Math.random() * 900000).toString();

    onGenerateManager({
      name: `GERENTE PRUEBA ${id}`,
      username: newUsername,
      pass: newPass
    });

    setGeneratedUser({ username: newUsername, pass: newPass });
  };

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4 relative overflow-hidden">
      {/* Dynamic Background Elements */}
      <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] bg-emerald-500/20 rounded-full blur-[120px] animate-pulse"></div>
      <div className="absolute bottom-[-20%] right-[-10%] w-[60%] h-[60%] bg-indigo-500/20 rounded-full blur-[120px] animate-pulse [animation-delay:1s]"></div>

      <div className="glass-card rounded-[3rem] w-full max-w-md overflow-hidden animate-scaleIn relative z-10 border-white/20">
        <div className="p-12 text-center bg-gradient-to-br from-emerald-500 via-emerald-600 to-teal-700 text-white relative">
          <div className="w-24 h-24 bg-white/20 backdrop-blur-md rounded-[2.5rem] flex items-center justify-center mx-auto mb-8 shadow-2xl border border-white/30 rotate-3 hover:rotate-0 transition-transform duration-500">
            <i className="fa-solid fa-sack-dollar text-5xl text-white drop-shadow-lg"></i>
          </div>
          <h1 className="text-4xl font-black tracking-tighter mb-3 uppercase italic">ANEXO <span className="text-emerald-200">COBRO</span></h1>
          <p className="text-emerald-100 font-bold uppercase text-[11px] tracking-[0.3em] opacity-80">{t.subtitle}</p>
        </div>

        <div className="p-10 space-y-6 bg-white">
          <form onSubmit={handleLogin} className="space-y-8">
            {error && (
              <div className="p-5 bg-rose-500/10 text-rose-200 rounded-3xl border border-rose-500/20 text-[10px] font-black uppercase tracking-widest flex items-center gap-4 animate-shake">
                <i className="fa-solid fa-circle-exclamation text-xl text-rose-400"></i>
                <span className="leading-tight">{error}</span>
              </div>
            )}

            <div className="space-y-6">
              <div className="group">
                <label className="block text-[11px] font-black text-slate-500 uppercase tracking-widest mb-3 ml-2 group-focus-within:text-emerald-500 transition-colors uppercase">{t.username}</label>
                <div className="relative">
                  <div className="absolute left-5 top-1/2 -translate-y-1/2 w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center text-slate-500 group-focus-within:bg-emerald-500 group-focus-within:text-white transition-all">
                    <i className="fa-solid fa-user"></i>
                  </div>
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    autoComplete="username"
                    className="w-full pl-20 pr-5 py-5 bg-slate-50 border border-slate-200 rounded-3xl focus:ring-4 focus:ring-emerald-500/20 outline-none font-bold text-slate-800 transition-all uppercase placeholder:normal-case tracking-wider"
                    required
                    placeholder="USUARIO"
                  />
                </div>
              </div>

              <div className="group">
                <label className="block text-[11px] font-black text-slate-500 uppercase tracking-widest mb-3 ml-2 group-focus-within:text-emerald-500 transition-colors uppercase">{t.password}</label>
                <div className="relative">
                  <div className="absolute left-5 top-1/2 -translate-y-1/2 w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center text-slate-500 group-focus-within:bg-emerald-500 group-focus-within:text-white transition-all">
                    <i className="fa-solid fa-lock"></i>
                  </div>
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="current-password"
                    className="w-full pl-20 pr-14 py-5 bg-slate-50 border border-slate-200 rounded-3xl focus:ring-4 focus:ring-emerald-500/20 outline-none font-bold text-slate-800 transition-all tracking-[0.3em]"
                    placeholder="••••••••"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-5 top-1/2 -translate-y-1/2 w-10 h-10 flex items-center justify-center text-slate-500 hover:text-emerald-400 transition-colors"
                  >
                    <i className={`fa-solid ${showPassword ? 'fa-eye-slash' : 'fa-eye'}`}></i>
                  </button>
                </div>
              </div>
            </div>

            <button
              type="submit"
              className="w-full premium-gradient hover:shadow-emerald-500/40 hover:scale-[1.02] text-white font-black py-5 rounded-3xl shadow-2xl transition-all active:scale-[0.98] uppercase tracking-widest text-sm border border-white/20"
            >
              <i className="fa-solid fa-right-to-bracket mr-3"></i>
              {t.loginBtn}
            </button>
          </form>

          <div className="relative flex items-center py-4">
            <div className="flex-grow border-t border-white/10"></div>
            <span className="flex-shrink mx-6 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">{t.footer}</span>
            <div className="flex-grow border-t border-white/10"></div>
          </div>

          <button
            onClick={(e) => {
              e.preventDefault();
              const message = encodeURIComponent("¡Hola! Me interesa solicitar la demo gratuita por 15 días del sistema Anexo Cobro.");
              window.open(`https://wa.me/595994560450?text=${message}`, '_blank');
            }}
            type="button"
            className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-black py-5 rounded-3xl transition-all active:scale-[0.98] tracking-widest text-[10px] flex items-center justify-center gap-4 group shadow-lg shadow-blue-500/20 hover:shadow-blue-500/40 border border-blue-400/20"
          >
            <div className="w-8 h-8 bg-white text-emerald-600 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform shadow-sm">
              <i className="fa-brands fa-whatsapp text-lg"></i>
            </div>
            SOLICITAR DEMO GRATUITA POR 15 DÍAS
          </button>
        </div>
      </div>

      {/* MODAL DE CREDENCIALES GENERADAS */}
      {generatedUser && (
        <div className="fixed inset-0 bg-slate-900/98 flex items-start pt-10 md:pt-20 justify-center z-[200] p-4 overflow-y-auto">
          <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-sm p-8 text-center animate-scaleIn border border-emerald-500/20">
            <div className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-[2rem] flex items-center justify-center mx-auto mb-6 text-4xl shadow-lg border border-emerald-200">
              <i className="fa-solid fa-id-card"></i>
            </div>
            <h3 className="text-xl font-black text-slate-900 mb-2 uppercase tracking-tighter">¡GERENTE GENERADO!</h3>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-6 italic">Cuenta activa por 20 días de prueba</p>

            <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100 space-y-4 shadow-inner mb-8">
              <div>
                <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">USUARIO</p>
                <p className="text-lg font-black text-slate-800 uppercase tracking-widest">{generatedUser.username}</p>
              </div>
              <div className="pt-4 border-t border-slate-200">
                <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">CONTRASEÑA</p>
                <p className="text-2xl font-black text-emerald-600 tracking-[0.3em]">{generatedUser.pass}</p>
              </div>
            </div>

            <div className="p-4 bg-amber-50 rounded-xl border border-amber-200 text-[9px] font-bold text-amber-700 leading-tight mb-8">
              <i className="fa-solid fa-triangle-exclamation mr-1"></i>
              POR FAVOR TOMA CAPTURA O ANOTA ESTOS DATOS. NO SE VOLVERÁN A MOSTRAR.
            </div>

            <button
              onClick={() => setGeneratedUser(null)}
              className="w-full bg-slate-900 text-white font-black py-5 rounded-2xl shadow-xl uppercase text-xs tracking-widest active:scale-95"
            >
              ENTENDIDO, IR AL LOGIN
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Login;
