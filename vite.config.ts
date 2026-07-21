import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import { readFileSync } from "node:fs";
import type { Plugin } from "vite";

const packageJson = JSON.parse(
  readFileSync(new URL("./package.json", import.meta.url), "utf8")
) as { version?: string };

const thermosafeVersion = packageJson.version || "0.0.0";
const thermosafeBuildId =
  process.env.VERCEL_GIT_COMMIT_SHA ||
  process.env.VITE_THERMOSAFE_BUILD_ID ||
  `${thermosafeVersion}-local`;

function thermosafeVersionPlugin(): Plugin {
  const source = JSON.stringify(
    {
      version: thermosafeVersion,
      buildId: thermosafeBuildId,
    },
    null,
    2
  );

  return {
    name: "thermosafe-version",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.url?.split("?")[0] !== "/version.json") {
          next();
          return;
        }

        res.setHeader("Content-Type", "application/json; charset=utf-8");
        res.setHeader("Cache-Control", "no-store");
        res.end(source);
      });
    },
    generateBundle() {
      this.emitFile({
        type: "asset",
        fileName: "version.json",
        source,
      });
    },
  };
}

export default defineConfig({
  base: "/",
  define: {
    "import.meta.env.VITE_THERMOSAFE_BUILD_ID":
      JSON.stringify(thermosafeBuildId),
  },

  plugins: [
    thermosafeVersionPlugin(),
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
        enabled: false
      }
    })
  ]
});
