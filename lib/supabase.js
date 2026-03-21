import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
        storage: {
            getItem: (key) => {
                try {
                    if (typeof window === 'undefined') return null;
                    return window.localStorage.getItem(key);
                } catch {
                    return null;
                }
            },
            setItem: (key, value) => {
                try {
                    if (typeof window === 'undefined') return;
                    window.localStorage.setItem(key, value);
                } catch {
                    // Ignore storage errors
                }
            },
            removeItem: (key) => {
                try {
                    if (typeof window === 'undefined') return;
                    window.localStorage.removeItem(key);
                } catch {
                    // Ignore storage errors
                }
            }
        }
    }
});
