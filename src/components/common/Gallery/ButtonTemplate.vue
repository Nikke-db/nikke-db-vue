<template>
  <n-button round @click="load()"
      :ghost="carouselData !== null && carouselData.id === targetId ? false : true"
      :type="carouselData !== null && carouselData.id === targetId ? 'success' : 'info'"
      >Load {{ displayedText }}</n-button>
</template>

<script setup lang="ts">
import type { galleryInterface } from '@/utils/interfaces/gallery'

const props = defineProps<{
  carouselData: galleryInterface | null,
  currentId: string,
  targetId: string,
  displayedText: string
}>()

const emit = defineEmits(['loadData'])

const load = () => {
  if (props.currentId !== props.targetId) {
    emit('loadData', props.targetId)
  }
}

</script>

<style scoped lang="less">
.n-button {
  margin-right: 25px;
  margin-bottom: 15px;
}
</style>