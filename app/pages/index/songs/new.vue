<script setup lang="ts">
const emit = defineEmits<{ saved: [] }>();
const router = useRouter();
const editor = useTemplateRef("editor");
useHead({ title: "新增歌曲 · inyue" });

function leave() {
  if (window.history.state?.back) router.back();
  else void router.replace("/");
}

onBeforeRouteLeave(() => !editor.value?.busy);
</script>

<template>
  <section class="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 sm:px-8 sm:py-6" aria-labelledby="new-song-title">
    <div class="mx-auto max-w-2xl">
      <header class="mb-4 flex items-center justify-between gap-3">
        <button type="button" class="btn btn-ghost -ml-3" :disabled="editor?.busy" @click="leave">
          <MusicIcon name="back" />
          返回曲库
        </button>
        <h1 id="new-song-title" class="text-base font-semibold">新增歌曲</h1>
      </header>
      <SongEditor ref="editor" @cancel="leave" @saved="emit('saved'); leave()" />
    </div>
  </section>
</template>
