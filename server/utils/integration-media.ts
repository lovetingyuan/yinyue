import type { H3Event } from "h3";
import { libraryDatabase } from "./library";
import { mediaBucket } from "./media-bucket";

export function integrationMedia(event: H3Event) {
  const config = useRuntimeConfig(event);
  const origin = config.public.siteUrl;
  if (!config.integrationPlayback || !/^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(origin)) {
    throw createError({ statusCode: 404 });
  }
  return {
    origin,
    secret: config.mediaSigningSecret,
    bucket: mediaBucket(event),
    db: libraryDatabase(event),
  };
}
