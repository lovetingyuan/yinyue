import { audioMaxBytes, coverMaxBytes, uploadMaxBytes } from "../../shared/library-limits";
import type { H3Event, MultiPartData } from "h3";

export async function uploadForm(event: H3Event) {
  const size = Number(getRequestHeader(event, "content-length"));
  if (!Number.isSafeInteger(size) || size < 1 || size > uploadMaxBytes) {
    throw createError({ statusCode: 413, statusMessage: "UPLOAD_SIZE" });
  }
  const parts = await readMultipartFormData(event);
  if (
    !parts ||
    parts.some(({ name }) => !name) ||
    new Set(parts.map(({ name }) => name)).size !== parts.length
  ) {
    throw createError({ statusCode: 400, statusMessage: "INVALID_FORM" });
  }
  return new Map(parts.map((part) => [part.name, part]));
}

export function formText(
  form: Awaited<ReturnType<typeof uploadForm>>,
  name: string,
  length: number,
  required = false,
) {
  const part = form.get(name);
  const value = part && !part.filename ? part.data.toString("utf8").trim() : "";
  if ((required && !value) || value.length > length) {
    throw createError({ statusCode: 400, statusMessage: "INVALID_METADATA" });
  }
  return value || null;
}

export function coverUpload(part?: MultiPartData) {
  if (!part) return null;
  const { data } = part;
  if (data.length > coverMaxBytes)
    throw createError({ statusCode: 413, statusMessage: "COVER_SIZE" });
  const jpeg = data.length > 8 && data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff;
  const png =
    data.length >= 33 &&
    data.subarray(0, 8).toString("hex") === "89504e470d0a1a0a" &&
    data.subarray(12, 16).toString() === "IHDR";
  const webp =
    data.length >= 20 &&
    data.subarray(0, 4).toString() === "RIFF" &&
    data.subarray(8, 12).toString() === "WEBP" &&
    ["VP8 ", "VP8L", "VP8X"].includes(data.subarray(12, 16).toString());
  const contentType = jpeg ? "image/jpeg" : png ? "image/png" : webp ? "image/webp" : null;
  if (!part.filename || !contentType)
    throw createError({ statusCode: 415, statusMessage: "UNSUPPORTED_COVER" });
  return { data, contentType };
}

export async function audioUpload(part?: MultiPartData) {
  if (!part?.filename || !part.data.length)
    throw createError({ statusCode: 400, statusMessage: "MISSING_AUDIO" });
  if (part.data.length > audioMaxBytes)
    throw createError({ statusCode: 413, statusMessage: "AUDIO_SIZE" });
  const { parseBuffer } = await import("music-metadata");
  const { format } = await parseBuffer(part.data, undefined, {
    skipCovers: true,
    duration: true,
  }).catch(() => ({ format: null }));
  if (
    !format ||
    !/^MPEG .+ Layer 3$/.test(format.codec ?? "") ||
    format.container !== "MPEG" ||
    !format.sampleRate
  ) {
    throw createError({ statusCode: 415, statusMessage: "UNSUPPORTED_AUDIO" });
  }
  return { data: part.data, contentType: "audio/mpeg", duration: format.duration ?? null };
}
