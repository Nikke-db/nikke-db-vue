<template>
  <n-button type="primary" ghost round @click="resetPlacement()">
    Reset (z)
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
  market.live2d.triggerResetPlacement()
}
</script>

<style scoped lang="less">
.n-button {
  width: 100%;
  height: 40px;
}
</style>
