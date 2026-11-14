import { and, eq, getTableColumns } from "drizzle-orm";
import { songs } from "../database/library-schema";
import { libraryDatabase } from "./library";
import { formText, uploadForm } from "./library-upload";

const { ownerId: _ownerId, audioId: _audioId, ...fields } = getTableColumns(songs);
export { fields as songFields };

export function songMetadata(form: Awaited<ReturnType<typeof uploadForm>>) {
  const year = formText(form, "year", 4);
  if (year && !/^[1-9]\d{3}$/.test(year))
    throw createError({ statusCode: 400, statusMessage: "INVALID_METADATA" });
  return {
    title: formText(form, "title", 250, true) ?? "",
    artist: formText(form, "artist", 250, true) ?? "",
    album: formText(form, "album", 250),
    lyricist: formText(form, "lyricist", 250),
    composer: formText(form, "composer", 250),
    description: formText(form, "description", 4000),
    year: year ? Number(year) : null,
  };
}

export function songOwner(userId: string, id: string) {
  return and(eq(songs.ownerId, userId), eq(songs.id, id));
}

export async function ownedSong(db: ReturnType<typeof libraryDatabase>, owner: string, id: string) {
  const song = await db.select(songFields).from(songs).where(songOwner(owner, id)).get();
  if (!song) throw createError({ statusCode: 404, statusMessage: "SONG_NOT_FOUND" });
  return song;
}
