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
  <section class="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-5 sm:px-8 sm:py-8" aria-label="新增歌曲">
    <div class="mx-auto max-w-2xl">
      <button type="button" class="btn btn-ghost mb-4 -ml-2" :disabled="editor?.busy" @click="leave">
        <MusicIcon name="back" />
        返回曲库
      </button>
      <SongEditor ref="editor" class="sm:rounded-box sm:bg-base-100 sm:p-8" @cancel="leave" @saved="emit('saved'); leave()" />
    </div>
  </section>
</template>
