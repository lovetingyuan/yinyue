import { eq, sum } from "drizzle-orm";
import { files } from "../database/library-schema";
import { libraryDatabase, libraryQuota } from "../utils/library";

export default defineEventHandler(async (event) => {
  const { user } = await requireUserSession(event, { user: { emailVerified: true } });
  const usage = await libraryDatabase(event)
    .select({ bytes: sum(files.bytes) })
    .from(files)
    .where(eq(files.ownerId, user.id))
    .get();
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    image: user.image,
    storage: { usedBytes: Number(usage?.bytes ?? 0), quotaBytes: libraryQuota(event) },
  };
});
