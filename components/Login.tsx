
import React, { useState } from 'react';
import { User, Role } from '../types';
import { getTranslation } from '../utils/translations';
import { supabase } from '../utils/supabaseClient';
import { generateUUID } from '../utils/helpers';

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
    <div className="min-h-screen bg-[#0f172a] flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background Decor */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-emerald-600/10 rounded-full blur-[120px]"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-600/10 rounded-full blur-[120px]"></div>

      <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-md overflow-hidden animate-scaleIn relative z-10">
        <div className="p-10 text-center bg-gradient-to-br from-emerald-600 to-emerald-800 text-white relative">
          <div className="w-20 h-20 bg-white/20 backdrop-blur-md rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-xl border border-white/20">
            <i className="fa-solid fa-sack-dollar text-4xl text-white"></i>
          </div>
          <h1 className="text-3xl font-black tracking-tight mb-2 uppercase">{t.welcome}</h1>
          <p className="text-emerald-100 font-bold uppercase text-[10px] tracking-widest">{t.subtitle}</p>
        </div>

        <div className="p-10 space-y-6">
          <form onSubmit={handleLogin} className="space-y-6">
            {error && (
              <div className="p-4 bg-red-50 text-red-600 rounded-2xl border border-red-100 text-[10px] font-black uppercase tracking-widest flex items-center gap-3 animate-shake">
                <i className="fa-solid fa-circle-exclamation text-lg"></i>
                <span className="leading-tight">{error}</span>
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">{t.username}</label>
                <div className="relative">
                  <i className="fa-solid fa-user absolute left-4 top-1/2 -translate-y-1/2 text-slate-300"></i>
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    autoComplete="username"
                    className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none font-bold text-slate-700 transition-all uppercase placeholder:normal-case"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">{t.password}</label>
                <div className="relative">
                  <i className="fa-solid fa-lock absolute left-4 top-1/2 -translate-y-1/2 text-slate-300"></i>
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="current-password"
                    className="w-full pl-12 pr-12 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none font-bold text-slate-700 transition-all"
                    placeholder="••••••••"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-emerald-600 transition-colors"
                  >
                    <i className={`fa-solid ${showPassword ? 'fa-eye-slash' : 'fa-eye'}`}></i>
                  </button>
                </div>
              </div>
            </div>

            <button
              type="submit"
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-black py-4 rounded-2xl shadow-xl shadow-emerald-500/30 transition-all active:scale-[0.98] uppercase tracking-widest text-sm"
            >
              {t.loginBtn}
            </button>
          </form>
          <div className="relative flex items-center py-2">
            <div className="flex-grow border-t border-slate-100"></div>
            <span className="flex-shrink mx-4 text-[9px] font-black text-slate-300 uppercase tracking-widest">O TAMBIÉN</span>
            <div className="flex-grow border-t border-slate-100"></div>
          </div>

          <button
            onClick={(e) => {
              e.preventDefault();
              window.open('https://wa.me/595994560450', '_blank');
            }}
            type="button"
            className="w-full bg-slate-900 hover:bg-black text-white font-black py-4 rounded-2xl shadow-xl transition-all active:scale-[0.98] tracking-widest text-[10px] flex items-center justify-center gap-3"
          >
            <i className="fa-brands fa-whatsapp text-emerald-400 text-lg"></i>
            SOPORTE +595994560450
          </button>
          <div className="text-center pt-2">
            <p className="text-slate-400 text-[9px] font-black uppercase tracking-widest">
              {t.footer}
            </p>
          </div>
        </div>
      </div>

      {/* MODAL DE CREDENCIALES GENERADAS */}
      {generatedUser && (
        <div className="fixed inset-0 bg-slate-900/90 backdrop-blur-xl flex items-center justify-center z-[200] p-4">
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
