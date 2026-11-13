<script setup lang="ts">
import { useObjectUrl } from "@vueuse/core";
import { storeToRefs } from "pinia";
import type { Playlist, Song } from "~~/shared/types/library";

const library = useLibraryStore();
const { playlist, search, term } = storeToRefs(library);
const { current } = storeToRefs(usePlayerStore());
const router = useRouter();
const showLibrary = computed(() => router.currentRoute.value.path === "/");
const { songs: songQuery, playlists: playlistQuery, play } = useLibraryQueries();
const { playlists } = usePlaylistState();
const { data: details } = useSongDetailsState();
const songs = computed(() => songQuery.data.value?.pages.flatMap(({ items }) => items) ?? []);
const { hasNextPage, loadNextPage, isLoading: loading } = songQuery;
const playlistCovers = useCoverQuery(() => playlists.value.flatMap(({ coverId }) => coverId ? [coverId] : []));
const songCovers = useCoverQuery(() => songs.value.flatMap(({ coverId }) => coverId ? [coverId] : []));
const coverUrls = computed(() => ({ ...playlistCovers.data.value, ...songCovers.data.value }));
const error = computed(() => {
  const cause = songQuery.error.value ?? playlistQuery.error.value ?? songCovers.error.value ?? playlistCovers.error.value;
  return cause ? libraryError(cause) : "";
});
const dialog = useTemplateRef("dialog");
const songEditor = useTemplateRef("songEditor");
const playlistPicker = useTemplateRef("playlistPicker");
const editing = ref<Song>();
const panel = ref<"song" | "playlist" | "details" | "delete">();
const deleting = ref<"song" | "playlist">();
const playlistName = ref("");
const playlistEdit = ref<Playlist>();
const playlistCover = shallowRef<File>();
const playlistCoverPreview = useObjectUrl(() => panel.value === "playlist" && playlistEdit.value ? playlistCover.value : undefined);
const removeCover = ref(false);
const playlistSave = usePlaylistSave();
const libraryDelete = useLibraryDelete();
const pending = computed(() => playlistSave.isLoading.value || libraryDelete.isLoading.value);
const dialogError = ref("");
const title = computed(() => term.value ? "搜索结果" : playlist.value === "default" ? "默认歌单"
  : playlists.value.find((item) => item.id === playlist.value)?.name ?? "所有歌曲");
const playlistCoverUrl = computed(() => {
  const id = playlists.value.find((item) => item.id === playlist.value)?.coverId;
  return id && !term.value ? coverUrls.value[id] : undefined;
});

async function retryLibrary() {
  await Promise.all([songQuery.refetch(), playlistQuery.refetch()]);
  if (songCovers.error.value) void songCovers.refetch();
  if (playlistCovers.error.value) void playlistCovers.refetch();
}

function playFirst() {
  const song = songs.value[0];
  if (song) void play(song.id);
}

function show(kind: typeof panel.value) {
  panel.value = kind;
  dialogError.value = "";
  showMusicDialog(dialog.value);
}

function closePanel() {
  panel.value = undefined;
  library.songId = undefined;
}

function openSong(song: Song) {
  editing.value = song;
  show("song");
}

function view(song: Song) {
  library.songId = song.id;
  show("details");
}

function openPlaylist(item?: Playlist) {
  playlistEdit.value = item;
  playlistName.value = item?.name ?? "";
  playlistCover.value = undefined;
  removeCover.value = false;
  show("playlist");
}

function selectPlaylistCover(event: Event) {
  playlistCover.value = event.target instanceof HTMLInputElement ? event.target.files?.[0] : undefined;
}

function clearPlaylistCover() {
  playlistCover.value = undefined;
  removeCover.value = Boolean(playlistEdit.value?.coverId);
}

async function update(action: () => Promise<void>) {
  if (pending.value) return;
  dialogError.value = "";
  try { await action(); } catch (cause) { dialogError.value = libraryError(cause); }
}

async function savePlaylist() {
  const body = new FormData();
  body.set("name", playlistName.value);
  if (playlistCover.value) body.set("cover", playlistCover.value);
  else if (removeCover.value) body.set("removeCover", "true");
  await playlistSave.mutateAsync({ playlistId: playlistEdit.value?.id, body });
  dialog.value?.close();
}

async function remove() {
  const kind = deleting.value;
  const id = kind === "song" ? details.value?.id : playlistEdit.value?.id;
  if (!kind || !id) return;
  await libraryDelete.mutateAsync({ kind, id });
  dialog.value?.close();
}

onBeforeUnmount(() => { library.songId = undefined; });
</script>

<template>
  <div class="flex min-h-0 flex-1 flex-col">
    <Teleport defer to="#library-playlists">
      <PlaylistNavigation @edit="openPlaylist" />
    </Teleport>
    <section v-show="showLibrary" class="flex min-h-0 min-w-0 flex-1 flex-col bg-base-100" aria-label="歌曲列表">
      <div class="flex items-center gap-2 px-4 pb-3 pt-2 sm:gap-3 sm:px-6 md:pt-4">
        <form role="search" class="flex min-w-0 flex-1" @submit.prevent="library.submitSearch()">
          <div class="input min-w-0 w-full rounded-full border-transparent bg-base-200">
            <button type="submit" class="btn btn-ghost btn-circle btn-xs -ml-1 text-base-content/70" aria-label="搜索">
              <MusicIcon name="search" class="size-4" />
            </button>
            <input v-model="search" type="search" class="min-w-0" aria-label="搜索歌曲" placeholder="搜索歌曲、歌手或专辑">
          </div>
        </form>
      </div>
      <div class="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-5 sm:px-6">
        <div class="flex items-center gap-3 rounded-box bg-linear-to-br from-primary/17 to-base-200/55 p-3 sm:gap-4 sm:p-4">
          <MusicArtwork :src="playlistCoverUrl" class="w-14 shadow-md sm:w-20" />
          <div class="min-w-0 flex-1">
            <h2 class="line-clamp-2 wrap-anywhere text-xl leading-tight font-bold tracking-tight sm:text-2xl" :title="title">{{ title }}</h2>
            <p v-if="term" class="mt-1 truncate text-sm text-base-content/70">“{{ term }}”</p>
            <p v-else-if="songs.length" class="mt-1 text-sm text-base-content/70">{{ songs.length }}{{ hasNextPage ? '+' : '' }} 首歌曲</p>
          </div>
          <button v-if="songs[0]" type="button" class="btn btn-primary btn-circle shrink-0 sm:btn-lg" aria-label="播放歌单"
            @click="playFirst"><MusicIcon name="play" /></button>
        </div>
        <p v-if="loading && !songs.length" role="status" class="flex items-center gap-2 px-2 py-6 text-sm text-base-content/65">
          <span class="loading loading-spinner loading-xs" aria-hidden="true" /> 加载中…
        </p>
        <div v-else-if="error" class="alert alert-error alert-soft mt-4" role="alert">
          {{ error }} <button class="btn btn-sm" @click="retryLibrary">重试</button>
        </div>
        <div v-else-if="!songs.length" class="grid justify-items-center gap-3 py-12 text-center text-sm text-base-content/70">
          <MusicIcon :name="term ? 'search' : 'music'" class="size-8 text-primary" />
          <p>{{ term ? "没有匹配的歌曲" : "这个歌单还没有歌曲" }}</p>
          <NuxtLink v-if="!term" to="/songs/new" class="btn btn-ghost btn-sm text-primary">新增歌曲</NuxtLink>
        </div>
        <div v-if="songs.length" class="mt-4">
          <div aria-hidden="true" class="hidden items-center gap-3 border-b border-base-300/70 px-3 pb-2 text-xs font-medium text-base-content/65 lg:flex">
            <span class="w-6 text-center">#</span><span class="flex-1">歌曲</span><span class="w-[24%]">专辑</span>
            <MusicIcon name="clock" class="mr-12 size-4" />
          </div>
          <ul class="grid">
            <li v-for="(song, index) in songs" :key="song.id" class="flex items-center gap-1 rounded-field"
              :class="current?.id === song.id ? 'bg-primary/8' : 'hover:bg-base-200/70'">
              <button class="group flex min-w-0 flex-1 cursor-pointer items-center gap-3 rounded-field py-2 pr-1 text-left lg:px-3"
                :aria-label="`播放 ${song.title}`" :aria-current="current?.id === song.id ? 'true' : undefined"
                @click="play(song.id)">
                <span class="relative hidden w-6 shrink-0 place-items-center text-center text-xs tabular-nums lg:grid" aria-hidden="true">
                  <MusicIcon v-if="current?.id === song.id" name="wave" class="size-4 text-primary" />
                  <template v-else><span class="text-base-content/55 group-hover:opacity-0">{{ index + 1 }}</span><MusicIcon name="play" class="absolute size-4 opacity-0 group-hover:opacity-100" /></template>
                </span>
                <MusicArtwork :src="song.coverId ? coverUrls[song.coverId] : undefined" class="w-10" />
                <span class="min-w-0 flex-1">
                  <span class="block truncate text-sm font-semibold" :class="{ 'text-primary': current?.id === song.id }">{{ song.title }}</span>
                  <span class="block truncate text-xs text-base-content/65">{{ song.artist }}<span v-if="song.album" class="lg:hidden"> · {{ song.album }}</span></span>
                </span>
                <span class="hidden w-[26%] truncate text-xs text-base-content/65 lg:block">{{ song.album || '—' }}</span>
                <span v-if="song.duration != null" class="text-xs text-base-content/65 tabular-nums">{{ formatMusicTime(song.duration) }}</span>
              </button>
              <button class="btn btn-ghost btn-circle btn-sm mr-1" :aria-label="`${song.title} 详情`" @click="view(song)"><MusicIcon name="more" /></button>
            </li>
          </ul>
          <button v-if="hasNextPage" class="btn btn-ghost btn-sm mt-3" :disabled="loading" @click="loadNextPage()">加载更多</button>
        </div>
      </div>
    </section>
    <slot />
    <LibraryPlayer />
    <dialog ref="dialog" class="modal modal-bottom sm:modal-middle"
      :aria-label="panel === 'details' ? '歌曲详情' : '管理歌曲和歌单'"
      @cancel="(pending || songEditor?.busy) && $event.preventDefault()" @close="closePanel">
      <div class="modal-box" :class="panel === 'details' ? 'flex max-h-[min(85dvh,42rem)] flex-col overflow-hidden p-0' : 'safe-panel'">
        <SongEditor v-if="panel === 'song'" ref="songEditor" :song="editing"
          :cover-url="editing?.coverId ? coverUrls[editing.coverId] : undefined"
          @cancel="dialog?.close()" @saved="dialog?.close()" />
        <form v-else-if="panel === 'playlist'" class="grid gap-3" @submit.prevent="update(savePlaylist)">
          <h2 class="text-lg font-semibold">{{ playlistEdit ? "编辑歌单" : "新建歌单" }}</h2>
          <label class="grid gap-1">歌单名称<input v-model.trim="playlistName" class="input w-full" required maxlength="250"></label>
          <div v-if="playlistEdit && (playlistCover || (playlistEdit.coverId && !removeCover))" class="grid justify-items-start gap-1">
            <span>封面</span>
            <div class="relative">
              <MusicArtwork :src="playlistCoverPreview ?? (playlistEdit.coverId ? coverUrls[playlistEdit.coverId] : undefined)" class="w-28" />
              <button type="button" class="btn btn-circle btn-sm absolute top-1 right-1" aria-label="移除封面"
                :disabled="pending" @click="clearPlaylistCover"><MusicIcon name="close" class="size-4" /></button>
            </div>
          </div>
          <label v-else class="grid gap-1">封面<input class="file-input w-full" type="file" accept="image/jpeg,image/png,image/webp"
            :disabled="pending" @change="selectPlaylistCover"></label>
          <div class="flex flex-wrap justify-end gap-2">
            <button v-if="playlistEdit" type="button" class="btn btn-error btn-outline mr-auto" @click="deleting = 'playlist'; panel = 'delete'">删除歌单</button>
            <button type="button" class="btn" @click="dialog?.close()">取消</button><button class="btn btn-primary" :disabled="pending">保存</button>
          </div>
        </form>
        <SongDetails v-else-if="panel === 'details'"
          @close="dialog?.close()" @edit="openSong" @delete="deleting = 'song'; panel = 'delete'"
          @playlists="playlistPicker?.open()" />
        <div v-else-if="panel === 'delete'" class="grid gap-3">
          <h2 class="text-lg font-semibold">{{ deleting === "song" ? `删除《${details?.title}》？` : `删除歌单「${playlistEdit?.name}」？` }}</h2>
          <p v-if="deleting === 'playlist'">歌单中的歌曲会保留。</p>
          <div class="flex justify-end gap-2">
            <button class="btn" :disabled="pending" @click="dialog?.close()">取消</button>
            <button class="btn btn-error" :disabled="pending" @click="update(remove)">确认删除</button>
          </div>
        </div>
        <p v-if="dialogError && panel !== 'details'" class="mt-2 text-error" role="alert">{{ dialogError }}</p>
      </div>
      <form method="dialog" class="modal-backdrop"><button tabindex="-1" :disabled="pending || songEditor?.busy">关闭曲库弹窗</button></form>
    </dialog>
    <SongPlaylistPicker v-if="panel === 'details' && details" ref="playlistPicker" />
  </div>
</template>
