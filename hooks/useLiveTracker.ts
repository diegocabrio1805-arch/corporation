import { useEffect } from 'react';
import { User } from '../types';

/**
 * useLiveTracker: Desactivado.
 * Ya no envía actualizaciones de ubicación en tiempo real.
 */
export const useLiveTracker = (user: User | null, activeLocation: any | null) => {
    useEffect(() => {
        // Tracker desactivado por solicitud del usuario
    }, [user, activeLocation]);
};
