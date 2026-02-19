import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  base: "/",

  plugins: [
    react(),

    VitePWA({
      registerType: "autoUpdate",

      // ✅ IMPORTANT: el manifest el servim nosaltres des de /public/manifest.webmanifest
      manifest: false,

      includeAssets: [
        "favicon.ico",
        "robots.txt",
        "apple-touch-icon.png",
        "icons/icon-192.png",
        "icons/icon-512.png",
        "icons/icon-maskable-512.png"
      ],

      // SW sí, manifest no
      injectRegister: "auto",

      devOptions: {
        enabled: true
      }
    })
  ]
});