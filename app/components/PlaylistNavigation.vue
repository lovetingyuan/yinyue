<script setup lang="ts">
import { Ellipsis, ListMusic, Music, Plus } from "@lucide/vue";
import type { Playlist } from "~~/shared/types/library";

const { playlists, covers } = usePlaylistState();
const app = useAppStore();
const library = useLibraryStore();
const router = useRouter();
const selected = computed(() =>
  router.currentRoute.value.path !== "/" || library.term ? null : library.playlist,
);
const emit = defineEmits<{ edit: [Playlist?] }>();

async function select(id: string) {
  if (router.currentRoute.value.path !== "/" && (await router.push("/"))) return;
  library.selectPlaylist(id);
  app.drawerOpen = false;
}
</script>

<template>
  <div
    class="grid content-start gap-1 [&_button:active]:translate-none [&_button:focus-visible]:-outline-offset-2"
  >
    <button
      type="button"
      class="btn btn-ghost justify-start gap-3 border-transparent px-3 font-medium"
      :class="selected === '' ? 'bg-primary/10 text-primary' : 'hover:bg-base-content/5'"
      :aria-current="selected === '' ? 'true' : undefined"
      @click="select('')"
    >
      <Music class="size-5 shrink-0" :stroke-width="1.8" aria-hidden="true" />
      所有歌曲
    </button>
    <div class="mt-2 flex items-center justify-between gap-2 pl-3">
      <span class="text-xs font-semibold text-base-content/65">我的歌单</span>
      <button
        type="button"
        class="btn btn-ghost btn-circle btn-sm mr-1"
        aria-label="新建歌单"
        title="新建歌单"
        @click="emit('edit')"
      >
        <Plus class="size-4 shrink-0" :stroke-width="1.8" aria-hidden="true" />
      </button>
    </div>
    <button
      type="button"
      class="btn btn-ghost justify-start gap-3 border-transparent px-3 font-medium"
      :class="selected === 'default' ? 'bg-primary/10 text-primary' : 'hover:bg-base-content/5'"
      :aria-current="selected === 'default' ? 'true' : undefined"
      @click="select('default')"
    >
      <ListMusic class="size-5 shrink-0" :stroke-width="1.8" aria-hidden="true" />
      默认歌单
    </button>
    <div
      v-for="item in playlists"
      :key="item.id"
      class="flex items-center rounded-field"
      :class="selected === item.id ? 'bg-primary/10 text-primary' : 'hover:bg-base-content/5'"
    >
      <button
        type="button"
        class="btn btn-ghost min-w-0 flex-1 justify-start gap-3 border-transparent bg-transparent px-3 font-medium text-current"
        :aria-current="selected === item.id ? 'true' : undefined"
        @click="select(item.id)"
      >
        <MusicArtwork :src="item.coverId ? covers[item.coverId] : undefined" class="w-6" />
        <span class="truncate">{{ item.name }}</span>
      </button>
      <button
        type="button"
        class="btn btn-ghost btn-circle btn-sm mr-1 border-transparent bg-transparent text-current hover:text-primary"
        :aria-label="`编辑${item.name}`"
        @click="emit('edit', item)"
      >
        <Ellipsis class="size-4 shrink-0" :stroke-width="1.8" aria-hidden="true" />
      </button>
    </div>
  </div>
</template>
