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
const sections = [
  { id: "", name: "所有歌曲", icon: Music },
  { id: "default", name: "默认歌单", icon: ListMusic },
] as const;
</script>

<template>
  <div class="grid content-start gap-1">
    <button
      v-for="item in sections"
      :key="item.id"
      type="button"
      class="btn btn-ghost justify-start gap-3 px-3 font-medium"
      :class="{ 'bg-primary/10 text-primary': selected === item.id }"
      :aria-current="selected === item.id ? 'true' : undefined"
      @click="select(item.id)"
    >
      <component :is="item.icon" class="size-5 shrink-0" :stroke-width="1.8" aria-hidden="true" />
      {{ item.name }}
    </button>
    <div class="mt-5 flex items-center justify-between gap-2 pl-3">
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
    <div
      v-for="item in playlists"
      :key="item.id"
      class="flex items-center rounded-field"
      :class="{ 'bg-primary/10 text-primary': selected === item.id }"
    >
      <button
        type="button"
        class="btn btn-ghost min-w-0 flex-1 justify-start gap-3 px-3 font-medium"
        :aria-current="selected === item.id ? 'true' : undefined"
        @click="select(item.id)"
      >
        <MusicArtwork :src="item.coverId ? covers[item.coverId] : undefined" class="w-6" />
        <span class="truncate">{{ item.name }}</span>
      </button>
      <button
        type="button"
        class="btn btn-ghost btn-circle btn-sm mr-1"
        :aria-label="`编辑${item.name}`"
        @click="emit('edit', item)"
      >
        <Ellipsis class="size-4 shrink-0" :stroke-width="1.8" aria-hidden="true" />
      </button>
    </div>
  </div>
</template>
