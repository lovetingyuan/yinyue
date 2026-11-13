<script setup lang="ts">
import type { Song } from "~~/shared/types/library";
import { audioMaxBytes, coverMaxBytes } from "~~/shared/library-limits";

const props = defineProps<{ song?: Song }>();
const emit = defineEmits<{ saved: []; cancel: [] }>();
const { request } = useMusicApi();
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
const removeCover = ref(false);
const oversizedCover = ref(false);
const reading = ref(false);
const busy = ref(false);
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
        cover.value = new File([new Uint8Array(embedded.data)], "embedded-cover", { type: embedded.format });
      }
    }
  } catch {
    error.value = "无法读取 ID3，可以手动填写资料。";
  } finally {
    reading.value = false;
  }
}

function selectCoverFile(event: Event) {
  cover.value = event.target instanceof HTMLInputElement ? event.target.files?.[0] : undefined;
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
  busy.value = true;
  error.value = "";
  const body = new FormData();
  for (const [name, value] of Object.entries(form)) body.set(name, value);
  if (audio.value) body.set("audio", audio.value);
  if (cover.value) body.set("cover", cover.value);
  if (removeCover.value) body.set("removeCover", "true");
  try {
    await request(props.song ? `/api/songs/${props.song.id}` : "/api/songs", {
      method: props.song ? "PATCH" : "POST", body,
    });
  } catch (cause) {
    error.value = libraryError(cause);
  } finally {
    busy.value = false;
  }
  if (!error.value) emit("saved");
}

defineExpose({ busy });
</script>

<template>
  <form class="grid gap-4" @submit.prevent="save">
    <h2 class="text-2xl font-bold tracking-tight sm:text-3xl">{{ song ? "编辑歌曲" : "新增歌曲" }}</h2>
    <label v-if="!song" class="grid gap-2 rounded-box border border-dashed border-primary/35 bg-primary/5 p-4 text-sm font-medium">
      <span class="flex items-center gap-2"><MusicIcon name="music" /> MP3 文件 <span class="ml-auto text-xs text-base-content/65">最大 15 MiB</span></span>
      <input class="file-input w-full" type="file" accept=".mp3,audio/mpeg" :disabled="busy || reading" required @change="selectAudio">
    </label>
    <div class="grid grid-cols-2 gap-3">
      <label v-for="field in fields" :key="field.name" class="grid gap-1.5 text-sm font-medium">
        {{ field.label }}
        <input v-model.trim="form[field.name]" class="input w-full" :required="field.name === 'title' || field.name === 'artist'"
          :maxlength="field.name === 'year' ? 4 : 250" :inputmode="field.name === 'year' ? 'numeric' : 'text'" :disabled="busy || reading">
      </label>
    </div>
    <label class="grid gap-1.5 text-sm font-medium">介绍<textarea v-model.trim="form.description" class="textarea w-full" maxlength="4000" :disabled="busy || reading" /></label>
    <label class="grid gap-1.5 text-sm font-medium">
      封面
      <input class="file-input w-full" type="file" accept="image/jpeg,image/png,image/webp" :disabled="busy || reading" @change="selectCoverFile">
    </label>
    <div v-if="cover || oversizedCover || (song?.coverId && !removeCover)" class="flex flex-wrap items-center justify-between gap-2">
      <p v-if="oversizedCover" class="text-error" role="alert">封面超过 1 MiB，请移除或重新选择。</p>
      <p v-else-if="cover" class="truncate text-sm">{{ cover.name }}</p>
      <button class="btn btn-sm" type="button" :disabled="busy || reading" @click="clearCover">移除封面</button>
    </div>
    <p v-if="error" role="alert" class="text-error">{{ error }}</p>
    <div class="flex justify-end gap-2">
      <button class="btn btn-ghost" type="button" :disabled="busy" @click="emit('cancel')">取消</button>
      <button class="btn btn-primary" :disabled="busy || reading || oversizedCover">{{ busy ? "保存中…" : "保存" }}</button>
    </div>
  </form>
</template>
