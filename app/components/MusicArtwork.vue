<script setup lang="ts">
const props = defineProps<{ src?: string | null }>();
const broken = ref(false);
watch(() => props.src, () => { broken.value = false; });
</script>

<template>
  <span aria-hidden="true" class="relative grid aspect-square shrink-0 place-items-center overflow-hidden rounded-[18%] bg-[#29493c]">
    <img v-if="src && !broken" :src="src" alt="" class="absolute inset-0 size-full object-cover" @error="broken = true">
    <span v-else class="grid size-[76%] place-items-center rounded-full bg-[repeating-radial-gradient(circle,#19332a_0%_6%,#36584a_7%_8%)] shadow-md">
      <span class="grid size-[33%] place-items-center rounded-full bg-[#c6deb1]">
        <span class="size-[18%] rounded-full bg-[#263b30]" />
      </span>
    </span>
  </span>
</template>
