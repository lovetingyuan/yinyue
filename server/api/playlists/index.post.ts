import { playlists } from "../../database/library-schema";
import { libraryDatabase } from "../../utils/library";
import { withLibraryFiles } from "../../utils/library-files";
import { playlistFields } from "../../utils/library-playlists";
import { coverUpload, formText, uploadForm } from "../../utils/library-upload";

export default defineEventHandler(async (event) => {
  const { user } = await requireUserSession(event, { user: { emailVerified: true } });
  const form = await uploadForm(event);
  const name = formText(form, "name", 250, true) ?? "";
  const cover = coverUpload(form.get("cover"));
  const db = libraryDatabase(event);
  const playlist = await withLibraryFiles(event, user.id, [cover], ([coverId]) =>
    db
      .insert(playlists)
      .values({
        id: crypto.randomUUID(),
        ownerId: user.id,
        name,
        coverId,
        createdAt: Date.now(),
      })
      .returning(playlistFields)
      .get(),
  );
  setResponseStatus(event, 201);
  return playlist;
});
