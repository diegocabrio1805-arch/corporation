import { useEffect, useRef } from 'react';
import { supabase } from '../utils/supabaseClient';
import { User, Role } from '../types';

export const useLiveTracker = (user: User | null, activeLocation: any | null) => {
    const channelRef = useRef<any>(null);

    // Conexión inicial al canal
    useEffect(() => {
        if (!user || user.role !== Role.COLLECTOR) {
            return;
        }

        const channel = supabase.channel('room-gps');
        
        channel.subscribe((status) => {
            if (status === 'SUBSCRIBED') {
                console.log(`[LiveTracker] 🛰️ Canal GPS conectado para: ${user.name}`);
            }
        });

        channelRef.current = channel;

        return () => {
            if (channelRef.current) {
                supabase.removeChannel(channelRef.current);
            }
        };
    }, [user]);

    // Emisión cada vez que cambia activeLocation
    useEffect(() => {
        if (!user || user.role !== Role.COLLECTOR || !activeLocation || !channelRef.current) {
            return;
        }

        // Throttle o debounce opcional, pero activeLocation se actualiza con watchPosition
        // Solo enviamos si el canal está listo
        if (channelRef.current.state === 'joined') {
            const payload = {
                collectorId: user.id,
                collectorName: user.name,
                lat: activeLocation.lat,
                lng: activeLocation.lng,
                timestamp: activeLocation.timestamp
            };

            channelRef.current.send({
                type: 'broadcast',
                event: 'location_update',
                payload: payload
            }).catch((e: any) => console.error('[LiveTracker] Error enviando broadcast:', e));
        }
    }, [activeLocation, user]);
};

