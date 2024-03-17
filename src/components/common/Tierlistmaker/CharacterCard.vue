<template>
  <div id="card">
    <img :src="getImagePath()" :alt="'Picture of ' + props.nikke.name" :title="props.nikke.name"/><br/>
    <span>{{ props.nikke.name }}</span>
  </div>
</template>

<script lang="ts" setup>
import { globalParams } from '@/utils/enum/globalParams'
import type { character } from '@/utils/interfaces/tierlist/character'
import type { PropType } from 'vue'

const props = defineProps({
  nikke: {
    type: Object as PropType<character>,
    required: true
  }
})

const getImagePath = () => {
  return globalParams.NIKKE_DB + globalParams.PATH_SPRITE_1 + props.nikke.id + globalParams.PATH_SPRITE_2
}
</script>

<style scoped lang="less">
#card {
  text-align: center;
  padding-top: 10px;
  img {
    width: 96px;
    height:96px;
  }
}
</style>