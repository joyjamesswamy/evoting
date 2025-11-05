import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// ✅ This fixes GitHub Pages blank screen
export default defineConfig({
  plugins: [react()],
  base: "/evoting-opinion-platform/", // your repo name
});
