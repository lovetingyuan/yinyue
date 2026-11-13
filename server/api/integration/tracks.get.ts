import { integrationMedia } from "../../utils/integration-media";
import { signMedia } from "../../utils/media-access";

export default defineEventHandler(async (event) => {
  const { secret, origin } = integrationMedia(event);
  const auth = await requireUserSession(event, { user: { emailVerified: true } });
  const expires = Date.now() + 24 * 60 * 60 * 1000;
  return Promise.all(["1", "2", "3"].map(async (id) => {
    const sid = auth.session.id;
    const sig = await signMedia(secret, id, sid, expires);
    const url = new URL(`/api/integration/media/${id}`, origin);
    url.search = new URLSearchParams({ sid, expires: String(expires), sig }).toString();
    return { id, url: url.href };
  }));
});
