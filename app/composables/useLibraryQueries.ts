import { useInfiniteQuery, useQuery, useQueryCache, useQueryState } from "@pinia/colada";
import type { MediaAuthorization, Playlist, SongDetails, SongPage } from "~~/shared/types/library";
import { libraryKeys } from "~/utils/music-query-keys";

export function useLibraryQueries() {
  const session = useSessionStore();
  const library = useLibraryStore();
  const app = useAppStore();
  const cache = useQueryCache();
  const { request } = useMusicApi();
  const enabled = () => Boolean(session.userId) && !app.offline;
  const songs = useInfiniteQuery<SongPage, Error, number>(
    () => {
      const filters = library.filters;
      return {
        key: [...libraryKeys.songs(session.userId), "pages", filters],
        enabled: enabled(),
        initialPageParam: 0,
        query: async ({ pageParam, signal }) => {
          const { _data } = await request<SongPage>(
            "/api/songs",
            {
              query: { ...filters, offset: pageParam },
              signal,
            },
          );
          return _data ?? { items: [], nextOffset: null };
        },
        getNextPageParam: (page) => page.nextOffset,
      };
    },
  );
  const playlists = useQuery({
    key: () => libraryKeys.playlists(session.userId),
    enabled,
    query: async ({ signal }) =>
      (await request<Playlist[]>("/api/playlists", { signal }))._data ?? [],
  });
  useQuery(() => {
    const id = library.songId;
    return {
      key: libraryKeys.song(session.userId, id ?? ""),
      enabled: Boolean(id) && enabled(),
      query: async ({ signal }) =>
        (await request<SongDetails>(`/api/songs/${id}`, { signal }))._data,
    };
  });
  const player = usePlayerStore();

  function play(songId: string) {
    const { userId } = session;
    const { filters } = library;
    return player.play(async () => {
      const entry = cache.ensure({
        key: [...libraryKeys.songs(userId), "ids", filters],
        query: async ({ signal }) => {
          const { _data } = await request<{ ids: string[] }>("/api/songs", {
            query: { ...filters, ids: true },
            signal,
          });
          return _data?.ids ?? [];
        },
      });
      try {
        return (await cache.fetch(entry)).data ?? [];
      } finally {
        cache.remove(entry);
      }
    }, songId);
  }

  return { songs, playlists, play };
}

export function usePlaylistState() {
  const session = useSessionStore();
  const { data } = useQueryState<Playlist[]>(() => libraryKeys.playlists(session.userId));
  const playlists = computed(() => data.value ?? []);
  const covers = useCoverState(() =>
    playlists.value.flatMap(({ coverId }) => (coverId ? [coverId] : [])),
  );
  return { playlists, covers };
}

export function useSongDetailsState() {
  const session = useSessionStore();
  const library = useLibraryStore();
  return useQueryState<SongDetails>(() => libraryKeys.song(session.userId, library.songId ?? ""));
}

function coverIds(ids: readonly string[]) {
  return [...new Set(ids)].sort();
}

function coverKey(userId: string, ids: string[]) {
  return [...libraryKeys.user(userId), "covers", ids] as const;
}

export function useCoverState(ids: () => readonly string[]) {
  const session = useSessionStore();
  const { data } = useQueryState<Record<string, string>>(() =>
    coverKey(session.userId, coverIds(ids())),
  );
  return computed(() => data.value ?? {});
}

export function useCoverQuery(ids: () => readonly string[]) {
  const session = useSessionStore();
  const app = useAppStore();
  const { request } = useMusicApi();
  return useQuery(() => {
    const list = coverIds(ids());
    return {
      key: coverKey(session.userId, list),
      enabled: Boolean(session.userId && list.length) && !app.offline,
      staleTime: 60 * 60 * 1000,
      query: async ({ signal }) => {
        const covers: Record<string, string> = {};
        for (let index = 0; index < list.length; index += 80) {
          const { _data } = await request<MediaAuthorization>("/api/media/authorize", {
            method: "POST",
            body: { coverIds: list.slice(index, index + 80) },
            signal,
          });
          Object.assign(covers, _data?.covers);
        }
        return covers;
      },
    };
  });
}
