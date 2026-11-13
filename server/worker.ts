import worker from "#music-worker-base";
import { uploadMaxBytes } from "../shared/library-limits";

export default {
  ...worker,
  async fetch(request: Request, env: unknown, context: unknown) {
    if (/^multipart\/form-data\b/i.test(request.headers.get("content-type") ?? "")) {
      const length = Number(request.headers.get("content-length"));
      if (!Number.isSafeInteger(length) || length < 1 || length > uploadMaxBytes) {
        return Response.json({ code: "UPLOAD_SIZE", message: "上传文件超过大小限制。" }, {
          status: 413, headers: { "cache-control": "private, no-store" },
        });
      }
    }
    const response = await worker.fetch(request, env, context);
    const length = response.headers.get("x-music-content-length");
    if (request.method !== "HEAD" || length === null) return response;
    // Nitro's Node response adapter drops Content-Length on HEAD.
    const headers = new Headers(response.headers);
    headers.delete("x-music-content-length");
    headers.set("content-length", length);
    return new Response(null, { status: response.status, statusText: response.statusText, headers });
  },
};
