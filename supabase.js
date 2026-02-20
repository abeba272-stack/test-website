import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './supabase-config.js';

function looksConfigured(value, placeholder) {
  return Boolean(value) && value !== placeholder;
}

export const isSupabaseConfigured =
  looksConfigured(SUPABASE_URL, 'https://YOUR-PROJECT-REF.supabase.co') &&
  looksConfigured(SUPABASE_ANON_KEY, 'YOUR_SUPABASE_ANON_KEY');

export function getAuthRedirectUrl() {
  const origin = window.location.origin;
  const path = window.location.pathname;
  const base = path.endsWith('/') ? path : path.slice(0, path.lastIndexOf('/') + 1);
  return `${origin}${base}login.html`;
}

export const supabase = isSupabaseConfigured
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true
      }
    })
  : null;

