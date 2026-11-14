import { and, eq } from "drizzle-orm";
import { memberships } from "../../../../database/library-schema";
import { libraryDatabase } from "../../../../utils/library";
import { ownedPlaylist } from "../../../../utils/library-playlists";

export default defineEventHandler(async (event) => {
  const { user } = await requireUserSession(event, { user: { emailVerified: true } });
  const db = libraryDatabase(event);
  const playlistId = getRouterParam(event, "id") ?? "";
  const songId = getRouterParam(event, "songId") ?? "";
  await ownedPlaylist(db, user.id, playlistId);
  await db
    .delete(memberships)
    .where(
      and(
        eq(memberships.ownerId, user.id),
        eq(memberships.playlistId, playlistId),
        eq(memberships.songId, songId),
      ),
    )
    .run();
  return sendNoContent(event);
});
