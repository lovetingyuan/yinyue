import { Capacitor } from "@capacitor/core";
import type { NitroFetchOptions, NitroFetchRequest } from "nitropack";

const sessionKey = "music-session";

export function useMusicApi() {
  const config = useRuntimeConfig().public;
  const native = Capacitor.isNativePlatform();

  async function request<T>(path: string, options?: NitroFetchOptions<NitroFetchRequest>) {
    const headers = new Headers(options?.headers);
    let baseURL = "";
    if (native) {
      if (!import.meta.dev || config.mobileApiOrigin) {
        try {
          const api = new URL(config.mobileApiOrigin);
          const local = config.mobileLocalTest && api.origin === "http://127.0.0.1:8794";
          if (api.href !== `${api.origin}/` || (!local && api.protocol !== "https:")) throw new Error();
          baseURL = api.origin;
        } catch {
          throw new Error("请配置 Android API 地址。");
        }
      }
      const { SecureStorage } = await import("@aparajita/capacitor-secure-storage");
      const token = await SecureStorage.getItem(sessionKey);
      if (token) headers.set("authorization", `Bearer ${token}`);
    }
    return $fetch.raw<T>(path, { ...options, headers, baseURL, credentials: native ? "omit" : "same-origin" });
  }

  async function signIn(body: { email: string; password: string } | { provider: "google"; idToken: { token: string } }) {
    const endpoint = "provider" in body ? "social" : "email";
    const response = await request(`/api/auth/sign-in/${endpoint}`, { method: "POST", body });
    if (native) {
      const token = response.headers.get("set-auth-token");
      if (!token) throw new Error("登录响应缺少会话凭据。");
      const { SecureStorage } = await import("@aparajita/capacitor-secure-storage");
      await SecureStorage.setItem(sessionKey, token);
    }
  }

  async function signOut() {
    await request("/api/auth/sign-out", { method: "POST", body: {} });
    if (native) {
      const { SecureStorage } = await import("@aparajita/capacitor-secure-storage");
      await SecureStorage.removeItem(sessionKey);
    }
  }

  return { native, request, signIn, signOut };
}
