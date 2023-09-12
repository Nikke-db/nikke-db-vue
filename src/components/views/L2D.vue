<template>
    <div class="l2dGlobal">
        <Loader/>
        <WrapperPc v-if="!checkMobile()" />
        <WrapperMobile v-else />
    </div>
</template>

<script setup lang="ts">
import Loader from '@/components/common/Spine/Loader.vue'
import { useMarket } from '@/stores/market'
import WrapperPc from '@/components/common/Spine/WrapperPC.vue';
import WrapperMobile from '@/components/common/Spine/WrapperMobile.vue'

const market = useMarket()

const checkMobile = () => {
    return market.globalParams.isMobile ? true : false
}
</script>

<style lang="less" scoped>

</style>