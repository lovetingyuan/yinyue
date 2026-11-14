import { songs } from "../../database/library-schema";
import { libraryDatabase } from "../../utils/library";
import { withLibraryFiles } from "../../utils/library-files";
import { songFields, songMetadata } from "../../utils/library-songs";
import { audioUpload, coverUpload, uploadForm } from "../../utils/library-upload";

export default defineEventHandler(async (event) => {
  const { user } = await requireUserSession(event, { user: { emailVerified: true } });
  const form = await uploadForm(event);
  const metadata = songMetadata(form);
  const cover = coverUpload(form.get("cover"));
  const audio = await audioUpload(form.get("audio"));
  const db = libraryDatabase(event);
  const song = await withLibraryFiles(
    event,
    user.id,
    [audio, cover],
    async ([audioId, coverId]) => {
      if (!audioId) throw createError({ statusCode: 500 });
      return db
        .insert(songs)
        .values({
          ...metadata,
          id: crypto.randomUUID(),
          ownerId: user.id,
          audioId,
          coverId,
          duration: audio.duration,
          createdAt: Date.now(),
        })
        .returning(songFields)
        .get();
    },
  );
  setResponseStatus(event, 201);
  return song;
});
