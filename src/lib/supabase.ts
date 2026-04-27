import { createClient } from "@supabase/supabase-js";

const getEnv = (key: string) => (import.meta.env?.[key] as string) || "";

const supabaseUrl = getEnv("VITE_SUPABASE_URL");
const supabaseAnonKey = getEnv("VITE_SUPABASE_ANON_KEY");

export const supabase =
  typeof window !== "undefined" && supabaseUrl && supabaseAnonKey
    ? createClient(supabaseUrl, supabaseAnonKey)
    : null;

export function hasSupabaseConfig(): boolean {
  return !!supabase;
}