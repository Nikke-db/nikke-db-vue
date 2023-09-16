<template>
    <n-button ghost type="error" round @click="hideUI()">Hide UI</n-button>
</template>

<script setup lang="ts">
import { useMarket } from '@/stores/market'

const market = useMarket()

const hideUI = () => {
    market.message.getMessage().error('(FEATURE TO BE ADDED)')
}
</script>

<style scoped lang="less">
.n-button {
    width: 100%;
    height: 40px;
}
</style>