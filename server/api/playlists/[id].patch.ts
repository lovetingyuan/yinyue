import { playlists } from "../../database/library-schema";
import { libraryDatabase } from "../../utils/library";
import { cleanupUserFiles, withLibraryFiles } from "../../utils/library-files";
import { ownedPlaylist, playlistFields, playlistOwner } from "../../utils/library-playlists";
import { coverUpload, formText, uploadForm } from "../../utils/library-upload";

export default defineEventHandler(async (event) => {
  const { user } = await requireUserSession(event, { user: { emailVerified: true } });
  const db = libraryDatabase(event);
  const id = getRouterParam(event, "id") ?? "";
  await ownedPlaylist(db, user.id, id);
  const form = await uploadForm(event);
  const name = formText(form, "name", 250, true) ?? "";
  const cover = coverUpload(form.get("cover"));
  const remove = formText(form, "removeCover", 4) === "true";
  const playlist = await withLibraryFiles(event, user.id, [cover], async ([coverId]) => {
    const updated = await db.update(playlists).set({ name, ...(cover || remove ? { coverId } : {}) })
      .where(playlistOwner(user.id, id)).returning(playlistFields).get();
    if (!updated) throw createError({ statusCode: 404, statusMessage: "PLAYLIST_NOT_FOUND" });
    return updated;
  });
  await cleanupUserFiles(event, user.id);
  return playlist;
});
