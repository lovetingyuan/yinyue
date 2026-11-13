import { memberships } from "../../../../database/library-schema";
import { libraryDatabase } from "../../../../utils/library";
import { ownedPlaylist } from "../../../../utils/library-playlists";
import { ownedSong } from "../../../../utils/library-songs";

export default defineEventHandler(async (event) => {
  const { user } = await requireUserSession(event, { user: { emailVerified: true } });
  const db = libraryDatabase(event);
  const playlistId = getRouterParam(event, "id") ?? "";
  const songId = getRouterParam(event, "songId") ?? "";
  await Promise.all([ownedPlaylist(db, user.id, playlistId), ownedSong(db, user.id, songId)]);
  await db.insert(memberships).values({ ownerId: user.id, playlistId, songId }).onConflictDoNothing().run()
    .catch((error: unknown) => {
      if (error instanceof Error && /FOREIGN KEY constraint failed/.test(String(error.cause))) {
        throw createError({ statusCode: 404, statusMessage: "RESOURCE_NOT_FOUND" });
      }
      throw error;
    });
  return sendNoContent(event);
});
