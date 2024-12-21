<template>
  <n-checkbox v-model:checked="market.live2d.isYapping" :disabled="!market.live2d.canYap">
    <n-icon size="18" style="position:relative; top:5px">
      <Volume />
    </n-icon>
    Yap mode
  </n-checkbox>
</template>

<script setup lang="ts">

import { useMarket } from '@/stores/market'
import { watch } from 'vue'
import { Volume } from '@vicons/tabler'

const market = useMarket()

// if can't yap ( aim/cover/cutscene ) , disable the yapper + disable it on character change
watch(() => market.live2d.canYap, (value) => {
  if (!value) {
    market.live2d.isYapping = false
  }
})

</script>

<style scoped lang="less">

</style>