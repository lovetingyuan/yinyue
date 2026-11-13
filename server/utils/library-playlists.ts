import { and, eq, getTableColumns } from "drizzle-orm";
import { playlists } from "../database/library-schema";
import { libraryDatabase } from "./library";

const { ownerId: _ownerId, ...fields } = getTableColumns(playlists);
export { fields as playlistFields };

export function playlistOwner(userId: string, id: string) {
  return and(eq(playlists.ownerId, userId), eq(playlists.id, id));
}

export async function ownedPlaylist(db: ReturnType<typeof libraryDatabase>, owner: string, id: string) {
  const playlist = await db.select(playlistFields).from(playlists).where(playlistOwner(owner, id)).get();
  if (!playlist) throw createError({ statusCode: 404, statusMessage: "PLAYLIST_NOT_FOUND" });
  return playlist;
}
