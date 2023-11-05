<template>
  <n-button round @click="load()"
      :ghost="carouselData !== null && carouselData.id === dataToLoad.id ? false : true"
      :type="carouselData !== null && carouselData.id === dataToLoad.id ? 'success' : 'info'"
      >{{ dataToLoad.title }}</n-button>
</template>

<script setup lang="ts">
import type { galleryInterface } from '@/utils/interfaces/gallery'

const props = defineProps<{
  carouselData: galleryInterface | null,
  currentId: string,
  dataToLoad: galleryInterface

}>()

const emit = defineEmits(['loadData'])

const load = () => {
  if (props.currentId !== props.dataToLoad.id) {
    emit('loadData', props.dataToLoad)
  }
}

</script>

<style scoped lang="less">
.n-button {
  margin-right: 25px;
  margin-bottom: 15px;
}
</style>