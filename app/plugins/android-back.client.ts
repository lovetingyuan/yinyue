import { Capacitor } from "@capacitor/core";

export default defineNuxtPlugin({
  dependsOn: ["pinia"],
  async setup() {
    if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== "android") return;
    const router = useRouter();
    const app = useAppStore(usePinia());
    const { App } = await import("@capacitor/app");
    const listener = await App.addListener("backButton", ({ canGoBack }) => {
      if (closeTopMusicDialog()) return;
      if (app.drawerOpen) {
        app.drawerOpen = false;
        return;
      }
      if (canGoBack) router.back();
      else if (router.currentRoute.value.path !== "/") void router.replace("/");
      else void App.minimizeApp();
    });
    if (import.meta.hot) import.meta.hot.dispose(() => { void listener.remove(); });
  },
});
