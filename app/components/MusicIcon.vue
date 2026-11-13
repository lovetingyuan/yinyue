<script setup lang="ts">
const paths = {
  music: "M9 18V5l12-2v13 M9 18a3 2 0 1 1-6 0 3 2 0 0 1 6 0 M21 16a3 2 0 1 1-6 0 3 2 0 0 1 6 0",
  image: "M5 4h14a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1z M4 16l5-5 4 4 3-3 4 4 M15 8h.01",
  menu: "M4 6h16 M4 12h16 M4 18h16",
  playlist: "M3 6h13 M3 11h13 M3 16h8 M17 14l5 3-5 3z",
  search: "M16 16l4 4 M18 11a7 7 0 1 1-14 0 7 7 0 0 1 14 0",
  plus: "M12 5v14 M5 12h14",
  more: "M5 12h.01 M12 12h.01 M19 12h.01",
  clock: "M12 7v5l3 2 M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0",
  play: "M8 5v14l11-7z",
  pause: "M9 5H7v14h2z M17 5h-2v14h2z",
  previous: "M18 5v14L8 12z M6 5v14",
  next: "M6 5v14l10-7z M18 5v14",
  back: "M20 12H4 M4 12l7-7 M4 12l7 7",
  down: "m6 9 6 6 6-6",
  close: "m6 6 12 12 M18 6 6 18",
  volume: "M11 5 6 9H3v6h3l5 4z M15 9a4 4 0 0 1 0 6 M18 6a8 8 0 0 1 0 12",
  wave: "M4 11v2 M8 8v8 M12 5v14 M16 8v8 M20 11v2",
};
defineProps<{ name: keyof typeof paths }>();
</script>

<template>
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"
    stroke-linejoin="round" aria-hidden="true" class="size-5 shrink-0">
    <path :d="paths[name]" :fill="['play', 'pause', 'previous', 'next'].includes(name) ? 'currentColor' : 'none'" />
  </svg>
</template>
