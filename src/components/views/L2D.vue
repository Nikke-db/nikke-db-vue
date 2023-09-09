<template>
    <div class="l2dGlobal">
        <Loader/>
    </div>
</template>

<script setup lang="ts">
import Loader from '@/components/common/Spine/Loader.vue'
import { useMarket } from '@/stores/market'

const market = useMarket()

const checkMobile = () => {
    return market.globalParams.isMobile ? true : false
}
</script>

<style lang="less" scoped>

</style>