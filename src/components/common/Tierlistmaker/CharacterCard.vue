<template>
  <div>
    <img :src="getImagePath()" :alt="'Picture of ' + props.name"/><br/>
    <span>{{ props.name }}</span>
  </div>
</template>

<script lang="ts" setup>
import { globalParams } from '@/utils/enum/globalParams'

const props = defineProps({
  id: {
    type: String,
    required: true
  },
  name: {
    type: String,
    required: true
  },
  subtext: {
    type: String,
    required: true
  }
})

const getImagePath = () => {
  return globalParams.NIKKE_DB + globalParams.PATH_SPRITE_1 + props.id + globalParams.PATH_SPRITE_2
}
</script>

<style scoped lang="less">
img {
  width: 96px;
  height:96px;
}
</style>