'use client';

import { createClient as createSupabase, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/database.types';

let _client: SupabaseClient<Database> | null = null;

export function createClient(): SupabaseClient<Database> {
  if (_client) return _client;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

  // видно в консоли, подхватились ли env
  // eslint-disable-next-line no-console
  console.log('[supabase] createClient', { urlSet: !!url, keySet: !!anon });

  _client = createSupabase<Database>(url, anon, {
    auth: { persistSession: true, autoRefreshToken: true },
  });

  return _client;
}
