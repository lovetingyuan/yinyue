<script setup lang="ts">
import { useObjectUrl } from "@vueuse/core";
import type { Song } from "~~/shared/types/library";
import { audioMaxBytes, coverMaxBytes } from "~~/shared/library-limits";

const props = defineProps<{ song?: Song; coverUrl?: string }>();
const emit = defineEmits<{ saved: []; cancel: [] }>();
const saveSong = useSongSave();
const form = reactive({
  title: props.song?.title ?? "",
  artist: props.song?.artist ?? "",
  album: props.song?.album ?? "",
  year: props.song?.year?.toString() ?? "",
  lyricist: props.song?.lyricist ?? "",
  composer: props.song?.composer ?? "",
  description: props.song?.description ?? "",
});
const audio = shallowRef<File>();
const cover = shallowRef<File>();
const localCoverUrl = useObjectUrl(cover);
const audioInput = useTemplateRef("audioInput");
const coverInput = useTemplateRef("coverInput");
const removeCover = ref(false);
const hasCover = computed(() =>
  Boolean(cover.value || (props.song?.coverId && !removeCover.value)),
);
const oversizedCover = ref(false);
const reading = ref(false);
const busy = saveSong.isLoading;
const error = ref("");
const fields = [
  { name: "title", label: "歌曲名" },
  { name: "artist", label: "歌手" },
  { name: "album", label: "专辑" },
  { name: "year", label: "年份" },
  { name: "lyricist", label: "作词" },
  { name: "composer", label: "作曲" },
] as const;

async function selectAudio(event: Event) {
  const file = event.target instanceof HTMLInputElement ? event.target.files?.[0] : undefined;
  audio.value = undefined;
  cover.value = undefined;
  oversizedCover.value = false;
  error.value = "";
  if (!file) return;
  if (file.size > audioMaxBytes) {
    error.value = "MP3 不能超过 15 MiB。";
    return;
  }
  audio.value = file;
  form.artist = "";
  form.album = "";
  form.year = "";
  form.lyricist = "";
  form.composer = "";
  form.description = "";
  form.title = file.name.replace(/\.mp3$/i, "");
  reading.value = true;
  try {
    const { parseBlob, selectCover } = await import("music-metadata");
    const { common, native } = await parseBlob(file);
    form.title = common.title || form.title;
    form.artist = common.artist || "";
    form.album = common.album || "";
    form.year = common.year?.toString() || "";
    form.composer = common.composer?.join("、") || "";
    form.description = common.comment?.[0]?.text || "";
    for (const tags of Object.values(native)) {
      const value: unknown = tags.find((tag) => tag.id === "TEXT" || tag.id === "TXT")?.value;
      if (typeof value === "string") {
        form.lyricist = value;
        break;
      }
    }
    const embedded = selectCover(common.picture);
    if (embedded) {
      oversizedCover.value = embedded.data.byteLength > coverMaxBytes;
      if (!oversizedCover.value) {
        cover.value = new File([new Uint8Array(embedded.data)], "embedded-cover", {
          type: embedded.format,
        });
      }
    }
  } catch {
    error.value = "无法读取 ID3，可以手动填写资料。";
  } finally {
    reading.value = false;
  }
}

function selectCoverFile(event: Event) {
  if (!(event.target instanceof HTMLInputElement)) return;
  cover.value = event.target.files?.[0];
  event.target.value = "";
  oversizedCover.value = (cover.value?.size ?? 0) > coverMaxBytes;
  removeCover.value = false;
}

function clearCover() {
  cover.value = undefined;
  oversizedCover.value = false;
  removeCover.value = true;
}

async function save() {
  if (busy.value || reading.value || (!props.song && !audio.value) || oversizedCover.value) return;
  error.value = "";
  const body = new FormData();
  for (const [name, value] of Object.entries(form)) body.set(name, value);
  if (audio.value) body.set("audio", audio.value);
  if (cover.value) body.set("cover", cover.value);
  if (removeCover.value) body.set("removeCover", "true");
  try {
    await saveSong.mutateAsync({ songId: props.song?.id, body });
  } catch (cause) {
    error.value = libraryError(cause);
  }
  if (!error.value) emit("saved");
}

defineExpose({ busy });
</script>

<template>
  <form class="grid gap-4" @submit.prevent="save">
    <h2 v-if="song" class="text-lg font-semibold">编辑歌曲</h2>
    <div class="grid gap-2" :class="{ 'sm:grid-cols-2': !song }">
      <div v-if="!song" class="min-w-0">
        <input
          ref="audioInput"
          type="file"
          hidden
          accept=".mp3,audio/mpeg"
          :disabled="busy || reading"
          @change="selectAudio"
        />
        <button
          class="btn btn-ghost h-14 w-full justify-start gap-3 rounded-box border-primary/25 bg-primary/5 px-3 text-left hover:bg-primary/10"
          type="button"
          :disabled="busy || reading"
          @click="audioInput?.click()"
        >
          <span
            class="grid size-9 shrink-0 place-items-center rounded-field bg-primary/10 text-primary"
            ><MusicIcon name="music"
          /></span>
          <span class="min-w-0 flex-1">
            <span class="block text-sm">
              {{ audio ? "更换 MP3" : "选择 MP3"
              }}<span class="ml-0.5 text-xs text-error" aria-hidden="true">*</span>
              <span class="sr-only">（必填）</span>
            </span>
            <span
              class="block truncate text-xs font-normal text-base-content/70"
              :title="audio?.name"
            >
              {{ reading ? "读取歌曲资料中…" : (audio?.name ?? "最大 15 MiB") }}
            </span>
          </span>
          <MusicIcon v-if="!audio" name="plus" class="text-primary" />
        </button>
        <span class="sr-only" role="status">{{ reading ? "读取歌曲资料中…" : audio?.name }}</span>
      </div>
      <div class="min-w-0">
        <input
          ref="coverInput"
          type="file"
          hidden
          accept="image/jpeg,image/png,image/webp"
          :disabled="busy || reading"
          @change="selectCoverFile"
        />
        <div
          class="flex h-14 items-center rounded-box border border-base-300 bg-base-100 transition-colors hover:bg-base-200/50"
        >
          <MusicArtwork
            v-if="hasCover"
            zoomable
            :src="localCoverUrl ?? coverUrl"
            class="ml-3 w-9"
          />
          <button
            class="btn btn-ghost h-full min-w-0 flex-1 justify-start gap-3 rounded-box border-0 px-3 text-left hover:bg-transparent hover:shadow-none"
            type="button"
            :disabled="busy || reading"
            @click="coverInput?.click()"
          >
            <span
              v-if="!hasCover"
              class="grid size-9 shrink-0 place-items-center rounded-field bg-base-200 text-base-content/75"
              ><MusicIcon name="image"
            /></span>
            <span class="min-w-0 flex-1">
              <span class="block text-sm">{{ hasCover ? "更换封面" : "选择封面" }}</span>
              <span
                class="block truncate text-xs font-normal text-base-content/70"
                :title="cover?.name"
              >
                {{ cover?.name ?? (hasCover ? "已有封面" : "可选 · 最大 1 MiB") }}
              </span>
            </span>
            <MusicIcon
              v-if="!hasCover && !oversizedCover"
              name="plus"
              class="text-base-content/65"
            />
          </button>
          <button
            v-if="hasCover || oversizedCover"
            class="btn btn-ghost btn-circle mr-1 size-11 shrink-0 hover:bg-transparent hover:text-error hover:shadow-none"
            type="button"
            aria-label="移除封面"
            :disabled="busy || reading"
            @click="clearCover"
          >
            <MusicIcon name="close" class="size-4" />
          </button>
        </div>
        <span class="sr-only" role="status">{{ cover?.name }}</span>
        <p v-if="oversizedCover" class="mt-1 text-xs text-error" role="alert">
          封面超过 1 MiB，请移除或重新选择。
        </p>
      </div>
    </div>
    <div class="grid grid-cols-2 gap-3">
      <label v-for="field in fields" :key="field.name" class="grid gap-1.5 text-sm font-medium">
        <span>
          {{ field.label
          }}<span
            v-if="field.name === 'title' || field.name === 'artist'"
            class="ml-0.5 text-xs text-error"
            aria-hidden="true"
            >*</span
          >
        </span>
        <input
          v-model.trim="form[field.name]"
          class="input w-full"
          :required="field.name === 'title' || field.name === 'artist'"
          :maxlength="field.name === 'year' ? 4 : 250"
          :inputmode="field.name === 'year' ? 'numeric' : 'text'"
          :disabled="busy || reading"
        />
      </label>
    </div>
    <label class="grid gap-1.5 text-sm font-medium"
      >介绍<textarea
        v-model.trim="form.description"
        class="textarea w-full"
        maxlength="4000"
        :disabled="busy || reading"
      />
    </label>
    <p v-if="error" role="alert" class="text-error">{{ error }}</p>
    <div class="flex justify-end gap-2">
      <button class="btn btn-ghost" type="button" :disabled="busy" @click="emit('cancel')">
        取消
      </button>
      <button
        class="btn btn-primary"
        :disabled="busy || reading || (!song && !audio) || oversizedCover"
      >
        {{ busy ? "保存中…" : "保存" }}
      </button>
    </div>
  </form>
</template>
