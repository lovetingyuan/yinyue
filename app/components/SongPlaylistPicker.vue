<script setup lang="ts">
import type { Playlist } from "~~/shared/types/library";

const props = defineProps<{
  songId: string;
  playlistIds: string[];
  playlists: Playlist[];
  coverUrls: Record<string, string>;
}>();
const emit = defineEmits<{ changed: [string[]] }>();
const { request } = useMusicApi();
const dialog = useTemplateRef("dialog");
const list = useTemplateRef("list");
const heading = useTemplateRef("heading");
const titleId = useId();
const selected = ref(new Set<string>());
const saving = ref(false);
const error = ref("");
const changes = computed(() => {
  const saved = new Set(props.playlistIds);
  return props.playlists.filter(({ id }) => selected.value.has(id) !== saved.has(id));
});

async function open() {
  if (dialog.value?.open) return;
  selected.value = new Set(props.playlistIds);
  error.value = "";
  await nextTick();
  showMusicDialog(dialog.value);
  if (list.value) list.value.scrollTop = 0;
  requestAnimationFrame(() => {
    if (dialog.value?.open && !dialog.value.contains(document.activeElement)) heading.value?.focus();
  });
}

async function save() {
  if (saving.value || !changes.value.length) return;
  saving.value = true;
  error.value = "";
  const saved = new Set(props.playlistIds);
  const updates = changes.value;
  let succeeded = 0;
  try {
    for (const { id } of updates) {
      const included = selected.value.has(id);
      try {
        await request(`/api/playlists/${id}/songs/${props.songId}`, { method: included ? "PUT" : "DELETE" });
        if (included) saved.add(id);
        else saved.delete(id);
        succeeded++;
      } catch (cause) {
        error.value ||= libraryError(cause);
      }
    }
    if (succeeded) emit("changed", [...saved]);
    if (succeeded === updates.length) dialog.value?.close();
    else if (succeeded) error.value = `部分歌单已保存。${error.value}`;
  } finally {
    saving.value = false;
  }
}

defineExpose({ open });
</script>

<template>
  <dialog ref="dialog" class="modal modal-bottom sm:modal-middle open:visible" :aria-labelledby="titleId"
    @cancel="saving && $event.preventDefault()">
    <form class="modal-box flex max-h-[min(78dvh,36rem)] flex-col overflow-hidden p-0 sm:max-w-md" @submit.prevent="save">
      <header class="flex shrink-0 items-center border-b border-base-300/70 px-4 py-4 sm:px-5">
        <h2 :id="titleId" ref="heading" class="text-lg font-bold outline-none" tabindex="-1" autofocus>加入歌单</h2>
      </header>
      <div ref="list" class="min-h-0 overflow-y-auto overscroll-contain px-3 py-2 sm:px-4">
        <fieldset class="min-w-0" :disabled="saving" aria-label="选择歌单">
          <ul v-if="playlists.length" class="grid gap-1">
            <li v-for="item in playlists" :key="item.id">
              <label class="flex min-h-14 cursor-pointer items-center gap-3 rounded-field border border-transparent px-2.5 py-2
                hover:bg-base-200/80 focus-within:border-primary has-checked:bg-primary/10">
                <MusicArtwork :src="item.coverId ? coverUrls[item.coverId] : undefined" class="w-9" />
                <span class="min-w-0 flex-1 truncate text-sm font-medium" :title="item.name">{{ item.name }}</span>
                <input v-model="selected" type="checkbox" :value="item.id" class="checkbox checkbox-sm checkbox-primary shrink-0"
                  @change="error = ''">
              </label>
            </li>
          </ul>
          <p v-else class="px-2 py-8 text-center text-sm text-base-content/70">还没有自建歌单</p>
        </fieldset>
      </div>
      <footer class="shrink-0 border-t border-base-300/70 px-4 pt-3
        pb-[calc(0.75rem+var(--safe-area-inset-bottom,env(safe-area-inset-bottom,0px)))] sm:px-5">
        <p v-if="error" class="mb-2 text-sm text-error" role="alert">{{ error }}</p>
        <div class="flex justify-end gap-2">
          <button type="button" class="btn btn-ghost min-w-18" :disabled="saving" @click="dialog?.close()">取消</button>
          <button type="submit" class="btn btn-primary min-w-18" :disabled="saving || !changes.length">
            <span v-if="saving" class="loading loading-spinner loading-xs" aria-hidden="true" />
            {{ saving ? "保存中…" : "保存" }}
          </button>
        </div>
      </footer>
    </form>
  </dialog>
</template>
