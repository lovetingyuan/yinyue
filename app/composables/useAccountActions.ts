import { useMutation, useMutationCache } from "@pinia/colada";
import type { AccountAction } from "~/types/account";

export function useAccountActions() {
  const { native, request, signIn, signOut } = useMusicApi();
  const auth = useAuthClient();
  const { googleClientId } = useRuntimeConfig().public;
  const cache = useMutationCache();
  // Keep credentials out of mutation variables and discard the response and error entry on settlement.
  let action: AccountAction | undefined;
  const mutation = useMutation({
    async mutation() {
      const input = action;
      action = undefined;
      if (!input) return;
      switch (input.type) {
        case "login":
          return signIn({ email: input.email, password: input.password });
        case "logout":
          return signOut();
        case "register":
          await request("/api/auth/sign-up/email", {
            method: "POST",
            body: {
              name: input.name,
              email: input.email,
              password: input.password,
              callbackURL: "/",
            },
          });
          break;
        case "forgot":
          await request("/api/auth/request-password-reset", {
            method: "POST",
            body: { email: input.email, redirectTo: "/" },
          });
          break;
        case "reset":
          await request("/api/auth/reset-password", {
            method: "POST",
            body: { token: input.token, newPassword: input.password },
          });
          break;
        case "resend":
          await request("/api/auth/send-verification-email", {
            method: "POST",
            body: { email: input.email, callbackURL: "/" },
          });
          break;
        case "google":
          if (native) {
            const { SocialLogin } = await import("@capgo/capacitor-social-login");
            await SocialLogin.initialize({ google: { webClientId: googleClientId } });
            const { result } = await SocialLogin.login({ provider: "google", options: {} });
            if (!("idToken" in result) || !result.idToken)
              throw new Error("Google ID token is missing");
            await signIn({ provider: "google", idToken: { token: result.idToken } });
          } else {
            const result = await auth?.signIn.social({ provider: "google", callbackURL: "/" });
            if (result?.error) throw new Error(result.error.message);
          }
          break;
      }
    },
    onSettled: (_, __, ___, { entry }) => {
      cache.remove(entry);
    },
  });

  async function execute(input: AccountAction) {
    if (mutation.isLoading.value) return;
    action = input;
    try {
      await mutation.mutateAsync();
    } finally {
      action = undefined;
      mutation.reset();
    }
  }

  return execute;
}
