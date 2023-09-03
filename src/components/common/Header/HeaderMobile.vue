<template>
    <div class="flexbox main-bg main-box-shadow">
        <span>
            <RouterLink to="/"><img :src="logo" class="logo"></RouterLink>
        </span>
        <div class="iconDiv">
            <MenuOpenRound class="icon" @click="openDrawer()"/>
        </div>
        <n-drawer v-model:show="showDrawer" placement="left">
            <n-drawer-content title="Navigation">
                <div id="emptyDivDrawer"></div>
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
import { watch, ref } from 'vue'

import logo from "@/assets/nikke-db.png"

import { useLoaderStore } from '@/stores/loaderStore'
import { useLoadingBar } from 'naive-ui'
import type { route2DisplayInterface } from '@/components/common/Header/routes2Display';
import { MenuOpenRound } from "@vicons/material"

const loaderStore = useLoaderStore()
const loadingBar = useLoadingBar()

const showDrawer = ref(false)

watch(() => loaderStore.load, () => {
    if (loaderStore.load) {
        loadingBar.start()
    } else {
        loadingBar.finish()
    }
})

const props = defineProps<{
    routes: route2DisplayInterface[]
}>()

const openDrawer = () => {
    showDrawer.value = true
    setTimeout(()=>{
        try {
            (document.activeElement as HTMLElement).blur();
        } catch {
            console.log("HeaderMobile: activeElement.blur (l56) did not work")
        }
    }, 50)
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

    .logo {
        margin: 0 50px 0 50px;
        height: 100px;
        user-select: none;
    }

    .iconDiv{
        width: 100%;
        text-align: right;
        margin-right:15px;
        .icon{
            color: white;
            height:64px;
            margin-top: 18px;
        }
    }
}
</style>