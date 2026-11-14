import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { drizzle } from "drizzle-orm/d1";
import { createError } from "h3";
import type { H3Event } from "h3";
import * as schema from "../database/auth-schema";

function isD1Database(binding: unknown): binding is Parameters<typeof drizzle>[0] {
  return (
    typeof binding === "object" &&
    binding !== null &&
    "prepare" in binding &&
    typeof binding.prepare === "function" &&
    "batch" in binding &&
    typeof binding.batch === "function"
  );
}

export function getD1Database(event?: H3Event) {
  return requireD1Database(event?.context.cloudflare?.env.DB);
}

export function requireD1Database(binding: unknown) {
  if (!isD1Database(binding)) {
    throw createError({ statusCode: 503, statusMessage: "D1 binding DB is unavailable" });
  }
  return binding;
}

export function createAuthDatabase(event?: H3Event) {
  return drizzleAdapter(drizzle(getD1Database(event)), { provider: "sqlite", schema });
}
