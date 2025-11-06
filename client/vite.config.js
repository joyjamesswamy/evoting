import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// ✅ Correct setup for Render deployment (fixes blank page)
export default defineConfig({
  plugins: [react()],
  base: "/", // Render serves from root, NOT subpath
});
