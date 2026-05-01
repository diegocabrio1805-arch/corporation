import { useEffect, useRef } from 'react';
import { supabase } from '../utils/supabaseClient';
import { User, Role } from '../types';

export const useLiveTracker = (user: User | null, activeLocation: any | null) => {
    const channelRef = useRef<any>(null);
    const locationRef = useRef<any>(null);
    const isSubscribedRef = useRef(false);

    // Mantenemos la última ubicación siempre fresca en una referencia
    useEffect(() => {
        locationRef.current = activeLocation;
    }, [activeLocation]);

    useEffect(() => {
        if (!user || user.role !== Role.COLLECTOR) {
            return;
        }

        const channel = supabase.channel('room-gps');
        
        channel.subscribe((status) => {
            if (status === 'SUBSCRIBED') {
                console.log(`[LiveTracker] 🛰️ Canal GPS conectado para: ${user.name}`);
                isSubscribedRef.current = true;
            } else {
                isSubscribedRef.current = false;
            }
        });

        channelRef.current = channel;

        // LATIDO CONSTANTE: Enviamos la última ubicación conocida cada 5 segundos
        // Independientemente de si el teléfono se movió o no (Heartbeat robusto)
        const heartbeatInterval = setInterval(() => {
            if (isSubscribedRef.current && channelRef.current && locationRef.current) {
                const loc = locationRef.current;
                const payload = {
                    collectorId: user.id,
                    collectorName: user.name,
                    lat: loc.lat,
                    lng: loc.lng,
                    timestamp: loc.timestamp
                };

                channelRef.current.send({
                    type: 'broadcast',
                    event: 'location_update',
                    payload: payload
                }).catch((e: any) => console.error('[LiveTracker] Error enviando broadcast:', e));
            }
        }, 5000);

        return () => {
            clearInterval(heartbeatInterval);
            if (channelRef.current) {
                supabase.removeChannel(channelRef.current);
            }
        };
    }, [user]);
};
