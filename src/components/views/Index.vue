<template>
    <div class="body">
        <n-card title="Nikke: Database of Victory" size="medium">
            <n-p>Last Update: August 25th 2023</n-p>
            <RouterLink to="/notice"><n-a>Check out the new notice where I talk about the recent google form.</n-a></RouterLink>
            <n-p>
                Nikke Community decided to shut down the server I used for feedback and update log, so I guess the only way to reach me out is through private discord messages (Koshirei#0333 / koshirei).
            </n-p>
        </n-card>

        <n-card title="Update log:" class="card-spacer">
            <n-p>
                A listing of the updates ( copy paste from legacy website )
            </n-p>
        </n-card>
    </div>
</template>

<script lang="ts" setup>
import { useLoaderStore } from '@/stores/loaderStore';
import { onMounted, onBeforeMount, onUnmounted } from 'vue';

const loaderStore = useLoaderStore()

onBeforeMount(() => {
    loaderStore.beginLoad()
    document.body.classList.add("poli-bg")
})

onMounted(() => {
    setTimeout(()=>{
        loaderStore.endLoad()
    }, 100)
})

onUnmounted(() => {
    document.body.classList.remove("poli-bg")
})

</script>

<style lang="less" scoped>
@import '../../utils/style/global_variables.less';

.body{
    padding-top: 37vh;
}

.n-card{
    background-color: @main-dark-theme-transparent;
    width: 50%;
    margin:0 auto;

    .n-text {
        
        font-size: larger;
    }
}

.card-spacer {
    margin-top: 100px;
}

</style>