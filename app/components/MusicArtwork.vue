<script setup lang="ts">
const props = defineProps<{ src?: string | null; zoomable?: boolean }>();
const broken = ref(false);
const preview = useTemplateRef("preview");
watch(
  () => props.src,
  () => {
    broken.value = false;
  },
);
</script>

<template>
  <span
    class="relative grid aspect-square shrink-0 place-items-center overflow-hidden rounded-[18%] bg-[#29493c]"
  >
    <img
      v-if="src && !broken"
      :src="src"
      alt=""
      class="absolute inset-0 size-full object-cover"
      @error="broken = true"
    />
    <span
      v-else
      class="grid size-[76%] place-items-center rounded-full bg-[repeating-radial-gradient(circle,#19332a_0%_6%,#36584a_7%_8%)] shadow-md"
    >
      <span class="grid size-[33%] place-items-center rounded-full bg-[#c6deb1]">
        <span class="size-[18%] rounded-full bg-[#263b30]" />
      </span>
    </span>
    <button
      v-if="zoomable && src && !broken"
      type="button"
      class="pointer-events-auto absolute inset-0 cursor-zoom-in focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary"
      aria-label="查看封面大图"
      aria-haspopup="dialog"
      @click="showMusicDialog(preview)"
    />
    <Teleport v-if="zoomable && src && !broken" to="body">
      <dialog ref="preview" class="modal" aria-label="封面大图">
        <div class="modal-box relative w-fit max-w-[90vw] p-0">
          <img :src="src" alt="封面大图" class="max-h-[85dvh] max-w-full object-contain" />
          <form method="dialog" class="absolute top-2 right-2">
            <button class="btn btn-circle btn-sm" aria-label="关闭封面大图">
              <MusicIcon name="close" class="size-4" />
            </button>
          </form>
        </div>
        <form method="dialog" class="modal-backdrop">
          <button tabindex="-1" aria-label="关闭封面大图" />
        </form>
      </dialog>
    </Teleport>
  </span>
</template>
