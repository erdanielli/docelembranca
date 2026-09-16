import { createClient } from "@supabase/supabase-js";

// The local Supabase CLI's fixed local-dev URL/anon key — identical for every
// local Supabase project, not a secret (same pair README.md and
// .github/workflows/ci.yml use). This file runs as plain Node, outside Vite,
// so it can't read them via import.meta.env like src/lib/supabaseClient.ts does.
const LOCAL_SUPABASE_URL = "http://127.0.0.1:54321";
const LOCAL_SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0";

const EMAIL = "giselypasquini@gmail.com";
const PASSWORD = "local-dev-password-123";

// dev-preview.tsx (see src/dev-preview.tsx) signs in on every page load and
// falls back to signing up if that fails, so a solo manual page load always
// self-heals after a fresh local stack. Playwright runs test files in
// parallel, though, so several pages can hit that fallback at the same
// instant on a brand-new stack — e.g. CI, which always starts empty — and
// race each other's signup. Provisioning the account once here, before any
// worker starts, removes the race entirely; dev-preview.tsx's own fallback
// is then just a no-op sign-in for the rest of the run.
export default async function globalSetup(): Promise<void> {
  const client = createClient(LOCAL_SUPABASE_URL, LOCAL_SUPABASE_ANON_KEY);

  const { error: signInError } = await client.auth.signInWithPassword({
    email: EMAIL,
    password: PASSWORD,
  });
  if (!signInError) {
    return;
  }

  const { error: signUpError } = await client.auth.signUp({ email: EMAIL, password: PASSWORD });
  if (signUpError) {
    throw new Error(`Could not provision the local e2e test account: ${signUpError.message}`);
  }
}
