import { songs } from "../../database/library-schema";
import { libraryDatabase } from "../../utils/library";
import { cleanupUserFiles } from "../../utils/library-files";
import { songOwner } from "../../utils/library-songs";

export default defineEventHandler(async (event) => {
  const { user } = await requireUserSession(event, { user: { emailVerified: true } });
  const id = getRouterParam(event, "id") ?? "";
  const removed = await libraryDatabase(event).delete(songs).where(songOwner(user.id, id)).returning({ id: songs.id }).get();
  if (!removed) throw createError({ statusCode: 404, statusMessage: "SONG_NOT_FOUND" });
  await cleanupUserFiles(event, user.id);
  return sendNoContent(event);
});
