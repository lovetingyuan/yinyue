export type AccountAction =
  | { type: "login"; email: string; password: string }
  | { type: "logout" | "google" }
  | { type: "register"; name: string; email: string; password: string }
  | { type: "forgot" | "resend"; email: string }
  | { type: "reset"; token: string; password: string };
