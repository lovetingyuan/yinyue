import type { CapacitorConfig } from "@capacitor/cli";
import { androidDevOrigin } from "./shared/android-dev.mjs";

const dev = process.env.INYUE_ANDROID_DEV === "1";

export default {
  "appId": "com.tingyuan.music",
  "appName": "inyue",
  "webDir": ".output-capacitor/public",
  ...(dev ? { server: { url: androidDevOrigin } } : {}),
  "loggingBehavior": "none",
  "plugins": {
    "SocialLogin": {
      "providers": {
        "google": true,
        "facebook": false,
        "apple": false,
        "twitter": false
      }
    },
    "SplashScreen": {
      "launchAutoHide": false
    }
  }
} satisfies CapacitorConfig;
