<template>
    <n-button ghost type="primary" round @click="capture()">
        Screenshot
    </n-button>
</template>

<script lang="ts" setup>
import { useMarket } from '@/stores/market'

const market = useMarket()

const capture = () => {
    market.live2d.triggerScreenshot()
}

</script>

<style lang="less" scoped>
.n-button {
    width: 100%;
    height: 40px;
}
</style>