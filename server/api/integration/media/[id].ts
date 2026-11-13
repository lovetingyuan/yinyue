import { integrationMedia } from "../../../utils/integration-media";
import { getMediaSession, verifyMedia } from "../../../utils/media-access";
import { serveMedia } from "../../../utils/serve-media";

export default defineEventHandler(async (event) => {
  const { secret, db, bucket } = integrationMedia(event);
  if (!["GET", "HEAD"].includes(event.method)) throw createError({ statusCode: 405 });
  const id = getRouterParam(event, "id");
  const { sid, expires, sig } = getQuery(event);
  if (!id || !/^[1-3]$/.test(id) || typeof sid !== "string" || typeof expires !== "string"
    || typeof sig !== "string" || !(await verifyMedia(secret, id, sid, Number(expires), sig))
    || !(await getMediaSession(db, sid))) {
    return sendNoContent(event, 403);
  }

  return serveMedia(event, bucket, `integration/${id}.mp3`, "audio/mpeg");
});
