console.log("SUPABASE MODULE LOADED");
let supabaseInstance: any = null;

export async function getSupabase() {
  if (supabaseInstance) return supabaseInstance;
  
  if (typeof window === "undefined") return null;

  try {
    // Access env vars only inside the function
    const supabaseUrl = (import.meta.env?.VITE_SUPABASE_URL as string) || "";
    const supabaseAnonKey = (import.meta.env?.VITE_SUPABASE_ANON_KEY as string) || "";

    if (!supabaseUrl || !supabaseAnonKey) return null;

    const { createClient } = await import("@supabase/supabase-js");
    supabaseInstance = createClient(supabaseUrl, supabaseAnonKey);
    return supabaseInstance;
  } catch (error) {
    console.error("Supabase init error:", error);
    return null;
  }
}

export function hasSupabaseConfig(): boolean {
  if (typeof window === "undefined") return false;
  const url = (import.meta.env?.VITE_SUPABASE_URL as string) || "";
  const key = (import.meta.env?.VITE_SUPABASE_ANON_KEY as string) || "";
  return !!url && !!key;
}