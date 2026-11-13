import type { H3Event } from "h3";
import type { MediaBucket } from "../types/integration-media";

function isMediaBucket(bucket: unknown): bucket is MediaBucket {
  return typeof bucket === "object" && bucket !== null
    && "head" in bucket && typeof bucket.head === "function"
    && "get" in bucket && typeof bucket.get === "function"
    && "put" in bucket && typeof bucket.put === "function"
    && "delete" in bucket && typeof bucket.delete === "function";
}

export function mediaBucket(event: H3Event) {
  return requireMediaBucket(event.context.cloudflare?.env.MEDIA);
}

export function requireMediaBucket(bucket: unknown) {
  if (!isMediaBucket(bucket)) throw createError({ statusCode: 503, statusMessage: "R2 binding MEDIA is unavailable" });
  return bucket;
}
