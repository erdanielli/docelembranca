import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { supabase } from "./lib/supabaseClient";
import "./ios.css";

// Scratch entry point, not part of the shipped app. Local Supabase has no
// Google OAuth provider configured, so this signs in as the allowed user via
// local email/password auth instead — a real session, so LoginGate and RLS
// both run unmodified. The account only exists in the local stack, and
// `supabase db reset`/a fresh `supabase start` wipes it, so a failed sign-in
// falls back to creating it (local auth allows signup with no confirmation).
const DEV_PREVIEW_EMAIL = "giselypasquini@gmail.com";
const DEV_PREVIEW_PASSWORD = "local-dev-password-123";

void supabase.auth
  .signInWithPassword({ email: DEV_PREVIEW_EMAIL, password: DEV_PREVIEW_PASSWORD })
  .then(({ error }) => {
    if (error) {
      return supabase.auth.signUp({ email: DEV_PREVIEW_EMAIL, password: DEV_PREVIEW_PASSWORD });
    }
  });

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
