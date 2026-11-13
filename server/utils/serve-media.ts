import type { H3Event } from "h3";
import { mediaRange } from "./media-range";
import type { MediaBucket } from "../types/integration-media";

export async function serveMedia(event: H3Event, bucket: MediaBucket, key: string, contentType: string) {
  const object = await bucket.head(key);
  if (!object) return sendNoContent(event, 404);
  setResponseHeaders(event, { "content-type": contentType, "accept-ranges": "bytes", "x-content-type-options": "nosniff" });
  const header = getRequestHeader(event, "range");
  const range = header ? mediaRange(header, object.size) : undefined;
  if (range === null) {
    setResponseHeader(event, "content-range", `bytes */${object.size}`);
    return sendNoContent(event, 416);
  }
  setResponseHeader(event, "content-length", range?.length ?? object.size);
  if (range) {
    setResponseStatus(event, 206);
    setResponseHeader(event, "content-range", `bytes ${range.offset}-${range.offset + range.length - 1}/${object.size}`);
  }
  if (event.method === "HEAD") {
    setResponseHeader(event, "x-music-content-length", range?.length ?? object.size);
    return sendNoContent(event, range ? 206 : 200);
  }
  const body = await bucket.get(key, { range });
  if (!body) {
    removeResponseHeader(event, "content-length");
    removeResponseHeader(event, "content-type");
    return sendNoContent(event, 404);
  }
  return sendStream(event, body.body);
}
