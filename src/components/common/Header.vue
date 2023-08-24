<template>
    <div class="flexbox main-bg main-box-shadow">
        <span>
            <RouterLink to="/"><img :src="logo" class="logo"/></RouterLink>
        </span>
        <span class="routes">
            <RouterLink to="c" class="redirect">Characters</RouterLink>
            <RouterLink to="t" class="redirect">Tools</RouterLink>
            <RouterLink to="v" class="redirect">Live2D Visualiser</RouterLink>
        </span>
    </div>
</template>

<script setup lang="ts">
import { watch} from 'vue'

import logo from "@/assets/nikke-db.png"

import { useLoaderStore } from '@/stores/loaderStore'
import { useLoadingBar } from 'naive-ui'

const loaderStore = useLoaderStore()
const loadingBar = useLoadingBar()

watch(() => loaderStore.load, () => {
    if (loaderStore.load) {
        loadingBar.start()
    } else {
        loadingBar.finish()
    }
})

</script>

<style lang="less" scoped>

.flexbox{
    height: 100px;
    display: flex;
    flex-direction: row;
    width: 100%;
    margin-bottom: 20px;

    span {
        width: 100%;
        flex:1;

        &.routes {
            flex: 50 0 0;

            align-items: center;
            margin-top: 30px;

            text-align: right;
            .redirect{
                width:100vw;
                margin-right: 25px;
            }
        }
    }

    .logo {
        margin: 0 50px 0 50px;
        height: 100px;
        user-select: none;
    }
}
</style>