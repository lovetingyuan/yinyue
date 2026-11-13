import { Capacitor } from '@capacitor/core'
import { SplashScreen } from '@capacitor/splash-screen'

export default defineNuxtPlugin((nuxtApp) => {
  nuxtApp.hook('app:mounted', () => {
    if (Capacitor.isNativePlatform()) {
      SplashScreen.hide().catch(console.error)
    }
  })
})
