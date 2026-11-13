import { and, eq, inArray, lt } from "drizzle-orm";
import type { H3Event } from "h3";
import { files } from "../database/library-schema";
import type { LibraryUpload } from "../types/library";
import { libraryDatabase, libraryQuota } from "./library";
import { mediaBucket } from "./media-bucket";

export async function withLibraryFiles<T>(
  event: H3Event,
  ownerId: string,
  uploads: (LibraryUpload | null)[],
  save: (ids: (string | null)[]) => Promise<T>,
) {
  const db = libraryDatabase(event);
  const rows = uploads.flatMap((upload) => upload ? [{
    ...upload, id: crypto.randomUUID(), bytes: upload.data.byteLength,
  }] : []);
  if (!rows.length) return save(uploads.map(() => null));
  const bucket = mediaBucket(event);
  const quotaBytes = libraryQuota(event);
  const ids = rows.map(({ id }) => id);
  try {
    await db.insert(files).values(rows.map(({ id, bytes, contentType }): typeof files.$inferInsert => ({
      id, ownerId, bytes, contentType, state: "pending", createdAt: Date.now(), quotaBytes,
    }))).run();
    for (const { id, data, contentType, bytes } of rows) {
      const stored = await bucket.put(id, data, { httpMetadata: { contentType } });
      if (stored.size !== bytes) throw new Error("R2 object size mismatch");
    }
    let index = 0;
    return await save(uploads.map((upload) => upload ? rows[index++]?.id ?? null : null));
  } catch (cause) {
    await db.update(files).set({ state: "delete" }).where(and(inArray(files.id, ids), eq(files.state, "pending"))).run()
      .then(() => cleanupLibraryFiles(db, bucket, ownerId)).catch(reportCleanupError);
    if (cause instanceof Error && /LIBRARY_QUOTA_EXCEEDED/.test(`${cause.message} ${cause.cause}`)) {
      throw createError({ statusCode: 409, statusMessage: "LIBRARY_QUOTA_EXCEEDED" });
    }
    throw cause;
  }
}

export async function cleanupLibraryFiles(
  db: ReturnType<typeof libraryDatabase>, bucket: ReturnType<typeof mediaBucket>, ownerId?: string,
) {
  const owner = ownerId ? eq(files.ownerId, ownerId) : undefined;
  await db.update(files).set({ state: "delete" }).where(and(
    owner, eq(files.state, "pending"), lt(files.createdAt, Date.now() - 60 * 60 * 1000),
  )).run();
  const expired = await db.select({ id: files.id }).from(files).where(and(owner, eq(files.state, "delete")))
    .orderBy(files.createdAt).limit(20).all();
  const cleaned = await Promise.all(expired.map(async ({ id }) => {
    try {
      await bucket.delete(id);
      return id;
    } catch {
      reportCleanupError();
      return null;
    }
  }));
  await db.delete(files).where(and(eq(files.state, "delete"), inArray(files.id, cleaned.filter((id) => id !== null)))).run();
}

export async function cleanupUserFiles(event: H3Event, ownerId: string) {
  try {
    await cleanupLibraryFiles(libraryDatabase(event), mediaBucket(event), ownerId);
  } catch {
    reportCleanupError();
  }
}

function reportCleanupError() {
  console.error("Library file cleanup will retry");
}
