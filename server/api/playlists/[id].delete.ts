import { playlists } from "../../database/library-schema";
import { libraryDatabase } from "../../utils/library";
import { cleanupUserFiles } from "../../utils/library-files";
import { playlistOwner } from "../../utils/library-playlists";

export default defineEventHandler(async (event) => {
  const { user } = await requireUserSession(event, { user: { emailVerified: true } });
  const id = getRouterParam(event, "id") ?? "";
  const removed = await libraryDatabase(event)
    .delete(playlists)
    .where(playlistOwner(user.id, id))
    .returning({ id: playlists.id })
    .get();
  if (!removed) throw createError({ statusCode: 404, statusMessage: "PLAYLIST_NOT_FOUND" });
  await cleanupUserFiles(event, user.id);
  return sendNoContent(event);
});
