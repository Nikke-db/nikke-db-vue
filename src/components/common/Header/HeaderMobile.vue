<template>
    <div class="flexbox main-bg main-box-shadow">
        <span>
            <RouterLink to="/"><img :src="logo" class="logo"></RouterLink>
        </span>
        <!-- <div class="iconDiv"> -->
            <!-- <MenuOpenRound class="icon" @click="openDrawer()"/> -->
        <!-- </div> -->
        <n-icon :component="MenuOpenRound" @click="openDrawer()" class="iconDiv" :size="80"/>
        <n-drawer v-model:show="showDrawer" placement="left" :trap-focus="false" :auto-focus="false">
            <n-drawer-content>

                <template #header>
                    Navigation
                </template>

                <template #footer>
                    <n-a :href="globalParams.GITHUB" target="_blank">Visit the source code on GitHub</n-a>
                </template>

                <RouterLink v-for="route in props.routes"
                    :to="route.path" 
                    class="redirect" 
                    :key="'route' + route.path"
                    @click="closeDrawer()">
                        {{ route.text }}<br/>
                </RouterLink>

                

            </n-drawer-content>
        </n-drawer>
    </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'

import logo from "@/assets/nikke-db.png"

import type { route2DisplayInterface } from '@/components/common/Header/routes2Display';

import { MenuOpenRound } from "@vicons/material"
import { globalParams } from '@/utils/enum/globalParams'

import { useMarket } from '@/stores/market'

const market = useMarket()

const showDrawer = ref(false)

const props = defineProps<{
    routes: route2DisplayInterface[]
}>()

const openDrawer = () => {
    showDrawer.value = true
}

const closeDrawer = () => {
    showDrawer.value = false
}

</script>

<style lang="less" scoped>

.flexbox{
    height: 100px;
    display: flex;
    flex-direction: row;
    width: 100%;
    position: absolute;
    top:0;
    z-index: 100;

    .logo {
        margin: 0 50px 0 50px;
        height: 100px;
        user-select: none;
    }

    .iconDiv{
        width: 100%;
        text-align: right;
        margin-right:15px;
        margin-top: 18px;
    }
}

.github {
    height: 10%
}
</style>