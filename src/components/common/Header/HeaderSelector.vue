<template>
    <div>
        <HeaderMobile v-show="globalParamStore.isMobile" :routes="ROUTES"> skull emoji</HeaderMobile>
        <HeaderPC v-show="!globalParamStore.isMobile" :routes="ROUTES"/>
    </div>
</template>

<script setup lang="ts">
import { useGlobalParamsStore } from '@/stores/globalParamsStore'
import HeaderPC from '@/components/common/Header/HeaderPC.vue'
import HeaderMobile from '@/components/common/Header/HeaderMobile.vue';

import { ROUTES } from "@/components/common/Header/routes2Display"

const globalParamStore = useGlobalParamsStore()
</script>

<style lang="less">

</style>