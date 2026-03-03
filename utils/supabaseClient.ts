import { createClient } from '@supabase/supabase-js';

// NUEVO PROYECTO MIGRADO - 2026-02-27
const supabaseUrl = 'https://samgpnczlznynnfhjjff.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNhbWdwbmN6bHpueW5uZmhqamZmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIxNjU1NjQsImV4cCI6MjA4Nzc0MTU2NH0.AV1Z-QlltfPp8am-_ALlgopoGB8WhOrle83TNZrjqTE';

console.log('--- SUPABASE CLIENT DEBUG ---');
console.log('URL:', supabaseUrl);
console.log('Key length:', supabaseAnonKey?.length);

if (!supabaseUrl || !supabaseAnonKey) {
    console.error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    realtime: {
        params: {
            eventsPerSecond: 10
        }
    },
    global: {
        headers: { 'x-application-name': 'anexo-cobro-mobile' },
        fetch: async (url, options) => {
            try {
                return await fetch(url, options);
            } catch (error) {
                console.warn('Network request failed (offline mode):', error);
                return new Response(null, { status: 0, statusText: 'Network Error' });
            }
        }
    }
});
