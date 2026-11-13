import { drizzle } from "drizzle-orm/d1";
import type { H3Event } from "h3";
import { getD1Database } from "./auth-database";

export function libraryDatabase(event: H3Event) {
  return drizzle(getD1Database(event));
}

export function libraryQuota(event: H3Event) {
  const limit = Number(useRuntimeConfig(event).libraryQuotaBytes);
  if (!Number.isSafeInteger(limit) || limit < 1) {
    throw createError({ statusCode: 503, statusMessage: "Invalid library quota configuration" });
  }
  return limit;
}
