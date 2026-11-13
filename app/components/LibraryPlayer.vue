<script setup lang="ts">
import { storeToRefs } from "pinia";

const player = usePlayerStore();
const { current: track, queue, position, volume, playing, mode, error } = storeToRefs(player);
const nowPlaying = useTemplateRef("nowPlaying");
const queueDialog = useTemplateRef("queueDialog");
const duration = computed(() => track.value?.duration || 0);
const seekPreview = ref<number>();
const displayedPosition = computed(() => seekPreview.value ?? position.value);
const progress = computed(() => duration.value ? Math.min(1, Math.max(0, displayedPosition.value / duration.value)) : 0);

watch(() => track.value?.id, (trackId) => {
  seekPreview.value = undefined;
  if (trackId) return;
  queueDialog.value?.close();
  nowPlaying.value?.close();
}, { flush: "sync" });

function rangeValue(event: Event) {
  return event.target instanceof HTMLInputElement ? event.target.valueAsNumber : 0;
}

function commitSeek(event: Event) {
  seekPreview.value = undefined;
  void player.seek(rangeValue(event));
}

function changeMode(event: Event) {
  if (!(event.target instanceof HTMLSelectElement)) return;
  const value = event.target.value;
  if (value === "sequential" || value === "loop" || value === "shuffle") void player.setMode(value);
}
</script>

<template>
  <footer v-if="track || error" class="shrink-0 px-3 pb-2 pt-2 sm:px-4 sm:pb-3">
    <div v-if="error" role="alert" class="alert alert-error alert-soft mb-2 text-sm">
      {{ error }} <button class="btn btn-xs" @click="player.refresh()">刷新队列</button>
    </div>
    <div v-if="track" class="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-2 gap-y-1 rounded-box bg-neutral px-2.5 py-2 text-neutral-content shadow-lg sm:px-4 md:grid-cols-[minmax(0,1fr)_minmax(14rem,1.4fr)_minmax(0,1fr)]">
      <button type="button" class="flex min-w-0 cursor-pointer items-center gap-3 rounded-field text-left"
        aria-haspopup="dialog" aria-label="打开正在播放" @click="showMusicDialog(nowPlaying)">
        <MusicArtwork :src="track.coverUrl" class="w-11" />
        <span class="min-w-0 flex-1">
          <span class="block truncate text-sm font-semibold">{{ track.title }}</span>
          <span class="block truncate text-xs text-neutral-content/70">{{ track.artist }}</span>
        </span>
      </button>
      <div class="contents md:flex md:flex-col md:items-center">
        <div class="flex items-center gap-0.5 md:gap-2">
          <button type="button" class="btn btn-ghost btn-circle hidden text-neutral-content hover:bg-neutral-content/12 md:inline-flex" aria-label="上一首" @click="player.step(-1)"><MusicIcon name="previous" class="size-4" /></button>
          <button type="button" class="btn btn-circle size-10 border-0 bg-neutral-content text-neutral hover:bg-neutral-content/85"
            :aria-label="playing ? '暂停' : '播放'" @click="player.toggle()"><MusicIcon :name="playing ? 'pause' : 'play'" /></button>
          <button type="button" class="btn btn-ghost btn-circle text-neutral-content hover:bg-neutral-content/12" aria-label="下一首" @click="player.step(1)"><MusicIcon name="next" class="size-4" /></button>
          <button type="button" class="btn btn-ghost btn-circle text-neutral-content hover:bg-neutral-content/12 md:hidden" aria-label="播放队列" aria-haspopup="dialog" @click="showMusicDialog(queueDialog)"><MusicIcon name="playlist" /></button>
        </div>
        <div class="col-span-full flex w-full items-center gap-2 text-[11px] text-neutral-content/75 tabular-nums">
          <span>{{ formatMusicTime(displayedPosition) }}</span>
          <input :key="track.id" data-playback-seek aria-label="播放进度" class="range range-xs min-h-6 min-w-0 flex-1 touch-none text-neutral-content"
            type="range" min="0" :max="duration" step="0.1" :value="displayedPosition" :disabled="!duration"
            @input="seekPreview = rangeValue($event)" @change="commitSeek" @pointercancel="seekPreview = undefined" @blur="seekPreview = undefined">
          <span>{{ formatMusicTime(duration) }}</span>
        </div>
      </div>
      <div class="hidden items-center justify-end gap-3 md:flex">
        <label class="hidden items-center gap-2 lg:flex">
          <MusicIcon name="volume" class="size-4" />
          <input aria-label="音量" class="range range-xs w-18 text-neutral-content [--range-thumb-size:0.55rem]"
            type="range" min="0" max="1" step="0.05" :value="volume" @input="player.setVolume(rangeValue($event))">
        </label>
        <button type="button" class="btn btn-ghost btn-circle text-neutral-content hover:bg-neutral-content/12" aria-label="播放队列" aria-haspopup="dialog" @click="showMusicDialog(queueDialog)"><MusicIcon name="playlist" /></button>
      </div>
    </div>
  </footer>

  <dialog ref="nowPlaying" class="modal" aria-labelledby="now-playing-title">
    <div class="modal-box safe-panel flex h-dvh max-h-dvh w-screen max-w-none flex-col rounded-none bg-linear-to-b from-base-200 to-base-100
      pt-[max(1.25rem,var(--safe-area-inset-top,env(safe-area-inset-top)))] sm:h-auto sm:max-h-[90dvh] sm:w-lg sm:rounded-box sm:p-6">
      <div class="flex shrink-0 items-center justify-between gap-2">
        <form method="dialog"><button class="btn btn-ghost btn-circle" aria-label="收起正在播放"><MusicIcon name="down" /></button></form>
        <h2 id="now-playing-title" class="text-sm font-semibold text-base-content/70">正在播放</h2>
        <button type="button" class="btn btn-ghost btn-circle" aria-label="播放队列" aria-haspopup="dialog" @click="showMusicDialog(queueDialog)"><MusicIcon name="playlist" /></button>
      </div>
      <div v-if="track" class="grid min-h-0 flex-1 place-items-center overflow-y-auto px-1 py-3 sm:px-8">
        <div class="grid w-full max-w-sm gap-4 sm:gap-5">
          <MusicArtwork :src="track.coverUrl" class="mx-auto w-full max-w-[min(100%,38dvh)] shadow-xl sm:max-w-[min(100%,34dvh)]" />
          <div class="min-w-0">
            <p class="truncate text-2xl font-bold tracking-tight" :title="track.title">{{ track.title }}</p>
            <p class="mt-1 truncate text-sm text-base-content/70">{{ track.artist }}<template v-if="track.album"> · {{ track.album }}</template></p>
          </div>
          <div>
            <input :key="track.id" data-playback-seek aria-label="播放进度" class="range range-primary range-xs min-h-6 w-full touch-none"
              type="range" min="0" :max="duration" step="0.1" :value="displayedPosition" :disabled="!duration"
              @input="seekPreview = rangeValue($event)" @change="commitSeek" @pointercancel="seekPreview = undefined" @blur="seekPreview = undefined">
            <div class="flex justify-between text-xs text-base-content/70 tabular-nums">
              <span>{{ formatMusicTime(displayedPosition) }}</span><span>{{ formatMusicTime(duration) }}</span>
            </div>
          </div>
          <div class="flex items-center justify-center gap-5">
            <button type="button" class="btn btn-ghost btn-circle btn-lg" aria-label="上一首" @click="player.step(-1)"><MusicIcon name="previous" class="size-6" /></button>
            <button type="button" class="btn btn-primary btn-circle size-16" :aria-label="playing ? '暂停' : '播放'" @click="player.toggle()"><MusicIcon :name="playing ? 'pause' : 'play'" class="size-7" /></button>
            <button type="button" class="btn btn-ghost btn-circle btn-lg" aria-label="下一首" @click="player.step(1)"><MusicIcon name="next" class="size-6" /></button>
          </div>
          <div class="flex items-center justify-between gap-4">
            <select aria-label="播放模式" class="select select-sm w-auto" :value="mode" @change="changeMode">
              <option value="sequential">顺序播放</option>
              <option value="loop" :disabled="queue.length < 2">列表循环</option>
              <option value="shuffle">随机播放</option>
            </select>
            <label class="flex min-w-0 max-w-28 items-center gap-2 text-base-content/70">
              <MusicIcon name="volume" class="size-4" />
              <input aria-label="音量" class="range range-xs min-w-0 flex-1" type="range" min="0" max="1" step="0.05" :value="volume" @input="player.setVolume(rangeValue($event))">
            </label>
          </div>
          <div v-if="error" class="flex items-center justify-between gap-2 text-sm text-error" role="alert">
            {{ error }} <button class="btn btn-xs" @click="player.refresh()">刷新队列</button>
          </div>
        </div>
      </div>
    </div>
    <form method="dialog" class="modal-backdrop"><button aria-label="收起正在播放">关闭</button></form>
  </dialog>
  <dialog ref="queueDialog" class="modal modal-bottom sm:modal-middle" aria-labelledby="queue-title">
    <div class="modal-box safe-panel grid max-h-[75dvh] grid-rows-[auto_minmax(0,1fr)] gap-3 overflow-hidden">
      <div class="flex items-center justify-between gap-2">
        <h2 id="queue-title" class="text-xl font-bold">播放队列 <span class="text-sm font-medium text-base-content/65">{{ queue.length }} 首</span></h2>
        <form method="dialog"><button class="btn btn-ghost btn-circle btn-sm" aria-label="关闭播放队列"><MusicIcon name="close" /></button></form>
      </div>
      <ol class="grid content-start overflow-y-auto">
        <li v-for="item in queue" :key="item.id" class="flex items-center gap-3 rounded-field p-2"
          :aria-current="item.id === track?.id ? 'true' : undefined" :class="{ 'bg-primary/10': item.id === track?.id }">
          <MusicArtwork :src="item.coverUrl" class="w-9" />
          <span class="min-w-0 flex-1">
            <span class="block truncate text-sm font-semibold">{{ item.title }}</span>
            <span class="block truncate text-xs text-base-content/65">{{ item.artist }}</span>
          </span>
          <MusicIcon v-if="item.id === track?.id" name="wave" class="size-4 text-primary" />
        </li>
      </ol>
    </div>
    <form method="dialog" class="modal-backdrop"><button aria-label="关闭播放队列">关闭</button></form>
  </dialog>
</template>

<style scoped>
[data-playback-seek] {
  --range-thumb-size: 0.625rem;
  --range-thumb: currentColor;
  --range-p: 0px;
  --range-bg: transparent;
  --range-fill: 0;
  --seek-stop: calc(var(--range-thumb-size) / 2 + (100% - var(--range-thumb-size)) * v-bind(progress));
  background: linear-gradient(90deg, currentColor var(--seek-stop), color-mix(in oklab, currentColor 24%, transparent) 0)
    center / 100% 0.25rem no-repeat;
}

@media (forced-colors: active) {
  [data-playback-seek] {
    appearance: auto;
    background: none;
  }
}
</style>
