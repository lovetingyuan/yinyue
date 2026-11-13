import { drizzle } from "drizzle-orm/d1";
import { requireD1Database } from "../utils/auth-database";
import { cleanupLibraryFiles } from "../utils/library-files";
import { requireMediaBucket } from "../utils/media-bucket";

export default defineNitroPlugin((app) => {
  app.hooks.hook("cloudflare:scheduled", async ({ env }) => {
    if (typeof env !== "object" || !env || !("DB" in env) || !("MEDIA" in env)) {
      throw new Error("Library cleanup bindings are unavailable");
    }
    await cleanupLibraryFiles(drizzle(requireD1Database(env.DB)), requireMediaBucket(env.MEDIA));
  });
});
