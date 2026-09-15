import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "../lib/supabaseClient";

// Client-side check only — a nice UX shortcut, not real security.
// The actual enforcement must live in Supabase Row Level Security
// policies (e.g. `auth.email() = 'erdanielli@gmail.com'`), since anyone
// can read this source in the browser.
const ALLOWED_EMAIL = "erdanielli@gmail.com";

export function LoginGate({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });

    return () => subscription.subscription.unsubscribe();
  }, []);

  if (loading) {
    return <div className="screen screen--center" />;
  }

  if (!session) {
    return (
      <div className="screen screen--center">
        <div className="login-card">
          <h1 className="login-title">docelembranca</h1>
          <p className="login-subtitle">Entre com sua conta Google para continuar.</p>
          <button
            className="btn btn--primary"
            onClick={() =>
              supabase.auth.signInWithOAuth({
                provider: "google",
                options: { redirectTo: window.location.origin + window.location.pathname },
              })
            }
          >
            Continuar com Google
          </button>
        </div>
      </div>
    );
  }

  if (session.user.email !== ALLOWED_EMAIL) {
    return (
      <div className="screen screen--center">
        <div className="login-card">
          <h1 className="login-title">Acesso restrito</h1>
          <p className="login-subtitle">
            Esta conta ({session.user.email}) não tem acesso a este app.
          </p>
          <button className="btn btn--secondary" onClick={() => supabase.auth.signOut()}>
            Sair
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
