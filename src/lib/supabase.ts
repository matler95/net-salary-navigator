import { createClient } from "@supabase/supabase-js";

// Fallback to globalThis for Cloudflare Workers runtime variables
const getEnv = (key: string) => {
  return (
    (import.meta.env?.[key] as string) || 
    ((globalThis as any)?.[key] as string) ||
    ((globalThis as any)?.process?.env?.[key] as string)
  );
};

const supabaseUrl = getEnv("VITE_SUPABASE_URL");
const supabaseAnonKey = getEnv("VITE_SUPABASE_ANON_KEY");

export const supabase =
  supabaseUrl && supabaseAnonKey ? createClient(supabaseUrl, supabaseAnonKey) : null;

export function hasSupabaseConfig(): boolean {
  return !!supabase;
}
