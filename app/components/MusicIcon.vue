<script setup lang="ts">
import {
  ArrowLeft,
  AudioLines,
  ChevronDown,
  Clock,
  Ellipsis,
  Image,
  ListMusic,
  Menu,
  Music,
  Pause,
  Play,
  Plus,
  Search,
  SkipBack,
  SkipForward,
  Volume2,
  X,
} from "@lucide/vue";

const icons = {
  music: Music,
  image: Image,
  menu: Menu,
  playlist: ListMusic,
  search: Search,
  plus: Plus,
  more: Ellipsis,
  clock: Clock,
  play: Play,
  pause: Pause,
  previous: SkipBack,
  next: SkipForward,
  back: ArrowLeft,
  down: ChevronDown,
  close: X,
  volume: Volume2,
  wave: AudioLines,
};
defineProps<{ name: keyof typeof icons }>();
</script>

<template>
  <component
    :is="icons[name]"
    :stroke-width="1.8"
    aria-hidden="true"
    class="size-5 shrink-0"
    :fill="['play', 'pause', 'previous', 'next'].includes(name) ? 'currentColor' : 'none'"
  />
</template>
