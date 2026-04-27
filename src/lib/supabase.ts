const getEnv = (key: string) => (import.meta.env?.[key] as string) || "";

const supabaseUrl = getEnv("VITE_SUPABASE_URL");
const supabaseAnonKey = getEnv("VITE_SUPABASE_ANON_KEY");

let supabaseInstance: any = null;

export async function getSupabase() {
  if (supabaseInstance) return supabaseInstance;
  
  // On server or if config is missing, return null
  if (typeof window === "undefined" || !supabaseUrl || !supabaseAnonKey) {
    return null;
  }

  try {
    const { createClient } = await import("@supabase/supabase-js");
    supabaseInstance = createClient(supabaseUrl, supabaseAnonKey);
    return supabaseInstance;
  } catch (error) {
    console.error("Failed to initialize Supabase:", error);
    return null;
  }
}

export function hasSupabaseConfig(): boolean {
  return !!supabaseUrl && !!supabaseAnonKey;
}