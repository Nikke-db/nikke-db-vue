<template>
  <n-button :type="market.live2d.HQassets ? 'success' : 'warning'" round @click="resetPlacement()" :style="{fontWeight: 'bold'}">
    <span v-if="market.live2d.HQassets">HQ Assets</span>
    <span v-else>LQ Assets</span>
  </n-button>
</template>

<script setup lang="ts">
import { useMarket } from '@/stores/market'

const market = useMarket()

document.addEventListener('keypress', (e) => {
  if (e.key.toLowerCase() === 'z') {
    resetPlacement()
  }
})

const resetPlacement = () => {
  market.live2d.HQassets = !market.live2d.HQassets
  market.live2d.triggerResetPlacement()
}
</script>

<style scoped lang="less">
.n-button {
  width: 100%;
  height: 40px;
}
</style>
