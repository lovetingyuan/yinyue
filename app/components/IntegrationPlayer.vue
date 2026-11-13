<script setup lang="ts">
import type { PlaylistPlugin, AudioTrack } from "@dwbn/capacitor-plugin-playlist";
import type { PluginListenerHandle } from "@capacitor/core";

const emit = defineEmits<{ released: [] }>();
const { native, request } = useMusicApi();
const mode = ref<"sequential" | "loop" | "shuffle">("sequential");
const track = ref("");
const position = ref(0);
const status = ref("");
const busy = ref(false);
let player: PlaylistPlugin | undefined;
let listener: PluginListenerHandle | undefined;

async function load() {
  const { _data: urls } = await request<{ id: string; url: string }[]>("/api/integration/tracks");
  if (!urls?.length) throw new Error("没有可播放的测试音频。");
  const { Playlist, RmxAudioStatusMessage } = await import("@dwbn/capacitor-plugin-playlist");
  if (!player) {
    await Playlist.initialize();
    player = Playlist;
    listener = await player.addListener("status", ({ status: event }) => {
      if (event.msgType === RmxAudioStatusMessage.RMXSTATUS_ERROR) {
        status.value = "播放失败，请检查网络或重新载入。";
        return;
      }
      if (["1", "2", "3"].includes(event.trackId)) track.value = event.trackId;
      if ("currentPosition" in event.value) position.value = event.value.currentPosition;
    });
  }
  const items: AudioTrack[] = urls.map(({ id, url }) => ({
    trackId: id, assetUrl: url, title: `测试音频 ${id}`, artist: "inyue", album: "集成验证",
  }));
  if (mode.value === "shuffle" && Math.random() < 0.5) {
    const second = items[1];
    const third = items[2];
    if (second && third) {
      items[1] = third;
      items[2] = second;
    }
  }
  await player.setLoop({ loop: mode.value === "loop" });
  await player.setPlaylistItems({ items, options: { startPaused: true } });
  status.value = `队列 ${items.map((item) => item.trackId).join(" → ")}`;
  await player.play();
}

async function run(action: () => Promise<void> | undefined) {
  busy.value = true;
  try {
    await action();
  } catch (error) {
    status.value = error instanceof Error ? error.message.replace(/https?:\/\/[^\s]+/g, "[地址]") : "播放操作失败。";
  } finally {
    busy.value = false;
  }
}

async function release() {
  if (!player) return;
  await listener?.remove();
  await player.release();
  player = undefined;
  track.value = "";
  position.value = 0;
  status.value = "";
  emit("released");
}

onBeforeUnmount(() => { void release().catch(() => undefined); });
defineExpose({ release });
</script>

<template>
  <section v-if="native" class="grid gap-3 border-t border-base-300 pt-4" aria-label="原生播放验证">
    <label class="grid gap-1">
      播放模式
      <select v-model="mode" class="select w-full" :disabled="busy">
        <option value="sequential">顺序播放</option>
        <option value="loop">列表循环</option>
        <option value="shuffle">随机播放</option>
      </select>
    </label>
    <button id="play-integration" type="button" class="btn btn-primary" :disabled="busy" @click="run(load)">载入并播放测试音频</button>
    <div class="flex flex-wrap gap-2">
      <button type="button" class="btn btn-sm" :disabled="!track || busy" @click="run(() => player?.play())">播放</button>
      <button type="button" class="btn btn-sm" :disabled="!track || busy" @click="run(() => player?.pause())">暂停</button>
      <button type="button" class="btn btn-sm" :disabled="!track || busy" @click="run(() => player?.seekTo({ position: 8 }))">跳到 8 秒</button>
      <button type="button" class="btn btn-sm" :disabled="!track || busy" @click="run(() => player?.skipForward())">下一首</button>
    </div>
    <p role="status">{{ status }}<template v-if="track"> · 第 {{ track }} 首 · {{ Math.floor(position) }} 秒</template></p>
  </section>
</template>
