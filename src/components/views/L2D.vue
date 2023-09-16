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
import { theme } from '@/utils/enum/globalParams'
import { onUnmounted } from 'vue';
import WrapperPc from '@/components/common/Spine/WrapperPC.vue';
import WrapperMobile from '@/components/common/Spine/WrapperMobile.vue'

const market = useMarket()

onUnmounted(() => {
    document.body.style.backgroundColor = theme.BACKGROUND_COLOR
})

const checkMobile = () => {
    return market.globalParams.isMobile ? true : false
}
</script>

<style lang="less" scoped>

</style>