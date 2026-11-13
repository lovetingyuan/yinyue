import { useMutation, useQueryCache } from "@pinia/colada";
import type { SongDetails } from "~~/shared/types/library";
import { accountQueryKey, libraryKeys } from "~/utils/music-query-keys";

export function useSongSave() {
  const { request } = useMusicApi();
  const queryCache = useQueryCache();
  const session = useSessionStore();

  return useMutation({
    key: () => [...libraryKeys.user(session.userId), "save-song"],
    mutation: async ({ songId, body }: { songId?: string; body: FormData }) => {
      await request(songId ? `/api/songs/${songId}` : "/api/songs", { method: songId ? "PATCH" : "POST", body });
    },
    onSuccess: (_, { songId }, { userId, generation }) => session.generation === generation
      ? Promise.allSettled([
          queryCache.invalidateQueries({ key: libraryKeys.songs(userId) }),
          ...(songId ? [queryCache.invalidateQueries({ key: libraryKeys.song(userId, songId) })] : []),
          queryCache.invalidateQueries({ key: accountQueryKey }),
        ])
      : undefined,
    onMutate: () => ({ userId: session.userId, generation: session.generation }),
  });
}

export function usePlaylistSave() {
  const { request } = useMusicApi();
  const queryCache = useQueryCache();
  const session = useSessionStore();

  return useMutation({
    key: () => [...libraryKeys.user(session.userId), "save-playlist"],
    mutation: async ({ playlistId, body }: { playlistId?: string; body: FormData }) => {
      await request(playlistId ? `/api/playlists/${playlistId}` : "/api/playlists", { method: playlistId ? "PATCH" : "POST", body });
    },
    onMutate: () => ({ userId: session.userId, generation: session.generation }),
    onSuccess: (_, __, { userId, generation }) => session.generation === generation
      ? Promise.allSettled([
          queryCache.invalidateQueries({ key: libraryKeys.playlists(userId) }),
          queryCache.invalidateQueries({ key: accountQueryKey }),
        ])
      : undefined,
  });
}

export function useLibraryDelete() {
  const { request } = useMusicApi();
  const queryCache = useQueryCache();
  const session = useSessionStore();
  const library = useLibraryStore();
  const player = usePlayerStore();

  return useMutation({
    key: () => [...libraryKeys.user(session.userId), "delete"],
    mutation: async ({ kind, id }: { kind: "song" | "playlist"; id: string }) => {
      await request(kind === "song" ? `/api/songs/${id}` : `/api/playlists/${id}`, { method: "DELETE" });
    },
    onMutate: () => ({ userId: session.userId, generation: session.generation }),
    async onSuccess(_, { kind, id }, { userId, generation }) {
      if (session.generation !== generation) return;
      if (kind === "song") library.songId = undefined;
      else if (library.playlist === id) library.selectPlaylist("default");
      await Promise.allSettled([
        queryCache.invalidateQueries({ key: libraryKeys.songs(userId) }),
        queryCache.invalidateQueries({ key: libraryKeys.details(userId) }),
        queryCache.invalidateQueries({ key: accountQueryKey }),
        kind === "song" ? player.remove(id) : queryCache.invalidateQueries({ key: libraryKeys.playlists(userId) }),
      ]);
    },
  });
}

export function useSongMembershipSave() {
  const { request } = useMusicApi();
  const queryCache = useQueryCache();
  const session = useSessionStore();

  return useMutation({
    key: () => [...libraryKeys.user(session.userId), "save-memberships"],
    async mutation({ songId, changes }: { songId: string; changes: { id: string; included: boolean }[] }, { generation }) {
      const succeeded: typeof changes = [];
      let error = "";
      for (const change of changes) {
        if (session.generation !== generation) break;
        try {
          await request(`/api/playlists/${change.id}/songs/${songId}`, { method: change.included ? "PUT" : "DELETE" });
          succeeded.push(change);
        } catch (cause) {
          error ||= libraryError(cause);
        }
      }
      return { succeeded, error };
    },
    onMutate: () => ({ userId: session.userId, generation: session.generation }),
    async onSuccess({ succeeded }, { songId }, { userId, generation }) {
      if (!succeeded.length || session.generation !== generation) return;
      const key = libraryKeys.song(userId, songId);
      queryCache.cancelQueries({ key, exact: true });
      const song = queryCache.getQueryData<SongDetails>(key);
      if (song) {
        const ids = new Set(song.playlistIds);
        for (const { id, included } of succeeded) {
          if (included) ids.add(id);
          else ids.delete(id);
        }
        queryCache.setQueryData(key, { ...song, playlistIds: [...ids] });
      }
      await Promise.allSettled([
        queryCache.invalidateQueries({ key, exact: true }),
        queryCache.invalidateQueries({ key: libraryKeys.songs(userId) }),
      ]);
    },
  });
}
