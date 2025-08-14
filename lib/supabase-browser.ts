// lib/supabase-browser.ts
import { createClient, type SupabaseClient, type SupportedStorage } from "@supabase/supabase-js";
import type { Database } from "@/database.types";

let client: SupabaseClient<Database> | undefined;

// Безопасный storage (не падает в приватных вкладках/iframe и при SSR)
const safeStorage: SupportedStorage | undefined =
  typeof window === "undefined"
    ? undefined
    : {
        getItem(key: string) {
          try { return window.localStorage.getItem(key); } catch { return null; }
        },
        setItem(key: string, value: string) {
          try { window.localStorage.setItem(key, value); } catch {}
        },
        removeItem(key: string) {
          try { window.localStorage.removeItem(key); } catch {}
        },
      };

export function getSupabaseBrowser(): SupabaseClient<Database> {
  if (client) return client;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  client = createClient<Database>(url, anon, {
    auth: {
      storage: safeStorage,          // важно: файл импортируй только в client-компонентах
      persistSession: true,          // если проблемы с iframe — поставь false
      autoRefreshToken: true,
      detectSessionInUrl: true,
      flowType: "pkce",
    },
  });

  return client;
}
