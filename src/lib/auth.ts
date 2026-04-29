import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { getSupabase } from "./supabase";

export function useAuthSession() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    getSupabase().then((client) => {
      if (!active) return;
      if (!client) {
        setLoading(false);
        return;
      }

      client.auth.getSession().then(({ data }: any) => {
        if (!active) return;
        setSession(data.session ?? null);
        setLoading(false);
      });

      const { data: authListener } = client.auth.onAuthStateChange(
        (_event: any, nextSession: any) => {
          if (!active) return;
          setSession(nextSession ?? null);
          setLoading(false);
        },
      );

      return () => {
        active = false;
        authListener.subscription.unsubscribe();
      };
    });
  }, []);

  return { session, loading, isAuthenticated: !!session };
}
