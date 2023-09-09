<template>
    <div>
        <HeaderMobile v-show="market.globalParams.isMobile" :routes="ROUTES"></HeaderMobile>
        <HeaderPC v-show="!market.globalParams.isMobile" :routes="ROUTES"/>
    </div>
</template>

<script setup lang="ts">
import HeaderPC from '@/components/common/Header/HeaderPC.vue'
import HeaderMobile from '@/components/common/Header/HeaderMobile.vue';

import { ROUTES } from "@/components/common/Header/routes2Display"

import { useMarket } from '@/stores/market'

const market = useMarket()
</script>

<style lang="less">

</style>