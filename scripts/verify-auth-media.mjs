import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const origin = process.env.MUSIC_TEST_ORIGIN ?? "http://127.0.0.1:8794";
const workerLog = process.argv[2] ?? "temp/worker-phase1.log";
const android = "https://localhost";
const email = `integration-${crypto.randomUUID()}@example.test`;
const password = `Verify-${crypto.randomUUID()}`;
const name = "Integration";
const signIn = { email, password };
const clientIp = `198.18.${crypto.getRandomValues(new Uint8Array(2)).join(".")}`;
const previousLog = await readFile(workerLog, "utf8");

function call(path, { body, headers, method, requestOrigin = origin } = {}) {
  return fetch(new URL(path, origin), {
    method: method ?? (body ? "POST" : "GET"),
    redirect: "manual",
    headers: {
      origin: requestOrigin,
      "cf-connecting-ip": clientIp,
      ...(body ? { "content-type": "application/json" } : {}),
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
}

async function check(response, status) {
  assert.equal(response.status, status, `Expected HTTP ${status}, received ${response.status}.`);
  return response;
}

function cookie(response) {
  const value = response.headers.getSetCookie().find((line) => line.includes("session_token="));
  assert.ok(value);
  return value.split(";")[0];
}

async function mailLink(label, start) {
  for (let attempt = 0; attempt < 20; attempt++) {
    const log = (await readFile(workerLog, "utf8")).slice(start);
    const link = log
      .split(/\r?\n/)
      .find((line) => line.includes(`[本地邮件预览] ${label}`))
      ?.match(/https?:\/\/[^\s]+/)?.[0];
    if (link) {
      assert.equal(new URL(link).origin, origin);
      return link;
    }
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
  throw new Error(`Missing local mail preview for ${label}`);
}

await check(await call("/api/account"), 401);
await check(await call("/api/account", { requestOrigin: "https://example.test" }), 403);
const cors = await check(
  await call("/api/account", {
    method: "OPTIONS",
    requestOrigin: android,
    headers: {
      "access-control-request-method": "GET",
      "access-control-request-headers": "authorization",
    },
  }),
  204,
);
assert.equal(cors.headers.get("access-control-allow-origin"), android);
await check(
  await call("/api/auth/sign-up/email", { body: { ...signIn, name, callbackURL: "/" } }),
  200,
);
const verification = await mailLink("验证邮箱", previousLog.length);
await check(await call("/api/auth/sign-in/email", { body: signIn }), 403);
const resendLog = await readFile(workerLog, "utf8");
await check(
  await call("/api/auth/send-verification-email", { body: { email, callbackURL: "/" } }),
  200,
);
await mailLink("验证邮箱", resendLog.length);
await check(await call(verification), 302);

const web = await check(await call("/api/auth/sign-in/email", { body: signIn }), 200);
const webHeaders = { cookie: cookie(web) };
assert.equal(
  (await (await check(await call("/api/account", { headers: webHeaders }), 200)).json()).email,
  email,
);

const native = await check(
  await call("/api/auth/sign-in/email", { body: signIn, requestOrigin: android }),
  200,
);
const token = native.headers.get("set-auth-token");
assert.ok(token);
assert.equal(native.headers.get("access-control-allow-origin"), android);
const headers = { authorization: `Bearer ${token}` };
assert.equal(
  (await (await check(await call("/api/account", { headers, requestOrigin: android }), 200)).json())
    .email,
  email,
);

const tracks = await (
  await check(await call("/api/integration/tracks", { headers, requestOrigin: android }), 200)
).json();
assert.equal(tracks.length, 3);
const media = new URL(tracks[0].url);
const head = await check(await call(media, { method: "HEAD" }), 200);
const size = Number(head.headers.get("content-length"));
assert.ok(size > 128);
assert.equal(head.headers.get("content-type"), "audio/mpeg");
assert.equal(head.headers.get("accept-ranges"), "bytes");
const partial = await check(await call(media, { headers: { range: "bytes=128-255" } }), 206);
assert.equal(partial.headers.get("content-range"), `bytes 128-255/${size}`);
assert.equal((await partial.arrayBuffer()).byteLength, 128);
const invalid = await check(await call(media, { headers: { range: `bytes=${size}-` } }), 416);
assert.equal(invalid.headers.get("content-range"), `bytes */${size}`);
const suffix = await check(await call(media, { headers: { range: "bytes=-16" } }), 206);
assert.equal((await suffix.arrayBuffer()).byteLength, 16);
const altered = new URL(media);
altered.searchParams.set("sig", "0".repeat(64));
await check(await call(altered), 403);
const localEnv = await readFile(process.env.MUSIC_TEST_ENV ?? "temp/worker.env", "utf8");
const mediaSecret = /^NUXT_MEDIA_SIGNING_SECRET=(.+)$/m.exec(localEnv)?.[1]?.trim();
assert.ok(mediaSecret);
const expired = new URL(media);
const expiredAt = Date.now() - 1000;
const key = await crypto.subtle.importKey(
  "raw",
  new TextEncoder().encode(mediaSecret),
  { name: "HMAC", hash: "SHA-256" },
  false,
  ["sign"],
);
const payload = new TextEncoder().encode(
  JSON.stringify([expired.pathname.split("/").at(-1), expired.searchParams.get("sid"), expiredAt]),
);
expired.searchParams.set("expires", String(expiredAt));
expired.searchParams.set(
  "sig",
  new Uint8Array(await crypto.subtle.sign("HMAC", key, payload)).toHex(),
);
await check(await call(expired), 403);

await check(await call("/api/auth/sign-out", { body: {}, headers, requestOrigin: android }), 200);
await check(await call("/api/account", { headers, requestOrigin: android }), 401);
await check(await call(media, { method: "HEAD" }), 403);

const resetLog = await readFile(workerLog, "utf8");
await check(
  await call("/api/auth/request-password-reset", { body: { email, redirectTo: "/" } }),
  200,
);
const reset = await check(await call(await mailLink("重置密码", resetLog.length)), 302);
const resetToken = new URL(reset.headers.get("location"), origin).searchParams.get("token");
assert.ok(resetToken);
const newPassword = `Reset-${crypto.randomUUID()}`;
await check(
  await call("/api/auth/reset-password", { body: { token: resetToken, newPassword } }),
  200,
);
await check(await call("/api/account", { headers: webHeaders }), 401);
const resetHeaders = { "cf-connecting-ip": clientIp.replace("198.18.", "198.19.") };
await check(await call("/api/auth/sign-in/email", { body: signIn, headers: resetHeaders }), 401);
await check(
  await call("/api/auth/sign-in/email", {
    body: { email, password: newPassword },
    headers: resetHeaders,
  }),
  200,
);
console.log(
  "Verified D1 registration, email verification, Cookie and Bearer sessions, CORS, password reset, R2 Range and signed URL revocation.",
);

const first = {
  cookie: cookie(
    await check(
      await call("/api/auth/sign-in/email", {
        body: { email, password: newPassword },
        headers: { "cf-connecting-ip": "198.17." + clientIp.split(".").slice(2).join(".") },
      }),
      200,
    ),
  ),
};
const secondEmail = `integration-${crypto.randomUUID()}@example.test`;
const secondLog = await readFile(workerLog, "utf8");
await check(
  await call("/api/auth/sign-up/email", {
    body: { name, email: secondEmail, password, callbackURL: "/" },
  }),
  200,
);
await check(await call(await mailLink("验证邮箱", secondLog.length)), 302);
const second = {
  cookie: cookie(
    await check(
      await call("/api/auth/sign-in/email", {
        body: { email: secondEmail, password },
        headers: resetHeaders,
      }),
      200,
    ),
  ),
};
const sample = await readFile("temp/integration-1.mp3");
function multipart(path, fields, headers = first, method = "POST") {
  const form = new FormData();
  for (const [key, value] of Object.entries(fields)) form.set(key, value);
  return fetch(new URL(path, origin), { method, headers: { ...headers, origin }, body: form });
}
const audio = new File([sample], "sample.mp3", { type: "audio/mpeg" });
const fake = new File(["fake"], "fake.mp3", { type: "audio/mpeg" });
const image = new File([await readFile("public/assets/imgs/logo.png")], "logo.png", {
  type: "image/png",
});
await check(
  await multipart("/api/songs", { title: "Fake", artist: "Integration", audio: fake }),
  415,
);
await check(
  await multipart("/api/songs", {
    title: "Oversize",
    artist: "Integration",
    audio,
    cover: new File([new Uint8Array(1024 * 1024 + 1)], "large.png"),
  }),
  413,
);
const song = await (
  await check(
    await multipart("/api/songs", { title: "Sample", artist: "Integration", audio, cover: image }),
    201,
  )
).json();
assert.equal(
  (await (await check(await call("/api/account", { headers: first }), 200)).json()).storage
    .usedBytes,
  audio.size + image.size,
);
await check(await call(`/api/songs/${song.id}`, { headers: second }), 404);
await check(
  await multipart(
    `/api/songs/${song.id}`,
    { title: "Changed", artist: "Integration" },
    second,
    "PATCH",
  ),
  404,
);
await check(await call(`/api/songs/${song.id}`, { headers: second, method: "DELETE" }), 404);
const playlist = await (
  await check(await multipart("/api/playlists", { name: "First", cover: image }), 201)
).json();
assert.equal(
  (await (await check(await call("/api/account", { headers: first }), 200)).json()).storage
    .usedBytes,
  audio.size + 2 * image.size,
);
const playlistCover = await (
  await check(
    await call("/api/media/authorize", { headers: first, body: { coverIds: [playlist.coverId] } }),
    200,
  )
).json();
await check(
  await multipart(
    `/api/playlists/${playlist.id}`,
    { name: "Renamed", removeCover: "true" },
    first,
    "PATCH",
  ),
  200,
);
await check(await call(playlistCover.covers[playlist.coverId], { method: "HEAD" }), 404);
const secondPlaylist = await (
  await check(await multipart("/api/playlists", { name: "Second" }), 201)
).json();
const outsiderPlaylist = await (
  await check(await multipart("/api/playlists", { name: "Other account" }, second), 201)
).json();
const membership = (id) => `/api/playlists/${id}/songs/${song.id}`;
const defaultSongIds = async () =>
  (
    await (
      await check(await call("/api/songs?playlist=default&ids=true", { headers: first }), 200)
    ).json()
  ).ids;
assert.ok((await defaultSongIds()).includes(song.id));
const searched = await (
  await check(await call("/api/songs?q=integration&ids=true", { headers: first }), 200)
).json();
assert.deepEqual(searched.ids, [song.id]);
await check(await call(membership(outsiderPlaylist.id), { headers: second, method: "PUT" }), 404);
await check(await call(membership(playlist.id), { headers: first, method: "PUT" }), 204);
await check(await call(membership(playlist.id), { headers: first, method: "PUT" }), 204);
await check(await call(membership(secondPlaylist.id), { headers: first, method: "PUT" }), 204);
assert.ok(!(await defaultSongIds()).includes(song.id));
await check(await call(membership(playlist.id), { headers: first, method: "DELETE" }), 204);
assert.ok(!(await defaultSongIds()).includes(song.id));
await check(
  await call(`/api/playlists/${secondPlaylist.id}`, { headers: first, method: "DELETE" }),
  204,
);
assert.ok((await defaultSongIds()).includes(song.id));
const unsigned = await (
  await check(
    await call("/api/media/authorize", {
      headers: second,
      body: { songIds: [song.id], coverIds: [song.coverId] },
    }),
    200,
  )
).json();
assert.deepEqual(unsigned, { tracks: [], covers: {} });
const signed = await (
  await check(
    await call("/api/media/authorize", { headers: first, body: { songIds: [song.id] } }),
    200,
  )
).json();
await check(await call(signed.tracks[0].url, { method: "HEAD" }), 200);
await check(await call(`/api/songs/${song.id}`, { headers: first, method: "DELETE" }), 204);
await check(await call(signed.tracks[0].url, { method: "HEAD" }), 404);
assert.equal(
  (await (await check(await call("/api/account", { headers: first }), 200)).json()).storage
    .usedBytes,
  0,
);
console.log(
  "Verified song validation, two-account isolation, multi-playlist membership, signed media revocation and quota release.",
);

if (process.env.MUSIC_TEST_QUOTA === "true") {
  const results = await Promise.all([
    multipart("/api/songs", { title: "Concurrent A", artist: "Integration", audio }),
    multipart("/api/songs", { title: "Concurrent B", artist: "Integration", audio }),
  ]);
  assert.deepEqual(results.map(({ status }) => status).sort(), [201, 409]);
  const winner = results.find(({ status }) => status === 201);
  assert.ok(winner);
  const uploaded = await winner.json();
  assert.equal(
    (await (await check(await call("/api/account", { headers: first }), 200)).json()).storage
      .usedBytes,
    audio.size,
  );
  await check(await call(`/api/songs/${uploaded.id}`, { headers: first, method: "DELETE" }), 204);
  console.log("Verified concurrent uploads cannot exceed the configured quota.");
}
