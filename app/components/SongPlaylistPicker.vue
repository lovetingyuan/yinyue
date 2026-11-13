<script setup lang="ts">
const { data: song } = useSongDetailsState();
const { playlists, covers } = usePlaylistState();
const membership = useSongMembershipSave();
const dialog = useTemplateRef("dialog");
const list = useTemplateRef("list");
const heading = useTemplateRef("heading");
const titleId = useId();
const selected = ref(new Set<string>());
const saving = membership.isLoading;
const error = ref("");
const changes = computed(() => {
  const saved = new Set(song.value?.playlistIds);
  return playlists.value.filter(({ id }) => selected.value.has(id) !== saved.has(id));
});

async function open() {
  if (dialog.value?.open || !song.value) return;
  selected.value = new Set(song.value.playlistIds);
  error.value = "";
  await nextTick();
  showMusicDialog(dialog.value);
  if (list.value) list.value.scrollTop = 0;
  requestAnimationFrame(() => {
    if (dialog.value?.open && !dialog.value.contains(document.activeElement)) heading.value?.focus();
  });
}

async function save() {
  const songId = song.value?.id;
  if (saving.value || !songId || !changes.value.length) return;
  error.value = "";
  const updates = changes.value.map(({ id }) => ({ id, included: selected.value.has(id) }));
  try {
    const result = await membership.mutateAsync({ songId, changes: updates });
    if (result.succeeded.length === updates.length) dialog.value?.close();
    else error.value = result.succeeded.length ? `部分歌单已保存。${result.error}` : result.error;
  } catch (cause) {
    error.value = libraryError(cause);
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
              <MusicArtwork :src="item.coverId ? covers[item.coverId] : undefined" class="w-9" />
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
    <form method="dialog" class="modal-backdrop"><button tabindex="-1" :disabled="saving">关闭歌单选择</button></form>
  </dialog>
</template>
