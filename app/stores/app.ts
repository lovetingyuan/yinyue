import { Capacitor } from "@capacitor/core";
import { defineStore } from "pinia";

export const useAppStore = defineStore("app", () => {
  const drawerOpen = ref(false);
  const offline = ref(false);
  const native = computed(() => Capacitor.isNativePlatform());

  return { drawerOpen, offline, native };
});
