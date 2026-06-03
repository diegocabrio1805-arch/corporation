import { Geolocation } from '@capacitor/geolocation';

export interface GPSCoords {
  lat: number;
  lng: number;
}

export const getFastLocation = async (
  activeLocation?: { lat: number; lng: number; timestamp?: number } | null
): Promise<GPSCoords> => {
  // 1. Check if activeLocation prop is passed and fresh (under 60 seconds old)
  if (activeLocation && activeLocation.lat && activeLocation.lng) {
    const ts = activeLocation.timestamp || Date.now();
    if (Date.now() - ts < 60000) {
      console.log("[GPS] Using fresh activeLocation prop:", activeLocation);
      return { lat: activeLocation.lat, lng: activeLocation.lng };
    }
  }

  // 2. Check localStorage for cached position
  try {
    const cachedStr = localStorage.getItem('last_known_gps');
    if (cachedStr) {
      const cached = JSON.parse(cachedStr);
      if (cached && cached.lat && cached.lng) {
        const ts = cached.ts || cached.timestamp || 0;
        // If it's very fresh (under 60 seconds), return immediately
        if (Date.now() - ts < 60000) {
          console.log("[GPS] Using fresh cached localStorage location:", cached);
          return { lat: cached.lat, lng: cached.lng };
        }
      }
    }
  } catch (e) {
    console.warn("[GPS] Error reading cached location:", e);
  }

  // 3. Attempt a very fast native lookup (1.5 seconds max)
  try {
    const position = await Geolocation.getCurrentPosition({
      enableHighAccuracy: true,
      timeout: 1500,
      maximumAge: 60000
    });
    if (position && position.coords) {
      const coords = { lat: position.coords.latitude, lng: position.coords.longitude };
      // Save it to cache
      localStorage.setItem('last_known_gps', JSON.stringify({ ...coords, ts: Date.now() }));
      console.log("[GPS] Acquired fresh position:", coords);
      return coords;
    }
  } catch (err) {
    console.warn("[GPS] Fast high accuracy geolocation failed, trying low accuracy:", err);
    try {
      const fallbackPos = await Geolocation.getCurrentPosition({
        enableHighAccuracy: false,
        timeout: 1000,
        maximumAge: 120000
      });
      if (fallbackPos && fallbackPos.coords) {
        const coords = { lat: fallbackPos.coords.latitude, lng: fallbackPos.coords.longitude };
        localStorage.setItem('last_known_gps', JSON.stringify({ ...coords, ts: Date.now() }));
        console.log("[GPS] Acquired fallback position:", coords);
        return coords;
      }
    } catch (fallbackErr) {
      console.warn("[GPS] Fallback geolocation failed:", fallbackErr);
    }
  }

  // 4. Return cached location as ultimate fallback (even if stale)
  try {
    const cachedStr = localStorage.getItem('last_known_gps');
    if (cachedStr) {
      const cached = JSON.parse(cachedStr);
      if (cached && cached.lat && cached.lng) {
        console.log("[GPS] Using stale cached location as ultimate fallback:", cached);
        return { lat: cached.lat, lng: cached.lng };
      }
    }
  } catch (e) {}

  // 5. Absolute fallback
  console.warn("[GPS] No GPS coordinates available, returning 0, 0");
  return { lat: 0, lng: 0 };
};
