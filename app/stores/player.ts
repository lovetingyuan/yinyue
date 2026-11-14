import type { PluginListenerHandle } from "@capacitor/core";
import type { PlaylistPlugin } from "@dwbn/capacitor-plugin-playlist";
import { useQueryCache } from "@pinia/colada";
import { defineStore } from "pinia";
import type {
  MediaAuthorization,
  PlaybackMode,
  PlaybackSnapshot,
  Track,
} from "~~/shared/types/library";
import { libraryKeys } from "~/utils/music-query-keys";

export const usePlayerStore = defineStore("player", () => {
  const { native, request } = useMusicApi();
  const queryCache = useQueryCache();
  const tracks = shallowRef<Track[]>([]);
  const ids = ref<string[]>([]);
  const order = ref<string[]>([]);
  const id = ref("");
  const position = ref(0);
  const mode = ref<PlaybackMode>("sequential");
  const volume = ref(1);
  const playing = ref(false);
  const error = ref("");
  const current = computed(() => tracks.value.find((track) => track.id === id.value));
  const queue = computed(() => {
    const byId = new Map(tracks.value.map((track) => [track.id, track]));
    return order.value.flatMap((trackId) => byId.get(trackId) ?? []);
  });
  let player: PlaylistPlugin | undefined;
  let listener: PluginListenerHandle | undefined;
  let audio: HTMLAudioElement | undefined;
  let owner = "";
  let requestedOwner = "";
  let ownerRevision = 0;
  let operations = Promise.resolve();
  let nativeLoadTarget = "";
  let cancelAuthorization: (() => void) | undefined;

  function storageKey(userId: string) {
    return `music-playback:${userId}`;
  }

  watch([ids, order, id, position, mode, volume], () => {
    if (!import.meta.client || !owner || owner !== requestedOwner || !ids.value.length) return;
    const snapshot: PlaybackSnapshot = {
      ids: ids.value,
      order: order.value,
      id: id.value,
      position: position.value,
      mode: mode.value,
      volume: volume.value,
    };
    try {
      localStorage.setItem(storageKey(owner), JSON.stringify(snapshot));
    } catch {
      /* Storage may be unavailable. */
    }
  });

  function playbackError() {
    playing.value = false;
    error.value = "无法播放，请检查网络或登录状态，再刷新队列。";
  }

  async function initializeNative() {
    if (player) return;
    const { Playlist, RmxAudioStatusMessage: eventType } =
      await import("@dwbn/capacitor-plugin-playlist");
    await Playlist.initialize();
    player = Playlist;
    listener = await Playlist.addListener("status", ({ status }) => {
      if (owner !== requestedOwner) return;
      if (
        status.msgType === eventType.RMXSTATUS_ERROR ||
        status.msgType === eventType.RMXSTATUS_STALLED
      )
        playbackError();
      if (status.value && "currentPosition" in status.value) {
        // Android can report the first track while replacing the native queue.
        if (nativeLoadTarget && status.trackId !== nativeLoadTarget) return;
        if (order.value.includes(status.trackId)) id.value = status.trackId;
        position.value = status.value.currentPosition;
        playing.value = status.value.status === "playing";
      }
    });
  }

  function webAudio() {
    if (audio) return audio;
    audio = new Audio();
    audio.preload = "metadata";
    audio.ontimeupdate = () => {
      position.value = audio?.currentTime ?? 0;
    };
    audio.onplay = () => {
      playing.value = true;
    };
    audio.onpause = () => {
      playing.value = false;
    };
    audio.onended = () => {
      void run(() => step(1));
    };
    audio.onerror = playbackError;
    if ("mediaSession" in navigator) {
      navigator.mediaSession.setActionHandler("play", () => {
        if (!playing.value) void run(toggle);
      });
      navigator.mediaSession.setActionHandler("pause", () => {
        if (playing.value) void run(toggle);
      });
      navigator.mediaSession.setActionHandler("nexttrack", () => {
        void run(() => step(1));
      });
      navigator.mediaSession.setActionHandler("previoustrack", () => {
        void run(() => step(-1));
      });
      navigator.mediaSession.setActionHandler("seekto", ({ seekTime }) => {
        if (seekTime !== undefined) void run(() => seek(seekTime));
      });
    }
    return audio;
  }

  async function load(selected: string, time: number, autoplay: boolean) {
    const track = tracks.value.find(({ id }) => id === selected);
    if (!track) return;
    id.value = selected;
    position.value = time;
    if (native) {
      await initializeNative();
      const output = player;
      if (owner !== requestedOwner || !output) return;
      nativeLoadTarget = selected;
      try {
        await output.setLoop({ loop: mode.value === "loop" && order.value.length > 1 });
        await output.setPlaylistItems({
          items: queue.value.map(({ id, url, title, artist, album, coverUrl }) => ({
            trackId: id,
            assetUrl: url,
            title,
            artist,
            album: album ?? "",
            albumArt: coverUrl ?? undefined,
          })),
          options: { startPaused: true, playFromId: selected },
        });
        await output.setPlaybackVolume({ volume: volume.value });
        if (owner !== requestedOwner) return;
        if (autoplay) await output.playTrackById({ id: selected, position: time });
        else await output.selectTrackById({ id: selected, position: time });
      } finally {
        nativeLoadTarget = "";
      }
    } else {
      const output = webAudio();
      output.src = track.url;
      output.volume = volume.value;
      output.currentTime = time;
      if ("mediaSession" in navigator) {
        navigator.mediaSession.metadata = new MediaMetadata({
          title: track.title,
          artist: track.artist,
          album: track.album ?? "",
          artwork: track.coverUrl ? [{ src: track.coverUrl }] : [],
        });
      }
      if (autoplay) await output.play();
    }
  }

  function arrange(list: string[], selected: string, playbackMode = mode.value) {
    if (playbackMode !== "shuffle") return [...list];
    const remaining = list.filter((track) => track !== selected);
    for (let index = remaining.length - 1; index > 0; index--) {
      const swap = Math.floor(Math.random() * (index + 1));
      const first = remaining[index];
      const second = remaining[swap];
      if (first && second) [remaining[index], remaining[swap]] = [second, first];
    }
    return [selected, ...remaining];
  }

  async function authorize(userId: string, list: string[]) {
    if (!list.length) return [];
    const entry = queryCache.ensure({
      key: [...libraryKeys.user(userId), "track-authorization", list],
      query: async ({ signal }) => {
        const tracks: Track[] = [];
        for (let index = 0; index < list.length; index += 80) {
          const { _data } = await request<MediaAuthorization>("/api/media/authorize", {
            method: "POST",
            body: { songIds: list.slice(index, index + 80) },
            signal,
          });
          tracks.push(...(_data?.tracks ?? []));
        }
        return tracks;
      },
    });
    cancelAuthorization = () => queryCache.cancel(entry);
    try {
      return (await queryCache.fetch(entry)).data ?? [];
    } finally {
      cancelAuthorization = undefined;
      queryCache.remove(entry);
    }
  }

  async function setQueue(
    list: string[],
    selected: string,
    autoplay: boolean,
    snapshot?: PlaybackSnapshot,
  ) {
    const userId = owner;
    const generation = ownerRevision;
    if (!userId || userId !== requestedOwner) return;
    const authorized = await authorize(userId, list);
    if (generation !== ownerRevision) return;
    const available = new Set(authorized.map((track) => track.id));
    const valid = list.filter((track) => available.has(track));
    if (!valid.length) {
      await clearQueue();
      if (list.length) error.value = "队列里没有可播放的歌曲。";
      return;
    }
    tracks.value = authorized;
    ids.value = valid;
    mode.value = snapshot?.mode ?? mode.value;
    if (mode.value === "loop" && valid.length < 2) mode.value = "sequential";
    const next = available.has(selected) ? selected : valid[0];
    if (!next) return;
    const previousOrder = snapshot?.order.filter((track) => available.has(track));
    order.value = previousOrder?.length === valid.length ? previousOrder : arrange(valid, next);
    await load(next, next === selected ? (snapshot?.position ?? 0) : 0, autoplay);
  }

  async function restore() {
    const raw = localStorage.getItem(storageKey(owner));
    if (!raw) return;
    let snapshot: PlaybackSnapshot;
    try {
      snapshot = JSON.parse(raw);
    } catch {
      return;
    }
    if (
      !snapshot ||
      !Array.isArray(snapshot.ids) ||
      !Array.isArray(snapshot.order) ||
      !snapshot.ids.every((id) => typeof id === "string") ||
      !snapshot.order.every((id) => typeof id === "string") ||
      typeof snapshot.id !== "string" ||
      !Number.isFinite(snapshot.position) ||
      !Number.isFinite(snapshot.volume) ||
      !["loop", "shuffle", "sequential"].includes(snapshot.mode)
    )
      return;
    volume.value = Math.max(0, Math.min(1, snapshot.volume));
    await setQueue(snapshot.ids, snapshot.id, false, snapshot);
  }

  async function toggle() {
    if (!current.value) return;
    if (player) {
      if (playing.value) await player.pause();
      else await player.play();
    } else if (audio) {
      if (audio.paused) await audio.play();
      else audio.pause();
    }
  }

  async function step(direction: number) {
    if (player) {
      if (direction === 1) await player.skipForward();
      else await player.skipBack();
      return;
    }
    const index = order.value.indexOf(id.value) + direction;
    const next =
      order.value[index] ??
      (mode.value === "loop" && index >= order.value.length ? order.value[0] : undefined);
    if (next) await load(next, 0, true);
    else if (direction > 0) {
      audio?.pause();
      playing.value = false;
    }
  }

  async function seek(time: number) {
    if (!Number.isFinite(time) || time < 0) return;
    if (player) await player.seekTo({ position: time });
    else if (audio) audio.currentTime = time;
    position.value = time;
  }

  async function setVolume(value: number) {
    if (!Number.isFinite(value) || value < 0 || value > 1) return;
    volume.value = value;
    if (player) await player.setPlaybackVolume({ volume: value });
    if (audio) audio.volume = value;
  }

  async function setMode(value: PlaybackMode) {
    const nextMode = value === "loop" && ids.value.length < 2 ? "sequential" : value;
    if (nextMode === mode.value) return;
    if (!id.value) {
      mode.value = nextMode;
      return;
    }
    const nextOrder = arrange(ids.value, id.value, nextMode);
    if (player) {
      const nativeOrder = [...order.value];
      for (const [index, trackId] of nextOrder.entries()) {
        const from = nativeOrder.indexOf(trackId);
        if (from < 0 || from === index) continue;
        await player.moveItem({ from, to: index });
        nativeOrder.splice(from, 1);
        nativeOrder.splice(index, 0, trackId);
      }
      await player.setLoop({ loop: nextMode === "loop" });
    }
    mode.value = nextMode;
    order.value = nextOrder;
  }

  async function refresh() {
    if (!ids.value.length) {
      await restore();
      return;
    }
    await setQueue(ids.value, id.value, true, {
      ids: ids.value,
      order: order.value,
      id: id.value,
      position: position.value,
      volume: volume.value,
      mode: mode.value,
    });
  }

  async function clearQueue() {
    resetQueue();
    if (owner) localStorage.removeItem(storageKey(owner));
    if (player) await player.clearAllItems();
    if (audio) {
      audio.pause();
      audio.removeAttribute("src");
      audio.load();
    }
  }

  function resetQueue() {
    tracks.value = [];
    ids.value = [];
    order.value = [];
    id.value = "";
    position.value = 0;
    playing.value = false;
  }

  async function remove(trackId: string) {
    if (!ids.value.includes(trackId)) return;
    const remaining = ids.value.filter((id) => id !== trackId);
    if (!remaining.length) {
      await clearQueue();
      return;
    }
    const selected = trackId === id.value;
    if (selected) {
      await player?.pause();
      audio?.pause();
    }
    await setQueue(
      remaining,
      selected ? (remaining[0] ?? "") : id.value,
      !selected && playing.value,
      {
        ids: remaining,
        order: order.value.filter((id) => id !== trackId),
        id: id.value,
        position: selected ? 0 : position.value,
        volume: volume.value,
        mode: mode.value,
      },
    );
  }

  async function release() {
    const output = player;
    const statusListener = listener;
    listener = undefined;
    player = undefined;
    if (audio) {
      audio.ontimeupdate = audio.onplay = audio.onpause = audio.onended = audio.onerror = null;
      audio.pause();
      audio.removeAttribute("src");
      audio.load();
    }
    if (audio && "mediaSession" in navigator) {
      navigator.mediaSession.metadata = null;
      for (const action of ["play", "pause", "nexttrack", "previoustrack", "seekto"] as const) {
        navigator.mediaSession.setActionHandler(action, null);
      }
    }
    audio = undefined;
    await Promise.allSettled([statusListener?.remove()]);
    await Promise.allSettled([output?.release()]);
  }

  function setOwner(userId: string) {
    if (!import.meta.client || requestedOwner === userId) return operations;
    requestedOwner = userId;
    const generation = ++ownerRevision;
    cancelAuthorization?.();
    resetQueue();
    operations = operations.then(async () => {
      if (generation !== ownerRevision) return;
      await release();
      if (generation !== ownerRevision) return;
      owner = userId;
      mode.value = "sequential";
      volume.value = 1;
      error.value = "";
      if (userId) {
        try {
          await restore();
        } catch {
          if (generation === ownerRevision) playbackError();
        }
      }
    });
    return operations;
  }

  function run(action: () => Promise<void>) {
    const userId = requestedOwner;
    const generation = ownerRevision;
    operations = operations.then(async () => {
      if (!userId || owner !== userId || generation !== ownerRevision) return;
      error.value = "";
      try {
        await action();
      } catch {
        if (generation === ownerRevision) playbackError();
      }
    });
    return operations;
  }

  return {
    tracks,
    ids,
    order,
    id,
    current,
    queue,
    position,
    mode,
    volume,
    playing,
    error,
    setOwner,
    play: (loadIds: () => Promise<string[]>, selected: string) =>
      run(async () => {
        await setQueue(await loadIds(), selected, true);
      }),
    toggle: () => run(toggle),
    step: (direction: number) => run(() => step(direction)),
    seek: (time: number) => run(() => seek(time)),
    setVolume: (value: number) => run(() => setVolume(value)),
    setMode: (value: PlaybackMode) => run(() => setMode(value)),
    refresh: () => run(refresh),
    remove: (trackId: string) => run(() => remove(trackId)),
  };
});
