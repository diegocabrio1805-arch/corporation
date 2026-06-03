import React, { useState } from 'react';
import { supabase } from '../utils/supabaseClient';
import { User, Role } from '../types';

interface UserCaptureProps {
    user: User;
    onUpdateUser: (user: User) => void;
}

const UserCapture: React.FC<UserCaptureProps> = ({ user, onUpdateUser }) => {
    const [loading, setLoading] = useState(false);
    const [location, setLocation] = useState<{ lat: number, lng: number } | null>(null);
    const [file, setFile] = useState<File | null>(null);
    const [message, setMessage] = useState('');

    // State for Profile Editing
    const [editMode, setEditMode] = useState(false);
    const [formData, setFormData] = useState({
        name: user.name,
        username: user.username,
        password: user.password
    });
    const isAdmin = user.role === Role.ADMIN;

    const handleGetLocation = () => {
        if (!navigator.geolocation) {
            setMessage('Geolocalización no soportada por el navegador');
            return;
        }
        setLoading(true);
        navigator.geolocation.getCurrentPosition(
            (position) => {
                setLocation({
                    lat: position.coords.latitude,
                    lng: position.coords.longitude
                });
                setLoading(false);
                setMessage('Ubicación obtenida exitosamente');
            },
            (error) => {
                setLoading(false);
                setMessage(`Error al obtener ubicación: ${error.message}`);
            }
        );
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setFile(e.target.files[0]);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!location || !file) {
            setMessage('Por favor obtén la ubicación y sube una foto');
            return;
        }

        setLoading(true);
        try {
            const fileExt = file.name.split('.').pop();
            const fileName = `${user.id}/${Math.random()}.${fileExt}`;
            const filePath = `${fileName}`;

            const { error: uploadError } = await supabase.storage
                .from('photos')
                .upload(filePath, file);

            if (uploadError) throw uploadError;

            const { data: publicUrlData } = supabase.storage
                .from('photos')
                .getPublicUrl(filePath);

            const { error: dbError } = await supabase
                .from('user_logs')
                .insert({
                    user_id: user.id,
                    latitude: location.lat,
                    longitude: location.lng,
                    image_url: publicUrlData.publicUrl
                });

            if (dbError) throw dbError;

            setMessage('Registro guardado exitosamente!');
            setFile(null);
            setLocation(null);
        } catch (error: any) {
            setMessage(`Error: ${error.message}`);
        } finally {
            setLoading(false);
        }
    };

    const handleProfileUpdate = (e: React.FormEvent) => {
        e.preventDefault();
        onUpdateUser({
            ...user,
            name: formData.name,
            username: formData.username,
            password: formData.password
        });
        setEditMode(false);
        alert("Perfil actualizado correctamente.");
    };

    return (
        <div className="space-y-6">
            <div className="bg-white p-6 rounded-[2rem] shadow-lg max-w-lg mx-auto">
                <h2 className="text-xl font-black text-slate-800 mb-4 uppercase tracking-tighter">
                    <i className="fa-solid fa-camera mr-2 text-emerald-600"></i>
                    Nuevo Registro
                </h2>

                {message && (
                    <div className={`p-3 rounded-xl text-xs font-bold mb-4 ${message.includes('Error') ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-600'}`}>
                        {message}
                    </div>
                )}

                <div className="space-y-4">
                    <button
                        type="button"
                        onClick={handleGetLocation}
                        className="w-full py-3 bg-slate-100 text-slate-600 rounded-xl font-bold text-xs uppercase flex items-center justify-center gap-2 hover:bg-slate-200 transition-colors"
                    >
                        <i className="fa-solid fa-location-dot"></i>
                        {location ? `Ubicación: ${location.lat.toFixed(4)}, ${location.lng.toFixed(4)}` : 'Obtener Ubicación'}
                    </button>

                    <div className="border-2 border-dashed border-slate-200 rounded-xl p-4 text-center">
                        <input
                            type="file"
                            accept="image/*"
                            onChange={handleFileChange}
                            className="hidden"
                            id="photo-upload"
                        />
                        <label htmlFor="photo-upload" className="cursor-pointer flex flex-col items-center gap-2">
                            <i className="fa-solid fa-image text-2xl text-slate-300"></i>
                            <span className="text-xs font-bold text-slate-500 uppercase">
                                {file ? file.name : 'Subir Foto'}
                            </span>
                        </label>                    </div>

                    <button
                        onClick={handleSubmit}
                        disabled={loading || !location || !file}
                        className="w-full py-4 bg-emerald-600 text-white rounded-xl font-black uppercase text-xs tracking-widest shadow-lg shadow-emerald-200 disabled:opacity-50 disabled:shadow-none hover:bg-emerald-700 transition-all"
                    >
                        {loading ? 'Guardando...' : 'Guardar Registro'}
                    </button>
                </div>
            </div>

            {/* SECCION DE PERFIL - VISIBLE PARA TODOS LOS ROLES (Solo editable por Admin/Gerente) */}
            <div className="bg-white p-6 rounded-[2rem] shadow-lg max-w-lg mx-auto border-2 border-slate-100">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-xl font-black text-slate-800 uppercase tracking-tighter">
                        <i className={`fa-solid ${isAdmin ? 'fa-user-shield text-blue-600' : 'fa-user-gear text-emerald-600'} mr-2`}></i>
                        Mi Perfil ({user.role === Role.ADMIN ? 'Admin' : user.role === Role.COLLECTOR ? 'Cobrador' : user.role === Role.MANAGER ? 'Gerente' : 'Usuario'})
                    </h2>

                    {/* Solo permitimos editar si es ADMIN o MANAGER */}
                    {(user.role === Role.ADMIN || user.role === Role.MANAGER) && (
                        !editMode ? (
                            <button onClick={() => setEditMode(true)} className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center hover:bg-blue-100 transition-colors">
                                <i className="fa-solid fa-pen"></i>
                            </button>
                        ) : (
                            <button onClick={() => setEditMode(false)} className="w-8 h-8 rounded-lg bg-red-50 text-red-600 flex items-center justify-center hover:bg-red-100 transition-colors">
                                <i className="fa-solid fa-xmark"></i>
                            </button>
                        )
                    )}
                </div>

                <form onSubmit={handleProfileUpdate} className="space-y-4">
                    <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase mb-1">Nombre Completo</label>
                        <input
                            type="text"
                            value={formData.name}
                            onChange={e => setFormData({ ...formData, name: e.target.value })}
                            disabled={!editMode}
                            className="w-full p-3 bg-slate-50 rounded-xl font-bold text-sm text-slate-700 outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-70 disabled:bg-slate-100"
                        />
                    </div>
                    <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase mb-1">Usuario / Login</label>
                        <input
                            type="text"
                            value={formData.username}
                            onChange={e => setFormData({ ...formData, username: e.target.value })}
                            disabled={!editMode}
                            className="w-full p-3 bg-slate-50 rounded-xl font-bold text-sm text-slate-700 outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-70 disabled:bg-slate-100"
                        />
                    </div>
                    <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase mb-1">Contraseña</label>
                        <div className="relative">
                            <input
                                type="text"
                                value={formData.password}
                                onChange={e => setFormData({ ...formData, password: e.target.value })}
                                disabled={!editMode}
                                className="w-full p-3 bg-slate-50 rounded-xl font-bold text-sm text-slate-700 outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-70 disabled:bg-slate-100"
                            />
                            {!editMode && <div className="absolute inset-0 bg-slate-100/80 rounded-xl"></div>}
                        </div>
                    </div>

                    {editMode && (
                        <button type="submit" className="w-full py-4 bg-blue-600 text-white rounded-xl font-black uppercase text-xs tracking-widest shadow-lg shadow-blue-200 hover:bg-blue-700 transition-all mt-4">
                            Actualizar Credenciales
                        </button>
                    )}
                </form>

                <div className={`mt-4 p-3 rounded-xl border ${user.role === Role.ADMIN || user.role === Role.MANAGER ? 'bg-blue-50 border-blue-100 text-blue-800' : 'bg-slate-100 border-slate-200 text-slate-500'}`}>
                    <p className="text-[9px] font-bold leading-relaxed uppercase">
                        <i className={`fa-solid ${user.role === Role.ADMIN || user.role === Role.MANAGER ? 'fa-shield-halved' : 'fa-lock'} mr-1`}></i>
                        {user.role === Role.ADMIN || user.role === Role.MANAGER
                            ? "Seguridad: Mantenga sus credenciales seguras. Cualquier cambio se reflejará inmediatamente."
                            : "Para cambiar su contraseña o usuario, por favor contacte a su Administrador o Gerente."}
                    </p>
                </div>
            </div>
        </div>
    );
};

export default UserCapture;
