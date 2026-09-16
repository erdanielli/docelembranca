import { defineConfig, devices } from "@playwright/test";

// Runs against the dev-preview entry point (dev-preview.html), which signs
// in as the allowed local-stack user itself — see src/dev-preview.tsx. That
// requires the local Supabase stack (`supabase start`) to be running, since
// the real Google OAuth provider only exists on the hosted project.
export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: "html",
  use: {
    // vite.config.ts sets `base: "/docelembranca/"` for GitHub Pages, and the
    // dev server serves under that same prefix — routes must include it.
    baseURL: "http://127.0.0.1:5183/docelembranca/",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    // A dedicated port + --strictPort, rather than `npm run dev`'s default
    // 5173: that port is often already taken by an IDE-managed Vite instance
    // in this devcontainer, which makes Vite silently fall back to another
    // port and breaks Playwright's fixed-URL readiness check.
    command: "npx vite --port 5183 --strictPort --host 127.0.0.1",
    url: "http://127.0.0.1:5183/docelembranca/",
    reuseExistingServer: !process.env.CI,
  },
});
