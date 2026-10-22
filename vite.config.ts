import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import type { Plugin } from "vite";

const sharedHeatIndexPath = fileURLToPath(
  new URL("./functions/shared/heat-index.cjs", import.meta.url)
);

function sharedHeatIndexDevInterop(): Plugin {
  return {
    name: "thermosafe-shared-heat-index-dev-interop",
    apply: "serve",
    enforce: "pre",
    transform(code, id) {
      if (id.split("?")[0] !== sharedHeatIndexPath) return null;

      // Keep the CommonJS source canonical for Firebase/Node, while exposing
      // its named function to Vite's browser module graph during dev only.
      return code.replace(
        "module.exports = { calcHeatIndexCelsius };",
        "export { calcHeatIndexCelsius };"
      );
    },
  };
}

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
    sharedHeatIndexDevInterop(),
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
