import { songs } from "../../database/library-schema";
import { libraryDatabase } from "../../utils/library";
import { cleanupUserFiles, withLibraryFiles } from "../../utils/library-files";
import { ownedSong, songFields, songMetadata, songOwner } from "../../utils/library-songs";
import { coverUpload, formText, uploadForm } from "../../utils/library-upload";

export default defineEventHandler(async (event) => {
  const { user } = await requireUserSession(event, { user: { emailVerified: true } });
  const db = libraryDatabase(event);
  const id = getRouterParam(event, "id") ?? "";
  await ownedSong(db, user.id, id);
  const form = await uploadForm(event);
  if (form.has("audio")) throw createError({ statusCode: 400, statusMessage: "AUDIO_REPLACEMENT_UNSUPPORTED" });
  const metadata = songMetadata(form);
  const cover = coverUpload(form.get("cover"));
  const remove = formText(form, "removeCover", 4) === "true";
  const song = await withLibraryFiles(event, user.id, [cover], async ([coverId]) => {
    const result = await db.update(songs).set({ ...metadata, ...(cover || remove ? { coverId } : {}) })
      .where(songOwner(user.id, id)).returning(songFields).get();
    if (!result) throw createError({ statusCode: 404, statusMessage: "SONG_NOT_FOUND" });
    return result;
  });
  await cleanupUserFiles(event, user.id);
  return song;
});
