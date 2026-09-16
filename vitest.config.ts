import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

// Globals stay off: tests import `describe`/`it`/`expect` from "vitest"
// explicitly, which keeps both TypeScript and ESLint honest without ambient
// declarations or an extra lint plugin.
export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: ["tests/setup.ts"],
    include: ["tests/**/*.test.{ts,tsx}"],
  },
});
