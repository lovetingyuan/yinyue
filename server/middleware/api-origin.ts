import {
  appendResponseHeader,
  createError,
  defineEventHandler,
  getRequestHeader,
  sendNoContent,
  setResponseHeaders,
} from "h3";
import { hasAccountMail } from "../utils/account-mail";
import { androidDevOrigin } from "~~/shared/android-dev.mjs";

const mailPaths = new Set([
  "/api/auth/sign-up/email",
  "/api/auth/send-verification-email",
  "/api/auth/request-password-reset",
]);

export default defineEventHandler((event) => {
  if (!event.path.startsWith("/api/")) return;
  const config = useRuntimeConfig(event);
  const origin = getRequestHeader(event, "origin");
  const siteOrigin = config.public.siteUrl ? new URL(config.public.siteUrl).origin : "";
  if (origin && origin !== siteOrigin) {
    const devOrigin = import.meta.dev && (origin === "http://127.0.0.1:5173" || origin === androidDevOrigin);
    if (origin !== config.public.androidOrigin && !devOrigin) {
      throw createError({ statusCode: 403, statusMessage: "Origin is not allowed" });
    }
    appendResponseHeader(event, "vary", "Origin");
    setResponseHeaders(event, {
      "access-control-allow-origin": origin,
      "access-control-allow-methods": "GET, HEAD, POST, PUT, PATCH, DELETE, OPTIONS",
      "access-control-allow-headers": "Authorization, Content-Type, Range",
      "access-control-expose-headers": "Set-Auth-Token, Content-Range, Accept-Ranges",
    });
    if (event.method === "OPTIONS") return sendNoContent(event);
  }
  const pathname = event.path.split("?")[0]?.replace(/\/+$/, "") ?? "";
  if (event.method === "POST" && mailPaths.has(pathname) && !hasAccountMail(config)) {
    throw createError({ statusCode: 503, statusMessage: "Account email is not configured" });
  }
});
