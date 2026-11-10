import { createClient } from '@supabase/supabase-js';

const env = import.meta.env || {};
const url = env.VITE_SUPABASE_URL || '';
const anonKey = env.VITE_SUPABASE_ANON_KEY || '';

/**
 * Supabase is optional at build time so the existing static demo deployment keeps
 * working. When credentials are present, every platform query goes through
 * Supabase Auth/PostgREST with RLS enabled.
 */
export const supabaseConfig = {
  url,
  anonKey,
  configured: Boolean(url && anonKey),
  googleEnabled: env.VITE_AUTH_GOOGLE_ENABLED !== 'false',
  microsoftEnabled: env.VITE_AUTH_MICROSOFT_ENABLED !== 'false',
  siteUrl: env.VITE_SITE_URL || (typeof window !== 'undefined' ? window.location.origin : ''),
};

export const supabase = supabaseConfig.configured
  ? createClient(url, anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        flowType: 'pkce',
        storageKey: 'indra.platform.auth',
      },
      global: {
        headers: { 'x-indra-platform': '1' },
      },
    })
  : null;

export const isSupabaseConfigured = supabaseConfig.configured;
