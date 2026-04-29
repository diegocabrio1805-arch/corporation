import { useState, useEffect } from 'react';
import { Geolocation } from '@capacitor/geolocation';
import { supabase } from '../utils/supabaseClient';
import { Preferences } from '@capacitor/preferences';

export interface GPSLocation {
  lat: number;
  lng: number;
  timestamp: number;
}

export const useGPSWarmer = () => {
  const [activeLocation, setActiveLocation] = useState<GPSLocation | null>(null);

  useEffect(() => {
    let watchId: string | Promise<string>;
    
    const startWatching = async () => {
      try {
        watchId = Geolocation.watchPosition({
          enableHighAccuracy: true,
          timeout: 15000,
          maximumAge: 3000
        }, (position) => {
          if (position) {
            const loc = {
              lat: position.coords.latitude,
              lng: position.coords.longitude,
              timestamp: Date.now()
            };
            setActiveLocation(loc);
            localStorage.setItem('last_known_gps', JSON.stringify({ ...loc, ts: loc.timestamp }));
          }
        });
      } catch (e) {
        console.error("Error starting Global GPS watch:", e);
      }
    };

    startWatching();

    return () => {
      if (watchId) {
        if (typeof watchId === 'string') {
          Geolocation.clearWatch({ id: watchId });
        } else {
          watchId.then(id => Geolocation.clearWatch({ id }));
        }
      }
    };
  }, []);

  // NUEVO: Motor de envío periódico a Supabase para 'COBRADORGPS'
  useEffect(() => {
    let intervalId: any;

    const pushGpsData = async () => {
      try {
        // 1. Obtener ubicación actual
        const lastGpsStr = localStorage.getItem('last_known_gps');
        if (!lastGpsStr) return;
        const loc = JSON.parse(lastGpsStr);

        // 2. Obtener usuario actual desde Preferences (Capacitor)
        const { value } = await Preferences.get({ key: 'NATIVE_CURRENT_USER' });
        let currentUser: any = null;
        if (value) {
          currentUser = JSON.parse(value);
        } else {
          // Fallback a localStorage
          const prestamaster = localStorage.getItem('prestamaster_v2');
          if (prestamaster) {
            const parsed = JSON.parse(prestamaster);
            currentUser = parsed.currentUser;
          }
        }

        // 3. Filtrar: Solo enviar si es el cobrador de prueba
        if (currentUser && (currentUser.username?.toUpperCase() === 'COBRADORGPS' || currentUser.name?.toUpperCase() === 'COBRADORGPS')) {
          console.log("[GPS Engine] Subiendo posición para COBRADORGPS...");
          const { error } = await supabase
            .from('gps_history')
            .insert({
              collector_id: currentUser.id,
              collector_name: currentUser.name,
              latitude: loc.lat,
              longitude: loc.lng,
              timestamp: new Date().toISOString()
            });
            
          if (error && !error.message.includes("schema cache")) {
            console.error("[GPS Engine] Error subiendo GPS:", error.message);
          }
        }
      } catch (e) {
        // Fallback silencioso
      }
    };

    // Ejecutar cada 40 segundos para cuidar batería
    intervalId = setInterval(pushGpsData, 40000);
    // Ejecutar también una vez al inicio
    pushGpsData();

    return () => clearInterval(intervalId);
  }, []);

  return activeLocation;
};
