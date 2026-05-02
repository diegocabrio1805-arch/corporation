import { useState, useEffect } from 'react';
import { Geolocation } from '@capacitor/geolocation';
import { Capacitor } from '@capacitor/core';
import { User, Role } from '../types';

export interface GPSLocation {
  lat: number;
  lng: number;
  timestamp: number;
}

/**
 * useGPSWarmer: Ahora simplificado. 
 * Ya no realiza rastreo en segundo plano ni envíos periódicos.
 * Solo se usa para obtener una ubicación fresca al abrir la app si es necesario.
 */
export const useGPSWarmer = (user: User | null) => {
  const [activeLocation, setActiveLocation] = useState<GPSLocation | null>(null);

  useEffect(() => {
    if (!user || user.role !== Role.COLLECTOR) return;

    // Solo capturamos la ubicación inicial para tener algo de referencia
    const getInitialLocation = async () => {
      try {
        const perm = await Geolocation.checkPermissions();
        if (perm.location !== 'granted') return;

        const position = await Geolocation.getCurrentPosition({ 
          enableHighAccuracy: true, 
          timeout: 10000 
        });

        if (position && position.coords) {
          const loc = {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
            timestamp: Date.now()
          };
          setActiveLocation(loc);
          localStorage.setItem('last_known_gps', JSON.stringify({ ...loc, ts: loc.timestamp }));
        }
      } catch (e) {
        console.warn("[GPSWarmer] No se pudo obtener ubicación inicial:", e);
      }
    };

    getInitialLocation();
  }, [user]);

  return activeLocation;
};
