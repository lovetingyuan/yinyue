import { lstatSync, readlinkSync, unlinkSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import tailwindcss from "@tailwindcss/vite";
import { vueVitePlugin } from "vite-plugin-dom-source";
import { defaultQuotaBytes } from "./shared/library-limits";

const require = createRequire(import.meta.url);
const nitroRoot = dirname(require.resolve("nitropack/package.json"));

export default defineNuxtConfig({
  telemetry: false,

  compatibilityDate: "2025-07-15",
  devtools: { enabled: true },
  css: ["~/assets/css/main.css"],

  app: {
    head: {
      title: "inyue",
      viewport: "width=device-width, initial-scale=1.0, viewport-fit=cover",
      link: [{ rel: "icon", type: "image/x-icon", href: "/favicon.ico" }],
      meta: [
        {
          name: "theme-color",
          content: "#ffffff",
          media: "(prefers-color-scheme: light)",
        },
        {
          name: "theme-color",
          content: "#16171d",
          media: "(prefers-color-scheme: dark)",
        },
      ],
    },
  },

  vite: {
    plugins: [tailwindcss(), vueVitePlugin()],
  },

  nitro: {
    preset: "cloudflare_module",
    externals: {
      // The generated Better Auth module imports the local TypeScript adapter.
      inline: [(id) => id.replaceAll("\\", "/").endsWith("/better-auth/database.mjs")],
    },
    alias: {
      "#music-worker-base": resolve(nitroRoot, "dist/presets/cloudflare/runtime/cloudflare-module.mjs"),
    },
    cloudflare: {
      deployConfig: true,
      nodeCompat: true,
    },
  },

  modules: ["nitro-cloudflare-dev", "@nuxtjs/better-auth", "@vite-pwa/nuxt", "@pinia/nuxt", "@pinia/colada-nuxt"],

  pwa: {
    registerType: "autoUpdate",
    manifest: {
      id: "/",
      name: "私人音乐库",
      short_name: "音乐库",
      lang: "zh-CN",
      start_url: "/",
      display: "standalone",
      theme_color: "#16171d",
      background_color: "#16171d",
      icons: [
        { src: "/assets/imgs/logo.png", sizes: "512x512", type: "image/png" },
      ],
    },
    generateSW: {
      cleanURLs: false,
      globPatterns: ["offline.html", "assets/imgs/logo.png", "_nuxt/**/*.{js,css,woff2}"],
      navigateFallback: null,
      runtimeCaching: [{
        urlPattern: ({ request, url, sameOrigin }) => sameOrigin && request.mode === "navigate" && url.pathname === "/",
        handler: "NetworkOnly",
        options: { precacheFallback: { fallbackURL: "/offline" } },
      }],
    },
  },

  hooks: {
    "nitro:config"(config) {
      if (!config.dev && config.preset === "cloudflare_module") {
        config.entry = resolve("server/worker.ts");
      }
    },
    "better-auth:database:providers"(providers) {
      providers.d1 = {
        priority: 10,
        buildDatabaseCode: () => `
          export { createAuthDatabase as createDatabase } from ${JSON.stringify(resolve("server/utils/auth-database.ts"))}
          export const db = undefined
          export function isRequestScopedDatabase() { return true }
        `,
      };
    },
  },

  runtimeConfig: {
    resendApiKey: "",
    mailFrom: "",
    mailPreview: false,
    mediaSigningSecret: "",
    libraryQuotaBytes: defaultQuotaBytes,
    integrationPlayback: false,
    googleClientSecret: "",
    public: {
      siteUrl: "",
      mobileApiOrigin: "",
      mobileLocalTest: false,
      googleClientId: "",
      androidOrigin: "https://localhost",
      integrationPlayback: false,
    },
  },

  routeRules: {
    "/": { headers: { "cache-control": "private, no-store" } },
    "/api/**": { headers: { "cache-control": "private, no-store" } },
  },

  $env: {
    capacitor: {
      ...(process.env.NODE_ENV === "development"
        ? { buildDir: "temp/nuxt-android", vite: { cacheDir: "temp/vite-android" } }
        : {}),
      ssr: false,
      pwa: { disable: true },
      auth: { clientOnly: process.env.NODE_ENV !== "development" },
      hooks: {
        close(nuxt) {
          if (nuxt.options.dev) return;

          // Nuxt adds a legacy dist link after the static build.
          const root = nuxt.options.rootDir;
          const dist = resolve(root, "dist");
          if (
            lstatSync(dist, { throwIfNoEntry: false })?.isSymbolicLink() &&
            resolve(root, readlinkSync(dist)) === resolve(root, ".output-capacitor/public")
          ) {
            unlinkSync(dist);
          }
        },
      },
      nitro: {
        preset: "static",
        // Dev server cleanup must not remove the packaged mobile assets.
        output:
          process.env.NODE_ENV === "development"
            ? undefined
            : {
                dir: ".output-capacitor",
                publicDir: ".output-capacitor/public",
              },
        cloudflare: { deployConfig: false },
      },
    },
  },
});
