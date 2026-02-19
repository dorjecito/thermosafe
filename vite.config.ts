import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  base: "/",

  plugins: [
    react(),

    VitePWA({
      registerType: "autoUpdate",

      // IMPORTANT: el teu index.html enllaça /manifest.webmanifest
      manifestFilename: "manifest.webmanifest",

      // Només inclou assets que EXISTEIXIN dins /public
      // - favicon.ico -> /public/favicon.ico ✅
      // - robots.txt  -> /public/robots.txt ✅
      // - apple-touch-icon.png -> /public/apple-touch-icon.png (si NO existeix, elimina'l o crea'l)
      includeAssets: ["favicon.ico", "robots.txt", "apple-touch-icon.png"],

      manifest: {
        name: "ThermoSafe – Risc climàtic",
        short_name: "ThermoSafe",
        description:
          "Consulta el risc per calor, fred i vent segons la teva ubicació amb dades oficials i notificacions automàtiques.",
        start_url: "/",
        scope: "/",
        display: "standalone",
        orientation: "portrait",
        background_color: "#ffffff",
        theme_color: "#f59e0b",
        lang: "ca",

        icons: [
          {
            src: "/icons/icon-192.png",
            sizes: "192x192",
            type: "image/png",
          },
          {
            src: "/icons/icon-512.png",
            sizes: "512x512",
            type: "image/png",
          },
          {
            src: "/icons/icon-maskable-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable any",
          },
        ],
      },

      // Ajuda a no tornar-te boig en local
      devOptions: {
        enabled: true,
      },
    }),
  ],
});