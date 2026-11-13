<script setup lang="ts">
import type { Playlist } from "~~/shared/types/library";

defineProps<{ playlists: Playlist[]; coverUrls: Record<string, string>; selected: string | null }>();
const emit = defineEmits<{ select: [string]; edit: [Playlist?] }>();
const sections = [
  { id: "", name: "所有歌曲", icon: "music" },
  { id: "default", name: "默认歌单", icon: "playlist" },
] as const;
</script>

<template>
  <nav aria-label="歌单" class="grid content-start gap-1">
    <button v-for="item in sections" :key="item.id" type="button" class="btn btn-ghost justify-start gap-3 px-3 font-medium"
      :class="{ 'bg-primary/10 text-primary': selected === item.id }" :aria-current="selected === item.id ? 'true' : undefined"
      @click="emit('select', item.id)">
      <MusicIcon :name="item.icon" /> {{ item.name }}
    </button>
    <div class="mt-5 flex items-center justify-between gap-2 px-3">
      <h3 class="text-xs font-semibold text-base-content/65">我的歌单</h3>
      <button type="button" class="btn btn-ghost btn-circle btn-sm -mr-1" aria-label="新建歌单" title="新建歌单" @click="emit('edit')">
        <MusicIcon name="plus" class="size-4" />
      </button>
    </div>
    <div v-for="item in playlists" :key="item.id" class="flex items-center rounded-field"
      :class="{ 'bg-primary/10 text-primary': selected === item.id }">
      <button type="button" class="btn btn-ghost min-w-0 flex-1 justify-start gap-3 px-3 font-medium"
        :aria-current="selected === item.id ? 'true' : undefined" @click="emit('select', item.id)">
        <MusicArtwork :src="item.coverId ? coverUrls[item.coverId] : undefined" class="w-6" />
        <span class="truncate">{{ item.name }}</span>
      </button>
      <button type="button" class="btn btn-ghost btn-circle btn-sm mr-1" :aria-label="`编辑${item.name}`" @click="emit('edit', item)">
        <MusicIcon name="more" class="size-4" />
      </button>
    </div>
  </nav>
</template>
