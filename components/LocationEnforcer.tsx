import React, { useState, useEffect } from 'react';
import { Geolocation } from '@capacitor/geolocation';

interface LocationEnforcerProps {
    isRequired: boolean;
    onLocationEnabled: () => void;
}

const LocationEnforcer: React.FC<LocationEnforcerProps> = ({ isRequired, onLocationEnabled }) => {
    const [isLocationEnabled, setIsLocationEnabled] = useState(true);
    const [isChecking, setIsChecking] = useState(false);

    const checkLocationStatus = async () => {
        if (!isRequired) {
            setIsLocationEnabled(true);
            return;
        }

        setIsChecking(true);
        try {
            // Priority: Check if positioning is enabled at system level
            const permission = await Geolocation.checkPermissions();

            if (permission.location === 'granted') {
                // IMPORTANT: In some Android versions, permissions might be 'granted' but GPS is OFF.
                // We must force a position request with high accuracy to be 100% sure.
                try {
                    const pos = await Geolocation.getCurrentPosition({
                        timeout: 3000, // TIMEOUT MÁS RELAJADO PARA EVITAR CUELGUES
                        maximumAge: 5000,
                        enableHighAccuracy: true
                    });

                    if (pos && pos.coords) {
                        setIsLocationEnabled(true);
                        onLocationEnabled();
                    } else {
                        setIsLocationEnabled(false);
                    }
                } catch (err) {
                    // This happens if GPS is physically OFF (Location services disabled)
                    console.warn("[GPS] Location services disabled or timed out:", err);
                    setIsLocationEnabled(false);
                }
            } else {
                setIsLocationEnabled(false);
            }
        } catch (error) {
            console.error("[GPS] Critical check error:", error);
            setIsLocationEnabled(false);
        } finally {
            setIsChecking(false);
        }
    };

    const handleRequestLocation = async () => {
        try {
            const permission = await Geolocation.requestPermissions();
            if (permission.location === 'granted') {
                await checkLocationStatus();
            }
        } catch (error) {
            alert('No se pudo activar la ubicación. Por favor, actívala manualmente en la configuración del dispositivo.');
        }
    };

    useEffect(() => {
        let watchId: string | null = null;

        const startWatching = async () => {
            try {
                // @ts-ignore - Capacitor Geolocation.watchPosition
                watchId = await Geolocation.watchPosition({
                    enableHighAccuracy: true,
                    timeout: 10000
                }, (position, err) => {
                    if (err) {
                        console.warn("[GPS Watch] Error or disabled:", err);
                        setIsLocationEnabled(false);
                    } else if (position) {
                        setIsLocationEnabled(true);
                    }
                });
            } catch (e) {
                console.error("[GPS Watch] Failed to start watcher:", e);
            }
        };

        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible') {
                checkLocationStatus();
            }
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);

        checkLocationStatus();
        startWatching();

        const interval = setInterval(checkLocationStatus, 5000); // 5s: Muy frecuente por pedido del usuario para bloqueo inmediato

        return () => {
            if (watchId) {
                // @ts-ignore
                Geolocation.clearWatch({ id: watchId });
            }
            clearInterval(interval);
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
    }, [isRequired]);

    if (!isRequired || isLocationEnabled) {
        return null;
    }

    return (
        <div className="fixed inset-0 bg-slate-900/95 backdrop-blur-md flex items-center justify-center z-[9999] p-6 animate-fadeIn">
            <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-md overflow-hidden animate-scaleIn border-4 border-red-500">
                <div className="bg-gradient-to-br from-red-600 to-red-700 p-8 text-white relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16"></div>
                    <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/10 rounded-full -ml-12 -mb-12"></div>
                    <div className="relative z-10">
                        <div className="w-20 h-20 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4 animate-pulse">
                            <i className="fa-solid fa-location-crosshairs text-4xl"></i>
                        </div>
                        <h2 className="text-2xl font-black uppercase tracking-tight text-center">
                            Ubicación Requerida
                        </h2>
                        <p className="text-sm font-bold opacity-90 text-center mt-2 uppercase tracking-widest">
                            GPS Desactivado
                        </p>
                    </div>
                </div>

                <div className="p-8 space-y-6">
                    <div className="bg-red-50 border-2 border-red-200 rounded-2xl p-6">
                        <div className="flex items-start gap-4">
                            <div className="w-12 h-12 bg-red-100 rounded-xl flex items-center justify-center flex-shrink-0">
                                <i className="fa-solid fa-triangle-exclamation text-red-600 text-xl"></i>
                            </div>
                            <div>
                                <h3 className="font-black text-slate-800 uppercase text-sm mb-2">
                                    Acceso Bloqueado
                                </h3>
                                <p className="text-xs text-slate-600 leading-relaxed">
                                    Tu administrador ha configurado tu cuenta para requerir ubicación GPS activa.
                                    Debes activar la ubicación en tu dispositivo para continuar.
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-3">
                        <button
                            onClick={handleRequestLocation}
                            disabled={isChecking}
                            className="w-full bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white font-black py-5 rounded-2xl shadow-xl shadow-red-500/30 transition-all active:scale-95 uppercase tracking-widest text-sm flex items-center justify-center gap-3 disabled:opacity-50"
                        >
                            {isChecking ? (
                                <>
                                    <i className="fa-solid fa-spinner animate-spin"></i>
                                    VERIFICANDO...
                                </>
                            ) : (
                                <>
                                    <i className="fa-solid fa-location-arrow"></i>
                                    ACTIVAR UBICACIÓN
                                </>
                            )}
                        </button>

                        <button
                            onClick={checkLocationStatus}
                            className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-black py-4 rounded-2xl transition-all active:scale-95 uppercase tracking-widest text-xs flex items-center justify-center gap-2"
                        >
                            <i className="fa-solid fa-rotate"></i>
                            VERIFICAR NUEVAMENTE
                        </button>
                    </div>

                    <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
                        <p className="text-[10px] text-slate-500 uppercase tracking-wider font-bold leading-relaxed text-center">
                            <i className="fa-solid fa-info-circle mr-1"></i>
                            Si ya activaste el GPS, presiona "Verificar Nuevamente"
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default LocationEnforcer;
