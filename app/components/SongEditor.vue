<script setup lang="ts">
import { Image, Music, Plus, X } from "@lucide/vue";
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
const fieldId = useId();
const fieldErrors = reactive<Partial<Record<keyof typeof form | "audio" | "cover", string>>>({});
const audioNotice = ref("");
const coverError = computed(() =>
  oversizedCover.value ? "封面超过 1 MiB，请移除或重新选择。" : fieldErrors.cover,
);
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
  fieldErrors.audio = "";
  fieldErrors.cover = "";
  audioNotice.value = "";
  error.value = "";
  if (!file) return;
  if (file.size > audioMaxBytes) {
    fieldErrors.audio = "MP3 不能超过 15 MiB。";
    if (audioInput.value) audioInput.value.value = "";
    return;
  }
  audio.value = file;
  for (const { name } of fields) fieldErrors[name] = "";
  fieldErrors.description = "";
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
    audioNotice.value = "无法读取 ID3，可以手动填写资料。";
  } finally {
    reading.value = false;
  }
}

function selectCoverFile(event: Event) {
  if (!(event.target instanceof HTMLInputElement)) return;
  cover.value = event.target.files?.[0];
  event.target.value = "";
  oversizedCover.value = (cover.value?.size ?? 0) > coverMaxBytes;
  fieldErrors.cover = "";
  removeCover.value = false;
}

function clearCover() {
  cover.value = undefined;
  oversizedCover.value = false;
  fieldErrors.cover = "";
  removeCover.value = true;
}

async function save() {
  if (busy.value || reading.value) return;
  error.value = "";
  if (!props.song && !audio.value) fieldErrors.audio ||= "请选择 MP3 文件。";
  if (!form.title) fieldErrors.title = "请填写歌曲名。";
  if (!form.artist) fieldErrors.artist = "请填写歌手。";
  if (form.year && !/^[1-9]\d{3}$/.test(form.year))
    fieldErrors.year = "请输入 1000 至 9999 的四位年份。";
  for (const { name } of fields) {
    if (name !== "year" && form[name].length > 250) fieldErrors[name] = "最多填写 250 字。";
  }
  if (form.description.length > 4000) fieldErrors.description = "最多填写 4000 字。";
  if (coverError.value || Object.values(fieldErrors).some(Boolean)) return;
  const body = new FormData();
  for (const [name, value] of Object.entries(form)) body.set(name, value);
  if (audio.value) body.set("audio", audio.value);
  if (cover.value) body.set("cover", cover.value);
  if (removeCover.value) body.set("removeCover", "true");
  try {
    await saveSong.mutateAsync({ songId: props.song?.id, body });
    emit("saved");
  } catch (cause) {
    const { field, message } = libraryFormError(cause);
    const metadataField = fields.find(({ name }) => name === field)?.name;
    if (field === "audio" || field === "cover" || field === "description") {
      fieldErrors[field] = message;
    } else if (metadataField) {
      fieldErrors[metadataField] = message;
    } else {
      error.value = message;
    }
  }
}

defineExpose({ busy });
</script>

<template>
  <form class="grid gap-4" novalidate @submit.prevent="save">
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
          class="btn btn-ghost validator h-14 w-full justify-start gap-3 rounded-box bg-primary/5 px-3 text-left hover:bg-primary/10"
          :class="fieldErrors.audio ? 'border-error' : 'border-primary/25'"
          type="button"
          :disabled="busy || reading"
          :aria-invalid="!!fieldErrors.audio"
          :aria-describedby="
            fieldErrors.audio
              ? `${fieldId}-audio-error`
              : audioNotice
                ? `${fieldId}-audio-notice`
                : undefined
          "
          @click="audioInput?.click()"
        >
          <span
            class="grid size-9 shrink-0 place-items-center rounded-field bg-primary/10 text-primary"
            ><Music class="size-5 shrink-0" :stroke-width="1.8" aria-hidden="true"
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
          <Plus
            v-if="!audio"
            class="text-primary size-5 shrink-0"
            :stroke-width="1.8"
            aria-hidden="true"
          />
        </button>
        <p
          v-if="fieldErrors.audio"
          :id="`${fieldId}-audio-error`"
          class="validator-hint mt-1"
          role="alert"
        >
          {{ fieldErrors.audio }}
        </p>
        <p
          v-else-if="audioNotice"
          :id="`${fieldId}-audio-notice`"
          class="mt-1 text-xs text-warning"
          role="status"
        >
          {{ audioNotice }}
        </p>
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
          class="validator flex h-14 items-center rounded-box border bg-base-100 transition-colors hover:bg-base-200/50"
          :class="coverError ? 'border-error' : 'border-base-300'"
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
            :aria-invalid="!!coverError"
            :aria-describedby="coverError ? `${fieldId}-cover-error` : undefined"
            @click="coverInput?.click()"
          >
            <span
              v-if="!hasCover"
              class="grid size-9 shrink-0 place-items-center rounded-field bg-base-200 text-base-content/75"
              ><Image class="size-5 shrink-0" :stroke-width="1.8" aria-hidden="true"
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
            <Plus
              v-if="!hasCover && !oversizedCover"
              class="text-base-content/65 size-5 shrink-0"
              :stroke-width="1.8"
              aria-hidden="true"
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
            <X class="size-4 shrink-0" :stroke-width="1.8" aria-hidden="true" />
          </button>
        </div>
        <span class="sr-only" role="status">{{ cover?.name }}</span>
        <p
          v-if="coverError"
          :id="`${fieldId}-cover-error`"
          class="validator-hint mt-1"
          role="alert"
        >
          {{ coverError }}
        </p>
      </div>
    </div>
    <div class="grid grid-cols-2 gap-3">
      <div v-for="field in fields" :key="field.name" class="grid content-start gap-1.5 text-sm">
        <label :for="`${fieldId}-${field.name}`" class="font-medium">
          {{ field.label
          }}<span
            v-if="field.name === 'title' || field.name === 'artist'"
            class="ml-0.5 text-xs text-error"
            aria-hidden="true"
            >*</span
          >
        </label>
        <input
          :id="`${fieldId}-${field.name}`"
          v-model.trim="form[field.name]"
          class="input validator w-full"
          :required="field.name === 'title' || field.name === 'artist'"
          :maxlength="field.name === 'year' ? 4 : 250"
          :inputmode="field.name === 'year' ? 'numeric' : 'text'"
          :disabled="busy || reading"
          :aria-invalid="!!fieldErrors[field.name]"
          :aria-describedby="fieldErrors[field.name] ? `${fieldId}-${field.name}-error` : undefined"
          @input="fieldErrors[field.name] = ''"
        />
        <p
          v-if="fieldErrors[field.name]"
          :id="`${fieldId}-${field.name}-error`"
          class="validator-hint mt-0"
          role="alert"
        >
          {{ fieldErrors[field.name] }}
        </p>
      </div>
    </div>
    <div class="grid gap-1.5 text-sm">
      <label :for="`${fieldId}-description`" class="font-medium">介绍</label>
      <textarea
        :id="`${fieldId}-description`"
        v-model.trim="form.description"
        class="textarea validator w-full"
        maxlength="4000"
        :disabled="busy || reading"
        :aria-invalid="!!fieldErrors.description"
        :aria-describedby="fieldErrors.description ? `${fieldId}-description-error` : undefined"
        @input="fieldErrors.description = ''"
      />
      <p
        v-if="fieldErrors.description"
        :id="`${fieldId}-description-error`"
        class="validator-hint mt-0"
        role="alert"
      >
        {{ fieldErrors.description }}
      </p>
    </div>
    <p v-if="error" role="alert" class="text-error">{{ error }}</p>
    <div class="flex justify-end gap-2">
      <button class="btn btn-ghost" type="button" :disabled="busy" @click="emit('cancel')">
        取消
      </button>
      <button class="btn btn-primary" :disabled="busy || reading">
        {{ busy ? "保存中…" : "保存" }}
      </button>
    </div>
  </form>
</template>
