<script setup lang="ts">
const props = defineProps<{ userId: string; native: boolean }>();
const emit = defineEmits<{ changed: [] }>();
const library = useTemplateRef("library");
const router = useRouter();

function refresh() {
  void library.value?.refresh();
  emit("changed");
}

defineExpose({ release: () => library.value?.release() });
</script>

<template>
  <MusicLibrary ref="library" v-bind="props" :show-library="router.currentRoute.value.path === '/'" @changed="emit('changed')">
    <NuxtPage @saved="refresh" />
  </MusicLibrary>
</template>
