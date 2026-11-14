import { memberships } from "../../database/library-schema";
import { and, eq } from "drizzle-orm";
import { libraryDatabase } from "../../utils/library";
import { ownedSong } from "../../utils/library-songs";

export default defineEventHandler(async (event) => {
  const { user } = await requireUserSession(event, { user: { emailVerified: true } });
  const db = libraryDatabase(event);
  const id = getRouterParam(event, "id") ?? "";
  const song = await ownedSong(db, user.id, id);
  const rows = await db
    .select({ id: memberships.playlistId })
    .from(memberships)
    .where(and(eq(memberships.ownerId, user.id), eq(memberships.songId, id)))
    .all();
  return { ...song, playlistIds: rows.map((row) => row.id) };
});
