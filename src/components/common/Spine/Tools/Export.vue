<template>
  <n-button :disabled="market.live2d.isExportingAnimation" ghost type="primary" round @click="capture()">
    Export
  </n-button>
</template>

<script lang="ts" setup>
import { useMarket } from '@/stores/market'

const market = useMarket()

const capture = () => {
  market.live2d.exportAnimation()
}
</script>

<style lang="less" scoped>
.n-button {
  width: 100%;
  height: 40px;
}
</style>
