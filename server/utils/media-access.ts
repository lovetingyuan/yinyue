import { and, eq, gt } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import { session, user } from "../database/auth-schema";

const encoder = new TextEncoder();

async function mediaKey(secret: string) {
  if (secret.length < 32) throw createError({ statusCode: 503, statusMessage: "Media signing is not configured" });
  return crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
}

function payload(id: string, sessionId: string, expires: number) {
  return encoder.encode(JSON.stringify([id, sessionId, expires]));
}

export async function signMedia(secret: string, id: string, sessionId: string, expires: number) {
  const signature = await crypto.subtle.sign("HMAC", await mediaKey(secret), payload(id, sessionId, expires));
  return new Uint8Array(signature).toHex();
}

export async function verifyMedia(secret: string, id: string, sessionId: string, expires: number, signature: string) {
  if (!/^[\da-f]{64}$/.test(signature) || !Number.isSafeInteger(expires) || expires <= Date.now()) return false;
  return crypto.subtle.verify("HMAC", await mediaKey(secret), Uint8Array.fromHex(signature), payload(id, sessionId, expires));
}

export async function getMediaSession(db: ReturnType<typeof drizzle>, sessionId: string) {
  return db.select({ userId: user.id }).from(session).innerJoin(user, eq(user.id, session.userId))
    .where(and(eq(session.id, sessionId), gt(session.expiresAt, new Date()), eq(user.emailVerified, true))).get();
}
