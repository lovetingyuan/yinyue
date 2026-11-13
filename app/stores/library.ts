import { defineStore } from "pinia";

export const useLibraryStore = defineStore("library", () => {
  const playlist = ref("default");
  const search = ref("");
  const term = ref("");
  const songId = ref<string>();
  const filters = computed(() => ({ playlist: term.value ? "" : playlist.value, q: term.value }));

  function selectPlaylist(id: string) {
    playlist.value = id;
    search.value = "";
    term.value = "";
  }

  function submitSearch() {
    term.value = search.value.trim();
  }

  function reset() {
    selectPlaylist("default");
    songId.value = undefined;
  }

  return { playlist, search, term, songId, filters, selectPlaylist, submitSearch, reset };
});
