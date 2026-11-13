import { defineServerAuth } from "@nuxtjs/better-auth/config";
import { bearer } from "better-auth/plugins";
import { sendAccountMail } from "./utils/account-mail";
import { androidDevOrigin } from "~~/shared/android-dev.mjs";

export default defineServerAuth(() => {
  const config = useRuntimeConfig();
  const clientId = config.public.googleClientId;
  const clientSecret = config.googleClientSecret;

  return {
    trustedOrigins: import.meta.dev ? [config.public.androidOrigin, androidDevOrigin] : [config.public.androidOrigin],
    plugins: [bearer({ requireSignature: true })],
    advanced: { ipAddress: { ipAddressHeaders: ["cf-connecting-ip"] } },
    account: { encryptOAuthTokens: true },
    rateLimit: { enabled: true, storage: "database" },
    socialProviders: clientId && clientSecret ? { google: { clientId, clientSecret } } : {},
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: true,
      revokeSessionsOnPasswordReset: true,
      sendResetPassword: ({ user, url }) => sendAccountMail(user.email, "重置密码", url),
    },
    emailVerification: {
      sendOnSignUp: true,
      sendVerificationEmail: ({ user, url }) => sendAccountMail(user.email, "验证邮箱", url),
    },
  };
});
