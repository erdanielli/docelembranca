import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Project site on GitHub Pages is served from /<repo-name>/, so the base
// path must match the repo name for asset URLs to resolve correctly.
export default defineConfig({
  plugins: [react()],
  base: "/docelembranca/",
});
