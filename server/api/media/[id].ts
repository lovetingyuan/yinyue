import { and, eq } from "drizzle-orm";
import { files } from "../../database/library-schema";
import { libraryDatabase } from "../../utils/library";
import { getMediaSession, verifyMedia } from "../../utils/media-access";
import { mediaBucket } from "../../utils/media-bucket";
import { serveMedia } from "../../utils/serve-media";

export default defineEventHandler(async (event) => {
  if (!["GET", "HEAD"].includes(event.method)) throw createError({ statusCode: 405 });
  const id = getRouterParam(event, "id");
  const { sid, expires, sig } = getQuery(event);
  if (!id || typeof sid !== "string" || typeof expires !== "string" || typeof sig !== "string"
    || !await verifyMedia(useRuntimeConfig(event).mediaSigningSecret, id, sid, Number(expires), sig)) {
    return sendNoContent(event, 403);
  }
  const db = libraryDatabase(event);
  const session = await getMediaSession(db, sid);
  if (!session) return sendNoContent(event, 403);
  const file = await db.select({ contentType: files.contentType }).from(files).where(and(
    eq(files.id, id), eq(files.ownerId, session.userId), eq(files.state, "ready"),
  )).get();
  if (!file) return sendNoContent(event, 404);
  return serveMedia(event, mediaBucket(event), id, file.contentType);
});
