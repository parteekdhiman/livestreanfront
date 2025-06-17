import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import fs from "fs";
// https://vite.dev/config/
export default defineConfig({
  server: {
    host: true,
    https: true
  },
  plugins: [react()],
});
